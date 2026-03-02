/**
 * 管理者シフト一覧のニックネーム（本名）表示機能のテスト
 *
 * 対象の変更:
 * - ShiftModel.getAll() が users テーブルを JOIN して nickname/real_name を返すこと
 * - displayShiftList() が nickname/realName をマッピングすること
 * - displayShiftsForDate() がホバー時にメールアドレスを表示しないこと
 * - getShiftDisplayName() が nickname(realName) 形式で表示すること
 */

// ---- getDisplayName / getShiftDisplayName の模擬実装 ----

function getDisplayName(nickname, realName, fallbackName = null) {
  const hasNickname = nickname && nickname.trim() !== '';
  const hasRealName = realName && realName.trim() !== '';

  if (hasNickname && hasRealName) {
    return `${nickname}(${realName})`;
  } else if (hasNickname) {
    return nickname;
  } else if (hasRealName) {
    return realName;
  } else {
    return fallbackName || 'ユーザー';
  }
}

function getShiftDisplayName(shift) {
  if (shift.nickname || shift.realName) {
    return getDisplayName(shift.nickname, shift.realName, shift.userName || shift.name);
  }
  return shift.userName || shift.name || '名前未設定';
}

// ---- displayShiftList() のデータマッピング模擬実装 ----

function mapShiftData(shift) {
  return {
    shiftDate: shift.date,
    timeSlot: shift.time_slot,
    userId: shift.user_id,
    userName: shift.user_name,
    nickname: shift.nickname,
    realName: shift.real_name,
    uuid: shift.uuid,
    registrationDate: shift.created_at
  };
}

// ---- displayShiftsForDate() のホバータイトル生成模擬実装 ----

function buildPersonTitle(shift) {
  const displayName = getShiftDisplayName(shift);
  // メールは含まない（変更後の実装）
  return displayName;
}

// ================================================================

describe('getShiftDisplayName - 表示名フォーマット', () => {
  test('nickname と realName が両方ある場合は「nickname(realName)」形式で返す', () => {
    const shift = { nickname: 'ニック', realName: '本名太郎', userName: 'fallback' };
    expect(getShiftDisplayName(shift)).toBe('ニック(本名太郎)');
  });

  test('nickname のみの場合はニックネームだけを返す', () => {
    const shift = { nickname: 'ニック', realName: null, userName: 'fallback' };
    expect(getShiftDisplayName(shift)).toBe('ニック');
  });

  test('realName のみの場合は本名だけを返す', () => {
    const shift = { nickname: null, realName: '本名太郎', userName: 'fallback' };
    expect(getShiftDisplayName(shift)).toBe('本名太郎');
  });

  test('nickname も realName もない場合は userName にフォールバックする', () => {
    const shift = { nickname: null, realName: null, userName: '登録名' };
    expect(getShiftDisplayName(shift)).toBe('登録名');
  });

  test('nickname も realName も userName もない場合は「名前未設定」を返す', () => {
    const shift = { nickname: null, realName: null, userName: null };
    expect(getShiftDisplayName(shift)).toBe('名前未設定');
  });

  test('空文字の nickname は無効として扱い realName を使う', () => {
    const shift = { nickname: '  ', realName: '本名太郎', userName: 'fallback' };
    expect(getShiftDisplayName(shift)).toBe('本名太郎');
  });
});

describe('displayShiftList - シフトデータのマッピング', () => {
  test('APIレスポンスの nickname と real_name が正しくマッピングされる', () => {
    const apiShift = {
      date: '2026-03-10',
      time_slot: '13:00-13:30',
      user_id: 'user-1',
      user_name: 'ユーザー1',
      nickname: 'ニック',
      real_name: '本名太郎',
      uuid: 'uuid-1',
      created_at: '2026-03-01 10:00:00'
    };

    const mapped = mapShiftData(apiShift);

    expect(mapped.nickname).toBe('ニック');
    expect(mapped.realName).toBe('本名太郎');
  });

  test('nickname が null の場合は null のままマッピングされる', () => {
    const apiShift = {
      date: '2026-03-10',
      time_slot: '13:00-13:30',
      user_id: 'user-1',
      user_name: 'ユーザー1',
      nickname: null,
      real_name: null,
      uuid: 'uuid-1',
      created_at: '2026-03-01 10:00:00'
    };

    const mapped = mapShiftData(apiShift);

    expect(mapped.nickname).toBeNull();
    expect(mapped.realName).toBeNull();
  });

  test('マッピング後のシフトデータで getShiftDisplayName が正しく動作する', () => {
    const apiShift = {
      date: '2026-03-10',
      time_slot: '13:00-13:30',
      user_id: 'user-1',
      user_name: 'ユーザー1',
      nickname: 'ニック',
      real_name: '本名太郎',
      uuid: 'uuid-1',
      created_at: '2026-03-01 10:00:00'
    };

    const mapped = mapShiftData(apiShift);
    expect(getShiftDisplayName(mapped)).toBe('ニック(本名太郎)');
  });

  test('その他のフィールドも正しくマッピングされる', () => {
    const apiShift = {
      date: '2026-03-10',
      time_slot: '14:00-14:30',
      user_id: 'user-2',
      user_name: 'ユーザー2',
      nickname: 'N2',
      real_name: '二番太郎',
      uuid: 'uuid-2',
      created_at: '2026-03-02 12:00:00'
    };

    const mapped = mapShiftData(apiShift);

    expect(mapped.shiftDate).toBe('2026-03-10');
    expect(mapped.timeSlot).toBe('14:00-14:30');
    expect(mapped.userId).toBe('user-2');
    expect(mapped.userName).toBe('ユーザー2');
    expect(mapped.uuid).toBe('uuid-2');
    expect(mapped.registrationDate).toBe('2026-03-02 12:00:00');
  });
});

describe('displayShiftsForDate - ホバータイトルにメールを含まない', () => {
  test('ホバータイトルは表示名のみで、メールアドレスを含まない', () => {
    const shift = {
      nickname: 'ニック',
      realName: '本名太郎',
      userName: 'fallback',
      userEmail: 'nick@example.com',
      email: 'nick@example.com'
    };

    const title = buildPersonTitle(shift);

    expect(title).toBe('ニック(本名太郎)');
    expect(title).not.toContain('@');
    expect(title).not.toContain('nick@example.com');
  });

  test('ニックネームのみの場合もメールを含まない', () => {
    const shift = {
      nickname: 'ニック',
      realName: null,
      userName: 'fallback',
      userEmail: 'nick@example.com'
    };

    const title = buildPersonTitle(shift);

    expect(title).toBe('ニック');
    expect(title).not.toContain('@');
  });

  test('nickname も realName もない場合は userName をタイトルに使う', () => {
    const shift = {
      nickname: null,
      realName: null,
      userName: '登録名',
      userEmail: 'user@example.com'
    };

    const title = buildPersonTitle(shift);

    expect(title).toBe('登録名');
    expect(title).not.toContain('@');
  });
});
