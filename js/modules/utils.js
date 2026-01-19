// utils.js - ユーティリティ関数モジュール

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
    const currentUserProfile = getCurrentUserProfile();
    const currentUser = getCurrentUser();

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

// HTML文字列をエスケープする関数
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 日時をフォーマットする関数
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

// 時間をJSTに変換する関数
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

// 時間範囲を30分単位のスロットに展開する関数
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

// 日付が申請可能かどうかを判定する関数
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

// デフォルトの容量を取得する関数（曜日別）
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

// 現在のユーザーデータを取得する関数
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
