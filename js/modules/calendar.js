// calendar.js - カレンダー表示・操作モジュール

/**
 * カレンダー全体を生成する関数
 * @param {string} containerId - カレンダーを表示するコンテナのID
 * @param {boolean} isCapacityMode - 人数設定モードかどうか
 * @param {boolean} isRequestMode - シフト申請モードかどうか
 */
function generateCalendar(containerId, isCapacityMode = false, isRequestMode = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    const today = new Date();
    const currentYear = today.getFullYear();
    const nextYear = currentYear + 1;

    // 現在の月から来年度末（3月31日）まで
    let startDate = new Date(currentYear, today.getMonth(), 1);
    let endDate = new Date(nextYear, 3, 0); // 3月31日

    // もし現在が4月以降なら、今年度末まで
    if (today.getMonth() >= 3) {
        endDate = new Date(currentYear + 1, 3, 0);
    }

    // シフト申請モードの場合は申請可能期間に制限
    if (isRequestMode) {
        const currentDay = today.getDate();
        if (currentDay >= 15) {
            // 15日以降なら次の月まで表示
            endDate = new Date(currentYear, today.getMonth() + 2, 0); // 次月末日
        } else {
            // 15日未満なら今月まで表示
            endDate = new Date(currentYear, today.getMonth() + 1, 0); // 今月末日
        }
    }

    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        const monthDiv = createMonthCalendar(currentDate.getFullYear(), currentDate.getMonth(), isCapacityMode, isRequestMode);
        container.appendChild(monthDiv);
        currentDate.setMonth(currentDate.getMonth() + 1);
    }
}

/**
 * 月単位のカレンダーを生成する関数
 * @param {number} year - 年
 * @param {number} month - 月（0-11）
 * @param {boolean} isCapacityMode - 人数設定モードかどうか
 * @param {boolean} isRequestMode - シフト申請モードかどうか
 * @returns {HTMLElement} 月カレンダーのDOM要素
 */
function createMonthCalendar(year, month, isCapacityMode = false, isRequestMode = false) {
    const monthDiv = document.createElement('div');
    monthDiv.className = 'calendar-month';

    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

    const title = document.createElement('h4');
    title.textContent = `${year}年 ${monthNames[month]}`;
    monthDiv.appendChild(title);

    const table = document.createElement('table');
    table.className = 'calendar-table';

    // ヘッダー行
    const headerRow = document.createElement('tr');
    dayNames.forEach((day, index) => {
        const th = document.createElement('th');
        th.textContent = day;
        if (index === 0) th.className = 'sunday';
        if (index === 6) th.className = 'saturday';
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    // 日付を生成
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();

    let date = 1;
    const today = new Date();

    for (let week = 0; week < 6; week++) {
        const row = document.createElement('tr');

        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
            const cell = document.createElement('td');

            if (week === 0 && dayOfWeek < startDayOfWeek) {
                // 前月の日付
                const prevMonthLastDay = new Date(year, month, 0).getDate();
                const prevDate = prevMonthLastDay - startDayOfWeek + dayOfWeek + 1;
                cell.className = 'other-month';
                cell.innerHTML = `<div class="calendar-day-number">${prevDate}</div>`;
            } else if (date > lastDay.getDate()) {
                // 翌月の日付
                const nextDate = date - lastDay.getDate();
                cell.className = 'other-month';
                cell.innerHTML = `<div class="calendar-day-number">${nextDate}</div>`;
                date++;
            } else {
                // 当月の日付
                const currentDate = new Date(year, month, date);
                const dayNumber = document.createElement('div');
                dayNumber.className = 'calendar-day-number';
                dayNumber.textContent = date;

                if (dayOfWeek === 0) dayNumber.className += ' sunday';
                if (dayOfWeek === 6) dayNumber.className += ' saturday';

                cell.appendChild(dayNumber);

                // 今日の日付をハイライト
                if (currentDate.toDateString() === today.toDateString()) {
                    cell.className = 'today';
                }

                if (isCapacityMode) {
                    // 人数設定モードの場合は表示モードを追加
                    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;

                    // 表示モード
                    const capacityDisplay = document.createElement('div');
                    capacityDisplay.className = 'capacity-display';
                    capacityDisplay.id = `display-${dateKey}`;

                    const capacityValue = document.createElement('span');
                    capacityValue.className = 'capacity-value';
                    capacityValue.textContent = `${getDefaultCapacity(dayOfWeek)}人`;
                    capacityValue.id = `value-${dateKey}`;
                    capacityDisplay.appendChild(capacityValue);

                    // メモ表示エリアを追加
                    const memoDisplay = document.createElement('div');
                    memoDisplay.className = 'memo-display';
                    memoDisplay.id = `memo-display-${dateKey}`;
                    capacityDisplay.appendChild(memoDisplay);

                    const editIcon = document.createElement('span');
                    editIcon.className = 'edit-icon';
                    editIcon.innerHTML = '✏️';
                    editIcon.title = '編集';
                    editIcon.onclick = () => toggleEditMode(dateKey);
                    capacityDisplay.appendChild(editIcon);

                    // シフト追加リンクを独立した要素として追加（capacityDisplayの外）
                    const addShiftLink = document.createElement('div');
                    addShiftLink.className = 'add-shift-link';
                    addShiftLink.innerHTML = '特別シフト +';
                    addShiftLink.title = '特別シフト追加';
                    addShiftLink.style.fontSize = '11px';
                    addShiftLink.style.cursor = 'pointer';
                    addShiftLink.style.color = '#007cba';
                    addShiftLink.style.marginTop = '2px';
                    addShiftLink.onclick = (e) => {
                        e.stopPropagation();
                        openSpecialShiftModal(dateKey);
                    };

                    cell.appendChild(capacityDisplay);

                    // 編集モード（初期は非表示）
                    const editMode = document.createElement('div');
                    editMode.className = 'capacity-edit-mode';
                    editMode.id = `edit-${dateKey}`;
                    editMode.style.display = 'none';

                    const inputRow = document.createElement('div');
                    inputRow.className = 'capacity-input-row';

                    const input = document.createElement('input');
                    input.type = 'number';
                    input.min = '0';
                    input.max = '20';
                    input.className = 'capacity-input';
                    input.value = getDefaultCapacity(dayOfWeek);
                    input.id = `input-${dateKey}`;
                    input.setAttribute('data-date', dateKey);
                    inputRow.appendChild(input);

                    const unitLabel = document.createElement('span');
                    unitLabel.className = 'capacity-label';
                    unitLabel.textContent = '人';
                    inputRow.appendChild(unitLabel);

                    editMode.appendChild(inputRow);

                    // メモ入力フィールドを追加
                    const memoRow = document.createElement('div');
                    memoRow.className = 'capacity-memo-row';

                    const memoInput = document.createElement('textarea');
                    memoInput.placeholder = 'メモ';
                    memoInput.className = 'memo-input';
                    memoInput.id = `memo-${dateKey}`;
                    memoInput.setAttribute('data-date', dateKey);
                    memoInput.rows = 2;
                    memoRow.appendChild(memoInput);

                    editMode.appendChild(memoRow);

                    const controls = document.createElement('div');
                    controls.className = 'capacity-edit-controls';

                    const saveBtn = document.createElement('button');
                    saveBtn.className = 'save-single-btn';
                    saveBtn.innerHTML = '✅';
                    saveBtn.title = '保存';
                    saveBtn.onclick = () => saveSingleCapacity(dateKey);
                    controls.appendChild(saveBtn);

                    const cancelBtn = document.createElement('button');
                    cancelBtn.className = 'cancel-edit-btn';
                    cancelBtn.innerHTML = '❌';
                    cancelBtn.title = 'キャンセル';
                    cancelBtn.onclick = () => cancelEdit(dateKey);
                    controls.appendChild(cancelBtn);

                    editMode.appendChild(controls);
                    cell.appendChild(editMode);

                    // 特別シフト追加ボタンをここに配置
                    cell.appendChild(addShiftLink);

                    // 特別シフト表示エリア
                    const specialShiftDisplay = document.createElement('div');
                    specialShiftDisplay.className = 'special-shift-display';
                    specialShiftDisplay.id = `special-shifts-${dateKey}`;
                    cell.appendChild(specialShiftDisplay);

                    // 特別シフトを表示
                    displaySpecialShiftsForDate(dateKey, specialShiftDisplay);
                } else if (isRequestMode) {
                    // シフト申請モードの場合は人数表示と申請ボタン
                    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
                    const cellDate = new Date(year, month, date);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    // 申請可能日かチェック
                    const isValidRequestDate = isDateAvailableForRequest(cellDate, today);

                    // 募集人数をチェック
                    const defaultCapacity = getDefaultCapacity(dayOfWeek);

                    // 土日でも必要なHTML要素は作成する（後で人数設定データで更新される可能性があるため）
                    // 基本的な表示要素を作成
                    const requestInfo = document.createElement('div');
                    requestInfo.className = 'shift-request-info';
                    requestInfo.id = `request-${dateKey}`;

                    // 必要人数表示
                    const capacityInfo = document.createElement('div');
                    capacityInfo.className = 'shift-capacity-info';
                    capacityInfo.id = `capacity-${dateKey}`;

                    // デフォルトで0人の場合は初期状態では何も表示しない
                    if (defaultCapacity > 0) {
                        capacityInfo.innerHTML = `<span class="capacity-number">${defaultCapacity}</span><span class="capacity-unit">人</span>`;
                    }
                    requestInfo.appendChild(capacityInfo);

                    // メモ表示エリアを追加
                    const memoDisplay = document.createElement('div');
                    memoDisplay.className = 'request-memo-display';
                    memoDisplay.id = `request-memo-${dateKey}`;
                    memoDisplay.textContent = ''; // 初期は空
                    requestInfo.appendChild(memoDisplay);

                    // 特別シフトがある日付かチェック
                    const hasSpecialShifts = checkHasSpecialShifts(dateKey);

                    // 特別シフト募集表示エリア
                    const specialShiftNotice = document.createElement('div');
                    specialShiftNotice.className = 'special-shift-notice';
                    specialShiftNotice.id = `special-notice-${dateKey}`;
                    if (hasSpecialShifts) {
                        const specialShiftsForDate = getSpecialShiftsForDate(dateKey);
                        specialShiftNotice.innerHTML = specialShiftsForDate
                            .map(s => `「${escapeHtml(s.name || '名称未設定')}」の特別シフトを募集中`)
                            .join('<br>');
                    }
                    requestInfo.appendChild(specialShiftNotice);

                    if (!isValidRequestDate || cellDate < today) {
                        // 申請不可能な日は無効化
                        cell.classList.add('past-date');
                        cell.title = cellDate < today ? '過去の日付です' : '申請可能期間外です';
                        // 申請ボタンは表示しない
                    } else if (hasSpecialShifts || defaultCapacity > 0) {
                        // 特別シフトまたは通常シフトがある場合は申請ボタンを表示
                        const applyButton = document.createElement('button');
                        applyButton.className = 'inline-apply-btn';
                        applyButton.textContent = '申請';
                        applyButton.onclick = (e) => {
                            e.stopPropagation();
                            openDateDetailModal(dateKey);
                        };
                        requestInfo.appendChild(applyButton);
                    }

                    // requestInfoを追加
                    cell.appendChild(requestInfo);
                    cell.setAttribute('data-date', dateKey);

                    // シフト情報表示エリア（他の人のシフトを表示）
                    const shiftInfo = document.createElement('div');
                    shiftInfo.className = 'request-shift-info';
                    shiftInfo.id = `request-shifts-${dateKey}`;
                    cell.appendChild(shiftInfo);
                } else {
                    // シフト一覧モードの場合は全員のシフト情報を表示
                    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
                    const shiftInfo = document.createElement('div');
                    shiftInfo.className = 'calendar-shift-info';
                    shiftInfo.id = `shift-${dateKey}`;

                    // メモ表示エリアを追加
                    const memoDisplay = document.createElement('div');
                    memoDisplay.className = 'admin-memo-display';
                    memoDisplay.id = `admin-memo-${dateKey}`;
                    memoDisplay.textContent = ''; // 初期は空
                    shiftInfo.appendChild(memoDisplay);

                    // 全員のシフトデータから該当日付のデータを取得
                    displayShiftsForDate(shiftInfo, dateKey);

                    cell.appendChild(shiftInfo);

                    // クリックイベント
                    cell.setAttribute('data-date', dateKey);
                    // cell.addEventListener('click', handleCalendarCellClick);
                }

                date++;
            }

            row.appendChild(cell);
        }

        table.appendChild(row);

        if (date > lastDay.getDate()) break;
    }

    monthDiv.appendChild(table);
    return monthDiv;
}

/**
 * カレンダーのセルがクリックされたときの処理
 * @param {Event} event - クリックイベント
 */
function handleCalendarCellClick(event) {
    if (event.target.closest('.shift-person')) return;

    const cell = event.currentTarget;
    const date = cell.getAttribute('data-date');
    if (!date) return;

    openShiftDetailModal(date);
}

/**
 * シフト詳細モーダルを開く関数
 * @param {string} dateKey - 日付キー（YYYY-MM-DD形式）
 */
function openShiftDetailModal(dateKey) {
    if (!window.allShiftsData) {
        alert('シフトデータが読み込まれていません。');
        return;
    }

    // 該当日付のシフトをフィルタリング
    const shiftsForDate = window.allShiftsData.filter(shift => shift.shiftDate === dateKey);

    // 日付を整形して表示
    const dateObj = new Date(dateKey);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const weekday = weekdays[dateObj.getDay()];

    const title = document.getElementById('shiftDetailTitle');
    title.textContent = `${year}年${month}月${day}日 (${weekday}) のシフト詳細`;

    const content = document.getElementById('shiftDetailContent');

    if (shiftsForDate.length === 0) {
        content.innerHTML = `
            <div class="no-shifts-message">
                <p>この日にはシフトの申請がありません。</p>
            </div>
        `;
    } else {
        // 個人ごとに連続する時間帯をマージ
        const mergedShifts = mergeShiftsByPerson(shiftsForDate);

        // 時間帯ごとにグループ化
        const timeSlotGroups = {};
        mergedShifts.forEach(shift => {
            const timeSlot = shift.timeSlot;
            if (!timeSlotGroups[timeSlot]) {
                timeSlotGroups[timeSlot] = [];
            }
            timeSlotGroups[timeSlot].push(shift);
        });

        // 時間帯順にソート
        const sortedTimeSlots = Object.keys(timeSlotGroups).sort();

        let html = '<div class="shift-detail-list">';

        sortedTimeSlots.forEach(timeSlot => {
            html += `
                <div class="shift-detail-time-slot">
                    <div class="shift-detail-time-header">
                        <h4 class="shift-detail-time">${timeSlot}</h4>
                        <span class="shift-detail-count">${timeSlotGroups[timeSlot].length}名</span>
                    </div>
                    <div class="shift-detail-people">
            `;

            timeSlotGroups[timeSlot].forEach(shift => {
                html += `
                    <div class="shift-detail-person">
                        <div class="shift-person-info">
                            <div class="shift-person-name">${getShiftDisplayName(shift)}</div>
                        </div>
                        ${(isAdmin() || shift.userId === currentUser.sub) ? `
                            <button class="shift-delete-btn" onclick="deleteShiftFromModal(this, [${(shift.uuids || []).map(uuid => `'${uuid}'`).join(',')}])">
                                削除
                            </button>
                        ` : ''}
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        html += '</div>';
        content.innerHTML = html;
    }

    // モーダルを表示
    document.getElementById('shiftDetailModal').style.display = 'flex';
}

/**
 * シフト詳細モーダルを閉じる関数
 */
function closeShiftDetailModal() {
    document.getElementById('shiftDetailModal').style.display = 'none';
}

/**
 * シフト申請可能日の判定関数
 * @param {Date} targetDate - 対象日付
 * @param {Date} currentDate - 現在日付
 * @returns {boolean} 申請可能かどうか
 */
function isDateAvailableForRequest(targetDate, currentDate) {
    const target = new Date(targetDate);
    const current = new Date(currentDate);

    // 本日以前は申請不可
    if (target < current) {
        return false;
    }

    const currentYear = current.getFullYear();
    const currentMonth = current.getMonth(); // 0-11
    const currentDay = current.getDate();

    const targetYear = target.getFullYear();
    const targetMonth = target.getMonth(); // 0-11

    // 月の差を計算
    const monthsDiff = (targetYear - currentYear) * 12 + (targetMonth - currentMonth);

    if (monthsDiff === 0) {
        // 同じ月：今日以降は申請可能
        return true;
    } else if (monthsDiff === 1) {
        // 次の月：15日以降なら申請可能
        // 例：7/15以降なら8月分申請可能
        return currentDay >= 15;
    } else {
        // 2ヶ月以上先は申請不可
        return false;
    }
}

/**
 * 曜日から初期人数を取得する関数
 * @param {number} dayOfWeek - 曜日（0:日曜日 - 6:土曜日）
 * @returns {number} 初期人数
 */
function getDefaultCapacity(dayOfWeek) {
    // 日曜日=0, 月曜日=1, 火曜日=2, 水曜日=3, 木曜日=4, 金曜日=5, 土曜日=6
    switch (dayOfWeek) {
        case 0: // 日曜日
        case 6: // 土曜日
            return 0;
        case 3: // 水曜日
            return 2;
        default: // 月火木金
            return 3;
    }
}

/**
 * 個人ごとに連続する時間帯をマージする関数
 * @param {Array} shiftsForDate - 該当日付のシフト配列
 * @returns {Array} マージされたシフト配列
 */
function mergeShiftsByPerson(shiftsForDate) {
    // 個人ごとにグループ化（時間帯とUUIDのマッピングを保持）
    const shiftsByPerson = {};
    shiftsForDate.forEach(shift => {
        const personKey = `${getShiftDisplayName(shift)}_${shift.userEmail || shift.email}_${shift.isSpecial ? 'special' : 'regular'}`;
        if (!shiftsByPerson[personKey]) {
            shiftsByPerson[personKey] = {
                person: shift,
                shiftsData: [] // 元のシフトデータを保持
            };
        }
        shiftsByPerson[personKey].shiftsData.push({
            timeSlot: shift.timeSlot || shift.time,
            uuid: shift.uuid
        });
    });

    // 各個人の時間帯をマージ
    const mergedShifts = [];
    Object.keys(shiftsByPerson).forEach(personKey => {
        const personData = shiftsByPerson[personKey];

        // 時間帯だけを抽出してマージ
        const timeSlots = personData.shiftsData.map(s => s.timeSlot);
        const mergedTimeSlots = mergeConsecutiveTimeSlots(timeSlots);

        mergedTimeSlots.forEach(mergedTimeSlot => {
            // このマージされた時間帯に対応するUUIDだけを抽出
            const correspondingUuids = personData.shiftsData
                .filter(s => {
                    // マージされた時間帯に含まれる元の時間帯かチェック
                    // 例: 13:00-14:00には13:00-13:30と13:30-14:00が含まれる
                    const [mergedStart, mergedEnd] = mergedTimeSlot.split('-');
                    const [slotStart, slotEnd] = s.timeSlot.split('-');
                    return slotStart >= mergedStart && slotEnd <= mergedEnd;
                })
                .map(s => s.uuid);

            mergedShifts.push({
                ...personData.person,
                timeSlot: mergedTimeSlot,
                uuids: correspondingUuids // このマージ時間帯に対応するUUIDのみ
            });
        });
    });

    return mergedShifts;
}

/**
 * 指定された日付のシフト情報を表示する関数
 * @param {HTMLElement} container - 表示先のコンテナ要素
 * @param {string} dateKey - 日付キー（YYYY-MM-DD形式）
 */
function displayShiftsForDate(container, dateKey) {
    if (!window.allShiftsData) {
        return;
    }

    // 該当日付のシフトをフィルタリング
    const shiftsForDate = window.allShiftsData.filter(shift => shift.shiftDate === dateKey);

    if (shiftsForDate.length === 0) {
        return; // シフトがない場合は何も表示しない
    }

    // 個人ごとに連続する時間帯をマージ
    const mergedShifts = mergeShiftsByPerson(shiftsForDate);

    // 時間帯ごとにグループ化
    const timeSlotGroups = {};
    mergedShifts.forEach(shift => {
        const timeSlot = shift.timeSlot;
        if (!timeSlotGroups[timeSlot]) {
            timeSlotGroups[timeSlot] = [];
        }
        timeSlotGroups[timeSlot].push(shift);
    });

    // 時間帯順にソート
    const sortedTimeSlots = Object.keys(timeSlotGroups).sort();

    sortedTimeSlots.forEach(timeSlot => {
        const timeSlotDiv = document.createElement('div');
        timeSlotDiv.className = 'shift-time-slot';

        const timeLabel = document.createElement('div');
        timeLabel.className = 'shift-time-label';
        timeLabel.textContent = timeSlot;
        timeSlotDiv.appendChild(timeLabel);

        const peopleDiv = document.createElement('div');
        peopleDiv.className = 'shift-people';

        // 特別シフト名をグループヘッダーとして一度だけ表示
        const specialNames = [...new Set(
            timeSlotGroups[timeSlot]
                .filter(s => s.isSpecial && s.shiftName)
                .map(s => s.shiftName)
        )];
        specialNames.forEach(name => {
            const nameLabel = document.createElement('div');
            nameLabel.className = 'shift-name-label';
            nameLabel.textContent = name;
            peopleDiv.appendChild(nameLabel);
        });

        timeSlotGroups[timeSlot].forEach(shift => {
            const personDiv = document.createElement('div');
            personDiv.className = 'shift-person' + (shift.isSpecial ? ' shift-person--special' : '');
            const displayName = getShiftDisplayName(shift);
            personDiv.title = displayName;

            if (isAdmin()) {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'calendar-shift-checkbox';
                checkbox.setAttribute('data-uuids', (shift.uuids || []).join(','));
                checkbox.addEventListener('click', (e) => e.stopPropagation());
                checkbox.addEventListener('change', () => {
                    personDiv.classList.toggle('is-selected', checkbox.checked);
                    updateCalendarActionBar();
                });
                personDiv.appendChild(checkbox);
            }

            if (shift.isSpecial) {
                const badge = document.createElement('span');
                badge.className = 'special-badge';
                badge.textContent = '特別';
                personDiv.appendChild(badge);
            }

            const nameSpan = document.createElement('span');
            nameSpan.textContent = displayName;
            if (isAdmin()) {
                nameSpan.style.cursor = 'pointer';
                nameSpan.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const cb = personDiv.querySelector('.calendar-shift-checkbox');
                    if (cb) {
                        cb.checked = !cb.checked;
                        personDiv.classList.toggle('is-selected', cb.checked);
                        updateCalendarActionBar();
                    }
                });
            }
            personDiv.appendChild(nameSpan);

            peopleDiv.appendChild(personDiv);
        });

        timeSlotDiv.appendChild(peopleDiv);
        container.appendChild(timeSlotDiv);
    });
}

/**
 * カレンダー一括削除アクションバーの表示を更新する
 */
function updateCalendarActionBar() {
    const checked = document.querySelectorAll('.calendar-shift-checkbox:checked');
    updateBulkActionBarCount('calendarSelectedCount', checked.length);
}

/**
 * カレンダー一括削除ボタンのセットアップ（一度だけ呼ぶ）
 */
function setupCalendarBulkDelete() {
    const bulkDeleteBtn = document.getElementById('calendarBulkDeleteBtn');
    if (!bulkDeleteBtn || bulkDeleteBtn.dataset.setupDone) return;
    bulkDeleteBtn.dataset.setupDone = 'true';

    bulkDeleteBtn.addEventListener('click', async () => {
        const checkedBoxes = document.querySelectorAll('.calendar-shift-checkbox:checked');
        if (checkedBoxes.length === 0) return;

        const allUuids = [];
        checkedBoxes.forEach(cb => {
            const uuidsStr = cb.getAttribute('data-uuids');
            if (uuidsStr) uuidsStr.split(',').forEach(uuid => { if (uuid) allUuids.push(uuid); });
        });

        if (!confirm(`選択した ${checkedBoxes.length} 件のシフトを削除しますか？\n\nこの操作は取り消せません。`)) return;

        bulkDeleteBtn.disabled = true;
        bulkDeleteBtn.textContent = '削除中...';

        try {
            const result = await API.deleteMultipleShifts(allUuids);
            if (result.success) {
                alert(`${checkedBoxes.length}件のシフトを削除しました。`);
                bulkDeleteBtn.textContent = '選択したシフトを削除';
                await displayShiftList();
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
