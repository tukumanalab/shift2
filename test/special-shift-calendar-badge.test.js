/**
 * カレンダー「シフト一覧」で特別シフトを識別できるようにするテスト（TDD）
 */

describe('displayShiftsForDate - 特別シフトに視覚的な識別子を表示', () => {
  const setupDOM = () => {
    document.body.innerHTML = `<div id="shift-container"></div>`;
  };

  const setupGlobals = () => {
    global.isAdmin       = jest.fn(() => false);
    global.getShiftDisplayName = jest.fn(shift => shift.userName || '名前未設定');
    global.mergeConsecutiveTimeSlots = function(slots) {
      if (!slots || !slots.length) return [];
      const sorted = [...slots].sort();
      let start = sorted[0].split('-')[0];
      let end   = sorted[0].split('-')[1];
      const merged = [];
      for (let i = 1; i < sorted.length; i++) {
        const [ns, ne] = sorted[i].split('-');
        if (end === ns) { end = ne; } else { merged.push(`${start}-${end}`); start = ns; end = ne; }
      }
      merged.push(`${start}-${end}`);
      return merged;
    };
    global.mergeShiftsByPerson = function(shiftsForDate) {
      const byPerson = {};
      shiftsForDate.forEach(shift => {
        const key = `${getShiftDisplayName(shift)}_${shift.userId}_${shift.isSpecial ? 'special' : 'regular'}`;
        if (!byPerson[key]) byPerson[key] = { person: shift, shiftsData: [] };
        byPerson[key].shiftsData.push({ timeSlot: shift.timeSlot, uuid: shift.uuid });
      });
      const merged = [];
      Object.values(byPerson).forEach(({ person, shiftsData }) => {
        mergeConsecutiveTimeSlots(shiftsData.map(s => s.timeSlot)).forEach(slot => {
          const uuids = shiftsData.filter(s => {
            const [ms, me] = slot.split('-');
            const [ss, se] = s.timeSlot.split('-');
            return ss >= ms && se <= me;
          }).map(s => s.uuid);
          merged.push({ ...person, timeSlot: slot, uuids });
        });
      });
      return merged;
    };
  };

  const defineDisplayShiftsForDate = () => {
    global.displayShiftsForDate = function(container, dateKey) {
      if (!window.allShiftsData) return;
      const shiftsForDate = window.allShiftsData.filter(s => s.shiftDate === dateKey);
      if (!shiftsForDate.length) return;

      const mergedShifts = mergeShiftsByPerson(shiftsForDate);

      // 時間帯ごとにグループ化
      const timeSlotGroups = {};
      mergedShifts.forEach(shift => {
        if (!timeSlotGroups[shift.timeSlot]) timeSlotGroups[shift.timeSlot] = [];
        timeSlotGroups[shift.timeSlot].push(shift);
      });

      Object.keys(timeSlotGroups).sort().forEach(timeSlot => {
        const timeSlotDiv = document.createElement('div');
        timeSlotDiv.className = 'shift-time-slot';

        const timeLabel = document.createElement('div');
        timeLabel.className = 'shift-time-label';
        timeLabel.textContent = timeSlot;
        timeSlotDiv.appendChild(timeLabel);

        const peopleDiv = document.createElement('div');
        peopleDiv.className = 'shift-people';

        // 特別シフト名をグループヘッダーとして一度だけ表示
        const specialNames = [...new Set(
          timeSlotGroups[timeSlot]
            .filter(s => s.isSpecial && s.shiftName)
            .map(s => s.shiftName)
        )];
        specialNames.forEach(name => {
          const nameLabel = document.createElement('div');
          nameLabel.className = 'shift-name-label';
          nameLabel.textContent = name;
          peopleDiv.appendChild(nameLabel);
        });

        timeSlotGroups[timeSlot].forEach(shift => {
          const personDiv = document.createElement('div');
          // 特別シフトには追加クラスを付与
          personDiv.className = 'shift-person' + (shift.isSpecial ? ' shift-person--special' : '');
          personDiv.title = getShiftDisplayName(shift);

          // 管理者はチェックボックスを最初に追加
          if (isAdmin()) {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'calendar-shift-checkbox';
            checkbox.setAttribute('data-uuids', (shift.uuids || []).join(','));
            personDiv.appendChild(checkbox);
          }

          // 特別シフトにはバッジを名前の前に追加
          if (shift.isSpecial) {
            const badge = document.createElement('span');
            badge.className = 'special-badge';
            badge.textContent = '特別';
            personDiv.appendChild(badge);
          }

          const nameSpan = document.createElement('span');
          nameSpan.textContent = getShiftDisplayName(shift);
          personDiv.appendChild(nameSpan);

          peopleDiv.appendChild(personDiv);
        });

        timeSlotDiv.appendChild(peopleDiv);
        container.appendChild(timeSlotDiv);
      });
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupDOM();
    setupGlobals();
    defineDisplayShiftsForDate();
    window.allShiftsData = null;
  });

  test('特別シフトの personDiv に shift-person--special クラスが付く', () => {
    window.allShiftsData = [
      { shiftDate: '2026-04-20', timeSlot: '09:30-10:00', uuid: 'app-1',
        userId: 'user-1', userName: 'ユーザー1', isSpecial: true },
    ];

    const container = document.getElementById('shift-container');
    displayShiftsForDate(container, '2026-04-20');

    const personDiv = container.querySelector('.shift-person');
    expect(personDiv).not.toBeNull();
    expect(personDiv.classList.contains('shift-person--special')).toBe(true);
  });

  test('特別シフトに「特別」バッジが表示される', () => {
    window.allShiftsData = [
      { shiftDate: '2026-04-20', timeSlot: '09:30-10:00', uuid: 'app-1',
        userId: 'user-1', userName: 'ユーザー1', isSpecial: true },
    ];

    const container = document.getElementById('shift-container');
    displayShiftsForDate(container, '2026-04-20');

    const badge = container.querySelector('.special-badge');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe('特別');
  });

  test('通常シフトには shift-person--special クラスが付かない', () => {
    window.allShiftsData = [
      { shiftDate: '2026-04-20', timeSlot: '13:00-13:30', uuid: 'shift-1',
        userId: 'user-1', userName: 'ユーザー1', isSpecial: false },
    ];

    const container = document.getElementById('shift-container');
    displayShiftsForDate(container, '2026-04-20');

    const personDiv = container.querySelector('.shift-person');
    expect(personDiv.classList.contains('shift-person--special')).toBe(false);
  });

  test('通常シフトには「特別」バッジが表示されない', () => {
    window.allShiftsData = [
      { shiftDate: '2026-04-20', timeSlot: '13:00-13:30', uuid: 'shift-1',
        userId: 'user-1', userName: 'ユーザー1', isSpecial: false },
    ];

    const container = document.getElementById('shift-container');
    displayShiftsForDate(container, '2026-04-20');

    expect(container.querySelector('.special-badge')).toBeNull();
  });

  test('バッジは名前より前に表示される', () => {
    window.allShiftsData = [
      { shiftDate: '2026-04-20', timeSlot: '09:30-10:00', uuid: 'app-1',
        userId: 'user-1', userName: 'ユーザー1', isSpecial: true },
    ];

    const container = document.getElementById('shift-container');
    displayShiftsForDate(container, '2026-04-20');

    const personDiv = container.querySelector('.shift-person');
    const children = Array.from(personDiv.children);
    const badgeIndex = children.findIndex(el => el.classList.contains('special-badge'));
    const nameIndex  = children.findIndex(el => el.tagName === 'SPAN' && !el.classList.contains('special-badge'));

    expect(badgeIndex).toBeGreaterThanOrEqual(0);
    expect(nameIndex).toBeGreaterThan(badgeIndex);
  });

  test('管理者モードでも特別シフトにバッジが表示される', () => {
    global.isAdmin = jest.fn(() => true);
    global.updateCalendarActionBar = jest.fn();

    window.allShiftsData = [
      { shiftDate: '2026-04-20', timeSlot: '09:30-10:00', uuid: 'app-1',
        userId: 'user-1', userName: 'ユーザー1', isSpecial: true },
    ];

    const container = document.getElementById('shift-container');
    displayShiftsForDate(container, '2026-04-20');

    const personDiv = container.querySelector('.shift-person');
    expect(personDiv.classList.contains('shift-person--special')).toBe(true);
    expect(container.querySelector('.special-badge')).not.toBeNull();
    expect(container.querySelector('.calendar-shift-checkbox')).not.toBeNull();
  });

  test('管理者モードでバッジはチェックボックスの次・名前の前に表示される', () => {
    global.isAdmin = jest.fn(() => true);
    global.updateCalendarActionBar = jest.fn();

    window.allShiftsData = [
      { shiftDate: '2026-04-20', timeSlot: '09:30-10:00', uuid: 'app-1',
        userId: 'user-1', userName: 'ユーザー1', isSpecial: true },
    ];

    const container = document.getElementById('shift-container');
    displayShiftsForDate(container, '2026-04-20');

    const personDiv = container.querySelector('.shift-person');
    const children = Array.from(personDiv.children);
    const checkboxIndex = children.findIndex(el => el.tagName === 'INPUT');
    const badgeIndex    = children.findIndex(el => el.classList.contains('special-badge'));
    const nameIndex     = children.findIndex(el => el.tagName === 'SPAN' && !el.classList.contains('special-badge'));

    expect(checkboxIndex).toBe(0);
    expect(badgeIndex).toBeGreaterThan(checkboxIndex);
    expect(nameIndex).toBeGreaterThan(badgeIndex);
  });

  test('通常シフトと特別シフトが混在しても正しく識別される', () => {
    window.allShiftsData = [
      { shiftDate: '2026-04-20', timeSlot: '13:00-13:30', uuid: 'shift-1',
        userId: 'user-1', userName: 'ユーザー1', isSpecial: false },
      { shiftDate: '2026-04-20', timeSlot: '09:30-10:00', uuid: 'app-1',
        userId: 'user-2', userName: 'ユーザー2', isSpecial: true },
    ];

    const container = document.getElementById('shift-container');
    displayShiftsForDate(container, '2026-04-20');

    const allPersonDivs = container.querySelectorAll('.shift-person');
    const specialDivs   = container.querySelectorAll('.shift-person--special');
    const badges        = container.querySelectorAll('.special-badge');

    expect(allPersonDivs.length).toBe(2);
    expect(specialDivs.length).toBe(1);
    expect(badges.length).toBe(1);
  });

  test('特別シフトに shiftName がある場合、名前ラベルがグループヘッダーとして表示される', () => {
    window.allShiftsData = [
      { shiftDate: '2026-04-20', timeSlot: '09:30-10:00', uuid: 'app-1',
        userId: 'user-1', userName: 'ユーザー1', isSpecial: true, shiftName: '夏期特別シフト' },
    ];

    const container = document.getElementById('shift-container');
    displayShiftsForDate(container, '2026-04-20');

    const label = container.querySelector('.shift-name-label');
    expect(label).not.toBeNull();
    expect(label.textContent).toBe('夏期特別シフト');
  });

  test('shiftName がない特別シフトには名前ラベルが表示されない', () => {
    window.allShiftsData = [
      { shiftDate: '2026-04-20', timeSlot: '09:30-10:00', uuid: 'app-1',
        userId: 'user-1', userName: 'ユーザー1', isSpecial: true, shiftName: null },
    ];

    const container = document.getElementById('shift-container');
    displayShiftsForDate(container, '2026-04-20');

    expect(container.querySelector('.shift-name-label')).toBeNull();
  });

  test('通常シフトには名前ラベルが表示されない', () => {
    window.allShiftsData = [
      { shiftDate: '2026-04-20', timeSlot: '13:00-13:30', uuid: 'shift-1',
        userId: 'user-1', userName: 'ユーザー1', isSpecial: false, shiftName: null },
    ];

    const container = document.getElementById('shift-container');
    displayShiftsForDate(container, '2026-04-20');

    expect(container.querySelector('.shift-name-label')).toBeNull();
  });

  test('同一ユーザーが通常シフトと特別シフトを両方持つ場合、特別シフトにバッジが付く', () => {
    window.allShiftsData = [
      { shiftDate: '2026-04-20', timeSlot: '16:00-18:00', uuid: 'shift-1',
        userId: 'user-1', userName: 'ユーザー1', isSpecial: false },
      { shiftDate: '2026-04-20', timeSlot: '09:00-09:30', uuid: 'app-1',
        userId: 'user-1', userName: 'ユーザー1', isSpecial: true },
      { shiftDate: '2026-04-20', timeSlot: '09:30-10:00', uuid: 'app-2',
        userId: 'user-1', userName: 'ユーザー1', isSpecial: true },
    ];

    const container = document.getElementById('shift-container');
    displayShiftsForDate(container, '2026-04-20');

    const allPersonDivs = container.querySelectorAll('.shift-person');
    const specialDivs   = container.querySelectorAll('.shift-person--special');
    const badges        = container.querySelectorAll('.special-badge');

    // 通常1エントリ + 特別（09:00-09:30 + 09:30-10:00 → 連続マージ）1エントリ = 2エントリ
    expect(allPersonDivs.length).toBe(2);
    expect(specialDivs.length).toBe(1);
    expect(badges.length).toBe(1);
  });
});
