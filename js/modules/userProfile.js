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
            console.log('設定を保存:', { realName, nickname });

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

/**
 * プロフィール編集モードを切り替える関数
 */
function toggleProfileEditMode() {
    const displayElement = document.getElementById('profile-display');
    const editElement = document.getElementById('profile-edit');
    const realNameValue = document.getElementById('display-real-name');
    const nicknameValue = document.getElementById('display-nickname');
    const realNameInput = document.getElementById('realName');
    const nicknameInput = document.getElementById('nickname');

    if (displayElement && editElement) {
        // 現在の値を編集用入力フィールドにセット
        realNameInput.value = realNameValue.textContent !== '未設定' ? realNameValue.textContent : '';
        nicknameInput.value = nicknameValue.textContent !== '未設定' ? nicknameValue.textContent : '';

        // 表示を切り替え
        displayElement.style.display = 'none';
        editElement.style.display = 'block';

        // 入力フィールドにフォーカス
        realNameInput.focus();
    }
}

/**
 * インライン編集でプロフィールを保存する関数
 */
async function saveProfileInline() {
    const realName = document.getElementById('realName').value;
    const nickname = document.getElementById('nickname').value;
    const currentUser = getCurrentUser();

    if (!currentUser) {
        alert('ログインしてください');
        return;
    }

    // ボタンを無効化
    const saveBtn = document.querySelector('.save-profile-btn');
    const cancelBtn = document.querySelector('.cancel-profile-btn');
    saveBtn.disabled = true;
    cancelBtn.disabled = true;

    try {
        // APIに保存
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
            // 表示モードの値を更新
            document.getElementById('display-real-name').textContent = realName || '未設定';
            document.getElementById('display-nickname').textContent = nickname || '未設定';

            // キャッシュを更新
            setCurrentUserProfile({
                real_name: realName,
                nickname: nickname
            });

            // ローカルストレージにも保存
            localStorage.setItem('userRealName', realName);
            localStorage.setItem('userNickname', nickname);

            // ヘッダーの表示名を更新
            updateHeaderDisplayName();

            // プロフィール入力状況を再チェック
            checkProfileCompleteness();

            // 表示モードに戻る
            document.getElementById('profile-display').style.display = 'block';
            document.getElementById('profile-edit').style.display = 'none';

            console.log('プロフィールを保存:', { realName, nickname });
        } else {
            alert('プロフィールの保存に失敗しました: ' + (result.error || '不明なエラー'));
        }
    } catch (error) {
        console.error('プロフィールの保存に失敗:', error);
        alert('プロフィールの保存に失敗しました');
    } finally {
        // ボタンを再度有効化
        saveBtn.disabled = false;
        cancelBtn.disabled = false;
    }
}

/**
 * プロフィール編集をキャンセルする関数
 */
function cancelProfileEdit() {
    const displayElement = document.getElementById('profile-display');
    const editElement = document.getElementById('profile-edit');

    if (displayElement && editElement) {
        // 表示モードに戻る
        displayElement.style.display = 'block';
        editElement.style.display = 'none';
    }
}
