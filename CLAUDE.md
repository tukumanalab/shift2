# CLAUDE.md

このファイルは Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスです。

## プロジェクト概要

Google Identity Services (GSI) を使った OAuth2 認証付きの日本語シフト管理 Web アプリケーションです。フロントエンドはピュア HTML / CSS / バニラ JavaScript、バックエンドは Express + TypeScript + SQLite で構成されています。

## 開発コマンド

### アプリケーションの起動

フロントエンドと API を統合した Express サーバーを使用します。

```bash
# 開発モード（ホットリロード推奨）
npm run dev

# 本番ビルドと起動
npm run build
npm start
```

アクセス先: `http://localhost:3000`

サーバーが提供するもの:
- **フロントエンド**: 静的ファイル (index.html, app.js, config.js など)
- **バックエンド API**: ユーザー / 通常シフト / 特別シフト / 人数設定などの RESTful エンドポイント
- **データベース**: SQLite

### ファイル配信の要件
- localhost または HTTPS で動作する必要あり (Google OAuth の制約)
- デフォルトポートは 3000 (`.env` の `PORT` で変更可)

## 現状仕様

### アプリケーション概要
Google OAuth 認証付きのシフト管理アプリ。ユーザーは以下を行えます:
- シフトの閲覧・管理
- 日付ごとの必要人数（capacity）の設定
- 特定の時間枠へのシフト申請
- 残り枠数のリアルタイム確認

### 主要機能

#### 1. 認証 / 認可
- **Google OAuth 連携**: GSI を使用
- **メールベースの認可**: 許可リストのメールアドレスのみアクセス可
- **管理者ロール**: 人数設定など追加権限を持つ

#### 2. シフト管理
- **時間枠**: 13:00〜18:00 を 30 分単位 (13:00-13:30, 13:30-14:00, …)
- **対象期間**: 当日から次年度 3/31 まで
- **リアルタイム残り枠**: 設定容量と現申請数から算出

**シフトの種類**:
1. **通常シフト (`shifts` テーブル)**
   - 30 分固定の時間枠
   - Google カレンダーと自動同期
   - `calendar_event_id` でイベントとリンク

2. **特別シフト (`special_shifts` テーブル)**
   - 柔軟な時間帯（例: 13:15-15:45, 10:00-12:30）
   - Google カレンダーには同期しない
   - 不定期スケジュールや特別イベント用

> **重要**: Google カレンダーに同期されるのは通常シフトのみ。特別シフトは内部管理用で共有カレンダーには表示されません。

#### 3. 人数設定 (Capacity)
- **曜日別デフォルト容量**:
  - 日 / 土: 0 人
  - 水: 2 人
  - 月 / 火 / 木 / 金: 3 人
- **日付別オーバーライド**: 管理者は特定日の容量を上書き可能
- **リアルタイム反映**: 容量変更が即座に残り枠に反映

#### 4. データストレージとバックエンド
- **SQLite**: 全データを SQLite に保存
- **Express + TypeScript API**: サーバーサイド処理
- **Google Calendar 連携**: 承認シフトを自動同期

### 技術アーキテクチャ

#### フロントエンド
- **ピュア HTML / CSS / JavaScript**: ビルドシステム / フレームワーク不使用
- **レスポンシブデザイン**
- **リアルタイム UI 更新**

#### バックエンド (Express + TypeScript)
- **フレームワーク**: Express.js + TypeScript
- **DB**: SQLite (better-sqlite3)
- **RESTful API**: ユーザー / シフト / 特別シフト / 人数設定
- **Google Calendar 連携**: イベントの自動作成・同期
- **ホットリロード**: Nodemon
- **型安全**: TypeScript フルサポート

**カバレッジ**:
- ✅ ユーザー管理
- ✅ カレンダー連携
- ✅ シフト管理
- ✅ 人数設定管理
- ✅ 特別シフト管理

#### データ構造

**SQLite (Express + TypeScript バックエンド)**:

- **users**: ユーザー登録データ
  - カラム: id, user_id, name, email, picture, nickname, real_name, created_at, updated_at
  - PK: id (auto-increment)
  - Unique: user_id
  - Indexes: user_id, email

- **shifts**: 通常シフト (Google カレンダー同期対象)
  - カラム: id, uuid, user_id, user_name, date, time_slot, calendar_event_id, created_at, updated_at
  - 30 分固定枠
  - `calendar_event_id` がカレンダーイベントとリンク

- **special_shifts**: 特別シフト (カレンダー非同期)
  - カラム: id, uuid, user_id, user_name, date, start_time, end_time, created_at, updated_at
  - 柔軟な時間帯
  - `calendar_event_id` なし

- **capacity_settings**: 日別の人数設定
  - カラム: id, date, capacity, memo, user_id, user_name, created_at, updated_at

### 主要アルゴリズム

#### 残り枠の算出
```
remainingSlots = configuredCapacity - currentApplications
```

#### デフォルト容量の割当
- 曜日ベース、設定で上書き可能
- 年度全体に対して自動初期化

#### 時間枠生成
- 30 分単位でプログラマティックに生成
- 時間範囲は柔軟に設定可能

### 開発とデプロイ

#### ローカル開発
- `npm run dev` でポート 3000 にサーバー起動
- Google OAuth は localhost / HTTPS が必須
- Nodemon によるホットリロードあり

#### 設定
- フロント / バックエンド両方で Google OAuth Client ID を設定
- カレンダー ID は `.env` で管理
- 認可されたメールアドレスは設定で管理
- DB はローカルの SQLite ファイル

### セキュリティ上の考慮
- **クライアント側のトークン処理**: JWT はクライアントでデコードのみ
- **メールベースのアクセス制御**: 認可ユーザーのみアクセス可
- **サーバー側セッションなし**: Google トークンによるステートレス認証
- **設定の機密管理**: 機微情報は環境変数で管理

このシステムは、リアルタイムな空き枠管理と Google サービスとのシームレスな連携を備えた、シフト管理ソリューションです。

## アーキテクチャ

### ファイル構成
- `index.html` — シングルページアプリ (CSS 埋め込み)
- `app.js` — 認証ロジックと DOM 操作
- `README.md` — セットアップ手順 (日本語)

### 認証フロー
1. ページロード時に Google Identity Services を初期化
2. サインインボタン押下 → OAuth ポップアップ
3. `handleCredentialResponse()` が JWT を受領
4. `decodeJwtResponse()` で JWT ペイロードを手動デコード
5. `showProfile()` でユーザー情報表示と UI 状態切替
6. `signOut()` でセッションクリアと UI リセット

### Google OAuth 設定
- Client ID は `index.html` と `app.js` にハードコード
- 現状の Client ID: `your_google_client_id_here`
- 認可済みオリジン: `localhost:8081`, `127.0.0.1:8081`

## 実装上のポイント

### JWT の取り扱い
JWT ライブラリは使わず、`decodeJwtResponse()` 内で base64 URL デコードを手動実行。

### UI 状態管理
CSS クラスで管理する 2 状態:
- ログイン: `#loginSection` 表示 / `#profileSection` 非表示
- 認証済み: `#loginSection` 非表示 / `#profileSection` 表示

### セキュリティに関する注意
- 学習・デモ用途であり、認証情報がハードコードされている
- JWT はクライアント側でのみ処理
- サーバー検証 / セッション管理なし
- 開発・教育目的のみに適する

## 開発ワークフロー

### テスト駆動開発 (TDD)

**重要**: 新機能の実装だけでなく、**バグ修正もすべて TDD で行うこと**。

「Red → Green → Refactor」のサイクルに従います。

1. **Red** — 期待挙動を表現する失敗テストを書く
   ```bash
   npm test  # テストが失敗することを確認
   ```

2. **Green** — テストを通す最小限の実装をする
   ```bash
   npm test  # テストが通ることを確認
   ```

3. **Refactor** — テストが緑のままコードを整理する

#### バグ修正のときの進め方
1. **再現テストを先に書く** — 現在のバグ挙動を「期待される正しい挙動」として記述し、必ず一度 fail させる
2. **実コードを修正** — テストが通る最小限の修正を行う
3. **全テスト実行** — 既存テストへの回帰がないか確認する
4. **必要なら回帰防止のテストを追加** — 同じ不具合の再発防止用テストを残す

> 「テストなしで直接修正してから後でテストを書く」進め方は禁止です。バグ報告を受けた時点で、まず失敗するテストを 1 件書いてから着手してください。

#### テストの配置
- **バックエンド (TypeScript)**: `server/src/__tests__/**/*.test.ts`
- **フロントエンド (JavaScript)**: `test/**/*.test.js`

#### テストの実行
```bash
npm test                    # 全テスト
npm run test:backend        # バックエンドのみ
npx jest <path/to/test>     # 単一ファイル
```

#### フロントエンドテストの慣習
フロントエンドの `js/modules/*.js` は Jest から直接 import できないため、**テストファイル内に期待挙動を表現するインライン関数を定義し、その後同じロジックを実コードへ反映する**運用です。テストファイルが事実上の仕様書となります。

### ブランチ運用

**重要**: `main` ブランチに直接コミットしないでください。

すべての変更は次の手順に従います。

1. **フィーチャーブランチを作成**
   ```bash
   git checkout -b feature/<descriptive-name>
   ```

2. **変更をコミット**
   ```bash
   git add <files>
   git commit -m "コミットメッセージ"
   ```

3. **フィーチャーブランチへ push**
   ```bash
   git push origin feature/<descriptive-name>
   ```

4. GitHub で **Pull Request を作成**

5. **承認後** GitHub のマージボタンで `main` にマージ

**禁止**:
```bash
git push origin main  # ❌ 直接 push は禁止
```

### Pull Request の作成

PR 作成時は以下を守ってください。

1. **コードの整理**: PR 作成前に `code-simplifier` で整理・最適化する
   ```bash
   npx code-simplifier <file-path>
   ```

2. **コミット規約**:
   - わかりやすい日本語のコミットメッセージ
   - AI 支援開発の場合は co-author を含める:
     ```
     Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
     ```

3. **PR 説明**:
   - 変更内容を日本語で要約
   - UI 変更は before/after スクリーンショットを添付
   - 破壊的変更や移行手順があれば明記

4. **テスト**:
   - フロントエンド・バックエンド両方をローカル検証
   - 既存機能のリグレッションがないか確認
   - DB マイグレーションがある場合はマージ前に動作確認
