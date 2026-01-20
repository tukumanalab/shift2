import { calendar_v3 } from 'googleapis';
import db from '../database/db';
import { getCalendarClient } from '../utils/googleAuth';
import { groupAndMergeShifts } from '../utils/timeSlotMerger';
import { CalendarEventModel } from '../models/CalendarEvent';
import { UserModel } from '../models/User';
import { ShiftInfo, SyncResult, CalendarEvent, UserDisplayInfo } from '../types/calendar';

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
      console.error('カレンダーイベント削除エラー:', error);
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

      // データベースの calendar_events テーブルをクリア
      CalendarEventModel.deleteAll();

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
            // calendar_events テーブルに記録（各シフトUUIDごとに）
            for (const shiftUuid of slot.shift_uuids) {
              CalendarEventModel.create({
                calendar_event_id: response.data.id,
                shift_uuid: slot.type === 'shift' ? shiftUuid : undefined,
                special_shift_uuid: slot.type === 'special_shift' ? shiftUuid : undefined,
                event_type: slot.type,
                user_id: slot.user_id,
                date: slot.date,
                time_range: timeRange,
              });
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
   * 個別シフトをカレンダーに追加
   */
  static async addShiftToCalendar(shiftData: {
    uuid: string;
    user_id: string;
    date: string;
    time_slot: string;
    type: 'shift' | 'special_shift';
  }): Promise<{ success: boolean; error?: string }> {
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
        CalendarEventModel.create({
          calendar_event_id: response.data.id,
          shift_uuid: shiftData.type === 'shift' ? shiftData.uuid : undefined,
          special_shift_uuid: shiftData.type === 'special_shift' ? shiftData.uuid : undefined,
          event_type: shiftData.type,
          user_id: shiftData.user_id,
          date: shiftData.date,
          time_range: shiftData.time_slot,
        });

        return { success: true };
      } else {
        return { success: false, error: 'イベントIDが取得できませんでした' };
      }
    } catch (error: any) {
      console.error('シフト追加エラー:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 個別シフトをカレンダーから削除
   */
  static async deleteShiftFromCalendar(
    shiftUuid: string,
    type: 'shift' | 'special_shift'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // calendar_events テーブルからイベントIDを取得
      const calendarEvent =
        type === 'shift'
          ? CalendarEventModel.getByShiftUuid(shiftUuid)
          : CalendarEventModel.getBySpecialShiftUuid(shiftUuid);

      if (!calendarEvent) {
        return { success: false, error: 'カレンダーイベントが見つかりません' };
      }

      // Google Calendar からイベントを削除
      const deleted = await this.deleteCalendarEvent(calendarEvent.calendar_event_id);

      if (deleted) {
        // データベースからも削除
        CalendarEventModel.deleteByCalendarEventId(calendarEvent.calendar_event_id);
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
   * 全シフト（通常 + 特別）を取得
   */
  private static getAllShifts(): ShiftInfo[] {
    const shifts: ShiftInfo[] = [];

    // 通常シフトを取得
    const stmt1 = db.prepare(`
      SELECT uuid, user_id, user_name, date, time_slot
      FROM shifts
      WHERE date >= date('now')
      ORDER BY date, time_slot
    `);
    const regularShifts = stmt1.all() as Array<{
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

    // 特別シフトを取得
    const stmt2 = db.prepare(`
      SELECT uuid, user_id, user_name, date, start_time, end_time
      FROM special_shifts
      WHERE date >= date('now')
      ORDER BY date, start_time
    `);
    const specialShifts = stmt2.all() as Array<{
      uuid: string;
      user_id: string;
      user_name: string;
      date: string;
      start_time: string;
      end_time: string;
    }>;

    for (const shift of specialShifts) {
      shifts.push({
        uuid: shift.uuid,
        user_id: shift.user_id,
        user_name: shift.user_name,
        date: shift.date,
        time_slot: `${shift.start_time}-${shift.end_time}`,
        type: 'special_shift',
      });
    }

    return shifts;
  }

  /**
   * 同期ステータスを取得
   */
  static getSyncStatus(): {
    total_events: number;
    last_synced: string | null;
  } {
    const events = CalendarEventModel.getAll();
    const lastSynced = events.length > 0 ? events[0].synced_at : null;

    return {
      total_events: events.length,
      last_synced: lastSynced || null,
    };
  }
}
