// shifts.js - シフト一覧関連のモジュール

// グローバル関数からユーザーシフトデータを読み込む
async function loadUserShiftsData() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    try {
        const result = await API.getUserShifts(currentUser.sub);

        if (result.success && result.data) {
            // データ形式を統一（snake_case → camelCase）
            const userShifts = result.data.map(shift => ({
                shiftDate: shift.date,
                timeSlot: shift.time_slot,
                userId: shift.user_id,
                userName: shift.user_name,
                uuid: shift.uuid,
                registrationDate: shift.created_at
            }));
            setCurrentUserShifts(userShifts);
        }
    } catch (error) {
        console.error('ユーザーシフトデータの取得に失敗:', error);
        setCurrentUserShifts([]);
    }
}

// 管理者用シフト一覧を表示
async function displayShiftList() {
    const container = document.getElementById('shiftCalendarContainer');
    if (!container) return;

    updateBulkActionBarCount('calendarSelectedCount', 0);

    try {
        // シフトデータを取得
        const shiftsResult = await API.getAllShifts();

        if (shiftsResult.success && shiftsResult.data && shiftsResult.data.length > 0) {
            // データ形式を統一
            const allShifts = shiftsResult.data.map(shift => ({
                shiftDate: shift.date,
                timeSlot: shift.time_slot,
                userId: shift.user_id,
                userName: shift.user_name,
                nickname: shift.nickname,
                realName: shift.real_name,
                uuid: shift.uuid,
                registrationDate: shift.created_at
            }));

            setAllShiftsData(allShifts);
            generateCalendar('shiftCalendarContainer');

            // 人数設定データも取得してメモを表示
            const capacityResult = await API.getCapacitySettings();

            if (capacityResult.success && capacityResult.data && capacityResult.data.length > 0) {
                displayCapacityOnAdminCalendar(capacityResult.data);
            }
        } else {
            container.innerHTML = '<p>シフトデータがありません。</p>';
        }
    } catch (error) {
        console.error('シフトデータの読み込みに失敗:', error);
        container.innerHTML = '<p>シフトデータの読み込みに失敗しました。</p>';
    }
}

// 管理者用シフト一覧画面にメモを表示する関数
function displayCapacityOnAdminCalendar(capacityData) {
    const memoMap = {};
    capacityData.forEach(item => {
        if (item.date && item.date !== '') {
            memoMap[item.date] = item.memo || '';
        }
    });

    // 管理者画面のメモ表示エリアを更新
    Object.keys(memoMap).forEach(dateKey => {
        const memoDisplayElement = document.getElementById(`admin-memo-${dateKey}`);
        if (memoDisplayElement) {
            const memo = memoMap[dateKey];
            memoDisplayElement.textContent = memo;

            // メモがある場合は表示、ない場合は非表示
            if (memo.trim()) {
                memoDisplayElement.style.display = 'block';
                memoDisplayElement.style.backgroundColor = '#fff3cd';
                memoDisplayElement.style.border = '1px solid #ffeaa7';
            } else {
                memoDisplayElement.style.display = 'none';
            }
        }
    });
}

// iCal購読URLを入力欄にセットする
function updateIcalUrl() {
    const input = document.getElementById('icalAllUrl');
    if (!input) return;
    if (config.ICAL_TOKEN) {
        input.value = `${config.API_BASE_URL}/ical/all?token=${config.ICAL_TOKEN}`;
    } else {
        input.value = '（ICAL_TOKEN が未設定です）';
    }
}

// iCal購読URLをクリップボードにコピーする
async function copyIcalUrl() {
    const input = document.getElementById('icalAllUrl');
    if (!input || !input.value) return;
    await navigator.clipboard.writeText(input.value);
    const btn = document.querySelector('.ical-copy-btn');
    if (btn) {
        const original = btn.textContent;
        btn.textContent = 'コピーしました';
        setTimeout(() => { btn.textContent = original; }, 1500);
    }
}

// 管理者用シフト一覧を読み込む
async function loadShiftList() {
    console.log('管理者モード: 全員のシフト一覧を読み込み中...');

    updateIcalUrl();

    const container = document.getElementById('shiftCalendarContainer');
    if (!container) return;

    // ローディング表示
    container.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <div class="loading-text">全員のシフト一覧を読み込み中...</div>
        </div>
    `;

    await displayShiftList();
    setupCalendarBulkDelete();
}

// 自分のシフト一覧を読み込む
async function loadMyShifts() {
    console.log('自分のシフト一覧を表示中...');
    const container = document.getElementById('myShiftsContent');
    if (!container) {
        console.error('[loadMyShifts] myShiftsContent コンテナが見つかりません');
        return;
    }

    const currentUser = getCurrentUser();
    console.log('[loadMyShifts] currentUser:', currentUser);

    if (!currentUser) {
        console.error('[loadMyShifts] ユーザーがログインしていません');
        container.innerHTML = '<p>ログインが必要です。</p>';
        return;
    }

    console.log('[loadMyShifts] userId:', currentUser.sub);

    // ローディング表示
    container.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <div class="loading-text">自分のシフト一覧を読み込み中...</div>
        </div>
    `;

    try {
        console.log('[loadMyShifts] APIリクエスト開始');
        // APIからシフトデータを取得
        const result = await API.getUserShifts(currentUser.sub);
        console.log('[loadMyShifts] APIレスポンス:', result);

        if (result.success) {
            console.log('[loadMyShifts] データ取得成功。件数:', result.data?.length || 0);
            // データ形式を統一
            const myShifts = (result.data || []).map(shift => ({
                shiftDate: shift.date,
                timeSlot: shift.time_slot,
                userId: shift.user_id,
                userName: shift.user_name,
                uuid: shift.uuid,
                registrationDate: shift.created_at
            }));

            displayMyShifts(container, myShifts);

            // シフト申請後のスクロール&ハイライト処理は displayMyShifts() 内で実行されます
        } else {
            console.error('[loadMyShifts] result.success が false:', result);
            container.innerHTML = '<p>シフトデータの取得に失敗しました。</p>';
        }
    } catch (error) {
        console.error('[loadMyShifts] エラー発生:', error);
        console.error('[loadMyShifts] エラーの詳細:', error.message, error.stack);
        container.innerHTML = `<p>シフトデータの読み込みに失敗しました。</p><p style="color: red; font-size: 0.8em;">エラー: ${error.message}</p>`;
    }
}

// 自分のシフト一覧を表示する
function displayMyShifts(container, shiftsData) {
    if (!shiftsData || shiftsData.length === 0) {
        container.innerHTML = `
            <div class="no-shifts-message">
                <h4>まだシフトが登録されていません</h4>
                <p>「シフト申請」タブからシフトを申請してください。</p>
            </div>
        `;
        return;
    }

    // 日付ごとにシフトをグループ化
    const shiftsByDate = {};
    shiftsData.forEach(shift => {
        const date = shift.shiftDate;
        if (!shiftsByDate[date]) {
            shiftsByDate[date] = {
                shifts: [],
                registrationDate: shift.registrationDate,
                uuidMap: {}  // 時間スロット → UUID のマップ
            };
        }
        shiftsByDate[date].shifts.push(shift.timeSlot);
        shiftsByDate[date].uuidMap[shift.timeSlot] = shift.uuid;
    });

    // 各日付の時間帯をマージ
    const mergedShifts = [];
    Object.keys(shiftsByDate).forEach(date => {
        const dateData = shiftsByDate[date];
        const mergedTimeSlots = mergeConsecutiveTimeSlots(dateData.shifts);

        mergedTimeSlots.forEach(timeSlot => {
            // マージされた時間帯に含まれるUUIDをすべて取得
            const uuids = [];
            if (timeSlot.includes('-')) {
                // "13:00-15:00" のような範囲の場合、含まれる30分スロットのUUIDをすべて取得
                const originalSlots = dateData.shifts.filter(slot => {
                    const [slotStart] = slot.split('-');
                    const [rangeStart, rangeEnd] = timeSlot.split('-');
                    return slotStart >= rangeStart && slotStart < rangeEnd;
                });
                originalSlots.forEach(slot => {
                    if (dateData.uuidMap[slot]) {
                        uuids.push(dateData.uuidMap[slot]);
                    }
                });
            } else {
                // 単一スロットの場合
                if (dateData.uuidMap[timeSlot]) {
                    uuids.push(dateData.uuidMap[timeSlot]);
                }
            }

            mergedShifts.push({
                shiftDate: date,
                timeSlot: timeSlot,
                uuids: uuids,  // UUID配列
                registrationDate: dateData.registrationDate
            });
        });
    });

    // 日付でソート
    mergedShifts.sort((a, b) => new Date(a.shiftDate) - new Date(b.shiftDate));

    // シフトテーブルを作成
    let tableHTML = `
        ${createBulkActionBarHTML('myShiftsBulkActionBar', 'myShiftsSelectedCount', 'myShiftsBulkDeleteBtn')}
        <div class="my-shifts-table-container">
            <table class="my-shifts-table">
                <thead>
                    <tr>
                        <th style="width: 40px; text-align: center;"><input type="checkbox" id="myShiftsSelectAll" title="全選択/解除"></th>
                        <th>シフト日</th>
                        <th>時間帯</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
    `;

    mergedShifts.forEach(shift => {
        const shiftDate = new Date(shift.shiftDate);
        const formattedDate = shiftDate.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'short'
        });

        const registrationDate = new Date(shift.registrationDate);
        const formattedRegDate = registrationDate.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
        });

        // 削除可能性の判定（翌日以降のみ削除可能）
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const isPastOrToday = shiftDate < tomorrow; // 今日以前（今日を含む）
        const canDelete = shiftDate >= tomorrow; // 翌日以降のみ削除可能
        const rowClass = isPastOrToday ? 'past-shift' : 'future-shift';

        // 削除ボタンの表示（翌日以降のシフトのみ）
        const deleteButtonHTML = canDelete ?
            `<td class="shift-actions">
                <button class="my-shift-delete-btn" onclick="deleteMyShift(this, [${(shift.uuids || []).map(uuid => `'${uuid}'`).join(',')}])">
                    削除
                </button>
            </td>` :
            '<td class="shift-actions">-</td>';

        // チェックボックス（翌日以降のシフトのみ有効）
        const uuidsStr = (shift.uuids || []).join(',');
        const checkboxHTML = canDelete
            ? `<td style="text-align: center;"><input type="checkbox" class="my-shift-row-checkbox" data-uuids="${uuidsStr}" data-date="${shift.shiftDate}" data-time="${shift.timeSlot}"></td>`
            : `<td style="text-align: center;"><input type="checkbox" disabled style="opacity: 0.3;"></td>`;

        // メモ情報を取得（capacityDataから）
        let memo = '';
        if (window.capacityData) {
            const capacityItem = window.capacityData.find(item => item.date === shift.shiftDate);
            memo = capacityItem ? (capacityItem.memo || '') : '';
        }

        // メモがある場合のみスタイルを適用して日付の下に表示
        const memoHTML = memo ? `<br><span class="shift-memo">${memo}</span>` : '';

        tableHTML += `
            <tr class="${rowClass}" data-date="${shift.shiftDate}" data-time-range="${shift.timeSlot}">
                ${checkboxHTML}
                <td class="shift-date">${formattedDate}${memoHTML}</td>
                <td class="shift-time">${shift.timeSlot}</td>
                ${deleteButtonHTML}
            </tr>
        `;
    });

    tableHTML += `
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = tableHTML;

    // チェックボックスのイベントリスナーを設定
    setupMyShiftsCheckboxListeners();

    // スクロール処理: 申請直後の場合、該当シフトまでスクロール
    const scrollToShiftAfterLoad = getScrollToShiftAfterLoad();
    if (scrollToShiftAfterLoad) {
        const { date, timeSlots } = scrollToShiftAfterLoad;
        const targetRows = findMatchingShiftRows(date, timeSlots);

        if (targetRows.length > 0) {
            scrollToAndHighlightRows(targetRows);
        }

        setScrollToShiftAfterLoad(null);
    }
}

// 自分のシフト一覧のチェックボックスイベントリスナーをセットアップ
function setupMyShiftsCheckboxListeners() {
    const selectAll = document.getElementById('myShiftsSelectAll');
    const bulkDeleteBtn = document.getElementById('myShiftsBulkDeleteBtn');

    if (!selectAll) return;

    const updateActionBar = () => {
        const checked = document.querySelectorAll('.my-shift-row-checkbox:checked');
        const all = document.querySelectorAll('.my-shift-row-checkbox:not(:disabled)');

        updateBulkActionBarCount('myShiftsSelectedCount', checked.length);

        selectAll.indeterminate = checked.length > 0 && checked.length < all.length;
        selectAll.checked = all.length > 0 && checked.length === all.length;
    };

    selectAll.addEventListener('change', () => {
        document.querySelectorAll('.my-shift-row-checkbox:not(:disabled)').forEach(cb => {
            cb.checked = selectAll.checked;
        });
        updateActionBar();
    });

    document.querySelectorAll('.my-shift-row-checkbox').forEach(cb => {
        cb.addEventListener('change', updateActionBar);
    });

    bulkDeleteBtn.addEventListener('click', async () => {
        const checkedBoxes = document.querySelectorAll('.my-shift-row-checkbox:checked');
        if (checkedBoxes.length === 0) return;

        const allUuids = [];
        checkedBoxes.forEach(cb => {
            const uuidsStr = cb.getAttribute('data-uuids');
            if (uuidsStr) {
                uuidsStr.split(',').forEach(uuid => { if (uuid) allUuids.push(uuid); });
            }
        });

        if (allUuids.length === 0) return;

        const confirmMessage = `選択した ${checkedBoxes.length} 件のシフトを削除しますか？\n\nこの操作は取り消せません。`;
        if (!confirm(confirmMessage)) return;

        bulkDeleteBtn.disabled = true;
        bulkDeleteBtn.textContent = '削除中...';

        try {
            const result = await API.deleteMultipleShifts(allUuids);
            if (result.success) {
                alert(`${checkedBoxes.length}件のシフトを削除しました。`);
                await loadMyShifts();
            } else {
                alert('シフトの削除に失敗しました: ' + (result.error || '不明なエラー'));
                bulkDeleteBtn.disabled = false;
                bulkDeleteBtn.textContent = '選択したシフトを削除';
            }
        } catch (error) {
            console.error('一括削除エラー:', error);
            alert('シフトの削除に失敗しました');
            bulkDeleteBtn.disabled = false;
            bulkDeleteBtn.textContent = '選択したシフトを削除';
        }
    });
}

// 該当するシフト行を探す関数
function findMatchingShiftRows(date, timeSlots) {
    const allRows = document.querySelectorAll('.my-shifts-table tr');
    const targetRows = [];

    for (const row of allRows) {
        const rowDate = row.dataset.date;
        const rowTimeRange = row.dataset.timeRange;

        if (rowDate === date && rowTimeRange && isTimeSlotInRange(timeSlots, rowTimeRange)) {
            targetRows.push(row);
        }
    }

    return targetRows;
}

// 申請した時間枠が行の時間範囲に含まれているかチェック
function isTimeSlotInRange(timeSlots, rowTimeRange) {
    const [rowStart, rowEnd] = rowTimeRange.split('-');
    const rowStartMinutes = timeToMinutes(rowStart);
    const rowEndMinutes = timeToMinutes(rowEnd);

    return timeSlots.some(slot => {
        const [slotStart, slotEnd] = slot.split('-');
        const slotStartMinutes = timeToMinutes(slotStart);
        const slotEndMinutes = timeToMinutes(slotEnd);
        return slotStartMinutes >= rowStartMinutes && slotEndMinutes <= rowEndMinutes;
    });
}

// 行にスクロールしてハイライトを適用
function scrollToAndHighlightRows(targetRows) {
    setTimeout(() => {
        targetRows[0].scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });

        targetRows.forEach(applyHighlightWithFadeout);
    }, 100);
}

// ハイライトとフェードアウトを適用
function applyHighlightWithFadeout(row) {
    row.classList.add('highlight-shift');

    setTimeout(() => {
        row.classList.add('highlight-shift-fade-out');
        setTimeout(() => {
            row.classList.remove('highlight-shift', 'highlight-shift-fade-out');
        }, 1000);
    }, 3000);
}

// 時間を分に変換するヘルパー関数
function timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

// モーダルからシフト削除（管理者用）
async function deleteShiftFromModal(buttonElement, uuids) {
    if (!uuids || !Array.isArray(uuids) || uuids.length === 0) {
        alert('シフト情報が不正です。');
        return;
    }

    const currentUser = getCurrentUser();
    const isAdminUser = isAdmin();
    const allShiftsData = getAllShiftsData();

    // UUIDs配列に対応するすべてのシフト情報を取得
    const targetShifts = [];
    if (allShiftsData) {
        targetShifts.push(...allShiftsData.filter(s => uuids.includes(s.uuid)));
    }

    if (targetShifts.length === 0) {
        alert('シフト情報が見つかりません。');
        return;
    }

    const firstShift = targetShifts[0];

    // 管理者または本人のシフトのみ削除可能
    if (!isAdminUser && firstShift.userId !== currentUser.sub) {
        alert('自分のシフトまたは管理者権限が必要です。');
        return;
    }

    const userName = getShiftDisplayName(firstShift);
    const dateKey = firstShift.shiftDate || firstShift.date;

    // 複数の時間帯をマージして表示用の時間帯を作成
    const timeSlots = targetShifts.map(shift => shift.timeSlot || shift.time);
    const mergedTimeSlots = mergeConsecutiveTimeSlots(timeSlots);
    const displayTimeRange = mergedTimeSlots.length === 1 ? mergedTimeSlots[0] : mergedTimeSlots.join(', ');

    if (!confirm(`${userName}さんの${dateKey} ${displayTimeRange}のシフトを削除しますか？`)) {
        return;
    }

    // ボタンを無効化
    const originalText = buttonElement.textContent;
    buttonElement.disabled = true;
    buttonElement.textContent = '削除中...';
    buttonElement.style.opacity = '0.6';

    try {
        // 複数シフトを一括削除
        const result = await API.deleteMultipleShifts(uuids);

        if (!result.success) {
            throw new Error(result.error || 'シフトの削除に失敗しました');
        }

        alert(`${userName}さんの${dateKey} ${displayTimeRange}のシフトを削除しました。`);

        // モーダルを閉じる
        const modal = document.getElementById('shiftDetailModal');
        if (modal) {
            modal.style.display = 'none';
        }

        // データを再読み込み
        if (isAdminUser) {
            // カレンダーとシフト一覧を再読み込み
            generateCalendar('shiftCalendarContainer');
            await displayShiftList();
        } else {
            // 一般ユーザーの場合はカレンダーを再読み込み
            generateCalendar('shiftCalendarContainer');
        }

    } catch (error) {
        console.error('シフト削除でエラー:', error);
        alert('シフトの削除に失敗しました。再度お試しください。');
    } finally {
        // ボタンの状態を復元
        buttonElement.disabled = false;
        buttonElement.textContent = originalText;
        buttonElement.style.opacity = '1';
    }
}

// 自分のシフト削除機能
async function deleteMyShift(buttonElement, uuids) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        alert('ログインしてください。');
        return;
    }

    if (!uuids || !Array.isArray(uuids) || uuids.length === 0) {
        alert('シフト情報が不正です。');
        return;
    }

    // APIから自分のシフト情報を取得してUUIDに対応するものをフィルタ
    try {
        const result = await API.getUserShifts(currentUser.sub);

        if (!result.success) {
            alert('シフト情報の取得に失敗しました。');
            return;
        }

        const myShifts = (result.data || []).map(shift => ({
            shiftDate: shift.date,
            timeSlot: shift.time_slot,
            uuid: shift.uuid
        }));

        const targetShifts = myShifts.filter(shift => uuids.includes(shift.uuid));

        if (targetShifts.length === 0) {
            alert('シフト情報が見つかりません。');
            return;
        }

        // 最初のシフトで日付チェック
        const firstShift = targetShifts[0];
        const targetDate = new Date(firstShift.shiftDate || firstShift.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (targetDate < tomorrow) {
            alert('今日以前のシフトは削除できません。翌日以降のシフトのみ削除可能です。');
            return;
        }

        const shiftDate = firstShift.shiftDate || firstShift.date;

        // 複数の時間帯をマージして表示用の時間帯を作成
        const timeSlots = targetShifts.map(shift => shift.timeSlot || shift.time);
        const mergedTimeSlots = mergeConsecutiveTimeSlots(timeSlots);
        const displayTimeSlot = mergedTimeSlots.length === 1 ? mergedTimeSlots[0] : mergedTimeSlots.join(', ');

        if (!confirm(`${shiftDate} ${displayTimeSlot}のシフトを削除しますか？`)) {
            return;
        }

        // ボタンを無効化
        const originalText = buttonElement.textContent;
        buttonElement.disabled = true;
        buttonElement.textContent = '削除中...';
        buttonElement.style.opacity = '0.6';

        try {
            // 複数シフトを一括削除
            const deleteResult = await API.deleteMultipleShifts(uuids);

            if (!deleteResult.success) {
                throw new Error(deleteResult.error || 'シフトの削除に失敗しました');
            }

            alert(`${shiftDate} ${displayTimeSlot}のシフトを削除しました。`);

            // 自分のシフト一覧を再読み込み
            await loadMyShifts();

        } catch (error) {
            console.error('シフト削除でエラー:', error);
            alert('シフトの削除に失敗しました。再度お試しください。');
        } finally {
            // ボタンの状態を復元
            buttonElement.disabled = false;
            buttonElement.textContent = originalText;
            buttonElement.style.opacity = '1';
        }

    } catch (error) {
        console.error('シフト情報の取得でエラー:', error);
        alert('シフト情報の取得に失敗しました。');
    }
}
