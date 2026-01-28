# ロールバック手順ガイド

デプロイに問題が発生した際のロールバック手順を説明します。

## 自動ロールバック

デプロイ時のヘルスチェックが失敗すると、自動的に前のリリースにロールバックされます。

### 自動ロールバックのトリガー

- ヘルスチェックが30秒間失敗し続ける
- PM2のリロードが失敗する
- アプリケーションが起動しない

## 手動ロールバック

### 基本的なロールバック

前のリリースに戻す:

```bash
cd /var/www/shift
./rollback.sh --previous
```

### 利用可能なリリース一覧

```bash
./rollback.sh --list
```

出力例:
```
[1] 20260126_180000 (現在)
[2] 20260126_150000
[3] 20260126_120000
[4] 20260125_180000
[5] 20260125_150000
```

### 特定のリリースにロールバック

```bash
./rollback.sh -r 20260126_120000
```

### 確認プロンプトをスキップ

```bash
./rollback.sh --previous -y
```

## ロールバック後の確認

### 1. アプリケーション状態確認

```bash
# PM2ステータス
pm2 status

# ログ確認
pm2 logs shift-app --lines 50

# 現在のリリース確認
readlink /var/www/shift/current
```

### 2. ヘルスチェック

```bash
# ローカル
curl http://localhost:3000/api/health

# HTTPS
curl https://your-domain.com/api/health
```

### 3. データベース整合性確認

```bash
# データベースファイル確認
ls -lh /var/www/shift/shared/data/shift.db

# SQLiteデータベースチェック
sqlite3 /var/www/shift/shared/data/shift.db "PRAGMA integrity_check;"
```

## データベースのロールバック

アプリケーションのロールバックに加えて、データベースも復元する場合:

### 1. バックアップ一覧の確認

```bash
ls -lt /var/www/shift/backup/daily/
```

### 2. バックアップの復元

```bash
cd /var/www/shift/backup/daily

# バックアップを展開
tar -xzf shift_20260126.tar.gz

# アプリケーション停止
pm2 stop shift-app

# データベースを上書き
cp shift_*.db /var/www/shift/shared/data/shift.db

# アプリケーション再起動
pm2 start shift-app
```

### 3. 復元の確認

```bash
# データベースの整合性チェック
sqlite3 /var/www/shift/shared/data/shift.db "PRAGMA integrity_check;"

# アプリケーション起動確認
pm2 status
pm2 logs shift-app --lines 20
```

## ロールバックが失敗する場合

### PM2が応答しない

```bash
# PM2プロセス確認
pm2 list

# PM2再起動
pm2 kill
pm2 resurrect

# または手動起動
cd /var/www/shift/current
pm2 start ecosystem.config.js
```

### シンボリックリンクが壊れている

```bash
# 現在のリンク確認
ls -la /var/www/shift/current

# 手動でリンク修正
ln -sfn /var/www/shift/releases/20260126_150000 /var/www/shift/current

# PM2リロード
cd /var/www/shift/current
pm2 reload ecosystem.config.js
```

### データベースが破損している

```bash
# バックアップから復元
cd /var/www/shift/backup/daily
tar -xzf shift_YYYYMMDD.tar.gz
pm2 stop shift-app
cp shift_*.db /var/www/shift/shared/data/shift.db
pm2 start shift-app
```

## 緊急時のフル復旧手順

最悪の場合、以下の手順で完全復旧:

### 1. 最新の正常なリリースを特定

```bash
ls -lt /var/www/shift/releases/
```

### 2. PM2を完全停止

```bash
pm2 delete shift-app
pm2 kill
```

### 3. データベースを復元

```bash
cd /var/www/shift/backup/daily
tar -xzf shift_YYYYMMDD.tar.gz
cp shift_*.db /var/www/shift/shared/data/shift.db
```

### 4. 正常なリリースをcurrentに設定

```bash
ln -sfn /var/www/shift/releases/YYYYMMDD_HHMMSS /var/www/shift/current
```

### 5. アプリケーション起動

```bash
cd /var/www/shift/current
pm2 start ecosystem.config.js
pm2 save
```

### 6. 動作確認

```bash
pm2 status
pm2 logs shift-app
curl http://localhost:3000/api/health
```

## ロールバック後の対応

### 1. 問題の調査

```bash
# エラーログ確認
pm2 logs shift-app --err --lines 200

# デプロイログ確認（GitHub Actions）
# GitHubリポジトリのActionsタブで確認
```

### 2. 問題の修正

問題を特定したら:
1. ローカル環境で修正
2. テストを実行
3. 新しいコミットをプッシュ
4. 再デプロイ

### 3. チームへの通知

ロールバックが発生した場合は、チームに通知:
- 発生時刻
- 影響範囲
- ロールバック内容
- 原因と対策

## 予防策

### デプロイ前のチェックリスト

- [ ] ローカルでテストが通ること
- [ ] ステージング環境で動作確認（ある場合）
- [ ] データベースマイグレーションの確認
- [ ] 環境変数の確認
- [ ] バックアップの存在確認

### リリース管理

```bash
# 重要なリリースにタグを付ける
git tag -a v1.0.0 -m "Production release 1.0.0"
git push origin v1.0.0
```

### ブルー・グリーンデプロイ（発展）

より安全なデプロイのために、ブルー・グリーンデプロイの導入を検討してください。
