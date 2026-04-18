// capacity.js - 容量管理モジュール

/**
 * 容量設定を読み込む
 */
async function loadCapacitySettings() {
    // ローディングアイコンを表示
    const loadingContainer = document.getElementById('capacityLoadingContainer');
    const calendarContainer = document.getElementById('capacityCalendarContainer');

    if (loadingContainer) loadingContainer.style.display = 'flex';
    if (calendarContainer) calendarContainer.style.display = 'none';

    try {
        // データを直接APIから読み込み
        const [capacityData] = await Promise.all([
            fetchCapacityFromSpreadsheet(),
            loadSpecialShifts()  // 特別シフトも一緒に読み込み
        ]);

        // グローバル変数に保存（既存コードとの互換性のため）
        window.capacityData = capacityData;

        // カレンダーを生成
        generateCalendar('capacityCalendarContainer', true);

        // 読み込んだデータを入力フィールドに反映
        if (capacityData && capacityData.length > 0) {
            applyCapacityData(capacityData);
        }

    } catch (error) {
        console.error('人数設定の読み込みに失敗しました:', error);
        // エラーが発生してもカレンダーは表示
        generateCalendar('capacityCalendarContainer', true);
    } finally {
        // ローディングアイコンを非表示にしてカレンダーを表示
        if (loadingContainer) loadingContainer.style.display = 'none';
        if (calendarContainer) calendarContainer.style.display = 'block';

        // カレンダー表示後に特別シフト表示を更新（より長い待機時間）
        setTimeout(() => {
            refreshAllSpecialShiftsDisplay();
        }, 300);
    }
}

/**
 * スプレッドシートから容量設定を取得
 */
async function fetchCapacityFromSpreadsheet() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        return [];
    }

    try {
        const response = await fetch(`${config.API_BASE_URL}/capacity-settings`);
        const result = await response.json();

        if (result.success) {
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
 * スプレッドシートからシフト申請数を取得
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
 * 編集モードに切り替える
 */
function toggleEditMode(dateKey) {
    const displayElement = document.getElementById(`display-${dateKey}`);
    const editElement = document.getElementById(`edit-${dateKey}`);
    const valueElement = document.getElementById(`value-${dateKey}`);
    const inputElement = document.getElementById(`input-${dateKey}`);

    if (displayElement && editElement && valueElement && inputElement) {
        // 現在の値を編集用入力フィールドにセット
        const currentValue = parseInt(valueElement.textContent) || 0;
        inputElement.value = currentValue;

        // メモの現在値もセット
        const memoDisplayElement = document.getElementById(`memo-display-${dateKey}`);
        const memoElement = document.getElementById(`memo-${dateKey}`);
        if (memoDisplayElement && memoElement) {
            memoElement.value = memoDisplayElement.textContent || '';
        }

        // ボタンの状態を確実に有効化
        const saveBtn = document.querySelector(`#edit-${dateKey} .save-single-btn`);
        const cancelBtn = document.querySelector(`#edit-${dateKey} .cancel-edit-btn`);

        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '✅';
            saveBtn.title = '保存';
        }
        if (cancelBtn) {
            cancelBtn.disabled = false;
        }

        // 表示モードを非表示、編集モードを表示
        displayElement.style.display = 'none';
        editElement.style.display = 'flex';

        // 入力フィールドにフォーカス
        inputElement.focus();
        inputElement.select();
    }
}

/**
 * 編集をキャンセル
 */
function cancelEdit(dateKey) {
    const displayElement = document.getElementById(`display-${dateKey}`);
    const editElement = document.getElementById(`edit-${dateKey}`);

    if (displayElement && editElement) {
        // 編集モードを非表示、表示モードを表示
        editElement.style.display = 'none';
        displayElement.style.display = 'flex';

        // ボタンの状態をリセット
        const saveBtn = document.querySelector(`#edit-${dateKey} .save-single-btn`);
        const cancelBtn = document.querySelector(`#edit-${dateKey} .cancel-edit-btn`);

        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '✅';
            saveBtn.title = '保存';
        }
        if (cancelBtn) {
            cancelBtn.disabled = false;
        }
    }
}

/**
 * 単一の日付の容量を保存
 */
async function saveSingleCapacity(dateKey) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        alert('ログインが必要です。');
        return;
    }

    const inputElement = document.getElementById(`input-${dateKey}`);
    const valueElement = document.getElementById(`value-${dateKey}`);
    const saveBtn = document.querySelector(`#edit-${dateKey} .save-single-btn`);
    const cancelBtn = document.querySelector(`#edit-${dateKey} .cancel-edit-btn`);

    if (!inputElement || !valueElement) {
        return;
    }

    const newCapacity = parseInt(inputElement.value) || 0;

    // メモフィールドの値も取得
    const memoElement = document.getElementById(`memo-${dateKey}`);
    const memo = memoElement ? memoElement.value.trim() : '';

    // ボタンを無効化
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '⏳';
        saveBtn.title = '保存中...';
    }
    if (cancelBtn) {
        cancelBtn.disabled = true;
    }

    try {
        // 単一の日付データを送信
        const capacityData = [{
            date: dateKey,
            capacity: newCapacity,
            memo: memo,
            userId: currentUser.sub,
            userName: currentUser.name,
            timestamp: new Date().toISOString()
        }];

        await saveCapacityToSpreadsheet(capacityData);

        // 表示を更新
        valueElement.textContent = `${newCapacity}人`;

        // メモ表示も更新
        const memoElement = document.getElementById(`memo-${dateKey}`);
        const memoDisplayElement = document.getElementById(`memo-display-${dateKey}`);
        if (memoElement && memoDisplayElement) {
            memoDisplayElement.textContent = memoElement.value.trim();
        }

        // 編集モードを終了
        cancelEdit(dateKey);

    } catch (error) {
        console.error('人数設定の保存に失敗しました:', error);
        alert('保存に失敗しました。再度お試しください。');

        // エラー時はボタンを復活
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '✅';
            saveBtn.title = '保存';
        }
        if (cancelBtn) {
            cancelBtn.disabled = false;
        }
    }
}

/**
 * 容量データを画面に適用
 */
function applyCapacityData(capacityData) {
    // データを日付をキーとするマップに変換
    const capacityMap = {};
    const memoMap = {};
    capacityData.forEach(item => {
        if (item.date && item.date !== '') {
            capacityMap[item.date] = item.capacity;
            memoMap[item.date] = item.memo || '';
        }
    });

    // 各表示要素に値を設定
    let appliedCount = 0;

    Object.keys(capacityMap).forEach(dateKey => {
        const valueElement = document.getElementById(`value-${dateKey}`);
        const inputElement = document.getElementById(`input-${dateKey}`);

        if (valueElement && inputElement) {
            const capacity = capacityMap[dateKey];
            const memo = memoMap[dateKey] || '';
            valueElement.textContent = `${capacity}人`;
            inputElement.value = capacity;

            // メモフィールドも更新
            const memoElement = document.getElementById(`memo-${dateKey}`);
            if (memoElement) {
                memoElement.value = memo;
            }

            // メモ表示エリアも更新
            const memoDisplayElement = document.getElementById(`memo-display-${dateKey}`);
            if (memoDisplayElement) {
                memoDisplayElement.textContent = memo;
            }

            appliedCount++;
        }
    });
}

/**
 * 管理者画面のカレンダーに容量を表示
 */
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

// displayCapacityWithCountsOnCalendar は shiftRequest.js で定義（特別シフト対応版）

// updateSingleDateCapacity は shiftRequest.js で定義（特別シフト対応版）

/**
 * スプレッドシートに容量設定を保存
 */
async function saveCapacityToSpreadsheet(capacityData) {
    const currentUser = getCurrentUser();
    try {
        // 人数設定データをAPI用の形式に変換
        const settings = capacityData.map(item => ({
            date: item.date,
            capacity: item.capacity,
            memo: item.memo || '',
            user_id: item.userId || currentUser?.sub,
            user_name: item.userName || currentUser?.name
        }));

        const response = await fetch(`${config.API_BASE_URL}/capacity-settings/bulk`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ settings })
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || '人数設定の保存に失敗しました');
        }

        // 保存完了（SQLiteは高速なので再読み込み不要）

    } catch (error) {
        console.error('人数設定の保存に失敗しました:', error);
        throw error;
    }
}

/**
 * すべての容量データを収集
 */
function collectCapacityData() {
    const currentUser = getCurrentUser();
    const capacityInputs = document.querySelectorAll('.capacity-input');
    const data = [];

    capacityInputs.forEach(input => {
        const date = input.getAttribute('data-date');
        const capacity = parseInt(input.value) || 0;

        // メモフィールドの値も取得
        const memoElement = document.getElementById(`memo-${date}`);
        const memo = memoElement ? memoElement.value.trim() : '';

        if (date) {
            data.push({
                date: date,
                capacity: capacity,
                memo: memo,
                userId: currentUser.sub,
                userName: currentUser.name,
                timestamp: new Date().toISOString()
            });
        }
    });

    return data;
}
