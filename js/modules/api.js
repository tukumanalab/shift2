// api.js - API呼び出し抽象化モジュール

const API = {
    // ===== ユーザー関連API =====

    // ユーザープロフィール取得
    async getUserProfile(userId) {
        const response = await fetch(`${config.API_BASE_URL}/users/${userId}/profile`);
        return await response.json();
    },

    // ユーザー一覧取得
    async getAllUsers() {
        const response = await fetch(`${config.API_BASE_URL}/users`);
        return await response.json();
    },

    // ユーザー削除
    async deleteUser(userId) {
        const response = await fetch(`${config.API_BASE_URL}/users/${userId}`, {
            method: 'DELETE'
        });
        return await response.json();
    },

    // ===== シフト関連API =====

    // 全シフト取得
    async getAllShifts() {
        const response = await fetch(`${config.API_BASE_URL}/shifts`);
        return await response.json();
    },

    // ユーザーシフト取得
    async getUserShifts(userId) {
        try {
            const response = await fetch(`${config.API_BASE_URL}/shifts?userId=${userId}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('[API.getUserShifts] エラー発生:', error);
            throw error;
        }
    },

    // 日付別シフト取得
    async getShiftsByDate(date) {
        const response = await fetch(`${config.API_BASE_URL}/shifts?date=${date}`);
        return await response.json();
    },

    // 単一シフト削除
    async deleteShift(uuid) {
        const response = await fetch(`${config.API_BASE_URL}/shifts/${uuid}`, {
            method: 'DELETE'
        });
        return await response.json();
    },

    // 複数シフト削除
    async deleteMultipleShifts(uuids) {
        const response = await fetch(`${config.API_BASE_URL}/shifts/delete-multiple`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ uuids })
        });
        return await response.json();
    },

    // 複数シフト登録
    async createMultipleShifts(shiftsData) {
        const response = await fetch(`${config.API_BASE_URL}/shifts/multiple`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(shiftsData)
        });
        return await response.json();
    },

    // ===== 容量設定関連API =====

    // 容量設定取得
    async getCapacitySettings() {
        const response = await fetch(`${config.API_BASE_URL}/capacity-settings`);
        return await response.json();
    },

    // ===== 特別シフト関連API =====

    // 特別シフト一覧取得
    async getAllSpecialShifts() {
        const response = await fetch(`${config.API_BASE_URL}/special-shifts`);
        return await response.json();
    },

    // 日付別特別シフト取得
    async getSpecialShiftsByDate(date) {
        const response = await fetch(`${config.API_BASE_URL}/special-shifts?date=${date}`);
        return await response.json();
    },

    // 特別シフト登録
    async createSpecialShift(shiftData) {
        const response = await fetch(`${config.API_BASE_URL}/special-shifts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(shiftData)
        });
        return await response.json();
    },

    // 特別シフト削除
    async deleteSpecialShift(uuid) {
        const response = await fetch(`${config.API_BASE_URL}/special-shifts/${uuid}`, {
            method: 'DELETE'
        });
        return await response.json();
    },

    // 特別シフトに申請
    async applyForSpecialShift(specialShiftUuid, userData) {
        const response = await fetch(`${config.API_BASE_URL}/special-shifts/${specialShiftUuid}/apply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: userData.user_id,
                user_name: userData.user_name,
                time_slot: userData.time_slot
            })
        });
        return await response.json();
    },

    // 特別シフトの申請一覧取得
    async getSpecialShiftApplications(specialShiftUuid) {
        const response = await fetch(`${config.API_BASE_URL}/special-shifts/${specialShiftUuid}/applications`);
        return await response.json();
    },

    // 全特別シフト申請を日付情報付きで取得（シフト一覧表示用）
    async getAllSpecialShiftApplications(userId) {
        const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
        const response = await fetch(`${config.API_BASE_URL}/special-shifts/applications${query}`);
        return await response.json();
    },

    // 特別シフト申請をキャンセル
    async cancelSpecialShiftApplication(appUuid) {
        const response = await fetch(`${config.API_BASE_URL}/special-shifts/applications/${appUuid}`, {
            method: 'DELETE'
        });
        return await response.json();
    },

    // ===== Calendar API =====

    // カレンダー同期（全シフト）
    async syncAllShiftsToCalendar() {
        // タイムアウトを10分に設定（大量のシフト同期に時間がかかるため）
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10分

        try {
            const response = await fetch(`${config.API_BASE_URL}/calendar/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    },

    // カレンダーのすべてのイベントを削除
    async deleteAllCalendarEvents() {
        // タイムアウトを5分に設定
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5分

        try {
            const response = await fetch(`${config.API_BASE_URL}/calendar/all`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    },

    // 指定日のカレンダーイベントを削除して再同期
    async cleanAndResyncCalendarDate(date) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5分

        try {
            const response = await fetch(`${config.API_BASE_URL}/calendar/clean-date`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ date }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
};
