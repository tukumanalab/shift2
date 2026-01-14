import dotenv from 'dotenv';
import db from '../src/database/db';

// 環境変数を読み込む
dotenv.config();

const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;

if (!GOOGLE_APPS_SCRIPT_URL) {
  console.error('❌ エラー: GOOGLE_APPS_SCRIPT_URL が設定されていません');
  process.exit(1);
}

interface SpreadsheetSpecialShift {
  uuid: string;
  date: string;
  startTime: string;
  endTime: string;
  userId: string;
  userName: string;
  updatedAt?: string;
}

/**
 * Spreadsheetから特別シフトデータを取得
 */
async function fetchSpecialShiftsFromSpreadsheet(): Promise<SpreadsheetSpecialShift[]> {
  try {
    const url = `${GOOGLE_APPS_SCRIPT_URL}?type=loadSpecialShifts&callback=handleResponse`;

    console.log('📊 Spreadsheetから特別シフトデータを取得中...');
    const response = await fetch(url);
    const text = await response.text();

    // JSONP形式のレスポンスからJSONを抽出
    const jsonMatch = text.match(/handleResponse\((.*)\)/);
    if (!jsonMatch) {
      throw new Error('JSONPレスポンスの解析に失敗しました');
    }

    const result = JSON.parse(jsonMatch[1]);

    if (!result.success) {
      throw new Error(result.error || 'データ取得に失敗しました');
    }

    console.log(`✅ ${result.data.length}件の特別シフトデータを取得しました`);
    return result.data;

  } catch (error) {
    console.error('❌ Spreadsheetからのデータ取得に失敗しました:', error);
    throw error;
  }
}

/**
 * 時間文字列をHH:MM形式に変換
 */
function formatTime(timeString: string): string {
  if (!timeString) return '';

  // ISO形式の場合は、時刻部分のみを抽出
  if (timeString.includes('T')) {
    try {
      const date = new Date(timeString);
      // UTCから9時間足してJSTに変換
      const jstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
      const hours = String(jstDate.getUTCHours()).padStart(2, '0');
      const minutes = String(jstDate.getUTCMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch (error) {
      console.error('時間の変換に失敗:', timeString, error);
      return timeString;
    }
  }

  // HH:MM形式の場合はそのまま返す
  if (timeString.match(/^\d{1,2}:\d{2}$/)) {
    return timeString;
  }

  return timeString;
}

/**
 * SQLiteに特別シフトを挿入
 */
function insertSpecialShiftToSQLite(shift: SpreadsheetSpecialShift): { success: boolean; message: string } {
  try {
    // 時間をHH:MM形式に変換
    const startTime = formatTime(shift.startTime);
    const endTime = formatTime(shift.endTime);

    // UUIDで既存データをチェック
    const existing = db.prepare('SELECT * FROM special_shifts WHERE uuid = ?').get(shift.uuid);

    if (existing) {
      return {
        success: false,
        message: `スキップ (既に存在): ${shift.date} ${startTime}-${endTime}`
      };
    }

    // 新しいデータを挿入
    const stmt = db.prepare(`
      INSERT INTO special_shifts (uuid, date, start_time, end_time, user_id, user_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      shift.uuid,
      shift.date,
      startTime,
      endTime,
      shift.userId,
      shift.userName
    );

    return {
      success: true,
      message: `追加: ${shift.date} ${startTime}-${endTime} (${shift.userName})`
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
  console.log('  Spreadsheet → SQLite 特別シフト移行');
  console.log('========================================');
  console.log('');

  try {
    // Spreadsheetからデータを取得
    const shifts = await fetchSpecialShiftsFromSpreadsheet();

    if (shifts.length === 0) {
      console.log('⚠️  移行する特別シフトデータがありません');
      return;
    }

    console.log('');
    console.log(`📝 ${shifts.length}件の特別シフトを処理中...`);
    console.log('');

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // 各特別シフトを処理
    for (let i = 0; i < shifts.length; i++) {
      const shift = shifts[i];
      const result = insertSpecialShiftToSQLite(shift);

      const prefix = `[${i + 1}/${shifts.length}]`;

      if (result.success) {
        console.log(`${prefix} ✅ ${result.message}`);
        successCount++;
      } else if (result.message.includes('スキップ')) {
        console.log(`${prefix} ⏭️  ${result.message}`);
        skipCount++;
      } else {
        console.log(`${prefix} ❌ ${result.message}`);
        errorCount++;
      }
    }

    console.log('');
    console.log('========================================');
    console.log('  移行完了');
    console.log('========================================');
    console.log(`✅ 成功: ${successCount}件`);
    console.log(`⏭️  スキップ: ${skipCount}件 (既存)`);
    console.log(`❌ エラー: ${errorCount}件`);
    console.log('========================================');
    console.log('');

    // SQLiteに保存されている特別シフト総数を表示
    const totalCount = db.prepare('SELECT COUNT(*) as count FROM special_shifts').get() as { count: number };
    console.log(`📊 SQLiteに保存されている特別シフト総数: ${totalCount.count}件`);

  } catch (error) {
    console.error('');
    console.error('❌ 移行処理でエラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプトを実行
main();
