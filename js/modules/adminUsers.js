// adminUsers.js - 管理者用ユーザー管理モジュール

/**
 * ユーザー一覧を読み込んで表示
 */
async function loadUserList() {
    const userListContent = document.getElementById('userListContent');

    if (!userListContent) {
        console.error('userListContent element not found');
        return;
    }

    // ローディング表示
    userListContent.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <div class="loading-text">ユーザー一覧を読み込み中...</div>
        </div>
    `;

    try {
        // バックエンドAPIからユーザー一覧を取得
        const result = await API.getAllUsers();

        if (!result.success) {
            throw new Error(result.error || 'ユーザー一覧の取得に失敗しました');
        }

        const users = result.data || [];

        // ユーザー一覧を表示
        displayUserList(users);

    } catch (error) {
        console.error('ユーザー一覧の読み込みエラー:', error);
        userListContent.innerHTML = `
            <div class="error-message">
                <p>ユーザー一覧の読み込みに失敗しました</p>
                <p style="font-size: 14px; color: #666;">${error.message}</p>
                <button onclick="loadUserList()" class="retry-btn">再試行</button>
            </div>
        `;
    }
}

/**
 * ユーザー一覧を表示
 */
function displayUserList(users) {
    const userListContent = document.getElementById('userListContent');

    if (!userListContent) {
        return;
    }

    if (!users || users.length === 0) {
        userListContent.innerHTML = `
            <div class="user-list-container">
                <p style="text-align: center; color: #666; padding: 40px;">
                    登録されているユーザーはいません
                </p>
            </div>
        `;
        return;
    }

    // テーブルを生成
    const tableHTML = `
        <div class="user-list-container">
            <h2 style="margin-bottom: 20px;">ユーザー一覧（${users.length}人）</h2>
            <table class="user-list-table">
                <thead>
                    <tr>
                        <th>プロフィール</th>
                        <th>ニックネーム</th>
                        <th>本名</th>
                        <th>メールアドレス</th>
                        <th>登録日時</th>
                        <th>最終更新</th>
                        <th style="width: 100px;">操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(user => `
                        <tr data-user-id="${escapeHtml(user.user_id)}">
                            <td>
                                <span>${escapeHtml(user.name)}</span>
                            </td>
                            <td>${escapeHtml(user.nickname || '-')}</td>
                            <td>${escapeHtml(user.real_name || '-')}</td>
                            <td>${escapeHtml(user.email)}</td>
                            <td>${formatDateTime(user.created_at)}</td>
                            <td>${formatDateTime(user.updated_at)}</td>
                            <td>
                                <button class="delete-user-btn" data-user-id="${escapeHtml(user.user_id)}" data-user-email="${escapeHtml(user.email)}">
                                    削除
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    userListContent.innerHTML = tableHTML;

    // 削除ボタンのイベントリスナーを設定
    const deleteButtons = userListContent.querySelectorAll('.delete-user-btn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', handleDeleteUser);
    });
}

/**
 * ユーザー削除ハンドラ
 */
async function handleDeleteUser(event) {
    const button = event.target;
    const userId = button.getAttribute('data-user-id');
    const userEmail = button.getAttribute('data-user-email');

    if (!userId) {
        alert('ユーザーIDが見つかりません');
        return;
    }

    // 確認ダイアログ
    const confirmMessage = `本当にこのユーザーを削除しますか？\n\nメール: ${userEmail}\n\nこの操作は取り消せません。`;
    if (!confirm(confirmMessage)) {
        return;
    }

    // ボタンを無効化
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '削除中...';

    try {
        const result = await API.deleteUser(userId);

        if (result.success) {
            alert('ユーザーを削除しました');

            // 行を削除（アニメーション効果付き）
            const row = button.closest('tr');
            if (row) {
                row.style.opacity = '0';
                row.style.transition = 'opacity 0.3s';
                setTimeout(() => {
                    row.remove();

                    // ユーザー数を更新
                    const h2 = document.querySelector('#userListContent h2');
                    if (h2) {
                        const currentCount = document.querySelectorAll('.user-list-table tbody tr').length;
                        h2.textContent = `ユーザー一覧（${currentCount}人）`;
                    }

                    // テーブルが空になった場合
                    if (currentCount === 0) {
                        loadUserList();
                    }
                }, 300);
            }
        } else {
            alert('ユーザーの削除に失敗しました: ' + (result.error || '不明なエラー'));
            button.disabled = false;
            button.textContent = originalText;
        }
    } catch (error) {
        console.error('ユーザー削除エラー:', error);
        alert('ユーザーの削除に失敗しました');
        button.disabled = false;
        button.textContent = originalText;
    }
}

/**
 * ユーザー情報をスプレッドシートに保存（SQLite + GAS連携）
 */
async function saveUserToSpreadsheet(userData) {
    if (!userData) {
        return;
    }

    try {
        console.log('ユーザー情報をSQLiteに保存中...');

        const userInfo = {
            sub: userData.sub,
            name: userData.name,
            email: userData.email,
            picture: userData.picture
        };

        const response = await fetch(`${config.API_BASE_URL}/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userInfo)
        });

        const result = await response.json();

        if (result.success) {
            console.log('ユーザー情報を保存しました:', result.data);
        } else {
            console.error('ユーザー情報の保存エラー:', result.error);
        }

    } catch (error) {
        console.error('ユーザー情報の保存に失敗しました:', error);
        // エラーが発生してもアプリケーションの動作は継続
    }
}
