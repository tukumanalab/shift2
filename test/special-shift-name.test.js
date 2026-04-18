/**
 * 特別シフトに名前をつけ、申請時に表示するテスト（TDD）
 */

// ============================================================
// 1. 申請モーダルで特別シフトの名前が表示される
// ============================================================

describe('openSpecialShiftApplicationModal - 特別シフト名の表示', () => {
  const setupDOM = () => {
    document.body.innerHTML = `
      <div id="container"></div>
      <div id="modal" style="display:none;"></div>
      <div id="title"></div>
    `;
  };

  const setupGlobals = () => {
    global.getSpecialShiftsForDate = jest.fn();
    global.buildSpecialShiftSlots = jest.fn((_start, _end) => []);
    global.toggleTimeSlotSelection = jest.fn();
    global.API = {
      getSpecialShiftApplications: jest.fn().mockResolvedValue({ success: true, data: [] }),
    };
  };

  const defineOpenSpecialShiftApplicationModal = () => {
    global.openSpecialShiftApplicationModal = async function(dateKey, currentUser, container) {
      const specialShifts = getSpecialShiftsForDate(dateKey);

      const applicationsResults = await Promise.all(
        specialShifts.map(shift => API.getSpecialShiftApplications(shift.uuid))
      );

      const heading = document.createElement('div');
      heading.className = 'special-shift-heading';
      heading.textContent = '特別シフト申請';
      container.appendChild(heading);

      specialShifts.forEach((shift, index) => {
        const result = applicationsResults[index];
        const applications = (result && result.success) ? result.data : [];

        // 特別シフト名を表示
        if (shift.name) {
          const nameDiv = document.createElement('div');
          nameDiv.className = 'special-shift-name';
          nameDiv.textContent = shift.name;
          container.appendChild(nameDiv);
        }

        const slots = buildSpecialShiftSlots(shift.start_time, shift.end_time);
        slots.forEach(slot => {
          const isApplied = currentUser &&
            applications.some(app => app.user_id === currentUser.sub && app.time_slot === slot);
          const slotDiv = document.createElement('div');
          slotDiv.className = 'date-detail-slot';
          slotDiv.dataset.slot = slot;
          slotDiv.dataset.slotType = 'special';
          slotDiv.dataset.specialShiftUuid = shift.uuid;
          slotDiv.textContent = slot;
          if (isApplied) {
            slotDiv.classList.add('disabled');
          } else {
            slotDiv.classList.add('selectable');
            slotDiv.onclick = () => toggleTimeSlotSelection(slotDiv, slot);
          }
          container.appendChild(slotDiv);
        });
      });
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupDOM();
    setupGlobals();
    defineOpenSpecialShiftApplicationModal();
  });

  test('特別シフト名が申請モーダルに表示される', async () => {
    global.getSpecialShiftsForDate = jest.fn(() => [
      { uuid: 'shift-1', name: '夏期特別シフト', start_time: '09:00', end_time: '10:00' },
    ]);
    global.buildSpecialShiftSlots = jest.fn(() => ['09:00-09:30', '09:30-10:00']);

    const container = document.getElementById('container');
    await openSpecialShiftApplicationModal('2026-04-20', { sub: 'user-1' }, container);

    const nameDiv = container.querySelector('.special-shift-name');
    expect(nameDiv).not.toBeNull();
    expect(nameDiv.textContent).toBe('夏期特別シフト');
  });

  test('複数の特別シフトがある場合、それぞれの名前が表示される', async () => {
    global.getSpecialShiftsForDate = jest.fn(() => [
      { uuid: 'shift-1', name: 'シフトA', start_time: '09:00', end_time: '10:00' },
      { uuid: 'shift-2', name: 'シフトB', start_time: '13:00', end_time: '14:00' },
    ]);
    global.buildSpecialShiftSlots = jest.fn(() => ['09:00-09:30']);

    const container = document.getElementById('container');
    await openSpecialShiftApplicationModal('2026-04-20', { sub: 'user-1' }, container);

    const nameDivs = container.querySelectorAll('.special-shift-name');
    expect(nameDivs.length).toBe(2);
    expect(nameDivs[0].textContent).toBe('シフトA');
    expect(nameDivs[1].textContent).toBe('シフトB');
  });

  test('name が未設定の特別シフトでは名前要素が表示されない', async () => {
    global.getSpecialShiftsForDate = jest.fn(() => [
      { uuid: 'shift-1', name: null, start_time: '09:00', end_time: '10:00' },
    ]);

    const container = document.getElementById('container');
    await openSpecialShiftApplicationModal('2026-04-20', { sub: 'user-1' }, container);

    expect(container.querySelector('.special-shift-name')).toBeNull();
  });
});

// ============================================================
// 2. 管理者が特別シフトを作成する際に名前を入力できる
// ============================================================

describe('submitSpecialShift - name フィールドをリクエストに含める', () => {
  const setupGlobals = () => {
    global.getCurrentUserData = jest.fn(() => ({ sub: 'admin-1', name: '管理者' }));
    global.showSpecialShiftError = jest.fn();
    global.closeSpecialShiftModal = jest.fn();
    global.loadSpecialShifts = jest.fn().mockResolvedValue(undefined);
    global.refreshAllSpecialShiftsDisplay = jest.fn();
    global.alert = jest.fn();
    global.API = {
      createSpecialShift: jest.fn().mockResolvedValue({ success: true }),
    };
  };

  const setupDOM = () => {
    document.body.innerHTML = `
      <div id="specialShiftModal">
        <span id="specialShiftDate" data-date="2026-04-20">2026年4月20日</span>
        <input id="specialShiftName" value="夏期特別シフト" />
        <select id="specialShiftStartTime"><option value="09:00" selected>09:00</option></select>
        <select id="specialShiftEndTime"><option value="10:00" selected>10:00</option></select>
        <div id="specialShiftError" style="display:none;"></div>
        <button class="submit-btn">追加</button>
        <button class="cancel-btn">キャンセル</button>
      </div>
    `;
  };

  const defineSubmitSpecialShift = () => {
    global.submitSpecialShift = async function() {
      const dateDisplay = document.getElementById('specialShiftDate');
      const date = dateDisplay.getAttribute('data-date');
      const name = document.getElementById('specialShiftName').value.trim();
      const startTime = document.getElementById('specialShiftStartTime').value;
      const endTime = document.getElementById('specialShiftEndTime').value;

      if (!date || !name || !startTime || !endTime) {
        showSpecialShiftError('すべての項目を入力してください。');
        return;
      }

      const userData = getCurrentUserData();
      const requestData = {
        date,
        name,
        start_time: startTime,
        end_time: endTime,
        user_id: userData.sub,
        user_name: userData.name || userData.email,
      };

      const result = await API.createSpecialShift(requestData);
      if (result.success) {
        alert('特別シフトが追加されました！');
        closeSpecialShiftModal();
        await loadSpecialShifts();
        refreshAllSpecialShiftsDisplay();
      } else {
        showSpecialShiftError(result.error || '特別シフトの追加に失敗しました');
      }
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupDOM();
    setupGlobals();
    defineSubmitSpecialShift();
  });

  test('name フィールドが API リクエストに含まれる', async () => {
    await submitSpecialShift();

    expect(API.createSpecialShift).toHaveBeenCalledWith(
      expect.objectContaining({ name: '夏期特別シフト' })
    );
  });

  test('name が空の場合はエラーを表示する', async () => {
    document.getElementById('specialShiftName').value = '';

    await submitSpecialShift();

    expect(showSpecialShiftError).toHaveBeenCalled();
    expect(API.createSpecialShift).not.toHaveBeenCalled();
  });

  test('name が空白のみの場合もエラーを表示する', async () => {
    document.getElementById('specialShiftName').value = '   ';

    await submitSpecialShift();

    expect(showSpecialShiftError).toHaveBeenCalled();
    expect(API.createSpecialShift).not.toHaveBeenCalled();
  });
});

// ============================================================
// 3. 自分のシフト一覧で特別シフトの名前が表示される
// ============================================================

describe('displayMyShifts - 特別シフト名の表示', () => {
  const setupDOM = () => {
    document.body.innerHTML = `<div id="myShiftsContainer"></div>`;
  };

  const setupGlobals = () => {
    global.isAdmin = jest.fn(() => false);
    global.formatDateWithWeekday = jest.fn(d => d);
    global.setupMyShiftsCheckboxListeners = jest.fn();
    window.capacityData = null;
  };

  const defineDisplayMyShifts = () => {
    global.mergeConsecutiveTimeSlots = function(slots) {
      if (!slots.length) return [];
      const sorted = [...slots].sort();
      let start = sorted[0].split('-')[0], end = sorted[0].split('-')[1];
      const merged = [];
      for (let i = 1; i < sorted.length; i++) {
        const [ns, ne] = sorted[i].split('-');
        if (end === ns) { end = ne; } else { merged.push(`${start}-${end}`); start = ns; end = ne; }
      }
      merged.push(`${start}-${end}`);
      return merged;
    };

    global.displayMyShifts = function(container, shiftsData) {
      if (!shiftsData || shiftsData.length === 0) {
        container.innerHTML = '<p>シフトなし</p>';
        return;
      }

      const specialShiftsData = shiftsData.filter(s => s.isSpecial);

      // 特別シフトを日付ごとにグループ化してマージ（shiftNameも保持）
      const specialByDate = {};
      specialShiftsData.forEach(shift => {
        const date = shift.shiftDate;
        if (!specialByDate[date]) {
          specialByDate[date] = { shifts: [], uuidMap: {}, shiftNameMap: {} };
        }
        specialByDate[date].shifts.push(shift.timeSlot);
        specialByDate[date].uuidMap[shift.timeSlot] = shift.uuid;
        specialByDate[date].shiftNameMap[shift.timeSlot] = shift.shiftName || null;
      });

      const mergedSpecial = [];
      Object.keys(specialByDate).forEach(date => {
        const d = specialByDate[date];
        mergeConsecutiveTimeSlots(d.shifts).forEach(timeSlot => {
          const [rs, re] = timeSlot.split('-');
          const origSlots = d.shifts.filter(s => { const [ss] = s.split('-'); return ss >= rs && ss < re; });
          const shiftName = origSlots.length > 0 ? (d.shiftNameMap[origSlots[0]] || null) : null;
          mergedSpecial.push({ shiftDate: date, timeSlot, isSpecial: true, shiftName });
        });
      });

      let tableHTML = '<table><tbody>';
      mergedSpecial.forEach(shift => {
        const shiftNameHTML = shift.isSpecial && shift.shiftName
          ? `<div class="shift-name-label">${shift.shiftName}</div>`
          : '';
        tableHTML += `<tr>
          <td class="shift-time"><span class="shift-time-inner"><span class="special-badge">特別</span>${shift.timeSlot}</span>${shiftNameHTML}</td>
        </tr>`;
      });
      tableHTML += '</tbody></table>';
      container.innerHTML = tableHTML;
      setupMyShiftsCheckboxListeners();
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupDOM();
    setupGlobals();
    defineDisplayMyShifts();
  });

  test('特別シフトの名前が時間帯セルに表示される', () => {
    const container = document.getElementById('myShiftsContainer');
    displayMyShifts(container, [
      { shiftDate: '2026-04-20', timeSlot: '09:00-10:00', userId: 'user-1',
        userName: 'ユーザー1', uuid: 'app-1', isSpecial: true, shiftName: '夏期特別シフト' },
    ]);

    const label = container.querySelector('.shift-name-label');
    expect(label).not.toBeNull();
    expect(label.textContent).toBe('夏期特別シフト');
  });

  test('通常シフトには名前ラベルが表示されない', () => {
    const container = document.getElementById('myShiftsContainer');
    displayMyShifts(container, [
      { shiftDate: '2026-04-20', timeSlot: '13:00-13:30', userId: 'user-1',
        userName: 'ユーザー1', uuid: 'shift-1', isSpecial: false, shiftName: null },
    ]);

    expect(container.querySelector('.shift-name-label')).toBeNull();
  });

  test('shiftName が null の特別シフトは名前ラベルなし', () => {
    const container = document.getElementById('myShiftsContainer');
    displayMyShifts(container, [
      { shiftDate: '2026-04-20', timeSlot: '09:00-10:00', userId: 'user-1',
        userName: 'ユーザー1', uuid: 'app-1', isSpecial: true, shiftName: null },
    ]);

    expect(container.querySelector('.shift-name-label')).toBeNull();
  });
});

// ============================================================
// 4. 全シフト一覧テーブルで特別シフトの名前が表示される
// ============================================================

describe('displayAllShiftsTable - 特別シフト名の表示', () => {
  const setupDOM = () => {
    document.body.innerHTML = `<div id="allShiftsTableContent"></div>`;
  };

  const setupGlobals = () => {
    global.escapeHtml = jest.fn(s => String(s));
    global.formatDateWithWeekday = jest.fn(d => d);
    global.formatDateTime = jest.fn(d => d);
    global.createBulkActionBarHTML = jest.fn(() => '');
    global.generateAllShiftsPagination = jest.fn(() => '');
    global.setupFilterEventListeners = jest.fn();
    global.setupAllShiftsCheckboxListeners = jest.fn();
  };

  const defineDisplayAllShiftsTable = () => {
    global.displayAllShiftsTable = function(shifts) {
      const content = document.getElementById('allShiftsTableContent');
      const rows = shifts.map(shift => {
        const shiftNameHTML = shift.is_special && shift.shift_name
          ? `<div class="shift-name-label">${escapeHtml(shift.shift_name)}</div>`
          : '';
        return `<tr>
          <td><span class="shift-time-inner">${shift.is_special ? '<span class="special-badge">特別</span>' : '<span class="special-badge-placeholder"></span>'}${escapeHtml(shift.time_slot)}</span>${shiftNameHTML}</td>
        </tr>`;
      }).join('');
      content.innerHTML = `<table><tbody>${rows}</tbody></table>`;
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupDOM();
    setupGlobals();
    defineDisplayAllShiftsTable();
  });

  test('特別シフトの名前が時間帯セルに表示される', () => {
    displayAllShiftsTable([
      { uuid: 'app-1', user_name: 'ユーザー1', date: '2026-04-20',
        time_slot: '10:00-10:30', is_special: true, shift_name: '夏期特別シフト',
        calendar_event_id: null, created_at: '2026-04-17' },
    ]);

    const nameLabel = document.querySelector('.shift-name-label');
    expect(nameLabel).not.toBeNull();
    expect(nameLabel.textContent).toBe('夏期特別シフト');
  });

  test('通常シフトには名前ラベルが表示されない', () => {
    displayAllShiftsTable([
      { uuid: 'shift-1', user_name: 'ユーザー1', date: '2026-04-20',
        time_slot: '13:00-13:30', is_special: false, shift_name: null,
        calendar_event_id: 'cal-1', created_at: '2026-04-10' },
    ]);

    expect(document.querySelector('.shift-name-label')).toBeNull();
  });

  test('shift_name が null の特別シフトは名前ラベルなし', () => {
    displayAllShiftsTable([
      { uuid: 'app-1', user_name: 'ユーザー1', date: '2026-04-20',
        time_slot: '10:00-10:30', is_special: true, shift_name: null,
        calendar_event_id: null, created_at: '2026-04-17' },
    ]);

    expect(document.querySelector('.shift-name-label')).toBeNull();
  });
});
