#!/bin/bash
set -e

#################################################
# ロールバックスクリプト
# 前のリリースに戻す
#################################################

echo "========================================="
echo "Starting rollback..."
echo "========================================="

# 変数定義
DEPLOY_ROOT="/srv/shift2"
RELEASES_DIR="$DEPLOY_ROOT/releases"
CURRENT_LINK="$DEPLOY_ROOT/current"

# 現在のリリースを取得
if [ ! -L "$CURRENT_LINK" ]; then
    echo "Error: Current symlink does not exist"
    exit 1
fi

CURRENT_RELEASE=$(readlink "$CURRENT_LINK")
CURRENT_RELEASE_NAME=$(basename "$CURRENT_RELEASE")

echo "Current release: $CURRENT_RELEASE_NAME"

# 利用可能なリリースをリスト
echo ""
echo "Available releases:"
cd "$RELEASES_DIR"
ls -t

# 前のリリースを取得（現在のリリースを除く）
PREVIOUS_RELEASE=$(ls -t | grep -v "^$CURRENT_RELEASE_NAME$" | head -n 1)

if [ -z "$PREVIOUS_RELEASE" ]; then
    echo ""
    echo "Error: No previous release found"
    echo "Available releases:"
    ls -t
    exit 1
fi

PREVIOUS_RELEASE_DIR="$RELEASES_DIR/$PREVIOUS_RELEASE"

echo ""
echo "Rolling back to: $PREVIOUS_RELEASE"
echo "From: $CURRENT_RELEASE"
echo "To: $PREVIOUS_RELEASE_DIR"

# 確認プロンプト（インタラクティブモードの場合）
if [ -t 0 ]; then
    read -p "Are you sure you want to rollback? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo "Rollback cancelled"
        exit 0
    fi
fi

# currentリンクの更新
echo ""
echo "Updating current symlink..."
ln -nfs "$PREVIOUS_RELEASE_DIR" "$CURRENT_LINK"

# PM2でアプリケーションを再起動
echo "Restarting application with PM2..."
cd "$CURRENT_LINK"

if pm2 list | grep -q "shift-app"; then
    pm2 reload shift-app --update-env
else
    echo "Warning: PM2 process 'shift-app' not found"
    echo "Starting new PM2 process..."
    pm2 start ecosystem.config.js --env production
fi

# PM2の設定を保存
pm2 save

echo ""
echo "========================================="
echo "Rollback completed successfully!"
echo "========================================="
echo "Current release: $PREVIOUS_RELEASE"
echo "Current link: $CURRENT_LINK -> $PREVIOUS_RELEASE_DIR"
echo ""
echo "Application logs:"
echo "  pm2 logs shift-app"
echo ""
echo "Application status:"
echo "  pm2 status"
echo ""
echo "If you need to rollback further, run this script again"
