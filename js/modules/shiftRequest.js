// shiftRequest.js - シフト申請関連モジュール

/**
 * シフト申請フォームを読み込む関数
 * 人数設定データとシフト申請数を並行して読み込み、カレンダーを生成する
 */
async function loadShiftRequestForm() {
    console.log('シフト申請フォームを読み込み中...');
    const container = document.getElementById('shiftRequestContent');
    if (!container) return;

    // ローディング表示
    container.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <div class="loading-text">シフト申請フォームを読み込み中...</div>
        </div>
    `;

    try {
        // 人数設定データとシフト申請数を並行して読み込み
        const [capacityData, shiftCounts] = await Promise.all([
            fetchCapacityFromSpreadsheet(),
            fetchShiftCountsFromSpreadsheet()
        ]);

        // グローバル変数に保存
        setCurrentShiftCounts(shiftCounts);
        window.currentCapacityData = capacityData;

        // コンテナをクリアしてカレンダーを生成
        container.innerHTML = '<div id="shiftRequestCalendarContainer" class="calendar-container"></div>';

        // カレンダーを生成（シフト申請モード）
        generateCalendar('shiftRequestCalendarContainer', false, true);

        // 人数データとシフト申請数をカレンダーに反映
        if (capacityData && capacityData.length > 0) {
            displayCapacityWithCountsOnCalendar(capacityData, shiftCounts);
        }

    } catch (error) {
        console.error('シフト申請フォームの読み込みに失敗しました:', error);
        container.innerHTML = '<p>シフト申請フォームの読み込みに失敗しました。</p>';
    }
}

/**
 * 人数設定データを読み込む関数
 * @returns {Promise<Array>} 人数設定データの配列
 */
async function fetchCapacityFromSpreadsheet() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        return [];
    }

    try {
        console.log('人数設定を読み込み中...');

        const response = await fetch(`${config.API_BASE_URL}/capacity-settings`);
        const result = await response.json();

        if (result.success) {
            console.log('人数設定をSQLiteから読み込みました:', result.data);
            return result.data || [];
        } else {
            console.error('人数設定の読み込みに失敗:', result.error);
            return [];
        }
    } catch (error) {
        console.error('人数設定の読み込みに失敗しました:', error);
        return [];
    }
}

/**
 * シフト申請数を読み込む関数
 * @returns {Promise<Object>} シフト申請数のマップ
 */
async function fetchShiftCountsFromSpreadsheet() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        return {};
    }

    try {
        const response = await fetch(`${config.API_BASE_URL}/shifts/counts`);
        const result = await response.json();

        if (result.success) {
            return result.data || {};
        } else {
            console.error('シフト申請数の読み込みに失敗:', result.error);
            return {};
        }
    } catch (error) {
        console.error('シフト申請数の読み込みに失敗しました:', error);
        return {};
    }
}

/**
 * 人数設定とシフト申請数をカレンダーに表示する関数
 * @param {Array} capacityData - 人数設定データ
 * @param {Object} shiftCounts - シフト申請数のマップ
 */
function displayCapacityWithCountsOnCalendar(capacityData, shiftCounts = {}) {
    // 人数設定データを日付をキーとするマップに変換
    const capacityMap = {};
    const memoMap = {};
    capacityData.forEach(item => {
        if (item.date && item.date !== '') {
            capacityMap[item.date] = item.capacity;
            memoMap[item.date] = item.memo || '';
        }
    });

    // 表示されているすべての日付の容量を更新
    const allDateElements = document.querySelectorAll('[data-date]');
    allDateElements.forEach(element => {
        const dateKey = element.getAttribute('data-date');
        if (dateKey) {
            // 日付全体の表示を更新
            const capacityElement = document.getElementById(`capacity-${dateKey}`);
            if (capacityElement) {
                // その日付の最大容量を取得
                let maxCapacityForDate = capacityMap[dateKey];
                if (maxCapacityForDate === undefined) {
                    const date = new Date(dateKey);
                    const dayOfWeek = date.getDay();
                    maxCapacityForDate = getDefaultCapacity(dayOfWeek);
                }

                // その日に設定されているシフト人数のみを表示（0人の場合は表示しない）
                if (maxCapacityForDate > 0) {
                    capacityElement.innerHTML = `<span class="capacity-number">${maxCapacityForDate}</span><span class="capacity-unit">人</span>`;
                } else {
                    capacityElement.innerHTML = '';
                }

                // メモ表示エリアも更新
                const memoDisplayElement = document.getElementById(`request-memo-${dateKey}`);
                if (memoDisplayElement) {
                    const memo = memoMap[dateKey] || '';
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

                // 申請ボタンの表示/非表示を更新
                const requestInfo = document.getElementById(`request-${dateKey}`);
                if (requestInfo) {
                    const existingButton = requestInfo.querySelector('.inline-apply-btn');

                    // 申請可能日かチェック
                    const cellDate = new Date(dateKey);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const isValidRequestDate = isDateAvailableForRequest(cellDate, today);

                    if (maxCapacityForDate > 0 && !existingButton && isValidRequestDate && cellDate >= today) {
                        // ボタンがなくて容量があり、申請可能日の場合は追加
                        const applyButton = document.createElement('button');
                        applyButton.className = 'inline-apply-btn';
                        applyButton.textContent = '申請';
                        applyButton.onclick = (e) => {
                            e.stopPropagation();
                            openDateDetailModal(dateKey);
                        };
                        requestInfo.appendChild(applyButton);
                    } else if ((maxCapacityForDate === 0 || !isValidRequestDate || cellDate < today) && existingButton) {
                        // ボタンがあって、容量がないか申請不可能日の場合は削除
                        existingButton.remove();
                    }
                }
            }
        }
    });
}

/**
 * シフト申請モーダルを開く（旧UI用）
 * @param {string} dateKey - 日付キー（YYYY-MM-DD形式）
 */
function openShiftRequestModal(dateKey) {
    const modal = document.getElementById('shiftRequestModal');
    const modalTitle = document.getElementById('modalTitle');
    const timeSlotContainer = document.getElementById('timeSlotContainer');

    // タイトルを設定
    const dateFormatted = new Date(dateKey).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short'
    });
    modalTitle.textContent = `${dateFormatted} のシフト申請`;

    // 時間枠を生成
    generateTimeSlots(timeSlotContainer);

    // 時間枠の残り枠数を更新
    updateTimeSlotCapacity(dateKey);

    // モーダルを表示
    modal.style.display = 'flex';
}

/**
 * 時間枠の残り容量を更新する関数（旧UI用）
 * @param {string} dateKey - 日付キー（YYYY-MM-DD形式）
 */
function updateTimeSlotCapacity(dateKey) {
    // 13:00から18:00まで、30分単位で時間枠を生成
    const startHour = 13;
    const endHour = 18;
    const slots = [];

    for (let hour = startHour; hour < endHour; hour++) {
        slots.push(`${hour}:00-${hour}:30`);
        slots.push(`${hour}:30-${hour + 1}:00`);
    }

    const currentShiftCounts = getCurrentShiftCounts();

    slots.forEach(slot => {
        const capacityElement = document.getElementById(`capacity-${slot.replace(/[:\s-]/g, '')}`);
        const checkboxElement = document.getElementById(`slot-${slot.replace(/[:\s-]/g, '')}`);

        if (capacityElement && checkboxElement) {
            // その日付・時間枠の現在の申請数を取得
            const currentCount = (currentShiftCounts[dateKey] && currentShiftCounts[dateKey][slot]) || 0;
            const maxCapacity = 1; // 30分枠は1人まで
            const remainingCount = Math.max(0, maxCapacity - currentCount);

            // 表示を更新
            capacityElement.textContent = `(${remainingCount}/${maxCapacity}人)`;

            // 満員の場合はチェックボックスを無効化
            if (remainingCount === 0) {
                checkboxElement.disabled = true;
                capacityElement.style.color = '#dc3545'; // 赤色
                checkboxElement.parentElement.style.opacity = '0.6';
            } else if (remainingCount === 1) {
                checkboxElement.disabled = false;
                capacityElement.style.color = '#ffc107'; // 黄色
                checkboxElement.parentElement.style.opacity = '1';
            } else {
                checkboxElement.disabled = false;
                capacityElement.style.color = '#28a745'; // 緑色
                checkboxElement.parentElement.style.opacity = '1';
            }
        }
    });
}

/**
 * 時間枠のチェックボックスを生成する関数（旧UI用）
 * @param {HTMLElement} container - コンテナ要素
 */
function generateTimeSlots(container) {
    container.innerHTML = '';

    // 13:00から18:00まで、30分単位で時間枠を生成
    const startHour = 13;
    const endHour = 18;
    const slots = [];

    for (let hour = startHour; hour < endHour; hour++) {
        slots.push(`${hour}:00-${hour}:30`);
        slots.push(`${hour}:30-${hour + 1}:00`);
    }

    // 時間枠のチェックボックスを生成
    slots.forEach(slot => {
        const slotDiv = document.createElement('div');
        slotDiv.className = 'time-slot';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `slot-${slot.replace(/[:\s-]/g, '')}`;
        checkbox.value = slot;
        checkbox.className = 'time-slot-checkbox';

        const labelContainer = document.createElement('div');
        labelContainer.className = 'time-slot-label-container';

        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = slot;
        label.className = 'time-slot-label';

        const capacityInfo = document.createElement('span');
        capacityInfo.className = 'time-slot-capacity';
        capacityInfo.id = `capacity-${slot.replace(/[:\s-]/g, '')}`;
        capacityInfo.textContent = '(0/1人)'; // デフォルト値

        labelContainer.appendChild(label);
        labelContainer.appendChild(capacityInfo);

        slotDiv.appendChild(checkbox);
        slotDiv.appendChild(labelContainer);
        container.appendChild(slotDiv);
    });
}

/**
 * シフト申請モーダルを閉じる関数（旧UI用）
 */
function closeShiftRequestModal() {
    const modal = document.getElementById('shiftRequestModal');
    modal.style.display = 'none';

    // 選択をクリア
    const checkboxes = document.querySelectorAll('.time-slot-checkbox');
    checkboxes.forEach(cb => cb.checked = false);

    // 備考欄をクリア
    document.getElementById('shiftRemarks').value = '';
}

/**
 * シフト申請を送信する関数（旧UI用）
 */
async function submitShiftRequest() {
    const selectedSlots = [];
    const checkboxes = document.querySelectorAll('.time-slot-checkbox:checked');

    checkboxes.forEach(cb => {
        selectedSlots.push(cb.value);
    });

    if (selectedSlots.length === 0) {
        alert('時間枠を選択してください。');
        return;
    }

    const remarks = document.getElementById('shiftRemarks').value.trim();
    const currentUser = getCurrentUser();
    const currentShiftRequestDate = getCurrentShiftRequestDate();

    // ボタンを無効化
    const submitBtn = document.querySelector('#shiftRequestModal .submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = '申請中...';

    try {
        // 複数時間枠の一括申請
        const response = await API.createMultipleShifts({
            user_id: currentUser.sub,
            user_name: currentUser.name,
            date: currentShiftRequestDate,
            time_slots: selectedSlots
        });

        if (!response.success) {
            throw new Error(response.error || 'シフト申請に失敗しました');
        }

        closeShiftRequestModal();

    } catch (error) {
        console.error('シフト申請の保存に失敗しました:', error);
        alert('シフト申請の保存に失敗しました。再度お試しください。');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '申請する';
    }
}

/**
 * 日付詳細モーダルを開く関数
 * @param {string} dateKey - 日付キー（YYYY-MM-DD形式）
 */
async function openDateDetailModal(dateKey) {
    const modal = document.getElementById('dateDetailModal');
    const title = document.getElementById('dateDetailTitle');
    const container = document.getElementById('dateDetailContainer');

    // 日付を表示用にフォーマット
    const dateObj = new Date(dateKey);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const weekday = weekdays[dateObj.getDay()];

    // 特別シフトがある日付かチェック（容量チェックより先に行う）
    const hasSpecialShifts = checkHasSpecialShifts(dateKey);

    // その日付の最大容量を取得
    let maxCapacityForDate = 0;
    if (typeof getDefaultCapacity === 'function') {
        const dayOfWeek = dateObj.getDay();
        maxCapacityForDate = getDefaultCapacity(dayOfWeek);
    }

    // グローバルな人数設定があれば上書き
    if (window.currentCapacityData) {
        const capacityItem = window.currentCapacityData.find(item => item.date === dateKey);
        if (capacityItem) {
            maxCapacityForDate = capacityItem.capacity;
        }
    }

    // 特別シフトがない場合のみ、人数枠0人チェックを行う
    if (!hasSpecialShifts && maxCapacityForDate === 0) {
        return;
    }

    // グローバル変数を設定
    setCurrentDetailDateKey(dateKey);
    setSelectedTimeSlots([]);

    title.textContent = `${year}年${month}月${day}日 (${weekday}) のシフト枠`;

    const currentUser = getCurrentUser();

    // コンテナをクリア
    container.innerHTML = '';

    // --- 特別シフトセクション ---
    if (hasSpecialShifts) {
        await openSpecialShiftApplicationModal(dateKey, currentUser, container, modal, title);
    }

    // --- 通常シフトセクション（capacity > 0 の場合） ---
    if (maxCapacityForDate > 0) {
        // 両方ある場合はセクション見出しを追加
        if (hasSpecialShifts) {
            const sectionHeading = document.createElement('div');
            sectionHeading.className = 'regular-shift-heading';
            sectionHeading.textContent = '通常シフト申請';
            sectionHeading.style.cssText = 'font-size: 13px; color: #666; margin: 16px 0 8px; font-weight: bold; border-top: 1px solid #eee; padding-top: 12px;';
            container.appendChild(sectionHeading);
        }

        // 自分の申請済みシフトをAPIから取得
        let myShiftsForDate = [];
        if (currentUser) {
            try {
                const result = await API.getShiftsByDate(dateKey);
                if (result.success && result.data) {
                    myShiftsForDate = result.data
                        .filter(shift => shift.user_id === currentUser.sub)
                        .map(shift => ({
                            shiftDate: shift.date,
                            timeSlot: shift.time_slot,
                            uuid: shift.uuid
                        }));
                }
            } catch (error) {
                console.error('シフト情報の取得エラー:', error);
            }
        }

        // 全選択/解除ボタンを追加
        const toggleAllDiv = document.createElement('div');
        toggleAllDiv.style.cssText = 'margin-bottom: 15px; text-align: center;';
        const toggleAllBtn = document.createElement('button');
        toggleAllBtn.className = 'toggle-all-btn';
        toggleAllBtn.textContent = 'すべて選択';
        toggleAllBtn.onclick = () => toggleAllTimeSlots();
        toggleAllDiv.appendChild(toggleAllBtn);
        container.appendChild(toggleAllDiv);

        const currentShiftCounts = getCurrentShiftCounts();

        // 通常シフトの時間枠（13:00-18:00）を表示
        for (let hour = 13; hour < 18; hour++) {
            [`${hour}:00-${hour}:30`, `${hour}:30-${hour + 1}:00`].forEach(slot => {
                const slotDiv = document.createElement('div');
                slotDiv.className = 'date-detail-slot';
                slotDiv.dataset.slot = slot;

                const timeDiv = document.createElement('div');
                timeDiv.className = 'date-detail-slot-time';
                timeDiv.textContent = slot;

                const capacityDiv = document.createElement('div');
                capacityDiv.className = 'date-detail-slot-capacity';

                const currentCount = (currentShiftCounts && currentShiftCounts[dateKey] && currentShiftCounts[dateKey][slot]) || 0;
                const remainingCount = Math.max(0, maxCapacityForDate - currentCount);
                const isAlreadyApplied = myShiftsForDate.some(shift => shift.timeSlot === slot);

                const capacityNumber = document.createElement('div');
                capacityNumber.className = 'date-detail-capacity-number';
                capacityNumber.textContent = remainingCount;

                if (isAlreadyApplied) {
                    capacityNumber.classList.add('capacity-applied');
                    slotDiv.classList.add('disabled');
                    const capacityLabel = document.createElement('div');
                    capacityLabel.className = 'date-detail-capacity-label';
                    capacityLabel.textContent = '申請済み';
                    capacityLabel.style.color = '#4CAF50';
                    capacityLabel.style.fontWeight = 'bold';
                    capacityDiv.appendChild(capacityNumber);
                    capacityDiv.appendChild(capacityLabel);
                } else {
                    if (remainingCount === 0) {
                        capacityNumber.classList.add('capacity-zero');
                        slotDiv.classList.add('disabled');
                    } else if (remainingCount === 1) {
                        capacityNumber.classList.add('capacity-low');
                        slotDiv.classList.add('selectable');
                    } else if (remainingCount <= maxCapacityForDate / 2) {
                        capacityNumber.classList.add('capacity-medium');
                        slotDiv.classList.add('selectable');
                    } else {
                        capacityNumber.classList.add('capacity-high');
                        slotDiv.classList.add('selectable');
                    }
                    const capacityLabel = document.createElement('div');
                    capacityLabel.className = 'date-detail-capacity-label';
                    capacityLabel.textContent = '残り枠';
                    capacityDiv.appendChild(capacityNumber);
                    capacityDiv.appendChild(capacityLabel);
                }

                slotDiv.appendChild(timeDiv);
                slotDiv.appendChild(capacityDiv);

                if (!isAlreadyApplied && remainingCount > 0) {
                    slotDiv.onclick = () => toggleTimeSlotSelection(slotDiv, slot);
                }

                container.appendChild(slotDiv);
            });
        }

        // submit ボタンを表示して状態を更新
        const submitBtn = modal.querySelector('.submit-btn');
        if (submitBtn) submitBtn.style.display = '';
        updateSubmitButton();
    } else {
        // 通常シフト枠がない場合は submit ボタンを非表示
        const submitBtn = modal.querySelector('.submit-btn');
        if (submitBtn) submitBtn.style.display = 'none';
    }

    modal.style.display = 'flex';
}

/**
 * 特別シフトが存在するかチェックする関数
 * @param {string} dateKey - 日付キー（YYYY-MM-DD形式）
 * @returns {boolean} 特別シフトが存在する場合true
 */
function checkHasSpecialShifts(dateKey) {
    const specialShifts = getSpecialShifts();
    if (!Array.isArray(specialShifts) || specialShifts.length === 0) {
        return false;
    }
    return specialShifts.some(shift => normalizeShiftDate(shift.date) === dateKey);
}

/**
 * 時間枠の選択状態をトグルする関数
 * @param {HTMLElement} slotDiv - 時間枠のDOM要素
 * @param {string} slot - 時間枠文字列
 */
function toggleTimeSlotSelection(slotDiv, slot) {
    if (slotDiv.classList.contains('disabled')) return;

    const isSelected = slotDiv.classList.contains('selected');
    const selectedTimeSlots = getSelectedTimeSlots();

    if (isSelected) {
        // 選択解除
        slotDiv.classList.remove('selected');
        setSelectedTimeSlots(selectedTimeSlots.filter(s => s !== slot));
    } else {
        // 選択
        slotDiv.classList.add('selected');
        selectedTimeSlots.push(slot);
        setSelectedTimeSlots(selectedTimeSlots);
    }

    updateSubmitButton();
}

/**
 * すべての時間枠を選択/解除する関数
 */
function toggleAllTimeSlots() {
    // 通常シフトスロットのみを対象にする（特別シフトスロットは除外）
    const selectableSlots = document.querySelectorAll('.date-detail-slot.selectable:not([data-slot-type="special"])');
    const toggleBtn = document.querySelector('.toggle-all-btn');

    if (!selectableSlots.length) return;

    // 現在の選択状態を確認（選択可能なスロットがすべて選択されているか）
    const allSelected = Array.from(selectableSlots).every(slot => slot.classList.contains('selected'));

    const selectedTimeSlots = [];

    if (allSelected) {
        // すべて解除
        selectableSlots.forEach(slotDiv => {
            if (slotDiv.classList.contains('selected')) {
                slotDiv.classList.remove('selected');
            }
        });
        toggleBtn.textContent = 'すべて選択';
        setSelectedTimeSlots([]);
    } else {
        // すべて選択
        selectableSlots.forEach(slotDiv => {
            if (!slotDiv.classList.contains('selected')) {
                slotDiv.classList.add('selected');
            }
            const slot = slotDiv.dataset.slot;
            selectedTimeSlots.push(slot);
        });
        toggleBtn.textContent = 'すべて解除';
        setSelectedTimeSlots(selectedTimeSlots);
    }

    updateSubmitButton();
}

/**
 * 申請ボタンの有効/無効を更新する関数
 */
function updateSubmitButton() {
    const submitBtn = document.querySelector('#dateDetailModal .submit-btn');
    const selectedTimeSlots = getSelectedTimeSlots();

    if (selectedTimeSlots.length > 0) {
        submitBtn.disabled = false;
        submitBtn.textContent = `選択した${selectedTimeSlots.length}つの時間枠で申請`;
    } else {
        submitBtn.disabled = true;
        submitBtn.textContent = '時間枠を選択してください';
    }

    // 全選択/解除ボタンのテキストも更新（通常シフトスロットの状態で判定）
    const toggleBtn = document.querySelector('.toggle-all-btn');
    if (toggleBtn) {
        const regularSelectableSlots = document.querySelectorAll('.date-detail-slot.selectable:not([data-slot-type="special"])');
        const allSelected = regularSelectableSlots.length > 0 &&
            Array.from(regularSelectableSlots).every(slot => slot.classList.contains('selected'));
        toggleBtn.textContent = allSelected ? 'すべて解除' : 'すべて選択';
    }
}

/**
 * 日付詳細モーダルを閉じる関数
 */
function closeDateDetailModal() {
    const modal = document.getElementById('dateDetailModal');
    modal.style.display = 'none';

    // 選択状態をリセット
    setCurrentDetailDateKey(null);
    setSelectedTimeSlots([]);

    // 通常シフト用のsubmitボタンを元に戻す
    const submitBtn = modal.querySelector('.submit-btn');
    if (submitBtn) {
        submitBtn.style.display = '';
    }
}

/**
 * 日付詳細モーダルでシフト申請を送信する関数
 */
async function submitDateDetailShiftRequest() {
    console.log('submitDateDetailShiftRequest called');

    const currentUser = getCurrentUser();
    if (!currentUser) {
        alert('ログインが必要です。');
        return;
    }

    const currentDetailDateKey = getCurrentDetailDateKey();
    const selectedTimeSlots = getSelectedTimeSlots();

    if (!currentDetailDateKey || selectedTimeSlots.length === 0) {
        alert('時間枠を選択してください。');
        return;
    }

    // ボタンを無効化してローディング表示
    const modal = document.getElementById('dateDetailModal');
    const submitBtn = modal.querySelector('.submit-btn');
    const cancelBtn = modal.querySelector('.cancel-btn');

    if (!submitBtn || !cancelBtn) {
        console.error('ボタンが見つかりません');
        return;
    }

    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    cancelBtn.disabled = true;
    submitBtn.innerHTML = '<span style="display: inline-block; margin-right: 5px;">⏳</span>申請中...';

    try {
        // 特別シフトスロットのマップを構築（timeSlot → specialShiftUuid）
        const specialSlotMap = new Map();
        for (const shift of getSpecialShiftsForDate(currentDetailDateKey)) {
            for (const slot of buildSpecialShiftSlots(shift.start_time, shift.end_time)) {
                specialSlotMap.set(slot, shift.uuid);
            }
        }

        const regularSlots = selectedTimeSlots.filter(s => !specialSlotMap.has(s));
        const specialSlots  = selectedTimeSlots.filter(s =>  specialSlotMap.has(s));

        // 通常スロット申請
        const successSlots = [];
        if (regularSlots.length > 0) {
            const results = await API.createMultipleShifts({
                user_id: currentUser.sub,
                user_name: currentUser.name,
                date: currentDetailDateKey,
                time_slots: regularSlots
            });
            if (!results.success) {
                throw new Error(results.error || 'シフト申請に失敗しました');
            }
            successSlots.push(...(results.processed || []));
        }

        // 特別スロット申請（スロットごとに個別送信）
        for (const slot of specialSlots) {
            const result = await API.applyForSpecialShift(specialSlotMap.get(slot), {
                user_id: currentUser.sub,
                user_name: currentUser.name,
                time_slot: slot
            });
            if (!result.success && result.error !== 'duplicate') {
                throw new Error(result.error || '特別シフト申請に失敗しました');
            }
            if (result.success) successSlots.push(slot);
        }

        // 申請した日付を保存（モーダルを閉じる前に）
        const appliedDateKey = currentDetailDateKey;

        // モーダルを閉じる
        closeDateDetailModal();

        // 申請成功した場合、スクロール情報を保存
        if (successSlots.length > 0) {
            setScrollToShiftAfterLoad({
                date: appliedDateKey,
                timeSlots: successSlots
            });

            // 自分のシフト一覧タブに切り替え
            switchToTab('my-shifts');
        } else {
            // 成功した時間枠がない場合は通常の処理
            const shiftCounts = await fetchShiftCountsFromSpreadsheet();
            setCurrentShiftCounts(shiftCounts);
            updateSingleDateCapacity(appliedDateKey, window.currentCapacityData || []);
        }

    } catch (error) {
        console.error('シフト申請の保存に失敗しました:', error);
        alert('シフト申請の保存に失敗しました。再度お試しください。');
    } finally {
        submitBtn.disabled = false;
        cancelBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

/**
 * 特定の日付のみの容量データを更新する関数
 * @param {string} dateKey - 日付キー（YYYY-MM-DD形式）
 * @param {Array} capacityData - 人数設定データ
 */
function updateSingleDateCapacity(dateKey, capacityData) {
    // 人数設定データを日付をキーとするマップに変換
    const capacityMap = {};
    capacityData.forEach(item => {
        if (item.date && item.date !== '') {
            capacityMap[item.date] = item.capacity;
        }
    });

    // 容量表示を更新（シフト申請画面用）
    const capacityElement = document.getElementById(`capacity-${dateKey}`);
    if (capacityElement) {
        // その日付の最大容量を取得
        let maxCapacityForDate = capacityMap[dateKey];
        if (maxCapacityForDate === undefined) {
            const date = new Date(dateKey);
            const dayOfWeek = date.getDay();
            maxCapacityForDate = getDefaultCapacity(dayOfWeek);
        }

        // その日に設定されているシフト人数のみを表示（0人の場合は表示しない）
        if (maxCapacityForDate > 0) {
            capacityElement.innerHTML = `<span class="capacity-number">${maxCapacityForDate}</span><span class="capacity-unit">人</span>`;
        } else {
            capacityElement.innerHTML = '';
        }

        // 申請ボタンの表示/非表示を更新
        const requestInfo = document.getElementById(`request-${dateKey}`);
        if (requestInfo) {
            const existingButton = requestInfo.querySelector('.inline-apply-btn');
            if (maxCapacityForDate > 0 && !existingButton) {
                // ボタンがなくて容量がある場合は追加
                const applyButton = document.createElement('button');
                applyButton.className = 'inline-apply-btn';
                applyButton.textContent = '申請';
                applyButton.onclick = (e) => {
                    e.stopPropagation();
                    openDateDetailModal(dateKey);
                };
                requestInfo.appendChild(applyButton);
            } else if (maxCapacityForDate === 0 && existingButton) {
                // ボタンがあって容量がない場合は削除
                existingButton.remove();
            }
        }
    }
}

// switchToTab 関数は ui.js で定義されているため、ここでは定義しない

/**
 * 時刻文字列（HH:MM）を分数に変換する
 * @param {string} time - HH:MM形式の時刻
 * @returns {number} 分数（不正な入力の場合はNaN）
 */
function timeToMinutes(time) {
    const [h, m] = time.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return NaN;
    return h * 60 + m;
}

/**
 * 分数をHH:MM形式の時刻文字列に変換する
 * @param {number} mins - 分数
 * @returns {string} HH:MM形式の時刻
 */
function minutesToTime(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * 特別シフトの時間帯を30分スロットに分割する純粋関数
 * @param {string} startTime - 開始時刻（HH:MM形式）
 * @param {string} endTime - 終了時刻（HH:MM形式）
 * @returns {string[]} 30分スロットの配列（例: ['10:00-10:30', '10:30-11:00']）
 */
function buildSpecialShiftSlots(startTime, endTime) {
    if (!startTime || !endTime) return [];

    const startMins = timeToMinutes(startTime);
    const endMins = timeToMinutes(endTime);

    if (isNaN(startMins) || isNaN(endMins) || startMins >= endMins) return [];

    const slots = [];
    for (let cur = startMins; cur < endMins; cur += 30) {
        slots.push(`${minutesToTime(cur)}-${minutesToTime(cur + 30)}`);
    }
    return slots;
}

/**
 * シフトの日付をYYYY-MM-DD形式に正規化する
 * @param {string|Date} date - 日付（ISO文字列、YYYY-MM-DD、またはDateオブジェクト）
 * @returns {string} YYYY-MM-DD形式の日付文字列
 */
function normalizeShiftDate(date) {
    if (date instanceof Date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    if (typeof date === 'string' && date.includes('T')) {
        return date.split('T')[0];
    }
    return String(date);
}

/**
 * 指定日付の特別シフトを取得する
 * @param {string} dateKey - 日付キー（YYYY-MM-DD形式）
 * @returns {Array} 該当日の特別シフト配列
 */
function getSpecialShiftsForDate(dateKey) {
    return getSpecialShifts().filter(shift => normalizeShiftDate(shift.date) === dateKey);
}

/**
 * 特別シフト申請モーダルを表示する関数（30分スロット単位）
 * @param {string} dateKey - 日付キー（YYYY-MM-DD形式）
 * @param {Object} currentUser - 現在のユーザーオブジェクト
 * @param {HTMLElement} container - コンテナ要素
 * @param {HTMLElement} modal - モーダル要素
 * @param {HTMLElement} title - タイトル要素
 */
async function openSpecialShiftApplicationModal(dateKey, currentUser, container, modal, title) {
    const specialShifts = getSpecialShiftsForDate(dateKey);

    // 各特別シフトへの申請済みスロットを並行取得
    const applicationsResults = await Promise.all(
        specialShifts.map(shift => API.getSpecialShiftApplications(shift.uuid))
    );

    const heading = document.createElement('div');
    heading.className = 'special-shift-heading';
    heading.textContent = '特別シフト申請';
    heading.style.cssText = 'font-size: 13px; color: #666; margin: 0 0 8px; font-weight: bold;';
    container.appendChild(heading);

    specialShifts.forEach((shift, index) => {
        const result = applicationsResults[index];
        const applications = (result && result.success) ? result.data : [];

        const slots = buildSpecialShiftSlots(shift.start_time, shift.end_time);
        slots.forEach(slot => {
            const isApplied = currentUser &&
                applications.some(app => app.user_id === currentUser.sub && app.time_slot === slot);

            const slotDiv = document.createElement('div');
            slotDiv.className = 'date-detail-slot';
            slotDiv.dataset.slot = slot;
            slotDiv.dataset.slotType = 'special';
            slotDiv.dataset.specialShiftUuid = shift.uuid;
            slotDiv.textContent = slot;

            if (isApplied) {
                slotDiv.classList.add('disabled');
            } else {
                slotDiv.classList.add('selectable');
                slotDiv.onclick = () => toggleTimeSlotSelection(slotDiv, slot);
            }

            container.appendChild(slotDiv);
        });
    });
}
