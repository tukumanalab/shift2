// api.js - API呼び出し抽象化モジュール

const API = {
    // ===== ユーザー関連API =====

    // ユーザープロフィール取得
    async getUserProfile(userId) {
        const response = await fetch(`${config.API_BASE_URL}/users/${userId}/profile`);
        return await response.json();
    },

    // ユーザープロフィール更新
    async updateUserProfile(userId, profileData) {
        const response = await fetch(`${config.API_BASE_URL}/users/${userId}/profile`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(profileData)
        });
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
        const response = await fetch(`${config.API_BASE_URL}/shifts?userId=${userId}`);
        return await response.json();
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

    // シフト申請者数カウント取得
    async getShiftCounts() {
        const response = await fetch(`${config.API_BASE_URL}/shifts/counts`);
        return await response.json();
    },

    // ===== 容量設定関連API =====

    // 容量設定取得
    async getCapacitySettings() {
        const response = await fetch(`${config.API_BASE_URL}/capacity-settings`);
        return await response.json();
    },

    // 容量一括保存
    async saveCapacitySettings(capacityData) {
        const response = await fetch(`${config.API_BASE_URL}/capacity-settings/bulk`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(capacityData)
        });
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

    // ===== Google Apps Script API =====

    // カレンダー同期（全シフト）
    async syncAllShiftsToCalendar(userId) {
        const response = await fetch(`${this.baseURL}/calendar/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        const data = await response.json();
        return data;
    },

    // ユーザー情報保存（GAS）
    async saveUserToSpreadsheet(userData) {
        await fetch(getGoogleAppsScriptUrl(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            mode: 'no-cors',
            body: JSON.stringify({
                type: 'saveUser',
                userData: userData
            })
        });
        // no-corsモードのため、レスポンスは取得できない
        return { success: true };
    }
};
