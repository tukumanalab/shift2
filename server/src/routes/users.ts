import { Router, Request, Response } from 'express';
import { UserModel } from '../models/User';

const router = Router();

/**
 * POST /api/users
 * ユーザーを作成または取得（Google OAuth後に呼ばれる）
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const { sub, name, email, picture } = req.body;

    if (!sub || !name || !email) {
      return res.status(400).json({
        success: false,
        error: 'sub, name, emailは必須です'
      });
    }

    const user = UserModel.createOrGet({ sub, name, email, picture });

    if (!user) {
      return res.status(500).json({
        success: false,
        error: 'ユーザーの作成に失敗しました'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('ユーザー作成エラー:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * GET /api/users/:userId/profile
 * ユーザープロフィールを取得
 */
router.get('/:userId/profile', (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;

    const profile = UserModel.getProfile(userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'ユーザーが見つかりません'
      });
    }

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('プロフィール取得エラー:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * PUT /api/users/:userId/profile
 * ユーザープロフィールを更新
 */
router.put('/:userId/profile', (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const { nickname, realName } = req.body;

    const success = UserModel.updateProfile(userId, nickname || '', realName || '');

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'ユーザーが見つかりません'
      });
    }

    res.json({
      success: true,
      message: 'プロフィールを更新しました'
    });
  } catch (error) {
    console.error('プロフィール更新エラー:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * GET /api/users
 * すべてのユーザーを取得
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const users = UserModel.getAll();

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('ユーザー一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * GET /api/users/:userId
 * 特定のユーザーを取得
 */
router.get('/:userId', (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;

    const user = UserModel.getByUserId(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'ユーザーが見つかりません'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('ユーザー取得エラー:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * DELETE /api/users/:userId
 * ユーザーを削除
 */
router.delete('/:userId', (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;

    const success = UserModel.delete(userId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'ユーザーが見つかりません'
      });
    }

    res.json({
      success: true,
      message: 'ユーザーを削除しました'
    });
  } catch (error) {
    console.error('ユーザー削除エラー:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

export default router;
