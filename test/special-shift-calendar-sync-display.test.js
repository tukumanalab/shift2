/**
 * 全シフト一覧テーブルで特別シフトのカレンダー同期状態を表示するテスト（TDD）
 */

// ============================================================
// loadAllShiftsTable - 特別シフトの calendar_event_id を保持する
// ============================================================
describe('loadAllShiftsTable - 特別シフトの calendar_event_id を API から受け取る', () => {
  const setupDOM = () => {
    document.body.innerHTML = `<div id="allShiftsTableContent"></div>`;
  };

  const defineLoadAllShiftsTable = () => {
    global.loadAllShiftsTable = async function(page = 1) {
      const [shiftsResult, specialResult] = await Promise.all([
        API.getAllShifts(),
        API.getAllSpecialShiftApplications()
      ]);

      const regularShifts = shiftsResult.data || [];
      // calendar_event_id: null をハードコードせず、APIの値をそのまま使う
      const specialShifts = (specialResult.success && specialResult.data || []).map(app => ({
        ...app, is_special: true
      }));

      displayAllShiftsTable([...regularShifts, ...specialShifts], page, 50);
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupDOM();
    global.displayAllShiftsTable = jest.fn();
    global.console = { ...console, log: jest.fn(), error: jest.fn() };
    defineLoadAllShiftsTable();
  });

  test('同期済み特別シフトの calendar_event_id が保持される', async () => {
    global.API = {
      getAllShifts: jest.fn().mockResolvedValue({ success: true, data: [] }),
      getAllSpecialShiftApplications: jest.fn().mockResolvedValue({
        success: true,
        data: [{ uuid: 'app-1', user_id: 'user-1', user_name: 'ユーザー1',
                 date: '2026-04-20', time_slot: '10:00-10:30',
                 created_at: '2026-04-17T00:00:00Z',
                 calendar_event_id: 'cal-event-123' }]
      }),
    };

    await loadAllShiftsTable();

    const captured = displayAllShiftsTable.mock.calls[0][0];
    const special = captured.find(s => s.uuid === 'app-1');
    expect(special.calendar_event_id).toBe('cal-event-123');
    expect(special.is_special).toBe(true);
  });

  test('未同期の特別シフトは calendar_event_id が null', async () => {
    global.API = {
      getAllShifts: jest.fn().mockResolvedValue({ success: true, data: [] }),
      getAllSpecialShiftApplications: jest.fn().mockResolvedValue({
        success: true,
        data: [{ uuid: 'app-1', user_id: 'user-1', user_name: 'ユーザー1',
                 date: '2026-04-20', time_slot: '10:00-10:30',
                 created_at: '2026-04-17T00:00:00Z',
                 calendar_event_id: null }]
      }),
    };

    await loadAllShiftsTable();

    const captured = displayAllShiftsTable.mock.calls[0][0];
    const special = captured.find(s => s.uuid === 'app-1');
    expect(special.calendar_event_id).toBeNull();
  });
});

// ============================================================
// displayAllShiftsTable - 特別シフトのカレンダー同期状態を表示
// ============================================================
describe('displayAllShiftsTable - 特別シフトのカレンダー同期状態を表示', () => {
  const setupDOM = () => {
    document.body.innerHTML = `<div id="allShiftsTableContent"></div>`;
  };

  const setupHelpers = () => {
    global.escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    global.formatDateWithWeekday = d => d;
    global.formatDateTime = d => d;
    global.createBulkActionBarHTML = jest.fn(() => '');
    global.generateFilterUI = jest.fn(() => '');
    global.setupFilterEventListeners = jest.fn();
    global.setupAllShiftsCheckboxListeners = jest.fn();
    global.generateAllShiftsPagination = jest.fn(() => '');
    global.applyFilters = jest.fn(shifts => shifts);
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
      const totalItems = sorted.length;
      const totalPages = Math.ceil(totalItems / itemsPerPage);
      const startIdx = (currentPage - 1) * itemsPerPage;
      const pageShifts = sorted.slice(startIdx, startIdx + itemsPerPage);

      let html = `${createBulkActionBarHTML()}${generateFilterUI(shifts)}
        <table class="all-shifts-table"><thead><tr>
          <th></th><th>ユーザー名</th><th>日付</th><th>時間帯</th>
          <th>作成日時</th><th>カレンダー同期</th><th>操作</th>
        </tr></thead><tbody>`;

      pageShifts.forEach(shift => {
        // 通常・特別どちらも calendar_event_id で同期状態を表示
        const syncCell = shift.calendar_event_id
          ? '<span class="calendar-synced">✓</span>'
          : '<span class="calendar-unsynced">-</span>';
        const specialBadge = shift.is_special
          ? ' <span class="special-badge">特別</span>'
          : '';

        html += `<tr data-shift-uuid="${escapeHtml(shift.uuid)}" data-is-special="${!!shift.is_special}">
          <td><input type="checkbox" class="shift-row-checkbox" data-shift-uuid="${escapeHtml(shift.uuid)}"></td>
          <td>${escapeHtml(shift.user_name)}</td>
          <td>${formatDateWithWeekday(shift.date)}</td>
          <td>${escapeHtml(shift.time_slot)}${specialBadge}</td>
          <td>${formatDateTime(shift.created_at)}</td>
          <td class="calendar-cell">${syncCell}</td>
          <td><button class="delete-shift-table-btn" data-shift-uuid="${escapeHtml(shift.uuid)}">削除</button></td>
        </tr>`;
      });

      html += `</tbody></table>${totalPages > 1 ? generateAllShiftsPagination(currentPage, totalPages, totalItems) : ''}`;
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

  test('同期済み特別シフトは ✓ を表示する', () => {
    displayAllShiftsTable([
      { uuid: 'app-1', user_name: 'ユーザー1', date: '2026-04-20',
        time_slot: '10:00-10:30', created_at: '2026-04-17T00:00:00Z',
        is_special: true, calendar_event_id: 'cal-event-123' }
    ]);

    const syncCell = document.querySelector('[data-is-special="true"] .calendar-cell');
    expect(syncCell.textContent.trim()).toBe('✓');
    expect(syncCell.querySelector('.calendar-synced')).not.toBeNull();
  });

  test('未同期の特別シフトは - を表示する', () => {
    displayAllShiftsTable([
      { uuid: 'app-1', user_name: 'ユーザー1', date: '2026-04-20',
        time_slot: '10:00-10:30', created_at: '2026-04-17T00:00:00Z',
        is_special: true, calendar_event_id: null }
    ]);

    const syncCell = document.querySelector('[data-is-special="true"] .calendar-cell');
    expect(syncCell.textContent.trim()).toBe('-');
    expect(syncCell.querySelector('.calendar-unsynced')).not.toBeNull();
  });

  test('同期済み通常シフトは ✓ を表示する', () => {
    displayAllShiftsTable([
      { uuid: 'shift-1', user_name: 'ユーザー1', date: '2026-04-17',
        time_slot: '13:00-13:30', created_at: '2026-04-10T00:00:00Z',
        calendar_event_id: 'cal-1' }
    ]);

    const syncCell = document.querySelector('[data-is-special="false"] .calendar-cell');
    expect(syncCell.textContent.trim()).toBe('✓');
  });

  test('未同期の通常シフトは - を表示する', () => {
    displayAllShiftsTable([
      { uuid: 'shift-1', user_name: 'ユーザー1', date: '2026-04-17',
        time_slot: '13:00-13:30', created_at: '2026-04-10T00:00:00Z',
        calendar_event_id: null }
    ]);

    const syncCell = document.querySelector('[data-is-special="false"] .calendar-cell');
    expect(syncCell.textContent.trim()).toBe('-');
  });

  test('特別シフトの時間帯列に「特別」バッジが表示される', () => {
    displayAllShiftsTable([
      { uuid: 'app-1', user_name: 'ユーザー1', date: '2026-04-20',
        time_slot: '10:00-10:30', created_at: '2026-04-17T00:00:00Z',
        is_special: true, calendar_event_id: null }
    ]);

    const timeCell = document.querySelector('[data-is-special="true"] td:nth-child(4)');
    expect(timeCell.querySelector('.special-badge')).not.toBeNull();
  });

  test('通常シフトの時間帯列に「特別」バッジは表示されない', () => {
    displayAllShiftsTable([
      { uuid: 'shift-1', user_name: 'ユーザー1', date: '2026-04-17',
        time_slot: '13:00-13:30', created_at: '2026-04-10T00:00:00Z',
        calendar_event_id: 'cal-1' }
    ]);

    expect(document.querySelector('.special-badge')).toBeNull();
  });
});
