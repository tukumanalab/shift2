import request from 'supertest';
import express, { Express } from 'express';
import specialShiftsRouter from '../../routes/specialShifts';
import { SpecialShiftModel } from '../../models/SpecialShift';
import { SpecialShiftApplicationModel } from '../../models/SpecialShiftApplication';
import { CalendarService } from '../../services/CalendarService';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid')
}));

// Mock models
jest.mock('../../models/SpecialShift');
jest.mock('../../models/SpecialShiftApplication');
jest.mock('../../services/CalendarService');
jest.mock('../../database/db', () => ({
  default: {
    prepare: jest.fn().mockReturnValue({
      all: jest.fn().mockReturnValue([]),
      run: jest.fn(),
      get: jest.fn()
    })
  }
}));

describe('Special Shifts API Routes', () => {
  let app: Express;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    // CalendarService のデフォルトモック
    (CalendarService.syncSpecialShiftApplicationsForUserAndDate as jest.Mock)
      .mockResolvedValue({ success: true });

    app = express();
    app.use(express.json());
    app.use('/api/special-shifts', specialShiftsRouter);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  // ============================================================
  // 既存エンドポイントのテスト
  // ============================================================

  describe('GET /api/special-shifts', () => {
    test('すべての特別シフトを取得', async () => {
      const mockShifts = [
        { uuid: 'shift-1', date: '2026-04-20', start_time: '10:00', end_time: '12:00', user_id: 'admin-1', user_name: '管理者' }
      ];
      (SpecialShiftModel.getAll as jest.Mock).mockReturnValue(mockShifts);

      const response = await request(app).get('/api/special-shifts');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockShifts);
    });

    test('日付で特別シフトを取得', async () => {
      const mockShifts = [
        { uuid: 'shift-1', date: '2026-04-20', start_time: '10:00', end_time: '12:00', user_id: 'admin-1', user_name: '管理者' }
      ];
      (SpecialShiftModel.getByDate as jest.Mock).mockReturnValue(mockShifts);

      const response = await request(app).get('/api/special-shifts?date=2026-04-20');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockShifts);
      expect(SpecialShiftModel.getByDate).toHaveBeenCalledWith('2026-04-20');
    });

    test('内部エラー時は500エラー', async () => {
      (SpecialShiftModel.getAll as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/special-shifts');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/special-shifts', () => {
    test('特別シフトを作成', async () => {
      const mockShift = {
        uuid: 'shift-1',
        date: '2026-04-20',
        name: '夏期特別シフト',
        start_time: '10:00',
        end_time: '12:00',
        user_id: 'admin-1',
        user_name: '管理者'
      };
      (SpecialShiftModel.create as jest.Mock).mockReturnValue(mockShift);

      const response = await request(app)
        .post('/api/special-shifts')
        .send({ date: '2026-04-20', name: '夏期特別シフト', start_time: '10:00', end_time: '12:00', user_id: 'admin-1', user_name: '管理者' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockShift);
    });

    test('name フィールドが SpecialShiftModel.create に渡される', async () => {
      const mockShift = { uuid: 'shift-1', date: '2026-04-20', name: '特別A', start_time: '10:00', end_time: '12:00', user_id: 'admin-1', user_name: '管理者' };
      (SpecialShiftModel.create as jest.Mock).mockReturnValue(mockShift);

      await request(app)
        .post('/api/special-shifts')
        .send({ date: '2026-04-20', name: '特別A', start_time: '10:00', end_time: '12:00', user_id: 'admin-1', user_name: '管理者' });

      expect(SpecialShiftModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: '特別A' })
      );
    });

    test('name がない場合は400エラー', async () => {
      const response = await request(app)
        .post('/api/special-shifts')
        .send({ date: '2026-04-20', start_time: '10:00', end_time: '12:00', user_id: 'admin-1', user_name: '管理者' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('必須フィールドが不足している場合は400エラー', async () => {
      const response = await request(app)
        .post('/api/special-shifts')
        .send({ date: '2026-04-20', start_time: '10:00' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/special-shifts/:uuid', () => {
    test('特別シフトを削除', async () => {
      const mockShift = { uuid: 'shift-1', date: '2026-04-20' };
      (SpecialShiftModel.getByUuid as jest.Mock).mockReturnValue(mockShift);
      (SpecialShiftModel.delete as jest.Mock).mockReturnValue(true);

      const response = await request(app).delete('/api/special-shifts/shift-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('特別シフトが存在しない場合は404エラー', async () => {
      (SpecialShiftModel.getByUuid as jest.Mock).mockReturnValue(null);

      const response = await request(app).delete('/api/special-shifts/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  // ============================================================
  // 新機能: 全申請一覧（シフト一覧表示用）
  // ============================================================

  describe('GET /api/special-shifts/applications', () => {
    const mockAppsWithDate = [
      {
        uuid: 'app-1', special_shift_uuid: 'shift-1',
        user_id: 'user-1', user_name: 'ユーザー1',
        nickname: 'いしはらa', real_name: '石原浮也',
        time_slot: '10:00-10:30', date: '2026-04-20',
        shift_name: '夏期特別シフト',
        calendar_event_id: 'cal-event-123',
        created_at: '2026-04-17T00:00:00.000Z'
      },
      {
        uuid: 'app-2', special_shift_uuid: 'shift-1',
        user_id: 'user-2', user_name: 'ユーザー2',
        nickname: null, real_name: null,
        time_slot: '10:30-11:00', date: '2026-04-20',
        shift_name: '夏期特別シフト',
        calendar_event_id: null,
        created_at: '2026-04-17T00:00:00.000Z'
      },
    ];

    test('すべての申請を日付情報付きで取得できる', async () => {
      (SpecialShiftApplicationModel.getAllWithShiftInfo as jest.Mock).mockReturnValue(mockAppsWithDate);

      const response = await request(app).get('/api/special-shifts/applications');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAppsWithDate);
      expect(SpecialShiftApplicationModel.getAllWithShiftInfo).toHaveBeenCalledWith(undefined);
    });

    test('userId クエリパラメータで絞り込める', async () => {
      const userApps = mockAppsWithDate.filter(a => a.user_id === 'user-1');
      (SpecialShiftApplicationModel.getAllWithShiftInfo as jest.Mock).mockReturnValue(userApps);

      const response = await request(app).get('/api/special-shifts/applications?userId=user-1');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(userApps);
      expect(SpecialShiftApplicationModel.getAllWithShiftInfo).toHaveBeenCalledWith('user-1');
    });

    test('レスポンスに calendar_event_id が含まれる', async () => {
      (SpecialShiftApplicationModel.getAllWithShiftInfo as jest.Mock).mockReturnValue(mockAppsWithDate);

      const response = await request(app).get('/api/special-shifts/applications');

      expect(response.status).toBe(200);
      expect(response.body.data[0].calendar_event_id).toBe('cal-event-123');
      expect(response.body.data[1].calendar_event_id).toBeNull();
    });

    test('レスポンスに nickname と real_name が含まれる', async () => {
      (SpecialShiftApplicationModel.getAllWithShiftInfo as jest.Mock).mockReturnValue(mockAppsWithDate);

      const response = await request(app).get('/api/special-shifts/applications');

      expect(response.status).toBe(200);
      expect(response.body.data[0].nickname).toBe('いしはらa');
      expect(response.body.data[0].real_name).toBe('石原浮也');
      expect(response.body.data[1].nickname).toBeNull();
      expect(response.body.data[1].real_name).toBeNull();
    });

    test('レスポンスに shift_name が含まれる', async () => {
      (SpecialShiftApplicationModel.getAllWithShiftInfo as jest.Mock).mockReturnValue(mockAppsWithDate);

      const response = await request(app).get('/api/special-shifts/applications');

      expect(response.status).toBe(200);
      expect(response.body.data[0].shift_name).toBe('夏期特別シフト');
      expect(response.body.data[1].shift_name).toBe('夏期特別シフト');
    });

    test('内部エラー時は500エラー', async () => {
      (SpecialShiftApplicationModel.getAllWithShiftInfo as jest.Mock).mockImplementation(() => {
        throw new Error('DB error');
      });

      const response = await request(app).get('/api/special-shifts/applications');
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  // ============================================================
  // 新機能: 特別シフト申請
  // ============================================================

  describe('POST /api/special-shifts/:uuid/apply', () => {
    test('time_slotを指定して特別シフトに申請できる', async () => {
      const mockShift = {
        uuid: 'shift-1',
        date: '2026-04-20',
        start_time: '10:00',
        end_time: '12:00',
        user_id: 'admin-1',
        user_name: '管理者'
      };
      const mockApp = {
        uuid: 'mock-uuid',
        special_shift_uuid: 'shift-1',
        user_id: 'user-1',
        user_name: 'ユーザー1',
        time_slot: '10:00-10:30',
        created_at: '2026-04-17T00:00:00.000Z',
        updated_at: '2026-04-17T00:00:00.000Z'
      };

      (SpecialShiftModel.getByUuid as jest.Mock).mockReturnValue(mockShift);
      (SpecialShiftApplicationModel.checkDuplicate as jest.Mock).mockReturnValue(false);
      (SpecialShiftApplicationModel.create as jest.Mock).mockReturnValue(mockApp);

      const response = await request(app)
        .post('/api/special-shifts/shift-1/apply')
        .send({ user_id: 'user-1', user_name: 'ユーザー1', time_slot: '10:00-10:30' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockApp);
      expect(SpecialShiftApplicationModel.checkDuplicate).toHaveBeenCalledWith('user-1', 'shift-1', '10:00-10:30');
      expect(SpecialShiftApplicationModel.create).toHaveBeenCalledWith({
        special_shift_uuid: 'shift-1',
        user_id: 'user-1',
        user_name: 'ユーザー1',
        time_slot: '10:00-10:30'
      });
    });

    test('特別シフトが存在しない場合は404エラー', async () => {
      (SpecialShiftModel.getByUuid as jest.Mock).mockReturnValue(null);

      const response = await request(app)
        .post('/api/special-shifts/nonexistent/apply')
        .send({ user_id: 'user-1', user_name: 'ユーザー1', time_slot: '10:00-10:30' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('特別シフトが見つかりません');
    });

    test('同じtime_slotへの重複申請は409エラー', async () => {
      const mockShift = { uuid: 'shift-1' };
      (SpecialShiftModel.getByUuid as jest.Mock).mockReturnValue(mockShift);
      (SpecialShiftApplicationModel.checkDuplicate as jest.Mock).mockReturnValue(true);

      const response = await request(app)
        .post('/api/special-shifts/shift-1/apply')
        .send({ user_id: 'user-1', user_name: 'ユーザー1', time_slot: '10:00-10:30' });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('duplicate');
    });

    test('同じユーザーが異なるtime_slotに申請できる', async () => {
      const mockShift = { uuid: 'shift-1' };
      const mockApp = {
        uuid: 'mock-uuid',
        special_shift_uuid: 'shift-1',
        user_id: 'user-1',
        user_name: 'ユーザー1',
        time_slot: '10:30-11:00'
      };
      (SpecialShiftModel.getByUuid as jest.Mock).mockReturnValue(mockShift);
      // 10:00-10:30 は申請済みだが 10:30-11:00 は未申請
      (SpecialShiftApplicationModel.checkDuplicate as jest.Mock).mockReturnValue(false);
      (SpecialShiftApplicationModel.create as jest.Mock).mockReturnValue(mockApp);

      const response = await request(app)
        .post('/api/special-shifts/shift-1/apply')
        .send({ user_id: 'user-1', user_name: 'ユーザー1', time_slot: '10:30-11:00' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(SpecialShiftApplicationModel.checkDuplicate).toHaveBeenCalledWith('user-1', 'shift-1', '10:30-11:00');
    });

    test('必須フィールド(user_id)が不足している場合は400エラー', async () => {
      const response = await request(app)
        .post('/api/special-shifts/shift-1/apply')
        .send({ user_name: 'ユーザー1', time_slot: '10:00-10:30' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('必須フィールドが不足しています');
    });

    test('必須フィールド(user_name)が不足している場合は400エラー', async () => {
      const response = await request(app)
        .post('/api/special-shifts/shift-1/apply')
        .send({ user_id: 'user-1', time_slot: '10:00-10:30' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('必須フィールドが不足しています');
    });

    test('必須フィールド(time_slot)が不足している場合は400エラー', async () => {
      const response = await request(app)
        .post('/api/special-shifts/shift-1/apply')
        .send({ user_id: 'user-1', user_name: 'ユーザー1' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('必須フィールドが不足しています');
    });

    test('申請作成失敗時は500エラー', async () => {
      const mockShift = { uuid: 'shift-1' };
      (SpecialShiftModel.getByUuid as jest.Mock).mockReturnValue(mockShift);
      (SpecialShiftApplicationModel.checkDuplicate as jest.Mock).mockReturnValue(false);
      (SpecialShiftApplicationModel.create as jest.Mock).mockReturnValue(null);

      const response = await request(app)
        .post('/api/special-shifts/shift-1/apply')
        .send({ user_id: 'user-1', user_name: 'ユーザー1', time_slot: '10:00-10:30' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    test('申請成功後にカレンダー同期が呼ばれる', async () => {
      const mockShift = { uuid: 'shift-1', date: '2026-04-20', start_time: '10:00', end_time: '12:00' };
      const mockApp = { uuid: 'mock-uuid', special_shift_uuid: 'shift-1',
        user_id: 'user-1', user_name: 'ユーザー1', time_slot: '10:00-10:30' };
      (SpecialShiftModel.getByUuid as jest.Mock).mockReturnValue(mockShift);
      (SpecialShiftApplicationModel.checkDuplicate as jest.Mock).mockReturnValue(false);
      (SpecialShiftApplicationModel.create as jest.Mock).mockReturnValue(mockApp);

      await request(app)
        .post('/api/special-shifts/shift-1/apply')
        .send({ user_id: 'user-1', user_name: 'ユーザー1', time_slot: '10:00-10:30' });

      expect(CalendarService.syncSpecialShiftApplicationsForUserAndDate)
        .toHaveBeenCalledWith('user-1', '2026-04-20');
    });

    test('カレンダー同期失敗でも201を返す（非致命的エラー）', async () => {
      const mockShift = { uuid: 'shift-1', date: '2026-04-20' };
      const mockApp = { uuid: 'mock-uuid', user_id: 'user-1', user_name: 'ユーザー1', time_slot: '10:00-10:30' };
      (SpecialShiftModel.getByUuid as jest.Mock).mockReturnValue(mockShift);
      (SpecialShiftApplicationModel.checkDuplicate as jest.Mock).mockReturnValue(false);
      (SpecialShiftApplicationModel.create as jest.Mock).mockReturnValue(mockApp);
      (CalendarService.syncSpecialShiftApplicationsForUserAndDate as jest.Mock)
        .mockResolvedValue({ success: false, error: 'Calendar API error' });

      const response = await request(app)
        .post('/api/special-shifts/shift-1/apply')
        .send({ user_id: 'user-1', user_name: 'ユーザー1', time_slot: '10:00-10:30' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    test('内部エラー時は500エラー', async () => {
      (SpecialShiftModel.getByUuid as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .post('/api/special-shifts/shift-1/apply')
        .send({ user_id: 'user-1', user_name: 'ユーザー1', time_slot: '10:00-10:30' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/special-shifts/:uuid/applications', () => {
    test('特別シフトへの申請一覧を取得できる', async () => {
      const mockShift = { uuid: 'shift-1', date: '2026-04-20' };
      const mockApps = [
        { uuid: 'app-1', special_shift_uuid: 'shift-1', user_id: 'user-1', user_name: 'ユーザー1' },
        { uuid: 'app-2', special_shift_uuid: 'shift-1', user_id: 'user-2', user_name: 'ユーザー2' }
      ];

      (SpecialShiftModel.getByUuid as jest.Mock).mockReturnValue(mockShift);
      (SpecialShiftApplicationModel.getBySpecialShiftUuid as jest.Mock).mockReturnValue(mockApps);

      const response = await request(app).get('/api/special-shifts/shift-1/applications');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockApps);
      expect(SpecialShiftApplicationModel.getBySpecialShiftUuid).toHaveBeenCalledWith('shift-1');
    });

    test('特別シフトが存在しない場合は404エラー', async () => {
      (SpecialShiftModel.getByUuid as jest.Mock).mockReturnValue(null);

      const response = await request(app).get('/api/special-shifts/nonexistent/applications');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('特別シフトが見つかりません');
    });

    test('内部エラー時は500エラー', async () => {
      (SpecialShiftModel.getByUuid as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/special-shifts/shift-1/applications');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/special-shifts/applications/:appUuid', () => {
    test('申請をキャンセルできる', async () => {
      const mockApp = {
        uuid: 'app-1',
        special_shift_uuid: 'shift-1',
        user_id: 'user-1',
        user_name: 'ユーザー1'
      };
      (SpecialShiftApplicationModel.getByUuid as jest.Mock).mockReturnValue(mockApp);
      (SpecialShiftApplicationModel.delete as jest.Mock).mockReturnValue(true);
      (SpecialShiftModel.getByUuid as jest.Mock).mockReturnValue({ uuid: 'shift-1', date: '2026-04-20' });

      const response = await request(app).delete('/api/special-shifts/applications/app-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('申請をキャンセルしました');
      expect(SpecialShiftApplicationModel.delete).toHaveBeenCalledWith('app-1');
    });

    test('キャンセル後にカレンダー再同期が呼ばれる', async () => {
      const mockApp = {
        uuid: 'app-1', special_shift_uuid: 'shift-1',
        user_id: 'user-1', user_name: 'ユーザー1'
      };
      (SpecialShiftApplicationModel.getByUuid as jest.Mock).mockReturnValue(mockApp);
      (SpecialShiftApplicationModel.delete as jest.Mock).mockReturnValue(true);
      (SpecialShiftModel.getByUuid as jest.Mock).mockReturnValue({ uuid: 'shift-1', date: '2026-04-20' });

      await request(app).delete('/api/special-shifts/applications/app-1');

      expect(CalendarService.syncSpecialShiftApplicationsForUserAndDate)
        .toHaveBeenCalledWith('user-1', '2026-04-20');
    });

    test('申請が存在しない場合は404エラー', async () => {
      (SpecialShiftApplicationModel.getByUuid as jest.Mock).mockReturnValue(null);

      const response = await request(app).delete('/api/special-shifts/applications/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('申請が見つかりません');
    });

    test('削除失敗時は500エラー', async () => {
      const mockApp = { uuid: 'app-1' };
      (SpecialShiftApplicationModel.getByUuid as jest.Mock).mockReturnValue(mockApp);
      (SpecialShiftApplicationModel.delete as jest.Mock).mockReturnValue(false);

      const response = await request(app).delete('/api/special-shifts/applications/app-1');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    test('内部エラー時は500エラー', async () => {
      (SpecialShiftApplicationModel.getByUuid as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app).delete('/api/special-shifts/applications/app-1');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });
});
