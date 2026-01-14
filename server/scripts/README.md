# データ移行スクリプト

SpreadsheetからSQLiteへデータを移行するためのスクリプト集です。

## ユーザーデータの移行

Google SpreadsheetからSQLiteデータベースにユーザーデータを移行します。

### 前提条件

1. **Google Apps Scriptのデプロイ**

   まず、更新されたGoogle Apps Scriptコードをデプロイする必要があります：

   ```bash
   npm run deploy:gas
   ```

   または、手動で`gas/google-apps-script.js`の内容をGoogle Apps Scriptエディタにコピー&ペーストしてください。

2. **環境変数の設定**

   `.env`ファイルに以下が設定されていることを確認してください：

   ```env
   GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
   ```

### 移行の実行

以下のコマンドを実行します：

```bash
npm run migrate:users
```

または：

```bash
npx ts-node server/scripts/migrate-users.ts
```

### 実行例

```
========================================
  Spreadsheet → SQLite ユーザー移行
========================================

📊 Spreadsheetからユーザーデータを取得中...
✅ 15件のユーザーデータを取得しました

📝 15件のユーザーを処理中...

[1/15] ✅ 追加: user1@example.com
[2/15] ✅ 追加: user2@example.com
[3/15] ⏭️  スキップ (既に存在): user3@example.com
...

========================================
  移行完了
========================================
✅ 成功: 12件
⏭️  スキップ: 3件 (既存)
❌ エラー: 0件
========================================

📊 SQLiteに保存されているユーザー総数: 15件
```

### 動作の詳細

1. **データ取得**: Google Apps ScriptのAPIエンドポイント（`type=getAllUsers`）を呼び出し
2. **重複チェック**: `user_id`で既存ユーザーをチェック
3. **データ挿入**: 新しいユーザーのみSQLiteに挿入
4. **進捗表示**: 各ユーザーの処理状況をリアルタイムで表示
5. **結果サマリー**: 成功/スキップ/エラーの件数を表示

### データマッピング

| Spreadsheet | SQLite |
|------------|--------|
| タイムスタンプ (A列) | created_at |
| ユーザーID (B列) | user_id |
| 名前 (C列) | name |
| メールアドレス (D列) | email |
| プロフィール画像URL (E列) | picture |
| ニックネーム (F列) | nickname |
| 本名 (G列) | real_name |

### 注意事項

- **既存データの保護**: 既に同じ`user_id`が存在する場合はスキップされます（上書きはされません）
- **冪等性**: 何度実行しても安全です（重複挿入されません）
- **トランザクション**: 各ユーザーは個別に処理されるため、一部が失敗しても他のユーザーには影響しません
- **データの検証**: 移行前にSpreadsheetのデータが正しいことを確認してください

### トラブルシューティング

#### エラー: GOOGLE_APPS_SCRIPT_URL が設定されていません

`.env`ファイルに`GOOGLE_APPS_SCRIPT_URL`を追加してください：

```env
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

#### エラー: データ取得に失敗しました

1. Google Apps Scriptが正しくデプロイされているか確認
2. スクリプトのURLが正しいか確認
3. スプレッドシートに「ユーザー」シートが存在するか確認

#### 既存データを削除して再移行したい場合

```bash
# SQLiteのusersテーブルをクリア
sqlite3 data/shift.db "DELETE FROM users;"

# 移行を再実行
npm run migrate:users
```

### 手動確認

移行後、データを確認する方法：

```bash
# ユーザー数を確認
sqlite3 data/shift.db "SELECT COUNT(*) FROM users;"

# 全ユーザーを表示
sqlite3 data/shift.db "SELECT user_id, name, email FROM users;"

# 特定のユーザーを検索
sqlite3 data/shift.db "SELECT * FROM users WHERE email = 'user@example.com';"
```

### APIでの確認

バックエンドサーバーを起動して、APIで確認することもできます：

```bash
# サーバー起動
npm run dev:server

# 別のターミナルで
curl http://localhost:3000/api/users
```

## その他の移行スクリプト

将来的に以下のスクリプトも追加予定です：

- `migrate-shifts.ts`: シフトデータの移行
- `migrate-capacity.ts`: 人数設定データの移行
