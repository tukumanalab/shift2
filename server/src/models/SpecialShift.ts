import db from '../database/db';
import { v4 as uuidv4 } from 'uuid';

export interface SpecialShift {
  id: number;
  uuid: string;
  date: string;
  start_time: string;
  end_time: string;
  user_id: string;
  user_name: string;
  calendar_event_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SpecialShiftCreateData {
  date: string;
  start_time: string;
  end_time: string;
  user_id: string;
  user_name: string;
}

export class SpecialShiftModel {
  /**
   * すべての特別シフトを取得
   */
  static getAll(): SpecialShift[] {
    try {
      const stmt = db.prepare(`
        SELECT * FROM special_shifts
        ORDER BY date, start_time
      `);
      return stmt.all() as SpecialShift[];
    } catch (error) {
      console.error('Error getting all special shifts:', error);
      return [];
    }
  }

  /**
   * 特定の日付の特別シフトを取得
   */
  static getByDate(date: string): SpecialShift[] {
    try {
      const stmt = db.prepare(`
        SELECT * FROM special_shifts
        WHERE date = ?
        ORDER BY start_time
      `);
      return stmt.all(date) as SpecialShift[];
    } catch (error) {
      console.error('Error getting special shifts by date:', error);
      return [];
    }
  }

  /**
   * 日付範囲で特別シフトを取得
   */
  static getByDateRange(startDate: string, endDate: string): SpecialShift[] {
    try {
      const stmt = db.prepare(`
        SELECT * FROM special_shifts
        WHERE date >= ? AND date <= ?
        ORDER BY date, start_time
      `);
      return stmt.all(startDate, endDate) as SpecialShift[];
    } catch (error) {
      console.error('Error getting special shifts by date range:', error);
      return [];
    }
  }

  /**
   * UUIDで特別シフトを取得
   */
  static getByUuid(uuid: string): SpecialShift | null {
    try {
      const stmt = db.prepare(`
        SELECT * FROM special_shifts
        WHERE uuid = ?
      `);
      return stmt.get(uuid) as SpecialShift | undefined || null;
    } catch (error) {
      console.error('Error getting special shift by UUID:', error);
      return null;
    }
  }

  /**
   * 新しい特別シフトを作成
   */
  static create(data: SpecialShiftCreateData): SpecialShift | null {
    try {
      const uuid = uuidv4();
      const stmt = db.prepare(`
        INSERT INTO special_shifts (uuid, date, start_time, end_time, user_id, user_name)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        uuid,
        data.date,
        data.start_time,
        data.end_time,
        data.user_id,
        data.user_name
      );

      if (result.changes > 0) {
        return this.getByUuid(uuid);
      }
      return null;
    } catch (error) {
      console.error('Error creating special shift:', error);
      return null;
    }
  }

  /**
   * UUIDで特別シフトを削除
   */
  static delete(uuid: string): boolean {
    try {
      const stmt = db.prepare(`
        DELETE FROM special_shifts
        WHERE uuid = ?
      `);
      const result = stmt.run(uuid);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting special shift:', error);
      return false;
    }
  }

  /**
   * 複数のUUIDで特別シフトを削除
   */
  static deleteMultiple(uuids: string[]): { deleted: number; failed: number } {
    let deleted = 0;
    let failed = 0;

    try {
      const stmt = db.prepare(`
        DELETE FROM special_shifts
        WHERE uuid = ?
      `);

      for (const uuid of uuids) {
        try {
          const result = stmt.run(uuid);
          if (result.changes > 0) {
            deleted++;
          } else {
            failed++;
          }
        } catch (error) {
          console.error(`Error deleting special shift ${uuid}:`, error);
          failed++;
        }
      }
    } catch (error) {
      console.error('Error in deleteMultiple:', error);
      failed += uuids.length - deleted;
    }

    return { deleted, failed };
  }
}
