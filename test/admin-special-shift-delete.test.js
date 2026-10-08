/**
 * 管理者画面からの特別シフト申請の削除テスト
 *
 * 回帰防止: 管理者のシフト一覧カレンダーで特別シフトにチェックを入れて
 *          「選択したシフトを削除」しても削除されなかった。
 *          特別シフト申請の UUID を通常シフト用の削除 API
 *          (POST /api/shifts/delete-multiple) に送っていたため、
 *          0 件削除のまま「削除しました」と表示されていた。
 *
 * このテストは実コード（js/modules/shifts.js）を直接 import して検証する。
 * 方針: docs/refactoring/phase-1-test-foundation.md
 */

const { collectUuidsByType, deleteShiftsByType } = require('../js/modules/shifts.js');

function checkbox(uuids, type) {
  const attrs = { 'data-uuids': uuids, 'data-type': type };
  return { getAttribute: name => (name in attrs ? attrs[name] : null) };
}

describe('collectUuidsByType', () => {
  test('特別シフトと通常シフトの UUID を振り分ける', () => {
    const result = collectUuidsByType([
      checkbox('r1,r2', 'regular'),
      checkbox('s1,s2', 'special'),
      checkbox('r3', 'regular')
    ]);

    expect(result.regularUuids).toEqual(['r1', 'r2', 'r3']);
    expect(result.specialUuids).toEqual(['s1', 's2']);
  });

  test('data-type がない場合は通常シフトとして扱う', () => {
    const result = collectUuidsByType([checkbox('r1', null)]);

    expect(result.regularUuids).toEqual(['r1']);
    expect(result.specialUuids).toEqual([]);
  });

  test('空の UUID は無視する', () => {
    const result = collectUuidsByType([checkbox('', 'special'), checkbox('s1,', 'special')]);

    expect(result.specialUuids).toEqual(['s1']);
  });
});

describe('deleteShiftsByType', () => {
  beforeEach(() => {
    global.API = {
      deleteMultipleShifts: jest.fn().mockResolvedValue({ success: true }),
      cancelSpecialShiftApplication: jest.fn().mockResolvedValue({ success: true })
    };
  });

  afterEach(() => {
    delete global.API;
  });

  test('特別シフト申請は特別シフト用の API でキャンセルする', async () => {
    const result = await deleteShiftsByType([], ['s1', 's2']);

    expect(API.cancelSpecialShiftApplication).toHaveBeenCalledTimes(2);
    expect(API.cancelSpecialShiftApplication).toHaveBeenCalledWith('s1');
    expect(API.cancelSpecialShiftApplication).toHaveBeenCalledWith('s2');
    expect(API.deleteMultipleShifts).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  test('通常シフトと特別シフトが混在していても、それぞれの API に送る', async () => {
    const result = await deleteShiftsByType(['r1', 'r2'], ['s1']);

    expect(API.deleteMultipleShifts).toHaveBeenCalledWith(['r1', 'r2']);
    expect(API.cancelSpecialShiftApplication).toHaveBeenCalledWith('s1');
    expect(result.success).toBe(true);
  });

  test('いずれかが失敗したら失敗として返す', async () => {
    API.cancelSpecialShiftApplication.mockResolvedValue({ success: false, error: '申請が見つかりません' });

    const result = await deleteShiftsByType(['r1'], ['s1']);

    expect(result.success).toBe(false);
    expect(result.error).toBe('申請が見つかりません');
  });
});
