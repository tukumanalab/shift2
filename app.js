// app.js - アプリケーションエントリーポイント
// 各機能はモジュール化され、js/modulesディレクトリに配置されています

// カレンダー同期機能（特定のモジュールに属さない独立した関数）
async function syncAllShiftsToCalendar() {
    const currentUser = getCurrentUser();
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
        await API.syncAllShiftsToCalendar();

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

// カレンダーのすべての予定を削除
async function deleteAllCalendarEvents() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        alert('ログインが必要です。');
        return;
    }

    // 確認ダイアログを表示
    const confirmDelete = confirm('本当にGoogleカレンダーのすべての予定を削除しますか？\n\n⚠️ 警告: この操作は元に戻せません。\nカレンダー上のすべてのシフトイベントが削除されます。');
    if (!confirmDelete) {
        return;
    }

    // 二重確認
    const doubleConfirm = confirm('最終確認: 本当に削除しますか？\n削除後は「Googleカレンダーと同期し直す」ボタンで再同期できます。');
    if (!doubleConfirm) {
        return;
    }

    const deleteBtn = document.getElementById('deleteAllBtn');
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'クリア中...';

    try {
        const result = await API.deleteAllCalendarEvents();

        console.log('カレンダーからすべてのイベントを削除しました:', result);
        alert(`カレンダーから${result.deleted || 0}件のイベントを削除しました。`);

    } catch (error) {
        console.error('削除に失敗しました:', error);
        alert('削除に失敗しました。再度お試しください。');
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Googleカレンダーをクリア';
    }
}

// Google Sign-Inを初期化
function initializeGoogleSignIn() {
    const clientId = getGoogleClientId();
    if (!clientId) {
        console.error('Google Client IDが設定されていません');
        return;
    }

    // Google Sign-In SDKが読み込まれるまで待機
    if (typeof google === 'undefined' || !google.accounts) {
        console.log('Google Sign-In SDKを待機中...');
        setTimeout(initializeGoogleSignIn, 100);
        return;
    }

    // Google Sign-Inを初期化
    google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: false
    });

    // ログインボタンをレンダリング
    google.accounts.id.renderButton(
        document.querySelector('.g_id_signin'),
        { theme: 'outline', size: 'medium', text: 'signin_with' }
    );

    console.log('Google Sign-In初期化完了');
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', async function() {
    // サーバーから設定を読み込む
    await loadConfig();

    // タブ切り替えのセットアップ
    setupTabSwitching();

    // モバイルメニューのセットアップ
    setupMobileMenu();

    // Google Sign-Inを初期化
    initializeGoogleSignIn();

    // localStorageから保存されたログイン情報を読み込んで自動ログイン
    const savedUserProfile = localStorage.getItem('userProfile');
    const savedIsAdminUser = localStorage.getItem('isAdminUser');

    if (savedUserProfile) {
        try {
            const profileData = JSON.parse(savedUserProfile);
            setIsAdmin(savedIsAdminUser === 'true');

            console.log('=== 自動ログイン ===');
            console.log('User Email:', profileData.email);
            console.log('User Type:', isAdmin() ? '管理者' : '一般ユーザー');
            console.log('===================');

            showProfile(profileData);
        } catch (error) {
            console.error('保存されたログイン情報の読み込みに失敗しました:', error);
            localStorage.removeItem('userProfile');
            localStorage.removeItem('isAdminUser');
            localStorage.removeItem('currentTab');
        }
    }

    console.log('アプリケーション初期化完了');
});
