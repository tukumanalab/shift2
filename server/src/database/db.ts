import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../../../data/shift.db');
const db = new Database(dbPath);

// WALモードを有効化（パフォーマンス向上）
db.pragma('journal_mode = WAL');

// ユーザーテーブルの作成
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    picture TEXT,
    nickname TEXT,
    real_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// インデックスを作成（検索パフォーマンスのため）
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
`);

export default db;
