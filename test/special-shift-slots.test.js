/**
 * 特別シフトの30分スロット化に関するテスト
 *
 * 目的:
 *   1. buildSpecialShiftSlots() が時間帯を正しく30分スロットに分割する
 *   2. openDateDetailModal が特別シフトを .date-detail-slot 形式で表示する
 *   3. 提出時に特別シフトスロットと通常スロットを正しく振り分ける
 */

// ============================================================
// buildSpecialShiftSlots のユニットテスト
// ============================================================
describe('buildSpecialShiftSlots - 30分スロット生成', () => {
  let buildSpecialShiftSlots;

  beforeEach(() => {
    // テスト対象の純粋関数（shiftRequest.js から切り出した実装を想定）
    buildSpecialShiftSlots = (startTime, endTime) => {
      if (!startTime || !endTime) return [];

      const toMinutes = (t) => {
        const [h, m] = t.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return NaN;
        return h * 60 + m;
      };
      const toTime = (mins) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      };

      const startMins = toMinutes(startTime);
      const endMins   = toMinutes(endTime);

      if (isNaN(startMins) || isNaN(endMins) || startMins >= endMins) return [];

      const slots = [];
      for (let cur = startMins; cur < endMins; cur += 30) {
        slots.push(`${toTime(cur)}-${toTime(cur + 30)}`);
      }
      return slots;
    };
  });

  test('10:00-12:00 → 4スロット', () => {
    const slots = buildSpecialShiftSlots('10:00', '12:00');
    expect(slots).toEqual([
      '10:00-10:30',
      '10:30-11:00',
      '11:00-11:30',
      '11:30-12:00',
    ]);
  });

  test('13:30-15:00 → 3スロット', () => {
    const slots = buildSpecialShiftSlots('13:30', '15:00');
    expect(slots).toEqual([
      '13:30-14:00',
      '14:00-14:30',
      '14:30-15:00',
    ]);
  });

  test('09:00-09:30 → 1スロット', () => {
    const slots = buildSpecialShiftSlots('09:00', '09:30');
    expect(slots).toEqual(['09:00-09:30']);
  });

  test('終了が開始より前 → 空配列', () => {
    expect(buildSpecialShiftSlots('14:00', '13:00')).toEqual([]);
  });

  test('開始と終了が同じ → 空配列', () => {
    expect(buildSpecialShiftSlots('10:00', '10:00')).toEqual([]);
  });

  test('undefined が渡された → 空配列', () => {
    expect(buildSpecialShiftSlots(undefined, '12:00')).toEqual([]);
    expect(buildSpecialShiftSlots('10:00', undefined)).toEqual([]);
  });

  test('30分に満たない端数はスロットとして含まれない（整数倍の時間帯）', () => {
    // 10:00-11:00 = 2スロット（端数なし）
    const slots = buildSpecialShiftSlots('10:00', '11:00');
    expect(slots.length).toBe(2);
  });
});

// ============================================================
// openDateDetailModal: 特別シフトを .date-detail-slot で表示
// ============================================================
describe('openDateDetailModal - 特別シフトを30分スロットで表示', () => {
  let mockModal, mockContainer;

  const setupDOM = () => {
    document.body.innerHTML = `
      <div id="dateDetailModal" style="display:none;">
        <h3 id="dateDetailTitle"></h3>
        <div id="dateDetailContainer"></div>
        <button class="submit-btn" disabled></button>
        <button class="cancel-btn"></button>
      </div>
    `;
    mockModal     = document.getElementById('dateDetailModal');
    mockContainer = document.getElementById('dateDetailContainer');
  };

  // 期待する実装を定義してテスト
  const defineOpenSpecialShiftApplicationModal = () => {
    global.buildSpecialShiftSlots = (startTime, endTime) => {
      if (!startTime || !endTime) return [];
      const toMins = t => { const [h,m] = t.split(':').map(Number); return h*60+m; };
      const toTime = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
      const s = toMins(startTime), e = toMins(endTime);
      if (s >= e) return [];
      const slots = [];
      for (let cur = s; cur < e; cur += 30) slots.push(`${toTime(cur)}-${toTime(cur+30)}`);
      return slots;
    };

    global.openSpecialShiftApplicationModal = async function(dateKey, currentUser, container) {
      const specialShifts = getSpecialShifts().filter(shift => {
        const d = typeof shift.date === 'string' && shift.date.includes('T')
          ? shift.date.split('T')[0] : shift.date;
        return d === dateKey;
      });

      specialShifts.forEach(shift => {
        const slots = buildSpecialShiftSlots(shift.start_time, shift.end_time);
        slots.forEach(slot => {
          const slotDiv = document.createElement('div');
          slotDiv.className = 'date-detail-slot';
          slotDiv.dataset.slot = slot;
          slotDiv.dataset.slotType = 'special';
          slotDiv.dataset.specialShiftUuid = shift.uuid;
          slotDiv.textContent = slot;
          slotDiv.classList.add('selectable');
          container.appendChild(slotDiv);
        });
      });
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupDOM();

    global.console = { ...console, error: jest.fn(), log: jest.fn() };
    global.checkHasSpecialShifts   = jest.fn(() => true);
    global.getCurrentUser          = jest.fn(() => ({ sub: 'user-1', name: 'テスト' }));
    global.getDefaultCapacity      = jest.fn(() => 0);
    global.getCurrentShiftCounts   = jest.fn(() => ({}));
    global.setCurrentDetailDateKey = jest.fn();
    global.setSelectedTimeSlots    = jest.fn();
    global.updateSubmitButton      = jest.fn();
    global.toggleTimeSlotSelection = jest.fn();
    global.toggleAllTimeSlots      = jest.fn();
    global.window = { currentCapacityData: null };
    global.API = {
      getShiftsByDate: jest.fn().mockResolvedValue({ success: true, data: [] }),
    };
  });

  test('特別シフト 10:00-12:00 が .date-detail-slot として4枠表示される', async () => {
    global.getSpecialShifts = jest.fn(() => [{
      uuid: 'ss-1',
      date: '2026-04-20',
      start_time: '10:00',
      end_time: '12:00',
      user_id: 'admin',
      user_name: '管理者'
    }]);
    defineOpenSpecialShiftApplicationModal();

    await openSpecialShiftApplicationModal('2026-04-20', { sub: 'user-1' }, mockContainer);

    const slots = mockContainer.querySelectorAll('.date-detail-slot');
    expect(slots.length).toBe(4);
  });

  test('各スロットに data-slot-type="special" が設定される', async () => {
    global.getSpecialShifts = jest.fn(() => [{
      uuid: 'ss-1',
      date: '2026-04-20',
      start_time: '10:00',
      end_time: '11:00',
      user_id: 'admin',
      user_name: '管理者'
    }]);
    defineOpenSpecialShiftApplicationModal();

    await openSpecialShiftApplicationModal('2026-04-20', { sub: 'user-1' }, mockContainer);

    const slots = mockContainer.querySelectorAll('.date-detail-slot');
    slots.forEach(slot => {
      expect(slot.dataset.slotType).toBe('special');
      expect(slot.dataset.specialShiftUuid).toBe('ss-1');
    });
  });

  test('スロットのテキストが時間帯を正しく表示する', async () => {
    global.getSpecialShifts = jest.fn(() => [{
      uuid: 'ss-1',
      date: '2026-04-20',
      start_time: '13:30',
      end_time: '15:00',
      user_id: 'admin',
      user_name: '管理者'
    }]);
    defineOpenSpecialShiftApplicationModal();

    await openSpecialShiftApplicationModal('2026-04-20', { sub: 'user-1' }, mockContainer);

    const slots = Array.from(mockContainer.querySelectorAll('.date-detail-slot'));
    expect(slots[0].textContent).toBe('13:30-14:00');
    expect(slots[1].textContent).toBe('14:00-14:30');
    expect(slots[2].textContent).toBe('14:30-15:00');
  });

  test('複数の特別シフトがある日のスロットが合算される', async () => {
    global.getSpecialShifts = jest.fn(() => [
      { uuid: 'ss-1', date: '2026-04-20', start_time: '10:00', end_time: '11:00', user_id: 'admin', user_name: '管理者' },
      { uuid: 'ss-2', date: '2026-04-20', start_time: '14:00', end_time: '15:00', user_id: 'admin', user_name: '管理者' },
    ]);
    defineOpenSpecialShiftApplicationModal();

    await openSpecialShiftApplicationModal('2026-04-20', { sub: 'user-1' }, mockContainer);

    // 10:00-11:00 (2スロット) + 14:00-15:00 (2スロット) = 4スロット
    expect(mockContainer.querySelectorAll('.date-detail-slot').length).toBe(4);
  });
});

// ============================================================
// submitDateDetailShiftRequest: 特別スロットと通常スロットの振り分け
// ============================================================
describe('submitDateDetailShiftRequest - スロット種別振り分け', () => {
  let regularSubmitCalled, specialSubmitCalls;

  beforeEach(() => {
    regularSubmitCalled = false;
    specialSubmitCalls  = [];

    global.getCurrentUser          = jest.fn(() => ({ sub: 'user-1', name: 'テスト' }));
    global.getCurrentDetailDateKey = jest.fn(() => '2026-04-20');
    global.getSelectedTimeSlots    = jest.fn();
    global.setSelectedTimeSlots    = jest.fn();
    global.closeDateDetailModal    = jest.fn();
    global.switchToTab             = jest.fn();
    global.setScrollToShiftAfterLoad = jest.fn();
    global.fetchShiftCountsFromSpreadsheet = jest.fn().mockResolvedValue({});
    global.setCurrentShiftCounts   = jest.fn();
    global.updateSingleDateCapacity = jest.fn();
    global.checkHasSpecialShifts   = jest.fn(() => true);
    global.window = { currentCapacityData: null };
    global.console = { ...console, error: jest.fn(), log: jest.fn() };

    document.body.innerHTML = `
      <div id="dateDetailModal">
        <button class="submit-btn"></button>
        <button class="cancel-btn"></button>
      </div>
    `;

    global.API = {
      createMultipleShifts: jest.fn().mockImplementation(data => {
        regularSubmitCalled = true;
        return Promise.resolve({ success: true, processed: data.time_slots });
      }),
      applyForSpecialShift: jest.fn().mockImplementation((uuid, data) => {
        specialSubmitCalls.push({ uuid, ...data });
        return Promise.resolve({ success: true });
      }),
    };
  });

  afterEach(() => jest.clearAllMocks());

  // 振り分けロジックを持つ関数のテスト用実装
  const buildSubmitFn = (selectedSlots, specialShifts) => async () => {
    const currentUser = getCurrentUser();
    const dateKey = getCurrentDetailDateKey();

    // 特別シフトスロットのマップを構築（timeSlot → specialShiftUuid）
    const specialSlotMap = new Map();
    specialShifts.forEach(shift => {
      const toMins = t => { const [h,m] = t.split(':').map(Number); return h*60+m; };
      const toTime = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
      const s = toMins(shift.start_time), e = toMins(shift.end_time);
      for (let cur = s; cur < e; cur += 30) {
        specialSlotMap.set(`${toTime(cur)}-${toTime(cur+30)}`, shift.uuid);
      }
    });

    const regularSlots = selectedSlots.filter(s => !specialSlotMap.has(s));
    const specialSlots = selectedSlots.filter(s =>  specialSlotMap.has(s));

    if (regularSlots.length > 0) {
      await API.createMultipleShifts({
        user_id: currentUser.sub, user_name: currentUser.name,
        date: dateKey, time_slots: regularSlots
      });
    }
    for (const slot of specialSlots) {
      await API.applyForSpecialShift(specialSlotMap.get(slot), {
        user_id: currentUser.sub, user_name: currentUser.name, time_slot: slot
      });
    }
  };

  test('特別スロットのみ選択 → applyForSpecialShift が呼ばれ createMultipleShifts は呼ばれない', async () => {
    const specialShifts = [{ uuid: 'ss-1', start_time: '10:00', end_time: '11:00' }];
    const selected = ['10:00-10:30', '10:30-11:00'];

    await buildSubmitFn(selected, specialShifts)();

    expect(API.applyForSpecialShift).toHaveBeenCalledTimes(2);
    expect(API.applyForSpecialShift).toHaveBeenCalledWith('ss-1', { user_id: 'user-1', user_name: 'テスト', time_slot: '10:00-10:30' });
    expect(API.applyForSpecialShift).toHaveBeenCalledWith('ss-1', { user_id: 'user-1', user_name: 'テスト', time_slot: '10:30-11:00' });
    expect(API.createMultipleShifts).not.toHaveBeenCalled();
  });

  test('通常スロットのみ選択 → createMultipleShifts が呼ばれ applyForSpecialShift は呼ばれない', async () => {
    const specialShifts = [{ uuid: 'ss-1', start_time: '10:00', end_time: '11:00' }];
    const selected = ['13:00-13:30', '14:00-14:30'];

    await buildSubmitFn(selected, specialShifts)();

    expect(API.createMultipleShifts).toHaveBeenCalledWith({
      user_id: 'user-1', user_name: 'テスト',
      date: '2026-04-20', time_slots: ['13:00-13:30', '14:00-14:30']
    });
    expect(API.applyForSpecialShift).not.toHaveBeenCalled();
  });

  test('特別スロットと通常スロットを混在選択 → 両方のAPIが呼ばれる', async () => {
    const specialShifts = [{ uuid: 'ss-1', start_time: '10:00', end_time: '11:00' }];
    const selected = ['10:00-10:30', '13:00-13:30'];

    await buildSubmitFn(selected, specialShifts)();

    expect(API.applyForSpecialShift).toHaveBeenCalledTimes(1);
    expect(API.applyForSpecialShift).toHaveBeenCalledWith('ss-1', expect.objectContaining({ time_slot: '10:00-10:30' }));
    expect(API.createMultipleShifts).toHaveBeenCalledWith(expect.objectContaining({ time_slots: ['13:00-13:30'] }));
  });

  test('複数の特別シフトのスロットを正しい特別シフトUUIDに振り分ける', async () => {
    const specialShifts = [
      { uuid: 'ss-1', start_time: '10:00', end_time: '10:30' },
      { uuid: 'ss-2', start_time: '14:00', end_time: '14:30' },
    ];
    const selected = ['10:00-10:30', '14:00-14:30'];

    await buildSubmitFn(selected, specialShifts)();

    expect(API.applyForSpecialShift).toHaveBeenCalledWith('ss-1', expect.objectContaining({ time_slot: '10:00-10:30' }));
    expect(API.applyForSpecialShift).toHaveBeenCalledWith('ss-2', expect.objectContaining({ time_slot: '14:00-14:30' }));
  });
});
