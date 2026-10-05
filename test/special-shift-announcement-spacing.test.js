/**
 * お知らせ欄の特別シフト表示: 日付と時間帯の間隔
 *
 * 回帰防止: 日付と時間帯を全角スペースで区切っていたため、
 *          「2026-10-08　12:30-15:30」のように間が空きすぎて見えていた。
 *          半角スペース 1 つで区切る。
 *
 * このテストは実コード（js/modules/specialShifts.js）を直接 import して検証する。
 * 方針: docs/refactoring/phase-1-test-foundation.md
 */

const { formatSpecialShiftSchedule } = require('../js/modules/specialShifts.js');

describe('お知らせ欄の特別シフトの日時表示', () => {
  const shift = { date: '2026-10-08', start_time: '12:30', end_time: '15:30' };

  test('日付と時間帯を半角スペース 1 つで区切る', () => {
    expect(formatSpecialShiftSchedule(shift)).toBe('2026-10-08 12:30-15:30');
  });

  test('全角スペースを含まない', () => {
    expect(formatSpecialShiftSchedule(shift)).not.toContain('　');
  });
});
