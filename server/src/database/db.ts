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

// 特別シフトテーブルの作成
db.exec(`
  CREATE TABLE IF NOT EXISTS special_shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 人数設定テーブルの作成
db.exec(`
  CREATE TABLE IF NOT EXISTS capacity_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 0,
    memo TEXT,
    user_id TEXT,
    user_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// インデックスを作成（検索パフォーマンスのため）
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_special_shifts_uuid ON special_shifts(uuid);
  CREATE INDEX IF NOT EXISTS idx_special_shifts_date ON special_shifts(date);
  CREATE INDEX IF NOT EXISTS idx_special_shifts_user_id ON special_shifts(user_id);
  CREATE INDEX IF NOT EXISTS idx_capacity_settings_date ON capacity_settings(date);
`);

export default db;
