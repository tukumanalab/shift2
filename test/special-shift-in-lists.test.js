/**
 * 特別シフトをシフト一覧（自分・管理・全件テーブル）に表示するテスト
 */

// ============================================================
// loadMyShifts - 通常＋特別シフトを合わせて表示
// ============================================================
describe('loadMyShifts - 特別シフト申請を含めて表示', () => {
  const setupDOM = () => {
    document.body.innerHTML = `<div id="myShiftsContent"></div>`;
  };

  const setupGlobals = () => {
    global.getCurrentUser = jest.fn(() => ({ sub: 'user-1', name: 'ユーザー1' }));
    global.getScrollToShiftAfterLoad  = jest.fn(() => null);
    global.setScrollToShiftAfterLoad  = jest.fn();
    global.console = { ...console, log: jest.fn(), error: jest.fn() };
  };

  const defineLoadMyShifts = () => {
    global.loadMyShifts = async function() {
      const container = document.getElementById('myShiftsContent');
      const currentUser = getCurrentUser();
      if (!currentUser) return;

      const [regularResult, specialResult] = await Promise.all([
        API.getUserShifts(currentUser.sub),
        API.getAllSpecialShiftApplications(currentUser.sub),
      ]);

      const regularShifts = (regularResult.data || []).map(s => ({
        shiftDate: s.date, timeSlot: s.time_slot,
        userId: s.user_id, userName: s.user_name,
        uuid: s.uuid, registrationDate: s.created_at,
        isSpecial: false,
      }));

      const specialShifts = (specialResult.data || []).map(s => ({
        shiftDate: s.date, timeSlot: s.time_slot,
        userId: s.user_id, userName: s.user_name,
        uuid: s.uuid, registrationDate: s.created_at,
        isSpecial: true,
      }));

      displayMyShifts(container, [...regularShifts, ...specialShifts]);
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupDOM();
    setupGlobals();
    defineLoadMyShifts();
  });

  test('通常シフトと特別シフト両方のAPIを呼び出す', async () => {
    global.API = {
      getUserShifts: jest.fn().mockResolvedValue({ success: true, data: [] }),
      getAllSpecialShiftApplications: jest.fn().mockResolvedValue({ success: true, data: [] }),
    };
    global.displayMyShifts = jest.fn();

    await loadMyShifts();

    expect(API.getUserShifts).toHaveBeenCalledWith('user-1');
    expect(API.getAllSpecialShiftApplications).toHaveBeenCalledWith('user-1');
  });

  test('特別シフトは isSpecial: true で displayMyShifts に渡される', async () => {
    global.API = {
      getUserShifts: jest.fn().mockResolvedValue({ success: true, data: [] }),
      getAllSpecialShiftApplications: jest.fn().mockResolvedValue({
        success: true,
        data: [{ uuid: 'app-1', user_id: 'user-1', user_name: 'ユーザー1',
                 time_slot: '10:00-10:30', date: '2026-04-20', created_at: '2026-04-17T00:00:00Z' }],
      }),
    };
    let capturedShifts;
    global.displayMyShifts = jest.fn((_, shifts) => { capturedShifts = shifts; });

    await loadMyShifts();

    const specialEntry = capturedShifts.find(s => s.uuid === 'app-1');
    expect(specialEntry).toBeDefined();
    expect(specialEntry.isSpecial).toBe(true);
    expect(specialEntry.shiftDate).toBe('2026-04-20');
    expect(specialEntry.timeSlot).toBe('10:00-10:30');
  });

  test('通常シフトと特別シフトをマージして渡す', async () => {
    global.API = {
      getUserShifts: jest.fn().mockResolvedValue({
        success: true,
        data: [{ uuid: 'shift-1', user_id: 'user-1', user_name: 'ユーザー1',
                 time_slot: '13:00-13:30', date: '2026-04-17', created_at: '2026-04-10T00:00:00Z' }],
      }),
      getAllSpecialShiftApplications: jest.fn().mockResolvedValue({
        success: true,
        data: [{ uuid: 'app-1', user_id: 'user-1', user_name: 'ユーザー1',
                 time_slot: '10:00-10:30', date: '2026-04-20', created_at: '2026-04-17T00:00:00Z' }],
      }),
    };
    let capturedShifts;
    global.displayMyShifts = jest.fn((_, shifts) => { capturedShifts = shifts; });

    await loadMyShifts();

    expect(capturedShifts.length).toBe(2);
    expect(capturedShifts.find(s => s.uuid === 'shift-1').isSpecial).toBe(false);
    expect(capturedShifts.find(s => s.uuid === 'app-1').isSpecial).toBe(true);
  });
});

// ============================================================
// displayMyShifts - 特別シフト行に「特別」バッジを表示
// ============================================================
describe('displayMyShifts - 特別シフトに「特別」バッジを表示', () => {
  const setupDOM = () => {
    document.body.innerHTML = `<div id="myShiftsContent"></div>`;
  };

  const setupGlobals = () => {
    global.getScrollToShiftAfterLoad = jest.fn(() => null);
    global.setScrollToShiftAfterLoad = jest.fn();
    global.createBulkActionBarHTML   = jest.fn(() => '');
    global.setupMyShiftsCheckboxListeners = jest.fn();
    global.mergeConsecutiveTimeSlots = jest.fn(slots => slots);
    global.console = { ...console, log: jest.fn(), error: jest.fn() };
  };

  const defineDisplayMyShifts = () => {
    global.displayMyShifts = function(container, shiftsData) {
      if (!shiftsData || shiftsData.length === 0) {
        container.innerHTML = '<div class="no-shifts-message"></div>';
        return;
      }

      // 通常シフトと特別シフトを分離
      const regularShifts = shiftsData.filter(s => !s.isSpecial);
      const specialShifts  = shiftsData.filter(s => s.isSpecial);

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
          shiftDate: shift.shiftDate,
          timeSlot: shift.timeSlot,
          uuids: [shift.uuid],
          registrationDate: shift.registrationDate,
          isSpecial: true,
        });
      });

      rows.sort((a, b) => new Date(a.shiftDate) - new Date(b.shiftDate));

      let html = `${createBulkActionBarHTML('myShiftsBulkActionBar', 'myShiftsSelectedCount', 'myShiftsBulkDeleteBtn')}
        <div class="my-shifts-table-container">
          <table class="my-shifts-table">
            <tbody>`;

      rows.forEach(row => {
        const badge = row.isSpecial ? '<span class="special-badge">特別</span>' : '';
        html += `<tr data-date="${row.shiftDate}" data-is-special="${row.isSpecial}">
          <td class="shift-date">${row.shiftDate}</td>
          <td class="shift-time">${row.timeSlot}${badge}</td>
          <td class="shift-actions"></td>
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

  test('特別シフト行に「特別」バッジが表示される', () => {
    const container = document.getElementById('myShiftsContent');
    displayMyShifts(container, [
      { shiftDate: '2026-04-20', timeSlot: '10:00-10:30', uuid: 'app-1',
        registrationDate: '2026-04-17T00:00:00Z', isSpecial: true },
    ]);

    expect(container.querySelector('.special-badge')).not.toBeNull();
    expect(container.querySelector('.special-badge').textContent).toBe('特別');
  });

  test('通常シフト行には「特別」バッジが表示されない', () => {
    const container = document.getElementById('myShiftsContent');
    displayMyShifts(container, [
      { shiftDate: '2026-04-17', timeSlot: '13:00-13:30', uuid: 'shift-1',
        registrationDate: '2026-04-10T00:00:00Z', isSpecial: false },
    ]);

    expect(container.querySelector('.special-badge')).toBeNull();
  });

  test('通常シフトと特別シフトが混在していても両方表示される', () => {
    const container = document.getElementById('myShiftsContent');
    displayMyShifts(container, [
      { shiftDate: '2026-04-17', timeSlot: '13:00-13:30', uuid: 'shift-1',
        registrationDate: '2026-04-10T00:00:00Z', isSpecial: false },
      { shiftDate: '2026-04-20', timeSlot: '10:00-10:30', uuid: 'app-1',
        registrationDate: '2026-04-17T00:00:00Z', isSpecial: true },
    ]);

    const rows = container.querySelectorAll('tr');
    expect(rows.length).toBe(2);
    expect(container.querySelectorAll('.special-badge').length).toBe(1);
  });

  test('日付昇順にソートされる', () => {
    const container = document.getElementById('myShiftsContent');
    displayMyShifts(container, [
      { shiftDate: '2026-04-20', timeSlot: '10:00-10:30', uuid: 'app-1',
        registrationDate: '2026-04-17T00:00:00Z', isSpecial: true },
      { shiftDate: '2026-04-17', timeSlot: '13:00-13:30', uuid: 'shift-1',
        registrationDate: '2026-04-10T00:00:00Z', isSpecial: false },
    ]);

    const rows = container.querySelectorAll('tr');
    expect(rows[0].dataset.date).toBe('2026-04-17');
    expect(rows[1].dataset.date).toBe('2026-04-20');
  });
});

// ============================================================
// loadAllShiftsTable - 特別シフト申請を含めて表示
// ============================================================
describe('loadAllShiftsTable - 特別シフト申請を含む', () => {
  const setupDOM = () => {
    document.body.innerHTML = `<div id="allShiftsTableContent"></div>`;
  };

  const defineLoadAllShiftsTable = () => {
    global.loadAllShiftsTable = async function(page = 1) {
      const container = document.getElementById('allShiftsTableContent');
      const [regularResult, specialResult] = await Promise.all([
        API.getAllShifts(),
        API.getAllSpecialShiftApplications(),
      ]);

      const regularShifts = (regularResult.data || []);
      const specialShifts = (specialResult.data || []).map(s => ({
        ...s, is_special: true, calendar_event_id: null,
      }));

      const allShifts = [...regularShifts, ...specialShifts];
      displayAllShiftsTable(allShifts, page, 50);
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupDOM();
    global.displayAllShiftsTable = jest.fn();
    global.console = { ...console, log: jest.fn(), error: jest.fn() };
    defineLoadAllShiftsTable();
  });

  test('通常シフトと特別シフト両方のAPIを呼び出す', async () => {
    global.API = {
      getAllShifts: jest.fn().mockResolvedValue({ success: true, data: [] }),
      getAllSpecialShiftApplications: jest.fn().mockResolvedValue({ success: true, data: [] }),
    };

    await loadAllShiftsTable();

    expect(API.getAllShifts).toHaveBeenCalled();
    expect(API.getAllSpecialShiftApplications).toHaveBeenCalled();
  });

  test('特別シフトは is_special: true でマージされる', async () => {
    global.API = {
      getAllShifts: jest.fn().mockResolvedValue({ success: true, data: [
        { uuid: 'shift-1', user_id: 'user-1', user_name: 'ユーザー1',
          date: '2026-04-17', time_slot: '13:00-13:30', created_at: '2026-04-10T00:00:00Z',
          calendar_event_id: 'cal-1' }
      ]}),
      getAllSpecialShiftApplications: jest.fn().mockResolvedValue({ success: true, data: [
        { uuid: 'app-1', user_id: 'user-1', user_name: 'ユーザー1',
          date: '2026-04-20', time_slot: '10:00-10:30', created_at: '2026-04-17T00:00:00Z' }
      ]}),
    };

    let capturedShifts;
    global.displayAllShiftsTable = jest.fn((shifts) => { capturedShifts = shifts; });

    await loadAllShiftsTable();

    expect(capturedShifts.length).toBe(2);
    const specialEntry = capturedShifts.find(s => s.uuid === 'app-1');
    expect(specialEntry.is_special).toBe(true);
    expect(specialEntry.calendar_event_id).toBeNull();
    const regularEntry = capturedShifts.find(s => s.uuid === 'shift-1');
    expect(regularEntry.is_special).toBeUndefined();
  });
});

// ============================================================
// displayAllShiftsTable - 特別シフト行の表示
// ============================================================
describe('displayAllShiftsTable - 特別シフト行の表示', () => {
  const setupDOM = () => {
    document.body.innerHTML = `<div id="allShiftsTableContent"></div>`;
  };

  const setupHelpers = () => {
    global.escapeHtml = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    global.formatDateWithWeekday = d => d;
    global.formatDateTime = d => d;
    global.createBulkActionBarHTML = jest.fn(() => '');
    global.generateFilterUI = jest.fn(() => '');
    global.setupFilterEventListeners = jest.fn();
    global.setupAllShiftsCheckboxListeners = jest.fn();
    global.generateAllShiftsPagination = jest.fn(() => '');
    global.applyFilters = jest.fn(shifts => shifts);
    global.console = { ...console, log: jest.fn(), error: jest.fn() };
  };

  const defineDisplayAllShiftsTable = () => {
    global.displayAllShiftsTable = function(shifts, currentPage = 1, itemsPerPage = 50) {
      const container = document.getElementById('allShiftsTableContent');
      const filtered = applyFilters(shifts);
      if (!filtered.length) {
        container.innerHTML = '<p>登録されているシフトはありません</p>';
        return;
      }

      const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));

      let html = `${createBulkActionBarHTML()}${generateFilterUI(shifts)}
        <table class="all-shifts-table"><tbody>`;

      sorted.forEach(shift => {
        const calendarCell = shift.is_special
          ? '<span class="special-shift-label">特別</span>'
          : (shift.calendar_event_id
              ? '<span style="color:#4CAF50;">✓</span>'
              : '<span style="color:#999;">-</span>');

        html += `<tr data-shift-uuid="${escapeHtml(shift.uuid)}" data-is-special="${!!shift.is_special}">
          <td>${escapeHtml(shift.user_name)}</td>
          <td>${formatDateWithWeekday(shift.date)}</td>
          <td>${escapeHtml(shift.time_slot)}</td>
          <td>${formatDateTime(shift.created_at)}</td>
          <td class="calendar-cell">${calendarCell}</td>
          <td><button class="delete-shift-table-btn" data-shift-uuid="${escapeHtml(shift.uuid)}">削除</button></td>
        </tr>`;
      });

      html += `</tbody></table>`;
      container.innerHTML = html;
      setupFilterEventListeners();
      setupAllShiftsCheckboxListeners();
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupDOM();
    setupHelpers();
    defineDisplayAllShiftsTable();
  });

  test('特別シフト行に「特別」ラベルが表示される', () => {
    displayAllShiftsTable([
      { uuid: 'app-1', user_name: 'ユーザー1', date: '2026-04-20',
        time_slot: '10:00-10:30', created_at: '2026-04-17T00:00:00Z',
        is_special: true, calendar_event_id: null },
    ]);

    expect(document.querySelector('.special-shift-label')).not.toBeNull();
    expect(document.querySelector('.special-shift-label').textContent).toBe('特別');
  });

  test('通常シフト行にはカレンダー同期状態が表示される', () => {
    displayAllShiftsTable([
      { uuid: 'shift-1', user_name: 'ユーザー1', date: '2026-04-17',
        time_slot: '13:00-13:30', created_at: '2026-04-10T00:00:00Z',
        calendar_event_id: 'cal-1' },
    ]);

    expect(document.querySelector('.special-shift-label')).toBeNull();
    expect(document.querySelector('.calendar-cell').textContent).toBe('✓');
  });

  test('通常シフトと特別シフトが混在していても両方表示される', () => {
    displayAllShiftsTable([
      { uuid: 'shift-1', user_name: 'ユーザー1', date: '2026-04-17',
        time_slot: '13:00-13:30', created_at: '2026-04-10T00:00:00Z',
        calendar_event_id: 'cal-1' },
      { uuid: 'app-1', user_name: 'ユーザー2', date: '2026-04-20',
        time_slot: '10:00-10:30', created_at: '2026-04-17T00:00:00Z',
        is_special: true, calendar_event_id: null },
    ]);

    expect(document.querySelectorAll('tr').length).toBe(2);
    expect(document.querySelectorAll('.special-shift-label').length).toBe(1);
  });
});

// ============================================================
// displayShiftList (管理画面) - allShiftsData に特別シフトを含む
// ============================================================
describe('displayShiftList - 特別シフトを allShiftsData に含む', () => {
  const setupDOM = () => {
    document.body.innerHTML = `<div id="shiftCalendarContainer"></div>`;
  };

  const defineDisplayShiftList = () => {
    global.displayShiftList = async function() {
      const container = document.getElementById('shiftCalendarContainer');
      const [shiftsResult, specialResult] = await Promise.all([
        API.getAllShifts(),
        API.getAllSpecialShiftApplications(),
      ]);

      const regularShifts = (shiftsResult.data || []).map(s => ({
        shiftDate: s.date, timeSlot: s.time_slot,
        userId: s.user_id, userName: s.user_name,
        uuid: s.uuid, registrationDate: s.created_at,
        isSpecial: false,
      }));

      const specialShifts = (specialResult.data || []).map(s => ({
        shiftDate: s.date, timeSlot: s.time_slot,
        userId: s.user_id, userName: s.user_name,
        uuid: s.uuid, registrationDate: s.created_at,
        isSpecial: true,
      }));

      const allShifts = [...regularShifts, ...specialShifts];
      setAllShiftsData(allShifts);
      generateCalendar('shiftCalendarContainer');
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupDOM();
    global.setAllShiftsData  = jest.fn();
    global.generateCalendar  = jest.fn();
    global.console = { ...console, log: jest.fn(), error: jest.fn() };
    defineDisplayShiftList();
  });

  test('通常シフトと特別シフト両方のAPIを呼び出す', async () => {
    global.API = {
      getAllShifts: jest.fn().mockResolvedValue({ success: true, data: [] }),
      getAllSpecialShiftApplications: jest.fn().mockResolvedValue({ success: true, data: [] }),
    };

    await displayShiftList();

    expect(API.getAllShifts).toHaveBeenCalled();
    expect(API.getAllSpecialShiftApplications).toHaveBeenCalled();
  });

  test('特別シフトは isSpecial: true で allShiftsData に含まれる', async () => {
    global.API = {
      getAllShifts: jest.fn().mockResolvedValue({ success: true, data: [
        { uuid: 'shift-1', date: '2026-04-17', time_slot: '13:00-13:30',
          user_id: 'user-1', user_name: 'ユーザー1', created_at: '2026-04-10T00:00:00Z' },
      ]}),
      getAllSpecialShiftApplications: jest.fn().mockResolvedValue({ success: true, data: [
        { uuid: 'app-1', date: '2026-04-20', time_slot: '10:00-10:30',
          user_id: 'user-1', user_name: 'ユーザー1', created_at: '2026-04-17T00:00:00Z' },
      ]}),
    };

    await displayShiftList();

    const captured = setAllShiftsData.mock.calls[0][0];
    expect(captured.length).toBe(2);
    expect(captured.find(s => s.uuid === 'app-1').isSpecial).toBe(true);
    expect(captured.find(s => s.uuid === 'shift-1').isSpecial).toBe(false);
  });
});
