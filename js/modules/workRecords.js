// workRecords.js - 勤務記録タブモジュール

/**
 * 時間帯文字列から時間数を計算する
 * @param {string} timeSlot - "HH:MM-HH:MM" 形式
 * @returns {number}
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
 * @param {string} startTime
 * @param {string} endTime
 * @returns {number}
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
 * @returns {Array}
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
        userMap[key].regularCount++;
        userMap[key].totalHours += calculateRegularShiftHours(shift.time_slot);
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
        userMap[key].specialCount++;
        // 申請データは time_slot フィールドを持つ
        const hours = shift.time_slot
            ? calculateRegularShiftHours(shift.time_slot)
            : calculateSpecialShiftHours(shift.start_time, shift.end_time);
        userMap[key].totalHours += hours;
        userMap[key].specialShifts.push(shift);
    }

    return Object.values(userMap).sort((a, b) => a.user_name.localeCompare(b.user_name, 'ja'));
}

// 展開中のユーザーIDセット
let expandedUsers = new Set();
// 現在の集計データを保持（展開/折りたたみ時に再利用）
let currentAggregatedData = [];

/**
 * 勤務記録タブを読み込んで表示する
 * @param {number} year
 * @param {number} month
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

        currentAggregatedData = aggregateShiftsByUser(regularShifts, specialShifts);
        expandedUsers = new Set();

        renderWorkRecords(container, currentAggregatedData, targetYear, targetMonth);
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
 * @param {HTMLElement} container
 * @param {Array} aggregated
 * @param {number} year
 * @param {number} month
 */
function renderWorkRecords(container, aggregated, year, month) {
    const pad = (n) => String(n).padStart(2, '0');

    const totalRegular = aggregated.reduce((s, u) => s + u.regularCount, 0);
    const totalSpecial = aggregated.reduce((s, u) => s + u.specialCount, 0);
    const totalHours = aggregated.reduce((s, u) => s + u.totalHours, 0);

    const rowsHTML = aggregated.length === 0
        ? `<tr><td colspan="5" style="text-align:center; color:#666; padding:24px;">この月の勤務記録はありません</td></tr>`
        : aggregated.map(u => buildUserRow(u, year, month)).join('');

    container.innerHTML = `
        <div class="work-records-container">
            <div class="work-records-controls">
                <label class="month-label">表示月：</label>
                <input type="month" id="workRecordsMonth" value="${year}-${pad(month)}" class="month-input">
                <button id="workRecordsApplyBtn" class="filter-btn filter-btn-apply">表示</button>
            </div>
            <div class="work-records-summary-bar">
                合計：通常 <strong>${totalRegular}</strong> コマ　特別 <strong>${totalSpecial}</strong> 件
                計 <strong>${formatHours(totalHours)}</strong>
            </div>
            <table class="work-records-table">
                <thead>
                    <tr>
                        <th style="width:32px;"></th>
                        <th>ユーザー名</th>
                        <th>通常シフト</th>
                        <th>特別シフト</th>
                        <th>合計時間</th>
                    </tr>
                </thead>
                <tbody id="workRecordsTbody">
                    ${rowsHTML}
                </tbody>
            </table>
        </div>
    `;

    document.getElementById('workRecordsApplyBtn').addEventListener('click', () => {
        const val = document.getElementById('workRecordsMonth').value;
        if (!val) return;
        const [y, m] = val.split('-').map(Number);
        loadWorkRecords(y, m);
    });

    setupWorkRecordsToggle(aggregated, year, month);
}

/**
 * ユーザー行 + 詳細行のHTML
 */
function buildUserRow(u, year, month) {
    const isExpanded = expandedUsers.has(u.user_id);
    const detailHTML = isExpanded ? buildDetailRows(u) : '';

    return `
        <tr class="work-records-user-row" data-user-id="${escapeHtml(u.user_id)}">
            <td style="text-align:center;">
                <button class="wr-toggle-btn" data-user-id="${escapeHtml(u.user_id)}" title="詳細を表示">
                    ${isExpanded ? '▲' : '▼'}
                </button>
            </td>
            <td>${escapeHtml(u.user_name)}</td>
            <td style="text-align:center;">${u.regularCount} コマ</td>
            <td style="text-align:center;">${u.specialCount} 件</td>
            <td style="text-align:center;">${formatHours(u.totalHours)}</td>
        </tr>
        ${detailHTML}
    `;
}

/**
 * 詳細行のHTML（シフト一覧）
 */
function buildDetailRows(u) {
    const allShifts = [
        ...u.regularShifts.map(s => ({
            date: s.date, timeRange: s.time_slot, type: '通常'
        })),
        ...u.specialShifts.map(s => ({
            date: s.date,
            timeRange: s.time_slot || `${convertTimeToJST(s.start_time)}-${convertTimeToJST(s.end_time)}`,
            type: '特別'
        }))
    ].sort((a, b) => a.date.localeCompare(b.date));

    if (allShifts.length === 0) {
        return `<tr class="wr-detail-row"><td colspan="5" style="padding-left:48px; color:#888;">詳細なし</td></tr>`;
    }

    return allShifts.map(s => `
        <tr class="wr-detail-row">
            <td></td>
            <td></td>
            <td colspan="3" style="font-size:13px; padding-left:8px;">
                <span class="wr-detail-date">${formatDateWithWeekday(s.date)}</span>
                <span class="wr-detail-time">${escapeHtml(s.timeRange)}</span>
                <span class="wr-detail-badge ${s.type === '特別' ? 'special-badge' : 'regular-badge'}">${s.type}</span>
            </td>
        </tr>
    `).join('');
}

/**
 * 展開/折りたたみのイベントリスナーをセットアップ
 */
function setupWorkRecordsToggle(aggregated, year, month) {
    const tbody = document.getElementById('workRecordsTbody');
    if (!tbody) return;

    tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('.wr-toggle-btn');
        if (!btn) return;

        const userId = btn.getAttribute('data-user-id');
        if (expandedUsers.has(userId)) {
            expandedUsers.delete(userId);
        } else {
            expandedUsers.add(userId);
        }

        const userRow = tbody.querySelector(`.work-records-user-row[data-user-id="${CSS.escape(userId)}"]`);
        if (!userRow) return;

        // 既存の詳細行を削除
        let next = userRow.nextElementSibling;
        while (next && next.classList.contains('wr-detail-row')) {
            const toRemove = next;
            next = next.nextElementSibling;
            toRemove.remove();
        }

        const u = aggregated.find(x => x.user_id === userId);
        if (!u) return;

        btn.textContent = expandedUsers.has(userId) ? '▲' : '▼';

        if (expandedUsers.has(userId)) {
            userRow.insertAdjacentHTML('afterend', buildDetailRows(u));
        }
    });
}

/**
 * 時間数を表示用文字列にフォーマット
 * @param {number} hours
 * @returns {string}
 */
function formatHours(hours) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m === 0) return `${h}時間`;
    return `${h}時間${m}分`;
}
