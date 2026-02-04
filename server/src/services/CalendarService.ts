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
    const nickname = userInfo.nickname?.trim();
    const realName = userInfo.real_name?.trim();

    if (nickname && realName) {
      return `${nickname}(${realName})`;
    }
    return nickname || realName || userInfo.email || 'ユーザー';
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
  static async deleteCalendarEvent(calendarEventId: string): Promise<boolean> {
    try {
      const { calendar, calendarId } = getCalendarClient();

      console.log(`[Calendar] イベント削除開始: ${calendarEventId}`);
      await calendar.events.delete({
        calendarId,
        eventId: calendarEventId,
      });

      console.log(`[Calendar] ✓ イベント削除成功: ${calendarEventId}`);
      return true;
    } catch (error: any) {
      if (error.code === 404) {
        console.log(`[Calendar] イベントが見つかりません（既に削除済み）: ${calendarEventId}`);
        return true;
      }
      console.error('[Calendar] ✗ カレンダーイベント削除エラー:', {
        calendarEventId,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.errors,
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
    let lastError: any;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        if (attempt === maxRetries - 1) {
          throw error;
        }
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`リトライ ${attempt + 1}/${maxRetries} (${delay}ms 待機)`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }

  /**
   * Googleカレンダーのすべてのイベントを削除
   */
  static async deleteAllEvents(): Promise<{ success: boolean; deleted: number; error?: string }> {
    try {
      console.log(`[Calendar] ==== すべてのイベント削除開始 ====`);
      const { calendar, calendarId } = getCalendarClient();

      // 既存のシフトイベントを取得
      console.log('[Calendar] カレンダー上の既存イベントを取得中...');

      const eventsResponse = await calendar.events.list({
        calendarId,
        singleEvents: true,
      });

      const events = eventsResponse.data.items || [];
      console.log(`[Calendar] 削除対象イベント数: ${events.length}`);

      if (events.length === 0) {
        console.log('[Calendar] 削除するイベントがありません');
        // データベースの calendar_event_id をクリア
        db.prepare('UPDATE shifts SET calendar_event_id = NULL').run();
        return {
          success: true,
          deleted: 0,
        };
      }

      // イベントを一個ずつ削除
      let deleted = 0;
      for (const event of events) {
        try {
          await calendar.events.delete({
            calendarId,
            eventId: event.id!,
          });
          console.log(`[Calendar]   ✓ イベント削除: ${event.id}`);
          deleted++;
        } catch (error: any) {
          if (error.code !== 404) {
            console.error(`[Calendar]   ✗ イベント削除エラー (${event.id}):`, error.message);
          } else {
            deleted++; // 既に削除済みの場合もカウント
          }
        }
      }

      // データベースの calendar_event_id をクリア（通常シフトのみ）
      db.prepare('UPDATE shifts SET calendar_event_id = NULL').run();
      console.log(`[Calendar] DBのcalendar_event_idをクリアしました`);
      console.log(`[Calendar] ==== すべてのイベント削除完了（${deleted}件）====`);

      return {
        success: true,
        deleted,
      };
    } catch (error: any) {
      console.error('[Calendar] すべてのイベント削除エラー:', error);
      return {
        success: false,
        deleted: 0,
        error: error.message,
      };
    }
  }

  /**
   * 全シフトをカレンダーに同期
   */
  static async syncAllShifts(): Promise<SyncResult> {
    try {
      console.log(`[Calendar] ==== 全シフト同期開始 ====`);

      // 既存のイベントを削除（deleteAllEventsを再利用）
      const deleteResult = await this.deleteAllEvents();
      if (!deleteResult.success) {
        throw new Error(deleteResult.error || 'イベント削除に失敗しました');
      }
      console.log(`[Calendar] ${deleteResult.deleted}件のイベントを削除しました`);

      const { calendar, calendarId } = getCalendarClient();

      // 通常シフトを取得
      const shifts = this.getAllShifts();

      console.log(`[Calendar] 同期対象シフト数: ${shifts.length}件`);
      if (shifts.length === 0) {
        console.log(`[Calendar] シフトが0件のため、同期処理を終了`);
        return {
          success: true,
          total: 0,
          created: 0,
          failed: 0,
        };
      }

      // シフトをユーザー・日付でグループ化し、連続する時間帯をマージ
      const mergedSlots = groupAndMergeShifts(shifts);
      console.log(`[Calendar] マージ後のスロット数: ${mergedSlots.length}個`);
      if (shifts.length > 0) {
        const dates = shifts.map(s => s.date).sort();
        console.log(`[Calendar] 期間: ${dates[0]} 〜 ${dates[dates.length - 1]}`);
      }

      let created = 0;
      let failed = 0;
      const errors: Array<{ shift: ShiftInfo; error: string }> = [];

      // バッチ処理設定
      const BATCH_SIZE = 50;  // 50件ごとに待機
      const BATCH_DELAY = 1000; // 1秒待機

      // 各マージされたスロットをカレンダーに追加
      for (let i = 0; i < mergedSlots.length; i++) {
        const slot = mergedSlots[i];
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

        // プログレス表示
        if ((i + 1) % 10 === 0 || i === mergedSlots.length - 1) {
          console.log(`[Calendar] 進捗: ${created + failed}/${mergedSlots.length} (作成: ${created}, 失敗: ${failed})`);
        }

        // バッチディレイ
        if ((i + 1) % BATCH_SIZE === 0 && i < mergedSlots.length - 1) {
          console.log(`[Calendar] バッチ処理: ${i + 1}件完了 - 1秒待機中...`);
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
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
   * 特定ユーザーの特定日付のシフトを同期（マージあり）
   * シフト作成・削除時に呼ばれ、連続する時間枠を自動的にマージします
   */
  static async syncShiftsForUserAndDate(
    userId: string,
    date: string
  ): Promise<CalendarSyncResult> {
    try {
      console.log(`[Calendar] ==== シフト同期開始 ====`);
      console.log(`[Calendar] ユーザーID: ${userId}, 日付: ${date}`);

      const { calendar, calendarId } = getCalendarClient();

      // 該当ユーザーの該当日付のシフトを取得
      const shifts = db
        .prepare(
          `SELECT uuid, user_id, user_name, date, time_slot, calendar_event_id
           FROM shifts
           WHERE user_id = ? AND date = ?
           ORDER BY time_slot`
        )
        .all(userId, date) as Array<{
        uuid: string;
        user_id: string;
        user_name: string;
        date: string;
        time_slot: string;
        calendar_event_id: string | null;
      }>;

      // 既存のカレンダーイベントIDを取得（シフトが0件の場合も含む）
      const existingEvents = db
        .prepare(
          `SELECT DISTINCT calendar_event_id
           FROM shifts
           WHERE user_id = ? AND date = ? AND calendar_event_id IS NOT NULL`
        )
        .all(userId, date) as Array<{ calendar_event_id: string }>;

      console.log(`[Calendar] 既存イベント数: ${existingEvents.length}`);
      if (existingEvents.length > 0) {
        console.log(`[Calendar] 削除する既存イベントID:`, existingEvents.map(e => e.calendar_event_id));
      }

      // 既存のカレンダーイベントを削除
      for (const event of existingEvents) {
        await this.deleteCalendarEvent(event.calendar_event_id);
      }

      // calendar_event_idをクリア
      db.prepare('UPDATE shifts SET calendar_event_id = NULL WHERE user_id = ? AND date = ?').run(
        userId,
        date
      );

      // シフトがない場合は、削除だけして終了
      if (shifts.length === 0) {
        console.log(`[Calendar] シフトが0件のため、削除のみで終了`);
        console.log(`[Calendar] ==== シフト同期完了 ====`);
        return { success: true };
      }

      // ShiftInfo形式に変換
      const shiftInfos: ShiftInfo[] = shifts.map((shift) => ({
        uuid: shift.uuid,
        user_id: shift.user_id,
        user_name: shift.user_name,
        date: shift.date,
        time_slot: shift.time_slot,
        type: 'shift',
      }));

      console.log(`[Calendar] シフト数: ${shifts.length}`);
      console.log(`[Calendar] シフト時間帯:`, shifts.map(s => s.time_slot).join(', '));

      // 連続する時間枠をマージ
      const mergedSlots = groupAndMergeShifts(shiftInfos);
      console.log(`[Calendar] マージ後のスロット数: ${mergedSlots.length}`);

      // ユーザー情報を取得
      const user = UserModel.getByUserId(userId);
      if (!user) {
        return { success: false, error: `ユーザーが見つかりません: ${userId}` };
      }

      const displayName = this.getDisplayName({
        nickname: user.nickname,
        real_name: user.real_name,
        email: user.email,
      });

      // マージされたスロットごとにカレンダーイベントを作成
      for (let i = 0; i < mergedSlots.length; i++) {
        const slot = mergedSlots[i];
        const timeRange = `${slot.start_time}-${slot.end_time}`;

        console.log(`[Calendar] [${i + 1}/${mergedSlots.length}] イベント作成: ${timeRange}`);
        console.log(`[Calendar]   含まれるシフトUUID: ${slot.shift_uuids.length}個`);

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
          console.log(`[Calendar]   ✓ イベント作成成功: ${response.data.id}`);

          // このマージされたスロットに含まれるすべてのシフトにcalendar_event_idを設定
          const updateStmt = db.prepare('UPDATE shifts SET calendar_event_id = ? WHERE uuid = ?');
          for (const shiftUuid of slot.shift_uuids) {
            updateStmt.run(response.data.id, shiftUuid);
          }
          console.log(`[Calendar]   ✓ ${slot.shift_uuids.length}個のシフトにイベントIDを設定`);
        } else {
          console.error(`[Calendar]   ✗ イベントIDが取得できませんでした`);
        }
      }

      console.log(`[Calendar] ==== シフト同期完了 ====`);
      return { success: true };
    } catch (error: any) {
      console.error('[Calendar] ✗ シフト同期エラー:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 個別シフトをカレンダーに追加（通常シフトのみ）
   * 注意: このメソッドは直接使用せず、syncShiftsForUserAndDateを使用してください
   */
  static async addShiftToCalendar(shiftData: {
    uuid: string;
    user_id: string;
    date: string;
    time_slot: string;
    type: 'shift';
  }): Promise<CalendarSyncResult> {
    // 個別追加ではなく、ユーザー・日付単位で同期してマージする
    return this.syncShiftsForUserAndDate(shiftData.user_id, shiftData.date);
  }

  /**
   * 個別シフトをカレンダーから削除（通常シフトのみ）
   * 注意: このメソッドは直接使用せず、routes側でDB削除後にsyncShiftsForUserAndDateを使用してください
   * このメソッドは後方互換性のために残されています
   */
  static async deleteShiftFromCalendar(
    shiftUuid: string,
    type: 'shift'
  ): Promise<CalendarSyncResult> {
    try {
      // シフト情報を取得（削除前に）
      const shift = db
        .prepare('SELECT user_id, date FROM shifts WHERE uuid = ?')
        .get(shiftUuid) as { user_id: string; date: string } | undefined;

      if (!shift) {
        return { success: false, error: 'シフトが見つかりません' };
      }

      // その日付のシフトを再同期してマージ
      return this.syncShiftsForUserAndDate(shift.user_id, shift.date);
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

    // 通常シフトを取得（全期間）
    const stmt = db.prepare(`
      SELECT uuid, user_id, user_name, date, time_slot
      FROM shifts
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
   * 特定のシフトグループでカレンダーイベントを作成
   * シフト削除後の関連シフト再作成などに使用
   */
  static async createEventForShifts(
    shiftUuids: string[]
  ): Promise<CalendarSyncResult> {
    try {
      if (shiftUuids.length === 0) {
        return { success: true };
      }

      console.log(`[Calendar] ==== シフトグループのイベント作成開始 ====`);
      console.log(`[Calendar] 対象シフト数: ${shiftUuids.length}`);

      const { calendar, calendarId } = getCalendarClient();

      // シフト情報を取得
      const placeholders = shiftUuids.map(() => '?').join(',');
      const shifts = db
        .prepare(
          `SELECT uuid, user_id, user_name, date, time_slot
           FROM shifts
           WHERE uuid IN (${placeholders})
           ORDER BY date, time_slot`
        )
        .all(...shiftUuids) as Array<{
        uuid: string;
        user_id: string;
        user_name: string;
        date: string;
        time_slot: string;
      }>;

      if (shifts.length === 0) {
        console.log(`[Calendar] シフトが見つかりませんでした`);
        return { success: true };
      }

      // ShiftInfo形式に変換
      const shiftInfos: ShiftInfo[] = shifts.map((shift) => ({
        uuid: shift.uuid,
        user_id: shift.user_id,
        user_name: shift.user_name,
        date: shift.date,
        time_slot: shift.time_slot,
        type: 'shift',
      }));

      // 連続する時間枠をマージ
      const mergedSlots = groupAndMergeShifts(shiftInfos);
      console.log(`[Calendar] マージ後のスロット数: ${mergedSlots.length}`);

      // 各マージされたスロットでカレンダーイベントを作成
      for (let i = 0; i < mergedSlots.length; i++) {
        const slot = mergedSlots[i];

        // ユーザー情報を取得
        const user = UserModel.getByUserId(slot.user_id);
        if (!user) {
          console.error(`[Calendar] ユーザーが見つかりません: ${slot.user_id}`);
          continue;
        }

        const displayName = this.getDisplayName({
          nickname: user.nickname,
          real_name: user.real_name,
          email: user.email,
        });

        const timeRange = `${slot.start_time}-${slot.end_time}`;
        console.log(`[Calendar] [${i + 1}/${mergedSlots.length}] イベント作成: ${timeRange}`);

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
          console.log(`[Calendar] ✓ イベント作成成功: ${response.data.id}`);

          // このマージされたスロットに含まれるすべてのシフトにcalendar_event_idを設定
          const updateStmt = db.prepare('UPDATE shifts SET calendar_event_id = ? WHERE uuid = ?');
          for (const shiftUuid of slot.shift_uuids) {
            updateStmt.run(response.data.id, shiftUuid);
          }
          console.log(`[Calendar] ✓ ${slot.shift_uuids.length}個のシフトにイベントIDを設定`);
        } else {
          console.error(`[Calendar] ✗ イベントIDが取得できませんでした`);
        }
      }

      console.log(`[Calendar] ==== シフトグループのイベント作成完了 ====`);
      return { success: true };
    } catch (error: any) {
      console.error('[Calendar] ✗ シフトグループのイベント作成エラー:', error);
      return { success: false, error: error.message };
    }
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
