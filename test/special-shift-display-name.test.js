/**
 * 特別シフトの名前表示を通常シフトと同じ形式にするテスト（TDD）
 */

describe('displayShiftList - 特別シフトに nickname/realName をマップする', () => {
  const setupGlobals = () => {
    global.setAllShiftsData  = jest.fn();
    global.generateCalendar  = jest.fn();
    global.updateBulkActionBarCount = jest.fn();
    global.displayCapacityOnAdminCalendar = jest.fn();
    global.console = { ...console, log: jest.fn(), error: jest.fn() };
  };

  const defineDisplayShiftList = () => {
    global.displayShiftList = async function() {
      updateBulkActionBarCount('calendarSelectedCount', 0);

      const [shiftsResult, specialResult] = await Promise.all([
        API.getAllShifts(),
        API.getAllSpecialShiftApplications(),
      ]);

      const regularShifts = (shiftsResult.success && shiftsResult.data || []).map(shift => ({
        shiftDate: shift.date,
        timeSlot: shift.time_slot,
        userId: shift.user_id,
        userName: shift.user_name,
        nickname: shift.nickname,
        realName: shift.real_name,
        uuid: shift.uuid,
        registrationDate: shift.created_at,
        isSpecial: false,
      }));

      // 特別シフトも nickname / realName をマップする
      const specialShifts = (specialResult.success && specialResult.data || []).map(app => ({
        shiftDate: app.date,
        timeSlot: app.time_slot,
        userId: app.user_id,
        userName: app.user_name,
        nickname: app.nickname,
        realName: app.real_name,
        uuid: app.uuid,
        registrationDate: app.created_at,
        isSpecial: true,
      }));

      const allShifts = [...regularShifts, ...specialShifts];
      setAllShiftsData(allShifts);
      generateCalendar('shiftCalendarContainer');
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupGlobals();
    defineDisplayShiftList();
  });

  test('特別シフトに nickname がマップされる', async () => {
    global.API = {
      getAllShifts: jest.fn().mockResolvedValue({ success: true, data: [] }),
      getAllSpecialShiftApplications: jest.fn().mockResolvedValue({
        success: true,
        data: [{ uuid: 'app-1', user_id: 'user-1', user_name: 'ユーザー1',
                 nickname: 'いしはらa', real_name: '石原浮也',
                 date: '2026-04-20', time_slot: '09:30-10:00',
                 created_at: '2026-04-17T00:00:00Z' }],
      }),
    };

    await displayShiftList();

    const captured = setAllShiftsData.mock.calls[0][0];
    const special = captured.find(s => s.uuid === 'app-1');
    expect(special.nickname).toBe('いしはらa');
    expect(special.realName).toBe('石原浮也');
  });

  test('nickname のみの特別シフトも正しくマップされる', async () => {
    global.API = {
      getAllShifts: jest.fn().mockResolvedValue({ success: true, data: [] }),
      getAllSpecialShiftApplications: jest.fn().mockResolvedValue({
        success: true,
        data: [{ uuid: 'app-1', user_id: 'user-1', user_name: 'ユーザー1',
                 nickname: 'Junya', real_name: null,
                 date: '2026-04-20', time_slot: '09:30-10:00',
                 created_at: '2026-04-17T00:00:00Z' }],
      }),
    };

    await displayShiftList();

    const captured = setAllShiftsData.mock.calls[0][0];
    const special = captured.find(s => s.uuid === 'app-1');
    expect(special.nickname).toBe('Junya');
    expect(special.realName).toBeNull();
  });

  test('nickname/real_name がない特別シフトは undefined/null のまま', async () => {
    global.API = {
      getAllShifts: jest.fn().mockResolvedValue({ success: true, data: [] }),
      getAllSpecialShiftApplications: jest.fn().mockResolvedValue({
        success: true,
        data: [{ uuid: 'app-1', user_id: 'user-1', user_name: 'ユーザー1',
                 nickname: null, real_name: null,
                 date: '2026-04-20', time_slot: '09:30-10:00',
                 created_at: '2026-04-17T00:00:00Z' }],
      }),
    };

    await displayShiftList();

    const captured = setAllShiftsData.mock.calls[0][0];
    const special = captured.find(s => s.uuid === 'app-1');
    expect(special.nickname).toBeNull();
    expect(special.realName).toBeNull();
  });

  test('通常シフトの nickname/realName マッピングは変わらない', async () => {
    global.API = {
      getAllShifts: jest.fn().mockResolvedValue({
        success: true,
        data: [{ uuid: 'shift-1', user_id: 'user-1', user_name: 'ユーザー1',
                 nickname: 'Junya', real_name: 'Ishihara',
                 date: '2026-04-17', time_slot: '13:00-13:30',
                 created_at: '2026-04-10T00:00:00Z' }],
      }),
      getAllSpecialShiftApplications: jest.fn().mockResolvedValue({ success: true, data: [] }),
    };

    await displayShiftList();

    const captured = setAllShiftsData.mock.calls[0][0];
    const regular = captured.find(s => s.uuid === 'shift-1');
    expect(regular.nickname).toBe('Junya');
    expect(regular.realName).toBe('Ishihara');
    expect(regular.isSpecial).toBe(false);
  });
});
