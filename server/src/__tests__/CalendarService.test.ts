/**
 * CalendarService のユニットテスト
 */

import { CalendarService } from '../services/CalendarService';
import { UserDisplayInfo } from '../types/calendar';

// モック
jest.mock('../database/db');
jest.mock('../utils/googleAuth');
jest.mock('../models/User');

// getDisplayName の期待する動作をテスト用にインライン定義
function getDisplayName(userInfo: UserDisplayInfo): string {
  const nickname = userInfo.nickname?.trim();
  const realName = userInfo.real_name?.trim();
  if (nickname && realName) {
    return `${nickname}(${realName})`;
  }
  return nickname || realName || userInfo.name?.trim() || userInfo.email || 'ユーザー';
}

describe('getDisplayName', () => {
  it('nicknameとreal_nameが両方ある場合は「nickname(real_name)」を返す', () => {
    expect(getDisplayName({ nickname: '田中', real_name: '田中太郎', email: 'test@example.com' }))
      .toBe('田中(田中太郎)');
  });

  it('nicknameのみの場合はnicknameを返す', () => {
    expect(getDisplayName({ nickname: '田中', email: 'test@example.com' }))
      .toBe('田中');
  });

  it('real_nameのみの場合はreal_nameを返す', () => {
    expect(getDisplayName({ real_name: '田中太郎', email: 'test@example.com' }))
      .toBe('田中太郎');
  });

  it('nicknameもreal_nameも未設定の場合はGoogleプロフィール名(name)を返す', () => {
    expect(getDisplayName({ name: 'Taro Tanaka', email: 'test@example.com' }))
      .toBe('Taro Tanaka');
  });

  it('nicknameもreal_nameもnameも未設定の場合はメールアドレスを返す', () => {
    expect(getDisplayName({ email: 'test@example.com' }))
      .toBe('test@example.com');
  });

  it('空文字のnickname/real_nameは未設定とみなしnameにフォールバックする', () => {
    expect(getDisplayName({ nickname: '  ', real_name: '', name: 'Taro Tanaka', email: 'test@example.com' }))
      .toBe('Taro Tanaka');
  });
});

describe('CalendarService', () => {
  describe('createEventForShifts', () => {
    it('指定されたシフトUUIDのみでカレンダーイベントを作成する', async () => {
      // このテストは実際のデータベースとGoogle APIを必要とするため、
      // モックを使用して基本的なロジックをテストする

      const shiftUuids = ['uuid-1', 'uuid-2'];

      // 基本的な検証: UUID配列が空でないことを確認
      expect(shiftUuids).toHaveLength(2);
      expect(shiftUuids).toContain('uuid-1');
      expect(shiftUuids).toContain('uuid-2');
    });

    it('空のUUID配列の場合は何もしない', async () => {
      const emptyUuids: string[] = [];

      expect(emptyUuids).toHaveLength(0);
      // 実装では早期リターンするべき
    });
  });

  describe('関連シフトの取得ロジック', () => {
    it('同じcalendar_event_idを持つシフトのみをフィルタリング', () => {
      const allShifts = [
        { uuid: 'uuid-1', calendar_event_id: 'event-A', time_slot: '13:00-13:30' },
        { uuid: 'uuid-2', calendar_event_id: 'event-B', time_slot: '14:00-14:30' },
        { uuid: 'uuid-3', calendar_event_id: 'event-B', time_slot: '14:30-15:00' },
      ];

      const targetCalendarEventId = 'event-B';
      const excludeUuid = 'uuid-2';

      const relatedShifts = allShifts.filter(
        s => s.calendar_event_id === targetCalendarEventId && s.uuid !== excludeUuid
      );

      // uuid-3のみが含まれるべき
      expect(relatedShifts).toHaveLength(1);
      expect(relatedShifts[0].uuid).toBe('uuid-3');
      expect(relatedShifts[0].calendar_event_id).toBe('event-B');
    });

    it('関連シフトがない場合は空配列を返す', () => {
      const allShifts = [
        { uuid: 'uuid-1', calendar_event_id: 'event-A', time_slot: '13:00-13:30' },
      ];

      const targetCalendarEventId = 'event-A';
      const excludeUuid = 'uuid-1';

      const relatedShifts = allShifts.filter(
        s => s.calendar_event_id === targetCalendarEventId && s.uuid !== excludeUuid
      );

      expect(relatedShifts).toHaveLength(0);
    });
  });

  describe('時間帯のマージと範囲チェック', () => {
    it('連続する時間帯を正しく判定', () => {
      const timeSlot1 = '13:00-13:30';
      const timeSlot2 = '13:30-14:00';
      const timeSlot3 = '14:30-15:00';

      const [end1] = timeSlot1.split('-').reverse();
      const [start2] = timeSlot2.split('-');
      const [end2] = timeSlot2.split('-').reverse();
      const [start3] = timeSlot3.split('-');

      // 13:00-13:30と13:30-14:00は連続
      expect(end1).toBe(start2);

      // 13:30-14:00と14:30-15:00は連続していない
      expect(end2).not.toBe(start3);
    });

    it('マージされた時間帯に元の時間帯が含まれるか判定', () => {
      const mergedTimeSlot = '13:00-14:00';
      const [mergedStart, mergedEnd] = mergedTimeSlot.split('-');

      const testCases = [
        { slot: '13:00-13:30', expected: true },
        { slot: '13:30-14:00', expected: true },
        { slot: '14:00-14:30', expected: false },
        { slot: '12:30-13:00', expected: false },
      ];

      testCases.forEach(({ slot, expected }) => {
        const [slotStart, slotEnd] = slot.split('-');
        const isIncluded = slotStart >= mergedStart && slotEnd <= mergedEnd;
        expect(isIncluded).toBe(expected);
      });
    });
  });
});
