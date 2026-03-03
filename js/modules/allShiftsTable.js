// allShiftsTable.js - 全シフト一覧テーブル表示モジュール

// フィルター状態
let currentFilters = {
    userName: '',
    startDate: '',
    endDate: ''
};

// 選択されているシフトUUIDのセット
let selectedShiftUuids = new Set();

/**
 * 全シフト一覧を読み込んで表示
 * @param {number} page - 表示するページ番号（1から開始）
 */
async function loadAllShiftsTable(page = 1) {
    const allShiftsTableContent = document.getElementById('allShiftsTableContent');

    if (!allShiftsTableContent) {
        console.error('allShiftsTableContent element not found');
        return;
    }

    // ローディング表示
    allShiftsTableContent.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <div class="loading-text">全シフトを読み込み中...</div>
        </div>
    `;

    try {
        // バックエンドAPIから全シフトを取得
        const shiftsResult = await API.getAllShifts();

        if (!shiftsResult.success) {
            throw new Error(shiftsResult.error || '全シフトの取得に失敗しました');
        }

        const shifts = shiftsResult.data || [];

        // シフト一覧を表示
        displayAllShiftsTable(shifts, page, 50);

    } catch (error) {
        console.error('全シフトの読み込みエラー:', error);
        allShiftsTableContent.innerHTML = `
            <div class="error-message">
                <p>全シフトの読み込みに失敗しました</p>
                <p style="font-size: 14px; color: #666;">${error.message}</p>
                <button onclick="loadAllShiftsTable()" class="retry-btn">再試行</button>
            </div>
        `;
    }
}

/**
 * シフトデータをフィルタリング
 * @param {Array} shifts - シフトデータ配列
 * @returns {Array} フィルタリング後のシフトデータ
 */
function applyFilters(shifts) {
    let filtered = [...shifts];

    // ユーザー名でフィルタ（完全一致）
    if (currentFilters.userName) {
        filtered = filtered.filter(shift =>
            shift.user_name === currentFilters.userName
        );
    }

    // 開始日でフィルタ
    if (currentFilters.startDate) {
        const startDate = new Date(currentFilters.startDate);
        filtered = filtered.filter(shift =>
            new Date(shift.date) >= startDate
        );
    }

    // 終了日でフィルタ
    if (currentFilters.endDate) {
        const endDate = new Date(currentFilters.endDate);
        filtered = filtered.filter(shift =>
            new Date(shift.date) <= endDate
        );
    }

    return filtered;
}

/**
 * フィルターUIを生成
 * @param {Array} shifts - 全シフトデータ配列（ユーザー名リスト生成用）
 * @returns {string} フィルターUIのHTML
 */
function generateFilterUI(shifts) {
    const isFilterActive = currentFilters.userName || currentFilters.startDate || currentFilters.endDate;

    // シフトデータからユニークなユーザー名リストを生成
    const uniqueUserNames = [...new Set(shifts.map(shift => shift.user_name))].sort();

    // ユーザー名のプルダウンオプションを生成
    const userNameOptions = uniqueUserNames.map(userName =>
        `<option value="${escapeHtml(userName)}" ${currentFilters.userName === userName ? 'selected' : ''}>${escapeHtml(userName)}</option>`
    ).join('');

    return `
        <div class="filter-container">
            <div class="filter-row">
                <select id="filterUserName" class="filter-select">
                    <option value="">すべてのユーザー</option>
                    ${userNameOptions}
                </select>
                <input type="date" id="filterStartDate" class="filter-input" value="${currentFilters.startDate}">
                <span class="date-separator">〜</span>
                <input type="date" id="filterEndDate" class="filter-input" value="${currentFilters.endDate}">
                <div class="filter-buttons">
                    <button class="filter-btn filter-btn-apply" id="applyFilterBtn">絞り込み</button>
                    <button class="filter-btn filter-btn-reset" id="resetFilterBtn">リセット</button>
                </div>
            </div>
            ${isFilterActive ? '<span class="filter-active-indicator">フィルター適用中</span>' : ''}
        </div>
    `;
}

/**
 * 全シフト一覧をテーブル表示
 * @param {Array} shifts - シフトデータ配列
 * @param {number} currentPage - 現在のページ番号（1から開始）
 * @param {number} itemsPerPage - 1ページあたりの表示件数
 */
function displayAllShiftsTable(shifts, currentPage = 1, itemsPerPage = 50) {
    const allShiftsTableContent = document.getElementById('allShiftsTableContent');

    if (!allShiftsTableContent) {
        return;
    }

    // フィルタリングを適用
    const filteredShifts = applyFilters(shifts);

    if (!filteredShifts || filteredShifts.length === 0) {
        allShiftsTableContent.innerHTML = `
            <div class="all-shifts-table-container">
                <h2 style="margin-bottom: 20px;">全シフト一覧（0件）</h2>
                ${generateFilterUI(shifts)}
                <p style="text-align: center; color: #666; padding: 40px;">
                    ${currentFilters.userName || currentFilters.startDate || currentFilters.endDate
                        ? '条件に一致するシフトが見つかりませんでした'
                        : '登録されているシフトはありません'}
                </p>
            </div>
        `;
        setupFilterEventListeners();
        return;
    }

    // 日付降順にソート（新しい順）
    const sortedShifts = [...filteredShifts].sort((a, b) => {
        const dateCompare = new Date(b.date) - new Date(a.date);
        if (dateCompare !== 0) return dateCompare;
        // 同じ日付の場合は時間帯でソート
        return (a.time_slot || '').localeCompare(b.time_slot || '');
    });

    // ページネーション計算
    const totalItems = sortedShifts.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const pageShifts = sortedShifts.slice(startIndex, endIndex);

    // テーブルを生成
    const tableHTML = `
        <div class="all-shifts-table-container">
            <h2 style="margin-bottom: 20px;">全シフト一覧（${totalItems}件）</h2>
            ${generateFilterUI(shifts)}
            <div class="bulk-action-bar" id="bulkActionBar" style="display: none;">
                <span class="bulk-selected-count" id="bulkSelectedCount">0件選択中</span>
                <button class="bulk-delete-btn" id="bulkDeleteBtn">選択したシフトを削除</button>
            </div>
            <table class="all-shifts-table">
                <thead>
                    <tr>
                        <th style="width: 40px; text-align: center;">
                            <input type="checkbox" id="selectAllCheckbox" title="すべて選択/解除">
                        </th>
                        <th>ユーザー名</th>
                        <th>日付</th>
                        <th>時間帯</th>
                        <th>作成日時</th>
                        <th>カレンダー同期</th>
                        <th style="width: 100px;">操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${pageShifts.map(shift => `
                        <tr data-shift-uuid="${escapeHtml(shift.uuid)}">
                            <td style="text-align: center;">
                                <input type="checkbox" class="shift-row-checkbox" data-shift-uuid="${escapeHtml(shift.uuid)}">
                            </td>
                            <td>${escapeHtml(shift.user_name)}</td>
                            <td>${formatDateWithWeekday(shift.date)}</td>
                            <td>${escapeHtml(shift.time_slot)}</td>
                            <td>${formatDateTime(shift.created_at)}</td>
                            <td style="text-align: center;">
                                ${shift.calendar_event_id ? '<span style="color: #4CAF50;">✓</span>' : '<span style="color: #999;">-</span>'}
                            </td>
                            <td>
                                <button class="delete-shift-table-btn" data-shift-uuid="${escapeHtml(shift.uuid)}" data-shift-info="${escapeHtml(shift.user_name)} / ${escapeHtml(shift.date)} ${escapeHtml(shift.time_slot)}">
                                    削除
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ${totalPages > 1 ? generateAllShiftsPagination(currentPage, totalPages, totalItems) : ''}
        </div>
    `;

    allShiftsTableContent.innerHTML = tableHTML;

    // ページ遷移時は選択状態をリセット
    selectedShiftUuids.clear();

    // フィルターのイベントリスナーを設定
    setupFilterEventListeners();

    // 削除ボタンのイベントリスナーを設定
    const deleteButtons = allShiftsTableContent.querySelectorAll('.delete-shift-table-btn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', handleDeleteShiftFromTable);
    });

    // チェックボックスのイベントリスナーを設定
    setupCheckboxEventListeners();

    // 一括削除ボタンのイベントリスナーを設定
    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    if (bulkDeleteBtn) {
        bulkDeleteBtn.addEventListener('click', handleBulkDelete);
    }

    // ページネーションボタンのイベントリスナーを設定
    const paginationButtons = allShiftsTableContent.querySelectorAll('.pagination-btn');
    paginationButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const page = parseInt(e.target.getAttribute('data-page'));
            loadAllShiftsTable(page);
        });
    });
}

/**
 * ページネーションHTMLを生成
 * @param {number} currentPage - 現在のページ番号
 * @param {number} totalPages - 総ページ数
 * @param {number} itemsPerPage - 1ページあたりの表示件数
 * @param {number} totalItems - 総アイテム数
 * @returns {string} ページネーションHTML
 */
function generateAllShiftsPagination(currentPage, totalPages, totalItems) {
    let paginationHTML = '<div class="pagination">';

    // 前へボタン
    if (currentPage > 1) {
        paginationHTML += `<button class="pagination-btn" data-page="${currentPage - 1}">前へ</button>`;
    } else {
        paginationHTML += `<button class="pagination-btn" disabled>前へ</button>`;
    }

    // ページ番号ボタン（最大5個表示）
    const maxPageButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);

    // 最後のページに近い場合の調整
    if (endPage - startPage < maxPageButtons - 1) {
        startPage = Math.max(1, endPage - maxPageButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        const activeClass = i === currentPage ? 'active' : '';
        paginationHTML += `<button class="pagination-btn ${activeClass}" data-page="${i}">${i}</button>`;
    }

    // 次へボタン
    if (currentPage < totalPages) {
        paginationHTML += `<button class="pagination-btn" data-page="${currentPage + 1}">次へ</button>`;
    } else {
        paginationHTML += `<button class="pagination-btn" disabled>次へ</button>`;
    }

    // ページ情報
    paginationHTML += `<div class="pagination-info">ページ ${currentPage} / ${totalPages} （全 ${totalItems} 件）</div>`;

    paginationHTML += '</div>';

    return paginationHTML;
}

/**
 * シフト削除ハンドラ
 */
async function handleDeleteShiftFromTable(event) {
    const button = event.target;
    const shiftUuid = button.getAttribute('data-shift-uuid');
    const shiftInfo = button.getAttribute('data-shift-info');

    if (!shiftUuid) {
        alert('シフトIDが見つかりません');
        return;
    }

    // 確認ダイアログ
    const confirmMessage = `本当にこのシフトを削除しますか？\n\n${shiftInfo}\n\nこの操作は取り消せません。`;
    if (!confirm(confirmMessage)) {
        return;
    }

    // ボタンを無効化
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '削除中...';

    try {
        const result = await API.deleteShift(shiftUuid);

        if (result.success) {
            alert('シフトを削除しました');

            // 行を削除（アニメーション効果付き）
            const row = button.closest('tr');
            if (row) {
                row.style.opacity = '0';
                row.style.transition = 'opacity 0.3s';
                setTimeout(() => {
                    // 全シフト一覧を再読み込み
                    loadAllShiftsTable();
                }, 300);
            }
        } else {
            alert('シフトの削除に失敗しました: ' + (result.error || '不明なエラー'));
            button.disabled = false;
            button.textContent = originalText;
        }
    } catch (error) {
        console.error('シフット削除エラー:', error);
        alert('シフトの削除に失敗しました');
        button.disabled = false;
        button.textContent = originalText;
    }
}

/**
 * フィルターのイベントリスナーをセットアップ
 */
function setupFilterEventListeners() {
    // 絞り込みボタン
    const applyFilterBtn = document.getElementById('applyFilterBtn');
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', handleApplyFilter);
    }

    // リセットボタン
    const resetFilterBtn = document.getElementById('resetFilterBtn');
    if (resetFilterBtn) {
        resetFilterBtn.addEventListener('click', handleResetFilter);
    }
}

/**
 * フィルター適用ハンドラ
 */
function handleApplyFilter() {
    // フィルター値を取得
    const userName = document.getElementById('filterUserName')?.value || '';
    const startDate = document.getElementById('filterStartDate')?.value || '';
    const endDate = document.getElementById('filterEndDate')?.value || '';

    // バリデーション：終了日が開始日より前の場合
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        alert('終了日は開始日以降の日付を指定してください');
        return;
    }

    // フィルター状態を更新
    currentFilters = {
        userName: userName.trim(),
        startDate: startDate,
        endDate: endDate
    };

    // APIから再取得して最初のページを表示
    loadAllShiftsTable(1);
}

/**
 * フィルターリセットハンドラ
 */
function handleResetFilter() {
    // フィルター状態をクリア
    currentFilters = {
        userName: '',
        startDate: '',
        endDate: ''
    };

    // APIから再取得して表示
    loadAllShiftsTable(1);
}

/**
 * 一括削除アクションバーの表示を更新
 */
function updateBulkActionBar() {
    const bulkActionBar = document.getElementById('bulkActionBar');
    const bulkSelectedCount = document.getElementById('bulkSelectedCount');
    if (!bulkActionBar || !bulkSelectedCount) return;

    const count = selectedShiftUuids.size;
    if (count > 0) {
        bulkActionBar.style.display = 'flex';
        bulkSelectedCount.textContent = `${count}件選択中`;
    } else {
        bulkActionBar.style.display = 'none';
    }
}

/**
 * チェックボックスのイベントリスナーをセットアップ
 */
function setupCheckboxEventListeners() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const rowCheckboxes = document.querySelectorAll('.shift-row-checkbox');

    // 全選択チェックボックス
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            rowCheckboxes.forEach(cb => {
                cb.checked = e.target.checked;
                const uuid = cb.getAttribute('data-shift-uuid');
                if (uuid) {
                    if (e.target.checked) {
                        selectedShiftUuids.add(uuid);
                    } else {
                        selectedShiftUuids.delete(uuid);
                    }
                }
            });
            updateBulkActionBar();
        });
    }

    // 各行のチェックボックス
    rowCheckboxes.forEach(cb => {
        cb.addEventListener('change', (e) => {
            const uuid = e.target.getAttribute('data-shift-uuid');
            if (uuid) {
                if (e.target.checked) {
                    selectedShiftUuids.add(uuid);
                } else {
                    selectedShiftUuids.delete(uuid);
                }
            }

            // 全選択チェックボックスの状態を更新
            if (selectAllCheckbox) {
                const allChecked = [...rowCheckboxes].every(c => c.checked);
                const someChecked = [...rowCheckboxes].some(c => c.checked);
                selectAllCheckbox.checked = allChecked;
                selectAllCheckbox.indeterminate = someChecked && !allChecked;
            }

            updateBulkActionBar();
        });
    });
}

/**
 * 一括削除ハンドラ
 */
async function handleBulkDelete() {
    const uuids = [...selectedShiftUuids];
    if (uuids.length === 0) return;

    const confirmMessage = `選択した${uuids.length}件のシフトを削除しますか？\n\nこの操作は取り消せません。`;
    if (!confirm(confirmMessage)) return;

    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    if (bulkDeleteBtn) {
        bulkDeleteBtn.disabled = true;
        bulkDeleteBtn.textContent = '削除中...';
    }

    try {
        const result = await API.deleteMultipleShifts(uuids);

        if (result.success) {
            alert(`${result.deletedCount || uuids.length}件のシフトを削除しました`);
            selectedShiftUuids.clear();
            loadAllShiftsTable();
        } else {
            alert('シフトの削除に失敗しました: ' + (result.error || '不明なエラー'));
            if (bulkDeleteBtn) {
                bulkDeleteBtn.disabled = false;
                bulkDeleteBtn.textContent = '選択したシフトを削除';
            }
        }
    } catch (error) {
        console.error('一括削除エラー:', error);
        alert('シフトの削除に失敗しました');
        if (bulkDeleteBtn) {
            bulkDeleteBtn.disabled = false;
            bulkDeleteBtn.textContent = '選択したシフトを削除';
        }
    }
}
