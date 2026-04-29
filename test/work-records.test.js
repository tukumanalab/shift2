// work-records.test.js - 勤務記録モジュールのテスト

// テスト対象の関数をインラインで定義（frontend JSはimport不可のため）

function calculateRegularShiftHours(timeSlot) {
    if (!timeSlot) return 0;
    const parts = timeSlot.split('-');
    if (parts.length !== 2) return 0;
    const [startH, startM] = parts[0].split(':').map(Number);
    const [endH, endM] = parts[1].split(':').map(Number);
    return (endH * 60 + endM - (startH * 60 + startM)) / 60;
}

function calculateSpecialShiftHours(startTime, endTime) {
    if (!startTime || !endTime) return 0;
    const toMinutes = (t) => {
        const str = typeof t === 'string' && t.includes('T')
            ? t.split('T')[1].substring(0, 5)
            : t.substring(0, 5);
        const [h, m] = str.split(':').map(Number);
        return h * 60 + m;
    };
    return (toMinutes(endTime) - toMinutes(startTime)) / 60;
}

function getMonthDateRange(year, month) {
    const pad = (n) => String(n).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    return {
        startDate: `${year}-${pad(month)}-01`,
        endDate: `${year}-${pad(month)}-${lastDay}`
    };
}

// utils.js の mergeConsecutiveTimeSlots をインライン
function mergeConsecutiveTimeSlots(timeSlots) {
    if (timeSlots.length === 0) return [];
    const sorted = [...timeSlots].sort((a, b) => {
        const timeA = a.replace(/(\d+):(\d+)-(\d+):(\d+)/, '$1$2');
        const timeB = b.replace(/(\d+):(\d+)-(\d+):(\d+)/, '$1$2');
        return parseInt(timeA) - parseInt(timeB);
    });
    const merged = [];
    let currentStart = sorted[0].split('-')[0];
    let currentEnd = sorted[0].split('-')[1];
    for (let i = 1; i < sorted.length; i++) {
        const [nextStart, nextEnd] = sorted[i].split('-');
        if (currentEnd === nextStart) {
            currentEnd = nextEnd;
        } else {
            merged.push(`${currentStart}-${currentEnd}`);
            currentStart = nextStart;
            currentEnd = nextEnd;
        }
    }
    merged.push(`${currentStart}-${currentEnd}`);
    return merged;
}

function formatDuration(hours) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}:${String(m).padStart(2, '0')}`;
}

function formatDateShort(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function getDayOfWeek(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
}

function buildShiftRows(regularShifts, specialShifts) {
    const rows = [];

    // 通常シフト: user_id + date でグループ化し連続スロットをマージ
    const regularGroups = {};
    for (const shift of regularShifts) {
        const key = `${shift.user_id}::${shift.date}`;
        if (!regularGroups[key]) {
            regularGroups[key] = { user_id: shift.user_id, user_name: shift.user_name, date: shift.date, slots: [] };
        }
        regularGroups[key].slots.push(shift.time_slot);
    }
    for (const g of Object.values(regularGroups)) {
        for (const slot of mergeConsecutiveTimeSlots(g.slots)) {
            const [start, end] = slot.split('-');
            rows.push({ user_id: g.user_id, user_name: g.user_name, date: g.date, start, end, hours: calculateRegularShiftHours(slot), type: '通常' });
        }
    }

    // 特別シフト: user_id + special_shift_uuid でグループ化し連続スロットをマージ
    const specialGroups = {};
    for (const shift of specialShifts) {
        const key = `${shift.user_id}::${shift.special_shift_uuid || shift.date}`;
        if (!specialGroups[key]) {
            specialGroups[key] = { user_id: shift.user_id, user_name: shift.user_name, date: shift.date, slots: [] };
        }
        if (shift.time_slot) specialGroups[key].slots.push(shift.time_slot);
    }
    for (const g of Object.values(specialGroups)) {
        if (g.slots.length === 0) continue;
        for (const slot of mergeConsecutiveTimeSlots(g.slots)) {
            const [start, end] = slot.split('-');
            rows.push({ user_id: g.user_id, user_name: g.user_name, date: g.date, start, end, hours: calculateRegularShiftHours(slot), type: '特別' });
        }
    }

    // 日付昇順 → ユーザー名昇順でソート
    rows.sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        return d !== 0 ? d : a.user_name.localeCompare(b.user_name, 'ja');
    });

    return rows;
}

function buildTsvContent(rows) {
    const header = ['ユーザー名', '日付', '曜日', '勤務開始', '勤務終了', '時間数'].join('\t');
    const lines = rows.map(r =>
        [r.user_name, formatDateShort(r.date), getDayOfWeek(r.date), r.start, r.end, formatDuration(r.hours)].join('\t')
    );
    return [header, ...lines].join('\n');
}

// ===== テスト =====

describe('calculateRegularShiftHours', () => {
    test('30分シフトは0.5時間', () => {
        expect(calculateRegularShiftHours('13:00-13:30')).toBe(0.5);
    });
    test('1時間シフトは1.0時間', () => {
        expect(calculateRegularShiftHours('13:00-14:00')).toBe(1.0);
    });
    test('不正な入力は0を返す', () => {
        expect(calculateRegularShiftHours('')).toBe(0);
        expect(calculateRegularShiftHours(null)).toBe(0);
    });
});

describe('calculateSpecialShiftHours', () => {
    test('2時間30分のシフト', () => {
        expect(calculateSpecialShiftHours('13:00', '15:30')).toBe(2.5);
    });
    test('不正な入力は0を返す', () => {
        expect(calculateSpecialShiftHours('', '15:00')).toBe(0);
        expect(calculateSpecialShiftHours(null, null)).toBe(0);
    });
});

describe('getMonthDateRange', () => {
    test('2026年4月', () => {
        expect(getMonthDateRange(2026, 4)).toEqual({ startDate: '2026-04-01', endDate: '2026-04-30' });
    });
    test('2026年2月（うるう年でない）', () => {
        expect(getMonthDateRange(2026, 2)).toEqual({ startDate: '2026-02-01', endDate: '2026-02-28' });
    });
    test('2024年2月（うるう年）', () => {
        expect(getMonthDateRange(2024, 2)).toEqual({ startDate: '2024-02-01', endDate: '2024-02-29' });
    });
});

describe('formatDuration', () => {
    test('4時間は4:00', () => {
        expect(formatDuration(4)).toBe('4:00');
    });
    test('30分は0:30', () => {
        expect(formatDuration(0.5)).toBe('0:30');
    });
    test('1時間30分は1:30', () => {
        expect(formatDuration(1.5)).toBe('1:30');
    });
    test('0時間は0:00', () => {
        expect(formatDuration(0)).toBe('0:00');
    });
    test('2時間15分は2:15', () => {
        expect(formatDuration(2.25)).toBe('2:15');
    });
});

describe('formatDateShort', () => {
    test('2026-04-21 → 4月21日', () => {
        expect(formatDateShort('2026-04-21')).toBe('4月21日');
    });
    test('2026-01-01 → 1月1日', () => {
        expect(formatDateShort('2026-01-01')).toBe('1月1日');
    });
    test('2026-12-31 → 12月31日', () => {
        expect(formatDateShort('2026-12-31')).toBe('12月31日');
    });
});

describe('getDayOfWeek', () => {
    test('2026-04-21は火曜日', () => {
        expect(getDayOfWeek('2026-04-21')).toBe('火');
    });
    test('2026-04-19は日曜日', () => {
        expect(getDayOfWeek('2026-04-19')).toBe('日');
    });
    test('2026-04-25は土曜日', () => {
        expect(getDayOfWeek('2026-04-25')).toBe('土');
    });
});

describe('buildShiftRows', () => {
    const regularShifts = [
        { user_id: 'u1', user_name: '山田太郎', date: '2026-04-21', time_slot: '14:00-14:30' },
        { user_id: 'u1', user_name: '山田太郎', date: '2026-04-21', time_slot: '14:30-15:00' },
        { user_id: 'u1', user_name: '山田太郎', date: '2026-04-21', time_slot: '15:00-15:30' },
        // 非連続スロット（同日）
        { user_id: 'u1', user_name: '山田太郎', date: '2026-04-21', time_slot: '17:00-17:30' },
        // 別ユーザー
        { user_id: 'u2', user_name: '佐藤花子', date: '2026-04-22', time_slot: '13:00-13:30' },
    ];

    const specialShifts = [
        { user_id: 'u1', user_name: '山田太郎', date: '2026-04-21', special_shift_uuid: 'sp1', time_slot: '09:00-09:30' },
        { user_id: 'u1', user_name: '山田太郎', date: '2026-04-21', special_shift_uuid: 'sp1', time_slot: '09:30-10:00' },
        // 非連続（別special_shift_uuid扱いで別グループ）
        { user_id: 'u1', user_name: '山田太郎', date: '2026-04-21', special_shift_uuid: 'sp2', time_slot: '11:00-11:30' },
    ];

    test('連続する通常シフトスロットは1行にマージされる', () => {
        const rows = buildShiftRows(regularShifts, []);
        const u1Regular = rows.filter(r => r.user_id === 'u1' && r.type === '通常');
        // 14:00-15:30 と 17:00-17:30 の2行
        expect(u1Regular).toHaveLength(2);
        expect(u1Regular[0].start).toBe('14:00');
        expect(u1Regular[0].end).toBe('15:30');
    });

    test('非連続スロットは別行になる', () => {
        const rows = buildShiftRows(regularShifts, []);
        const u1Regular = rows.filter(r => r.user_id === 'u1' && r.type === '通常');
        expect(u1Regular[1].start).toBe('17:00');
        expect(u1Regular[1].end).toBe('17:30');
    });

    test('時間数が正しく計算される（1時間30分）', () => {
        const rows = buildShiftRows(regularShifts, []);
        const merged = rows.find(r => r.start === '14:00' && r.end === '15:30');
        expect(merged.hours).toBe(1.5);
    });

    test('特別シフトも連続スロットはマージされる', () => {
        const rows = buildShiftRows([], specialShifts);
        const sp1Rows = rows.filter(r => r.user_id === 'u1');
        const sp1Merged = sp1Rows.find(r => r.start === '09:00');
        expect(sp1Merged).toBeTruthy();
        expect(sp1Merged.end).toBe('10:00');
    });

    test('異なるspecial_shift_uuidは別行になる', () => {
        const rows = buildShiftRows([], specialShifts);
        expect(rows).toHaveLength(2);
    });

    test('日付昇順でソートされる', () => {
        const rows = buildShiftRows(regularShifts, []);
        const dates = rows.map(r => r.date);
        expect(dates[0]).toBe('2026-04-21');
        expect(dates[dates.length - 1]).toBe('2026-04-22');
    });

    test('空データは空配列を返す', () => {
        expect(buildShiftRows([], [])).toEqual([]);
    });
});

describe('buildTsvContent', () => {
    const rows = [
        { user_name: '山田太郎', date: '2026-04-21', start: '14:00', end: '18:00', hours: 4 },
        { user_name: '佐藤花子', date: '2026-04-22', start: '13:00', end: '13:30', hours: 0.5 },
    ];

    test('ヘッダー行が含まれる', () => {
        const tsv = buildTsvContent(rows);
        const lines = tsv.split('\n');
        expect(lines[0]).toBe('ユーザー名\t日付\t曜日\t勤務開始\t勤務終了\t時間数');
    });

    test('データ行がタブ区切りになっている', () => {
        const tsv = buildTsvContent(rows);
        const lines = tsv.split('\n');
        expect(lines[1]).toBe('山田太郎\t4月21日\t火\t14:00\t18:00\t4:00');
    });

    test('時間数がH:MM形式になっている', () => {
        const tsv = buildTsvContent(rows);
        const lines = tsv.split('\n');
        expect(lines[2]).toContain('0:30');
    });

    test('空データはヘッダーのみ', () => {
        const tsv = buildTsvContent([]);
        expect(tsv.split('\n')).toHaveLength(1);
    });
});
