// アプリケーション設定
// このファイルは起動時にサーバーから設定を取得して更新されます
const config = {
    // サーバーから取得する設定（初期値）
    GOOGLE_CLIENT_ID: '',
    AUTHORIZED_EMAILS: '',

    // サーバーURL（静的設定）
    API_BASE_URL: (() => {
      const currentPath = window.location.pathname;
      const basePath = currentPath.substring(0, currentPath.lastIndexOf('/'));
      return window.location.origin + basePath + '/api';
    })(),

    // レガシー（後方互換性のため残す）
    GOOGLE_APPS_SCRIPT_URL: ''
};

// サーバーから設定を取得
async function loadConfig() {
    try {
        const response = await fetch(`${config.API_BASE_URL}/config`);
        const result = await response.json();

        if (result.success && result.data) {
            config.GOOGLE_CLIENT_ID = result.data.googleClientId;
            config.AUTHORIZED_EMAILS = result.data.authorizedEmails;
            config.GOOGLE_APPS_SCRIPT_URL = result.data.googleAppsScriptUrl || '';

            console.log('✅ 設定をサーバーから読み込みました');
            return true;
        } else {
            console.error('設定の読み込みに失敗しました:', result);
            return false;
        }
    } catch (error) {
        console.error('設定の読み込みエラー:', error);
        return false;
    }
}
