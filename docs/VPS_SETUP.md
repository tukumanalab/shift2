# VPS セットアップガイド

このドキュメントは、VPS上でアプリケーションをデプロイするための初期セットアップ手順を説明します。

## 前提条件

- VPS: Ubuntu 20.04 LTS以降
- Node.js: 20.x
- PM2: グローバルインストール済み
- SSH接続が可能

## 1. 初期セットアップ

### 1.1 アプリケーションディレクトリの作成

```bash
# rootまたはsudo権限で実行
sudo mkdir -p /srv/shift2
sudo chown $USER:www-data /srv/shift2
chmod 775 /srv/shift2
cd /srv/shift2
```

### 1.2 ディレクトリ構造の作成

```bash
mkdir -p releases
mkdir -p shared/data
mkdir -p shared/logs

# グループ権限の設定
chgrp -R www-data shared
chmod -R 775 shared
```

### 1.3 環境変数ファイルの作成

```bash
nano shared/.env
```

以下の内容を入力（実際の値に置き換えてください）:

```bash
# Server Configuration
PORT=4050

# Database Configuration
DATABASE_PATH=/srv/shift2/shared/data/shift.db

# Google Apps Script URL
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
AUTHORIZED_EMAILS=user1@example.com,user2@example.com,admin@example.com

# Google Calendar Configuration
GOOGLE_CALENDAR_ID=your-calendar-id@group.calendar.google.com
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
YOUR_PRIVATE_KEY_HERE
-----END PRIVATE KEY-----
"

# Timezone
TIMEZONE=Asia/Tokyo
```

**重要**:
- `GOOGLE_PRIVATE_KEY` は改行を `\n` に変換せず、そのまま複数行で記載してください
- ダブルクォートで囲むことを忘れずに

### 1.4 デプロイスクリプトのコピー

リポジトリから `deploy.sh` と `rollback.sh` をVPSにコピー:

```bash
# ローカルマシンから実行
scp deploy.sh rollback.sh user@your-vps:/srv/shift2/

# VPS上で実行権限を付与
ssh user@your-vps
cd /srv/shift2
chmod +x deploy.sh rollback.sh
```

## 2. PM2のセットアップ

### 2.1 PM2のインストール（まだの場合）

```bash
sudo npm install -g pm2
```

### 2.2 PM2の起動設定

```bash
# PM2を自動起動に設定
pm2 startup

# 表示されたコマンドを実行（通常はsudo付き）
# 例: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u username --hp /home/username
```

## 3. Nginxの設定

### 3.1 Nginx設定ファイルの作成

```bash
sudo nano /etc/nginx/sites-available/shift2
```

以下の内容を入力:

```nginx
server {
    listen 80;
    server_name tukumana.si.aoyama.ac.jp;

    # /shift2/ へのリクエストをNode.jsアプリにプロキシ
    location /shift2/ {
        proxy_pass http://localhost:4050/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 静的ファイルの配信（オプション）
    location /shift2/assets/ {
        alias /srv/shift2/current/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 3.2 Nginx設定の有効化

```bash
# シンボリックリンクの作成
sudo ln -s /etc/nginx/sites-available/shift2 /etc/nginx/sites-enabled/

# 設定のテスト
sudo nginx -t

# Nginxの再起動
sudo systemctl reload nginx
```

### 3.3 SSL証明書の設定（Let's Encrypt）

```bash
# Certbotのインストール（まだの場合）
sudo apt update
sudo apt install certbot python3-certbot-nginx

# 証明書の取得と自動設定
sudo certbot --nginx -d tukumana.si.aoyama.ac.jp
```

## 4. データベースの準備

### 4.1 データベースファイルの配置

既存のデータベースがある場合:

```bash
# ローカルマシンから実行
scp data/shift.db user@your-vps:/srv/shift2/shared/data/
```

新規の場合は、初回デプロイ時に自動的に作成されます。

### 4.2 データベースのマイグレーション（必要に応じて）

```bash
cd /srv/shift2/current
npm run migrate:users
npm run migrate:capacity-settings
npm run migrate:shifts
npm run migrate:special-shifts
```

## 5. 初回デプロイ

GitHub Actionsから自動デプロイされるか、手動でテストする場合:

```bash
cd /srv/shift2

# テスト用のダミーアーカイブを配置（GitHub Actionsから自動的に配置されます）
# 手動テストの場合のみ:
# scp deploy.tar.gz user@your-vps:/srv/shift2/

# デプロイスクリプトの実行
./deploy.sh
```

## 6. 動作確認

### 6.1 PM2ステータスの確認

```bash
pm2 status
pm2 logs shift-app
```

### 6.2 ヘルスチェック

```bash
curl http://localhost:3000/api/health
# または
curl https://tukumana.si.aoyama.ac.jp/shift2/api/health
```

期待されるレスポンス:
```json
{
  "status": "ok",
  "timestamp": "2026-02-02T12:34:56.789Z"
}
```

### 6.3 ブラウザでアクセス

```
https://tukumana.si.aoyama.ac.jp/shift2/
```

## 7. トラブルシューティング

### アプリケーションが起動しない

```bash
# PM2ログの確認
pm2 logs shift-app --lines 100

# エラーログの確認
tail -f /srv/shift2/shared/logs/error.log

# PM2プロセスの再起動
pm2 restart shift-app
```

### データベース接続エラー

```bash
# データベースファイルの権限確認
ls -l /srv/shift2/shared/data/shift.db

# 権限の修正
chmod 664 /srv/shift2/shared/data/shift.db
```

### Nginx 502 Bad Gateway

```bash
# Node.jsアプリが起動しているか確認
pm2 status

# ポート3000でリスニングしているか確認
sudo netstat -tlnp | grep 3000

# Nginxエラーログの確認
sudo tail -f /var/log/nginx/error.log
```

## 8. 定期メンテナンス

### ログローテーション

```bash
# PM2ログのローテーション設定
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### データベースバックアップ

```bash
# 日次バックアップスクリプトの作成
cat > /srv/shift2/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/srv/shift2/shared/backups"
mkdir -p $BACKUP_DIR
DATE=$(date +%Y%m%d_%H%M%S)
cp /srv/shift2/shared/data/shift.db $BACKUP_DIR/shift_$DATE.db
# 7日以上古いバックアップを削除
find $BACKUP_DIR -name "shift_*.db" -mtime +7 -delete
EOF

chmod +x /srv/shift2/backup.sh

# cronジョブに追加（毎日午前3時）
crontab -e
# 以下を追加:
# 0 3 * * * /srv/shift2/backup.sh
```

## 9. GitHub Secretsの設定

GitHubリポジトリの Settings → Secrets and variables → Actions で以下を設定:

| Secret名 | 値 |
|---------|-----|
| `VPS_HOST` | `tukumana.si.aoyama.ac.jp` |
| `VPS_USERNAME` | SSH接続用のユーザー名 |
| `VPS_SSH_KEY` | SSH秘密鍵（全体） |
| `VPS_PORT` | `22` (またはカスタムポート) |
| `APP_URL` | `https://tukumana.si.aoyama.ac.jp/shift2` |

## 10. デプロイフロー

mainブランチにpushすると自動的に:

1. テストが実行される
2. TypeScriptがビルドされる
3. デプロイアーカイブが作成される
4. VPSに転送される
5. `deploy.sh` が実行される
6. PM2でアプリが再起動される
7. ヘルスチェックが実行される

## 11. ロールバック方法

問題が発生した場合:

```bash
ssh user@your-vps
cd /srv/shift2
./rollback.sh
```

これで前のリリースに戻ります。

## 参考情報

- アプリケーションログ: `/srv/shift2/shared/logs/`
- PM2ログ: `pm2 logs shift-app`
- リリース一覧: `ls -lt /srv/shift2/releases/`
- 現在のリリース: `ls -l /srv/shift2/current`
