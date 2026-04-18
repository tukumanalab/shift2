import express from 'express';
import { SpecialShiftModel } from '../models/SpecialShift';
import { SpecialShiftApplicationModel } from '../models/SpecialShiftApplication';

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
 * GET /api/special-shifts/applications
 * 全申請を日付情報付きで取得（シフト一覧表示用）
 * クエリパラメータ:
 *   - userId: 特定ユーザーの申請のみ取得
 */
router.get('/applications', (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    const applications = SpecialShiftApplicationModel.getAllWithShiftInfo(userId);
    res.json({ success: true, data: applications });
  } catch (error) {
    console.error('Error getting all special shift applications:', error);
    res.status(500).json({ success: false, error: 'サーバーエラーが発生しました' });
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

    // 特別シフトはカレンダーに同期しない

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
router.delete('/:uuid', (req, res) => {
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

    // 特別シフトはカレンダーに同期しないため、直接削除
    const success = SpecialShiftModel.delete(uuid);

    if (!success) {
      return res.status(500).json({
        success: false,
        error: '特別シフトの削除に失敗しました'
      });
    }

    res.json({
      success: true,
      message: '特別シフトを削除しました'
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
router.post('/delete-multiple', (req, res) => {
  try {
    const { uuids } = req.body;

    if (!Array.isArray(uuids) || uuids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'UUIDの配列が必要です'
      });
    }

    // 特別シフトはカレンダーに同期しないため、直接削除
    const result = SpecialShiftModel.deleteMultiple(uuids);

    res.json({
      success: true,
      data: result,
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

/**
 * POST /api/special-shifts/:uuid/apply
 * 特別シフトに申請する
 */
router.post('/:uuid/apply', (req, res) => {
  try {
    const specialShiftUuid = req.params.uuid as string;
    const { user_id, user_name, time_slot } = req.body;

    // バリデーション
    if (!user_id || !user_name || !time_slot) {
      return res.status(400).json({
        success: false,
        error: '必須フィールドが不足しています'
      });
    }

    // 特別シフトの存在確認
    const shift = SpecialShiftModel.getByUuid(specialShiftUuid);
    if (!shift) {
      return res.status(404).json({
        success: false,
        error: '特別シフトが見つかりません'
      });
    }

    // 重複申請チェック（同一スロットへの重複申請を防ぐ）
    const isDuplicate = SpecialShiftApplicationModel.checkDuplicate(user_id, specialShiftUuid, time_slot);
    if (isDuplicate) {
      return res.status(409).json({
        success: false,
        error: 'duplicate'
      });
    }

    // 申請を作成
    const application = SpecialShiftApplicationModel.create({
      special_shift_uuid: specialShiftUuid,
      user_id,
      user_name,
      time_slot
    });

    if (!application) {
      return res.status(500).json({
        success: false,
        error: '申請の作成に失敗しました'
      });
    }

    res.status(201).json({
      success: true,
      data: application
    });
  } catch (error) {
    console.error('Error applying for special shift:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * GET /api/special-shifts/:uuid/applications
 * 特別シフトへの申請一覧を取得
 */
router.get('/:uuid/applications', (req, res) => {
  try {
    const specialShiftUuid = req.params.uuid as string;

    // 特別シフトの存在確認
    const shift = SpecialShiftModel.getByUuid(specialShiftUuid);
    if (!shift) {
      return res.status(404).json({
        success: false,
        error: '特別シフトが見つかりません'
      });
    }

    const applications = SpecialShiftApplicationModel.getBySpecialShiftUuid(specialShiftUuid);

    res.json({
      success: true,
      data: applications
    });
  } catch (error) {
    console.error('Error getting special shift applications:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * DELETE /api/special-shifts/applications/:appUuid
 * 特別シフト申請をキャンセル
 */
router.delete('/applications/:appUuid', (req, res) => {
  try {
    const appUuid = req.params.appUuid as string;

    // 申請の存在確認
    const application = SpecialShiftApplicationModel.getByUuid(appUuid);
    if (!application) {
      return res.status(404).json({
        success: false,
        error: '申請が見つかりません'
      });
    }

    const success = SpecialShiftApplicationModel.delete(appUuid);
    if (!success) {
      return res.status(500).json({
        success: false,
        error: '申請の削除に失敗しました'
      });
    }

    res.json({
      success: true,
      message: '申請をキャンセルしました'
    });
  } catch (error) {
    console.error('Error cancelling special shift application:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

export default router;
