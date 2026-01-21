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
        await API.syncAllShiftsToCalendar(currentUser.sub);

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

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', async function() {
    // サーバーから設定を読み込む
    await loadConfig();

    // タブ切り替えのセットアップ
    setupTabSwitching();

    // モバイルメニューのセットアップ
    setupMobileMenu();

    // Google Sign-InのClient IDを動的に設定
    const gIdOnload = document.getElementById('g_id_onload');
    if (gIdOnload) {
        gIdOnload.setAttribute('data-client_id', getGoogleClientId());
        console.log('Google Client ID設定完了');
    }

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
