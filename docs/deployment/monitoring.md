# モニタリングとログ管理ガイド

アプリケーションの監視とログ管理の方法を説明します。

## PM2モニタリング

### リアルタイムモニタリング

```bash
# ダッシュボード表示
pm2 monit

# ステータス確認
pm2 status
pm2 list

# 詳細情報
pm2 show shift-app

# プロセス情報
pm2 describe shift-app
```

### パフォーマンスメトリクス

```bash
# CPU/メモリ使用率
pm2 monit

# プロセスメトリクス
pm2 describe shift-app | grep -A 10 "Metrics"
```

## ログ管理

### アプリケーションログ

```bash
# リアルタイムログ
pm2 logs shift-app

# 最新100行
pm2 logs shift-app --lines 100

# エラーログのみ
pm2 logs shift-app --err

# 標準出力ログのみ
pm2 logs shift-app --out

# ログファイル直接参照
tail -f /var/www/shift/shared/logs/out.log
tail -f /var/www/shift/shared/logs/error.log
```

### Nginxログ

```bash
# アクセスログ
sudo tail -f /var/log/nginx/shift-app-access.log

# エラーログ
sudo tail -f /var/log/nginx/shift-app-error.log

# ログ統計
sudo cat /var/log/nginx/shift-app-access.log | awk '{print $1}' | sort | uniq -c | sort -rn | head -10
```

### ログローテーション

PM2は自動的にログローテーションを行いますが、手動設定も可能です。

```bash
# ログローテーション設定
pm2 install pm2-logrotate

# 設定確認
pm2 conf pm2-logrotate
```

## データベースバックアップの自動化

### Cronジョブの設定

```bash
# Crontab編集
crontab -e
```

以下を追加（毎日午前3時に実行）:

```cron
0 3 * * * /var/www/shift/scripts/backup-db.sh >> /var/log/shift-backup.log 2>&1
```

### バックアップの確認

```bash
# バックアップ一覧
ls -lh /var/www/shift/backup/daily/

# 最新バックアップの確認
ls -lt /var/www/shift/backup/daily/ | head -5

# バックアップサイズ確認
du -sh /var/www/shift/backup/
```

## ヘルスチェック

### 自動ヘルスチェック

```bash
# ヘルスチェックエンドポイント
curl http://localhost:3000/api/health
curl https://your-domain.com/api/health
```

### Cronでの定期チェック

```bash
# Crontab編集
crontab -e
```

以下を追加（5分ごとにチェック）:

```cron
*/5 * * * * curl -sf http://localhost:3000/api/health || echo "Health check failed at $(date)" >> /var/log/shift-health.log
```

## アラート設定（オプション）

### メールアラート

PM2でプロセスがクラッシュした際にメールを送信:

```bash
# pm2-auto-pullインストール
pm2 install pm2-auto-pull

# メール設定
pm2 set pm2-auto-pull:email your-email@example.com
```

### Discordウェブフック

```bash
# pm2-discord-notifierインストール
pm2 install pm2-discord-notifier

# Webhook URL設定
pm2 set pm2-discord-notifier:webhook_url "https://discord.com/api/webhooks/..."
```

## リソース監視

### ディスク使用量

```bash
# ディスク全体
df -h

# アプリケーションディレクトリ
du -sh /var/www/shift/*
```

### メモリ使用量

```bash
# 全体メモリ
free -h

# PM2プロセス
pm2 describe shift-app | grep memory
```

### CPU使用率

```bash
# システム全体
top

# PM2プロセス
pm2 monit
```

## パフォーマンス分析

### レスポンスタイム測定

```bash
# curl でレスポンスタイム計測
curl -w "@-" -o /dev/null -s "https://your-domain.com" <<'EOF'
time_namelookup:  %{time_namelookup}s\n
time_connect:  %{time_connect}s\n
time_starttransfer:  %{time_starttransfer}s\n
time_total:  %{time_total}s\n
EOF
```

### Nginxアクセスログ分析

```bash
# レスポンスタイムの平均
awk '{print $NF}' /var/log/nginx/shift-app-access.log | awk '{s+=$1; c++} END {print s/c}'

# ステータスコード別集計
awk '{print $9}' /var/log/nginx/shift-app-access.log | sort | uniq -c | sort -rn
```

## デバッグモード

### PM2デバッグ

```bash
# デバッグモードで起動
pm2 start ecosystem.config.js --env development

# Node.jsインスペクター
pm2 start ecosystem.config.js --node-args="--inspect"
```

### アプリケーションログレベル

環境変数で設定:

```env
LOG_LEVEL=debug
```

## 定期メンテナンス

### 週次チェック

```bash
# ログサイズ確認
du -sh /var/www/shift/shared/logs/
du -sh /var/log/nginx/

# バックアップ確認
ls -lh /var/www/shift/backup/daily/ | tail -7

# ディスク容量確認
df -h
```

### 月次チェック

```bash
# PM2の更新
pm2 update

# SSL証明書の有効期限確認
sudo certbot certificates
```
