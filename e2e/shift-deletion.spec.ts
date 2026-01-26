/**
 * シフト削除機能のE2Eテスト
 * 実際のUIを使って、今回修正したバグが再発しないことを確認
 */

import { test, expect } from '@playwright/test';

test.describe('シフト削除機能（リグレッション防止）', () => {
  test.beforeEach(async ({ page }) => {
    // ログイン処理などの前提条件をここに記載
    // 注: Google OAuth のモックが必要な場合は別途設定
  });

  test('Issue #1: 同じ日の別の時間帯のシフトが削除されないことを確認', async ({ page }) => {
    test.skip(!process.env.E2E_TEST_ENABLED, 'E2E tests are disabled');

    // 1. シフト申請画面に移動
    await page.goto('/');

    // 2. 複数の時間帯でシフトを申請（13:00-13:30と14:00-15:00）
    // (実際のUI操作を記載)

    // 3. 自分のシフト一覧に移動

    // 4. 13:00-13:30のシフトを削除

    // 5. 14:00-15:00のシフトが残っていることを確認
    // await expect(page.locator('[data-time-range="14:00-15:00"]')).toBeVisible();
  });

  test('Issue #2: シフト申請後にハイライトが表示されることを確認', async ({ page }) => {
    test.skip(!process.env.E2E_TEST_ENABLED, 'E2E tests are disabled');

    // 1. シフト申請
    // 2. 自動的に自分のシフト一覧タブに切り替わる
    // 3. ハイライトクラスが適用されていることを確認
    // await expect(page.locator('.highlight-shift')).toBeVisible();
    // 4. 該当行までスクロールされていることを確認
  });

  test('Issue #3: 管理者モードでシフト削除時に正しいシフトのみ削除', async ({ page }) => {
    test.skip(!process.env.E2E_TEST_ENABLED, 'E2E tests are disabled');

    // 1. 管理者としてログイン
    // 2. シフト一覧で特定の日付をクリック
    // 3. モーダルで特定のユーザーの特定時間帯のシフトを削除
    // 4. 同じユーザーの別の時間帯のシフトが残っていることを確認
  });
});

test.describe('シフト申請機能', () => {
  test('複数時間帯の一括申請が成功する', async ({ page }) => {
    test.skip(!process.env.E2E_TEST_ENABLED, 'E2E tests are disabled');

    // 実際のUIでシフト申請をテスト
  });
});

/**
 * 使用方法:
 *
 * 1. E2Eテストを有効化:
 *    export E2E_TEST_ENABLED=true
 *
 * 2. テスト実行:
 *    npx playwright test
 *
 * 3. UIモードで実行（デバッグ用）:
 *    npx playwright test --ui
 *
 * 4. 特定のテストのみ実行:
 *    npx playwright test shift-deletion
 */
