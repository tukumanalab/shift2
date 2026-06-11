/**
 * カレンダー同期の直列化テスト
 *
 * バグ再現: 同一ユーザー・同一日付の特別シフト申請同期が並行実行されると、
 * 後発の同期が先発の同期の作成イベントID（DB書き込み前）を観測できず、
 * 削除されない orphan イベントが Google Calendar に残る。
 * （例: 9:00-17:30 を 30 分刻みで連続申請 → 「X:XX〜17:30」のイベントが大量発生）
 */

import { CalendarService } from '../services/CalendarService';
import { UserModel } from '../models/User';

// ---- ステートフルなフェイク（jest.mock ファクトリから参照するため mock プレフィックス必須）----

interface MockApp {
  uuid: string;
  user_id: string;
  user_name: string;
  time_slot: string;
  calendar_event_id: string | null;
  date: string;
  shift_name: string | null;
}

const mockState = {
  apps: [] as MockApp[],
  // Google Calendar 上に存在するイベント: id → サマリー情報
  calendarEvents: new Map<string, { start: string; end: string }>(),
  insertDelayMs: 20,
  nextEventId: 1,
};

jest.mock('../database/db', () => ({
  prepare: (sql: string) => {
    if (sql.includes('FROM special_shift_applications a')) {
      return {
        all: (userId: string, date: string) =>
          mockState.apps
            .filter((a) => a.user_id === userId && a.date === date)
            .sort((a, b) => a.time_slot.localeCompare(b.time_slot))
            .map((a) => ({ ...a })),
      };
    }
    if (sql.includes('SET calendar_event_id = ? WHERE uuid = ?')) {
      return {
        run: (eventId: string, uuid: string) => {
          const app = mockState.apps.find((a) => a.uuid === uuid);
          if (app) app.calendar_event_id = eventId;
        },
      };
    }
    if (sql.includes('SET calendar_event_id = NULL')) {
      return {
        run: (userId: string, date: string) => {
          for (const app of mockState.apps) {
            if (app.user_id === userId && app.date === date) {
              app.calendar_event_id = null;
            }
          }
        },
      };
    }
    return { all: () => [], run: () => undefined, get: () => undefined };
  },
}));

jest.mock('../utils/googleAuth', () => ({
  getCalendarClient: () => ({
    calendarId: 'test-calendar',
    calendar: {
      events: {
        insert: async ({ requestBody }: any) => {
          // 実際の API 同様、イベント作成には時間がかかる
          await new Promise((r) => setTimeout(r, mockState.insertDelayMs));
          const id = `event-${mockState.nextEventId++}`;
          mockState.calendarEvents.set(id, {
            start: requestBody.extendedProperties.private.shift_time.split('-')[0],
            end: requestBody.extendedProperties.private.shift_time.split('-')[1],
          });
          return { data: { id } };
        },
        delete: async ({ eventId }: any) => {
          if (!mockState.calendarEvents.has(eventId)) {
            const error: any = new Error('Not Found');
            error.code = 404;
            throw error;
          }
          mockState.calendarEvents.delete(eventId);
          return {};
        },
      },
    },
  }),
}));

jest.mock('../models/User');

function addApplication(uuid: string, timeSlot: string): void {
  mockState.apps.push({
    uuid,
    user_id: 'user-1',
    user_name: 'さっしー',
    time_slot: timeSlot,
    calendar_event_id: null,
    date: '2026-06-13',
    shift_name: 'Scratch Day 2026 in Tokyo サポート(10号館)',
  });
}

describe('特別シフト申請カレンダー同期の直列化', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockState.apps = [];
    mockState.calendarEvents.clear();
    mockState.nextEventId = 1;
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    (UserModel.getByUserId as jest.Mock).mockReturnValue({
      user_id: 'user-1',
      name: 'さっしー',
      email: 'sassy@example.com',
      nickname: 'さっしー',
      real_name: '佐島拓',
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('同一ユーザー・同一日付の同期が並行発火しても orphan イベントが残らない', async () => {
    // 申請1件目 → 同期発火（イベント作成中）
    addApplication('app-1', '09:00-09:30');
    const sync1 = CalendarService.syncSpecialShiftApplicationsForUserAndDate('user-1', '2026-06-13');

    // 1件目の同期が完了する前に申請2件目 → 同期が並行発火
    addApplication('app-2', '09:30-10:00');
    const sync2 = CalendarService.syncSpecialShiftApplicationsForUserAndDate('user-1', '2026-06-13');

    const [result1, result2] = await Promise.all([sync1, sync2]);
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    // カレンダー上にはマージ済みの 1 イベントだけが存在すること（orphan なし）
    expect(mockState.calendarEvents.size).toBe(1);
    const [survivingId, surviving] = [...mockState.calendarEvents.entries()][0];
    expect(surviving).toEqual({ start: '09:00', end: '10:00' });

    // DB 上の全申請が、生き残ったイベント ID にリンクされていること
    expect(mockState.apps.map((a) => a.calendar_event_id)).toEqual([survivingId, survivingId]);
  });

  test('大量の連続申請（30分刻み）でも最終的にイベントは1つにマージされる', async () => {
    // 9:00-17:30 を 30 分刻みで逆順に連続申請（待たずに同期が次々発火する状況を再現）
    const slots: string[] = [];
    for (let mins = 9 * 60; mins < 17.5 * 60; mins += 30) {
      const fmt = (m: number) =>
        `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      slots.push(`${fmt(mins)}-${fmt(mins + 30)}`);
    }
    slots.reverse();

    const syncs: Array<Promise<{ success: boolean }>> = [];
    slots.forEach((slot, i) => {
      addApplication(`app-${i}`, slot);
      syncs.push(CalendarService.syncSpecialShiftApplicationsForUserAndDate('user-1', '2026-06-13'));
    });

    const results = await Promise.all(syncs);
    expect(results.every((r) => r.success)).toBe(true);

    // 「X:XX〜17:30」の orphan イベントの山にならず、9:00-17:30 の 1 件のみ
    expect(mockState.calendarEvents.size).toBe(1);
    expect([...mockState.calendarEvents.values()][0]).toEqual({ start: '09:00', end: '17:30' });
  });
});
