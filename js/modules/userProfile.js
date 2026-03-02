// userProfile.js - ユーザープロフィール管理モジュール

/**
 * ユーザープロフィールを読み込む関数
 * APIからユーザープロフィールを取得してキャッシュに保存
 */
async function loadUserProfile() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        return;
    }

    try {
        const result = await API.getUserProfile(currentUser.sub);

        if (result.success && result.data) {
            setCurrentUserProfile(result.data);
            console.log('ユーザープロフィールをキャッシュに保存しました:', result.data);

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

/**
 * ユーザー設定を読み込む関数
 * キャッシュまたはローカルストレージから設定値を取得してフォームと表示モードに表示
 */
function loadSettings() {
    // フィールドを初期化
    document.getElementById('realName').value = '';
    document.getElementById('nickname').value = '';
    document.getElementById('display-real-name').textContent = '未設定';
    document.getElementById('display-nickname').textContent = '未設定';

    const currentUserProfile = getCurrentUserProfile();

    // キャッシュされたプロフィールデータを使用
    if (currentUserProfile) {
        const realName = currentUserProfile.real_name || currentUserProfile.realName;
        if (realName) {
            document.getElementById('realName').value = realName;
            document.getElementById('display-real-name').textContent = realName;
        }
        if (currentUserProfile.nickname) {
            document.getElementById('nickname').value = currentUserProfile.nickname;
            document.getElementById('display-nickname').textContent = currentUserProfile.nickname;
        }
    } else {
        // キャッシュがない場合はローカルストレージから読み込み
        const realName = localStorage.getItem('userRealName');
        const nickname = localStorage.getItem('userNickname');

        if (realName) {
            document.getElementById('realName').value = realName;
            document.getElementById('display-real-name').textContent = realName;
        }
        if (nickname) {
            document.getElementById('nickname').value = nickname;
            document.getElementById('display-nickname').textContent = nickname;
        }
    }
}

/**
 * プロフィール入力状況をチェックして通知を表示する関数
 * 本名またはニックネームが未入力の場合に通知を表示
 */
function checkProfileCompleteness() {
    const currentUser = getCurrentUser();
    const isAdminUser = isAdmin();

    if (!currentUser || isAdminUser) {
        return; // 管理者は通知不要
    }

    const currentUserProfile = getCurrentUserProfile();
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

/**
 * プロフィール入力促進通知を表示する関数
 */
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

/**
 * プロフィール入力促進通知を非表示にする関数
 */
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

