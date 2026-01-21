import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /api/config
 * フロントエンドに必要な公開設定を返す
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const config = {
      googleClientId: process.env.GOOGLE_CLIENT_ID || '',
      authorizedEmails: process.env.AUTHORIZED_EMAILS || '',
      googleAppsScriptUrl: process.env.GOOGLE_APPS_SCRIPT_URL || '',
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
