#!/bin/bash

#################################################
# VPS初期セットアップスクリプト
# シフト管理アプリケーションのVPS環境を構築します
#################################################

set -e  # エラー発生時に即座に終了

# カラー出力の定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ログ関数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 設定
APP_DIR="/var/www/shift"
APP_USER="${SUDO_USER:-$USER}"

log_info "VPS初期セットアップを開始します..."

#################################################
# 1. システムパッケージの更新
#################################################
log_info "システムパッケージを更新中..."
sudo apt-get update
sudo apt-get upgrade -y

#################################################
# 2. Node.js 20.x のインストール
#################################################
log_info "Node.js 20.x をインストール中..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    log_info "Node.js $(node -v) をインストールしました"
else
    log_info "Node.js $(node -v) は既にインストールされています"
fi

#################################################
# 3. PM2 のインストール
#################################################
log_info "PM2 をインストール中..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
    log_info "PM2 をインストールしました"
else
    log_info "PM2 は既にインストールされています"
fi

# PM2のスタートアップ設定
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $APP_USER --hp /home/$APP_USER

#################################################
# 4. Nginx のインストール
#################################################
log_info "Nginx をインストール中..."
if ! command -v nginx &> /dev/null; then
    sudo apt-get install -y nginx
    log_info "Nginx をインストールしました"
else
    log_info "Nginx は既にインストールされています"
fi

#################################################
# 5. Certbot (Let's Encrypt) のインストール
#################################################
log_info "Certbot をインストール中..."
if ! command -v certbot &> /dev/null; then
    sudo apt-get install -y certbot python3-certbot-nginx
    log_info "Certbot をインストールしました"
else
    log_info "Certbot は既にインストールされています"
fi

#################################################
# 6. ディレクトリ構造の作成
#################################################
log_info "ディレクトリ構造を作成中..."
sudo mkdir -p $APP_DIR/{releases,shared/{data,logs},backup/daily}
sudo chown -R $APP_USER:$APP_USER $APP_DIR

log_info "ディレクトリ構造:"
tree -L 2 $APP_DIR 2>/dev/null || ls -la $APP_DIR

#################################################
# 7. 環境変数テンプレートの作成
#################################################
log_info "環境変数テンプレートを作成中..."
cat > $APP_DIR/shared/.env.template << 'EOF'
# アプリケーション設定
PORT=3000
NODE_ENV=production
DATABASE_PATH=/var/www/shift/shared/data/shift.db
TIMEZONE=Asia/Tokyo

# Google OAuth設定
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CALENDAR_ID=your_calendar_id@group.calendar.google.com

# Google Service Account（サービスアカウントのJSONファイルから取得）
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project-id.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...(改行は\\nでエスケープ)\n-----END PRIVATE KEY-----\n"

# 認証済みメールアドレス（カンマ区切り）
AUTHORIZED_EMAILS=user1@example.com,user2@example.com
EOF

log_warn "環境変数を設定してください: $APP_DIR/shared/.env"
log_warn "テンプレートをコピーして編集: cp $APP_DIR/shared/.env.template $APP_DIR/shared/.env"

#################################################
# 8. デプロイスクリプトの配置
#################################################
log_info "デプロイスクリプトを配置中..."
# このスクリプトと同じディレクトリにあるdeploy.shをコピー
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/deploy.sh" ]; then
    sudo cp "$SCRIPT_DIR/deploy.sh" $APP_DIR/deploy.sh
    sudo chmod +x $APP_DIR/deploy.sh
    sudo chown $APP_USER:$APP_USER $APP_DIR/deploy.sh
    log_info "デプロイスクリプトを配置しました: $APP_DIR/deploy.sh"
else
    log_warn "deploy.sh が見つかりません: $SCRIPT_DIR/deploy.sh"
    log_warn "後で手動で配置してください"
fi

#################################################
# 9. Nginx設定のテンプレート作成
#################################################
log_info "Nginx設定テンプレートを作成中..."
cat > /tmp/shift-app-nginx.conf << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    # アクセスログとエラーログ
    access_log /var/log/nginx/shift-app-access.log;
    error_log /var/log/nginx/shift-app-error.log;

    # リバースプロキシ設定
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
EOF

log_warn "Nginx設定を編集してください: /tmp/shift-app-nginx.conf"
log_warn "編集後、以下のコマンドで有効化:"
echo "  sudo cp /tmp/shift-app-nginx.conf /etc/nginx/sites-available/shift-app"
echo "  sudo ln -s /etc/nginx/sites-available/shift-app /etc/nginx/sites-enabled/"
echo "  sudo nginx -t"
echo "  sudo systemctl reload nginx"

#################################################
# 10. ファイアウォール設定（UFW）
#################################################
log_info "ファイアウォール設定を確認中..."
if command -v ufw &> /dev/null; then
    if ! sudo ufw status | grep -q "Status: active"; then
        log_warn "UFWが無効です。有効化する場合:"
        echo "  sudo ufw allow OpenSSH"
        echo "  sudo ufw allow 'Nginx Full'"
        echo "  sudo ufw enable"
    else
        log_info "UFWは有効です"
    fi
else
    log_warn "UFWがインストールされていません"
fi

#################################################
# 11. セットアップ完了
#################################################
log_info "========================================="
log_info "VPS初期セットアップが完了しました！"
log_info "========================================="
log_info ""
log_info "次のステップ:"
log_info "1. 環境変数を設定: $APP_DIR/shared/.env"
log_info "2. Nginx設定を編集して有効化: /tmp/shift-app-nginx.conf"
log_info "3. SSL証明書を取得:"
echo "     sudo certbot --nginx -d your-domain.com"
log_info "4. GitHub Secretsを設定:"
echo "     VPS_HOST, VPS_USERNAME, VPS_SSH_KEY, VPS_PORT, APP_URL"
log_info "5. GitHub Actionsでデプロイを実行"
log_info ""
log_info "詳細は docs/deployment/setup-vps.md を参照してください"
