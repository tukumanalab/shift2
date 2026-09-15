import request from 'supertest';
import express, { Express } from 'express';
import icalRouter from '../../routes/ical';
import { ICalService } from '../../services/ICalService';
import { deriveUserIcalToken } from '../../utils/icalToken';

jest.mock('uuid', () => ({ v4: jest.fn(() => 'mock-uuid') }));

jest.mock('../../services/ICalService');
jest.mock('../../database/db', () => ({
  default: {
    prepare: jest.fn().mockReturnValue({
      all: jest.fn().mockReturnValue([]),
      run: jest.fn(),
      get: jest.fn()
    })
  }
}));

const ADMIN_TOKEN = 'admin-secret-token';

describe('iCal API Routes', () => {
  let app: Express;
  let originalToken: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    originalToken = process.env.ICAL_TOKEN;
    process.env.ICAL_TOKEN = ADMIN_TOKEN;

    (ICalService.generateAll as jest.Mock).mockReturnValue('BEGIN:VCALENDAR\nEND:VCALENDAR');
    (ICalService.generateForUser as jest.Mock).mockReturnValue('BEGIN:VCALENDAR\nEND:VCALENDAR');

    app = express();
    app.use('/api/ical', icalRouter);
  });

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.ICAL_TOKEN;
    } else {
      process.env.ICAL_TOKEN = originalToken;
    }
  });

  describe('GET /api/ical/all', () => {
    test('管理者トークンで全シフトを返す', async () => {
      const res = await request(app).get('/api/ical/all').query({ token: ADMIN_TOKEN });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/calendar');
      expect(ICalService.generateAll).toHaveBeenCalled();
    });

    test('トークンが違えば 401', async () => {
      const res = await request(app).get('/api/ical/all').query({ token: 'wrong' });

      expect(res.status).toBe(401);
      expect(ICalService.generateAll).not.toHaveBeenCalled();
    });

    test('ユーザー個別トークンでは全シフトを取得できない', async () => {
      const userToken = deriveUserIcalToken('user-1') as string;

      const res = await request(app).get('/api/ical/all').query({ token: userToken });

      expect(res.status).toBe(401);
      expect(ICalService.generateAll).not.toHaveBeenCalled();
    });

    test('ICAL_TOKEN 未設定なら 503', async () => {
      delete process.env.ICAL_TOKEN;

      const res = await request(app).get('/api/ical/all').query({ token: ADMIN_TOKEN });

      expect(res.status).toBe(503);
    });
  });

  describe('GET /api/ical/user/:user_id', () => {
    test('自分用トークンで自分のシフトだけを返す', async () => {
      const token = deriveUserIcalToken('user-1') as string;

      const res = await request(app).get('/api/ical/user/user-1').query({ token });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/calendar');
      expect(ICalService.generateForUser).toHaveBeenCalledWith('user-1');
    });

    test('他人の user_id に自分のトークンを付けてアクセスすると 401', async () => {
      const token = deriveUserIcalToken('user-1') as string;

      const res = await request(app).get('/api/ical/user/user-2').query({ token });

      expect(res.status).toBe(401);
      expect(ICalService.generateForUser).not.toHaveBeenCalled();
    });

    test('共通の管理者トークンでも他人のシフトは取得できない', async () => {
      const res = await request(app).get('/api/ical/user/user-1').query({ token: ADMIN_TOKEN });

      expect(res.status).toBe(401);
      expect(ICalService.generateForUser).not.toHaveBeenCalled();
    });

    test('トークンなしなら 401', async () => {
      const res = await request(app).get('/api/ical/user/user-1');

      expect(res.status).toBe(401);
      expect(ICalService.generateForUser).not.toHaveBeenCalled();
    });

    test('カレンダーアプリで購読できるよう inline で配信する', async () => {
      const token = deriveUserIcalToken('user-1') as string;

      const res = await request(app).get('/api/ical/user/user-1').query({ token });

      expect(res.headers['content-disposition']).not.toContain('attachment');
    });
  });

  describe('GET /api/ical/all-url', () => {
    beforeEach(() => {
      process.env.AUTHORIZED_EMAILS = 'admin@example.com,boss@example.com';
    });

    test('管理者のメールアドレスなら全シフトの購読URLを返す', async () => {
      const res = await request(app).get('/api/ical/all-url').query({ email: 'admin@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.url).toBe(`/api/ical/all?token=${ADMIN_TOKEN}`);
    });

    test('大文字小文字や空白が違っても管理者として扱う', async () => {
      const res = await request(app).get('/api/ical/all-url').query({ email: ' Admin@Example.com ' });

      expect(res.status).toBe(200);
    });

    test('認可されていないメールアドレスなら 403', async () => {
      const res = await request(app).get('/api/ical/all-url').query({ email: 'stranger@example.com' });

      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).not.toContain(ADMIN_TOKEN);
    });

    test('メールアドレスなしなら 403', async () => {
      const res = await request(app).get('/api/ical/all-url');

      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).not.toContain(ADMIN_TOKEN);
    });

    test('ICAL_TOKEN 未設定なら 503', async () => {
      delete process.env.ICAL_TOKEN;

      const res = await request(app).get('/api/ical/all-url').query({ email: 'admin@example.com' });

      expect(res.status).toBe(503);
    });
  });

  describe('GET /api/ical/my-url', () => {
    test('userId を渡すとその人専用の購読URLを返す', async () => {
      const res = await request(app).get('/api/ical/my-url').query({ userId: 'user-1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.url).toContain('/api/ical/user/user-1?token=');
      expect(res.body.data.url).toContain(deriveUserIcalToken('user-1') as string);
    });

    test('返す URL に共通の ICAL_TOKEN は含まれない', async () => {
      const res = await request(app).get('/api/ical/my-url').query({ userId: 'user-1' });

      expect(res.body.data.url).not.toContain(ADMIN_TOKEN);
    });

    test('userId がなければ 400', async () => {
      const res = await request(app).get('/api/ical/my-url');

      expect(res.status).toBe(400);
    });

    test('ICAL_TOKEN 未設定なら 503', async () => {
      delete process.env.ICAL_TOKEN;

      const res = await request(app).get('/api/ical/my-url').query({ userId: 'user-1' });

      expect(res.status).toBe(503);
    });
  });
});
