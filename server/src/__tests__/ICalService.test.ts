import { ICalService } from '../services/ICalService';
import { ShiftModel } from '../models/Shift';
import { SpecialShiftApplicationModel } from '../models/SpecialShiftApplication';

jest.mock('uuid', () => ({ v4: jest.fn(() => 'mock-uuid') }));

jest.mock('../models/Shift');
jest.mock('../models/SpecialShiftApplication');
jest.mock('../database/db', () => ({
  default: {
    prepare: jest.fn().mockReturnValue({
      all: jest.fn().mockReturnValue([]),
      run: jest.fn(),
      get: jest.fn()
    })
  }
}));

describe('ICalService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ShiftModel.getAll as jest.Mock).mockReturnValue([]);
    (ShiftModel.getByUserId as jest.Mock).mockReturnValue([]);
    (SpecialShiftApplicationModel.getAllWithShiftInfo as jest.Mock).mockReturnValue([]);
  });

  describe('generateAll()', () => {
    test('特別シフト申請（applicant）の時間枠でイベントを生成する', () => {
      const mockApps = [
        {
          uuid: 'app-1',
          special_shift_uuid: 'shift-1',
          user_id: 'user-1',
          user_name: '申請者A',
          email: 'a@example.com',
          time_slot: '13:00-13:30',
          date: '2026-04-20',
          created_at: '2026-04-17T00:00:00.000Z',
          updated_at: '2026-04-17T00:00:00.000Z'
        },
        {
          uuid: 'app-2',
          special_shift_uuid: 'shift-1',
          user_id: 'user-1',
          user_name: '申請者A',
          email: 'a@example.com',
          time_slot: '13:30-14:00',
          date: '2026-04-20',
          created_at: '2026-04-17T00:00:00.000Z',
          updated_at: '2026-04-17T00:00:00.000Z'
        }
      ];
      (SpecialShiftApplicationModel.getAllWithShiftInfo as jest.Mock).mockReturnValue(mockApps);

      const ical = ICalService.generateAll();

      // 申請者名が含まれる
      expect(ical).toContain('申請者A');
      // getAllWithShiftInfo が呼ばれる（引数なし）
      expect(SpecialShiftApplicationModel.getAllWithShiftInfo).toHaveBeenCalledWith(undefined);
    });

    test('連続する申請スロットが1つのイベントにマージされる', () => {
      const mockApps = [
        { uuid: 'app-1', special_shift_uuid: 'shift-1', user_id: 'user-1', user_name: '申請者A',
          email: 'a@example.com', time_slot: '13:00-13:30', date: '2026-04-20', created_at: '', updated_at: '' },
        { uuid: 'app-2', special_shift_uuid: 'shift-1', user_id: 'user-1', user_name: '申請者A',
          email: 'a@example.com', time_slot: '13:30-14:00', date: '2026-04-20', created_at: '', updated_at: '' }
      ];
      (SpecialShiftApplicationModel.getAllWithShiftInfo as jest.Mock).mockReturnValue(mockApps);

      const ical = ICalService.generateAll();

      // 13:00-14:00 にマージされるので DESCRIPTION に時間帯が含まれる（タイムゾーン非依存）
      expect(ical).toContain('時間: 13:00-14:00');
    });

    test('userId なしで getAllWithShiftInfo を呼ぶ', () => {
      ICalService.generateAll();
      expect(SpecialShiftApplicationModel.getAllWithShiftInfo).toHaveBeenCalledWith(undefined);
    });
  });

  describe('特別シフト名のiCal出力', () => {
    test('shift_name がある場合、イベントのサマリに名前が含まれる', () => {
      const mockApps = [
        { uuid: 'app-1', special_shift_uuid: 'shift-1', user_id: 'user-1', user_name: '申請者A',
          email: 'a@example.com', time_slot: '09:00-09:30', date: '2026-04-20', shift_name: '夏期特別シフト',
          created_at: '', updated_at: '' },
      ];
      (SpecialShiftApplicationModel.getAllWithShiftInfo as jest.Mock).mockReturnValue(mockApps);

      const ical = ICalService.generateAll();

      expect(ical).toContain('夏期特別シフト');
    });

    test('shift_name がない場合、「特別シフト」がサマリに含まれる', () => {
      const mockApps = [
        { uuid: 'app-1', special_shift_uuid: 'shift-1', user_id: 'user-1', user_name: '申請者A',
          email: 'a@example.com', time_slot: '09:00-09:30', date: '2026-04-20', shift_name: null,
          created_at: '', updated_at: '' },
      ];
      (SpecialShiftApplicationModel.getAllWithShiftInfo as jest.Mock).mockReturnValue(mockApps);

      const ical = ICalService.generateAll();

      expect(ical).toContain('特別シフト');
    });
  });

  describe('ATTENDEE（メールアドレス）のiCal出力', () => {
    test('特別シフト申請にメールアドレスがあれば ATTENDEE が出力される', () => {
      const mockApps = [
        { uuid: 'app-1', special_shift_uuid: 'shift-1', user_id: 'user-1', user_name: '申請者A',
          email: 'a@example.com', time_slot: '13:00-13:30', date: '2026-04-20',
          created_at: '', updated_at: '' },
      ];
      (SpecialShiftApplicationModel.getAllWithShiftInfo as jest.Mock).mockReturnValue(mockApps);

      const result = ICalService.generateAll();

      expect(result).toContain('ATTENDEE');
      expect(result).toContain('a@example.com');
    });

    test('通常シフトにメールアドレスがあれば ATTENDEE が出力される', () => {
      const mockShifts = [
        { id: 1, uuid: 'shift-1', user_id: 'user-1', user_name: '担当者B',
          email: 'b@example.com', date: '2026-04-21', time_slot: '13:00-13:30',
          calendar_event_id: null, created_at: '', updated_at: '' },
      ];
      (ShiftModel.getAll as jest.Mock).mockReturnValue(mockShifts);

      const result = ICalService.generateAll();

      expect(result).toContain('ATTENDEE');
      expect(result).toContain('b@example.com');
    });

    test('メールアドレスがない場合は ATTENDEE が出力されない', () => {
      const mockApps = [
        { uuid: 'app-1', special_shift_uuid: 'shift-1', user_id: 'user-1', user_name: '申請者A',
          email: null, time_slot: '13:00-13:30', date: '2026-04-20',
          created_at: '', updated_at: '' },
      ];
      (SpecialShiftApplicationModel.getAllWithShiftInfo as jest.Mock).mockReturnValue(mockApps);

      const result = ICalService.generateAll();

      expect(result).not.toContain('ATTENDEE');
    });
  });

  describe('generateForUser(userId)', () => {
    test('特定ユーザーの特別シフト申請のみ含まれる', () => {
      const mockApps = [
        { uuid: 'app-1', special_shift_uuid: 'shift-1', user_id: 'user-1', user_name: '申請者A',
          email: 'a@example.com', time_slot: '13:00-13:30', date: '2026-04-20', created_at: '', updated_at: '' }
      ];
      (SpecialShiftApplicationModel.getAllWithShiftInfo as jest.Mock).mockReturnValue(mockApps);

      const ical = ICalService.generateForUser('user-1');

      expect(ical).toContain('申請者A');
      // userId を渡して呼ばれる
      expect(SpecialShiftApplicationModel.getAllWithShiftInfo).toHaveBeenCalledWith('user-1');
    });

    test('userId を渡して getAllWithShiftInfo を呼ぶ', () => {
      ICalService.generateForUser('user-42');
      expect(SpecialShiftApplicationModel.getAllWithShiftInfo).toHaveBeenCalledWith('user-42');
    });
  });
});
