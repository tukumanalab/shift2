import request from 'supertest';
import express, { Express } from 'express';
import capacitySettingsRouter from '../../routes/capacitySettings';
import { CapacitySettingModel } from '../../models/CapacitySetting';

// Mock CapacitySettingModel
jest.mock('../../models/CapacitySetting');

describe('Capacity Settings API Routes', () => {
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
    app.use('/api/capacity-settings', capacitySettingsRouter);
  });

  afterEach(() => {
    // Restore console methods
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('GET /api/capacity-settings', () => {
    test('すべての人数設定を取得', async () => {
      const mockSettings = [
        {
          id: 1,
          date: '2026-02-15',
          capacity: 3,
          memo: 'テストメモ',
          user_id: 'user-1',
          user_name: 'ユーザー1',
          created_at: '2026-01-26T00:00:00Z',
          updated_at: '2026-01-26T00:00:00Z'
        },
        {
          id: 2,
          date: '2026-02-16',
          capacity: 2,
          memo: '',
          user_id: 'user-1',
          user_name: 'ユーザー1',
          created_at: '2026-01-26T00:00:00Z',
          updated_at: '2026-01-26T00:00:00Z'
        }
      ];

      (CapacitySettingModel.getAll as jest.Mock).mockReturnValue(mockSettings);

      const response = await request(app).get('/api/capacity-settings');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSettings);
      expect(CapacitySettingModel.getAll).toHaveBeenCalled();
    });

    test('特定の日付の人数設定を取得', async () => {
      const mockSetting = {
        id: 1,
        date: '2026-02-15',
        capacity: 3,
        memo: 'テストメモ',
        user_id: 'user-1',
        user_name: 'ユーザー1',
        created_at: '2026-01-26T00:00:00Z',
        updated_at: '2026-01-26T00:00:00Z'
      };

      (CapacitySettingModel.getByDate as jest.Mock).mockReturnValue(mockSetting);

      const response = await request(app).get('/api/capacity-settings?date=2026-02-15');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([mockSetting]);
      expect(CapacitySettingModel.getByDate).toHaveBeenCalledWith('2026-02-15');
    });

    test('特定の日付の人数設定が存在しない場合は空配列を返す', async () => {
      (CapacitySettingModel.getByDate as jest.Mock).mockReturnValue(null);

      const response = await request(app).get('/api/capacity-settings?date=2026-02-15');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    test('日付範囲で人数設定を取得', async () => {
      const mockSettings = [
        {
          id: 1,
          date: '2026-02-15',
          capacity: 3,
          memo: '',
          user_id: 'user-1',
          user_name: 'ユーザー1',
          created_at: '2026-01-26T00:00:00Z',
          updated_at: '2026-01-26T00:00:00Z'
        }
      ];

      (CapacitySettingModel.getByDateRange as jest.Mock).mockReturnValue(mockSettings);

      const response = await request(app).get('/api/capacity-settings?startDate=2026-02-01&endDate=2026-02-28');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSettings);
      expect(CapacitySettingModel.getByDateRange).toHaveBeenCalledWith('2026-02-01', '2026-02-28');
    });

    test('内部エラー時は500エラー', async () => {
      (CapacitySettingModel.getAll as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/capacity-settings');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('サーバーエラーが発生しました');
    });
  });

  describe('GET /api/capacity-settings/:date', () => {
    test('特定の日付の人数設定を取得', async () => {
      const mockSetting = {
        id: 1,
        date: '2026-02-15',
        capacity: 3,
        memo: 'テストメモ',
        user_id: 'user-1',
        user_name: 'ユーザー1',
        created_at: '2026-01-26T00:00:00Z',
        updated_at: '2026-01-26T00:00:00Z'
      };

      (CapacitySettingModel.getByDate as jest.Mock).mockReturnValue(mockSetting);

      const response = await request(app).get('/api/capacity-settings/2026-02-15');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSetting);
      expect(CapacitySettingModel.getByDate).toHaveBeenCalledWith('2026-02-15');
    });

    test('人数設定が存在しない場合は404エラー', async () => {
      (CapacitySettingModel.getByDate as jest.Mock).mockReturnValue(null);

      const response = await request(app).get('/api/capacity-settings/2026-02-15');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('指定された日付の人数設定が見つかりません');
    });

    test('内部エラー時は500エラー', async () => {
      (CapacitySettingModel.getByDate as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/capacity-settings/2026-02-15');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('サーバーエラーが発生しました');
    });
  });

  describe('POST /api/capacity-settings', () => {
    test('人数設定を作成', async () => {
      const mockSetting = {
        id: 1,
        date: '2026-02-15',
        capacity: 3,
        memo: 'テストメモ',
        user_id: 'user-1',
        user_name: 'ユーザー1',
        created_at: '2026-01-26T00:00:00Z',
        updated_at: '2026-01-26T00:00:00Z'
      };

      (CapacitySettingModel.upsert as jest.Mock).mockReturnValue(mockSetting);

      const response = await request(app)
        .post('/api/capacity-settings')
        .send({
          date: '2026-02-15',
          capacity: 3,
          memo: 'テストメモ',
          user_id: 'user-1',
          user_name: 'ユーザー1'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSetting);
      expect(CapacitySettingModel.upsert).toHaveBeenCalledWith({
        date: '2026-02-15',
        capacity: 3,
        memo: 'テストメモ',
        user_id: 'user-1',
        user_name: 'ユーザー1'
      });
    });

    test('人数設定を更新（UPSERT）', async () => {
      const mockSetting = {
        id: 1,
        date: '2026-02-15',
        capacity: 5,
        memo: '更新されたメモ',
        user_id: 'user-1',
        user_name: 'ユーザー1',
        created_at: '2026-01-26T00:00:00Z',
        updated_at: '2026-01-26T10:00:00Z'
      };

      (CapacitySettingModel.upsert as jest.Mock).mockReturnValue(mockSetting);

      const response = await request(app)
        .post('/api/capacity-settings')
        .send({
          date: '2026-02-15',
          capacity: 5,
          memo: '更新されたメモ',
          user_id: 'user-1',
          user_name: 'ユーザー1'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSetting);
    });

    test('必須フィールドが不足している場合は400エラー（日付がない）', async () => {
      const response = await request(app)
        .post('/api/capacity-settings')
        .send({
          capacity: 3
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('日付と人数は必須です');
    });

    test('必須フィールドが不足している場合は400エラー（人数がない）', async () => {
      const response = await request(app)
        .post('/api/capacity-settings')
        .send({
          date: '2026-02-15'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('日付と人数は必須です');
    });

    test('人数設定の保存失敗時は500エラー', async () => {
      (CapacitySettingModel.upsert as jest.Mock).mockReturnValue(null);

      const response = await request(app)
        .post('/api/capacity-settings')
        .send({
          date: '2026-02-15',
          capacity: 3
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('人数設定の保存に失敗しました');
    });

    test('内部エラー時は500エラー', async () => {
      (CapacitySettingModel.upsert as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .post('/api/capacity-settings')
        .send({
          date: '2026-02-15',
          capacity: 3
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('サーバーエラーが発生しました');
    });
  });

  describe('POST /api/capacity-settings/bulk', () => {
    test('複数の人数設定を一括作成', async () => {
      const mockResult = {
        success: 3,
        failed: 0,
        settings: [
          {
            id: 1,
            date: '2026-02-15',
            capacity: 3,
            memo: '',
            user_id: 'user-1',
            user_name: 'ユーザー1'
          },
          {
            id: 2,
            date: '2026-02-16',
            capacity: 2,
            memo: '',
            user_id: 'user-1',
            user_name: 'ユーザー1'
          },
          {
            id: 3,
            date: '2026-02-17',
            capacity: 4,
            memo: '',
            user_id: 'user-1',
            user_name: 'ユーザー1'
          }
        ]
      };

      (CapacitySettingModel.bulkUpsert as jest.Mock).mockReturnValue(mockResult);

      const response = await request(app)
        .post('/api/capacity-settings/bulk')
        .send({
          settings: [
            { date: '2026-02-15', capacity: 3, user_id: 'user-1', user_name: 'ユーザー1' },
            { date: '2026-02-16', capacity: 2, user_id: 'user-1', user_name: 'ユーザー1' },
            { date: '2026-02-17', capacity: 4, user_id: 'user-1', user_name: 'ユーザー1' }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(response.body.message).toBe('3件の人数設定を保存しました');
    });

    test('人数設定の配列が必要な場合は400エラー', async () => {
      const response = await request(app)
        .post('/api/capacity-settings/bulk')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('人数設定の配列が必要です');
    });

    test('空の配列の場合は400エラー', async () => {
      const response = await request(app)
        .post('/api/capacity-settings/bulk')
        .send({
          settings: []
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('人数設定の配列が必要です');
    });

    test('内部エラー時は500エラー', async () => {
      (CapacitySettingModel.bulkUpsert as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .post('/api/capacity-settings/bulk')
        .send({
          settings: [
            { date: '2026-02-15', capacity: 3 }
          ]
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('サーバーエラーが発生しました');
    });
  });

  describe('PUT /api/capacity-settings/:date', () => {
    test('人数設定を更新', async () => {
      const mockSetting = {
        id: 1,
        date: '2026-02-15',
        capacity: 5,
        memo: '更新されたメモ',
        user_id: 'user-1',
        user_name: 'ユーザー1',
        created_at: '2026-01-26T00:00:00Z',
        updated_at: '2026-01-26T10:00:00Z'
      };

      (CapacitySettingModel.update as jest.Mock).mockReturnValue(mockSetting);

      const response = await request(app)
        .put('/api/capacity-settings/2026-02-15')
        .send({
          capacity: 5,
          memo: '更新されたメモ',
          user_id: 'user-1',
          user_name: 'ユーザー1'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSetting);
      expect(CapacitySettingModel.update).toHaveBeenCalledWith('2026-02-15', {
        capacity: 5,
        memo: '更新されたメモ',
        user_id: 'user-1',
        user_name: 'ユーザー1'
      });
    });

    test('必須フィールドが不足している場合は400エラー', async () => {
      const response = await request(app)
        .put('/api/capacity-settings/2026-02-15')
        .send({
          memo: '更新されたメモ'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('人数は必須です');
    });

    test('人数設定が存在しない場合は404エラー', async () => {
      (CapacitySettingModel.update as jest.Mock).mockReturnValue(null);

      const response = await request(app)
        .put('/api/capacity-settings/2026-02-15')
        .send({
          capacity: 5
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('指定された日付の人数設定が見つかりません');
    });

    test('内部エラー時は500エラー', async () => {
      (CapacitySettingModel.update as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .put('/api/capacity-settings/2026-02-15')
        .send({
          capacity: 5
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('サーバーエラーが発生しました');
    });
  });

  describe('DELETE /api/capacity-settings/:date', () => {
    test('人数設定を削除', async () => {
      (CapacitySettingModel.delete as jest.Mock).mockReturnValue(true);

      const response = await request(app).delete('/api/capacity-settings/2026-02-15');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('人数設定を削除しました');
      expect(CapacitySettingModel.delete).toHaveBeenCalledWith('2026-02-15');
    });

    test('人数設定が存在しない場合は404エラー', async () => {
      (CapacitySettingModel.delete as jest.Mock).mockReturnValue(false);

      const response = await request(app).delete('/api/capacity-settings/2026-02-15');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('指定された日付の人数設定が見つからないか、削除に失敗しました');
    });

    test('内部エラー時は500エラー', async () => {
      (CapacitySettingModel.delete as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app).delete('/api/capacity-settings/2026-02-15');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('サーバーエラーが発生しました');
    });
  });
});
