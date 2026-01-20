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

// シフトテーブルの作成
db.exec(`
  CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    date TEXT NOT NULL,
    time_slot TEXT NOT NULL,
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

// カレンダーイベントテーブルの作成
db.exec(`
  CREATE TABLE IF NOT EXISTS calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    calendar_event_id TEXT UNIQUE NOT NULL,
    shift_uuid TEXT,
    special_shift_uuid TEXT,
    event_type TEXT NOT NULL,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    time_range TEXT NOT NULL,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shift_uuid) REFERENCES shifts(uuid) ON DELETE CASCADE,
    FOREIGN KEY (special_shift_uuid) REFERENCES special_shifts(uuid) ON DELETE CASCADE
  )
`);

// インデックスを作成（検索パフォーマンスのため）
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_special_shifts_uuid ON special_shifts(uuid);
  CREATE INDEX IF NOT EXISTS idx_special_shifts_date ON special_shifts(date);
  CREATE INDEX IF NOT EXISTS idx_special_shifts_user_id ON special_shifts(user_id);
  CREATE INDEX IF NOT EXISTS idx_shifts_uuid ON shifts(uuid);
  CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON shifts(user_id);
  CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
  CREATE INDEX IF NOT EXISTS idx_shifts_user_date ON shifts(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_capacity_settings_date ON capacity_settings(date);
  CREATE INDEX IF NOT EXISTS idx_calendar_events_shift_uuid ON calendar_events(shift_uuid);
  CREATE INDEX IF NOT EXISTS idx_calendar_events_special_shift_uuid ON calendar_events(special_shift_uuid);
  CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(date);
  CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
`);

export default db;
