// specialShifts.js - 特別シフト機能モジュール

/**
 * 特別シフトモーダルを開く
 * @param {string} dateKey - 日付キー (YYYY-MM-DD形式)
 */
function openSpecialShiftModal(dateKey) {
    const modal = document.getElementById('specialShiftModal');
    const dateDisplay = document.getElementById('specialShiftDate');
    const errorDiv = document.getElementById('specialShiftError');

    // 日付をテキストで表示
    const formattedDate = formatDateForDisplay(dateKey);
    dateDisplay.textContent = formattedDate;
    dateDisplay.setAttribute('data-date', dateKey);

    // エラーメッセージを初期化
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';

    // 名前フィールドを初期化
    const nameInput = document.getElementById('specialShiftName');
    if (nameInput) nameInput.value = '';

    // 時刻のselect要素を初期化
    initializeTimeSelects();

    // 送信ボタンを有効化
    const submitBtn = document.querySelector('#specialShiftModal .submit-btn');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '追加';
    }

    modal.style.display = 'flex';
}

/**
 * 時刻のselect要素を初期化する関数
 */
function initializeTimeSelects() {
    const startTimeSelect = document.getElementById('specialShiftStartTime');
    const endTimeSelect = document.getElementById('specialShiftEndTime');

    // 時間帯を生成（7:00から23:30まで）
    const timeOptions = generateTimeOptions();

    // 開始時刻のオプションを設定
    startTimeSelect.innerHTML = '<option value="">選択してください</option>';
    timeOptions.forEach(time => {
        const option = document.createElement('option');
        option.value = time;
        option.textContent = time;
        startTimeSelect.appendChild(option);
    });

    // 終了時刻のオプションを初期化
    endTimeSelect.innerHTML = '<option value="">選択してください</option>';
    endTimeSelect.disabled = true;

    // 開始時刻が変更された時の処理
    startTimeSelect.addEventListener('change', function() {
        updateEndTimeOptions(this.value);
    });
}

/**
 * 時刻オプションを生成する関数（00分と30分のみ）
 * @returns {string[]} 時刻オプションの配列
 */
function generateTimeOptions() {
    const times = [];
    for (let hour = 7; hour <= 23; hour++) {
        times.push(`${String(hour).padStart(2, '0')}:00`);
        if (hour < 23) { // 23:30まで
            times.push(`${String(hour).padStart(2, '0')}:30`);
        }
    }
    return times;
}

/**
 * 終了時刻のオプションを更新する関数
 * @param {string} startTime - 開始時刻
 */
function updateEndTimeOptions(startTime) {
    const endTimeSelect = document.getElementById('specialShiftEndTime');

    if (!startTime) {
        endTimeSelect.innerHTML = '<option value="">選択してください</option>';
        endTimeSelect.disabled = true;
        return;
    }

    // 開始時刻より後の時刻のみを選択肢に追加
    const timeOptions = generateTimeOptions();
    const startIndex = timeOptions.indexOf(startTime);
    const validEndTimes = timeOptions.slice(startIndex + 1);

    endTimeSelect.innerHTML = '<option value="">選択してください</option>';
    validEndTimes.forEach(time => {
        const option = document.createElement('option');
        option.value = time;
        option.textContent = time;
        endTimeSelect.appendChild(option);
    });

    endTimeSelect.disabled = false;
}

/**
 * 特別シフトモーダルを閉じる
 */
function closeSpecialShiftModal() {
    const modal = document.getElementById('specialShiftModal');
    modal.style.display = 'none';
}

/**
 * 特別シフトを送信
 */
async function submitSpecialShift() {
    const errorDiv = document.getElementById('specialShiftError');
    const submitBtn = document.querySelector('#specialShiftModal .submit-btn');
    const cancelBtn = document.querySelector('#specialShiftModal .cancel-btn');

    // フォームデータを取得
    const dateDisplay = document.getElementById('specialShiftDate');
    const date = dateDisplay.getAttribute('data-date');
    const name = document.getElementById('specialShiftName').value.trim();
    const startTime = document.getElementById('specialShiftStartTime').value;
    const endTime = document.getElementById('specialShiftEndTime').value;

    // バリデーション
    if (!date || !name || !startTime || !endTime) {
        showSpecialShiftError('すべての項目を入力してください。');
        return;
    }

    // ボタンを無効化
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '送信中...';
    }
    if (cancelBtn) {
        cancelBtn.disabled = true;
    }

    try {
        const userData = getCurrentUserData();
        if (!userData) {
            showSpecialShiftError('ユーザー情報が取得できません。ログインし直してください。');
            // エラー時はボタンを復活
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = '追加';
            }
            if (cancelBtn) {
                cancelBtn.disabled = false;
            }
            return;
        }

        const requestData = {
            date: date,
            name: name,
            start_time: startTime,
            end_time: endTime,
            user_id: userData.sub,
            user_name: userData.name || userData.email
        };

        const result = await API.createSpecialShift(requestData);

        if (result.success) {
            alert('特別シフトが追加されました！');
            closeSpecialShiftModal();

            // 特別シフトデータを再読み込み
            await loadSpecialShifts();

            // 特別シフト表示を更新
            refreshAllSpecialShiftsDisplay();
        } else {
            throw new Error(result.error || '特別シフトの追加に失敗しました');
        }

    } catch (error) {
        console.error('特別シフト追加エラー:', error);
        showSpecialShiftError(error.message || '特別シフトの追加に失敗しました。ネットワークエラーが発生している可能性があります。');

        // エラー時はボタンを復活
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '追加';
        }
        if (cancelBtn) {
            cancelBtn.disabled = false;
        }
    }
}

/**
 * 特別シフトエラーメッセージを表示
 * @param {string} message - エラーメッセージ
 */
function showSpecialShiftError(message) {
    const errorDiv = document.getElementById('specialShiftError');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

/**
 * 特別シフトデータを読み込み
 */
async function loadSpecialShifts() {
    try {
        const result = await API.getAllSpecialShifts();

        if (result.success && Array.isArray(result.data)) {
            setSpecialShifts(result.data);
        } else {
            console.error('特別シフトデータの読み込みに失敗しました:', result.error);
            setSpecialShifts([]);
        }
    } catch (error) {
        console.error('特別シフト読み込みエラー:', error);
        setSpecialShifts([]);
    }
}

/**
 * 特定の日付の特別シフトを表示する関数
 * @param {string} dateKey - 日付キー (YYYY-MM-DD形式)
 * @param {HTMLElement} container - 表示先のコンテナ要素
 */
function displaySpecialShiftsForDate(dateKey, container) {
    const specialShifts = getSpecialShifts();

    if (!Array.isArray(specialShifts)) {
        container.innerHTML = '';
        return;
    }

    // 該当する日付の特別シフトを取得
    const shiftsForDate = specialShifts.filter(shift =>
        normalizeShiftDate(shift.date) === dateKey
    );

    // コンテナをクリア
    container.innerHTML = '';

    if (shiftsForDate.length === 0) {
        return;
    }

    // 時刻順でソート（snake_caseとcamelCaseの両方に対応）
    shiftsForDate.sort((a, b) => {
        const aStartTime = a.start_time || a.startTime;
        const bStartTime = b.start_time || b.startTime;
        return aStartTime.localeCompare(bStartTime);
    });

    // 各特別シフトを表示
    shiftsForDate.forEach(shift => {
        const shiftItem = document.createElement('div');
        shiftItem.className = 'special-shift-item';

        const timeSpan = document.createElement('span');
        timeSpan.className = 'special-shift-time';

        // 時間をJSTに変換（snake_caseとcamelCaseの両方に対応）
        const startTime = convertTimeToJST(shift.start_time || shift.startTime);
        const endTime = convertTimeToJST(shift.end_time || shift.endTime);

        if (shift.name) {
            const nameSpan = document.createElement('span');
            nameSpan.className = 'special-shift-item-name';
            nameSpan.textContent = shift.name;
            shiftItem.appendChild(nameSpan);
        }

        timeSpan.textContent = `${startTime}-${endTime}`;
        shiftItem.appendChild(timeSpan);

        // 削除ボタン（管理者のみ表示）
        if (isAdmin()) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'special-shift-delete';
            deleteBtn.innerHTML = '×';
            deleteBtn.title = '削除';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deleteSpecialShiftByUuid(shift.uuid, dateKey, startTime, endTime);
            };
            shiftItem.appendChild(deleteBtn);
        }

        container.appendChild(shiftItem);
    });
}

// checkHasSpecialShifts is defined in shiftRequest.js using normalizeShiftDate

/**
 * UUIDを使用して特別シフトを削除する関数
 * @param {string} uuid - 特別シフトのUUID
 * @param {string} dateKey - 日付キー（確認メッセージ用）
 * @param {string} startTime - 開始時刻（確認メッセージ用）
 * @param {string} endTime - 終了時刻（確認メッセージ用）
 */
async function deleteSpecialShiftByUuid(uuid, dateKey, startTime, endTime) {
    if (!confirm(`${dateKey} ${startTime}-${endTime} の特別シフトを削除しますか？`)) {
        return;
    }

    try {
        const result = await API.deleteSpecialShift(uuid);

        if (result.success) {
            // 特別シフトデータを再読み込み
            await loadSpecialShifts();

            // 特別シフト表示を更新
            refreshAllSpecialShiftsDisplay();

            alert('特別シフトを削除しました！');
        } else {
            throw new Error(result.error || '特別シフトの削除に失敗しました');
        }

    } catch (error) {
        console.error('特別シフト削除エラー:', error);
        alert(error.message || '特別シフトの削除に失敗しました。');
    }
}

/**
 * 全ての日付の特別シフト表示を更新する関数
 */
function refreshAllSpecialShiftsDisplay() {
    const allSpecialShiftDisplays = document.querySelectorAll('.special-shift-display');
    if (allSpecialShiftDisplays.length === 0) {
        return;
    }

    allSpecialShiftDisplays.forEach(display => {
        const dateKey = display.id.replace('special-shifts-', '');
        displaySpecialShiftsForDate(dateKey, display);
    });
}

/**
 * 特別シフト一覧を読み込み
 */
async function loadSpecialShiftList() {
    const specialShiftListContent = document.getElementById('specialShiftListContent');

    if (!specialShiftListContent) {
        console.error('specialShiftListContent element not found');
        return;
    }

    // ローディング表示
    specialShiftListContent.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <div class="loading-text">特別シフト一覧を読み込み中...</div>
        </div>
    `;

    try {
        // バックエンドAPIから特別シフト一覧を取得
        const result = await API.getAllSpecialShifts();

        if (!result.success) {
            throw new Error(result.error || '特別シフト一覧の取得に失敗しました');
        }

        const specialShifts = result.data || [];

        // 特別シフト一覧を表示
        displaySpecialShiftList(specialShifts);

    } catch (error) {
        console.error('特別シフト一覧の読み込みエラー:', error);
        specialShiftListContent.innerHTML = `
            <div class="error-message">
                <p>特別シフト一覧の読み込みに失敗しました</p>
                <p style="font-size: 14px; color: #666;">${error.message}</p>
                <button onclick="loadSpecialShiftList()" class="retry-btn">再試行</button>
            </div>
        `;
    }
}

/**
 * 特別シフト一覧を表示
 * @param {Array} specialShifts - 特別シフトの配列
 */
function displaySpecialShiftList(specialShifts) {
    const specialShiftListContent = document.getElementById('specialShiftListContent');

    if (!specialShiftListContent) {
        return;
    }

    if (!specialShifts || specialShifts.length === 0) {
        specialShiftListContent.innerHTML = `
            <div class="special-shift-list-container">
                <p style="text-align: center; color: #666; padding: 40px;">
                    登録されている特別シフトはありません
                </p>
            </div>
        `;
        return;
    }

    // テーブルを生成
    const tableHTML = `
        <div class="special-shift-list-container">
            <table class="special-shift-list-table">
                <thead>
                    <tr>
                        <th>日付</th>
                        <th>時間帯</th>
                        <th>登録者</th>
                        <th>登録日時</th>
                        <th style="width: 100px;">操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${specialShifts.map(shift => `
                        <tr data-shift-uuid="${escapeHtml(shift.uuid)}">
                            <td>${escapeHtml(shift.date)}</td>
                            <td>${escapeHtml(shift.start_time)} - ${escapeHtml(shift.end_time)}</td>
                            <td>${escapeHtml(shift.user_name)}</td>
                            <td>${formatDateTime(shift.created_at)}</td>
                            <td>
                                <button class="delete-special-shift-btn"
                                    data-shift-uuid="${escapeHtml(shift.uuid)}"
                                    data-shift-date="${escapeHtml(shift.date)}"
                                    data-shift-time="${escapeHtml(shift.start_time)}-${escapeHtml(shift.end_time)}">
                                    削除
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    specialShiftListContent.innerHTML = tableHTML;

    // 削除ボタンのイベントリスナーを設定
    const deleteButtons = specialShiftListContent.querySelectorAll('.delete-special-shift-btn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', handleDeleteSpecialShiftFromList);
    });
}

/**
 * 特別シフト削除ハンドラ（一覧画面用）
 * @param {Event} event - クリックイベント
 */
async function handleDeleteSpecialShiftFromList(event) {
    const button = event.target;
    const uuid = button.getAttribute('data-shift-uuid');
    const date = button.getAttribute('data-shift-date');
    const time = button.getAttribute('data-shift-time');

    if (!uuid) {
        alert('特別シフトのUUIDが見つかりません');
        return;
    }

    // 確認ダイアログ
    const confirmMessage = `本当にこの特別シフトを削除しますか？\n\n日付: ${date}\n時間: ${time}\n\nこの操作は取り消せません。`;
    if (!confirm(confirmMessage)) {
        return;
    }

    // ボタンを無効化
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '削除中...';

    try {
        const result = await API.deleteSpecialShift(uuid);

        if (result.success) {
            alert('特別シフトを削除しました');

            // 行を削除（アニメーション効果付き）
            const row = button.closest('tr');
            if (row) {
                row.style.opacity = '0';
                row.style.transition = 'opacity 0.3s';
                setTimeout(() => {
                    row.remove();

                    // 特別シフト数を更新
                    const h2 = document.querySelector('#specialShiftListContent h2');
                    if (h2) {
                        const currentCount = document.querySelectorAll('.special-shift-list-table tbody tr').length;
                        h2.textContent = `特別シフト一覧（${currentCount}件）`;
                    }

                    // テーブルが空になった場合
                    if (currentCount === 0) {
                        loadSpecialShiftList();
                    }
                }, 300);
            }

            // グローバルの特別シフトデータも更新
            await loadSpecialShifts();
            refreshAllSpecialShiftsDisplay();
        } else {
            alert('特別シフトの削除に失敗しました: ' + (result.error || '不明なエラー'));
            button.disabled = false;
            button.textContent = originalText;
        }
    } catch (error) {
        console.error('特別シフト削除エラー:', error);
        alert('特別シフトの削除に失敗しました');
        button.disabled = false;
        button.textContent = originalText;
    }
}
