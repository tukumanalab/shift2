const GOOGLE_APPS_SCRIPT_URL = config.GOOGLE_APPS_SCRIPT_URL;
const GOOGLE_CLIENT_ID = config.GOOGLE_CLIENT_ID;
const AUTHORIZED_EMAILS = config.AUTHORIZED_EMAILS.split(',').map(email => email.trim());

let currentUser = null;
let currentUserProfile = null; // ユーザープロフィール（ニックネーム、本名）をキャッシュ
let isAdminUser = false;
// キャッシュ変数は削除（SQLiteが高速なため不要）

// ユーザーの表示名を取得する関数
function getDisplayName(nickname, realName, fallbackName = null) {
    const hasNickname = nickname && nickname.trim() !== '';
    const hasRealName = realName && realName.trim() !== '';
    
    if (hasNickname && hasRealName) {
        return `${nickname}(${realName})`;
    } else if (hasNickname) {
        return nickname;
    } else if (hasRealName) {
        return realName;
    } else {
        return fallbackName || 'ユーザー';
    }
}

// 現在のユーザーの表示名を取得する関数
function getCurrentUserDisplayName() {
    if (currentUserProfile) {
        return getDisplayName(
            currentUserProfile.nickname,
            currentUserProfile.real_name || currentUserProfile.realName,
            currentUser ? currentUser.name : null
        );
    }
    return currentUser ? currentUser.name : 'ユーザー';
}

// ヘッダーとモバイルメニューの表示名を更新する関数
function updateHeaderDisplayName() {
    const displayName = getCurrentUserDisplayName();
    
    // PC版ヘッダーの更新
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        userNameElement.textContent = displayName;
    }
    
    // モバイルメニューの更新
    const mobileUserNameElement = document.getElementById('mobileUserName');
    if (mobileUserNameElement) {
        mobileUserNameElement.textContent = displayName;
    }
}

// シフトデータから表示名を取得する関数
function getShiftDisplayName(shift) {
    // シフトデータにニックネームや本名が含まれている場合はそれを使用
    if (shift.nickname || shift.realName) {
        return getDisplayName(shift.nickname, shift.realName, shift.userName || shift.name);
    }
    // 既存の名前を使用
    return shift.userName || shift.name || '名前未設定';
}

function handleCredentialResponse(response) {
    const responsePayload = decodeJwtResponse(response.credential);

    // Check if email is authorized admin
    isAdminUser = AUTHORIZED_EMAILS.includes(responsePayload.email);

    // ログインモードをコンソールに表示
    console.log('=== Google Login Information ===');
    console.log('User Email:', responsePayload.email);
    console.log('User Type:', isAdminUser ? '管理者' : '一般ユーザー');
    console.log('================================');

    showProfile(responsePayload);
}

function decodeJwtResponse(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
}


async function showProfile(profileData) {
    currentUser = profileData;
    // グローバルに保存（特別シフト機能で使用）
    window.currentUser = profileData;
    
    const profileInfo = document.getElementById('profileInfo');
    const loginPrompt = document.getElementById('loginPrompt');
    const appContent = document.getElementById('appContent');
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    
    if (profileInfo) profileInfo.classList.remove('hidden');
    if (loginPrompt) loginPrompt.classList.add('hidden');
    if (appContent) appContent.classList.remove('hidden');
    if (hamburgerBtn) hamburgerBtn.classList.remove('hidden');
    
    const userImage = document.getElementById('userImage');
    const userEmail = document.getElementById('userEmail');
    const userName = document.getElementById('userName');
    
    if (userImage) userImage.src = profileData.picture;
    if (userEmail) userEmail.textContent = profileData.email;
    if (userName) userName.textContent = profileData.name;
    
    // モバイルメニューのユーザー情報も更新
    const mobileUserSection = document.getElementById('mobileUserSection');
    const mobileUserImage = document.getElementById('mobileUserImage');
    const mobileUserEmail = document.getElementById('mobileUserEmail');
    const mobileUserName = document.getElementById('mobileUserName');
    
    if (mobileUserSection) mobileUserSection.classList.remove('hidden');
    if (mobileUserImage) mobileUserImage.src = profileData.picture;
    if (mobileUserEmail) mobileUserEmail.textContent = profileData.email;
    if (mobileUserName) mobileUserName.textContent = profileData.name;
    
    // モバイルメニューの設定項目を管理者の場合は非表示にする
    const mobileSettingsItem = document.getElementById('mobileSettingsItem');
    if (mobileSettingsItem) {
        mobileSettingsItem.style.display = isAdminUser ? 'none' : 'block';
    }
    
    // 一般ユーザーの場合、ユーザー情報をスプレッドシートに保存
    if (!isAdminUser) {
        await saveUserToSpreadsheet(profileData);
    }
    
    // タブの表示制御
    updateTabVisibility();
    
    // 初回データロード
    if (isAdminUser) {
        // 管理者の場合、必要なデータを初回に読み込み
        await Promise.all([
            loadUserProfile(),       // ユーザープロフィール（ニックネーム、本名）
            loadSpecialShifts()      // 特別シフトデータ
        ]);
        // 初期表示
        await displayShiftList();
    } else {
        // 一般ユーザーの場合、必要なデータを初回に読み込み
        await Promise.all([
            loadUserShiftsData(),     // 自分のシフトデータ
            loadUserProfile(),        // ユーザープロフィール（ニックネーム、本名）
            loadSpecialShifts()       // 特別シフトデータ
        ]);
        // 初期表示
        displayMyShifts(document.getElementById('myShiftsCalendarContainer'), currentUserShifts);
    }
}

// ユーザープロフィールを取得してキャッシュする関数
async function loadUserProfile() {
    if (!currentUser) {
        return;
    }

    try {
        const response = await fetch(`${config.API_BASE_URL}/users/${currentUser.sub}/profile`);
        const result = await response.json();

        if (result.success && result.data) {
            currentUserProfile = result.data;
            console.log('ユーザープロフィールをキャッシュに保存しました:', currentUserProfile);

            // ヘッダーの表示名を更新
            updateHeaderDisplayName();
        } else {
            console.error('ユーザープロフィールの取得エラー:', result.error);
        }
    } catch (error) {
        console.error('ユーザープロフィールの取得に失敗:', error);
    }

    // プロフィール入力状況をチェック
    checkProfileCompleteness();
}

// ユーザーのシフトデータを取得してキャッシュする関数
async function loadUserShiftsData() {
    if (!currentUser) return;

    try {
        const response = await fetch(`${config.API_BASE_URL}/shifts?userId=${currentUser.sub}`);
        const result = await response.json();

        if (result.success && result.data) {
            // データ形式を統一（snake_case → camelCase）
            currentUserShifts = result.data.map(shift => ({
                shiftDate: shift.date,
                timeSlot: shift.time_slot,
                userId: shift.user_id,
                userName: shift.user_name,
                uuid: shift.uuid,
                registrationDate: shift.created_at
            }));
        }
    } catch (error) {
        console.error('ユーザーシフトデータの取得に失敗:', error);
        currentUserShifts = [];
    }
}

// シフト一覧を再読み込みする関数（管理者用）
// 自分のシフト一覧を再読み込みする関数（通常ユーザー用）
async function syncAllShiftsToCalendar() {
    if (!currentUser) {
        alert('ログインが必要です。');
        return;
    }
    
    // 確認ダイアログを表示
    const confirmSync = confirm('本当にGoogleカレンダーと同期し直しますか？\n既存のカレンダー上のシフトをすべて削除してから、再度同期します。');
    if (!confirmSync) {
        return;
    }
    
    const syncBtn = document.getElementById('syncBtn');
    syncBtn.disabled = true;
    syncBtn.textContent = '削除・同期中...';
    
    try {
        await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            mode: 'no-cors',
            body: JSON.stringify({
                type: 'syncAll',
                userId: currentUser.sub
            })
        });
        
        console.log('既存のシフトを削除してから全シフトをカレンダーに同期しました');
        alert('カレンダーから既存のシフトを削除し、全シフトを再同期しました！');
        
    } catch (error) {
        console.error('同期に失敗しました:', error);
        alert('同期に失敗しました。再度お試しください。');
    } finally {
        syncBtn.disabled = false;
        syncBtn.textContent = 'Googleカレンダーと同期し直す';
    }
}


function signOut() {
    google.accounts.id.disableAutoSelect();
    
    currentUser = null;
    isAdminUser = false;
    
    const profileInfo = document.getElementById('profileInfo');
    const loginPrompt = document.getElementById('loginPrompt');
    const appContent = document.getElementById('appContent');
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    
    if (profileInfo) profileInfo.classList.add('hidden');
    if (loginPrompt) loginPrompt.classList.remove('hidden');
    if (appContent) appContent.classList.add('hidden');
    if (hamburgerBtn) hamburgerBtn.classList.add('hidden');
    
    const userImage = document.getElementById('userImage');
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    
    if (userImage) userImage.src = '';
    if (userName) userName.textContent = '';
    if (userEmail) userEmail.textContent = '';
    
    console.log('ユーザーがログアウトしました');
}

function switchToTab(tabName) {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    // Remove active class from all buttons and contents
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));

    // Add active class to corresponding button and content
    // タブボタンのみにアクティブクラスを追加（モバイルメニュー項目は除外）
    const targetButton = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
    if (targetButton) {
        targetButton.classList.add('active');
    }
    
    const targetContent = document.getElementById(tabName);
    if (targetContent) {
        targetContent.classList.add('active');
    }
    
    // Load data for the selected tab
    if (tabName === 'capacity-settings') {
        loadCapacitySettings();
    } else if (tabName === 'my-shifts') {
        loadMyShifts();
    } else if (tabName === 'shift-list') {
        loadShiftList();
    } else if (tabName === 'shift-request') {
        loadShiftRequestForm();
    } else if (tabName === 'settings') {
        loadSettings();
    } else if (tabName === 'user-list') {
        loadUserList();
    } else if (tabName === 'special-shift-list') {
        loadSpecialShiftList();
    }
}

function setupTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            switchToTab(targetTab);
        });
    });
}


// 管理者用シフト一覧を表示
async function displayShiftList() {
    const container = document.getElementById('shiftCalendarContainer');
    if (!container) return;

    try {
        // シフトデータを取得
        const shiftsResponse = await fetch(`${config.API_BASE_URL}/shifts`);
        const shiftsResult = await shiftsResponse.json();

        if (shiftsResult.success && shiftsResult.data && shiftsResult.data.length > 0) {
            // データ形式を統一
            const allShifts = shiftsResult.data.map(shift => ({
                shiftDate: shift.date,
                timeSlot: shift.time_slot,
                userId: shift.user_id,
                userName: shift.user_name,
                uuid: shift.uuid,
                registrationDate: shift.created_at
            }));

            window.allShiftsData = allShifts;
            generateCalendar('shiftCalendarContainer');

            // 人数設定データも取得してメモを表示
            const capacityResponse = await fetch(`${config.API_BASE_URL}/capacity-settings`);
            const capacityResult = await capacityResponse.json();

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

async function loadShiftList() {
    console.log('管理者モード: 全員のシフト一覧を読み込み中...');

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
}

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
                    cell.addEventListener('click', handleCalendarCellClick);
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

// シフト申請可能日の判定関数
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

// 管理者用：個人ごとに連続する時間帯をマージする関数
function mergeShiftsByPerson(shiftsForDate) {
    // 個人ごとにグループ化
    const shiftsByPerson = {};
    shiftsForDate.forEach(shift => {
        const personKey = `${getShiftDisplayName(shift)}_${shift.userEmail || shift.email}`;
        if (!shiftsByPerson[personKey]) {
            shiftsByPerson[personKey] = {
                person: shift,
                timeSlots: [],
                uuids: [] // UUID配列を追加
            };
        }
        shiftsByPerson[personKey].timeSlots.push(shift.timeSlot || shift.time);
        shiftsByPerson[personKey].uuids.push(shift.uuid); // UUIDを収集
    });
    
    // 各個人の時間帯をマージ
    const mergedShifts = [];
    Object.keys(shiftsByPerson).forEach(personKey => {
        const personData = shiftsByPerson[personKey];
        const mergedTimeSlots = mergeConsecutiveTimeSlots(personData.timeSlots);
        
        mergedTimeSlots.forEach(timeSlot => {
            mergedShifts.push({
                ...personData.person,
                timeSlot: timeSlot,
                uuids: personData.uuids // UUID配列を保持
            });
        });
    });
    
    return mergedShifts;
}

// 指定された日付のシフト情報を表示する関数
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
        
        timeSlotGroups[timeSlot].forEach(shift => {
            const personDiv = document.createElement('div');
            personDiv.className = 'shift-person';
            personDiv.textContent = getShiftDisplayName(shift);
            personDiv.title = `${getShiftDisplayName(shift)} (${shift.userEmail || shift.email || ''})`;
            peopleDiv.appendChild(personDiv);
        });
        
        timeSlotDiv.appendChild(peopleDiv);
        container.appendChild(timeSlotDiv);
    });
}

// シフト削除機能（管理者専用）
async function deleteShift(shift) {
    // 管理者または本人のシフトのみ削除可能
    if (!isAdminUser && shift.userId !== currentUser.sub) {
        alert('自分のシフトまたは管理者権限が必要です。');
        return;
    }
    
    const userName = getShiftDisplayName(shift);
    const dateKey = shift.shiftDate || shift.date;
    const timeSlot = shift.timeSlot || shift.time;
    
    if (!confirm(`${userName}さんの${dateKey} ${timeSlot}のシフトを削除しますか？`)) {
        return;
    }
    
    try {
        // シフト削除リクエストを送信
        const response = await fetch(`${config.API_BASE_URL}/shifts/${shift.uuid}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'シフトの削除に失敗しました');
        }

        alert(`${userName}さんの${dateKey} ${timeSlot}のシフトを削除しました。`);

        // シフト一覧を再読み込み
        await loadShiftList();
        
    } catch (error) {
        console.error('シフト削除でエラー:', error);
        alert('シフトの削除に失敗しました。再度お試しください。');
    }
}

// 時間範囲を30分単位のスロットに分解する関数
function expandTimeRange(timeRange) {
    console.log('expandTimeRange input:', timeRange);
    
    // 時間範囲を解析
    const rangeParts = timeRange.split('-');
    if (rangeParts.length !== 2) {
        // 単一時間の場合はそのまま返す
        console.log('単一時間:', timeRange);
        return [timeRange.trim()];
    }
    
    const startTime = rangeParts[0].trim();
    const endTime = rangeParts[1].trim();
    
    // 時間を分に変換
    function timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }
    
    // 分を時間に変換
    function minutesToTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }
    
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    
    console.log('startMinutes:', startMinutes, 'endMinutes:', endMinutes);
    
    // 30分単位でスロットを生成  
    const timeSlots = [];
    for (let minutes = startMinutes; minutes < endMinutes; minutes += 30) {
        const slotStart = minutesToTime(minutes);
        const slotEnd = minutesToTime(minutes + 30);
        timeSlots.push(`${slotStart}-${slotEnd}`);
    }
    
    console.log('expandTimeRange output:', timeSlots);
    return timeSlots;
}

async function deleteShiftFromModal(buttonElement, uuids) {
    if (!uuids || !Array.isArray(uuids) || uuids.length === 0) {
        alert('シフト情報が不正です。');
        return;
    }
    
    // UUIDs配列に対応するすべてのシフト情報を取得
    const targetShifts = [];
    if (window.allShiftsData) {
        targetShifts.push(...window.allShiftsData.filter(s => uuids.includes(s.uuid)));
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
        const response = await fetch(`${config.API_BASE_URL}/shifts/delete-multiple`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ uuids: uuids })
        });

        const result = await response.json();

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

function handleCalendarCellClick(event) {
    const cell = event.currentTarget;
    const date = cell.getAttribute('data-date');
    if (!date) return;
    
    console.log('Clicked date:', date);
    openShiftDetailModal(date);
}

// シフト詳細モーダルを開く関数
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
                console.log("shift", shift);
                html += `
                    <div class="shift-detail-person">
                        <div class="shift-person-info">
                            <div class="shift-person-name">${getShiftDisplayName(shift)}</div>
                            <div class="shift-person-email">${shift.userEmail || shift.email || ''}</div>
                        </div>
                        ${(isAdminUser || shift.userId === currentUser.sub) ? `
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
    document.getElementById('shiftDetailModal').style.display = 'block';
}

// シフト詳細モーダルを閉じる関数
function closeShiftDetailModal() {
    document.getElementById('shiftDetailModal').style.display = 'none';
}

async function loadCapacitySettings() {
    console.log('Loading capacity settings...');

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
            console.log('カレンダー表示完了後、特別シフト表示を更新中...');
            refreshAllSpecialShiftsDisplay();
        }, 300);
    }
}

async function fetchCapacityFromSpreadsheet() {
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

async function fetchShiftCountsFromSpreadsheet() {
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

async function saveSingleCapacity(dateKey) {
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

async function saveAllCapacitySettings() {
    if (!currentUser) {
        alert('ログインが必要です。');
        return;
    }
    
    const saveBtn = document.getElementById('saveCapacityBtn');
    const originalText = saveBtn.textContent;
    
    try {
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';
        
        // 全ての入力フィールドからデータを収集
        const capacityData = collectCapacityData();
        
        if (capacityData.length === 0) {
            alert('保存するデータがありません。');
            return;
        }
        
        // Google Spreadsheetに保存
        await saveCapacityToSpreadsheet(capacityData);
        
    } catch (error) {
        console.error('人数設定の保存に失敗しました:', error);
        alert('保存に失敗しました。再度お試しください。');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
}

function collectCapacityData() {
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

async function saveCapacityToSpreadsheet(capacityData) {
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

function updateTabVisibility() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const adminTabs = ['shift-list', 'capacity-settings', 'user-list', 'special-shift-list'];
    const userTabs = ['shift-request', 'my-shifts', 'settings'];  // シフト申請を最初に配置
    
    // まず全てのタブボタンとコンテンツをリセット
    tabButtons.forEach(button => {
        button.classList.remove('active');
        button.style.display = 'none';
    });
    tabContents.forEach(content => {
        content.classList.remove('active');
    });
    
    tabButtons.forEach(button => {
        const tabId = button.getAttribute('data-tab');
        
        if (isAdminUser) {
            // 管理者は管理者用タブのみ表示
            if (adminTabs.includes(tabId)) {
                button.style.display = 'inline-block';
            }
        } else {
            // 一般ユーザーは一般ユーザー用タブのみ表示
            if (userTabs.includes(tabId)) {
                button.style.display = 'inline-block';
            }
        }
    });
    
    // 最初に表示するタブを選択
    if (isAdminUser) {
        // 管理者は「シフト一覧」を最初に表示
        const shiftListBtn = document.querySelector('[data-tab="shift-list"]');
        if (shiftListBtn) {
            shiftListBtn.click();
        }
    } else {
        // 一般ユーザーは「シフト申請」を最初に表示
        const shiftRequestBtn = document.querySelector('[data-tab="shift-request"]');
        if (shiftRequestBtn) {
            shiftRequestBtn.click();
        }
    }
}

// シフトデータをキャッシュに読み込む関数

async function loadMyShifts() {
    console.log('自分のシフト一覧を表示中...');
    const container = document.getElementById('myShiftsContent');
    if (!container) return;

    if (!currentUser) {
        container.innerHTML = '<p>ログインが必要です。</p>';
        return;
    }

    // ローディング表示
    container.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <div class="loading-text">自分のシフト一覧を読み込み中...</div>
        </div>
    `;

    try {
        // APIからシフトデータを取得
        const response = await fetch(`${config.API_BASE_URL}/shifts?userId=${currentUser.sub}`);
        const result = await response.json();

        if (result.success) {
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
        } else {
            container.innerHTML = '<p>シフトデータの取得に失敗しました。</p>';
        }
    } catch (error) {
        console.error('シフトデータの読み込みに失敗:', error);
        container.innerHTML = '<p>シフトデータの読み込みに失敗しました。</p>';
    }
}

// 連続する時間帯をマージする関数
function mergeConsecutiveTimeSlots(timeSlots) {
    if (timeSlots.length === 0) return [];
    
    // 時間帯を開始時刻でソート
    const sorted = timeSlots.sort((a, b) => {
        const timeA = a.replace(/(\d+):(\d+)-(\d+):(\d+)/, '$1$2');
        const timeB = b.replace(/(\d+):(\d+)-(\d+):(\d+)/, '$1$2');
        return parseInt(timeA) - parseInt(timeB);
    });
    
    const merged = [];
    let currentStart = sorted[0].split('-')[0];
    let currentEnd = sorted[0].split('-')[1];
    
    for (let i = 1; i < sorted.length; i++) {
        const [nextStart, nextEnd] = sorted[i].split('-');
        
        // 現在の終了時刻と次の開始時刻が一致すれば連続
        if (currentEnd === nextStart) {
            currentEnd = nextEnd;
        } else {
            // 連続していない場合は現在の範囲を保存して新しい範囲を開始
            merged.push(`${currentStart}-${currentEnd}`);
            currentStart = nextStart;
            currentEnd = nextEnd;
        }
    }
    
    // 最後の範囲を追加
    merged.push(`${currentStart}-${currentEnd}`);
    
    return merged;
}

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
        <div class="my-shifts-summary">
            <h4>登録済みシフト: ${mergedShifts.length}件</h4>
        </div>
        <div class="my-shifts-table-container">
            <table class="my-shifts-table">
                <thead>
                    <tr>
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
        
        // メモ情報を取得（capacityDataから）
        let memo = '';
        if (window.capacityData) {
            const capacityItem = window.capacityData.find(item => item.date === shift.shiftDate);
            memo = capacityItem ? (capacityItem.memo || '') : '';
        }
        
        // メモがある場合のみスタイルを適用して日付の下に表示
        const memoHTML = memo ? `<br><span class="shift-memo">${memo}</span>` : '';
        
        tableHTML += `
            <tr class="${rowClass}">
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
}

// 自分のシフト削除機能
async function deleteMyShift(buttonElement, uuids) {
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
        const response = await fetch(`${config.API_BASE_URL}/shifts?userId=${currentUser.sub}`);
        const result = await response.json();

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
            const deleteResponse = await fetch(`${config.API_BASE_URL}/shifts/delete-multiple`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ uuids: uuids })
            });

            const deleteResult = await deleteResponse.json();

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
        currentShiftCounts = shiftCounts;
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

async function saveSettings() {
    const realName = document.getElementById('realName').value;
    const nickname = document.getElementById('nickname').value;
    
    if (!currentUser) {
        alert('ログインしてください');
        return;
    }
    
    // ボタンを無効化
    const submitBtn = document.querySelector('#settings .submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '保存中...';
    
    try {
        // SQLiteにユーザー情報を更新
        const response = await fetch(`${config.API_BASE_URL}/users/${currentUser.sub}/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                nickname: nickname,
                realName: realName
            })
        });

        const result = await response.json();

        if (result.success) {
            // キャッシュを更新
            currentUserProfile = {
                real_name: realName,
                nickname: nickname
            };

            // ローカルストレージにも保存
            localStorage.setItem('userRealName', realName);
            localStorage.setItem('userNickname', nickname);

            alert('設定を保存しました');
            console.log('設定を保存:', { realName, nickname });

            // ヘッダーの表示名を更新
            updateHeaderDisplayName();

            // プロフィール入力状況を再チェック
            checkProfileCompleteness();
        } else {
            alert('設定の保存に失敗しました: ' + (result.error || '不明なエラー'));
        }
    } catch (error) {
        console.error('設定保存エラー:', error);
        alert('設定の保存に失敗しました');
    } finally {
        // ボタンを有効化
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

function loadSettings() {
    // フィールドを初期化
    document.getElementById('realName').value = '';
    document.getElementById('nickname').value = '';

    // キャッシュされたプロフィールデータを使用
    if (currentUserProfile) {
        const realName = currentUserProfile.real_name || currentUserProfile.realName;
        if (realName) {
            document.getElementById('realName').value = realName;
        }
        if (currentUserProfile.nickname) {
            document.getElementById('nickname').value = currentUserProfile.nickname;
        }
    } else {
        // キャッシュがない場合はローカルストレージから読み込み
        const realName = localStorage.getItem('userRealName');
        const nickname = localStorage.getItem('userNickname');

        if (realName) {
            document.getElementById('realName').value = realName;
        }
        if (nickname) {
            document.getElementById('nickname').value = nickname;
        }
    }
}

// プロフィール入力状況をチェックして通知を表示する関数
function checkProfileCompleteness() {
    if (!currentUser || isAdminUser) {
        return; // 管理者は通知不要
    }

    const realName = currentUserProfile && (currentUserProfile.real_name || currentUserProfile.realName);
    const hasRealName = realName && realName.trim() !== '';
    const hasNickname = currentUserProfile && currentUserProfile.nickname && currentUserProfile.nickname.trim() !== '';

    // 本名またはニックネームのいずれかが未入力の場合に通知を表示
    if (!hasRealName || !hasNickname) {
        showProfileNotification();
    } else {
        hideProfileNotification();
    }
}

// プロフィール入力促進通知を表示
function showProfileNotification() {
    const notification = document.getElementById('profileNotification');
    const mainContent = document.querySelector('.main-content');
    if (notification) {
        notification.classList.remove('hidden');
        if (mainContent) {
            mainContent.classList.add('with-notification');
        }
    }
}

// プロフィール入力促進通知を非表示
function hideProfileNotification() {
    const notification = document.getElementById('profileNotification');
    const mainContent = document.querySelector('.main-content');
    if (notification) {
        notification.classList.add('hidden');
        if (mainContent) {
            mainContent.classList.remove('with-notification');
        }
    }
}

// 設定タブを開く関数
function openSettingsTab() {
    const settingsTab = document.querySelector('[data-tab="settings"]');
    if (settingsTab) {
        settingsTab.click();
    }
}

async function saveUserToSpreadsheet(userData) {
    if (!userData) {
        return;
    }

    try {
        console.log('ユーザー情報をSQLiteに保存中...');

        const userInfo = {
            sub: userData.sub,
            name: userData.name,
            email: userData.email,
            picture: userData.picture
        };

        const response = await fetch(`${config.API_BASE_URL}/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userInfo)
        });

        const result = await response.json();

        if (result.success) {
            console.log('ユーザー情報を保存しました:', result.data);
        } else {
            console.error('ユーザー情報の保存エラー:', result.error);
        }

    } catch (error) {
        console.error('ユーザー情報の保存に失敗しました:', error);
        // エラーが発生してもアプリケーションの動作は継続
    }
}

function displayCapacityOnCalendar(capacityData) {
    // データを日付をキーとするマップに変換
    const capacityMap = {};
    capacityData.forEach(item => {
        if (item.date && item.date !== '') {
            capacityMap[item.date] = item.capacity;
        }
    });
    
    // 各日付の人数表示を更新
    Object.keys(capacityMap).forEach(dateKey => {
        const capacityElement = document.getElementById(`capacity-${dateKey}`);
        if (capacityElement) {
            const capacity = capacityMap[dateKey];
            // 0人の場合は表示しない
            if (capacity > 0) {
                capacityElement.innerHTML = `<span class="capacity-number">${capacity}</span><span class="capacity-unit">人</span>`;
            } else {
                capacityElement.innerHTML = '';
            }
        }
    });
}

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


let currentShiftRequestDate = null;
let currentShiftCapacity = 0;
let currentShiftCounts = {};
let currentUserShifts = []; // ユーザーのシフトデータをキャッシュ

function applyForShift(dateKey) {
    if (!currentUser) {
        alert('ログインが必要です。');
        return;
    }
    
    currentShiftRequestDate = dateKey;
    
    // 人数を取得
    const capacityElement = document.getElementById(`capacity-${dateKey}`);
    if (capacityElement) {
        const capacityNumberElement = capacityElement.querySelector('.capacity-number');
        currentShiftCapacity = parseInt(capacityNumberElement.textContent) || 0;
    }
    
    // 0人の日は申請不可
    if (currentShiftCapacity === 0) {
        alert('この日はシフト募集がありません。');
        return;
    }
    
    openShiftRequestModal(dateKey);
}

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

function updateTimeSlotCapacity(dateKey) {
    // 13:00から18:00まで、30分単位で時間枠を生成
    const startHour = 13;
    const endHour = 18;
    const slots = [];
    
    for (let hour = startHour; hour < endHour; hour++) {
        slots.push(`${hour}:00-${hour}:30`);
        slots.push(`${hour}:30-${hour + 1}:00`);
    }
    
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

function closeShiftRequestModal() {
    const modal = document.getElementById('shiftRequestModal');
    modal.style.display = 'none';
    
    // 選択をクリア
    const checkboxes = document.querySelectorAll('.time-slot-checkbox');
    checkboxes.forEach(cb => cb.checked = false);
    
    // 備考欄をクリア
    document.getElementById('shiftRemarks').value = '';
}

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
    
    // ボタンを無効化
    const submitBtn = document.querySelector('#shiftRequestModal .submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = '申請中...';
    
    try {
        // 複数時間枠の一括申請
        const response = await fetch(`${config.API_BASE_URL}/shifts/multiple`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: currentUser.sub,
                user_name: currentUser.name,
                date: currentShiftRequestDate,
                time_slots: selectedSlots
            })
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'シフト申請に失敗しました');
        }

        // 重複があった場合の警告
        if (result.duplicates && result.duplicates.length > 0) {
            alert(`以下の時間枠は既に申請済みのためスキップしました:\n${result.duplicates.join('\n')}\n\n申請成功: ${result.processed.length}件`);
        } else {
            alert(`${currentShiftRequestDate} の\n${selectedSlots.join('\n')}\nにシフト申請しました。`);
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

// グローバル変数：選択中の日付と時間枠
let currentDetailDateKey = null;
let selectedTimeSlots = [];

// 日付詳細モーダルを開く関数
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
    
    
    // 人数枠が0人の場合はダイアログを表示しない
    if (maxCapacityForDate === 0) {
        return;
    }
    
    // グローバル変数を設定
    currentDetailDateKey = dateKey;
    selectedTimeSlots = [];

    title.textContent = `${year}年${month}月${day}日 (${weekday}) のシフト枠`;

    // 自分の申請済みシフトをAPIから取得
    let myShiftsForDate = [];
    if (currentUser) {
        try {
            const response = await fetch(`${config.API_BASE_URL}/shifts?userId=${currentUser.sub}&date=${dateKey}`);
            const result = await response.json();

            if (result.success && result.data) {
                myShiftsForDate = result.data.map(shift => ({
                    shiftDate: shift.date,
                    timeSlot: shift.time_slot,
                    uuid: shift.uuid
                }));
            }
        } catch (error) {
            console.error('シフト情報の取得エラー:', error);
        }
    }
    
    // 時間枠を生成
    let slots = [];
    
    // 特別シフトがある日付かチェック
    const hasSpecialShifts = checkHasSpecialShifts(dateKey);
    
    if (hasSpecialShifts) {
        // 特別シフトの時間枠を30分区切りに変換
        const shiftsForDate = specialShifts.filter(shift => {
            let shiftDate = shift.date;
            if (typeof shiftDate === 'string' && shiftDate.includes('T')) {
                shiftDate = shiftDate.split('T')[0];
            } else if (shiftDate instanceof Date) {
                const year = shiftDate.getFullYear();
                const month = String(shiftDate.getMonth() + 1).padStart(2, '0');
                const day = String(shiftDate.getDate()).padStart(2, '0');
                shiftDate = `${year}-${month}-${day}`;
            }
            return shiftDate === dateKey;
        });
        
        // 特別シフトを30分区切りに変換
        shiftsForDate.forEach(shift => {
            const startTime = convertTimeToJST(shift.startTime);
            const endTime = convertTimeToJST(shift.endTime);
            
            // 時間を分に変換
            const timeToMinutes = (time) => {
                const [hours, minutes] = time.split(':').map(Number);
                return hours * 60 + minutes;
            };
            
            // 分を時間に変換
            const minutesToTime = (minutes) => {
                const hours = Math.floor(minutes / 60);
                const mins = minutes % 60;
                return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
            };
            
            const startMinutes = timeToMinutes(startTime);
            const endMinutes = timeToMinutes(endTime);
            
            // 30分区切りでスロットを生成
            for (let current = startMinutes; current < endMinutes; current += 30) {
                const slotStart = minutesToTime(current);
                const slotEnd = minutesToTime(current + 30);
                slots.push(`${slotStart}-${slotEnd}`);
            }
        });
    } else {
        // 通常シフトの時間枠（13:00-18:00）
        const startHour = 13;
        const endHour = 18;
        
        for (let hour = startHour; hour < endHour; hour++) {
            slots.push(`${hour}:00-${hour}:30`);
            slots.push(`${hour}:30-${hour + 1}:00`);
        }
    }
    
    // コンテナをクリア
    container.innerHTML = '';
    
    // 全選択/解除ボタンを追加
    const toggleAllDiv = document.createElement('div');
    toggleAllDiv.style.marginBottom = '15px';
    toggleAllDiv.style.textAlign = 'center';
    
    const toggleAllBtn = document.createElement('button');
    toggleAllBtn.className = 'toggle-all-btn';
    toggleAllBtn.textContent = 'すべて選択';
    toggleAllBtn.onclick = () => toggleAllTimeSlots();
    
    toggleAllDiv.appendChild(toggleAllBtn);
    container.appendChild(toggleAllDiv);
    
    // 各時間枠を表示
    slots.forEach(slot => {
        const slotDiv = document.createElement('div');
        slotDiv.className = 'date-detail-slot';
        slotDiv.dataset.slot = slot;
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'date-detail-slot-time';
        timeDiv.textContent = slot;
        
        const capacityDiv = document.createElement('div');
        capacityDiv.className = 'date-detail-slot-capacity';
        
        // その時間枠の現在の申請数を取得
        let currentCount = 0;
        if (currentShiftCounts && currentShiftCounts[dateKey] && currentShiftCounts[dateKey][slot]) {
            currentCount = currentShiftCounts[dateKey][slot];
        }
        
        const remainingCount = Math.max(0, maxCapacityForDate - currentCount);
        
        // 自分が既に申請しているかチェック
        const isAlreadyApplied = myShiftsForDate.some(shift => shift.timeSlot === slot);
        
        const capacityNumber = document.createElement('div');
        capacityNumber.className = 'date-detail-capacity-number';
        capacityNumber.textContent = remainingCount;
        
        // 既に申請済みの場合は特別な処理
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
            // 残り人数に応じてクラスを設定
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
        
        // 選択可能な場合はクリックイベントを追加（申請済みでない、かつ残り枠がある場合）
        if (!isAlreadyApplied && remainingCount > 0) {
            slotDiv.onclick = () => toggleTimeSlotSelection(slotDiv, slot);
        }
        
        container.appendChild(slotDiv);
    });
    
    // 備考欄は削除済み
    
    // 申請ボタンを無効化
    updateSubmitButton();
    
    modal.style.display = 'flex';
}

// 時間枠の選択/解除をトグル
function toggleTimeSlotSelection(slotDiv, slot) {
    if (slotDiv.classList.contains('disabled')) return;
    
    const isSelected = slotDiv.classList.contains('selected');
    
    if (isSelected) {
        // 選択解除
        slotDiv.classList.remove('selected');
        selectedTimeSlots = selectedTimeSlots.filter(s => s !== slot);
    } else {
        // 選択
        slotDiv.classList.add('selected');
        selectedTimeSlots.push(slot);
    }
    
    updateSubmitButton();
}

// すべての時間枠を選択/解除
function toggleAllTimeSlots() {
    const selectableSlots = document.querySelectorAll('.date-detail-slot.selectable');
    const toggleBtn = document.querySelector('.toggle-all-btn');
    
    if (!selectableSlots.length) return;
    
    // 現在の選択状態を確認（選択可能なスロットがすべて選択されているか）
    const allSelected = Array.from(selectableSlots).every(slot => slot.classList.contains('selected'));
    
    if (allSelected) {
        // すべて解除
        selectableSlots.forEach(slotDiv => {
            if (slotDiv.classList.contains('selected')) {
                slotDiv.classList.remove('selected');
                const slot = slotDiv.dataset.slot;
                selectedTimeSlots = selectedTimeSlots.filter(s => s !== slot);
            }
        });
        toggleBtn.textContent = 'すべて選択';
    } else {
        // すべて選択
        selectableSlots.forEach(slotDiv => {
            if (!slotDiv.classList.contains('selected')) {
                slotDiv.classList.add('selected');
                const slot = slotDiv.dataset.slot;
                selectedTimeSlots.push(slot);
            }
        });
        toggleBtn.textContent = 'すべて解除';
    }
    
    updateSubmitButton();
}

// 申請ボタンの有効/無効を更新
function updateSubmitButton() {
    const submitBtn = document.querySelector('#dateDetailModal .submit-btn');
    if (selectedTimeSlots.length > 0) {
        submitBtn.disabled = false;
        submitBtn.textContent = `選択した${selectedTimeSlots.length}つの時間枠で申請`;
    } else {
        submitBtn.disabled = true;
        submitBtn.textContent = '時間枠を選択してください';
    }
    
    // 全選択/解除ボタンのテキストも更新
    const toggleBtn = document.querySelector('.toggle-all-btn');
    if (toggleBtn) {
        const selectableSlots = document.querySelectorAll('.date-detail-slot.selectable');
        const allSelected = Array.from(selectableSlots).every(slot => slot.classList.contains('selected'));
        toggleBtn.textContent = allSelected ? 'すべて解除' : 'すべて選択';
    }
}

// 日付詳細モーダルを閉じる関数
function closeDateDetailModal() {
    const modal = document.getElementById('dateDetailModal');
    modal.style.display = 'none';
    
    // 選択状態をリセット
    currentDetailDateKey = null;
    selectedTimeSlots = [];
}

// 日付詳細モーダルでのシフト申請
async function submitDateDetailShiftRequest() {
    console.log('submitDateDetailShiftRequest called');
    
    if (!currentUser) {
        alert('ログインが必要です。');
        return;
    }
    
    if (!currentDetailDateKey || selectedTimeSlots.length === 0) {
        alert('時間枠を選択してください。');
        return;
    }
    
    // 特別シフトかどうかをチェック
    const hasSpecialShifts = checkHasSpecialShifts(currentDetailDateKey);
    const remarks = hasSpecialShifts ? '(特別シフト)' : (document.getElementById('dateDetailRemarks')?.value.trim() || 'シフト'); // 備考欄の内容
    
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
        // 複数時間枠の一括申請データを作成
        const multipleShiftData = {
            type: 'multipleShifts',
            userId: currentUser.sub,
            userName: currentUser.name,
            userEmail: currentUser.email,
            date: currentDetailDateKey,
            timeSlots: selectedTimeSlots,
            content: remarks || 'シフト'
        };
        
        // 複数時間枠の一括申請を送信
        const response = await fetch(`${config.API_BASE_URL}/shifts/multiple`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: currentUser.sub,
                user_name: currentUser.name,
                date: currentDetailDateKey,
                time_slots: selectedTimeSlots
            })
        });

        const results = await response.json();

        if (!results.success) {
            throw new Error(results.error || 'シフト申請に失敗しました');
        }

        const successSlots = results.processed || [];
        const duplicateSlots = results.duplicates || [];
        
        const dateObj = new Date(currentDetailDateKey);
        const month = dateObj.getMonth() + 1;
        const day = dateObj.getDate();
        
        // 結果に応じたメッセージを表示
        let message = '';
        
        if (successSlots.length > 0) {
            message += `${month}月${day}日の以下の時間帯にシフトを申請しました：\n${successSlots.join('\n')}`;
        }
        
        if (duplicateSlots.length > 0) {
            if (message) message += '\n\n';
            message += `以下の時間帯は既に申請済みのため、申請できませんでした：\n${duplicateSlots.join('\n')}`;
        }
        
        if (message) {
            alert(message);
        } else {
            alert('申請できる時間枠がありませんでした。');
        }
        
        // 申請した日付を保存（モーダルを閉じる前に）
        const appliedDateKey = currentDetailDateKey;
        
        // モーダルを閉じる
        closeDateDetailModal();
        
        // シフト申請数を再読み込みして申請した日付のデータを更新
        const shiftCounts = await fetchShiftCountsFromSpreadsheet();
        currentShiftCounts = shiftCounts;
        
        // 申請した日付のデータのみを更新
        updateSingleDateCapacity(appliedDateKey, window.currentCapacityData || []);
        
        // シフト申請完了（マイシフトタブで自動的に再読み込みされる）
        
    } catch (error) {
        console.error('シフト申請の保存に失敗しました:', error);
        alert('シフト申請の保存に失敗しました。再度お試しください。');
    } finally {
        submitBtn.disabled = false;
        cancelBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// 特定の日付のみの容量データを更新する関数
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
    
    // 日付セルの背景色も更新（募集がない日はグレーアウト）
    const dateCell = document.querySelector(`[data-date="${dateKey}"]`);
    if (dateCell) {
        let maxCapacityForDate = capacityMap[dateKey];
        if (maxCapacityForDate === undefined) {
            const date = new Date(dateKey);
            const dayOfWeek = date.getDay();
            maxCapacityForDate = getDefaultCapacity(dayOfWeek);
        }
        
        // 募集人数が0の日はクリック不可にする
        if (maxCapacityForDate === 0) {
            dateCell.style.backgroundColor = '#f5f5f5';
            dateCell.style.cursor = 'default';
        } else {
            dateCell.style.backgroundColor = '';
            dateCell.style.cursor = 'pointer';
        }
    }
}

window.onload = function () {
    document.getElementById('g_id_onload').setAttribute('data-client_id', GOOGLE_CLIENT_ID);
    
    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse
    });
    
    google.accounts.id.renderButton(
        document.querySelector('.g_id_signin'),
        { theme: 'outline', size: 'medium' }
    );
    
    setupTabSwitching();
    setupMobileMenu();
    
    // 日付詳細モーダルのクローズイベント
    document.getElementById('dateDetailClose').onclick = closeDateDetailModal;
    
    // モーダル外クリックで閉じる
    window.onclick = function(event) {
        const dateDetailModal = document.getElementById('dateDetailModal');
        const shiftRequestModal = document.getElementById('shiftRequestModal');
        
        if (event.target === dateDetailModal) {
            closeDateDetailModal();
        }
        if (event.target === shiftRequestModal) {
            closeShiftRequestModal();
        }
    };
};

// モバイルメニューの設定
function setupMobileMenu() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileMenuItems = document.querySelectorAll('.mobile-menu-item');

    // ハンバーガーボタンのクリックイベント
    hamburgerBtn.addEventListener('click', function() {
        hamburgerBtn.classList.toggle('active');
        mobileMenu.classList.toggle('active');
        
        // メニューを開く時に全てのアクティブクラスをリセット
        if (mobileMenu.classList.contains('active')) {
            mobileMenuItems.forEach(menuItem => {
                menuItem.classList.remove('active');
            });
        }
    });

    // モバイルメニュー項目のクリックイベント
    mobileMenuItems.forEach(item => {
        item.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            
            // タブを切り替え
            switchToTab(tabName);
            
            // メニューを閉じる
            hamburgerBtn.classList.remove('active');
            mobileMenu.classList.remove('active');
            
            // メニューを閉じる時にアクティブクラスをリセット
            mobileMenuItems.forEach(menuItem => {
                menuItem.classList.remove('active');
            });
        });
    });

    // メニュー外をクリックした時に閉じる
    document.addEventListener('click', function(event) {
        if (!mobileMenu.contains(event.target) && !hamburgerBtn.contains(event.target)) {
            hamburgerBtn.classList.remove('active');
            mobileMenu.classList.remove('active');
            
            // アクティブクラスをリセット
            mobileMenuItems.forEach(menuItem => {
                menuItem.classList.remove('active');
            });
        }
    });
}

// 特別シフト関連の関数
let specialShifts = [];

// 特別シフトモーダルを開く
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

// 日付を表示用にフォーマットする関数
function formatDateForDisplay(dateKey) {
    const date = new Date(dateKey + 'T00:00:00');
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const weekday = weekdays[date.getDay()];
    
    return `${year}年${month}月${day}日（${weekday}）`;
}

// 時刻のselect要素を初期化する関数
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

// 時刻オプションを生成する関数（00分と30分のみ）
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

// 終了時刻のオプションを更新する関数
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

// 特別シフトモーダルを閉じる
function closeSpecialShiftModal() {
    const modal = document.getElementById('specialShiftModal');
    modal.style.display = 'none';
}

// 特別シフトを送信
async function submitSpecialShift() {
    const errorDiv = document.getElementById('specialShiftError');
    const submitBtn = document.querySelector('#specialShiftModal .submit-btn');
    const cancelBtn = document.querySelector('#specialShiftModal .cancel-btn');
    
    // フォームデータを取得
    const dateDisplay = document.getElementById('specialShiftDate');
    const date = dateDisplay.getAttribute('data-date');
    const startTime = document.getElementById('specialShiftStartTime').value;
    const endTime = document.getElementById('specialShiftEndTime').value;
    
    // バリデーション
    if (!date || !startTime || !endTime) {
        showSpecialShiftError('すべての項目を選択してください。');
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
            start_time: startTime,
            end_time: endTime,
            user_id: userData.sub,
            user_name: userData.name || userData.email
        };

        const response = await fetch(`${config.API_BASE_URL}/special-shifts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });

        const result = await response.json();

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

// 特別シフトエラーメッセージを表示
function showSpecialShiftError(message) {
    const errorDiv = document.getElementById('specialShiftError');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

// 特別シフトデータを読み込み
async function loadSpecialShifts() {
    console.log('=== loadSpecialShifts DEBUG ===');
    console.log('Starting to load special shifts...');

    try {
        const response = await fetch(`${config.API_BASE_URL}/special-shifts`);
        const result = await response.json();
        console.log('loadSpecialShifts API response:', result);

        if (result.success) {
            // result.dataが配列であることを確認
            if (Array.isArray(result.data)) {
                specialShifts = result.data;
                console.log('✅ 特別シフトデータを読み込みました:', specialShifts.length + '件');
                console.log('特別シフトの詳細:', specialShifts);
            } else {
                console.warn('⚠️ result.data is not an array:', result.data);
                specialShifts = []; // 配列でない場合は空配列に設定
                console.log('✅ 特別シフトデータを空配列で初期化しました');
            }
        } else {
            console.error('❌ 特別シフトデータの読み込みに失敗しました:', result.error);
            specialShifts = []; // エラーの場合も空配列に設定
        }

    } catch (error) {
        console.error('❌ 特別シフト読み込みエラー:', error);
        specialShifts = []; // エラーの場合も空配列に設定
    }

    // 最終確認
    if (!Array.isArray(specialShifts)) {
        console.error('❌ specialShifts is still not an array, forcing to empty array');
        specialShifts = [];
    }

    console.log('Final specialShifts type:', typeof specialShifts);
    console.log('Final specialShifts is array:', Array.isArray(specialShifts));
    console.log('Final specialShifts length:', specialShifts.length);
}

// 現在のユーザーデータを取得
function getCurrentUserData() {
    // グローバル変数から取得（ログイン時に設定される）
    if (window.currentUser) {
        return window.currentUser;
    }
    
    // セッションストレージから取得を試みる
    try {
        const userData = sessionStorage.getItem('currentUser');
        if (userData) {
            return JSON.parse(userData);
        }
    } catch (error) {
        console.error('ユーザーデータの取得に失敗:', error);
    }
    
    return null;
}

// 特定の日付の特別シフトを表示する関数
function displaySpecialShiftsForDate(dateKey, container) {
    console.log('=== displaySpecialShiftsForDate DEBUG ===');
    console.log('dateKey:', dateKey);
    console.log('specialShifts array:', specialShifts);
    console.log('specialShifts type:', typeof specialShifts);
    console.log('specialShifts is array:', Array.isArray(specialShifts));
    
    // specialShiftsが配列でない場合は処理を停止
    if (!Array.isArray(specialShifts)) {
        console.log('specialShifts is not an array, skipping display');
        container.innerHTML = '';
        return;
    }
    
    console.log('specialShifts.length:', specialShifts.length);
    
    // 該当する日付の特別シフトを取得
    const shiftsForDate = specialShifts.filter(shift => {
        // 日付文字列を YYYY-MM-DD 形式に変換して比較
        let shiftDate = shift.date;
        if (typeof shiftDate === 'string' && shiftDate.includes('T')) {
            // ISO形式の場合は日付部分のみを抽出
            shiftDate = shiftDate.split('T')[0];
        } else if (shiftDate instanceof Date) {
            // Dateオブジェクトの場合はYYYY-MM-DD形式に変換
            const year = shiftDate.getFullYear();
            const month = String(shiftDate.getMonth() + 1).padStart(2, '0');
            const day = String(shiftDate.getDate()).padStart(2, '0');
            shiftDate = `${year}-${month}-${day}`;
        }
        console.log('Comparing:', shiftDate, 'vs', dateKey);
        return shiftDate === dateKey;
    });
    console.log('shiftsForDate for', dateKey, ':', shiftsForDate);
    
    // コンテナをクリア
    container.innerHTML = '';
    
    if (shiftsForDate.length === 0) {
        console.log('No special shifts found for', dateKey);
        return;
    }
    
    // 時間をJSTに変換する関数
    function convertToJST(timeString) {
        console.log('Converting time:', timeString);
        
        if (!timeString) return '';
        
        // もしISO形式（UTC）の場合は、JSTに変換
        if (typeof timeString === 'string' && timeString.includes('T') && timeString.includes('Z')) {
            const utcDate = new Date(timeString);
            // JSTは UTC+9
            const jstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000));
            const hours = String(jstDate.getUTCHours()).padStart(2, '0');
            const minutes = String(jstDate.getUTCMinutes()).padStart(2, '0');
            const jstTime = `${hours}:${minutes}`;
            console.log('UTC to JST conversion:', timeString, '->', jstTime);
            return jstTime;
        }
        
        // HH:MM形式の場合はそのまま使用
        if (typeof timeString === 'string' && timeString.includes(':') && timeString.length >= 5) {
            return timeString.substring(0, 5);
        }
        
        return timeString;
    }
    
    // 時刻順でソート（snake_caseとcamelCaseの両方に対応）
    shiftsForDate.sort((a, b) => {
        const aStartTime = a.start_time || a.startTime;
        const bStartTime = b.start_time || b.startTime;
        return aStartTime.localeCompare(bStartTime);
    });

    // 各特別シフトを表示
    shiftsForDate.forEach(shift => {
        console.log('Processing shift:', shift);

        const shiftItem = document.createElement('div');
        shiftItem.className = 'special-shift-item';

        const timeSpan = document.createElement('span');
        timeSpan.className = 'special-shift-time';

        // 時間をJSTに変換（snake_caseとcamelCaseの両方に対応）
        const startTime = convertToJST(shift.start_time || shift.startTime);
        const endTime = convertToJST(shift.end_time || shift.endTime);
        
        console.log('JST times - start:', startTime, 'end:', endTime);
        
        timeSpan.textContent = `${startTime}-${endTime}`;
        shiftItem.appendChild(timeSpan);
        
        // 削除ボタン（管理者のみ表示）
        if (isAdminUser) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'special-shift-delete';
            deleteBtn.innerHTML = '×';
            deleteBtn.title = '削除';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                // UUIDを使用して削除
                console.log('削除ボタンクリック - UUID:', shift.uuid);
                deleteSpecialShiftByUuid(shift.uuid, dateKey, startTime, endTime);
            };
            shiftItem.appendChild(deleteBtn);
        }
        
        container.appendChild(shiftItem);
    });
}

// 指定された日付に特別シフトがあるかチェックする関数
function checkHasSpecialShifts(dateKey) {
    if (!Array.isArray(specialShifts) || specialShifts.length === 0) {
        return false;
    }
    
    return specialShifts.some(shift => {
        // 日付文字列を YYYY-MM-DD 形式に変換して比較
        let shiftDate = shift.date;
        if (typeof shiftDate === 'string' && shiftDate.includes('T')) {
            // ISO形式の場合は日付部分のみを抽出
            shiftDate = shiftDate.split('T')[0];
        } else if (shiftDate instanceof Date) {
            // Dateオブジェクトの場合はYYYY-MM-DD形式に変換
            const year = shiftDate.getFullYear();
            const month = String(shiftDate.getMonth() + 1).padStart(2, '0');
            const day = String(shiftDate.getDate()).padStart(2, '0');
            shiftDate = `${year}-${month}-${day}`;
        }
        return shiftDate === dateKey;
    });
}

// 時間をJSTに変換するヘルパー関数
function convertTimeToJST(timeString) {
    if (!timeString) return '';
    
    if (typeof timeString === 'string' && timeString.includes('T') && timeString.includes('Z')) {
        const utcDate = new Date(timeString);
        const jstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000));
        const hours = String(jstDate.getUTCHours()).padStart(2, '0');
        const minutes = String(jstDate.getUTCMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }
    
    if (typeof timeString === 'string' && timeString.includes(':') && timeString.length >= 5) {
        return timeString.substring(0, 5);
    }
    
    return timeString;
}

// 特別シフトを削除する関数
async function deleteSpecialShift(date, startTime, endTime) {
    console.log('=== deleteSpecialShift DEBUG ===');
    console.log('元のパラメータ:', { date, startTime, endTime });
    
    // 時間をJSTに変換する関数
    function convertToJST(timeString) {
        if (!timeString) return '';
        
        // もしISO形式（UTC）の場合は、JSTに変換
        if (typeof timeString === 'string' && timeString.includes('T') && timeString.includes('Z')) {
            const utcDate = new Date(timeString);
            // JSTは UTC+9
            const jstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000));
            const hours = String(jstDate.getUTCHours()).padStart(2, '0');
            const minutes = String(jstDate.getUTCMinutes()).padStart(2, '0');
            return `${hours}:${minutes}`;
        }
        
        // HH:MM形式の場合はそのまま使用
        if (typeof timeString === 'string' && timeString.includes(':') && timeString.length >= 5) {
            return timeString.substring(0, 5);
        }
        
        return timeString;
    }
    
    // JST時間に変換
    const jstStartTime = convertToJST(startTime);
    const jstEndTime = convertToJST(endTime);
    
    console.log('JST変換後:', { date, startTime: jstStartTime, endTime: jstEndTime });
    
    if (!confirm(`${date} ${jstStartTime}-${jstEndTime} の特別シフトを削除しますか？`)) {
        return;
    }
    
    try {
        // 特別シフトを日付と時間で検索して削除
        // 注: この関数は古いバージョンで、UUIDベースのdeleteSpecialShiftByUuidを使用することを推奨
        const response = await fetch(`${config.API_BASE_URL}/special-shifts?date=${date}`);
        const result = await response.json();

        if (!result.success) {
            throw new Error('特別シフトの取得に失敗しました');
        }

        // 該当する特別シフトを検索
        const targetShift = result.data.find(shift =>
            shift.date === date &&
            shift.start_time === jstStartTime &&
            shift.end_time === jstEndTime
        );

        if (!targetShift) {
            throw new Error('該当する特別シフトが見つかりませんでした');
        }

        // UUIDで削除
        const deleteResponse = await fetch(`${config.API_BASE_URL}/special-shifts/${targetShift.uuid}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        const deleteResult = await deleteResponse.json();

        if (!deleteResult.success) {
            throw new Error(deleteResult.error || '特別シフトの削除に失敗しました');
        }

        // 特別シフトデータを再読み込み
        await loadSpecialShifts();

        // 特別シフト表示を更新
        refreshAllSpecialShiftsDisplay();

        alert('特別シフトを削除しました！');
        
    } catch (error) {
        console.error('特別シフト削除エラー:', error);
        alert('特別シフトの削除に失敗しました。');
    }
}

async function deleteSpecialShiftByUuid(uuid, dateKey, startTime, endTime) {
    console.log('=== deleteSpecialShiftByUuid DEBUG ===');
    console.log('削除対象:', { uuid, dateKey, startTime, endTime });

    if (!confirm(`${dateKey} ${startTime}-${endTime} の特別シフトを削除しますか？`)) {
        return;
    }

    try {
        const response = await fetch(`${config.API_BASE_URL}/special-shifts/${uuid}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        const result = await response.json();

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

// 全ての日付の特別シフト表示を更新する関数
function refreshAllSpecialShiftsDisplay() {
    console.log('=== refreshAllSpecialShiftsDisplay DEBUG ===');
    console.log('specialShifts array:', specialShifts);
    console.log('specialShifts.length:', specialShifts ? specialShifts.length : 'undefined');
    
    // 全ての特別シフト表示エリアを更新
    const allSpecialShiftDisplays = document.querySelectorAll('.special-shift-display');
    console.log('Found special shift display elements:', allSpecialShiftDisplays.length);
    
    if (allSpecialShiftDisplays.length === 0) {
        console.log('ℹ️ No .special-shift-display elements found. Calendar might not be in capacity mode or not loaded yet.');
        return; // エラーではなく、単純にreturnする
    }
    
    allSpecialShiftDisplays.forEach(display => {
        const dateKey = display.id.replace('special-shifts-', '');
        console.log('Processing display for dateKey:', dateKey);
        displaySpecialShiftsForDate(dateKey, display);
    });
    
    console.log('=== refreshAllSpecialShiftsDisplay 完了 ===');
}

// ========================================
// ユーザー一覧機能
// ========================================

/**
 * ユーザー一覧を読み込んで表示
 */
async function loadUserList() {
    const userListContent = document.getElementById('userListContent');

    if (!userListContent) {
        console.error('userListContent element not found');
        return;
    }

    // ローディング表示
    userListContent.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <div class="loading-text">ユーザー一覧を読み込み中...</div>
        </div>
    `;

    try {
        // バックエンドAPIからユーザー一覧を取得
        const response = await fetch(`${config.API_BASE_URL}/users`);
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'ユーザー一覧の取得に失敗しました');
        }

        const users = result.data || [];

        // ユーザー一覧を表示
        displayUserList(users);

    } catch (error) {
        console.error('ユーザー一覧の読み込みエラー:', error);
        userListContent.innerHTML = `
            <div class="error-message">
                <p>ユーザー一覧の読み込みに失敗しました</p>
                <p style="font-size: 14px; color: #666;">${error.message}</p>
                <button onclick="loadUserList()" class="retry-btn">再試行</button>
            </div>
        `;
    }
}

/**
 * ユーザー一覧を表示
 */
function displayUserList(users) {
    const userListContent = document.getElementById('userListContent');

    if (!userListContent) {
        return;
    }

    if (!users || users.length === 0) {
        userListContent.innerHTML = `
            <div class="user-list-container">
                <p style="text-align: center; color: #666; padding: 40px;">
                    登録されているユーザーはいません
                </p>
            </div>
        `;
        return;
    }

    // テーブルを生成
    const tableHTML = `
        <div class="user-list-container">
            <h2 style="margin-bottom: 20px;">ユーザー一覧（${users.length}人）</h2>
            <table class="user-list-table">
                <thead>
                    <tr>
                        <th>プロフィール</th>
                        <th>ニックネーム</th>
                        <th>本名</th>
                        <th>メールアドレス</th>
                        <th>登録日時</th>
                        <th>最終更新</th>
                        <th style="width: 100px;">操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(user => `
                        <tr data-user-id="${escapeHtml(user.user_id)}">
                            <td>
                                <div class="user-name-cell">
                                    ${user.picture ? `<img src="${user.picture}" alt="${user.name}" class="user-avatar">` : ''}
                                    <span>${escapeHtml(user.name)}</span>
                                </div>
                            </td>
                            <td>${escapeHtml(user.nickname || '-')}</td>
                            <td>${escapeHtml(user.real_name || '-')}</td>
                            <td>${escapeHtml(user.email)}</td>
                            <td>${formatDateTime(user.created_at)}</td>
                            <td>${formatDateTime(user.updated_at)}</td>
                            <td>
                                <button class="delete-user-btn" data-user-id="${escapeHtml(user.user_id)}" data-user-email="${escapeHtml(user.email)}">
                                    削除
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    userListContent.innerHTML = tableHTML;

    // 削除ボタンのイベントリスナーを設定
    const deleteButtons = userListContent.querySelectorAll('.delete-user-btn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', handleDeleteUser);
    });
}

/**
 * HTMLエスケープ
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 日時をフォーマット
 */
function formatDateTime(dateString) {
    if (!dateString) return '-';

    try {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${year}/${month}/${day} ${hours}:${minutes}`;
    } catch (error) {
        return dateString;
    }
}

/**
 * ユーザー削除ハンドラ
 */
async function handleDeleteUser(event) {
    const button = event.target;
    const userId = button.getAttribute('data-user-id');
    const userEmail = button.getAttribute('data-user-email');

    if (!userId) {
        alert('ユーザーIDが見つかりません');
        return;
    }

    // 確認ダイアログ
    const confirmMessage = `本当にこのユーザーを削除しますか？\n\nメール: ${userEmail}\n\nこの操作は取り消せません。`;
    if (!confirm(confirmMessage)) {
        return;
    }

    // ボタンを無効化
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '削除中...';

    try {
        const response = await fetch(`${config.API_BASE_URL}/users/${userId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            alert('ユーザーを削除しました');

            // 行を削除（アニメーション効果付き）
            const row = button.closest('tr');
            if (row) {
                row.style.opacity = '0';
                row.style.transition = 'opacity 0.3s';
                setTimeout(() => {
                    row.remove();

                    // ユーザー数を更新
                    const h2 = document.querySelector('#userListContent h2');
                    if (h2) {
                        const currentCount = document.querySelectorAll('.user-list-table tbody tr').length;
                        h2.textContent = `ユーザー一覧（${currentCount}人）`;
                    }

                    // テーブルが空になった場合
                    if (currentCount === 0) {
                        loadUserList();
                    }
                }, 300);
            }
        } else {
            alert('ユーザーの削除に失敗しました: ' + (result.error || '不明なエラー'));
            button.disabled = false;
            button.textContent = originalText;
        }
    } catch (error) {
        console.error('ユーザー削除エラー:', error);
        alert('ユーザーの削除に失敗しました');
        button.disabled = false;
        button.textContent = originalText;
    }
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
        const response = await fetch(`${config.API_BASE_URL}/special-shifts`);
        const result = await response.json();

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
            <h2 style="margin-bottom: 20px;">特別シフト一覧（${specialShifts.length}件）</h2>
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
        const response = await fetch(`${config.API_BASE_URL}/special-shifts/${uuid}`, {
            method: 'DELETE'
        });

        const result = await response.json();

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
