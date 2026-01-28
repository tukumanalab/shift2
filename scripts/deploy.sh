#!/bin/bash

#################################################
# VPSデプロイスクリプト
# GitHub ActionsからVPSへデプロイを実行します
#################################################

set -e  # エラー発生時に即座に終了

# カラー出力の定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# デプロイ設定
APP_DIR="/var/www/shift"
RELEASE_DIR="$APP_DIR/releases"
SHARED_DIR="$APP_DIR/shared"
CURRENT_LINK="$APP_DIR/current"
BACKUP_DIR="$APP_DIR/backup/daily"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
NEW_RELEASE="$RELEASE_DIR/$TIMESTAMP"
KEEP_RELEASES=5
HEALTH_CHECK_URL="${APP_URL:-http://localhost:3000}/api/health"
HEALTH_CHECK_TIMEOUT=30

log_info "========================================="
log_info "デプロイを開始します: $TIMESTAMP"
log_info "========================================="

#################################################
# 1. 新リリースディレクトリの作成
#################################################
log_step "1. 新リリースディレクトリを作成中..."
mkdir -p "$NEW_RELEASE"
log_info "作成完了: $NEW_RELEASE"

#################################################
# 2. デプロイアーカイブの展開
#################################################
log_step "2. デプロイアーカイブを展開中..."
if [ -f "$APP_DIR/deploy.tar.gz" ]; then
    tar -xzf "$APP_DIR/deploy.tar.gz" -C "$NEW_RELEASE"
    log_info "アーカイブ展開完了"
    rm -f "$APP_DIR/deploy.tar.gz"
else
    log_error "デプロイアーカイブが見つかりません: $APP_DIR/deploy.tar.gz"
    exit 1
fi

#################################################
# 3. 共有ファイルへのシンボリックリンク作成
#################################################
log_step "3. 共有ファイルへのシンボリックリンクを作成中..."

# データベースディレクトリ
if [ -d "$NEW_RELEASE/data" ]; then
    rm -rf "$NEW_RELEASE/data"
fi
ln -s "$SHARED_DIR/data" "$NEW_RELEASE/data"
log_info "データベースリンク作成: $NEW_RELEASE/data -> $SHARED_DIR/data"

# 環境変数ファイル
if [ -f "$NEW_RELEASE/.env" ]; then
    rm -f "$NEW_RELEASE/.env"
fi
ln -s "$SHARED_DIR/.env" "$NEW_RELEASE/.env"
log_info "環境変数リンク作成: $NEW_RELEASE/.env -> $SHARED_DIR/.env"

# ログディレクトリ
mkdir -p "$SHARED_DIR/logs"
if [ -d "$NEW_RELEASE/logs" ]; then
    rm -rf "$NEW_RELEASE/logs"
fi
ln -s "$SHARED_DIR/logs" "$NEW_RELEASE/logs"
log_info "ログリンク作成: $NEW_RELEASE/logs -> $SHARED_DIR/logs"

#################################################
# 4. 依存関係の確認
#################################################
log_step "4. 依存関係を確認中..."
cd "$NEW_RELEASE"

# package.jsonが存在することを確認
if [ ! -f "package.json" ]; then
    log_error "package.jsonが見つかりません"
    exit 1
fi

# node_modulesが存在することを確認
if [ ! -d "node_modules" ]; then
    log_error "node_modulesが見つかりません。ビルド時に含める必要があります"
    exit 1
fi

log_info "依存関係OK"

#################################################
# 5. PM2設定ファイルの確認
#################################################
log_step "5. PM2設定ファイルを確認中..."
if [ ! -f "ecosystem.config.js" ]; then
    log_error "ecosystem.config.jsが見つかりません"
    exit 1
fi
log_info "PM2設定ファイルOK"

#################################################
# 6. データベースバックアップ
#################################################
log_step "6. データベースをバックアップ中..."
if [ -f "$SHARED_DIR/data/shift.db" ]; then
    mkdir -p "$BACKUP_DIR"
    BACKUP_FILE="$BACKUP_DIR/shift_${TIMESTAMP}.db"
    cp "$SHARED_DIR/data/shift.db" "$BACKUP_FILE"

    # WALファイルとSHMファイルもバックアップ
    if [ -f "$SHARED_DIR/data/shift.db-wal" ]; then
        cp "$SHARED_DIR/data/shift.db-wal" "${BACKUP_FILE}-wal"
    fi
    if [ -f "$SHARED_DIR/data/shift.db-shm" ]; then
        cp "$SHARED_DIR/data/shift.db-shm" "${BACKUP_FILE}-shm"
    fi

    log_info "バックアップ完了: $BACKUP_FILE"

    # 古いバックアップを削除（最新10個を保持）
    cd "$BACKUP_DIR"
    ls -t shift_*.db 2>/dev/null | tail -n +11 | xargs -r rm -f
    log_info "古いバックアップを削除しました"
else
    log_warn "データベースファイルが見つかりません（初回デプロイ？）"
fi

#################################################
# 7. PM2でアプリをリロード
#################################################
log_step "7. PM2でアプリをリロード中..."
cd "$NEW_RELEASE"

# currentリンクを更新（アトミックに）
PREVIOUS_RELEASE=$(readlink -f "$CURRENT_LINK" 2>/dev/null || echo "")
ln -sfn "$NEW_RELEASE" "$CURRENT_LINK"
log_info "currentリンクを更新: $CURRENT_LINK -> $NEW_RELEASE"

# PM2がインストールされているか確認
if ! command -v pm2 &> /dev/null; then
    log_error "PM2がインストールされていません"
    exit 1
fi

# PM2でアプリケーションをリロード
if pm2 list | grep -q "shift-app"; then
    log_info "既存のアプリをリロード中..."
    pm2 reload ecosystem.config.js --update-env
else
    log_info "新規にアプリを起動中..."
    pm2 start ecosystem.config.js
fi

# PM2の設定を保存
pm2 save

log_info "PM2リロード完了"

#################################################
# 8. ヘルスチェック
#################################################
log_step "8. ヘルスチェック中..."
HEALTH_CHECK_COUNT=0
MAX_HEALTH_CHECK_ATTEMPTS=$((HEALTH_CHECK_TIMEOUT / 2))

while [ $HEALTH_CHECK_COUNT -lt $MAX_HEALTH_CHECK_ATTEMPTS ]; do
    if curl -sf "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
        log_info "ヘルスチェック成功！"
        break
    else
        HEALTH_CHECK_COUNT=$((HEALTH_CHECK_COUNT + 1))
        if [ $HEALTH_CHECK_COUNT -lt $MAX_HEALTH_CHECK_ATTEMPTS ]; then
            log_warn "ヘルスチェック失敗（$HEALTH_CHECK_COUNT/$MAX_HEALTH_CHECK_ATTEMPTS）、2秒後に再試行..."
            sleep 2
        fi
    fi
done

if [ $HEALTH_CHECK_COUNT -ge $MAX_HEALTH_CHECK_ATTEMPTS ]; then
    log_error "ヘルスチェック失敗！ロールバックします..."

    # ロールバック処理
    if [ -n "$PREVIOUS_RELEASE" ] && [ -d "$PREVIOUS_RELEASE" ]; then
        log_warn "前のリリースにロールバック中: $PREVIOUS_RELEASE"
        ln -sfn "$PREVIOUS_RELEASE" "$CURRENT_LINK"
        cd "$PREVIOUS_RELEASE"
        pm2 reload ecosystem.config.js --update-env
        pm2 save

        # 失敗したリリースを削除
        rm -rf "$NEW_RELEASE"

        log_error "ロールバック完了。デプロイは失敗しました"
        exit 1
    else
        log_error "前のリリースが見つかりません。手動で復旧してください"
        exit 1
    fi
fi

#################################################
# 9. 古いリリースの削除
#################################################
log_step "9. 古いリリースを削除中..."
cd "$RELEASE_DIR"
RELEASE_COUNT=$(ls -1dt */ 2>/dev/null | wc -l)
if [ "$RELEASE_COUNT" -gt "$KEEP_RELEASES" ]; then
    OLD_RELEASES=$(ls -1dt */ | tail -n +$((KEEP_RELEASES + 1)))
    for release in $OLD_RELEASES; do
        log_info "削除: $RELEASE_DIR/$release"
        rm -rf "$RELEASE_DIR/$release"
    done
    log_info "古いリリースを削除しました（保持数: $KEEP_RELEASES）"
else
    log_info "削除するリリースはありません（現在: $RELEASE_COUNT, 保持数: $KEEP_RELEASES）"
fi

#################################################
# 10. デプロイ完了
#################################################
log_info "========================================="
log_info "デプロイが正常に完了しました！"
log_info "========================================="
log_info "リリース: $TIMESTAMP"
log_info "ディレクトリ: $NEW_RELEASE"
log_info "現在のリンク: $CURRENT_LINK"
log_info ""
log_info "確認コマンド:"
echo "  pm2 status"
echo "  pm2 logs shift-app"
echo "  curl $HEALTH_CHECK_URL"
log_info ""
log_info "ロールバックが必要な場合:"
echo "  cd $APP_DIR && ./rollback.sh"
