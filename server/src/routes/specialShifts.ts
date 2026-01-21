import express from 'express';
import { SpecialShiftModel } from '../models/SpecialShift';
import { CalendarService } from '../services/CalendarService';

const router = express.Router();

/**
 * GET /api/special-shifts
 * すべての特別シフトを取得
 * クエリパラメータ:
 *   - date: 特定の日付の特別シフトを取得
 *   - startDate, endDate: 日付範囲で取得
 */
router.get('/', (req, res) => {
  try {
    const { date, startDate, endDate } = req.query;

    let shifts;
    if (date && typeof date === 'string') {
      shifts = SpecialShiftModel.getByDate(date);
    } else if (startDate && endDate && typeof startDate === 'string' && typeof endDate === 'string') {
      shifts = SpecialShiftModel.getByDateRange(startDate, endDate);
    } else {
      shifts = SpecialShiftModel.getAll();
    }

    res.json({
      success: true,
      data: shifts
    });
  } catch (error) {
    console.error('Error getting special shifts:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * GET /api/special-shifts/:uuid
 * UUIDで特別シフトを取得
 */
router.get('/:uuid', (req, res) => {
  try {
    const uuid = req.params.uuid as string;
    const shift = SpecialShiftModel.getByUuid(uuid);

    if (!shift) {
      return res.status(404).json({
        success: false,
        error: '特別シフトが見つかりません'
      });
    }

    res.json({
      success: true,
      data: shift
    });
  } catch (error) {
    console.error('Error getting special shift:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * POST /api/special-shifts
 * 新しい特別シフトを作成
 */
router.post('/', (req, res) => {
  try {
    const { date, start_time, end_time, user_id, user_name } = req.body;

    // バリデーション
    if (!date || !start_time || !end_time || !user_id || !user_name) {
      return res.status(400).json({
        success: false,
        error: '必須フィールドが不足しています'
      });
    }

    const shift = SpecialShiftModel.create({
      date,
      start_time,
      end_time,
      user_id,
      user_name
    });

    if (!shift) {
      return res.status(500).json({
        success: false,
        error: '特別シフトの作成に失敗しました'
      });
    }

    // カレンダーに同期（バックグラウンド）
    if (shift.uuid) {
      CalendarService.addShiftToCalendar({
        uuid: shift.uuid,
        user_id,
        date,
        time_slot: `${start_time}-${end_time}`,
        type: 'special_shift'
      }).catch(error => {
        console.error('カレンダー同期エラー:', error);
      });
    }

    res.status(201).json({
      success: true,
      data: shift
    });
  } catch (error) {
    console.error('Error creating special shift:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * DELETE /api/special-shifts/:uuid
 * UUIDで特別シフトを削除
 */
router.delete('/:uuid', async (req, res) => {
  try {
    const uuid = req.params.uuid as string;

    // 特別シフトが存在するか確認
    const shift = SpecialShiftModel.getByUuid(uuid);
    if (!shift) {
      return res.status(404).json({
        success: false,
        error: '特別シフトが見つかりません'
      });
    }

    // 先にカレンダーから削除（データベースのCASCADE削除前に実行）
    const calendarResult = await CalendarService.deleteShiftFromCalendar(uuid, 'special_shift');

    // その後データベースから削除
    const success = SpecialShiftModel.delete(uuid);

    if (!success) {
      return res.status(500).json({
        success: false,
        error: '特別シフトの削除に失敗しました'
      });
    }

    res.json({
      success: true,
      message: '特別シフトを削除しました',
      calendarSync: calendarResult.success ? 'success' : 'failed',
      calendarError: calendarResult.error
    });
  } catch (error) {
    console.error('Error deleting special shift:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * POST /api/special-shifts/delete-multiple
 * 複数のUUIDで特別シフトを削除
 */
router.post('/delete-multiple', async (req, res) => {
  try {
    const { uuids } = req.body;

    if (!Array.isArray(uuids) || uuids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'UUIDの配列が必要です'
      });
    }

    // 先にカレンダーから削除（データベースのCASCADE削除前に実行）
    let calendarSyncSuccess = 0;
    let calendarSyncFailed = 0;
    for (const uuid of uuids) {
      const calendarResult = await CalendarService.deleteShiftFromCalendar(uuid, 'special_shift');
      if (calendarResult.success) {
        calendarSyncSuccess++;
      } else {
        calendarSyncFailed++;
        console.error('カレンダー削除エラー:', calendarResult.error);
      }
    }

    // その後データベースから削除
    const result = SpecialShiftModel.deleteMultiple(uuids);

    res.json({
      success: true,
      data: result,
      calendarSync: {
        success: calendarSyncSuccess,
        failed: calendarSyncFailed
      },
      message: `${result.deleted}件の特別シフトを削除しました`
    });
  } catch (error) {
    console.error('Error deleting multiple special shifts:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

export default router;
