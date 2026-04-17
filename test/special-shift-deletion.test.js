/**
 * 自分のシフト一覧から特別シフトを削除できるテスト（TDD）
 */

// ============================================================
// displayMyShifts - 特別シフトのチェックボックスが有効
// ============================================================
describe('displayMyShifts - 特別シフトのチェックボックスが有効', () => {
  const setupDOM = () => {
    document.body.innerHTML = `<div id="myShiftsContent"></div>`;
  };

  const setupGlobals = () => {
    global.getScrollToShiftAfterLoad = jest.fn(() => null);
    global.setScrollToShiftAfterLoad = jest.fn();
    global.createBulkActionBarHTML   = jest.fn(() => '');
    global.setupMyShiftsCheckboxListeners = jest.fn();
    global.mergeConsecutiveTimeSlots = jest.fn(slots => slots);
  };

  const defineDisplayMyShifts = () => {
    global.displayMyShifts = function(container, shiftsData) {
      if (!shiftsData || shiftsData.length === 0) {
        container.innerHTML = '<div class="no-shifts-message"></div>';
        return;
      }

      const regularShifts = shiftsData.filter(s => !s.isSpecial);
      const specialShifts  = shiftsData.filter(s =>  s.isSpecial);

      // 通常シフト: 日付グループ化＆マージ
      const shiftsByDate = {};
      regularShifts.forEach(shift => {
        if (!shiftsByDate[shift.shiftDate]) {
          shiftsByDate[shift.shiftDate] = { slots: [], uuidMap: {}, registrationDate: shift.registrationDate };
        }
        shiftsByDate[shift.shiftDate].slots.push(shift.timeSlot);
        shiftsByDate[shift.shiftDate].uuidMap[shift.timeSlot] = shift.uuid;
      });

      const rows = [];

      Object.keys(shiftsByDate).forEach(date => {
        const { slots, uuidMap, registrationDate } = shiftsByDate[date];
        const merged = mergeConsecutiveTimeSlots(slots);
        merged.forEach(timeSlot => {
          const uuids = slots.filter(s => {
            const [start] = s.split('-');
            const [rStart, rEnd] = timeSlot.split('-');
            return start >= rStart && start < rEnd;
          }).map(s => uuidMap[s]).filter(Boolean);
          rows.push({ shiftDate: date, timeSlot, uuids, registrationDate, isSpecial: false });
        });
      });

      // 特別シフト: 個別行（マージなし）
      specialShifts.forEach(shift => {
        rows.push({
          shiftDate: shift.shiftDate, timeSlot: shift.timeSlot,
          uuids: [shift.uuid], registrationDate: shift.registrationDate, isSpecial: true,
        });
      });

      rows.sort((a, b) => new Date(a.shiftDate) - new Date(b.shiftDate));

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      let html = `${createBulkActionBarHTML()}
        <div class="my-shifts-table-container">
          <table class="my-shifts-table">
            <thead><tr>
              <th><input type="checkbox" id="myShiftsSelectAll"></th>
              <th>シフト日</th><th>時間帯</th><th>操作</th>
            </tr></thead>
            <tbody>`;

      rows.forEach(row => {
        const shiftDate = new Date(row.shiftDate);
        const canDelete = shiftDate >= tomorrow;
        const uuidsStr = (row.uuids || []).join(',');
        const specialAttr = row.isSpecial ? 'data-type="special"' : 'data-type="regular"';
        const badge = row.isSpecial ? '<span class="special-badge">特別</span>' : '';

        // チェックボックス（翌日以降は特別・通常ともに有効）
        const checkboxHTML = canDelete
          ? `<td><input type="checkbox" class="my-shift-row-checkbox" data-uuids="${uuidsStr}" ${specialAttr} data-date="${row.shiftDate}" data-time="${row.timeSlot}"></td>`
          : `<td><input type="checkbox" disabled style="opacity:0.3"></td>`;

        const deleteHTML = canDelete
          ? `<td><button class="my-shift-delete-btn" onclick="deleteMyShift(this,[${(row.uuids||[]).map(u=>`'${u}'`).join(',')}],${row.isSpecial})">削除</button></td>`
          : `<td>-</td>`;

        html += `<tr data-date="${row.shiftDate}" data-is-special="${row.isSpecial}">
          ${checkboxHTML}
          <td class="shift-date">${row.shiftDate}</td>
          <td class="shift-time">${row.timeSlot}${badge}</td>
          ${deleteHTML}
        </tr>`;
      });

      html += `</tbody></table></div>`;
      container.innerHTML = html;
      setupMyShiftsCheckboxListeners();
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupDOM();
    setupGlobals();
    defineDisplayMyShifts();
  });

  const renderSpecialShift = (date = '2099-04-20') => {
    const container = document.getElementById('myShiftsContent');
    displayMyShifts(container, [
      { shiftDate: date, timeSlot: '10:00-10:30', uuid: 'app-1',
        registrationDate: '2026-04-17T00:00:00Z', isSpecial: true },
    ]);
    return container;
  };

  test('特別シフトのチェックボックスは disabled でない', () => {
    const container = renderSpecialShift();
    const checkbox = container.querySelector('.my-shift-row-checkbox');
    expect(checkbox).not.toBeNull();
    expect(checkbox.disabled).toBe(false);
  });

  test('特別シフトのチェックボックスに data-type="special" が設定される', () => {
    const container = renderSpecialShift();
    const checkbox = container.querySelector('.my-shift-row-checkbox');
    expect(checkbox).not.toBeNull();
    expect(checkbox.dataset.type).toBe('special');
  });

  test('特別シフトのチェックボックスに data-uuids が設定される', () => {
    const container = renderSpecialShift();
    const checkbox = container.querySelector('.my-shift-row-checkbox');
    expect(checkbox).not.toBeNull();
    expect(checkbox.dataset.uuids).toBe('app-1');
  });

  test('通常シフトのチェックボックスには data-type="regular" が設定される', () => {
    const container = document.getElementById('myShiftsContent');
    displayMyShifts(container, [
      { shiftDate: '2099-04-17', timeSlot: '13:00-13:30', uuid: 'shift-1',
        registrationDate: '2026-04-10T00:00:00Z', isSpecial: false },
    ]);
    const checkbox = container.querySelector('.my-shift-row-checkbox');
    expect(checkbox).not.toBeNull();
    expect(checkbox.dataset.type).toBe('regular');
  });

  test('削除ボタンの onclick に isSpecial=true が含まれる', () => {
    const container = renderSpecialShift();
    const btn = container.querySelector('.my-shift-delete-btn');
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('onclick')).toContain('true');
  });
});

// ============================================================
// deleteMyShift - 特別シフトの削除
// ============================================================
describe('deleteMyShift - 特別シフトの削除', () => {
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
          const result = await API.cancelSpecialShiftApplication(uuids[0]);
          if (!result.success) { throw new Error(result.error || 'failed'); }
          alert('特別シフトの申請をキャンセルしました。');
          await loadMyShifts();
        } catch(e) {
          alert('申請のキャンセルに失敗しました。再度お試しください。');
        } finally {
          buttonElement.disabled = false;
        }
        return;
      }

      // 通常シフト
      const result = await API.getUserShifts(currentUser.sub);
      if (!result.success) { alert('シフト情報の取得に失敗しました。'); return; }
      const myShifts = (result.data || []).map(s => ({ shiftDate: s.date, timeSlot: s.time_slot, uuid: s.uuid }));
      const targets = myShifts.filter(s => uuids.includes(s.uuid));
      if (!targets.length) { alert('シフト情報が見つかりません。'); return; }

      const today = new Date(); today.setHours(0,0,0,0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      const targetDate = new Date(targets[0].shiftDate);
      if (targetDate < tomorrow) { alert('今日以前のシフトは削除できません。'); return; }

      const displayTime = mergeConsecutiveTimeSlots(targets.map(s => s.timeSlot))[0];
      if (!confirm(`${targets[0].shiftDate} ${displayTime}のシフトを削除しますか？`)) return;

      buttonElement.disabled = true;
      try {
        const del = await API.deleteMultipleShifts(uuids);
        if (!del.success) throw new Error(del.error || 'failed');
        alert(`${targets[0].shiftDate} ${displayTime}のシフトを削除しました。`);
        await loadMyShifts();
      } catch(e) {
        alert('シフトの削除に失敗しました。再度お試しください。');
      } finally {
        buttonElement.disabled = false;
      }
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupGlobals();
    defineDeleteMyShift();
  });

  test('isSpecial=true の場合、cancelSpecialShiftApplication を呼ぶ', async () => {
    global.API = {
      cancelSpecialShiftApplication: jest.fn().mockResolvedValue({ success: true }),
    };

    const btn = document.createElement('button');
    await deleteMyShift(btn, ['app-1'], true);

    expect(API.cancelSpecialShiftApplication).toHaveBeenCalledWith('app-1');
    expect(loadMyShifts).toHaveBeenCalled();
  });

  test('isSpecial=false の場合、deleteMultipleShifts を呼ぶ', async () => {
    global.API = {
      getUserShifts: jest.fn().mockResolvedValue({
        success: true,
        data: [{ uuid: 'shift-1', date: '2099-04-20', time_slot: '13:00-13:30',
                 user_id: 'user-1', user_name: 'ユーザー1', created_at: '2026-04-10T00:00:00Z' }]
      }),
      deleteMultipleShifts: jest.fn().mockResolvedValue({ success: true }),
    };

    const btn = document.createElement('button');
    await deleteMyShift(btn, ['shift-1'], false);

    expect(API.deleteMultipleShifts).toHaveBeenCalledWith(['shift-1']);
    expect(loadMyShifts).toHaveBeenCalled();
  });

  test('cancelSpecialShiftApplication が失敗したらアラートを出しリロードしない', async () => {
    global.API = {
      cancelSpecialShiftApplication: jest.fn().mockResolvedValue({ success: false, error: 'failed' }),
    };

    const btn = document.createElement('button');
    await deleteMyShift(btn, ['app-1'], true);

    expect(alert).toHaveBeenCalled();
    expect(loadMyShifts).not.toHaveBeenCalled();
  });
});

// ============================================================
// setupMyShiftsCheckboxListeners - 一括削除で特別シフトを処理
// ============================================================
describe('setupMyShiftsCheckboxListeners - 一括削除で特別シフトを処理', () => {
  const setupDOM = () => {
    document.body.innerHTML = `
      <div>
        <input type="checkbox" id="myShiftsSelectAll">
        <span id="myShiftsSelectedCount">0</span>
        <button id="myShiftsBulkDeleteBtn">削除</button>
        <table><tbody>
          <tr><td><input type="checkbox" class="my-shift-row-checkbox"
            data-uuids="shift-1" data-type="regular" data-date="2099-04-17" data-time="13:00-13:30"></td></tr>
          <tr><td><input type="checkbox" class="my-shift-row-checkbox"
            data-uuids="app-1" data-type="special" data-date="2099-04-20" data-time="10:00-10:30"></td></tr>
        </tbody></table>
      </div>
    `;
  };

  const setupGlobals = () => {
    global.updateBulkActionBarCount = jest.fn();
    global.loadMyShifts = jest.fn().mockResolvedValue(undefined);
    global.confirm = jest.fn(() => true);
    global.alert = jest.fn();
  };

  const defineSetupMyShiftsCheckboxListeners = () => {
    global.setupMyShiftsCheckboxListeners = function() {
      const selectAll = document.getElementById('myShiftsSelectAll');
      const bulkDeleteBtn = document.getElementById('myShiftsBulkDeleteBtn');
      if (!selectAll) return;

      const updateActionBar = () => {
        const checked = document.querySelectorAll('.my-shift-row-checkbox:checked');
        const all = document.querySelectorAll('.my-shift-row-checkbox:not(:disabled)');
        updateBulkActionBarCount('myShiftsSelectedCount', checked.length);
        selectAll.indeterminate = checked.length > 0 && checked.length < all.length;
        selectAll.checked = all.length > 0 && checked.length === all.length;
      };

      selectAll.addEventListener('change', () => {
        document.querySelectorAll('.my-shift-row-checkbox:not(:disabled)').forEach(cb => { cb.checked = selectAll.checked; });
        updateActionBar();
      });

      document.querySelectorAll('.my-shift-row-checkbox').forEach(cb => cb.addEventListener('change', updateActionBar));

      bulkDeleteBtn.addEventListener('click', async () => {
        const checkedBoxes = document.querySelectorAll('.my-shift-row-checkbox:checked');
        if (checkedBoxes.length === 0) return;

        const regularUuids = [];
        const specialUuids = [];
        checkedBoxes.forEach(cb => {
          const uuidsStr = cb.getAttribute('data-uuids');
          const type = cb.getAttribute('data-type');
          if (uuidsStr) {
            uuidsStr.split(',').forEach(uuid => {
              if (!uuid) return;
              if (type === 'special') specialUuids.push(uuid);
              else regularUuids.push(uuid);
            });
          }
        });

        if (regularUuids.length === 0 && specialUuids.length === 0) return;

        if (!confirm(`選択した ${checkedBoxes.length} 件のシフトを削除しますか？`)) return;

        bulkDeleteBtn.disabled = true;

        try {
          const promises = [];
          if (regularUuids.length > 0) promises.push(API.deleteMultipleShifts(regularUuids));
          specialUuids.forEach(uuid => promises.push(API.cancelSpecialShiftApplication(uuid)));

          const results = await Promise.all(promises);
          const anyFailed = results.some(r => !r.success);

          if (!anyFailed) {
            alert(`${checkedBoxes.length}件のシフトを削除しました。`);
            await loadMyShifts();
          } else {
            alert('一部のシフトの削除に失敗しました。');
            bulkDeleteBtn.disabled = false;
          }
        } catch(e) {
          alert('シフトの削除に失敗しました');
          bulkDeleteBtn.disabled = false;
        }
      });
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupDOM();
    setupGlobals();
    defineSetupMyShiftsCheckboxListeners();
  });

  test('一括削除でregularとspecialを分けて呼び出す', async () => {
    global.API = {
      deleteMultipleShifts: jest.fn().mockResolvedValue({ success: true }),
      cancelSpecialShiftApplication: jest.fn().mockResolvedValue({ success: true }),
    };

    setupMyShiftsCheckboxListeners();
    document.querySelectorAll('.my-shift-row-checkbox').forEach(cb => { cb.checked = true; });

    await document.getElementById('myShiftsBulkDeleteBtn').click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(API.deleteMultipleShifts).toHaveBeenCalledWith(['shift-1']);
    expect(API.cancelSpecialShiftApplication).toHaveBeenCalledWith('app-1');
    expect(loadMyShifts).toHaveBeenCalled();
  });

  test('特別シフトのみ選択した場合、cancelSpecialShiftApplication のみ呼ぶ', async () => {
    global.API = {
      deleteMultipleShifts: jest.fn().mockResolvedValue({ success: true }),
      cancelSpecialShiftApplication: jest.fn().mockResolvedValue({ success: true }),
    };

    setupMyShiftsCheckboxListeners();
    document.querySelector('.my-shift-row-checkbox[data-type="special"]').checked = true;

    await document.getElementById('myShiftsBulkDeleteBtn').click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(API.cancelSpecialShiftApplication).toHaveBeenCalledWith('app-1');
    expect(API.deleteMultipleShifts).not.toHaveBeenCalled();
    expect(loadMyShifts).toHaveBeenCalled();
  });

  test('通常シフトのみ選択した場合、deleteMultipleShifts のみ呼ぶ', async () => {
    global.API = {
      deleteMultipleShifts: jest.fn().mockResolvedValue({ success: true }),
      cancelSpecialShiftApplication: jest.fn().mockResolvedValue({ success: true }),
    };

    setupMyShiftsCheckboxListeners();
    document.querySelector('.my-shift-row-checkbox[data-type="regular"]').checked = true;

    await document.getElementById('myShiftsBulkDeleteBtn').click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(API.deleteMultipleShifts).toHaveBeenCalledWith(['shift-1']);
    expect(API.cancelSpecialShiftApplication).not.toHaveBeenCalled();
    expect(loadMyShifts).toHaveBeenCalled();
  });
});
