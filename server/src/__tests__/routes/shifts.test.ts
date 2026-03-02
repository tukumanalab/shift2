import request from 'supertest';
import express, { Express } from 'express';
import shiftsRouter from '../../routes/shifts';
import { ShiftModel } from '../../models/Shift';
import { CalendarService } from '../../services/CalendarService';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid')
}));

// Mock ShiftModel and CalendarService
jest.mock('../../models/Shift');
jest.mock('../../services/CalendarService');
jest.mock('../../database/db', () => ({
  default: {
    prepare: jest.fn().mockReturnValue({
      all: jest.fn().mockReturnValue([]),
      run: jest.fn()
    })
  }
}));

describe('Shifts API Routes', () => {
  let app: Express;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Suppress console output during tests
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    app = express();
    app.use(express.json());
    app.use('/api/shifts', shiftsRouter);
  });

  afterEach(() => {
    // Restore console methods
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('GET /api/shifts', () => {
    test('すべてのシフトを取得', async () => {
      const mockShifts = [
        {
          uuid: 'shift-1',
          user_id: 'user-1',
          user_name: 'ユーザー1',
          date: '2026-02-15',
          time_slot: '13:00-13:30'
        },
        {
          uuid: 'shift-2',
          user_id: 'user-2',
          user_name: 'ユーザー2',
          date: '2026-02-16',
          time_slot: '14:00-14:30'
        }
      ];

      (ShiftModel.getAll as jest.Mock).mockReturnValue(mockShifts);

      const response = await request(app).get('/api/shifts');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockShifts);
      expect(ShiftModel.getAll).toHaveBeenCalled();
    });

    test('nickname/real_nameフィールドを含むシフトデータを返す', async () => {
      const mockShifts = [
        {
          uuid: 'shift-1',
          user_id: 'user-1',
          user_name: 'ユーザー1',
          date: '2026-02-15',
          time_slot: '13:00-13:30',
          nickname: 'ニック',
          real_name: '本名太郎'
        },
        {
          uuid: 'shift-2',
          user_id: 'user-2',
          user_name: 'ユーザー2',
          date: '2026-02-16',
          time_slot: '14:00-14:30',
          nickname: null,
          real_name: null
        }
      ];

      (ShiftModel.getAll as jest.Mock).mockReturnValue(mockShifts);

      const response = await request(app).get('/api/shifts');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data[0].nickname).toBe('ニック');
      expect(response.body.data[0].real_name).toBe('本名太郎');
      expect(response.body.data[1].nickname).toBeNull();
      expect(response.body.data[1].real_name).toBeNull();
    });

    test('特定のユーザーのシフトを取得', async () => {
      const mockShifts = [
        {
          uuid: 'shift-1',
          user_id: 'user-1',
          user_name: 'ユーザー1',
          date: '2026-02-15',
          time_slot: '13:00-13:30'
        }
      ];

      (ShiftModel.getByUserId as jest.Mock).mockReturnValue(mockShifts);

      const response = await request(app).get('/api/shifts?userId=user-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockShifts);
      expect(ShiftModel.getByUserId).toHaveBeenCalledWith('user-1');
    });

    test('特定の日付のシフトを取得', async () => {
      const mockShifts = [
        {
          uuid: 'shift-1',
          user_id: 'user-1',
          user_name: 'ユーザー1',
          date: '2026-02-15',
          time_slot: '13:00-13:30'
        }
      ];

      (ShiftModel.getByDate as jest.Mock).mockReturnValue(mockShifts);

      const response = await request(app).get('/api/shifts?date=2026-02-15');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockShifts);
      expect(ShiftModel.getByDate).toHaveBeenCalledWith('2026-02-15');
    });

    test('特定のユーザーと日付のシフトを取得', async () => {
      const mockShifts = [
        {
          uuid: 'shift-1',
          user_id: 'user-1',
          user_name: 'ユーザー1',
          date: '2026-02-15',
          time_slot: '13:00-13:30'
        }
      ];

      (ShiftModel.getByUserIdAndDate as jest.Mock).mockReturnValue(mockShifts);

      const response = await request(app).get('/api/shifts?userId=user-1&date=2026-02-15');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockShifts);
      expect(ShiftModel.getByUserIdAndDate).toHaveBeenCalledWith('user-1', '2026-02-15');
    });

    test('日付範囲でシフトを取得', async () => {
      const mockShifts = [
        {
          uuid: 'shift-1',
          user_id: 'user-1',
          user_name: 'ユーザー1',
          date: '2026-02-15',
          time_slot: '13:00-13:30'
        }
      ];

      (ShiftModel.getByDateRange as jest.Mock).mockReturnValue(mockShifts);

      const response = await request(app).get('/api/shifts?startDate=2026-02-01&endDate=2026-02-28');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockShifts);
      expect(ShiftModel.getByDateRange).toHaveBeenCalledWith('2026-02-01', '2026-02-28');
    });

    test('内部エラー時は500エラー', async () => {
      (ShiftModel.getAll as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/shifts');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('サーバーエラーが発生しました');
    });
  });

  describe('GET /api/shifts/counts', () => {
    test('すべての日付のシフトカウントを取得', async () => {
      const mockCounts = {
        '2026-02-15': {
          '13:00-13:30': 2,
          '14:00-14:30': 3
        }
      };

      (ShiftModel.getShiftCounts as jest.Mock).mockReturnValue(mockCounts);

      const response = await request(app).get('/api/shifts/counts');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockCounts);
      expect(ShiftModel.getShiftCounts).toHaveBeenCalled();
    });

    test('特定の日付のシフトカウントを取得', async () => {
      const mockDateCounts = {
        '13:00-13:30': 2,
        '14:00-14:30': 3
      };

      (ShiftModel.getShiftCountsByDate as jest.Mock).mockReturnValue(mockDateCounts);

      const response = await request(app).get('/api/shifts/counts?date=2026-02-15');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({ '2026-02-15': mockDateCounts });
      expect(ShiftModel.getShiftCountsByDate).toHaveBeenCalledWith('2026-02-15');
    });

    test('内部エラー時は500エラー', async () => {
      (ShiftModel.getShiftCounts as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/shifts/counts');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('サーバーエラーが発生しました');
    });
  });

  describe('GET /api/shifts/:uuid', () => {
    test('特定のシフトを取得', async () => {
      const mockShift = {
        uuid: 'shift-1',
        user_id: 'user-1',
        user_name: 'ユーザー1',
        date: '2026-02-15',
        time_slot: '13:00-13:30'
      };

      (ShiftModel.getByUuid as jest.Mock).mockReturnValue(mockShift);

      const response = await request(app).get('/api/shifts/shift-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockShift);
      expect(ShiftModel.getByUuid).toHaveBeenCalledWith('shift-1');
    });

    test('シフトが存在しない場合は404エラー', async () => {
      (ShiftModel.getByUuid as jest.Mock).mockReturnValue(null);

      const response = await request(app).get('/api/shifts/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('指定されたシフトが見つかりません');
    });

    test('内部エラー時は500エラー', async () => {
      (ShiftModel.getByUuid as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/shifts/shift-1');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('サーバーエラーが発生しました');
    });
  });

  describe('POST /api/shifts/check-duplicate', () => {
    test('重複をチェック（重複あり）', async () => {
      (ShiftModel.checkDuplicate as jest.Mock).mockReturnValue(true);

      const response = await request(app)
        .post('/api/shifts/check-duplicate')
        .send({
          userId: 'user-1',
          date: '2026-02-15',
          timeSlot: '13:00-13:30'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.isDuplicate).toBe(true);
      expect(ShiftModel.checkDuplicate).toHaveBeenCalledWith('user-1', '2026-02-15', '13:00-13:30');
    });

    test('重複をチェック（重複なし）', async () => {
      (ShiftModel.checkDuplicate as jest.Mock).mockReturnValue(false);

      const response = await request(app)
        .post('/api/shifts/check-duplicate')
        .send({
          userId: 'user-1',
          date: '2026-02-15',
          timeSlot: '13:00-13:30'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.isDuplicate).toBe(false);
    });

    test('必須フィールドが不足している場合は400エラー', async () => {
      const response = await request(app)
        .post('/api/shifts/check-duplicate')
        .send({
          userId: 'user-1',
          date: '2026-02-15'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('userId, date, timeSlotは必須です');
    });

    test('内部エラー時は500エラー', async () => {
      (ShiftModel.checkDuplicate as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .post('/api/shifts/check-duplicate')
        .send({
          userId: 'user-1',
          date: '2026-02-15',
          timeSlot: '13:00-13:30'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('サーバーエラーが発生しました');
    });
  });

  describe('POST /api/shifts/check-multiple-duplicates', () => {
    test('複数時間枠の重複をチェック', async () => {
      const mockDuplicates = {
        '13:00-13:30': true,
        '14:00-14:30': false,
        '15:00-15:30': false
      };

      (ShiftModel.checkMultipleDuplicates as jest.Mock).mockReturnValue(mockDuplicates);

      const response = await request(app)
        .post('/api/shifts/check-multiple-duplicates')
        .send({
          userId: 'user-1',
          date: '2026-02-15',
          timeSlots: ['13:00-13:30', '14:00-14:30', '15:00-15:30']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.duplicates).toEqual(mockDuplicates);
      expect(ShiftModel.checkMultipleDuplicates).toHaveBeenCalledWith(
        'user-1',
        '2026-02-15',
        ['13:00-13:30', '14:00-14:30', '15:00-15:30']
      );
    });

    test('必須フィールドが不足している場合は400エラー', async () => {
      const response = await request(app)
        .post('/api/shifts/check-multiple-duplicates')
        .send({
          userId: 'user-1',
          date: '2026-02-15'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('userId, date, timeSlotsは必須です');
    });

    test('timeSlotsが配列でない場合は400エラー', async () => {
      const response = await request(app)
        .post('/api/shifts/check-multiple-duplicates')
        .send({
          userId: 'user-1',
          date: '2026-02-15',
          timeSlots: '13:00-13:30'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('userId, date, timeSlotsは必須です');
    });
  });

  describe('POST /api/shifts', () => {
    test('シフトを作成（カレンダー同期成功）', async () => {
      const mockShift = {
        uuid: 'shift-1',
        user_id: 'user-1',
        user_name: 'ユーザー1',
        date: '2026-02-15',
        time_slot: '13:00-13:30'
      };

      (ShiftModel.checkDuplicate as jest.Mock).mockReturnValue(false);
      (ShiftModel.create as jest.Mock).mockReturnValue(mockShift);
      (CalendarService.addShiftToCalendar as jest.Mock).mockResolvedValue({
        success: true,
        eventId: 'calendar-event-1'
      });

      const response = await request(app)
        .post('/api/shifts')
        .send({
          user_id: 'user-1',
          user_name: 'ユーザー1',
          date: '2026-02-15',
          time_slot: '13:00-13:30'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockShift);
      expect(response.body.calendarSync).toBe('success');
      expect(ShiftModel.create).toHaveBeenCalled();
      expect(CalendarService.addShiftToCalendar).toHaveBeenCalled();
    });

    test('必須フィールドが不足している場合は400エラー', async () => {
      const response = await request(app)
        .post('/api/shifts')
        .send({
          user_id: 'user-1',
          date: '2026-02-15'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('必須フィールドが不足しています');
    });

    test('重複している場合は409エラー', async () => {
      (ShiftModel.checkDuplicate as jest.Mock).mockReturnValue(true);

      const response = await request(app)
        .post('/api/shifts')
        .send({
          user_id: 'user-1',
          user_name: 'ユーザー1',
          date: '2026-02-15',
          time_slot: '13:00-13:30'
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('duplicate');
    });

    test('シフト作成失敗時は500エラー', async () => {
      (ShiftModel.checkDuplicate as jest.Mock).mockReturnValue(false);
      (ShiftModel.create as jest.Mock).mockReturnValue(null);

      const response = await request(app)
        .post('/api/shifts')
        .send({
          user_id: 'user-1',
          user_name: 'ユーザー1',
          date: '2026-02-15',
          time_slot: '13:00-13:30'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('シフトの作成に失敗しました');
    });
  });

  describe('POST /api/shifts/multiple', () => {
    test('複数シフトを一括作成', async () => {
      const mockDuplicates = {
        '13:00-13:30': false,
        '14:00-14:30': false,
        '15:00-15:30': true
      };

      const mockResult = {
        success: 2,
        failed: 0,
        duplicates: 1,
        created: [
          {
            uuid: 'shift-1',
            user_id: 'user-1',
            user_name: 'ユーザー1',
            date: '2026-02-15',
            time_slot: '13:00-13:30'
          },
          {
            uuid: 'shift-2',
            user_id: 'user-1',
            user_name: 'ユーザー1',
            date: '2026-02-15',
            time_slot: '14:00-14:30'
          }
        ]
      };

      (ShiftModel.checkMultipleDuplicates as jest.Mock).mockReturnValue(mockDuplicates);
      (ShiftModel.bulkCreate as jest.Mock).mockReturnValue(mockResult);
      (CalendarService.syncShiftsForUserAndDate as jest.Mock).mockResolvedValue({
        success: true
      });

      const response = await request(app)
        .post('/api/shifts/multiple')
        .send({
          user_id: 'user-1',
          user_name: 'ユーザー1',
          date: '2026-02-15',
          time_slots: ['13:00-13:30', '14:00-14:30', '15:00-15:30']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.result.success).toBe(2);
      expect(response.body.duplicates).toEqual(['15:00-15:30']);
      expect(response.body.message).toContain('2件');
    });

    test('必須フィールドが不足している場合は400エラー', async () => {
      const response = await request(app)
        .post('/api/shifts/multiple')
        .send({
          user_id: 'user-1',
          date: '2026-02-15'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('必須フィールドが不足しています');
    });
  });

  describe('DELETE /api/shifts/:uuid', () => {
    test('シフトを削除', async () => {
      const mockShift = {
        uuid: 'shift-1',
        user_id: 'user-1',
        date: '2026-02-15',
        time_slot: '13:00-13:30',
        calendar_event_id: null
      };

      (ShiftModel.getByUuid as jest.Mock).mockReturnValue(mockShift);
      (ShiftModel.delete as jest.Mock).mockReturnValue(true);
      (CalendarService.deleteCalendarEvent as jest.Mock).mockResolvedValue({ success: true });
      (CalendarService.createEventForShifts as jest.Mock).mockResolvedValue({ success: true });

      const response = await request(app).delete('/api/shifts/shift-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('シフトを削除しました');
      expect(ShiftModel.delete).toHaveBeenCalledWith('shift-1');
    });

    test('シフトが存在しない場合は404エラー', async () => {
      (ShiftModel.getByUuid as jest.Mock).mockReturnValue(null);

      const response = await request(app).delete('/api/shifts/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('指定されたシフトが見つかりません');
    });

    test('シフト削除失敗時は500エラー', async () => {
      const mockShift = {
        uuid: 'shift-1',
        user_id: 'user-1',
        date: '2026-02-15',
        time_slot: '13:00-13:30'
      };

      (ShiftModel.getByUuid as jest.Mock).mockReturnValue(mockShift);
      (ShiftModel.delete as jest.Mock).mockReturnValue(false);

      const response = await request(app).delete('/api/shifts/shift-1');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('シフトの削除に失敗しました');
    });
  });

  describe('POST /api/shifts/delete-multiple', () => {
    test('複数シフトを一括削除', async () => {
      const mockShift1 = {
        uuid: 'shift-1',
        user_id: 'user-1',
        date: '2026-02-15',
        time_slot: '13:00-13:30',
        calendar_event_id: 'event-1'
      };

      const mockShift2 = {
        uuid: 'shift-2',
        user_id: 'user-1',
        date: '2026-02-15',
        time_slot: '14:00-14:30',
        calendar_event_id: 'event-2'
      };

      (ShiftModel.getByUuid as jest.Mock)
        .mockReturnValueOnce(mockShift1)
        .mockReturnValueOnce(mockShift2);
      (ShiftModel.deleteMultiple as jest.Mock).mockReturnValue({
        success: 2,
        failed: 0
      });
      (CalendarService.deleteCalendarEvent as jest.Mock).mockResolvedValue({ success: true });
      (CalendarService.syncShiftsForUserAndDate as jest.Mock).mockResolvedValue({ success: true });

      const response = await request(app)
        .post('/api/shifts/delete-multiple')
        .send({
          uuids: ['shift-1', 'shift-2']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.deletedCount).toBe(2);
      expect(response.body.message).toContain('2件');
    });

    test('UUIDの配列が必要な場合は400エラー', async () => {
      const response = await request(app)
        .post('/api/shifts/delete-multiple')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('UUIDの配列が必要です');
    });
  });
});
