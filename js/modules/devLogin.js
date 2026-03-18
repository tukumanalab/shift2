// devLogin.js - 開発環境用ログインバイパスモジュール
// ⚠️ このモジュールはlocalhost環境でのみ動作します

const DEV_MODE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

/**
 * 開発用ログインUIをセットアップする
 * localhostの場合のみログイン画面に開発用ボタンを追加する
 */
function setupDevLogin() {
    if (!DEV_MODE) return;

    const loginPrompt = document.getElementById('loginPrompt');
    if (!loginPrompt) return;

    const devPanel = document.createElement('div');
    devPanel.id = 'devLoginPanel';
    devPanel.style.cssText = `
        margin-top: 30px;
        padding: 16px 20px;
        background: #fff8e1;
        border: 2px dashed #f9a825;
        border-radius: 8px;
        display: inline-block;
        text-align: center;
        max-width: 320px;
    `;
    devPanel.innerHTML = `
        <p style="margin: 0 0 10px; font-size: 13px; color: #f57f17; font-weight: bold;">
            🛠️ 開発環境用ログイン
        </p>
        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
            <button onclick="devLoginAsAdmin()" style="
                padding: 8px 16px;
                background: #1565c0;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
            ">管理者でログイン</button>
            <button onclick="devLoginAsUser()" style="
                padding: 8px 16px;
                background: #2e7d32;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
            ">一般ユーザーでログイン</button>
        </div>
    `;

    loginPrompt.appendChild(devPanel);
}

/**
 * 開発用: 管理者としてログインする
 * AUTHORIZED_EMAILS の最初のメールアドレスを使用
 */
async function devLoginAsAdmin() {
    if (!DEV_MODE) return;

    const adminEmail = getAuthorizedEmails()[0] || 'admin@example.com';
    const mockProfile = {
        sub: 'dev-admin-001',
        name: '管理者（開発用）',
        email: adminEmail,
        picture: 'https://ui-avatars.com/api/?name=Admin&background=1565c0&color=fff&size=64',
    };

    setIsAdmin(true);
    await showProfile(mockProfile);
}

/**
 * 開発用: 一般ユーザーとしてログインする
 */
async function devLoginAsUser() {
    if (!DEV_MODE) return;

    const mockProfile = {
        sub: 'dev-user-001',
        name: '一般ユーザー（開発用）',
        email: 'dev-user@example.com',
        picture: 'https://ui-avatars.com/api/?name=User&background=2e7d32&color=fff&size=64',
    };

    setIsAdmin(false);
    await showProfile(mockProfile);
}
