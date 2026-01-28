# VPS初期セットアップガイド

このガイドでは、VPSにシフト管理アプリケーションをデプロイするための環境を構築します。

## 目次

1. [前提条件](#前提条件)
2. [SSH接続の設定](#ssh接続の設定)
3. [自動セットアップ](#自動セットアップ)
4. [手動セットアップ](#手動セットアップ)
5. [環境変数の設定](#環境変数の設定)
6. [Nginx設定](#nginx設定)
7. [SSL証明書の取得](#ssl証明書の取得)
8. [セキュリティ設定](#セキュリティ設定)
9. [動作確認](#動作確認)

---

## 前提条件

### VPS要件

- **OS**: Ubuntu 20.04以降 または Debian 11以降
- **メモリ**: 最小1GB、推奨2GB以上
- **ディスク**: 最小10GB、推奨20GB以上
- **ネットワーク**: 固定IPアドレス

### ローカル環境要件

- SSH クライアント
- Git
- テキストエディタ

### 必要な情報

- VPSのIPアドレス
- ドメインまたはサブドメイン
- Google OAuth クライアントID
- Google Calendar ID
- Google Service Account情報

---

## SSH接続の設定

### 1. SSH鍵の生成

ローカルマシンでSSH鍵ペアを生成します。

```bash
ssh-keygen -t ed25519 -C "deploy@shift-app" -f ~/.ssh/shift_deploy

# パスフレーズを入力（推奨）
```

### 2. 公開鍵をVPSに登録

```bash
# 公開鍵をVPSにコピー
ssh-copy-id -i ~/.ssh/shift_deploy.pub root@YOUR_VPS_IP

# または手動でコピー
cat ~/.ssh/shift_deploy.pub
# VPSの ~/.ssh/authorized_keys に追加
```

### 3. SSH接続テスト

```bash
ssh -i ~/.ssh/shift_deploy root@YOUR_VPS_IP
```

---

## 自動セットアップ

### セットアップスクリプトの実行

VPSにSSH接続してセットアップスクリプトを実行します。

```bash
# VPSにSSH接続
ssh -i ~/.ssh/shift_deploy root@YOUR_VPS_IP

# リポジトリをクローン
git clone https://github.com/your-username/shift2.git /tmp/shift2
cd /tmp/shift2

# セットアップスクリプトを実行
chmod +x scripts/vps-setup.sh
sudo ./scripts/vps-setup.sh
```

セットアップスクリプトは以下を自動実行します:
- システムパッケージの更新
- Node.js 20.x のインストール
- PM2 のインストール
- Nginx のインストール
- Certbot のインストール
- ディレクトリ構造の作成
- 環境変数テンプレートの作成

---

## 手動セットアップ

自動セットアップを使用しない場合は、以下の手順で手動セットアップします。

### 1. システムパッケージの更新

```bash
sudo apt-get update
sudo apt-get upgrade -y
```

### 2. Node.js 20.x のインストール

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# バージョン確認
node -v  # v20.x.x
npm -v
```

### 3. PM2のインストール

```bash
sudo npm install -g pm2

# PM2のスタートアップ設定
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp /home/$USER
```

### 4. Nginxのインストール

```bash
sudo apt-get install -y nginx

# Nginxの起動と自動起動設定
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 5. Certbotのインストール

```bash
sudo apt-get install -y certbot python3-certbot-nginx
```

### 6. ディレクトリ構造の作成

```bash
sudo mkdir -p /var/www/shift/{releases,shared/{data,logs},backup/daily}
sudo chown -R $USER:$USER /var/www/shift
```

---

## 環境変数の設定

### 1. 環境変数ファイルの作成

```bash
vim /var/www/shift/shared/.env
```

### 2. 環境変数の設定内容

```env
# アプリケーション設定
PORT=3000
NODE_ENV=production
DATABASE_PATH=/var/www/shift/shared/data/shift.db
TIMEZONE=Asia/Tokyo

# Google OAuth設定
GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com

# Google Calendar設定
GOOGLE_CALENDAR_ID=your_calendar_id@group.calendar.google.com

# Google Service Account（サービスアカウントのJSONファイルから取得）
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project-id.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQE...\n-----END PRIVATE KEY-----\n"

# 認証済みメールアドレス（カンマ区切り）
AUTHORIZED_EMAILS=user1@example.com,user2@example.com
```

### 重要事項

#### Google秘密鍵の扱い

- 改行は `\n` でエスケープする必要があります
- ダブルクォート `"` で囲む必要があります

**例:**
```env
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----\n"
```

#### サービスアカウントJSONからの取得方法

```bash
# JSONファイルから秘密鍵を抽出してエスケープ
cat service-account.json | jq -r '.private_key'
```

### 3. ファイルパーミッションの設定

```bash
chmod 600 /var/www/shift/shared/.env
```

---

## Nginx設定

### 1. Nginx設定ファイルの作成

```bash
sudo vim /etc/nginx/sites-available/shift-app
```

以下の内容を貼り付け（`your-domain.com` を実際のドメインに変更）:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.com;

    # SSL設定は後でCertbotが自動設定

    access_log /var/log/nginx/shift-app-access.log;
    error_log /var/log/nginx/shift-app-error.log;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

詳細は [Nginx設定詳細ガイド](./nginx-config.md) または [設定ファイル例](./examples/nginx.conf) を参照してください。

### 2. Nginx設定の有効化

```bash
# シンボリックリンク作成
sudo ln -s /etc/nginx/sites-available/shift-app /etc/nginx/sites-enabled/

# デフォルト設定の無効化（必要に応じて）
sudo rm /etc/nginx/sites-enabled/default

# 設定テスト
sudo nginx -t

# Nginxリロード
sudo systemctl reload nginx
```

---

## SSL証明書の取得

### 1. DNS設定の確認

ドメインのAレコードがVPSのIPアドレスを指していることを確認します。

```bash
# DNS確認
dig your-domain.com +short
nslookup your-domain.com
```

### 2. Certbotで証明書取得

```bash
sudo certbot --nginx -d your-domain.com
```

プロンプトに従って入力:
- メールアドレス
- 利用規約への同意
- HTTPSリダイレクトの選択（推奨: Yes）

### 3. 自動更新の設定

Certbotは自動更新が設定されますが、テストで確認します。

```bash
# 更新テスト（実際には更新しない）
sudo certbot renew --dry-run
```

### 4. 更新Cronジョブの確認

```bash
# Certbotのタイマー確認
sudo systemctl status certbot.timer

# または
cat /etc/cron.d/certbot
```

---

## セキュリティ設定

### 1. ファイアウォール設定（UFW）

```bash
# UFWインストール
sudo apt-get install -y ufw

# デフォルトポリシー
sudo ufw default deny incoming
sudo ufw default allow outgoing

# SSH許可
sudo ufw allow OpenSSH

# HTTP/HTTPS許可
sudo ufw allow 'Nginx Full'

# UFW有効化
sudo ufw enable

# ステータス確認
sudo ufw status
```

### 2. fail2ban設定（オプション）

```bash
# fail2banインストール
sudo apt-get install -y fail2ban

# 設定ファイル作成
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo vim /etc/fail2ban/jail.local

# SSH保護を有効化（以下を確認）
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 3600

# fail2ban起動
sudo systemctl start fail2ban
sudo systemctl enable fail2ban
```

### 3. SSH設定の強化

```bash
sudo vim /etc/ssh/sshd_config
```

以下を設定:
```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

SSHサービス再起動:
```bash
sudo systemctl restart sshd
```

---

## 動作確認

### 1. デプロイスクリプトの配置

```bash
# リポジトリからコピー
cp /tmp/shift2/scripts/deploy.sh /var/www/shift/
cp /tmp/shift2/scripts/rollback.sh /var/www/shift/
cp /tmp/shift2/scripts/backup-db.sh /var/www/shift/scripts/

# 実行権限付与
chmod +x /var/www/shift/*.sh
chmod +x /var/www/shift/scripts/*.sh
```

### 2. サービス起動確認

```bash
# Nginx
sudo systemctl status nginx

# UFW
sudo ufw status

# PM2（初回デプロイ後）
pm2 status
pm2 list
```

### 3. ログの確認

```bash
# Nginxログ
sudo tail -f /var/log/nginx/shift-app-error.log
sudo tail -f /var/log/nginx/shift-app-access.log

# システムログ
sudo journalctl -u nginx -f
```

### 4. ディレクトリ構造の確認

```bash
tree -L 2 /var/www/shift

# 期待される出力:
# /var/www/shift/
# ├── releases/
# ├── shared/
# │   ├── data/
# │   ├── logs/
# │   └── .env
# ├── backup/
# │   └── daily/
# ├── deploy.sh
# └── rollback.sh
```

---

## 次のステップ

1. [GitHub Actions設定](./github-actions.md) - CI/CD設定
2. [初回デプロイ実行](./README.md#6-デプロイ実行) - アプリケーションのデプロイ
3. [モニタリング設定](./monitoring.md) - 監視とログ管理

---

## トラブルシューティング

問題が発生した場合は [トラブルシューティングガイド](./troubleshooting.md) を参照してください。

### よくある問題

**Q: Nginxが起動しない**
```bash
# ポート80/443が使用されているか確認
sudo lsof -i :80
sudo lsof -i :443

# 設定テスト
sudo nginx -t
```

**Q: SSL証明書の取得に失敗する**
```bash
# DNS設定を確認
dig your-domain.com +short

# ファイアウォールでHTTPが許可されているか確認
sudo ufw status | grep 80
```

**Q: PM2が起動しない**
```bash
# Node.jsのバージョン確認
node -v  # v20以上であること

# PM2の再インストール
sudo npm install -g pm2@latest
```
