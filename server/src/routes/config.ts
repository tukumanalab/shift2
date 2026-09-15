import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /api/config
 * フロントエンドに必要な公開設定を返す
 */
router.get('/', (req: Request, res: Response) => {
  try {
    // 注意: ICAL_TOKEN はここで返さない。
    // このエンドポイントはログイン前の全ブラウザから取得できるため、
    // 共通トークンを返すと全員分のシフトを誰でも購読できてしまう。
    // 購読URLは GET /api/ical/my-url でユーザーごとに発行する。
    const config = {
      googleClientId: process.env.GOOGLE_CLIENT_ID || '',
      authorizedEmails: process.env.AUTHORIZED_EMAILS || '',
    };

    // 必須設定のバリデーション
    if (!config.googleClientId) {
      console.warn('Warning: GOOGLE_CLIENT_ID is not set');
    }

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました',
    });
  }
});

export default router;
