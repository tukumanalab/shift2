import dotenv from 'dotenv';
import db from '../src/database/db';

// 環境変数を読み込む
dotenv.config();

const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;

if (!GOOGLE_APPS_SCRIPT_URL) {
  console.error('❌ エラー: GOOGLE_APPS_SCRIPT_URL が設定されていません');
  process.exit(1);
}

interface SpreadsheetShift {
  registrationDate: string | Date;
  userId: string;
  userName: string;
  userEmail: string;
  shiftDate: string;
  timeSlot: string;
  content: string;
  nickname: string;
  realName: string;
  uuid: string;
}

/**
 * Spreadsheetからシフトデータを取得
 */
async function fetchShiftsFromSpreadsheet(): Promise<SpreadsheetShift[]> {
  try {
    // 管理者として全シフトを取得
    const url = `${GOOGLE_APPS_SCRIPT_URL}?type=loadMyShifts&userId=admin&callback=handleResponse`;

    console.log('📊 Spreadsheetからシフトデータを取得中...');
    const response = await fetch(url);
    const text = await response.text();

    // JSONP形式のレスポンスからJSONを抽出
    const jsonMatch = text.match(/handleResponse\((.*)\)/);
    if (!jsonMatch) {
      throw new Error('JSONPレスポンスの解析に失敗しました');
    }

    const result = JSON.parse(jsonMatch[1]);

    if (!result.success || !Array.isArray(result.data)) {
      throw new Error(result.error || 'データの形式が不正です');
    }

    console.log(`✅ ${result.data.length}件のシフトデータを取得しました`);
    return result.data;

  } catch (error) {
    console.error('❌ Spreadsheetからのデータ取得に失敗しました:', error);
    throw error;
  }
}

/**
 * SQLiteにシフトを挿入
 */
function insertShiftToSQLite(shift: SpreadsheetShift): { success: boolean; message: string } {
  try {
    // UUIDで既存データをチェック
    if (shift.uuid) {
      const existing = db.prepare('SELECT * FROM shifts WHERE uuid = ?').get(shift.uuid);

      if (existing) {
        return {
          success: true,
          message: `スキップ: ${shift.shiftDate} ${shift.timeSlot} (UUID: ${shift.uuid.substring(0, 8)}...)`
        };
      }
    }

    // 重複チェック（UUID がない場合）
    const duplicate = db.prepare(
      'SELECT * FROM shifts WHERE user_id = ? AND date = ? AND time_slot = ?'
    ).get(shift.userId, shift.shiftDate, shift.timeSlot);

    if (duplicate) {
      return {
        success: true,
        message: `スキップ（重複）: ${shift.shiftDate} ${shift.timeSlot} - ${shift.userName}`
      };
    }

    // 新しいデータを挿入
    const stmt = db.prepare(`
      INSERT INTO shifts (uuid, user_id, user_name, date, time_slot)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      shift.uuid || `migrated-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      shift.userId,
      shift.userName,
      shift.shiftDate,
      shift.timeSlot
    );

    return {
      success: true,
      message: `追加: ${shift.shiftDate} ${shift.timeSlot} - ${shift.userName}`
    };

  } catch (error) {
    return {
      success: false,
      message: `エラー: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * メイン処理
 */
async function main() {
  console.log('========================================');
  console.log('  Spreadsheet → SQLite シフト移行');
  console.log('========================================');
  console.log('');

  try {
    // Spreadsheetからデータを取得
    const shifts = await fetchShiftsFromSpreadsheet();

    if (shifts.length === 0) {
      console.log('⚠️  移行するシフトデータがありません');
      return;
    }

    console.log('');
    console.log(`📝 ${shifts.length}件のシフトを処理中...`);
    console.log('');

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // 各シフトを処理
    for (let i = 0; i < shifts.length; i++) {
      const shift = shifts[i];
      const result = insertShiftToSQLite(shift);

      const prefix = `[${i + 1}/${shifts.length}]`;

      if (result.success) {
        if (result.message.includes('スキップ')) {
          console.log(`${prefix} ⏭️  ${result.message}`);
          skipCount++;
        } else {
          console.log(`${prefix} ✅ ${result.message}`);
          successCount++;
        }
      } else {
        console.log(`${prefix} ❌ ${result.message}`);
        errorCount++;
      }
    }

    console.log('');
    console.log('========================================');
    console.log('  移行完了');
    console.log('========================================');
    console.log(`✅ 新規追加: ${successCount}件`);
    console.log(`⏭️  スキップ: ${skipCount}件`);
    console.log(`❌ エラー: ${errorCount}件`);
    console.log('========================================');
    console.log('');

    // SQLiteに保存されているシフト総数を表示
    const totalCount = db.prepare('SELECT COUNT(*) as count FROM shifts').get() as { count: number };
    console.log(`📊 SQLiteに保存されているシフト総数: ${totalCount.count}件`);

    // ユーザー別のシフト数を表示
    console.log('');
    console.log('👥 ユーザー別シフト数:');
    const userCounts = db.prepare(`
      SELECT user_name, COUNT(*) as count
      FROM shifts
      GROUP BY user_id, user_name
      ORDER BY count DESC
    `).all() as { user_name: string; count: number }[];

    userCounts.forEach(row => {
      console.log(`   ${row.user_name}: ${row.count}件`);
    });

  } catch (error) {
    console.error('');
    console.error('❌ 移行処理でエラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプトを実行
main();
