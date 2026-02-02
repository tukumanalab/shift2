#!/bin/bash
set -e

#################################################
# デプロイスクリプト
# GitHub ActionsからVPSへのデプロイを実行
#################################################

echo "========================================="
echo "Starting deployment..."
echo "========================================="

# 変数定義
DEPLOY_ROOT="/srv/shift2"
RELEASES_DIR="$DEPLOY_ROOT/releases"
SHARED_DIR="$DEPLOY_ROOT/shared"
CURRENT_LINK="$DEPLOY_ROOT/current"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RELEASE_DIR="$RELEASES_DIR/$TIMESTAMP"
KEEP_RELEASES=5

# ディレクトリの作成
echo "Creating directories..."
mkdir -p "$RELEASES_DIR"
mkdir -p "$SHARED_DIR/data"
mkdir -p "$SHARED_DIR/logs"

# グループ権限の設定（www-dataグループ）
if [ -d "$SHARED_DIR" ]; then
    chgrp -R www-data "$SHARED_DIR" 2>/dev/null || true
    chmod -R 775 "$SHARED_DIR" 2>/dev/null || true
fi

# 初回デプロイ時に.envファイルが存在しない場合は作成
if [ ! -f "$SHARED_DIR/.env" ]; then
    echo "Warning: $SHARED_DIR/.env does not exist. Creating template..."
    cat > "$SHARED_DIR/.env" << 'EOF'
PORT=3000
DATABASE_PATH=/srv/shift2/shared/data/shift.db
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
AUTHORIZED_EMAILS=user1@example.com,user2@example.com
GOOGLE_CALENDAR_ID=your-calendar-id@group.calendar.google.com
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
TIMEZONE=Asia/Tokyo
EOF
    echo "Please edit $SHARED_DIR/.env with your actual configuration!"
fi

# アーカイブの展開
echo "Extracting deployment archive..."
mkdir -p "$RELEASE_DIR"
tar -xzf "$DEPLOY_ROOT/deploy.tar.gz" -C "$RELEASE_DIR"
rm -f "$DEPLOY_ROOT/deploy.tar.gz"

# 共有ファイルへのシンボリックリンク作成
echo "Creating symlinks to shared files..."
ln -nfs "$SHARED_DIR/.env" "$RELEASE_DIR/.env"
ln -nfs "$SHARED_DIR/data" "$RELEASE_DIR/data"
ln -nfs "$SHARED_DIR/logs" "$RELEASE_DIR/logs"

# フロントエンドファイルの確認
echo "Checking frontend files..."
cd "$RELEASE_DIR"
if [ ! -d "js" ]; then
    echo "Warning: js directory not found in release"
fi

# currentリンクの更新
echo "Updating current symlink..."
ln -nfs "$RELEASE_DIR" "$CURRENT_LINK"

# PM2でアプリケーションを再起動
echo "Restarting application with PM2..."
cd "$CURRENT_LINK"

# PM2でアプリが起動しているか確認
if pm2 list | grep -q "shift-app"; then
    echo "Reloading existing PM2 process..."
    pm2 reload shift-app --update-env
else
    echo "Starting new PM2 process..."
    pm2 start ecosystem.config.js --env production
fi

# PM2の設定を保存
pm2 save

# 古いリリースの削除（最新5つを保持）
echo "Cleaning up old releases..."
cd "$RELEASES_DIR"
ls -t | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf

echo "========================================="
echo "Deployment completed successfully!"
echo "========================================="
echo "Release: $TIMESTAMP"
echo "Current: $CURRENT_LINK -> $RELEASE_DIR"
echo ""
echo "Application logs:"
echo "  pm2 logs shift-app"
echo ""
echo "Application status:"
echo "  pm2 status"
