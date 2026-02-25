# シフト管理アプリ - バックエンドAPI

Express + TypeScript + SQLiteで構築されたバックエンドサーバーです。

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env`ファイルを作成して以下を設定：

```env
PORT=3000
DATABASE_PATH=./data/shift.db
```

### 3. サーバーの起動

#### 開発モード（ホットリロード有効）

```bash
npm run dev:server
```

#### プロダクションビルド

```bash
npm run build
npm start
```

## データベース

SQLiteを使用しています。初回起動時に自動的にデータベースファイルとテーブルが作成されます。

### ユーザーテーブル

| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | INTEGER | 主キー（自動採番） |
| user_id | TEXT | Google OAuth のユーザーID（ユニーク） |
| name | TEXT | ユーザー名 |
| email | TEXT | メールアドレス |
| picture | TEXT | プロフィール画像URL |
| nickname | TEXT | ニックネーム |
| real_name | TEXT | 本名 |
| created_at | DATETIME | 作成日時 |
| updated_at | DATETIME | 更新日時 |

## APIエンドポイント

### ヘルスチェック

```
GET /health
```

レスポンス:
```json
{
  "status": "ok",
  "message": "Server is running"
}
```

### ユーザー作成/取得

```
POST /api/users
```

リクエストボディ:
```json
{
  "sub": "google-user-id",
  "name": "User Name",
  "email": "user@example.com",
  "picture": "https://example.com/avatar.jpg"
}
```

レスポンス:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": "google-user-id",
    "name": "User Name",
    "email": "user@example.com",
    "picture": "https://example.com/avatar.jpg",
    "nickname": null,
    "real_name": null,
    "created_at": "2026-01-14 04:33:19",
    "updated_at": "2026-01-14 04:33:19"
  }
}
```

### 全ユーザー取得

```
GET /api/users
```

レスポンス:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": "google-user-id",
      "name": "User Name",
      "email": "user@example.com",
      "picture": "https://example.com/avatar.jpg",
      "nickname": "ニックネーム",
      "real_name": "本名",
      "created_at": "2026-01-14 04:33:19",
      "updated_at": "2026-01-14 04:33:26"
    }
  ]
}
```

### 特定ユーザー取得

```
GET /api/users/:userId
```

レスポンス:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": "google-user-id",
    "name": "User Name",
    "email": "user@example.com",
    "picture": "https://example.com/avatar.jpg",
    "nickname": "ニックネーム",
    "real_name": "本名",
    "created_at": "2026-01-14 04:33:19",
    "updated_at": "2026-01-14 04:33:26"
  }
}
```

### ユーザープロフィール取得

```
GET /api/users/:userId/profile
```

レスポンス:
```json
{
  "success": true,
  "data": {
    "nickname": "ニックネーム",
    "real_name": "本名"
  }
}
```

### ユーザープロフィール更新

```
PUT /api/users/:userId/profile
```

リクエストボディ:
```json
{
  "nickname": "新しいニックネーム",
  "realName": "新しい本名"
}
```

レスポンス:
```json
{
  "success": true,
  "message": "プロフィールを更新しました"
}
```

### ユーザー削除

```
DELETE /api/users/:userId
```

レスポンス:
```json
{
  "success": true,
  "message": "ユーザーを削除しました"
}
```

## プロジェクト構造

```
server/
├── src/
│   ├── database/
│   │   └── db.ts          # データベース接続とテーブル作成
│   ├── models/
│   │   └── User.ts        # ユーザーモデル
│   ├── routes/
│   │   └── users.ts       # ユーザー関連のルート
│   └── index.ts           # サーバーのエントリーポイント
├── README.md
└── tsconfig.json
```

## 開発

### コードの変更

`server/src/` 配下のファイルを編集すると、nodemonが自動的にサーバーを再起動します。

### TypeScriptのコンパイル

```bash
npm run build
```

コンパイル結果は `dist/` ディレクトリに出力されます。

## アーキテクチャ

このバックエンドは Express + TypeScript + SQLite で構築されています。

### 主な特徴

- **SQLite**: 軽量で高速なデータベース
- **Express + TypeScript**: 型安全な RESTful API
- **Google Calendar API**: カレンダー連携
- **非同期処理**: パフォーマンスと拡張性を考慮した設計
