import { calendar_v3 } from 'googleapis';
import db from '../database/db';
import { getCalendarClient } from '../utils/googleAuth';
import { groupAndMergeShifts } from '../utils/timeSlotMerger';
import { UserModel } from '../models/User';
import { ShiftInfo, SyncResult, UserDisplayInfo, CalendarSyncResult } from '../types/calendar';

const TIMEZONE = process.env.TIMEZONE || 'Asia/Tokyo';

export class CalendarService {
  /**
   * ユーザーの表示名を取得
   */
  private static getDisplayName(userInfo: UserDisplayInfo): string {
    const hasNickname = userInfo.nickname && userInfo.nickname.trim() !== '';
    const hasRealName = userInfo.real_name && userInfo.real_name.trim() !== '';

    if (hasNickname && hasRealName) {
      return `${userInfo.nickname!}(${userInfo.real_name!})`;
    } else if (hasNickname) {
      return userInfo.nickname!;
    } else if (hasRealName) {
      return userInfo.real_name!;
    } else {
      return userInfo.email || 'ユーザー';
    }
  }

  /**
   * 時間帯文字列をパースしてDateオブジェクトを作成
   */
  private static parseTimeSlot(date: string, timeSlot: string): { start: Date; end: Date } {
    const [startTime, endTime] = timeSlot.split('-');
    const [startHour, startMinute] = startTime.trim().split(':').map(Number);
    const [endHour, endMinute] = endTime.trim().split(':').map(Number);

    const baseDate = new Date(date + 'T00:00:00');

    const start = new Date(baseDate);
    start.setHours(startHour, startMinute, 0, 0);

    const end = new Date(baseDate);
    end.setHours(endHour, endMinute, 0, 0);

    return { start, end };
  }

  /**
   * カレンダーイベントを削除（Google Calendar API）
   */
  private static async deleteCalendarEvent(calendarEventId: string): Promise<boolean> {
    try {
      const { calendar, calendarId } = getCalendarClient();

      await calendar.events.delete({
        calendarId,
        eventId: calendarEventId,
      });

      return true;
    } catch (error: any) {
      if (error.code === 404) {
        console.log(`イベントが見つかりません（既に削除済み）: ${calendarEventId}`);
        return true;
      }
      console.error('カレンダーイベント削除エラー:', {
        calendarEventId,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.errors || error.cause,
      });
      return false;
    }
  }

  /**
   * リトライロジック（指数バックオフ）
   */
  private static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        if (attempt === maxRetries - 1) {
          throw error;
        }
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`リトライ ${attempt + 1}/${maxRetries} (${delay}ms 待機)`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('リトライ回数を超過しました');
  }

  /**
   * 全シフトをカレンダーに同期
   */
  static async syncAllShifts(): Promise<SyncResult> {
    try {
      const { calendar, calendarId } = getCalendarClient();

      // 既存のシフトイベントを削除
      const now = new Date();
      const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

      console.log('既存イベントを削除中...');

      const eventsResponse = await calendar.events.list({
        calendarId,
        timeMin: now.toISOString(),
        timeMax: oneYearLater.toISOString(),
        singleEvents: true,
      });

      const events = eventsResponse.data.items || [];

      // シフトイベントを識別して削除（タイトルに ' - ' が含まれ、説明に「担当者:」が含まれる）
      for (const event of events) {
        if (
          event.summary &&
          event.summary.includes('(') &&
          event.description &&
          event.description.includes('担当者:')
        ) {
          try {
            await calendar.events.delete({
              calendarId,
              eventId: event.id!,
            });
          } catch (error) {
            console.error(`イベント削除エラー (${event.id}):`, error);
          }
        }
      }

      // データベースの calendar_event_id をクリア（通常シフトのみ）
      db.prepare('UPDATE shifts SET calendar_event_id = NULL').run();

      // 通常シフトと特別シフトを取得
      const shifts = this.getAllShifts();

      if (shifts.length === 0) {
        return {
          success: true,
          total: 0,
          created: 0,
          failed: 0,
        };
      }

      // シフトをユーザー・日付でグループ化し、連続する時間帯をマージ
      const mergedSlots = groupAndMergeShifts(shifts);

      let created = 0;
      let failed = 0;
      const errors: Array<{ shift: ShiftInfo; error: string }> = [];

      // 各マージされたスロットをカレンダーに追加
      for (const slot of mergedSlots) {
        try {
          const user = UserModel.getByUserId(slot.user_id);
          if (!user) {
            console.error(`ユーザーが見つかりません: ${slot.user_id}`);
            failed++;
            continue;
          }

          const displayName = this.getDisplayName({
            nickname: user.nickname,
            real_name: user.real_name,
            email: user.email,
          });

          const timeRange = `${slot.start_time}-${slot.end_time}`;
          const { start, end } = this.parseTimeSlot(slot.date, timeRange);

          const eventData: calendar_v3.Schema$Event = {
            summary: displayName,
            description: `担当者: ${displayName}\nメール: ${user.email}\n時間: ${timeRange}`,
            location: 'つくまなラボ',
            start: {
              dateTime: start.toISOString(),
              timeZone: TIMEZONE,
            },
            end: {
              dateTime: end.toISOString(),
              timeZone: TIMEZONE,
            },
            extendedProperties: {
              private: {
                user_id: slot.user_id,
                user_email: user.email,
                shift_time: timeRange,
              },
            },
          };

          const response = await this.withRetry(() =>
            calendar.events.insert({
              calendarId,
              requestBody: eventData,
            })
          );

          if (response.data.id) {
            // calendar_event_id を各シフトレコードに記録
            const updateStmt = db.prepare('UPDATE shifts SET calendar_event_id = ? WHERE uuid = ?');

            for (const shiftUuid of slot.shift_uuids) {
              updateStmt.run(response.data.id, shiftUuid);
            }

            created++;
          } else {
            failed++;
          }
        } catch (error: any) {
          console.error('イベント作成エラー:', error);
          failed++;
          errors.push({
            shift: {
              uuid: slot.shift_uuids[0] || '',
              user_id: slot.user_id,
              user_name: slot.user_name,
              date: slot.date,
              time_slot: `${slot.start_time}-${slot.end_time}`,
              type: slot.type,
            },
            error: error.message,
          });
        }
      }

      return {
        success: true,
        total: mergedSlots.length,
        created,
        failed,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error: any) {
      console.error('全シフト同期エラー:', error);
      return {
        success: false,
        total: 0,
        created: 0,
        failed: 0,
        errors: [{ shift: {} as ShiftInfo, error: error.message }],
      };
    }
  }

  /**
   * 個別シフトをカレンダーに追加（通常シフトのみ）
   */
  static async addShiftToCalendar(shiftData: {
    uuid: string;
    user_id: string;
    date: string;
    time_slot: string;
    type: 'shift';
  }): Promise<CalendarSyncResult> {
    try {
      const { calendar, calendarId } = getCalendarClient();

      const user = UserModel.getByUserId(shiftData.user_id);
      if (!user) {
        return { success: false, error: `ユーザーが見つかりません: ${shiftData.user_id}` };
      }

      const displayName = this.getDisplayName({
        nickname: user.nickname,
        real_name: user.real_name,
        email: user.email,
      });

      const { start, end } = this.parseTimeSlot(shiftData.date, shiftData.time_slot);

      const eventData: calendar_v3.Schema$Event = {
        summary: displayName,
        description: `担当者: ${displayName}\nメール: ${user.email}\n時間: ${shiftData.time_slot}`,
        location: 'つくまなラボ',
        start: {
          dateTime: start.toISOString(),
          timeZone: TIMEZONE,
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: TIMEZONE,
        },
        extendedProperties: {
          private: {
            user_id: shiftData.user_id,
            user_email: user.email,
            shift_time: shiftData.time_slot,
          },
        },
      };

      const response = await this.withRetry(() =>
        calendar.events.insert({
          calendarId,
          requestBody: eventData,
        })
      );

      if (response.data.id) {
        // calendar_event_id をシフトレコードに記録
        const updateStmt = db.prepare('UPDATE shifts SET calendar_event_id = ? WHERE uuid = ?');
        updateStmt.run(response.data.id, shiftData.uuid);

        return { success: true, calendarEventId: response.data.id };
      } else {
        return { success: false, error: 'イベントIDが取得できませんでした' };
      }
    } catch (error: any) {
      console.error('シフト追加エラー:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 個別シフトをカレンダーから削除（通常シフトのみ）
   */
  static async deleteShiftFromCalendar(
    shiftUuid: string,
    type: 'shift'
  ): Promise<CalendarSyncResult> {
    try {
      // shifts テーブルから calendar_event_id を取得
      const row = db
        .prepare('SELECT calendar_event_id FROM shifts WHERE uuid = ?')
        .get(shiftUuid) as { calendar_event_id: string | null } | undefined;

      if (!row || !row.calendar_event_id) {
        return { success: false, error: 'カレンダーイベントが見つかりません' };
      }

      // Google Calendar からイベントを削除
      const deleted = await this.deleteCalendarEvent(row.calendar_event_id);

      if (deleted) {
        // データベースの calendar_event_id をクリア
        const updateStmt = db.prepare('UPDATE shifts SET calendar_event_id = NULL WHERE uuid = ?');
        updateStmt.run(shiftUuid);
        return { success: true };
      } else {
        return { success: false, error: 'カレンダーイベントの削除に失敗しました' };
      }
    } catch (error: any) {
      console.error('シフト削除エラー:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 全シフト（通常シフトのみ）を取得
   * 注意: 特別シフトはカレンダーに同期されない
   */
  private static getAllShifts(): ShiftInfo[] {
    const shifts: ShiftInfo[] = [];

    // 通常シフトを取得
    const stmt = db.prepare(`
      SELECT uuid, user_id, user_name, date, time_slot
      FROM shifts
      WHERE date >= date('now')
      ORDER BY date, time_slot
    `);
    const regularShifts = stmt.all() as Array<{
      uuid: string;
      user_id: string;
      user_name: string;
      date: string;
      time_slot: string;
    }>;

    for (const shift of regularShifts) {
      shifts.push({
        uuid: shift.uuid,
        user_id: shift.user_id,
        user_name: shift.user_name,
        date: shift.date,
        time_slot: shift.time_slot,
        type: 'shift',
      });
    }

    return shifts;
  }

  /**
   * 同期ステータスを取得（通常シフトのみ）
   */
  static getSyncStatus(): {
    total_events: number;
    last_synced: string | null;
  } {
    // calendar_event_id が設定されているシフトの数をカウント
    const shiftsCount = db
      .prepare('SELECT COUNT(*) as count FROM shifts WHERE calendar_event_id IS NOT NULL')
      .get() as { count: number };

    const totalEvents = shiftsCount.count;

    // 最新の updated_at を取得（last_synced の代わり）
    const lastShiftUpdate = db
      .prepare(
        'SELECT updated_at FROM shifts WHERE calendar_event_id IS NOT NULL ORDER BY updated_at DESC LIMIT 1'
      )
      .get() as { updated_at: string } | undefined;

    const lastSynced = lastShiftUpdate ? lastShiftUpdate.updated_at : null;

    return {
      total_events: totalEvents,
      last_synced: lastSynced,
    };
  }
}
