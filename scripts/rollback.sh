#!/bin/bash

#################################################
# ロールバックスクリプト
# 前のリリースに戻します
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
CURRENT_LINK="$APP_DIR/current"
HEALTH_CHECK_URL="${APP_URL:-http://localhost:3000}/api/health"

#################################################
# 使用方法の表示
#################################################
show_usage() {
    echo "使用方法: $0 [オプション]"
    echo ""
    echo "オプション:"
    echo "  -l, --list        利用可能なリリースを表示"
    echo "  -r TIMESTAMP      指定したリリースにロールバック"
    echo "  -p, --previous    前のリリースにロールバック（デフォルト）"
    echo "  -h, --help        このヘルプを表示"
    echo ""
    echo "例:"
    echo "  $0 --list                    # リリース一覧を表示"
    echo "  $0 --previous                # 前のリリースに戻す"
    echo "  $0 -r 20260126_120000        # 特定のリリースに戻す"
}

#################################################
# リリース一覧の表示
#################################################
list_releases() {
    log_info "利用可能なリリース:"
    echo ""

    CURRENT_RELEASE=$(readlink -f "$CURRENT_LINK" 2>/dev/null || echo "")
    CURRENT_BASENAME=$(basename "$CURRENT_RELEASE" 2>/dev/null || echo "")

    cd "$RELEASE_DIR"
    RELEASES=$(ls -1dt */ 2>/dev/null | sed 's|/$||')

    if [ -z "$RELEASES" ]; then
        log_warn "リリースが見つかりません"
        exit 1
    fi

    INDEX=1
    for release in $RELEASES; do
        if [ "$release" = "$CURRENT_BASENAME" ]; then
            echo -e "  ${GREEN}[$INDEX] $release (現在)${NC}"
        else
            echo "  [$INDEX] $release"
        fi
        INDEX=$((INDEX + 1))
    done
    echo ""
}

#################################################
# ロールバック処理
#################################################
rollback_to_release() {
    TARGET_RELEASE="$1"
    TARGET_PATH="$RELEASE_DIR/$TARGET_RELEASE"

    log_info "========================================="
    log_info "ロールバックを開始します"
    log_info "========================================="

    # ターゲットリリースが存在するか確認
    if [ ! -d "$TARGET_PATH" ]; then
        log_error "指定されたリリースが見つかりません: $TARGET_RELEASE"
        log_info "利用可能なリリース:"
        list_releases
        exit 1
    fi

    CURRENT_RELEASE=$(readlink -f "$CURRENT_LINK" 2>/dev/null || echo "")
    CURRENT_BASENAME=$(basename "$CURRENT_RELEASE" 2>/dev/null || echo "")

    # 現在のリリースと同じ場合は警告
    if [ "$TARGET_RELEASE" = "$CURRENT_BASENAME" ]; then
        log_warn "指定されたリリースは既に現在のリリースです"
        exit 0
    fi

    log_info "現在のリリース: $CURRENT_BASENAME"
    log_info "ターゲットリリース: $TARGET_RELEASE"

    # 確認プロンプト（-yオプションがない場合）
    if [ "$SKIP_CONFIRM" != "yes" ]; then
        echo -ne "${YELLOW}ロールバックを実行しますか？ (y/N): ${NC}"
        read -r CONFIRM
        if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
            log_info "ロールバックをキャンセルしました"
            exit 0
        fi
    fi

    # currentリンクを更新
    log_step "1. currentリンクを更新中..."
    ln -sfn "$TARGET_PATH" "$CURRENT_LINK"
    log_info "currentリンク更新: $CURRENT_LINK -> $TARGET_PATH"

    # PM2でアプリをリロード
    log_step "2. PM2でアプリをリロード中..."
    cd "$TARGET_PATH"

    if ! command -v pm2 &> /dev/null; then
        log_error "PM2がインストールされていません"
        exit 1
    fi

    if pm2 list | grep -q "shift-app"; then
        pm2 reload ecosystem.config.js --update-env
        pm2 save
        log_info "PM2リロード完了"
    else
        log_error "shift-appが起動していません"
        pm2 start ecosystem.config.js
        pm2 save
        log_info "shift-appを起動しました"
    fi

    # ヘルスチェック
    log_step "3. ヘルスチェック中..."
    HEALTH_CHECK_COUNT=0
    MAX_HEALTH_CHECK_ATTEMPTS=15

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
        log_error "ヘルスチェック失敗！手動で確認してください"
        log_info "確認コマンド:"
        echo "  pm2 logs shift-app"
        echo "  pm2 status"
        exit 1
    fi

    log_info "========================================="
    log_info "ロールバックが正常に完了しました！"
    log_info "========================================="
    log_info "現在のリリース: $TARGET_RELEASE"
    log_info ""
    log_info "確認コマンド:"
    echo "  pm2 status"
    echo "  pm2 logs shift-app"
    echo "  curl $HEALTH_CHECK_URL"
}

#################################################
# メイン処理
#################################################

# オプション解析
MODE="previous"
TARGET_RELEASE=""
SKIP_CONFIRM="no"

while [ $# -gt 0 ]; do
    case "$1" in
        -l|--list)
            list_releases
            exit 0
            ;;
        -r)
            MODE="specific"
            TARGET_RELEASE="$2"
            shift 2
            ;;
        -p|--previous)
            MODE="previous"
            shift
            ;;
        -y|--yes)
            SKIP_CONFIRM="yes"
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            log_error "不明なオプション: $1"
            show_usage
            exit 1
            ;;
    esac
done

# リリースディレクトリが存在するか確認
if [ ! -d "$RELEASE_DIR" ]; then
    log_error "リリースディレクトリが見つかりません: $RELEASE_DIR"
    exit 1
fi

# リリースを取得
cd "$RELEASE_DIR"
CURRENT_RELEASE=$(readlink -f "$CURRENT_LINK" 2>/dev/null || echo "")
CURRENT_BASENAME=$(basename "$CURRENT_RELEASE" 2>/dev/null || echo "")
RELEASES=$(ls -1dt */ 2>/dev/null | sed 's|/$||')

if [ -z "$RELEASES" ]; then
    log_error "リリースが見つかりません"
    exit 1
fi

# ロールバック処理
if [ "$MODE" = "previous" ]; then
    # 前のリリースを探す
    FOUND_CURRENT=0
    PREVIOUS_RELEASE=""

    for release in $RELEASES; do
        if [ "$FOUND_CURRENT" = "1" ]; then
            PREVIOUS_RELEASE="$release"
            break
        fi
        if [ "$release" = "$CURRENT_BASENAME" ]; then
            FOUND_CURRENT=1
        fi
    done

    if [ -z "$PREVIOUS_RELEASE" ]; then
        log_error "前のリリースが見つかりません"
        list_releases
        exit 1
    fi

    rollback_to_release "$PREVIOUS_RELEASE"

elif [ "$MODE" = "specific" ]; then
    if [ -z "$TARGET_RELEASE" ]; then
        log_error "ターゲットリリースが指定されていません"
        show_usage
        exit 1
    fi
    rollback_to_release "$TARGET_RELEASE"
fi
