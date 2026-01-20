import db from '../database/db';
import { CalendarEventData } from '../types/calendar';

export class CalendarEventModel {
  /**
   * 新しいカレンダーイベントを作成
   */
  static create(eventData: CalendarEventData): boolean {
    try {
      const stmt = db.prepare(`
        INSERT INTO calendar_events (
          calendar_event_id,
          shift_uuid,
          special_shift_uuid,
          event_type,
          user_id,
          date,
          time_range
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        eventData.calendar_event_id,
        eventData.shift_uuid || null,
        eventData.special_shift_uuid || null,
        eventData.event_type,
        eventData.user_id,
        eventData.date,
        eventData.time_range
      );

      return true;
    } catch (error) {
      console.error('カレンダーイベント作成エラー:', error);
      return false;
    }
  }

  /**
   * シフトUUIDでカレンダーイベントを取得
   */
  static getByShiftUuid(shiftUuid: string): CalendarEventData | null {
    try {
      const stmt = db.prepare(`
        SELECT * FROM calendar_events
        WHERE shift_uuid = ?
      `);
      return stmt.get(shiftUuid) as CalendarEventData || null;
    } catch (error) {
      console.error('カレンダーイベント取得エラー:', error);
      return null;
    }
  }

  /**
   * 特別シフトUUIDでカレンダーイベントを取得
   */
  static getBySpecialShiftUuid(specialShiftUuid: string): CalendarEventData | null {
    try {
      const stmt = db.prepare(`
        SELECT * FROM calendar_events
        WHERE special_shift_uuid = ?
      `);
      return stmt.get(specialShiftUuid) as CalendarEventData || null;
    } catch (error) {
      console.error('カレンダーイベント取得エラー:', error);
      return null;
    }
  }

  /**
   * 日付でカレンダーイベントを取得
   */
  static getByDate(date: string): CalendarEventData[] {
    try {
      const stmt = db.prepare(`
        SELECT * FROM calendar_events
        WHERE date = ?
        ORDER BY time_range
      `);
      return stmt.all(date) as CalendarEventData[];
    } catch (error) {
      console.error('カレンダーイベント取得エラー:', error);
      return [];
    }
  }

  /**
   * ユーザーIDでカレンダーイベントを取得
   */
  static getByUserId(userId: string): CalendarEventData[] {
    try {
      const stmt = db.prepare(`
        SELECT * FROM calendar_events
        WHERE user_id = ?
        ORDER BY date, time_range
      `);
      return stmt.all(userId) as CalendarEventData[];
    } catch (error) {
      console.error('カレンダーイベント取得エラー:', error);
      return [];
    }
  }

  /**
   * カレンダーイベントIDでイベントを削除
   */
  static deleteByCalendarEventId(calendarEventId: string): boolean {
    try {
      const stmt = db.prepare(`
        DELETE FROM calendar_events
        WHERE calendar_event_id = ?
      `);
      const result = stmt.run(calendarEventId);
      return result.changes > 0;
    } catch (error) {
      console.error('カレンダーイベント削除エラー:', error);
      return false;
    }
  }

  /**
   * シフトUUIDでイベントを削除
   */
  static deleteByShiftUuid(shiftUuid: string): boolean {
    try {
      const stmt = db.prepare(`
        DELETE FROM calendar_events
        WHERE shift_uuid = ?
      `);
      const result = stmt.run(shiftUuid);
      return result.changes > 0;
    } catch (error) {
      console.error('カレンダーイベント削除エラー:', error);
      return false;
    }
  }

  /**
   * 特別シフトUUIDでイベントを削除
   */
  static deleteBySpecialShiftUuid(specialShiftUuid: string): boolean {
    try {
      const stmt = db.prepare(`
        DELETE FROM calendar_events
        WHERE special_shift_uuid = ?
      `);
      const result = stmt.run(specialShiftUuid);
      return result.changes > 0;
    } catch (error) {
      console.error('カレンダーイベント削除エラー:', error);
      return false;
    }
  }

  /**
   * 全カレンダーイベントを削除
   */
  static deleteAll(): boolean {
    try {
      const stmt = db.prepare('DELETE FROM calendar_events');
      stmt.run();
      return true;
    } catch (error) {
      console.error('全カレンダーイベント削除エラー:', error);
      return false;
    }
  }

  /**
   * すべてのカレンダーイベントを取得
   */
  static getAll(): CalendarEventData[] {
    try {
      const stmt = db.prepare(`
        SELECT * FROM calendar_events
        ORDER BY date, time_range
      `);
      return stmt.all() as CalendarEventData[];
    } catch (error) {
      console.error('全カレンダーイベント取得エラー:', error);
      return [];
    }
  }
}
