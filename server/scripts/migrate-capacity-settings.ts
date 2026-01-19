import dotenv from 'dotenv';
import db from '../src/database/db';

// 環境変数を読み込む
dotenv.config();

const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;

if (!GOOGLE_APPS_SCRIPT_URL) {
  console.error('❌ エラー: GOOGLE_APPS_SCRIPT_URL が設定されていません');
  process.exit(1);
}

interface SpreadsheetCapacitySetting {
  date: string;
  capacity: number;
  memo?: string;
}

/**
 * Spreadsheetから人数設定データを取得
 */
async function fetchCapacitySettingsFromSpreadsheet(): Promise<SpreadsheetCapacitySetting[]> {
  try {
    const url = `${GOOGLE_APPS_SCRIPT_URL}?type=loadCapacity&callback=handleResponse`;

    console.log('📊 Spreadsheetから人数設定データを取得中...');
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

    console.log(`✅ ${result.data.length}件の人数設定データを取得しました`);
    return result.data;

  } catch (error) {
    console.error('❌ Spreadsheetからのデータ取得に失敗しました:', error);
    throw error;
  }
}

/**
 * SQLiteに人数設定を挿入
 */
function insertCapacitySettingToSQLite(setting: SpreadsheetCapacitySetting): { success: boolean; message: string } {
  try {
    // 日付で既存データをチェック
    const existing = db.prepare('SELECT * FROM capacity_settings WHERE date = ?').get(setting.date);

    if (existing) {
      // 既存データを更新
      const stmt = db.prepare(`
        UPDATE capacity_settings
        SET capacity = ?,
            memo = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE date = ?
      `);

      stmt.run(
        setting.capacity,
        setting.memo || null,
        setting.date
      );

      return {
        success: true,
        message: `更新: ${setting.date} - 人数:${setting.capacity}`
      };
    }

    // 新しいデータを挿入
    const stmt = db.prepare(`
      INSERT INTO capacity_settings (date, capacity, memo)
      VALUES (?, ?, ?)
    `);

    stmt.run(
      setting.date,
      setting.capacity,
      setting.memo || null
    );

    return {
      success: true,
      message: `追加: ${setting.date} - 人数:${setting.capacity}`
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
  console.log('  Spreadsheet → SQLite 人数設定移行');
  console.log('========================================');
  console.log('');

  try {
    // Spreadsheetからデータを取得
    const settings = await fetchCapacitySettingsFromSpreadsheet();

    if (settings.length === 0) {
      console.log('⚠️  移行する人数設定データがありません');
      return;
    }

    console.log('');
    console.log(`📝 ${settings.length}件の人数設定を処理中...`);
    console.log('');

    let successCount = 0;
    let updateCount = 0;
    let errorCount = 0;

    // 各人数設定を処理
    for (let i = 0; i < settings.length; i++) {
      const setting = settings[i];
      const result = insertCapacitySettingToSQLite(setting);

      const prefix = `[${i + 1}/${settings.length}]`;

      if (result.success) {
        if (result.message.includes('更新')) {
          console.log(`${prefix} 🔄 ${result.message}`);
          updateCount++;
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
    console.log(`🔄 更新: ${updateCount}件`);
    console.log(`❌ エラー: ${errorCount}件`);
    console.log('========================================');
    console.log('');

    // SQLiteに保存されている人数設定総数を表示
    const totalCount = db.prepare('SELECT COUNT(*) as count FROM capacity_settings').get() as { count: number };
    console.log(`📊 SQLiteに保存されている人数設定総数: ${totalCount.count}件`);

  } catch (error) {
    console.error('');
    console.error('❌ 移行処理でエラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプトを実行
main();
