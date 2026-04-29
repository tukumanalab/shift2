// workRecords.js - 勤務記録タブモジュール

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

/**
 * 時間数を H:MM 形式にフォーマット
 * @param {number} hours
 * @returns {string}
 */
function formatDuration(hours) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}:${String(m).padStart(2, '0')}`;
}

/**
 * 日付を "M月D日" 形式にフォーマット
 * @param {string} dateString - "YYYY-MM-DD"
 * @returns {string}
 */
function formatDateShort(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return `${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * 曜日を取得
 * @param {string} dateString - "YYYY-MM-DD"
 * @returns {string}
 */
function getDayOfWeek(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
}

/**
 * シフトデータをフラットな行配列に変換する
 * 通常シフト: user_id+date でグループ化し連続スロットをマージ
 * 特別シフト: user_id+special_shift_uuid でグループ化し連続スロットをマージ
 * @param {Array} regularShifts
 * @param {Array} specialShifts
 * @returns {Array<{user_id,user_name,date,start,end,hours,type}>}
 */
function buildShiftRows(regularShifts, specialShifts) {
    const rows = [];

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

    rows.sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        return d !== 0 ? d : a.user_name.localeCompare(b.user_name, 'ja');
    });

    return rows;
}

/**
 * Excel にコピペできる TSV 形式の文字列を生成する
 * @param {Array} rows - buildShiftRows の返り値
 * @returns {string}
 */
function buildTsvContent(rows) {
    return rows.map(r =>
        [formatDateShort(r.date), getDayOfWeek(r.date), r.start, r.end, formatDuration(r.hours)].join('\t')
    ).join('\n');
}

// 現在表示中のシフト行（コピー用に保持）
let currentRows = [];

/**
 * 勤務記録タブを読み込んで表示する
 */
async function loadWorkRecords(year, month) {
    const container = document.getElementById('workRecordsContent');
    if (!container) return;

    const now = new Date();
    const targetYear = year || now.getFullYear();
    const targetMonth = month || (now.getMonth() + 1);

    container.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <div class="loading-text">勤務記録を読み込み中...</div>
        </div>
    `;

    try {
        const { startDate, endDate } = getMonthDateRange(targetYear, targetMonth);

        const [regularResult, specialResult] = await Promise.all([
            fetch(`${config.API_BASE_URL}/shifts?startDate=${startDate}&endDate=${endDate}`).then(r => r.json()),
            fetch(`${config.API_BASE_URL}/special-shifts/applications`).then(r => r.json())
        ]);

        const regularShifts = regularResult.success ? (regularResult.data || []) : [];
        const allSpecial = specialResult.success ? (specialResult.data || []) : [];
        const specialShifts = allSpecial.filter(s => s.date >= startDate && s.date <= endDate);

        currentRows = buildShiftRows(regularShifts, specialShifts);

        renderWorkRecords(container, currentRows, targetYear, targetMonth);
    } catch (error) {
        console.error('勤務記録の読み込みエラー:', error);
        container.innerHTML = `
            <div class="error-message">
                <p>勤務記録の読み込みに失敗しました</p>
                <p style="font-size: 14px; color: #666;">${error.message}</p>
                <button onclick="loadWorkRecords()" class="retry-btn">再試行</button>
            </div>
        `;
    }
}

/**
 * 勤務記録を描画する
 */
function renderWorkRecords(container, rows, year, month) {
    const pad = (n) => String(n).padStart(2, '0');

    const uniqueUsers = [...new Map(rows.map(r => [r.user_id, r.user_name])).entries()]
        .sort((a, b) => a[1].localeCompare(b[1], 'ja'));

    const userOptions = uniqueUsers.map(([id, name]) =>
        `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`
    ).join('');

    const defaultUserId = uniqueUsers.length > 0 ? uniqueUsers[0][0] : '';
    const initialRows = defaultUserId ? rows.filter(r => r.user_id === defaultUserId) : [];

    container.innerHTML = `
        <div class="work-records-container">
            <div class="work-records-controls">
                <label class="month-label">表示月：</label>
                <input type="month" id="workRecordsMonth" value="${year}-${pad(month)}" class="month-input">
                <select id="workRecordsUserFilter" class="filter-select">
                    ${userOptions}
                </select>
                <button id="workRecordsApplyBtn" class="filter-btn filter-btn-apply">表示</button>
                <button id="workRecordsCopyBtn" class="wr-copy-btn">コピー</button>
            </div>
            <div id="workRecordsTableWrapper">
                ${buildTableHTML(initialRows)}
            </div>
        </div>
    `;

    document.getElementById('workRecordsApplyBtn').addEventListener('click', () => {
        const val = document.getElementById('workRecordsMonth').value;
        if (!val) return;
        const [y, m] = val.split('-').map(Number);
        loadWorkRecords(y, m);
    });

    document.getElementById('workRecordsUserFilter').addEventListener('change', () => {
        applyUserFilter(rows);
    });

    document.getElementById('workRecordsCopyBtn').addEventListener('click', () => {
        const userId = document.getElementById('workRecordsUserFilter').value;
        const targetRows = rows.filter(r => r.user_id === userId);
        const tsv = buildTsvContent(targetRows);
        navigator.clipboard.writeText(tsv).then(() => {
            const btn = document.getElementById('workRecordsCopyBtn');
            const orig = btn.textContent;
            btn.textContent = 'コピーしました！';
            setTimeout(() => { btn.textContent = orig; }, 2000);
        }).catch(() => {
            alert('クリップボードへのコピーに失敗しました');
        });
    });
}

function applyUserFilter(allRows) {
    const userId = document.getElementById('workRecordsUserFilter').value;
    const filtered = allRows.filter(r => r.user_id === userId);
    document.getElementById('workRecordsTableWrapper').innerHTML = buildTableHTML(filtered);
}

function buildTableHTML(rows) {
    if (rows.length === 0) {
        return `<p style="text-align:center; color:#666; padding:32px;">この月の勤務記録はありません</p>`;
    }

    const weekdayClass = (dateString) => {
        const d = getDayOfWeek(dateString);
        if (d === '日') return ' class="sunday"';
        if (d === '土') return ' class="saturday"';
        return '';
    };

    const rowsHTML = rows.map(r => `
        <tr>
            <td>${escapeHtml(r.user_name)}</td>
            <td>${formatDateShort(r.date)}</td>
            <td${weekdayClass(r.date)}>${getDayOfWeek(r.date)}</td>
            <td>${escapeHtml(r.start)}</td>
            <td>${escapeHtml(r.end)}</td>
            <td>${formatDuration(r.hours)}</td>
            <td><span class="${r.type === '特別' ? 'special-badge' : 'regular-badge'}">${r.type}</span></td>
        </tr>
    `).join('');

    return `
        <table class="work-records-table">
            <thead>
                <tr>
                    <th>ユーザー名</th>
                    <th>日付</th>
                    <th>曜日</th>
                    <th>勤務開始</th>
                    <th>勤務終了</th>
                    <th>時間数</th>
                    <th>種別</th>
                </tr>
            </thead>
            <tbody>${rowsHTML}</tbody>
        </table>
    `;
}
