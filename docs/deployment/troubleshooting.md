# トラブルシューティングガイド

よくある問題と解決策をまとめています。

## デプロイ関連

### PM2起動エラー

**症状:** アプリケーションが起動しない

```bash
# ログ確認
pm2 logs shift-app --lines 100

# 手動起動テスト
cd /var/www/shift/current
node dist/src/index.js
```

**一般的な原因:**
1. 環境変数が設定されていない → `.env`ファイルを確認
2. ポート3000が使用中 → `lsof -i :3000` で確認
3. Node.jsバージョンが古い → `node -v` で確認（20.x以上が必要）

### データベース接続エラー

**症状:** `SQLITE_CANTOPEN` エラー

```bash
# データベースファイルの確認
ls -la /var/www/shift/shared/data/shift.db

# パーミッション修正
chmod 664 /var/www/shift/shared/data/shift.db
chmod 775 /var/www/shift/shared/data
```

### Nginx 502 Bad Gateway

**症状:** ブラウザで502エラーが表示される

```bash
# PM2ステータス確認
pm2 status

# Nginxエラーログ
sudo tail -f /var/log/nginx/shift-app-error.log

# アプリケーション起動確認
curl http://localhost:3000/api/health
```

## Google API関連

### Google Calendar API認証エラー

**症状:** カレンダー同期が失敗する

**確認項目:**
1. サービスアカウントの秘密鍵が正しく設定されているか
2. カレンダーIDが正しいか
3. サービスアカウントがカレンダーの編集権限を持っているか

```bash
# 環境変数確認
cat /var/www/shift/shared/.env | grep GOOGLE
```

### Google OAuth エラー

**症状:** ログインが失敗する

**確認項目:**
1. `GOOGLE_CLIENT_ID`が正しいか
2. Google Cloud Consoleでリダイレクトエンドポイントが設定されているか
3. `AUTHORIZED_EMAILS`にユーザーのメールアドレスが含まれているか

## SSL/TLS関連

### SSL証明書エラー

**症状:** HTTPS接続ができない

```bash
# 証明書の有効期限確認
sudo certbot certificates

# 証明書の更新
sudo certbot renew

# Nginx設定テスト
sudo nginx -t
```

### Let's Encrypt取得失敗

**症状:** `certbot`コマンドが失敗する

```bash
# DNSレコード確認
dig your-domain.com +short

# ポート80が開いているか確認
sudo ufw status | grep 80
```

## パフォーマンス問題

### メモリ不足

```bash
# メモリ使用状況確認
free -h

# PM2メモリ使用状況
pm2 monit

# インスタンス数を減らす
# ecosystem.config.js の instances を 1 に変更
```

### データベースが遅い

```bash
# WALモードの確認
sqlite3 /var/www/shift/shared/data/shift.db "PRAGMA journal_mode;"

# インデックスの確認
sqlite3 /var/www/shift/shared/data/shift.db ".schema"
```

## ログ確認コマンド

```bash
# アプリケーションログ
pm2 logs shift-app
tail -f /var/www/shift/shared/logs/out.log
tail -f /var/www/shift/shared/logs/error.log

# Nginxログ
sudo tail -f /var/log/nginx/shift-app-access.log
sudo tail -f /var/log/nginx/shift-app-error.log

# システムログ
sudo journalctl -u nginx -f
sudo journalctl -u pm2-$USER -f
```

## 緊急対応

### アプリケーションの再起動

```bash
pm2 restart shift-app
```

### 前のリリースにロールバック

```bash
cd /var/www/shift
./rollback.sh --previous
```

### データベースのリストア

```bash
cd /var/www/shift/backup/daily
tar -xzf shift_YYYYMMDD.tar.gz
cp shift_*.db /var/www/shift/shared/data/shift.db
pm2 restart shift-app
```
