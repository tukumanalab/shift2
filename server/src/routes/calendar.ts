import { Router, Request, Response } from 'express';
import { CalendarService } from '../services/CalendarService';

const router = Router();

/**
 * POST /api/calendar/sync
 * 全シフトをGoogleカレンダーに同期
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const result = await CalendarService.syncAllShifts();

    if (result.success) {
      res.json({
        success: true,
        data: {
          total: result.total,
          created: result.created,
          failed: result.failed,
          errors: result.errors,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: '同期に失敗しました',
        details: result.errors,
      });
    }
  } catch (error: any) {
    console.error('カレンダー同期エラー:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました',
      details: error.message,
    });
  }
});

/**
 * POST /api/calendar/sync-shift
 * 個別シフトをGoogleカレンダーに追加
 */
router.post('/sync-shift', async (req: Request, res: Response) => {
  try {
    const { uuid, user_id, date, time_slot, type } = req.body;

    if (!uuid || !user_id || !date || !time_slot || !type) {
      return res.status(400).json({
        success: false,
        error: 'uuid, user_id, date, time_slot, typeは必須です',
      });
    }

    if (type !== 'shift' && type !== 'special_shift') {
      return res.status(400).json({
        success: false,
        error: 'typeは "shift" または "special_shift" である必要があります',
      });
    }

    const result = await CalendarService.addShiftToCalendar({
      uuid,
      user_id,
      date,
      time_slot,
      type,
    });

    if (result.success) {
      res.json({
        success: true,
        message: 'シフトをカレンダーに追加しました',
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'シフトの追加に失敗しました',
      });
    }
  } catch (error: any) {
    console.error('シフト追加エラー:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました',
      details: error.message,
    });
  }
});

/**
 * DELETE /api/calendar/sync-shift/:shiftUuid
 * 個別シフトをGoogleカレンダーから削除
 */
router.delete('/sync-shift/:shiftUuid', async (req: Request, res: Response) => {
  try {
    const shiftUuid = req.params.shiftUuid as string;
    const typeParam = req.query.type;
    const type = typeof typeParam === 'string' ? typeParam : undefined;

    if (!type || (type !== 'shift' && type !== 'special_shift')) {
      return res.status(400).json({
        success: false,
        error: 'typeクエリパラメータは "shift" または "special_shift" である必要があります',
      });
    }

    const result = await CalendarService.deleteShiftFromCalendar(
      shiftUuid,
      type
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'シフトをカレンダーから削除しました',
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error || 'シフトの削除に失敗しました',
      });
    }
  } catch (error: any) {
    console.error('シフト削除エラー:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました',
      details: error.message,
    });
  }
});

/**
 * GET /api/calendar/sync-status
 * 同期ステータスを取得
 */
router.get('/sync-status', (req: Request, res: Response) => {
  try {
    const status = CalendarService.getSyncStatus();

    res.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    console.error('同期ステータス取得エラー:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました',
      details: error.message,
    });
  }
});

export default router;
