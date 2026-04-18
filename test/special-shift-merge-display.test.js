/**
 * 特別シフト申請の連続スロットをマージして表示するテスト（TDD）
 */

// ============================================================
// displayMyShifts - 特別シフトの連続スロットをマージ
// ============================================================
describe('displayMyShifts - 特別シフトの連続スロットをマージして表示', () => {
  const setupDOM = () => {
    document.body.innerHTML = `<div id="myShiftsContent"></div>`;
  };

  const setupGlobals = () => {
    global.getScrollToShiftAfterLoad = jest.fn(() => null);
    global.setScrollToShiftAfterLoad = jest.fn();
    global.createBulkActionBarHTML   = jest.fn(() => '');
    global.setupMyShiftsCheckboxListeners = jest.fn();
    // 実際の mergeConsecutiveTimeSlots ロジックをインライン実装
    global.mergeConsecutiveTimeSlots = function(timeSlots) {
      if (!timeSlots || timeSlots.length === 0) return [];
      const sorted = [...timeSlots].sort((a, b) => {
        const ta = a.replace(/(\d+):(\d+)-(\d+):(\d+)/, '$1$2');
        const tb = b.replace(/(\d+):(\d+)-(\d+):(\d+)/, '$1$2');
        return parseInt(ta) - parseInt(tb);
      });
      let currentStart = sorted[0].split('-')[0];
      let currentEnd   = sorted[0].split('-')[1];
      const merged = [];
      for (let i = 1; i < sorted.length; i++) {
        const [nextStart, nextEnd] = sorted[i].split('-');
        if (currentEnd === nextStart) {
          currentEnd = nextEnd;
        } else {
          merged.push(`${currentStart}-${currentEnd}`);
          currentStart = nextStart;
          currentEnd   = nextEnd;
        }
      }
      merged.push(`${currentStart}-${currentEnd}`);
      return merged;
    };
  };

  // displayMyShifts のインライン実装（現在の実装）
  // 特別シフトはマージなし（これが変更対象）
  const defineDisplayMyShifts_OLD = () => {
    global.displayMyShifts = function(container, shiftsData) {
      const regularShifts = shiftsData.filter(s => !s.isSpecial);
      const specialShifts  = shiftsData.filter(s =>  s.isSpecial);

      const rows = [];
      // 通常シフトはマージ（省略）
      // 特別シフト: 個別行（マージなし） ← これが問題
      specialShifts.forEach(shift => {
        rows.push({ shiftDate: shift.shiftDate, timeSlot: shift.timeSlot,
                    uuids: [shift.uuid], isSpecial: true });
      });

      let html = '<table><tbody>';
      rows.forEach(row => {
        const badge = row.isSpecial ? '<span class="special-badge">特別</span>' : '';
        html += `<tr data-date="${row.shiftDate}">
          <td class="shift-time">${row.timeSlot}${badge}</td>
        </tr>`;
      });
      html += '</tbody></table>';
      container.innerHTML = html;
    };
  };

  // displayMyShifts の新実装（特別シフトもマージする）
  const defineDisplayMyShifts_NEW = () => {
    global.displayMyShifts = function(container, shiftsData) {
      if (!shiftsData || shiftsData.length === 0) {
        container.innerHTML = '<div class="no-shifts-message"></div>';
        return;
      }

      const regularShiftsData = shiftsData.filter(s => !s.isSpecial);
      const specialShiftsData  = shiftsData.filter(s =>  s.isSpecial);

      const today = new Date(); today.setHours(0,0,0,0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

      const mergedRows = [];

      // 通常シフト: 日付グループ化＆マージ
      const regularByDate = {};
      regularShiftsData.forEach(shift => {
        if (!regularByDate[shift.shiftDate]) {
          regularByDate[shift.shiftDate] = { slots: [], uuidMap: {}, registrationDate: shift.registrationDate };
        }
        regularByDate[shift.shiftDate].slots.push(shift.timeSlot);
        regularByDate[shift.shiftDate].uuidMap[shift.timeSlot] = shift.uuid;
      });
      Object.keys(regularByDate).forEach(date => {
        const { slots, uuidMap, registrationDate } = regularByDate[date];
        mergeConsecutiveTimeSlots(slots).forEach(timeSlot => {
          const uuids = slots.filter(s => {
            const [start] = s.split('-');
            const [rStart, rEnd] = timeSlot.split('-');
            return start >= rStart && start < rEnd;
          }).map(s => uuidMap[s]).filter(Boolean);
          mergedRows.push({ shiftDate: date, timeSlot, uuids, registrationDate, isSpecial: false });
        });
      });

      // 特別シフト: 日付グループ化＆マージ（通常シフトと同じロジック）
      const specialByDate = {};
      specialShiftsData.forEach(shift => {
        if (!specialByDate[shift.shiftDate]) {
          specialByDate[shift.shiftDate] = { slots: [], uuidMap: {}, registrationDate: shift.registrationDate };
        }
        specialByDate[shift.shiftDate].slots.push(shift.timeSlot);
        specialByDate[shift.shiftDate].uuidMap[shift.timeSlot] = shift.uuid;
      });
      Object.keys(specialByDate).forEach(date => {
        const { slots, uuidMap, registrationDate } = specialByDate[date];
        mergeConsecutiveTimeSlots(slots).forEach(timeSlot => {
          const uuids = slots.filter(s => {
            const [start] = s.split('-');
            const [rStart, rEnd] = timeSlot.split('-');
            return start >= rStart && start < rEnd;
          }).map(s => uuidMap[s]).filter(Boolean);
          mergedRows.push({ shiftDate: date, timeSlot, uuids, registrationDate, isSpecial: true });
        });
      });

      mergedRows.sort((a, b) => new Date(a.shiftDate) - new Date(b.shiftDate));

      let html = `${createBulkActionBarHTML()}<table><tbody>`;
      mergedRows.forEach(row => {
        const shiftDate = new Date(row.shiftDate);
        const canDelete = shiftDate >= tomorrow;
        const uuidsStr = (row.uuids || []).join(',');
        const badge = row.isSpecial ? '<span class="special-badge">特別</span>' : '';
        const specialAttr = row.isSpecial ? 'data-type="special"' : 'data-type="regular"';
        const checkboxHTML = canDelete
          ? `<input type="checkbox" class="my-shift-row-checkbox" data-uuids="${uuidsStr}" ${specialAttr}>`
          : `<input type="checkbox" disabled>`;
        const deleteHTML = canDelete
          ? `<button class="my-shift-delete-btn" onclick="deleteMyShift(this,[${(row.uuids||[]).map(u=>`'${u}'`).join(',')}],${row.isSpecial})">削除</button>`
          : '-';
        html += `<tr data-date="${row.shiftDate}" data-is-special="${row.isSpecial}">
          <td>${checkboxHTML}</td>
          <td class="shift-time">${row.timeSlot}${badge}</td>
          <td>${deleteHTML}</td>
        </tr>`;
      });
      html += '</tbody></table>';
      container.innerHTML = html;
      setupMyShiftsCheckboxListeners();
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupDOM();
    setupGlobals();
    defineDisplayMyShifts_NEW();
  });

  test('連続する2スロット (09:30-10:00, 10:00-10:30) が1行にマージされる', () => {
    const container = document.getElementById('myShiftsContent');
    displayMyShifts(container, [
      { shiftDate: '2099-04-20', timeSlot: '09:30-10:00', uuid: 'app-1',
        registrationDate: '2026-04-17T00:00:00Z', isSpecial: true },
      { shiftDate: '2099-04-20', timeSlot: '10:00-10:30', uuid: 'app-2',
        registrationDate: '2026-04-17T00:00:00Z', isSpecial: true },
    ]);

    const rows = container.querySelectorAll('tr[data-is-special="true"]');
    expect(rows.length).toBe(1);
  });

  test('マージされた行の時間帯が 09:30-10:30 と表示される', () => {
    const container = document.getElementById('myShiftsContent');
    displayMyShifts(container, [
      { shiftDate: '2099-04-20', timeSlot: '09:30-10:00', uuid: 'app-1',
        registrationDate: '2026-04-17T00:00:00Z', isSpecial: true },
      { shiftDate: '2099-04-20', timeSlot: '10:00-10:30', uuid: 'app-2',
        registrationDate: '2026-04-17T00:00:00Z', isSpecial: true },
    ]);

    const timeCell = container.querySelector('tr[data-is-special="true"] .shift-time');
    expect(timeCell.textContent).toContain('09:30-10:30');
  });

  test('連続しない2スロットは別々の行になる', () => {
    const container = document.getElementById('myShiftsContent');
    displayMyShifts(container, [
      { shiftDate: '2099-04-20', timeSlot: '09:00-09:30', uuid: 'app-1',
        registrationDate: '2026-04-17T00:00:00Z', isSpecial: true },
      { shiftDate: '2099-04-20', timeSlot: '10:00-10:30', uuid: 'app-2',
        registrationDate: '2026-04-17T00:00:00Z', isSpecial: true },
    ]);

    const rows = container.querySelectorAll('tr[data-is-special="true"]');
    expect(rows.length).toBe(2);
  });

  test('3連続スロット (09:00-09:30, 09:30-10:00, 10:00-10:30) が09:00-10:30にマージ', () => {
    const container = document.getElementById('myShiftsContent');
    displayMyShifts(container, [
      { shiftDate: '2099-04-20', timeSlot: '09:00-09:30', uuid: 'app-1',
        registrationDate: '2026-04-17T00:00:00Z', isSpecial: true },
      { shiftDate: '2099-04-20', timeSlot: '09:30-10:00', uuid: 'app-2',
        registrationDate: '2026-04-17T00:00:00Z', isSpecial: true },
      { shiftDate: '2099-04-20', timeSlot: '10:00-10:30', uuid: 'app-3',
        registrationDate: '2026-04-17T00:00:00Z', isSpecial: true },
    ]);

    const rows = container.querySelectorAll('tr[data-is-special="true"]');
    expect(rows.length).toBe(1);
    const timeCell = container.querySelector('tr[data-is-special="true"] .shift-time');
    expect(timeCell.textContent).toContain('09:00-10:30');
  });

  test('マージされたチェックボックスの data-uuids に全UUIDが含まれる', () => {
    const container = document.getElementById('myShiftsContent');
    displayMyShifts(container, [
      { shiftDate: '2099-04-20', timeSlot: '09:30-10:00', uuid: 'app-1',
        registrationDate: '2026-04-17T00:00:00Z', isSpecial: true },
      { shiftDate: '2099-04-20', timeSlot: '10:00-10:30', uuid: 'app-2',
        registrationDate: '2026-04-17T00:00:00Z', isSpecial: true },
    ]);

    const checkbox = container.querySelector('.my-shift-row-checkbox[data-type="special"]');
    expect(checkbox).not.toBeNull();
    const uuids = checkbox.dataset.uuids.split(',');
    expect(uuids).toContain('app-1');
    expect(uuids).toContain('app-2');
  });

  test('マージされた削除ボタンに全UUIDが含まれる', () => {
    const container = document.getElementById('myShiftsContent');
    displayMyShifts(container, [
      { shiftDate: '2099-04-20', timeSlot: '09:30-10:00', uuid: 'app-1',
        registrationDate: '2026-04-17T00:00:00Z', isSpecial: true },
      { shiftDate: '2099-04-20', timeSlot: '10:00-10:30', uuid: 'app-2',
        registrationDate: '2026-04-17T00:00:00Z', isSpecial: true },
    ]);

    const btn = container.querySelector('.my-shift-delete-btn');
    const onclick = btn.getAttribute('onclick');
    expect(onclick).toContain("'app-1'");
    expect(onclick).toContain("'app-2'");
    expect(onclick).toContain('true'); // isSpecial
  });

  test('異なる日付の特別シフトはそれぞれマージされる', () => {
    const container = document.getElementById('myShiftsContent');
    displayMyShifts(container, [
      { shiftDate: '2099-04-20', timeSlot: '09:30-10:00', uuid: 'app-1',
        registrationDate: '2026-04-17T00:00:00Z', isSpecial: true },
      { shiftDate: '2099-04-20', timeSlot: '10:00-10:30', uuid: 'app-2',
        registrationDate: '2026-04-17T00:00:00Z', isSpecial: true },
      { shiftDate: '2099-04-21', timeSlot: '13:00-13:30', uuid: 'app-3',
        registrationDate: '2026-04-17T00:00:00Z', isSpecial: true },
      { shiftDate: '2099-04-21', timeSlot: '13:30-14:00', uuid: 'app-4',
        registrationDate: '2026-04-17T00:00:00Z', isSpecial: true },
    ]);

    const rows = container.querySelectorAll('tr[data-is-special="true"]');
    expect(rows.length).toBe(2); // 各日付1行ずつ
  });
});

// ============================================================
// deleteMyShift - 複数UUIDの特別シフトを全てキャンセル
// ============================================================
describe('deleteMyShift - マージされた特別シフトの全スロットを削除', () => {
  const setupGlobals = () => {
    global.getCurrentUser = jest.fn(() => ({ sub: 'user-1', name: 'ユーザー1' }));
    global.mergeConsecutiveTimeSlots = jest.fn(slots => slots);
    global.loadMyShifts = jest.fn().mockResolvedValue(undefined);
    global.confirm = jest.fn(() => true);
    global.alert = jest.fn();
  };

  const defineDeleteMyShift = () => {
    global.deleteMyShift = async function(buttonElement, uuids, isSpecial) {
      const currentUser = getCurrentUser();
      if (!currentUser) { alert('ログインしてください。'); return; }
      if (!uuids || !Array.isArray(uuids) || uuids.length === 0) { alert('シフト情報が不正です。'); return; }

      if (isSpecial) {
        if (!confirm('特別シフトの申請をキャンセルしますか？')) return;
        buttonElement.disabled = true;
        buttonElement.style = buttonElement.style || {};
        try {
          // 全UUIDをキャンセル
          const results = await Promise.all(
            uuids.map(uuid => API.cancelSpecialShiftApplication(uuid))
          );
          const anyFailed = results.some(r => !r.success);
          if (anyFailed) throw new Error('一部の申請のキャンセルに失敗しました');
          alert('特別シフトの申請をキャンセルしました。');
          await loadMyShifts();
        } catch(e) {
          alert('申請のキャンセルに失敗しました。再度お試しください。');
        } finally {
          buttonElement.disabled = false;
        }
        return;
      }

      // 通常シフト（省略 - 既存ロジック）
      const result = await API.getUserShifts(currentUser.sub);
      if (!result.success) { alert('シフト情報の取得に失敗しました。'); return; }
      const targets = (result.data || []).filter(s => uuids.includes(s.uuid));
      if (!targets.length) { alert('シフト情報が見つかりません。'); return; }
      const today = new Date(); today.setHours(0,0,0,0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      if (new Date(targets[0].date) < tomorrow) { alert('今日以前のシフトは削除できません。'); return; }
      if (!confirm('削除しますか？')) return;
      buttonElement.disabled = true;
      try {
        const del = await API.deleteMultipleShifts(uuids);
        if (!del.success) throw new Error('failed');
        alert('削除しました。');
        await loadMyShifts();
      } catch(e) {
        alert('シフトの削除に失敗しました。');
      } finally { buttonElement.disabled = false; }
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupGlobals();
    defineDeleteMyShift();
  });

  test('マージされた特別シフト(2UUID)で cancelSpecialShiftApplication を2回呼ぶ', async () => {
    global.API = {
      cancelSpecialShiftApplication: jest.fn().mockResolvedValue({ success: true }),
    };

    const btn = document.createElement('button');
    await deleteMyShift(btn, ['app-1', 'app-2'], true);

    expect(API.cancelSpecialShiftApplication).toHaveBeenCalledTimes(2);
    expect(API.cancelSpecialShiftApplication).toHaveBeenCalledWith('app-1');
    expect(API.cancelSpecialShiftApplication).toHaveBeenCalledWith('app-2');
    expect(loadMyShifts).toHaveBeenCalled();
  });

  test('1スロットの特別シフトは cancelSpecialShiftApplication を1回呼ぶ', async () => {
    global.API = {
      cancelSpecialShiftApplication: jest.fn().mockResolvedValue({ success: true }),
    };

    const btn = document.createElement('button');
    await deleteMyShift(btn, ['app-1'], true);

    expect(API.cancelSpecialShiftApplication).toHaveBeenCalledTimes(1);
    expect(API.cancelSpecialShiftApplication).toHaveBeenCalledWith('app-1');
  });

  test('3スロットの特別シフトで cancelSpecialShiftApplication を3回呼ぶ', async () => {
    global.API = {
      cancelSpecialShiftApplication: jest.fn().mockResolvedValue({ success: true }),
    };

    const btn = document.createElement('button');
    await deleteMyShift(btn, ['app-1', 'app-2', 'app-3'], true);

    expect(API.cancelSpecialShiftApplication).toHaveBeenCalledTimes(3);
    expect(loadMyShifts).toHaveBeenCalled();
  });

  test('一部のキャンセルが失敗してもエラーハンドリングされる', async () => {
    global.API = {
      cancelSpecialShiftApplication: jest.fn()
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false, error: 'failed' }),
    };

    const btn = document.createElement('button');
    await deleteMyShift(btn, ['app-1', 'app-2'], true);

    expect(alert).toHaveBeenCalled();
    expect(loadMyShifts).not.toHaveBeenCalled();
  });
});
