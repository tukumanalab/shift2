import request from 'supertest';
import express, { Express } from 'express';
import usersRouter from '../../routes/users';
import { UserModel } from '../../models/User';

// Mock UserModel
jest.mock('../../models/User');
jest.mock('../../database/db', () => ({
  default: {
    prepare: jest.fn().mockReturnValue({
      all: jest.fn().mockReturnValue([]),
      run: jest.fn()
    })
  }
}));

describe('Users API Routes', () => {
  let app: Express;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Suppress console output during tests
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    // Setup Express app with users router
    app = express();
    app.use(express.json());
    app.use('/api/users', usersRouter);
  });

  afterEach(() => {
    // Restore console methods
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('POST /api/users', () => {
    test('正常にユーザーを作成', async () => {
      const mockUser = {
        id: 1,
        user_id: 'google_123',
        name: 'テストユーザー',
        email: 'test@example.com',
        picture: 'https://example.com/photo.jpg',
        created_at: '2026-01-26T00:00:00Z',
        updated_at: '2026-01-26T00:00:00Z'
      };

      (UserModel.createOrGet as jest.Mock).mockReturnValue(mockUser);

      const response = await request(app)
        .post('/api/users')
        .send({
          sub: 'google_123',
          name: 'テストユーザー',
          email: 'test@example.com',
          picture: 'https://example.com/photo.jpg'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUser);
      expect(UserModel.createOrGet).toHaveBeenCalledWith({
        sub: 'google_123',
        name: 'テストユーザー',
        email: 'test@example.com',
        picture: 'https://example.com/photo.jpg'
      });
    });

    test('既存ユーザーを返す', async () => {
      const existingUser = {
        id: 1,
        user_id: 'google_123',
        name: 'テストユーザー',
        email: 'test@example.com',
        created_at: '2026-01-20T00:00:00Z',
        updated_at: '2026-01-20T00:00:00Z'
      };

      (UserModel.createOrGet as jest.Mock).mockReturnValue(existingUser);

      const response = await request(app)
        .post('/api/users')
        .send({
          sub: 'google_123',
          name: 'テストユーザー',
          email: 'test@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(existingUser);
    });

    test('subがない場合は400エラー', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({
          name: 'テストユーザー',
          email: 'test@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('sub, name, emailは必須です');
      expect(UserModel.createOrGet).not.toHaveBeenCalled();
    });

    test('nameがない場合は400エラー', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({
          sub: 'google_123',
          email: 'test@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('sub, name, emailは必須です');
    });

    test('emailがない場合は400エラー', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({
          sub: 'google_123',
          name: 'テストユーザー'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('sub, name, emailは必須です');
    });

    test('ユーザー作成失敗時は500エラー', async () => {
      (UserModel.createOrGet as jest.Mock).mockReturnValue(null);

      const response = await request(app)
        .post('/api/users')
        .send({
          sub: 'google_123',
          name: 'テストユーザー',
          email: 'test@example.com'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('ユーザーの作成に失敗しました');
    });

    test('内部エラー時は500エラー', async () => {
      (UserModel.createOrGet as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .post('/api/users')
        .send({
          sub: 'google_123',
          name: 'テストユーザー',
          email: 'test@example.com'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('サーバーエラーが発生しました');
    });
  });

  describe('GET /api/users/:userId/profile', () => {
    test('正常にプロフィールを取得', async () => {
      const mockProfile = {
        nickname: 'やまちゃん',
        real_name: '山田太郎'
      };

      (UserModel.getProfile as jest.Mock).mockReturnValue(mockProfile);

      const response = await request(app)
        .get('/api/users/google_123/profile');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockProfile);
      expect(UserModel.getProfile).toHaveBeenCalledWith('google_123');
    });

    test('ユーザーが存在しない場合は404エラー', async () => {
      (UserModel.getProfile as jest.Mock).mockReturnValue(null);

      const response = await request(app)
        .get('/api/users/nonexistent/profile');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('ユーザーが見つかりません');
    });

    test('内部エラー時は500エラー', async () => {
      (UserModel.getProfile as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .get('/api/users/google_123/profile');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('サーバーエラーが発生しました');
    });
  });

  describe('PUT /api/users/:userId/profile', () => {
    test('正常にプロフィールを更新', async () => {
      (UserModel.getByUserId as jest.Mock).mockReturnValue({ user_id: 'google_123' });
      (UserModel.updateProfile as jest.Mock).mockReturnValue(true);

      const response = await request(app)
        .put('/api/users/google_123/profile')
        .send({
          nickname: 'やまちゃん',
          realName: '山田太郎'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('プロフィールを更新しました');
      expect(UserModel.updateProfile).toHaveBeenCalledWith(
        'google_123',
        'やまちゃん',
        '山田太郎'
      );
    });

    test('nicknameのみ更新', async () => {
      (UserModel.getByUserId as jest.Mock).mockReturnValue({ user_id: 'google_123' });
      (UserModel.updateProfile as jest.Mock).mockReturnValue(true);

      const response = await request(app)
        .put('/api/users/google_123/profile')
        .send({
          nickname: 'やまちゃん'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(UserModel.updateProfile).toHaveBeenCalledWith(
        'google_123',
        'やまちゃん',
        ''
      );
    });

    test('realNameのみ更新', async () => {
      (UserModel.getByUserId as jest.Mock).mockReturnValue({ user_id: 'google_123' });
      (UserModel.updateProfile as jest.Mock).mockReturnValue(true);

      const response = await request(app)
        .put('/api/users/google_123/profile')
        .send({
          realName: '山田太郎'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(UserModel.updateProfile).toHaveBeenCalledWith(
        'google_123',
        '',
        '山田太郎'
      );
    });

    test('ユーザーが存在しない場合は自動作成してプロフィールを更新', async () => {
      (UserModel.getByUserId as jest.Mock).mockReturnValue(null);
      (UserModel.createOrGet as jest.Mock).mockReturnValue({ user_id: 'nonexistent' });
      (UserModel.updateProfile as jest.Mock).mockReturnValue(true);

      const response = await request(app)
        .put('/api/users/nonexistent/profile')
        .send({
          nickname: 'やまちゃん',
          realName: '山田太郎'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(UserModel.createOrGet).toHaveBeenCalledWith({
        sub: 'nonexistent',
        name: 'やまちゃん',
        email: ''
      });
    });

    test('内部エラー時は500エラー', async () => {
      (UserModel.updateProfile as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .put('/api/users/google_123/profile')
        .send({
          nickname: 'やまちゃん',
          realName: '山田太郎'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('サーバーエラーが発生しました');
    });
  });

  describe('GET /api/users', () => {
    test('正常にすべてのユーザーを取得', async () => {
      const mockUsers = [
        {
          id: 1,
          user_id: 'google_123',
          name: 'ユーザー1',
          email: 'user1@example.com',
          created_at: '2026-01-25T00:00:00Z',
          updated_at: '2026-01-25T00:00:00Z'
        },
        {
          id: 2,
          user_id: 'google_456',
          name: 'ユーザー2',
          email: 'user2@example.com',
          created_at: '2026-01-24T00:00:00Z',
          updated_at: '2026-01-24T00:00:00Z'
        }
      ];

      (UserModel.getAll as jest.Mock).mockReturnValue(mockUsers);

      const response = await request(app)
        .get('/api/users');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUsers);
      expect(UserModel.getAll).toHaveBeenCalled();
    });

    test('ユーザーが存在しない場合は空配列を返す', async () => {
      (UserModel.getAll as jest.Mock).mockReturnValue([]);

      const response = await request(app)
        .get('/api/users');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    test('内部エラー時は500エラー', async () => {
      (UserModel.getAll as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .get('/api/users');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('サーバーエラーが発生しました');
    });
  });

  describe('GET /api/users/:userId', () => {
    test('正常に特定のユーザーを取得', async () => {
      const mockUser = {
        id: 1,
        user_id: 'google_123',
        name: 'テストユーザー',
        email: 'test@example.com',
        picture: 'https://example.com/photo.jpg',
        nickname: 'やまちゃん',
        real_name: '山田太郎',
        created_at: '2026-01-26T00:00:00Z',
        updated_at: '2026-01-26T00:00:00Z'
      };

      (UserModel.getByUserId as jest.Mock).mockReturnValue(mockUser);

      const response = await request(app)
        .get('/api/users/google_123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUser);
      expect(UserModel.getByUserId).toHaveBeenCalledWith('google_123');
    });

    test('ユーザーが存在しない場合は404エラー', async () => {
      (UserModel.getByUserId as jest.Mock).mockReturnValue(null);

      const response = await request(app)
        .get('/api/users/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('ユーザーが見つかりません');
    });

    test('内部エラー時は500エラー', async () => {
      (UserModel.getByUserId as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .get('/api/users/google_123');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('サーバーエラーが発生しました');
    });
  });

  describe('DELETE /api/users/:userId', () => {
    test('正常にユーザーを削除', async () => {
      (UserModel.delete as jest.Mock).mockReturnValue(true);

      const response = await request(app)
        .delete('/api/users/google_123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('ユーザーを削除しました');
      expect(UserModel.delete).toHaveBeenCalledWith('google_123');
    });

    test('ユーザーが存在しない場合は404エラー', async () => {
      (UserModel.delete as jest.Mock).mockReturnValue(false);

      const response = await request(app)
        .delete('/api/users/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('ユーザーが見つかりません');
    });

    test('内部エラー時は500エラー', async () => {
      (UserModel.delete as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .delete('/api/users/google_123');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('サーバーエラーが発生しました');
    });
  });
});
