import request from 'supertest';
import express, { Express } from 'express';
import calendarRouter from '../../routes/calendar';
import { CalendarService } from '../../services/CalendarService';

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

describe('Calendar API Routes', () => {
  let app: Express;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    app = express();
    app.use(express.json());
    app.use('/api/calendar', calendarRouter);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('POST /api/calendar/clean-date', () => {
    test('指定日のカレンダーリセット処理が呼び出されレスポンスを返す', async () => {
      (CalendarService.cleanAndResyncDate as jest.Mock).mockResolvedValue({
        success: true,
        deleted: 12,
        resyncedShifts: 3,
        resyncedApplications: 2,
      });

      const response = await request(app)
        .post('/api/calendar/clean-date')
        .send({ date: '2026-05-31' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        success: true,
        deleted: 12,
        resyncedShifts: 3,
        resyncedApplications: 2,
      });
      expect(CalendarService.cleanAndResyncDate).toHaveBeenCalledWith('2026-05-31');
    });

    test('dateが未指定なら400', async () => {
      const response = await request(app)
        .post('/api/calendar/clean-date')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(CalendarService.cleanAndResyncDate).not.toHaveBeenCalled();
    });

    test('dateがYYYY-MM-DD形式でなければ400', async () => {
      const response = await request(app)
        .post('/api/calendar/clean-date')
        .send({ date: '2026/05/31' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(CalendarService.cleanAndResyncDate).not.toHaveBeenCalled();
    });

    test('サービスが失敗を返した場合は500', async () => {
      (CalendarService.cleanAndResyncDate as jest.Mock).mockResolvedValue({
        success: false,
        deleted: 0,
        resyncedShifts: 0,
        resyncedApplications: 0,
        error: 'API失敗',
      });

      const response = await request(app)
        .post('/api/calendar/clean-date')
        .send({ date: '2026-05-31' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API失敗');
    });

    test('サービスが例外を投げた場合は500', async () => {
      (CalendarService.cleanAndResyncDate as jest.Mock).mockRejectedValue(
        new Error('予期せぬエラー')
      );

      const response = await request(app)
        .post('/api/calendar/clean-date')
        .send({ date: '2026-05-31' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });
});
