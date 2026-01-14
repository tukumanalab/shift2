/**
 * Spreadsheetのユーザーデータを SQLite に移行するスクリプト
 *
 * 使い方:
 *   npm run migrate:users
 *
 * または:
 *   npx ts-node server/scripts/migrate-users.ts
 */

import dotenv from 'dotenv';
import db from '../src/database/db';

// 環境変数を読み込む
dotenv.config();

// Google Apps Script URL
const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || '';

interface SpreadsheetUser {
  timestamp: string;
  userId: string;
  name: string;
  email: string;
  picture: string;
  nickname: string;
  realName: string;
}

/**
 * Spreadsheetから全ユーザーデータを取得
 */
async function fetchUsersFromSpreadsheet(): Promise<SpreadsheetUser[]> {
  console.log('📊 Spreadsheetからユーザーデータを取得中...');

  const url = new URL(GOOGLE_APPS_SCRIPT_URL);
  url.searchParams.append('type', 'getAllUsers');

  try {
    const response = await fetch(url.toString());
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'データ取得に失敗しました');
    }

    const users = result.data || [];
    console.log(`✅ ${users.length}件のユーザーデータを取得しました`);

    return users;
  } catch (error) {
    console.error('❌ Spreadsheetからのデータ取得に失敗:', error);
    throw error;
  }
}

/**
 * ユーザーデータをSQLiteに挿入
 */
function insertUserToSQLite(user: SpreadsheetUser): { success: boolean; message: string } {
  try {
    // 既存のユーザーをチェック
    const checkStmt = db.prepare('SELECT user_id FROM users WHERE user_id = ?');
    const existing = checkStmt.get(user.userId);

    if (existing) {
      return {
        success: false,
        message: `スキップ (既に存在): ${user.email}`
      };
    }

    // 新しいユーザーを挿入
    const insertStmt = db.prepare(`
      INSERT INTO users (user_id, name, email, picture, nickname, real_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // タイムスタンプの変換（空の場合は現在時刻）
    const createdAt = user.timestamp || new Date().toISOString().replace('T', ' ').substring(0, 19);

    insertStmt.run(
      user.userId,
      user.name,
      user.email,
      user.picture || null,
      user.nickname || null,
      user.realName || null,
      createdAt
    );

    return {
      success: true,
      message: `✅ 追加: ${user.email}`
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ エラー: ${user.email} - ${error}`
    };
  }
}

/**
 * メイン処理
 */
async function main() {
  console.log('========================================');
  console.log('  Spreadsheet → SQLite ユーザー移行');
  console.log('========================================\n');

  // Google Apps Script URLのチェック
  if (!GOOGLE_APPS_SCRIPT_URL) {
    console.error('❌ エラー: GOOGLE_APPS_SCRIPT_URL が設定されていません');
    console.error('   .env ファイルに以下を追加してください:');
    console.error('   GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/...');
    process.exit(1);
  }

  try {
    // Spreadsheetからデータを取得
    const users = await fetchUsersFromSpreadsheet();

    if (users.length === 0) {
      console.log('⚠️  移行するユーザーデータがありません');
      return;
    }

    console.log(`\n📝 ${users.length}件のユーザーを処理中...\n`);

    // 統計情報
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // 各ユーザーを処理
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const result = insertUserToSQLite(user);

      console.log(`[${i + 1}/${users.length}] ${result.message}`);

      if (result.success) {
        successCount++;
      } else if (result.message.includes('スキップ')) {
        skipCount++;
      } else {
        errorCount++;
      }
    }

    // 結果サマリー
    console.log('\n========================================');
    console.log('  移行完了');
    console.log('========================================');
    console.log(`✅ 成功: ${successCount}件`);
    console.log(`⏭️  スキップ: ${skipCount}件 (既存)`);
    console.log(`❌ エラー: ${errorCount}件`);
    console.log('========================================\n');

    // 最終確認
    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM users');
    const total = totalStmt.get() as { count: number };
    console.log(`📊 SQLiteに保存されているユーザー総数: ${total.count}件\n`);

  } catch (error) {
    console.error('❌ 移行処理中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプトを実行
main().catch(error => {
  console.error('予期しないエラー:', error);
  process.exit(1);
});
