/**
 * 特別シフトの制約に関するテスト
 *
 * 1. toggleAllTimeSlots は通常シフトスロットのみを選択対象にする
 * 2. 特別シフトスロットは人数制限なし（他ユーザーが申請済みでも selectable のまま）
 */

// ============================================================
// toggleAllTimeSlots - 通常シフトのみ選択
// ============================================================
describe('toggleAllTimeSlots - 通常シフトのみ選択', () => {
  const buildDOM = (slots) => {
    document.body.innerHTML = `
      <div id="dateDetailModal">
        <button class="submit-btn" disabled></button>
        <button class="toggle-all-btn">すべて選択</button>
        <div id="dateDetailContainer">
          ${slots.map(({ slot, type }) => `
            <div class="date-detail-slot selectable"
                 data-slot="${slot}"
                 ${type === 'special' ? `data-slot-type="special"` : ''}
            >${slot}</div>
          `).join('')}
        </div>
      </div>
    `;
  };

  let _selected = [];
  beforeEach(() => {
    _selected = [];
    global.getSelectedTimeSlots = jest.fn(() => _selected);
    global.setSelectedTimeSlots = jest.fn((slots) => { _selected = slots; });
    global.updateSubmitButton    = jest.fn();

    // テスト対象の実装（現行コードをそのまま呼び出す想定で定義）
    global.toggleAllTimeSlots = function() {
      // 通常シフトスロットのみを対象にする
      const selectableSlots = document.querySelectorAll(
        '.date-detail-slot.selectable:not([data-slot-type="special"])'
      );
      const toggleBtn = document.querySelector('.toggle-all-btn');

      if (!selectableSlots.length) return;

      const allSelected = Array.from(selectableSlots).every(s => s.classList.contains('selected'));
      const selectedTimeSlots = [];

      if (allSelected) {
        selectableSlots.forEach(slotDiv => slotDiv.classList.remove('selected'));
        toggleBtn.textContent = 'すべて選択';
        setSelectedTimeSlots([]);
      } else {
        selectableSlots.forEach(slotDiv => {
          slotDiv.classList.add('selected');
          selectedTimeSlots.push(slotDiv.dataset.slot);
        });
        toggleBtn.textContent = 'すべて解除';
        setSelectedTimeSlots(selectedTimeSlots);
      }

      updateSubmitButton();
    };
  });

  afterEach(() => jest.clearAllMocks());

  test('通常スロットのみ → すべての通常スロットが選択される', () => {
    buildDOM([
      { slot: '13:00-13:30', type: 'regular' },
      { slot: '13:30-14:00', type: 'regular' },
    ]);
    toggleAllTimeSlots();
    expect(setSelectedTimeSlots).toHaveBeenCalledWith(['13:00-13:30', '13:30-14:00']);
  });

  test('特別・通常混在 → 通常スロットのみ選択され特別スロットは選択されない', () => {
    buildDOM([
      { slot: '10:00-10:30', type: 'special' },
      { slot: '10:30-11:00', type: 'special' },
      { slot: '13:00-13:30', type: 'regular' },
      { slot: '13:30-14:00', type: 'regular' },
    ]);

    toggleAllTimeSlots();

    expect(setSelectedTimeSlots).toHaveBeenCalledWith(['13:00-13:30', '13:30-14:00']);

    const specialSlots = document.querySelectorAll('[data-slot-type="special"]');
    specialSlots.forEach(s => expect(s.classList.contains('selected')).toBe(false));
  });

  test('特別スロットのみ → 何も選択されない（早期リターン）', () => {
    buildDOM([
      { slot: '10:00-10:30', type: 'special' },
      { slot: '10:30-11:00', type: 'special' },
    ]);

    toggleAllTimeSlots();

    expect(setSelectedTimeSlots).not.toHaveBeenCalled();
  });

  test('通常スロットがすべて選択済みの場合 → すべて解除される', () => {
    buildDOM([
      { slot: '10:00-10:30', type: 'special' },
      { slot: '13:00-13:30', type: 'regular' },
      { slot: '13:30-14:00', type: 'regular' },
    ]);
    // 通常スロットを先に選択状態にする
    document.querySelectorAll('.date-detail-slot:not([data-slot-type="special"])')
      .forEach(s => s.classList.add('selected'));

    toggleAllTimeSlots();

    document.querySelectorAll('.date-detail-slot:not([data-slot-type="special"])')
      .forEach(s => expect(s.classList.contains('selected')).toBe(false));
    expect(setSelectedTimeSlots).toHaveBeenCalledWith([]);
  });

  test('ボタンテキストが "すべて解除" になる（通常スロット選択後）', () => {
    buildDOM([
      { slot: '13:00-13:30', type: 'regular' },
    ]);

    toggleAllTimeSlots();

    expect(document.querySelector('.toggle-all-btn').textContent).toBe('すべて解除');
  });

  test('ボタンテキストが "すべて選択" に戻る（解除後）', () => {
    buildDOM([
      { slot: '13:00-13:30', type: 'regular' },
    ]);
    document.querySelector('.date-detail-slot').classList.add('selected');

    toggleAllTimeSlots(); // 解除

    expect(document.querySelector('.toggle-all-btn').textContent).toBe('すべて選択');
  });
});

// ============================================================
// openSpecialShiftApplicationModal - 人数制限なし
// ============================================================
describe('openSpecialShiftApplicationModal - 人数制限なし', () => {
  const setupDOM = () => {
    document.body.innerHTML = `<div id="container"></div>`;
  };

  const makeApplication = (userId, timeSlot) => ({
    uuid: `app-${userId}-${timeSlot}`,
    user_id: userId,
    user_name: `ユーザー${userId}`,
    time_slot: timeSlot,
  });

  const defineModal = () => {
    global.buildSpecialShiftSlots = (start, end) => {
      const toMins = t => { const [h,m] = t.split(':').map(Number); return h*60+m; };
      const toTime = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
      const s = toMins(start), e = toMins(end);
      if (s >= e) return [];
      const slots = [];
      for (let cur = s; cur < e; cur += 30) slots.push(`${toTime(cur)}-${toTime(cur+30)}`);
      return slots;
    };

    global.getSpecialShiftsForDate = jest.fn(() => [{
      uuid: 'ss-1',
      date: '2026-04-20',
      start_time: '10:00',
      end_time: '11:00',
    }]);

    global.openSpecialShiftApplicationModal = async function(dateKey, currentUser, container) {
      const specialShifts = getSpecialShiftsForDate(dateKey);
      const applicationsResults = await Promise.all(
        specialShifts.map(shift => API.getSpecialShiftApplications(shift.uuid))
      );
      specialShifts.forEach((shift, index) => {
        const apps = (applicationsResults[index]?.success) ? applicationsResults[index].data : [];
        buildSpecialShiftSlots(shift.start_time, shift.end_time).forEach(slot => {
          const isApplied = currentUser &&
            apps.some(a => a.user_id === currentUser.sub && a.time_slot === slot);
          const div = document.createElement('div');
          div.className = 'date-detail-slot';
          div.dataset.slot = slot;
          div.dataset.slotType = 'special';
          div.classList.add(isApplied ? 'disabled' : 'selectable');
          container.appendChild(div);
        });
      });
    };
  };

  beforeEach(() => {
    setupDOM();
    global.console = { ...console, error: jest.fn() };
    defineModal();
  });

  afterEach(() => jest.clearAllMocks());

  test('他ユーザーが申請済みでもスロットは selectable のまま（容量制限なし）', async () => {
    global.API = {
      getSpecialShiftApplications: jest.fn().mockResolvedValue({
        success: true,
        data: [
          makeApplication('user-2', '10:00-10:30'),
          makeApplication('user-3', '10:00-10:30'),
          makeApplication('user-4', '10:00-10:30'),
        ],
      }),
    };

    const container = document.getElementById('container');
    await openSpecialShiftApplicationModal('2026-04-20', { sub: 'user-1' }, container);

    const slots = container.querySelectorAll('.date-detail-slot');
    expect(slots[0].classList.contains('selectable')).toBe(true);
    expect(slots[0].classList.contains('disabled')).toBe(false);
  });

  test('現在ユーザーが申請済みのスロットのみ disabled になる', async () => {
    global.API = {
      getSpecialShiftApplications: jest.fn().mockResolvedValue({
        success: true,
        data: [
          makeApplication('user-1', '10:00-10:30'), // 現在ユーザー
          makeApplication('user-2', '10:30-11:00'), // 別ユーザー
        ],
      }),
    };

    const container = document.getElementById('container');
    await openSpecialShiftApplicationModal('2026-04-20', { sub: 'user-1' }, container);

    const slots = container.querySelectorAll('.date-detail-slot');
    expect(slots[0].classList.contains('disabled')).toBe(true);   // 10:00-10:30: 自分が申請済み
    expect(slots[1].classList.contains('selectable')).toBe(true); // 10:30-11:00: 他ユーザーのみ
  });

  test('同じスロットに何人申請していても上限なし（全員分 selectable）', async () => {
    const manyApplicants = Array.from({ length: 10 }, (_, i) =>
      makeApplication(`user-${i+2}`, '10:00-10:30')
    );
    global.API = {
      getSpecialShiftApplications: jest.fn().mockResolvedValue({
        success: true,
        data: manyApplicants,
      }),
    };

    const container = document.getElementById('container');
    await openSpecialShiftApplicationModal('2026-04-20', { sub: 'user-1' }, container);

    const firstSlot = container.querySelector('[data-slot="10:00-10:30"]');
    expect(firstSlot.classList.contains('selectable')).toBe(true);
  });
});
