import express from 'express';
import { ShiftModel } from '../models/Shift';
import { CalendarService } from '../services/CalendarService';

const router = express.Router();

/**
 * GET /api/shifts
 * すべてのシフトを取得
 * クエリパラメータ:
 *   - userId: 特定のユーザーのシフトを取得
 *   - date: 特定の日付のシフトを取得
 *   - userId + date: 特定のユーザーの特定の日付のシフトを取得
 *   - startDate, endDate: 日付範囲で取得
 */
router.get('/', (req, res) => {
  try {
    const { userId, date, startDate, endDate } = req.query;

    let shifts;
    if (userId && date && typeof userId === 'string' && typeof date === 'string') {
      // userIdとdateの両方が指定された場合
      shifts = ShiftModel.getByUserIdAndDate(userId, date);
    } else if (userId && typeof userId === 'string') {
      shifts = ShiftModel.getByUserId(userId);
    } else if (date && typeof date === 'string') {
      shifts = ShiftModel.getByDate(date);
    } else if (startDate && endDate && typeof startDate === 'string' && typeof endDate === 'string') {
      shifts = ShiftModel.getByDateRange(startDate, endDate);
    } else {
      shifts = ShiftModel.getAll();
    }

    res.json({
      success: true,
      data: shifts
    });
  } catch (error) {
    console.error('Error getting shifts:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * GET /api/shifts/counts
 * シフト申請数を取得（日付と時間枠ごと）
 * クエリパラメータ:
 *   - date: 特定の日付のカウントのみを取得
 */
router.get('/counts', (req, res) => {
  try {
    const { date } = req.query;

    let counts;
    if (date && typeof date === 'string') {
      const dateCounts = ShiftModel.getShiftCountsByDate(date);
      counts = { [date]: dateCounts };
    } else {
      counts = ShiftModel.getShiftCounts();
    }

    res.json({
      success: true,
      data: counts
    });
  } catch (error) {
    console.error('Error getting shift counts:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * GET /api/shifts/:uuid
 * 特定のシフトを取得
 */
router.get('/:uuid', (req, res) => {
  try {
    const uuid = req.params.uuid as string;
    const shift = ShiftModel.getByUuid(uuid);

    if (!shift) {
      return res.status(404).json({
        success: false,
        error: '指定されたシフトが見つかりません'
      });
    }

    res.json({
      success: true,
      data: shift
    });
  } catch (error) {
    console.error('Error getting shift:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * POST /api/shifts/check-duplicate
 * 重複チェック（単一時間枠）
 */
router.post('/check-duplicate', (req, res) => {
  try {
    const { userId, date, timeSlot } = req.body;

    if (!userId || !date || !timeSlot) {
      return res.status(400).json({
        success: false,
        error: 'userId, date, timeSlotは必須です'
      });
    }

    const isDuplicate = ShiftModel.checkDuplicate(userId, date, timeSlot);

    res.json({
      success: true,
      isDuplicate
    });
  } catch (error) {
    console.error('Error checking duplicate:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * POST /api/shifts/check-multiple-duplicates
 * 複数時間枠の重複チェック
 */
router.post('/check-multiple-duplicates', (req, res) => {
  try {
    const { userId, date, timeSlots } = req.body;

    if (!userId || !date || !Array.isArray(timeSlots)) {
      return res.status(400).json({
        success: false,
        error: 'userId, date, timeSlotsは必須です'
      });
    }

    const duplicates = ShiftModel.checkMultipleDuplicates(userId, date, timeSlots);

    res.json({
      success: true,
      duplicates
    });
  } catch (error) {
    console.error('Error checking multiple duplicates:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * POST /api/shifts
 * シフトを作成
 */
router.post('/', async (req, res) => {
  try {
    const { user_id, user_name, date, time_slot } = req.body;

    // バリデーション
    if (!user_id || !user_name || !date || !time_slot) {
      return res.status(400).json({
        success: false,
        error: '必須フィールドが不足しています'
      });
    }

    // 重複チェック
    if (ShiftModel.checkDuplicate(user_id, date, time_slot)) {
      return res.status(409).json({
        success: false,
        error: 'duplicate',
        message: `${date}の${time_slot}は既に申請済みです。`
      });
    }

    const shift = ShiftModel.create({
      user_id,
      user_name,
      date,
      time_slot
    });

    if (!shift) {
      return res.status(500).json({
        success: false,
        error: 'シフトの作成に失敗しました'
      });
    }

    // カレンダーに同期（同期的に実行）
    let calendarSyncResult = null;
    if (shift.uuid) {
      calendarSyncResult = await CalendarService.addShiftToCalendar({
        uuid: shift.uuid,
        user_id,
        date,
        time_slot,
        type: 'shift'
      });

      if (!calendarSyncResult.success) {
        console.error('カレンダー同期エラー:', calendarSyncResult.error);
      }
    }

    res.status(201).json({
      success: true,
      data: shift,
      calendarSync: calendarSyncResult ? (calendarSyncResult.success ? 'success' : 'failed') : 'skipped',
      calendarError: calendarSyncResult?.error
    });
  } catch (error) {
    console.error('Error creating shift:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * POST /api/shifts/multiple
 * 複数シフトを一括作成
 */
router.post('/multiple', async (req, res) => {
  try {
    const { user_id, user_name, date, time_slots } = req.body;

    // バリデーション
    if (!user_id || !user_name || !date || !Array.isArray(time_slots) || time_slots.length === 0) {
      return res.status(400).json({
        success: false,
        error: '必須フィールドが不足しています'
      });
    }

    // 重複チェック
    const duplicates = ShiftModel.checkMultipleDuplicates(user_id, date, time_slots);
    const nonDuplicateSlots = time_slots.filter(slot => !duplicates[slot]);
    const duplicateSlots = time_slots.filter(slot => duplicates[slot]);

    // 重複していない時間枠のみを作成
    const shifts = nonDuplicateSlots.map(time_slot => ({
      user_id,
      user_name,
      date,
      time_slot
    }));

    const result = ShiftModel.bulkCreate(shifts);

    // カレンダーに同期（同期的に実行）
    // 作成されたシフトの(user_id, date)の組み合わせを収集
    let calendarSyncSuccess = 0;
    let calendarSyncFailed = 0;
    const calendarErrors: string[] = [];

    if (result.created && result.created.length > 0) {
      const affectedUserDates = new Set<string>();
      for (const shift of result.created) {
        affectedUserDates.add(`${shift.user_id}:${shift.date}`);
      }

      // 各(user_id, date)について1回だけ同期
      for (const userDate of affectedUserDates) {
        const [userId, date] = userDate.split(':');
        const syncResult = await CalendarService.syncShiftsForUserAndDate(userId, date);

        if (syncResult.success) {
          calendarSyncSuccess++;
        } else {
          calendarSyncFailed++;
          if (syncResult.error) {
            calendarErrors.push(`${date}: ${syncResult.error}`);
          }
          console.error('カレンダー同期エラー:', syncResult.error);
        }
      }
    }

    res.json({
      success: true,
      processed: nonDuplicateSlots,
      duplicates: duplicateSlots,
      result: {
        success: result.success,
        failed: result.failed,
        duplicates: result.duplicates
      },
      calendarSync: {
        success: calendarSyncSuccess,
        failed: calendarSyncFailed,
        errors: calendarErrors.length > 0 ? calendarErrors : undefined
      },
      message: `${result.success}件のシフトを作成しました`
    });
  } catch (error) {
    console.error('Error creating multiple shifts:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * DELETE /api/shifts/:uuid
 * シフトを削除
 */
router.delete('/:uuid', async (req, res) => {
  try {
    const uuid = req.params.uuid as string;

    // シフトが存在するか確認し、情報を保存
    const shift = ShiftModel.getByUuid(uuid);
    if (!shift) {
      return res.status(404).json({
        success: false,
        error: '指定されたシフトが見つかりません'
      });
    }

    const { user_id, date, calendar_event_id } = shift;

    // データベースから削除
    const success = ShiftModel.delete(uuid);

    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'シフトの削除に失敗しました'
      });
    }

    // 削除したシフトのカレンダーイベントIDがあれば、明示的に削除してから再同期
    // これにより、孤立したイベントが残らないようにする
    if (calendar_event_id) {
      await CalendarService.deleteCalendarEvent(calendar_event_id);
    }

    // 削除後、その日付のシフトを再同期してマージ
    const calendarResult = await CalendarService.syncShiftsForUserAndDate(user_id, date);

    res.json({
      success: true,
      message: 'シフトを削除しました',
      calendarSync: calendarResult.success ? 'success' : 'failed',
      calendarError: calendarResult.error
    });
  } catch (error) {
    console.error('Error deleting shift:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * POST /api/shifts/delete-multiple
 * 複数シフトを一括削除
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

    // 削除前にシフト情報を収集（影響を受けるuser_idとdateの組み合わせ、カレンダーイベントID）
    const affectedUserDates = new Set<string>();
    const calendarEventIdsToDelete = new Set<string>();
    for (const uuid of uuids) {
      const shift = ShiftModel.getByUuid(uuid);
      if (shift) {
        affectedUserDates.add(`${shift.user_id}:${shift.date}`);
        if (shift.calendar_event_id) {
          calendarEventIdsToDelete.add(shift.calendar_event_id);
        }
      }
    }

    // データベースから削除
    const result = ShiftModel.deleteMultiple(uuids);

    // 削除されたシフトのカレンダーイベントを明示的に削除
    for (const eventId of calendarEventIdsToDelete) {
      await CalendarService.deleteCalendarEvent(eventId);
    }

    // 削除後、影響を受けた各(user_id, date)について再同期
    let calendarSyncSuccess = 0;
    let calendarSyncFailed = 0;
    for (const userDate of affectedUserDates) {
      const [userId, date] = userDate.split(':');
      const calendarResult = await CalendarService.syncShiftsForUserAndDate(userId, date);
      if (calendarResult.success) {
        calendarSyncSuccess++;
      } else {
        calendarSyncFailed++;
        console.error('カレンダー同期エラー:', calendarResult.error);
      }
    }

    res.json({
      success: true,
      deletedCount: result.success,
      failedCount: result.failed,
      calendarSync: {
        success: calendarSyncSuccess,
        failed: calendarSyncFailed
      },
      message: `${result.success}件のシフトを削除しました`
    });
  } catch (error) {
    console.error('Error deleting multiple shifts:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

export default router;
