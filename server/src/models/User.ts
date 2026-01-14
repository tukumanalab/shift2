import db from '../database/db';

export interface User {
  id?: number;
  user_id: string;
  name: string;
  email: string;
  picture?: string;
  nickname?: string;
  real_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserProfile {
  nickname: string;
  real_name: string;
}

export class UserModel {
  /**
   * 新しいユーザーを作成または既存ユーザーを返す
   */
  static createOrGet(userData: {
    sub: string;
    name: string;
    email: string;
    picture?: string;
  }): User | null {
    try {
      // 既存ユーザーをチェック
      const existing = this.getByUserId(userData.sub);
      if (existing) {
        return existing;
      }

      // 新しいユーザーを作成
      const stmt = db.prepare(`
        INSERT INTO users (user_id, name, email, picture)
        VALUES (?, ?, ?, ?)
      `);

      const result = stmt.run(
        userData.sub,
        userData.name,
        userData.email,
        userData.picture || null
      );

      // 作成したユーザーを取得
      return this.getById(result.lastInsertRowid as number);
    } catch (error) {
      console.error('ユーザー作成エラー:', error);
      return null;
    }
  }

  /**
   * IDでユーザーを取得
   */
  static getById(id: number): User | null {
    try {
      const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
      return stmt.get(id) as User || null;
    } catch (error) {
      console.error('ユーザー取得エラー:', error);
      return null;
    }
  }

  /**
   * ユーザーIDでユーザーを取得
   */
  static getByUserId(userId: string): User | null {
    try {
      const stmt = db.prepare('SELECT * FROM users WHERE user_id = ?');
      return stmt.get(userId) as User || null;
    } catch (error) {
      console.error('ユーザー取得エラー:', error);
      return null;
    }
  }

  /**
   * メールアドレスでユーザーを取得
   */
  static getByEmail(email: string): User | null {
    try {
      const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
      return stmt.get(email) as User || null;
    } catch (error) {
      console.error('ユーザー取得エラー:', error);
      return null;
    }
  }

  /**
   * ユーザープロフィールを取得
   */
  static getProfile(userId: string): UserProfile | null {
    try {
      const user = this.getByUserId(userId);
      if (!user) {
        return null;
      }

      return {
        nickname: user.nickname || '',
        real_name: user.real_name || ''
      };
    } catch (error) {
      console.error('プロフィール取得エラー:', error);
      return null;
    }
  }

  /**
   * ユーザープロフィールを更新
   */
  static updateProfile(
    userId: string,
    nickname: string,
    realName: string
  ): boolean {
    try {
      const stmt = db.prepare(`
        UPDATE users
        SET nickname = ?, real_name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `);

      const result = stmt.run(nickname, realName, userId);
      return result.changes > 0;
    } catch (error) {
      console.error('プロフィール更新エラー:', error);
      return false;
    }
  }

  /**
   * すべてのユーザーを取得
   */
  static getAll(): User[] {
    try {
      const stmt = db.prepare('SELECT * FROM users ORDER BY created_at DESC');
      return stmt.all() as User[];
    } catch (error) {
      console.error('全ユーザー取得エラー:', error);
      return [];
    }
  }

  /**
   * ユーザーを削除
   */
  static delete(userId: string): boolean {
    try {
      const stmt = db.prepare('DELETE FROM users WHERE user_id = ?');
      const result = stmt.run(userId);
      return result.changes > 0;
    } catch (error) {
      console.error('ユーザー削除エラー:', error);
      return false;
    }
  }
}
