/**
 * カレンダーの人物ごとのシフトマージのテスト
 *
 * 回帰防止: 表示名が同じ別ユーザーが、カレンダー上で 1 人にまとめられていた。
 *          人物を区別するキーに使っていた userEmail / email はシフトデータに
 *          含まれておらず、実質的に表示名だけで区別していたため。
 *          同じ時間帯に入っていると、片方のチェックボックスに両方の UUID が入り、
 *          1 人分を削除したつもりでもう 1 人のシフトまで削除されていた。
 *
 * このテストは実コード（js/modules/calendar.js）を直接 import して検証する。
 * 方針: docs/refactoring/phase-1-test-foundation.md
 */

const { getShiftDisplayName, mergeConsecutiveTimeSlots } = require('../js/modules/utils.js');
const { mergeShiftsByPerson } = require('../js/modules/calendar.js');

function shift(userId, userName, timeSlot, uuid, isSpecial = false) {
  return { shiftDate: '2026-10-08', userId, userName, timeSlot, uuid, isSpecial };
}

describe('mergeShiftsByPerson: 表示名が同じ別ユーザー', () => {
  beforeEach(() => {
    global.getShiftDisplayName = getShiftDisplayName;
    global.mergeConsecutiveTimeSlots = mergeConsecutiveTimeSlots;
  });

  afterEach(() => {
    delete global.getShiftDisplayName;
    delete global.mergeConsecutiveTimeSlots;
  });

  test('同じ時間帯に入っていても、ユーザーごとに別のエントリになる', () => {
    const result = mergeShiftsByPerson([
      shift('user-1', '田中', '13:00-13:30', 'uuid-1'),
      shift('user-2', '田中', '13:00-13:30', 'uuid-2')
    ]);

    expect(result).toHaveLength(2);
    expect(result.find(s => s.userId === 'user-1').uuids).toEqual(['uuid-1']);
    expect(result.find(s => s.userId === 'user-2').uuids).toEqual(['uuid-2']);
  });

  test('連続する時間帯でも、別ユーザーのシフトは 1 つにまとめない', () => {
    const result = mergeShiftsByPerson([
      shift('user-1', '田中', '13:00-13:30', 'uuid-1'),
      shift('user-2', '田中', '13:30-14:00', 'uuid-2')
    ]);

    expect(result.map(s => s.timeSlot).sort()).toEqual(['13:00-13:30', '13:30-14:00']);
    expect(result.find(s => s.userId === 'user-1').uuids).toEqual(['uuid-1']);
    expect(result.find(s => s.userId === 'user-2').uuids).toEqual(['uuid-2']);
  });

  test('同じユーザーの連続する時間帯は、これまでどおり 1 つにまとめる', () => {
    const result = mergeShiftsByPerson([
      shift('user-1', '田中', '13:00-13:30', 'uuid-1'),
      shift('user-1', '田中', '13:30-14:00', 'uuid-2')
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].timeSlot).toBe('13:00-14:00');
    expect(result[0].uuids).toEqual(['uuid-1', 'uuid-2']);
  });

  test('同じユーザーの通常シフトと特別シフトは、これまでどおり別のエントリになる', () => {
    const result = mergeShiftsByPerson([
      shift('user-1', '田中', '13:00-13:30', 'uuid-r'),
      shift('user-1', '田中', '13:30-14:00', 'uuid-s', true)
    ]);

    expect(result).toHaveLength(2);
  });
});
