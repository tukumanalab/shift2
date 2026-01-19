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
document.addEventListener('DOMContentLoaded', function() {
    // タブ切り替えのセットアップ
    setupTabSwitching();

    // モバイルメニューのセットアップ
    setupMobileMenu();

    // Google Sign-In初期化
    google.accounts.id.initialize({
        client_id: getGoogleClientId(),
        callback: handleCredentialResponse,
        auto_select: false
    });

    google.accounts.id.renderButton(
        document.getElementById('signInDiv'),
        {
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            locale: 'ja_JP'
        }
    );

    console.log('アプリケーション初期化完了');
});
