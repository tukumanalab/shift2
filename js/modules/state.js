// state.js - グローバル状態管理モジュール

// 定数（config.jsから取得）
const GOOGLE_APPS_SCRIPT_URL = config.GOOGLE_APPS_SCRIPT_URL;
const GOOGLE_CLIENT_ID = config.GOOGLE_CLIENT_ID;
const AUTHORIZED_EMAILS = config.AUTHORIZED_EMAILS.split(',').map(email => email.trim());

// アプリケーション状態
const AppState = {
    // ユーザー情報
    currentUser: null,
    currentUserProfile: null,
    isAdminUser: false,

    // シフト関連
    currentUserShifts: [],
    scrollToShiftAfterLoad: null,

    // シフト申請関連
    currentShiftRequestDate: null,
    currentShiftCapacity: 0,
    currentShiftCounts: {},

    // 日付詳細モーダル関連
    currentDetailDateKey: null,
    selectedTimeSlots: [],

    // 特別シフト
    specialShifts: [],

    // 全シフトデータ（管理者用）
    allShiftsData: []
};

// Getter/Setter関数
function getCurrentUser() {
    return AppState.currentUser;
}

function setCurrentUser(user) {
    AppState.currentUser = user;
    // グローバルに保存（特別シフト機能で使用）
    window.currentUser = user;
}

function getCurrentUserProfile() {
    return AppState.currentUserProfile;
}

function setCurrentUserProfile(profile) {
    AppState.currentUserProfile = profile;
}

function isAdmin() {
    return AppState.isAdminUser;
}

function setIsAdmin(value) {
    AppState.isAdminUser = value;
}

function getCurrentUserShifts() {
    return AppState.currentUserShifts;
}

function setCurrentUserShifts(shifts) {
    AppState.currentUserShifts = shifts;
}

function getScrollToShiftAfterLoad() {
    return AppState.scrollToShiftAfterLoad;
}

function setScrollToShiftAfterLoad(scrollInfo) {
    AppState.scrollToShiftAfterLoad = scrollInfo;
}

function getCurrentShiftRequestDate() {
    return AppState.currentShiftRequestDate;
}

function setCurrentShiftRequestDate(date) {
    AppState.currentShiftRequestDate = date;
}

function getCurrentShiftCapacity() {
    return AppState.currentShiftCapacity;
}

function setCurrentShiftCapacity(capacity) {
    AppState.currentShiftCapacity = capacity;
}

function getCurrentShiftCounts() {
    return AppState.currentShiftCounts;
}

function setCurrentShiftCounts(counts) {
    AppState.currentShiftCounts = counts;
}

function getCurrentDetailDateKey() {
    return AppState.currentDetailDateKey;
}

function setCurrentDetailDateKey(dateKey) {
    AppState.currentDetailDateKey = dateKey;
}

function getSelectedTimeSlots() {
    return AppState.selectedTimeSlots;
}

function setSelectedTimeSlots(slots) {
    AppState.selectedTimeSlots = slots;
}

function getSpecialShifts() {
    return AppState.specialShifts;
}

function setSpecialShifts(shifts) {
    AppState.specialShifts = shifts;
}

function getAllShiftsData() {
    return AppState.allShiftsData;
}

function setAllShiftsData(shifts) {
    AppState.allShiftsData = shifts;
    // グローバルに保存（カレンダー機能で使用）
    window.allShiftsData = shifts;
}

function getGoogleAppsScriptUrl() {
    return GOOGLE_APPS_SCRIPT_URL;
}

function getGoogleClientId() {
    return GOOGLE_CLIENT_ID;
}

function getAuthorizedEmails() {
    return AUTHORIZED_EMAILS;
}

function resetState() {
    AppState.currentUser = null;
    AppState.currentUserProfile = null;
    AppState.isAdminUser = false;
    AppState.currentUserShifts = [];
    AppState.scrollToShiftAfterLoad = null;
    AppState.currentShiftRequestDate = null;
    AppState.currentShiftCapacity = 0;
    AppState.currentShiftCounts = {};
    AppState.currentDetailDateKey = null;
    AppState.selectedTimeSlots = [];
    AppState.specialShifts = [];
    AppState.allShiftsData = [];
    window.currentUser = null;
    window.allShiftsData = [];
}
