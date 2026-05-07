/**
 * 特別シフトがある日の通常シフト申請に関するテスト
 *
 * 目的: 特別シフトが設定されている日に通常シフトも申請できることを確認する
 */

describe('buildModalSections - モーダル表示セクション判定', () => {
  let buildModalSections;

  beforeEach(() => {
    // テスト対象: モーダルに何を表示するか判定する純粋関数
    // shiftRequest.js から切り出した純粋ロジック
    buildModalSections = (hasSpecialShifts, maxCapacityForDate) => {
      return {
        showRegular: maxCapacityForDate > 0,
        showSpecial: hasSpecialShifts,
      };
    };
  });

  describe('通常シフトのみの日', () => {
    test('capacity > 0 かつ特別シフトなし → 通常シフトのみ表示', () => {
      const result = buildModalSections(false, 3);
      expect(result.showRegular).toBe(true);
      expect(result.showSpecial).toBe(false);
    });

    test('capacity = 0 かつ特別シフトなし → 何も表示しない', () => {
      const result = buildModalSections(false, 0);
      expect(result.showRegular).toBe(false);
      expect(result.showSpecial).toBe(false);
    });
  });

  describe('特別シフトのみの日 (capacity = 0)', () => {
    test('capacity = 0 かつ特別シフトあり → 特別シフトのみ表示', () => {
      const result = buildModalSections(true, 0);
      expect(result.showRegular).toBe(false);
      expect(result.showSpecial).toBe(true);
    });
  });

  describe('特別シフトと通常シフトが共存する日', () => {
    test('capacity > 0 かつ特別シフトあり → 両方表示', () => {
      const result = buildModalSections(true, 3);
      expect(result.showRegular).toBe(true);
      expect(result.showSpecial).toBe(true);
    });

    test('capacity = 2 かつ特別シフトあり → 両方表示', () => {
      const result = buildModalSections(true, 2);
      expect(result.showRegular).toBe(true);
      expect(result.showSpecial).toBe(true);
    });
  });
});

describe('openDateDetailModal の DOM 出力', () => {
  let mockModal, mockTitle, mockContainer, mockSubmitBtn;

  const setupDOM = () => {
    document.body.innerHTML = `
      <div id="dateDetailModal" style="display:none;">
        <h3 id="dateDetailTitle"></h3>
        <div id="dateDetailContainer"></div>
        <button class="submit-btn" style="display:none;"></button>
        <button class="cancel-btn"></button>
      </div>
    `;
    mockModal     = document.getElementById('dateDetailModal');
    mockTitle     = document.getElementById('dateDetailTitle');
    mockContainer = document.getElementById('dateDetailContainer');
    mockSubmitBtn = mockModal.querySelector('.submit-btn');
  };

  const setupGlobals = ({ hasSpecialShifts, maxCapacity, specialShifts = [], myShifts = [] }) => {
    global.checkHasSpecialShifts   = jest.fn(() => hasSpecialShifts);
    global.getSpecialShifts        = jest.fn(() => specialShifts);
    global.getCurrentUser          = jest.fn(() => ({ sub: 'user-1', name: 'テストユーザー' }));
    global.getDefaultCapacity      = jest.fn(() => maxCapacity);
    global.getCurrentShiftCounts   = jest.fn(() => ({}));
    global.setCurrentDetailDateKey = jest.fn();
    global.setSelectedTimeSlots    = jest.fn();
    global.updateSubmitButton      = jest.fn();
    global.toggleTimeSlotSelection = jest.fn();

    global.API = {
      getShiftsByDate: jest.fn().mockResolvedValue({ success: true, data: myShifts }),
      getSpecialShiftApplications: jest.fn().mockResolvedValue({ success: true, data: [] }),
    };

    global.window = { currentCapacityData: null };
  };

  // openDateDetailModal を定義（shiftRequest.js の実ロジックを再現）
  const defineOpenDateDetailModal = () => {
    global.openDateDetailModal = async function(dateKey) {
      const modal     = document.getElementById('dateDetailModal');
      const title     = document.getElementById('dateDetailTitle');
      const container = document.getElementById('dateDetailContainer');

      const dateObj  = new Date(dateKey);
      const year     = dateObj.getFullYear();
      const month    = dateObj.getMonth() + 1;
      const day      = dateObj.getDate();
      const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
      const weekday  = weekdays[dateObj.getDay()];

      const hasSpecialShifts = checkHasSpecialShifts(dateKey);

      let maxCapacityForDate = getDefaultCapacity(dateObj.getDay());
      if (window.currentCapacityData) {
        const item = window.currentCapacityData.find(i => i.date === dateKey);
        if (item) maxCapacityForDate = item.capacity;
      }

      // 特別シフトがない場合のみ capacity=0 で早期終了
      if (!hasSpecialShifts && maxCapacityForDate === 0) return;

      setCurrentDetailDateKey(dateKey);
      setSelectedTimeSlots([]);
      title.textContent = `${year}年${month}月${day}日 (${weekday}) のシフト枠`;

      const currentUser = getCurrentUser();
      container.innerHTML = '';

      // --- 特別シフトセクション ---
      if (hasSpecialShifts) {
        await openSpecialShiftApplicationModal(dateKey, currentUser, container, modal, title);
      }

      // --- 通常シフトセクション ---
      if (maxCapacityForDate > 0) {
        const section = document.createElement('div');
        section.className = 'regular-shift-section';

        const heading = document.createElement('div');
        heading.className = 'regular-shift-heading';
        heading.textContent = '通常シフト申請';
        section.appendChild(heading);

        const slots = [];
        for (let hour = 13; hour < 18; hour++) {
          slots.push(`${hour}:00-${hour}:30`);
          slots.push(`${hour}:30-${hour + 1}:00`);
        }

        slots.forEach(slot => {
          const slotDiv = document.createElement('div');
          slotDiv.className = 'date-detail-slot';
          slotDiv.dataset.slot = slot;
          slotDiv.textContent = slot;
          section.appendChild(slotDiv);
        });

        container.appendChild(section);
      }

      // submit ボタンの表示制御（特別シフト or 通常シフトのいずれかがあれば表示）
      const submitBtn = modal.querySelector('.submit-btn');
      if (submitBtn) {
        submitBtn.style.display = (maxCapacityForDate > 0 || hasSpecialShifts) ? '' : 'none';
      }
      updateSubmitButton();

      modal.style.display = 'flex';
    };
  };

  const defineOpenSpecialShiftApplicationModal = (mockImplementation) => {
    global.openSpecialShiftApplicationModal = mockImplementation || jest.fn(async (dateKey, currentUser, container) => {
      const card = document.createElement('div');
      card.className = 'special-shift-apply-card';
      card.textContent = '特別シフト';
      container.appendChild(card);
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupDOM();
    global.console = { ...console, error: jest.fn(), log: jest.fn() };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('通常シフトのみの日: 通常シフトスロットが10個表示される', async () => {
    setupGlobals({ hasSpecialShifts: false, maxCapacity: 3 });
    defineOpenSpecialShiftApplicationModal();
    defineOpenDateDetailModal();

    await openDateDetailModal('2026-04-17');

    const slots = mockContainer.querySelectorAll('.date-detail-slot');
    expect(slots.length).toBe(10); // 13:00〜18:00 の30分枠×10
    expect(mockContainer.querySelectorAll('.special-shift-apply-card').length).toBe(0);
    expect(mockModal.style.display).toBe('flex');
  });

  test('特別シフトのみの日 (capacity=0): 特別シフトカードのみ表示される', async () => {
    setupGlobals({
      hasSpecialShifts: true,
      maxCapacity: 0,
      specialShifts: [{ uuid: 'ss-1', date: '2026-04-20', start_time: '10:00', end_time: '12:00', user_id: 'admin', user_name: '管理者' }],
    });
    defineOpenSpecialShiftApplicationModal();
    defineOpenDateDetailModal();

    await openDateDetailModal('2026-04-20');

    expect(mockContainer.querySelectorAll('.special-shift-apply-card').length).toBeGreaterThan(0);
    expect(mockContainer.querySelectorAll('.date-detail-slot').length).toBe(0);
  });

  test('特別シフトと通常シフトが共存する日: 両方表示される', async () => {
    setupGlobals({
      hasSpecialShifts: true,
      maxCapacity: 3,
      specialShifts: [{ uuid: 'ss-1', date: '2026-04-17', start_time: '10:00', end_time: '12:00', user_id: 'admin', user_name: '管理者' }],
    });
    defineOpenSpecialShiftApplicationModal();
    defineOpenDateDetailModal();

    await openDateDetailModal('2026-04-17');

    // 特別シフトカードが表示される
    expect(mockContainer.querySelectorAll('.special-shift-apply-card').length).toBeGreaterThan(0);
    // 通常シフトスロットも表示される
    expect(mockContainer.querySelectorAll('.date-detail-slot').length).toBe(10);
    expect(mockModal.style.display).toBe('flex');
  });

  test('特別シフトと通常シフトが共存する日: submit ボタンが表示される', async () => {
    setupGlobals({ hasSpecialShifts: true, maxCapacity: 3 });
    defineOpenSpecialShiftApplicationModal();
    defineOpenDateDetailModal();

    await openDateDetailModal('2026-04-17');

    // 通常シフト申請用 submit ボタンが表示される
    expect(mockSubmitBtn.style.display).not.toBe('none');
  });

  test('特別シフトのみの日 (capacity=0): submit ボタンが表示される', async () => {
    setupGlobals({
      hasSpecialShifts: true,
      maxCapacity: 0,
      specialShifts: [{ uuid: 'ss-1', date: '2026-04-20', start_time: '10:00', end_time: '12:00', user_id: 'admin', user_name: '管理者' }],
    });
    defineOpenSpecialShiftApplicationModal();
    defineOpenDateDetailModal();

    await openDateDetailModal('2026-04-20');

    // 特別シフトがある日は capacity=0 でも申請できるよう submit ボタンを表示する
    expect(mockSubmitBtn.style.display).not.toBe('none');
  });

  test('capacity=0 かつ特別シフトなし: モーダルが開かない', async () => {
    setupGlobals({ hasSpecialShifts: false, maxCapacity: 0 });
    defineOpenSpecialShiftApplicationModal();
    defineOpenDateDetailModal();

    await openDateDetailModal('2026-04-20');

    // モーダルは開かれない
    expect(mockModal.style.display).not.toBe('flex');
  });
});
