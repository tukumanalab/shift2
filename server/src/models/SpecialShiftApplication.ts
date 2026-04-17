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

export interface SpecialShiftApplicationWithDate extends SpecialShiftApplication {
  date: string;
  shift_name: string | null;
  calendar_event_id: string | null;
  nickname: string | null;
  real_name: string | null;
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
   * 全申請を特別シフトの日付情報付きで取得（シフト一覧表示用）
   * @param userId - 省略時は全ユーザー
   */
  static getAllWithShiftInfo(userId?: string): SpecialShiftApplicationWithDate[] {
    try {
      const sql = `
        SELECT a.uuid, a.special_shift_uuid, a.user_id, a.user_name,
               a.time_slot, a.calendar_event_id, a.created_at, a.updated_at,
               s.date, s.name AS shift_name,
               u.nickname, u.real_name
        FROM special_shift_applications a
        JOIN special_shifts s ON a.special_shift_uuid = s.uuid
        LEFT JOIN users u ON a.user_id = u.user_id
        ${userId ? 'WHERE a.user_id = ?' : ''}
        ORDER BY s.date ASC, a.time_slot ASC
      `;
      const stmt = db.prepare(sql);
      return (userId ? stmt.all(userId) : stmt.all()) as SpecialShiftApplicationWithDate[];
    } catch (error) {
      console.error('Error getting special shift applications with shift info:', error);
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
   * calendar_event_idを更新
   */
  static updateCalendarEventId(uuid: string, calendarEventId: string | null): boolean {
    try {
      const stmt = db.prepare(`
        UPDATE special_shift_applications SET calendar_event_id = ? WHERE uuid = ?
      `);
      const result = stmt.run(calendarEventId, uuid);
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating calendar_event_id:', error);
      return false;
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
