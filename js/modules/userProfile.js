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
 * ユーザー設定を保存する関数
 * ニックネームと本名をAPIに送信して更新
 */
async function saveSettings() {
    const realName = document.getElementById('realName').value;
    const nickname = document.getElementById('nickname').value;

    const currentUser = getCurrentUser();
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
            setCurrentUserProfile({
                real_name: realName,
                nickname: nickname
            });

            // ローカルストレージにも保存
            localStorage.setItem('userRealName', realName);
            localStorage.setItem('userNickname', nickname);

            alert('設定を保存しました');

            // ヘッダーの表示名を更新
            updateHeaderDisplayName();

            // プロフィール入力状況を再チェック
            checkProfileCompleteness();
        } else {
            alert('設定の保存に失敗しました: ' + (result.error || '不明なエラー'));
        }
    } catch (error) {
        console.error('設定の保存に失敗:', error);
        alert('設定の保存に失敗しました');
    } finally {
        // ボタンを再度有効化
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

/**
 * ユーザー設定を読み込む関数
 * キャッシュまたはローカルストレージから設定値を取得してフォームに表示
 */
function loadSettings() {
    // フィールドを初期化
    document.getElementById('realName').value = '';
    document.getElementById('nickname').value = '';

    const currentUserProfile = getCurrentUserProfile();

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

/**
 * 設定タブを開く関数
 * プロフィール通知からの遷移に使用
 */
function openSettingsTab() {
    const settingsTab = document.querySelector('[data-tab="settings"]');
    if (settingsTab) {
        settingsTab.click();
    }
}
