import express from 'express';
import { CapacitySettingModel } from '../models/CapacitySetting';

const router = express.Router();

/**
 * GET /api/capacity-settings
 * すべての人数設定を取得
 * クエリパラメータ:
 *   - date: 特定の日付の人数設定を取得
 *   - startDate, endDate: 日付範囲で取得
 */
router.get('/', (req, res) => {
  try {
    const { date, startDate, endDate } = req.query;

    let settings;
    if (date && typeof date === 'string') {
      const setting = CapacitySettingModel.getByDate(date);
      settings = setting ? [setting] : [];
    } else if (startDate && endDate && typeof startDate === 'string' && typeof endDate === 'string') {
      settings = CapacitySettingModel.getByDateRange(startDate, endDate);
    } else {
      settings = CapacitySettingModel.getAll();
    }

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error getting capacity settings:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * GET /api/capacity-settings/:date
 * 特定の日付の人数設定を取得
 */
router.get('/:date', (req, res) => {
  try {
    const date = req.params.date as string;
    const setting = CapacitySettingModel.getByDate(date);

    if (!setting) {
      return res.status(404).json({
        success: false,
        error: '指定された日付の人数設定が見つかりません'
      });
    }

    res.json({
      success: true,
      data: setting
    });
  } catch (error) {
    console.error('Error getting capacity setting:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * POST /api/capacity-settings
 * 人数設定を作成または更新（UPSERT）
 */
router.post('/', (req, res) => {
  try {
    const { date, capacity, memo, user_id, user_name } = req.body;

    // バリデーション
    if (!date || capacity === undefined) {
      return res.status(400).json({
        success: false,
        error: '日付と人数は必須です'
      });
    }

    const setting = CapacitySettingModel.upsert({
      date,
      capacity,
      memo,
      user_id,
      user_name
    });

    if (!setting) {
      return res.status(500).json({
        success: false,
        error: '人数設定の保存に失敗しました'
      });
    }

    res.status(200).json({
      success: true,
      data: setting
    });
  } catch (error) {
    console.error('Error creating/updating capacity setting:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * POST /api/capacity-settings/bulk
 * 複数の人数設定を一括作成または更新
 */
router.post('/bulk', (req, res) => {
  try {
    const { settings } = req.body;

    if (!Array.isArray(settings) || settings.length === 0) {
      return res.status(400).json({
        success: false,
        error: '人数設定の配列が必要です'
      });
    }

    const result = CapacitySettingModel.bulkUpsert(settings);

    res.json({
      success: true,
      data: result,
      message: `${result.success}件の人数設定を保存しました`
    });
  } catch (error) {
    console.error('Error bulk upserting capacity settings:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * PUT /api/capacity-settings/:date
 * 人数設定を更新
 */
router.put('/:date', (req, res) => {
  try {
    const date = req.params.date as string;
    const { capacity, memo, user_id, user_name } = req.body;

    // バリデーション
    if (capacity === undefined) {
      return res.status(400).json({
        success: false,
        error: '人数は必須です'
      });
    }

    const setting = CapacitySettingModel.update(date, {
      capacity,
      memo,
      user_id,
      user_name
    });

    if (!setting) {
      return res.status(404).json({
        success: false,
        error: '指定された日付の人数設定が見つかりません'
      });
    }

    res.json({
      success: true,
      data: setting
    });
  } catch (error) {
    console.error('Error updating capacity setting:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * DELETE /api/capacity-settings/:date
 * 人数設定を削除
 */
router.delete('/:date', (req, res) => {
  try {
    const date = req.params.date as string;
    const success = CapacitySettingModel.delete(date);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: '指定された日付の人数設定が見つからないか、削除に失敗しました'
      });
    }

    res.json({
      success: true,
      message: '人数設定を削除しました'
    });
  } catch (error) {
    console.error('Error deleting capacity setting:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

export default router;
