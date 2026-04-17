import db from '../database/db';
import { v4 as uuidv4 } from 'uuid';

export interface SpecialShiftApplication {
  id: number;
  uuid: string;
  special_shift_uuid: string;
  user_id: string;
  user_name: string;
  time_slot: string;
  created_at: string;
  updated_at: string;
}

export interface SpecialShiftApplicationCreateData {
  special_shift_uuid: string;
  user_id: string;
  user_name: string;
  time_slot: string;
}

export class SpecialShiftApplicationModel {
  /**
   * すべての申請を取得
   */
  static getAll(): SpecialShiftApplication[] {
    try {
      const stmt = db.prepare(`
        SELECT * FROM special_shift_applications
        ORDER BY created_at DESC
      `);
      return stmt.all() as SpecialShiftApplication[];
    } catch (error) {
      console.error('Error getting all special shift applications:', error);
      return [];
    }
  }

  /**
   * UUIDで申請を取得
   */
  static getByUuid(uuid: string): SpecialShiftApplication | null {
    try {
      const stmt = db.prepare(`
        SELECT * FROM special_shift_applications
        WHERE uuid = ?
      `);
      return stmt.get(uuid) as SpecialShiftApplication | undefined || null;
    } catch (error) {
      console.error('Error getting special shift application by UUID:', error);
      return null;
    }
  }

  /**
   * 特別シフトUUIDで申請一覧を取得
   */
  static getBySpecialShiftUuid(specialShiftUuid: string): SpecialShiftApplication[] {
    try {
      const stmt = db.prepare(`
        SELECT * FROM special_shift_applications
        WHERE special_shift_uuid = ?
        ORDER BY created_at ASC
      `);
      return stmt.all(specialShiftUuid) as SpecialShiftApplication[];
    } catch (error) {
      console.error('Error getting special shift applications by special_shift_uuid:', error);
      return [];
    }
  }

  /**
   * ユーザーIDで申請一覧を取得
   */
  static getByUserId(userId: string): SpecialShiftApplication[] {
    try {
      const stmt = db.prepare(`
        SELECT * FROM special_shift_applications
        WHERE user_id = ?
        ORDER BY created_at DESC
      `);
      return stmt.all(userId) as SpecialShiftApplication[];
    } catch (error) {
      console.error('Error getting special shift applications by user_id:', error);
      return [];
    }
  }

  /**
   * 重複申請チェック（同一ユーザー・同一特別シフト・同一スロット）
   */
  static checkDuplicate(userId: string, specialShiftUuid: string, timeSlot: string): boolean {
    try {
      const stmt = db.prepare(`
        SELECT COUNT(*) as count FROM special_shift_applications
        WHERE user_id = ? AND special_shift_uuid = ? AND time_slot = ?
      `);
      const result = stmt.get(userId, specialShiftUuid, timeSlot) as { count: number };
      return result.count > 0;
    } catch (error) {
      console.error('Error checking duplicate special shift application:', error);
      return false;
    }
  }

  /**
   * 申請を作成
   */
  static create(data: SpecialShiftApplicationCreateData): SpecialShiftApplication | null {
    try {
      const uuid = uuidv4();
      const stmt = db.prepare(`
        INSERT INTO special_shift_applications (uuid, special_shift_uuid, user_id, user_name, time_slot)
        VALUES (?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        uuid,
        data.special_shift_uuid,
        data.user_id,
        data.user_name,
        data.time_slot
      );

      if (result.changes > 0) {
        return this.getByUuid(uuid);
      }
      return null;
    } catch (error) {
      console.error('Error creating special shift application:', error);
      return null;
    }
  }

  /**
   * UUIDで申請を削除
   */
  static delete(uuid: string): boolean {
    try {
      const stmt = db.prepare(`
        DELETE FROM special_shift_applications
        WHERE uuid = ?
      `);
      const result = stmt.run(uuid);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting special shift application:', error);
      return false;
    }
  }
}
