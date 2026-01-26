# テストガイド

このドキュメントでは、デグレ（リグレッション）を防ぐための自動テストの実行方法を説明します。

## テストの種類

### 1. ユニットテスト（Unit Tests）

フロントエンドとバックエンドの個別の関数やモジュールをテストします。

```bash
# 全てのユニットテストを実行
npm test

# ウォッチモードで実行（ファイル変更時に自動再実行）
npm run test:watch

# カバレッジレポート付きで実行
npm run test:coverage
```

#### フロントエンドのテスト
- `test/shift-application.test.js`: シフト申請機能
- `test/shift-delete-functions.test.js`: シフト削除機能
- `test/shift-list-loading.test.js`: **シフト一覧読み込み機能（未定義関数エラー防止）**
- `test/regression-bugs.test.js`: **過去のバグの再発防止テスト**

#### バックエンドのテスト
- `server/src/__tests__/CalendarService.test.ts`: カレンダーサービス

```bash
# バックエンドのテストのみ実行
npm run test:backend
```

### 2. E2Eテスト（End-to-End Tests）

実際のブラウザを使って、UIの動作をテストします。

```bash
# E2Eテストを実行（環境変数を設定）
E2E_TEST_ENABLED=true npm run test:e2e

# UIモードで実行（デバッグに便利）
npm run test:e2e:ui

# 全てのテストを実行（ユニット + E2E）
npm run test:all
```

**注意**: E2Eテストは現在スキップされています。`E2E_TEST_ENABLED=true`を設定すると有効化されます。

#### E2Eテストファイル
- `e2e/shift-deletion.spec.ts`: シフト削除機能のE2Eテスト
- `e2e/shift-list-loading.spec.ts`: **シフト一覧読み込みのE2Eテスト（コンソールエラー検出）**

## リグレッション防止テスト

過去に発見されたバグが再発しないことを確認するテストです。

### Issue #1: シフト削除時に他のシフトも削除される問題

**問題**: 同じ日の13:00-13:30を削除すると、14:00-15:00も誤って削除されていた。

**テスト内容**:
- `mergeShiftsByPerson`が連続する時間帯のみUUIDをグループ化することを確認
- 削除時に同じ`calendar_event_id`の関連シフトのみ取得することを確認

**実行**:
```bash
npm test -- regression-bugs
```

### Issue #2: シフト申請後のハイライトが表示されない問題

**問題**: シフト申請後、自分のシフト一覧タブに切り替わるが、申請したシフトがハイライトされていなかった。

**テスト内容**:
- `scrollToNewlyAddedShift`関数が呼ばれることを確認
- ハイライトクラスが正しく追加されることを確認

**実行**:
```bash
npm test -- regression-bugs
```

### Issue #3: 管理者モードでシフト削除時の問題

**問題**: シフト詳細モーダルでシフトを削除すると、その人のその日の全シフトが削除されていた。

**テスト内容**:
- `deleteShiftFromModal`に正しいUUID配列が渡されることを確認

**実行**:
```bash
npm test -- regression-bugs
```

### Issue #4: シフト一覧タブで未定義関数エラー

**問題**: ユーザーモードでシフト一覧タブを開くと「シフトデータの読み込みに失敗しました。」と表示される。原因は存在しない`scrollToNewlyAddedShift()`関数を呼び出していたこと。

**テスト内容**:
- `loadMyShifts`関数が正常に実行されることを確認
- 存在しない関数を呼び出していないことを確認
- APIエラー時に適切なエラーメッセージを表示することを確認
- `displayMyShifts`関数内でスクロール処理が実行されることを確認
- 必要な関数（`getCurrentUser`, `displayMyShifts`, `getScrollToShiftAfterLoad`など）が全て定義されていることを確認

**実行**:
```bash
# ユニットテスト
npm test -- shift-list-loading

# E2Eテスト（ブラウザで実際の動作を確認）
npm run test:e2e -- e2e/shift-list-loading.spec.ts
```

**テストファイル**:
- `test/shift-list-loading.test.js`: ユニットテスト
- `e2e/shift-list-loading.spec.ts`: E2Eテスト

## CI/CDでの自動テスト

GitHub Actionsで、プルリクエスト作成時に自動的にテストが実行されます。

### ワークフロー

`.github/workflows/test.yml`で以下のテストが実行されます：

1. **Unit Tests**: フロントエンドとバックエンドのユニットテスト
2. **Backend Tests**: TypeScriptのバックエンドテスト
3. **E2E Tests** (PRのみ): Playwrightを使ったE2Eテスト

### テスト失敗時の対応

1. GitHubのPRページで「Checks」タブを確認
2. 失敗したテストの詳細ログを確認
3. ローカルで該当テストを実行して修正
4. 修正をコミット＆プッシュして再テスト

## 新しいテストの追加

### ユニットテストの追加

フロントエンド（JavaScriptファイル）:
```bash
# test/ディレクトリに*.test.jsファイルを作成
touch test/new-feature.test.js
```

バックエンド（TypeScriptファイル）:
```bash
# server/src/__tests__/ディレクトリに*.test.tsファイルを作成
touch server/src/__tests__/NewService.test.ts
```

### E2Eテストの追加

```bash
# e2e/ディレクトリに*.spec.tsファイルを作成
touch e2e/new-feature.spec.ts
```

## テストのベストプラクティス

1. **バグ修正時は必ずテストを追加**: 同じバグが再発しないようにする
2. **小さなテストケースを書く**: 1つのテストは1つの動作を検証
3. **テストは読みやすく**: テスト名で何をテストしているか明確にする
4. **モックは最小限に**: 実際の動作に近い状態でテスト
5. **継続的に実行**: ローカルでコミット前に`npm test`を実行

## カバレッジレポート

```bash
npm run test:coverage
```

カバレッジレポートは`coverage/`ディレクトリに生成されます。

ブラウザで確認:
```bash
open coverage/lcov-report/index.html
```

## トラブルシューティング

### テストが失敗する場合

```bash
# 依存関係を再インストール
npm ci

# キャッシュをクリア
npm test -- --clearCache

# 特定のテストのみ実行
npm test -- test/regression-bugs.test.js
```

### E2Eテストが失敗する場合

```bash
# Playwrightブラウザを再インストール
npx playwright install --with-deps chromium

# UIモードでデバッグ
npm run test:e2e:ui
```

## 参考リンク

- [Jest Documentation](https://jestjs.io/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
