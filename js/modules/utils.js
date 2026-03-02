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

// 日付を曜日付きでフォーマットする関数 (YYYY/MM/DD (曜))
function formatDateWithWeekday(dateString) {
    if (!dateString) return '-';

    try {
        const date = new Date(dateString);
        const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const weekday = weekdays[date.getDay()];

        // 日曜日は赤、土曜日は青
        const colorClass = weekday === '日' ? 'sunday' : (weekday === '土' ? 'saturday' : '');

        if (colorClass) {
            return `${year}/${month}/${day} <span class="${colorClass}">(${weekday})</span>`;
        }

        return `${year}/${month}/${day} (${weekday})`;
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
    // 個人ごとにグループ化（時間帯とUUIDのマッピングを保持）
    const shiftsByPerson = {};
    shiftsForDate.forEach(shift => {
        const personKey = `${getShiftDisplayName(shift)}_${shift.userEmail || shift.email}`;
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
