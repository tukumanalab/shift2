// work-records.test.js - 勤務記録モジュールのテスト

// テスト対象の関数をインラインで定義（frontend JSはimport不可のため）

/**
 * 時間帯文字列から時間数を計算する
 * @param {string} timeSlot - "HH:MM-HH:MM" 形式
 * @returns {number} 時間数（小数点）
 */
function calculateRegularShiftHours(timeSlot) {
    if (!timeSlot) return 0;
    const parts = timeSlot.split('-');
    if (parts.length !== 2) return 0;
    const [startH, startM] = parts[0].split(':').map(Number);
    const [endH, endM] = parts[1].split(':').map(Number);
    return (endH * 60 + endM - (startH * 60 + startM)) / 60;
}

/**
 * 特別シフトの開始・終了時刻から時間数を計算する
 * @param {string} startTime - "HH:MM" または ISO形式
 * @param {string} endTime - "HH:MM" または ISO形式
 * @returns {number} 時間数（小数点）
 */
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

/**
 * 月の開始日・終了日を返す
 * @param {number} year
 * @param {number} month - 1始まり
 * @returns {{ startDate: string, endDate: string }}
 */
function getMonthDateRange(year, month) {
    const pad = (n) => String(n).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    return {
        startDate: `${year}-${pad(month)}-01`,
        endDate: `${year}-${pad(month)}-${lastDay}`
    };
}

/**
 * シフトデータをユーザーごとに集計する
 * @param {Array} regularShifts
 * @param {Array} specialShifts
 * @returns {Array} ユーザーごとの集計データ
 */
function aggregateShiftsByUser(regularShifts, specialShifts) {
    const userMap = {};

    for (const shift of regularShifts) {
        const key = shift.user_id;
        if (!userMap[key]) {
            userMap[key] = {
                user_id: shift.user_id,
                user_name: shift.user_name,
                regularCount: 0,
                specialCount: 0,
                totalHours: 0,
                regularShifts: [],
                specialShifts: []
            };
        }
        const hours = calculateRegularShiftHours(shift.time_slot);
        userMap[key].regularCount++;
        userMap[key].totalHours += hours;
        userMap[key].regularShifts.push(shift);
    }

    for (const shift of specialShifts) {
        const key = shift.user_id;
        if (!userMap[key]) {
            userMap[key] = {
                user_id: shift.user_id,
                user_name: shift.user_name,
                regularCount: 0,
                specialCount: 0,
                totalHours: 0,
                regularShifts: [],
                specialShifts: []
            };
        }
        const hours = calculateSpecialShiftHours(shift.start_time, shift.end_time);
        userMap[key].specialCount++;
        userMap[key].totalHours += hours;
        userMap[key].specialShifts.push(shift);
    }

    return Object.values(userMap).sort((a, b) => a.user_name.localeCompare(b.user_name, 'ja'));
}

// ===== テスト =====

describe('calculateRegularShiftHours', () => {
    test('30分シフトは0.5時間', () => {
        expect(calculateRegularShiftHours('13:00-13:30')).toBe(0.5);
    });

    test('1時間シフトは1.0時間', () => {
        expect(calculateRegularShiftHours('13:00-14:00')).toBe(1.0);
    });

    test('複数の30分スロットを連結した2時間', () => {
        expect(calculateRegularShiftHours('13:00-15:00')).toBe(2.0);
    });

    test('不正な入力は0を返す', () => {
        expect(calculateRegularShiftHours('')).toBe(0);
        expect(calculateRegularShiftHours(null)).toBe(0);
        expect(calculateRegularShiftHours('invalid')).toBe(0);
    });
});

describe('calculateSpecialShiftHours', () => {
    test('2時間30分のシフト', () => {
        expect(calculateSpecialShiftHours('13:00', '15:30')).toBe(2.5);
    });

    test('1時間のシフト', () => {
        expect(calculateSpecialShiftHours('10:00', '11:00')).toBe(1.0);
    });

    test('45分のシフト', () => {
        expect(calculateSpecialShiftHours('14:00', '14:45')).toBe(0.75);
    });

    test('不正な入力は0を返す', () => {
        expect(calculateSpecialShiftHours('', '15:00')).toBe(0);
        expect(calculateSpecialShiftHours(null, null)).toBe(0);
    });
});

describe('getMonthDateRange', () => {
    test('2026年4月', () => {
        expect(getMonthDateRange(2026, 4)).toEqual({
            startDate: '2026-04-01',
            endDate: '2026-04-30'
        });
    });

    test('2026年2月（うるう年でない）', () => {
        expect(getMonthDateRange(2026, 2)).toEqual({
            startDate: '2026-02-01',
            endDate: '2026-02-28'
        });
    });

    test('2024年2月（うるう年）', () => {
        expect(getMonthDateRange(2024, 2)).toEqual({
            startDate: '2024-02-01',
            endDate: '2024-02-29'
        });
    });

    test('12月', () => {
        expect(getMonthDateRange(2026, 12)).toEqual({
            startDate: '2026-12-01',
            endDate: '2026-12-31'
        });
    });
});

describe('aggregateShiftsByUser', () => {
    const regularShifts = [
        { user_id: 'u1', user_name: '山田太郎', date: '2026-04-01', time_slot: '13:00-13:30' },
        { user_id: 'u1', user_name: '山田太郎', date: '2026-04-02', time_slot: '13:00-13:30' },
        { user_id: 'u2', user_name: '佐藤花子', date: '2026-04-01', time_slot: '13:00-14:00' }
    ];

    const specialShifts = [
        { user_id: 'u1', user_name: '山田太郎', date: '2026-04-03', start_time: '13:00', end_time: '15:00' }
    ];

    test('ユーザーごとに集計される', () => {
        const result = aggregateShiftsByUser(regularShifts, specialShifts);
        expect(result).toHaveLength(2);
    });

    test('通常シフト数が正しい', () => {
        const result = aggregateShiftsByUser(regularShifts, []);
        const yamada = result.find(u => u.user_id === 'u1');
        expect(yamada.regularCount).toBe(2);
    });

    test('特別シフト数が正しい', () => {
        const result = aggregateShiftsByUser([], specialShifts);
        const yamada = result.find(u => u.user_id === 'u1');
        expect(yamada.specialCount).toBe(1);
    });

    test('合計時間が正しく計算される', () => {
        const result = aggregateShiftsByUser(regularShifts, specialShifts);
        const yamada = result.find(u => u.user_id === 'u1');
        // 通常2件×0.5h + 特別1件×2h = 3h
        expect(yamada.totalHours).toBe(3.0);
    });

    test('名前の昇順（日本語）でソートされる', () => {
        const result = aggregateShiftsByUser(regularShifts, []);
        expect(result[0].user_name).toBe('佐藤花子');
        expect(result[1].user_name).toBe('山田太郎');
    });

    test('空のシフトリストは空配列を返す', () => {
        expect(aggregateShiftsByUser([], [])).toEqual([]);
    });
});
