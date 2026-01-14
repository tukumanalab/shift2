import db from '../database/db';

export interface CapacitySetting {
  id: number;
  date: string;
  capacity: number;
  memo: string | null;
  user_id: string | null;
  user_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface CapacitySettingCreateData {
  date: string;
  capacity: number;
  memo?: string;
  user_id?: string;
  user_name?: string;
}

export interface CapacitySettingUpdateData {
  capacity: number;
  memo?: string;
  user_id?: string;
  user_name?: string;
}

export class CapacitySettingModel {
  /**
   * すべての人数設定を取得
   */
  static getAll(): CapacitySetting[] {
    try {
      const stmt = db.prepare(`
        SELECT * FROM capacity_settings
        ORDER BY date
      `);
      return stmt.all() as CapacitySetting[];
    } catch (error) {
      console.error('Error getting all capacity settings:', error);
      return [];
    }
  }

  /**
   * 特定の日付の人数設定を取得
   */
  static getByDate(date: string): CapacitySetting | null {
    try {
      const stmt = db.prepare(`
        SELECT * FROM capacity_settings
        WHERE date = ?
      `);
      return stmt.get(date) as CapacitySetting | undefined || null;
    } catch (error) {
      console.error('Error getting capacity setting by date:', error);
      return null;
    }
  }

  /**
   * 日付範囲で人数設定を取得
   */
  static getByDateRange(startDate: string, endDate: string): CapacitySetting[] {
    try {
      const stmt = db.prepare(`
        SELECT * FROM capacity_settings
        WHERE date >= ? AND date <= ?
        ORDER BY date
      `);
      return stmt.all(startDate, endDate) as CapacitySetting[];
    } catch (error) {
      console.error('Error getting capacity settings by date range:', error);
      return [];
    }
  }

  /**
   * 人数設定を作成または更新（UPSERT）
   */
  static upsert(data: CapacitySettingCreateData): CapacitySetting | null {
    try {
      const stmt = db.prepare(`
        INSERT INTO capacity_settings (date, capacity, memo, user_id, user_name)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
          capacity = excluded.capacity,
          memo = excluded.memo,
          user_id = excluded.user_id,
          user_name = excluded.user_name,
          updated_at = CURRENT_TIMESTAMP
      `);

      stmt.run(
        data.date,
        data.capacity,
        data.memo || null,
        data.user_id || null,
        data.user_name || null
      );

      return this.getByDate(data.date);
    } catch (error) {
      console.error('Error upserting capacity setting:', error);
      return null;
    }
  }

  /**
   * 複数の人数設定を一括作成または更新
   */
  static bulkUpsert(dataList: CapacitySettingCreateData[]): { success: number; failed: number } {
    let success = 0;
    let failed = 0;

    const stmt = db.prepare(`
      INSERT INTO capacity_settings (date, capacity, memo, user_id, user_name)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        capacity = excluded.capacity,
        memo = excluded.memo,
        user_id = excluded.user_id,
        user_name = excluded.user_name,
        updated_at = CURRENT_TIMESTAMP
    `);

    try {
      const transaction = db.transaction((items: CapacitySettingCreateData[]) => {
        for (const item of items) {
          try {
            stmt.run(
              item.date,
              item.capacity,
              item.memo || null,
              item.user_id || null,
              item.user_name || null
            );
            success++;
          } catch (error) {
            console.error(`Error upserting capacity setting for ${item.date}:`, error);
            failed++;
          }
        }
      });

      transaction(dataList);
    } catch (error) {
      console.error('Error in bulkUpsert transaction:', error);
      failed = dataList.length - success;
    }

    return { success, failed };
  }

  /**
   * 人数設定を更新
   */
  static update(date: string, data: CapacitySettingUpdateData): CapacitySetting | null {
    try {
      const stmt = db.prepare(`
        UPDATE capacity_settings
        SET capacity = ?,
            memo = ?,
            user_id = ?,
            user_name = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE date = ?
      `);

      const result = stmt.run(
        data.capacity,
        data.memo || null,
        data.user_id || null,
        data.user_name || null,
        date
      );

      if (result.changes > 0) {
        return this.getByDate(date);
      }
      return null;
    } catch (error) {
      console.error('Error updating capacity setting:', error);
      return null;
    }
  }

  /**
   * 人数設定を削除
   */
  static delete(date: string): boolean {
    try {
      const stmt = db.prepare(`
        DELETE FROM capacity_settings
        WHERE date = ?
      `);
      const result = stmt.run(date);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting capacity setting:', error);
      return false;
    }
  }
}
