import db from '../database/db';
import { v4 as uuidv4 } from 'uuid';

export interface Shift {
  id: number;
  uuid: string;
  user_id: string;
  user_name: string;
  date: string;
  time_slot: string;
  created_at: string;
  updated_at: string;
}

export interface ShiftCreateData {
  user_id: string;
  user_name: string;
  date: string;
  time_slot: string;
}

export interface ShiftCountData {
  [date: string]: {
    [timeSlot: string]: number;
  };
}

export class ShiftModel {
  /**
   * すべてのシフトを取得
   */
  static getAll(): Shift[] {
    try {
      const stmt = db.prepare('SELECT * FROM shifts ORDER BY date ASC, time_slot ASC');
      return stmt.all() as Shift[];
    } catch (error) {
      console.error('Error getting all shifts:', error);
      return [];
    }
  }

  /**
   * 特定のユーザーのシフトを取得
   */
  static getByUserId(userId: string): Shift[] {
    try {
      const stmt = db.prepare('SELECT * FROM shifts WHERE user_id = ? ORDER BY date ASC, time_slot ASC');
      return stmt.all(userId) as Shift[];
    } catch (error) {
      console.error('Error getting shifts by user ID:', error);
      return [];
    }
  }

  /**
   * 特定の日付のシフトを取得
   */
  static getByDate(date: string): Shift[] {
    try {
      const stmt = db.prepare('SELECT * FROM shifts WHERE date = ? ORDER BY time_slot ASC');
      return stmt.all(date) as Shift[];
    } catch (error) {
      console.error('Error getting shifts by date:', error);
      return [];
    }
  }

  /**
   * 日付範囲でシフトを取得
   */
  static getByDateRange(startDate: string, endDate: string): Shift[] {
    try {
      const stmt = db.prepare('SELECT * FROM shifts WHERE date >= ? AND date <= ? ORDER BY date ASC, time_slot ASC');
      return stmt.all(startDate, endDate) as Shift[];
    } catch (error) {
      console.error('Error getting shifts by date range:', error);
      return [];
    }
  }

  /**
   * UUIDでシフトを取得
   */
  static getByUuid(uuid: string): Shift | null {
    try {
      const stmt = db.prepare('SELECT * FROM shifts WHERE uuid = ?');
      return stmt.get(uuid) as Shift | null;
    } catch (error) {
      console.error('Error getting shift by UUID:', error);
      return null;
    }
  }

  /**
   * シフト申請数をカウント（日付と時間枠ごと）
   */
  static getShiftCounts(): ShiftCountData {
    try {
      const stmt = db.prepare('SELECT date, time_slot, COUNT(*) as count FROM shifts GROUP BY date, time_slot');
      const rows = stmt.all() as { date: string; time_slot: string; count: number }[];

      const counts: ShiftCountData = {};
      rows.forEach(row => {
        if (!counts[row.date]) {
          counts[row.date] = {};
        }
        counts[row.date][row.time_slot] = row.count;
      });

      return counts;
    } catch (error) {
      console.error('Error getting shift counts:', error);
      return {};
    }
  }

  /**
   * 特定の日付のシフト申請数をカウント
   */
  static getShiftCountsByDate(date: string): { [timeSlot: string]: number } {
    try {
      const stmt = db.prepare('SELECT time_slot, COUNT(*) as count FROM shifts WHERE date = ? GROUP BY time_slot');
      const rows = stmt.all(date) as { time_slot: string; count: number }[];

      const counts: { [timeSlot: string]: number } = {};
      rows.forEach(row => {
        counts[row.time_slot] = row.count;
      });

      return counts;
    } catch (error) {
      console.error('Error getting shift counts by date:', error);
      return {};
    }
  }

  /**
   * 重複チェック（同じユーザーが同じ日の同じ時間帯に申請しているか）
   */
  static checkDuplicate(userId: string, date: string, timeSlot: string): boolean {
    try {
      const stmt = db.prepare('SELECT COUNT(*) as count FROM shifts WHERE user_id = ? AND date = ? AND time_slot = ?');
      const result = stmt.get(userId, date, timeSlot) as { count: number };
      return result.count > 0;
    } catch (error) {
      console.error('Error checking duplicate shift:', error);
      return false;
    }
  }

  /**
   * 複数時間枠の重複チェック
   */
  static checkMultipleDuplicates(userId: string, date: string, timeSlots: string[]): { [timeSlot: string]: boolean } {
    try {
      const duplicates: { [timeSlot: string]: boolean } = {};

      for (const timeSlot of timeSlots) {
        duplicates[timeSlot] = this.checkDuplicate(userId, date, timeSlot);
      }

      return duplicates;
    } catch (error) {
      console.error('Error checking multiple duplicates:', error);
      return {};
    }
  }

  /**
   * シフトを作成
   */
  static create(data: ShiftCreateData): Shift | null {
    try {
      const uuid = uuidv4();
      const stmt = db.prepare(`
        INSERT INTO shifts (uuid, user_id, user_name, date, time_slot)
        VALUES (?, ?, ?, ?, ?)
      `);

      const result = stmt.run(uuid, data.user_id, data.user_name, data.date, data.time_slot);

      if (result.changes > 0) {
        return this.getByUuid(uuid);
      }

      return null;
    } catch (error) {
      console.error('Error creating shift:', error);
      return null;
    }
  }

  /**
   * 複数シフトを一括作成
   */
  static bulkCreate(shifts: ShiftCreateData[]): { success: number; failed: number; duplicates: number } {
    const result = { success: 0, failed: 0, duplicates: 0 };

    try {
      const insertStmt = db.prepare(`
        INSERT INTO shifts (uuid, user_id, user_name, date, time_slot)
        VALUES (?, ?, ?, ?, ?)
      `);

      const transaction = db.transaction((shiftList: ShiftCreateData[]) => {
        for (const shift of shiftList) {
          try {
            // 重複チェック
            if (this.checkDuplicate(shift.user_id, shift.date, shift.time_slot)) {
              result.duplicates++;
              continue;
            }

            const uuid = uuidv4();
            insertStmt.run(uuid, shift.user_id, shift.user_name, shift.date, shift.time_slot);
            result.success++;
          } catch (error) {
            console.error('Error in bulk create:', error);
            result.failed++;
          }
        }
      });

      transaction(shifts);
    } catch (error) {
      console.error('Error in bulk create transaction:', error);
    }

    return result;
  }

  /**
   * UUIDでシフトを削除
   */
  static delete(uuid: string): boolean {
    try {
      const stmt = db.prepare('DELETE FROM shifts WHERE uuid = ?');
      const result = stmt.run(uuid);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting shift:', error);
      return false;
    }
  }

  /**
   * 複数のUUIDでシフトを一括削除
   */
  static deleteMultiple(uuids: string[]): { success: number; failed: number } {
    const result = { success: 0, failed: 0 };

    try {
      const deleteStmt = db.prepare('DELETE FROM shifts WHERE uuid = ?');

      const transaction = db.transaction((uuidList: string[]) => {
        for (const uuid of uuidList) {
          try {
            const deleteResult = deleteStmt.run(uuid);
            if (deleteResult.changes > 0) {
              result.success++;
            } else {
              result.failed++;
            }
          } catch (error) {
            console.error('Error deleting shift:', error);
            result.failed++;
          }
        }
      });

      transaction(uuids);
    } catch (error) {
      console.error('Error in bulk delete transaction:', error);
    }

    return result;
  }
}
