import request from 'supertest';
import express, { Express } from 'express';
import configRouter from '../../routes/config';

jest.mock('../../database/db', () => ({
  default: {
    prepare: jest.fn().mockReturnValue({
      all: jest.fn().mockReturnValue([]),
      run: jest.fn(),
      get: jest.fn()
    })
  }
}));

describe('Config API Routes', () => {
  let app: Express;
  let originalIcalToken: string | undefined;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    originalIcalToken = process.env.ICAL_TOKEN;
    process.env.ICAL_TOKEN = 'super-secret-ical-token';
    process.env.GOOGLE_CLIENT_ID = 'client-id-123.apps.googleusercontent.com';
    process.env.AUTHORIZED_EMAILS = 'a@example.com,b@example.com';

    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    app = express();
    app.use('/api/config', configRouter);
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    if (originalIcalToken === undefined) {
      delete process.env.ICAL_TOKEN;
    } else {
      process.env.ICAL_TOKEN = originalIcalToken;
    }
  });

  test('Google Client ID と認可メールを返す', async () => {
    const res = await request(app).get('/api/config');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.googleClientId).toBe('client-id-123.apps.googleusercontent.com');
    expect(res.body.data.authorizedEmails).toBe('a@example.com,b@example.com');
  });

  test('iCal の共通トークンを未ログインのクライアントへ配布しない', async () => {
    const res = await request(app).get('/api/config');

    expect(JSON.stringify(res.body)).not.toContain('super-secret-ical-token');
    expect(res.body.data.icalToken).toBeUndefined();
  });
});
