// ui.js - タブ切り替え・メニュー制御モジュール

// タブを切り替える関数
function switchToTab(tabName) {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    // Remove active class from all buttons and contents
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));

    // Add active class to corresponding button and content
    // タブボタンのみにアクティブクラスを追加（モバイルメニュー項目は除外）
    const targetButton = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
    if (targetButton) {
        targetButton.classList.add('active');
    }

    const targetContent = document.getElementById(tabName);
    if (targetContent) {
        targetContent.classList.add('active');
    }

    // Load data for the selected tab
    if (tabName === 'capacity-settings') {
        loadCapacitySettings();
    } else if (tabName === 'my-shifts') {
        loadMyShifts();
    } else if (tabName === 'shift-list') {
        loadShiftList();
    } else if (tabName === 'shift-request') {
        loadShiftRequestForm();
    } else if (tabName === 'settings') {
        loadSettings();
    } else if (tabName === 'user-list') {
        loadUserList();
    } else if (tabName === 'special-shift-list') {
        loadSpecialShiftList();
    }

    // 現在のタブをlocalStorageに保存
    localStorage.setItem('currentTab', tabName);
}

// タブ切り替えのイベントリスナーをセットアップ
function setupTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-button');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            switchToTab(targetTab);
        });
    });
}

// タブの表示制御（管理者/一般ユーザー）
function updateTabVisibility() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const adminTabs = ['shift-list', 'capacity-settings', 'user-list', 'special-shift-list'];
    const userTabs = ['shift-request', 'my-shifts', 'settings'];  // シフト申請を最初に配置

    // まず全てのタブボタンとコンテンツをリセット
    tabButtons.forEach(button => {
        button.classList.remove('active');
        button.style.display = 'none';
    });
    tabContents.forEach(content => {
        content.classList.remove('active');
    });

    tabButtons.forEach(button => {
        const tabId = button.getAttribute('data-tab');

        if (isAdmin()) {
            // 管理者は管理者用タブのみ表示
            if (adminTabs.includes(tabId)) {
                button.style.display = 'inline-block';
            }
        } else {
            // 一般ユーザーは一般ユーザー用タブのみ表示
            if (userTabs.includes(tabId)) {
                button.style.display = 'inline-block';
            }
        }
    });

    // 最初に表示するタブを選択
    if (isAdmin()) {
        // 管理者は「シフト一覧」を最初に表示
        const shiftListBtn = document.querySelector('[data-tab="shift-list"]');
        if (shiftListBtn) {
            shiftListBtn.click();
        }
    } else {
        // 一般ユーザーは「シフト申請」を最初に表示
        const shiftRequestBtn = document.querySelector('[data-tab="shift-request"]');
        if (shiftRequestBtn) {
            shiftRequestBtn.click();
        }
    }
}

// モバイルメニューのセットアップ
function setupMobileMenu() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileMenuItems = document.querySelectorAll('.mobile-menu-item');

    // ハンバーガーボタンのクリックイベント
    hamburgerBtn.addEventListener('click', function() {
        hamburgerBtn.classList.toggle('active');
        mobileMenu.classList.toggle('active');

        // メニューを開く時に全てのアクティブクラスをリセット
        if (mobileMenu.classList.contains('active')) {
            mobileMenuItems.forEach(menuItem => {
                menuItem.classList.remove('active');
            });
        }
    });

    // モバイルメニュー項目のクリックイベント
    mobileMenuItems.forEach(item => {
        item.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');

            // タブを切り替え
            switchToTab(tabName);

            // メニューを閉じる
            hamburgerBtn.classList.remove('active');
            mobileMenu.classList.remove('active');

            // メニューを閉じる時にアクティブクラスをリセット
            mobileMenuItems.forEach(menuItem => {
                menuItem.classList.remove('active');
            });
        });
    });

    // メニュー外をクリックした時に閉じる
    document.addEventListener('click', function(event) {
        if (!mobileMenu.contains(event.target) && !hamburgerBtn.contains(event.target)) {
            hamburgerBtn.classList.remove('active');
            mobileMenu.classList.remove('active');

            // アクティブクラスをリセット
            mobileMenuItems.forEach(menuItem => {
                menuItem.classList.remove('active');
            });
        }
    });
}
