// auth.js - 認証・ログイン/ログアウト処理モジュール

// Google OAuth認証レスポンスハンドラ
function handleCredentialResponse(response) {
    const responsePayload = decodeJwtResponse(response.credential);

    // Check if email is authorized admin
    const isAdmin = getAuthorizedEmails().includes(responsePayload.email);
    setIsAdmin(isAdmin);

    // ログインモードをコンソールに表示
    console.log('=== Google Login Information ===');
    console.log('User Email:', responsePayload.email);
    console.log('User Type:', isAdmin ? '管理者' : '一般ユーザー');
    console.log('================================');

    showProfile(responsePayload);
}

// JWTトークンをデコードする関数
function decodeJwtResponse(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
}

// プロフィール表示とログイン後の初期化
async function showProfile(profileData) {
    setCurrentUser(profileData);

    // ユーザーをDBに登録（既存の場合は取得のみ）
    try {
        await fetch(`${config.API_BASE_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sub: profileData.sub,
                name: profileData.name,
                email: profileData.email,
                picture: profileData.picture
            })
        });
    } catch (error) {
        console.error('ユーザー登録エラー:', error);
    }

    // ログイン状態をlocalStorageに保存
    localStorage.setItem('userProfile', JSON.stringify(profileData));
    localStorage.setItem('isAdminUser', isAdmin());

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
        mobileSettingsItem.style.display = isAdmin() ? 'none' : 'block';
    }

    // タブの表示制御
    updateTabVisibility();

    // 初回データロード
    if (isAdmin()) {
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
        displayMyShifts(document.getElementById('myShiftsContent'), getCurrentUserShifts());

        // 特別シフト募集お知らせを表示
        displaySpecialShiftAnnouncement();
    }

    // 保存されたタブがあれば復元
    const savedTab = localStorage.getItem('currentTab');
    if (savedTab) {
        // タブが存在し、かつボタンが表示されているかチェック
        const tabButton = document.querySelector(`.tab-button[data-tab="${savedTab}"]`);
        const tabContent = document.getElementById(savedTab);
        if (tabButton && tabContent && tabButton.style.display !== 'none') {
            switchToTab(savedTab);
        }
    }
}

// ログアウト処理
function signOut() {
    google.accounts.id.disableAutoSelect();

    resetState();

    // localStorageからログイン情報をクリア
    localStorage.removeItem('userProfile');
    localStorage.removeItem('isAdminUser');
    localStorage.removeItem('currentTab');

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
