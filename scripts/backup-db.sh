#!/bin/bash

#################################################
# データベースバックアップスクリプト
# SQLiteデータベースを定期的にバックアップします
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
DB_PATH="$APP_DIR/shared/data/shift.db"
BACKUP_DIR="$APP_DIR/backup/daily"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_ONLY=$(date +%Y%m%d)
KEEP_DAYS=30  # バックアップ保持日数

log_info "データベースバックアップを開始します: $TIMESTAMP"

#################################################
# 1. バックアップディレクトリの確認
#################################################
if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
    log_info "バックアップディレクトリを作成しました: $BACKUP_DIR"
fi

#################################################
# 2. データベースファイルの確認
#################################################
if [ ! -f "$DB_PATH" ]; then
    log_error "データベースファイルが見つかりません: $DB_PATH"
    exit 1
fi

#################################################
# 3. データベースのバックアップ
#################################################
log_info "データベースをバックアップ中..."

# メインのDBファイル
BACKUP_FILE="$BACKUP_DIR/shift_${TIMESTAMP}.db"
cp "$DB_PATH" "$BACKUP_FILE"
log_info "バックアップ完了: $BACKUP_FILE"

# WALファイル（Write-Ahead Log）
if [ -f "${DB_PATH}-wal" ]; then
    cp "${DB_PATH}-wal" "${BACKUP_FILE}-wal"
    log_info "WALファイルをバックアップ: ${BACKUP_FILE}-wal"
fi

# SHMファイル（Shared Memory）
if [ -f "${DB_PATH}-shm" ]; then
    cp "${DB_PATH}-shm" "${BACKUP_FILE}-shm"
    log_info "SHMファイルをバックアップ: ${BACKUP_FILE}-shm"
fi

#################################################
# 4. バックアップの圧縮
#################################################
log_info "バックアップを圧縮中..."
cd "$BACKUP_DIR"

# 圧縮アーカイブを作成
tar -czf "shift_${DATE_ONLY}.tar.gz" shift_${TIMESTAMP}.db* 2>/dev/null || true

if [ -f "shift_${DATE_ONLY}.tar.gz" ]; then
    log_info "圧縮完了: shift_${DATE_ONLY}.tar.gz"

    # 元のファイルを削除
    rm -f shift_${TIMESTAMP}.db*
    log_info "元のファイルを削除しました"
else
    log_warn "圧縮に失敗しました。元のファイルを保持します"
fi

#################################################
# 5. 古いバックアップの削除
#################################################
log_info "古いバックアップを削除中（保持日数: $KEEP_DAYS 日）..."
cd "$BACKUP_DIR"

# KEEP_DAYS日より古いバックアップを削除
find . -name "shift_*.tar.gz" -type f -mtime +$KEEP_DAYS -delete 2>/dev/null || true
find . -name "shift_*.db*" -type f -mtime +$KEEP_DAYS -delete 2>/dev/null || true

# バックアップ数を表示
BACKUP_COUNT=$(ls -1 shift_*.tar.gz 2>/dev/null | wc -l)
log_info "現在のバックアップ数: $BACKUP_COUNT"

#################################################
# 6. バックアップサイズの確認
#################################################
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
log_info "バックアップディレクトリの合計サイズ: $TOTAL_SIZE"

#################################################
# 7. バックアップの検証
#################################################
log_info "バックアップを検証中..."
LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/shift_${DATE_ONLY}.tar.gz 2>/dev/null | head -1)

if [ -f "$LATEST_BACKUP" ]; then
    # 圧縮ファイルの整合性チェック
    if tar -tzf "$LATEST_BACKUP" > /dev/null 2>&1; then
        log_info "バックアップの検証成功: $(basename "$LATEST_BACKUP")"
    else
        log_error "バックアップの検証失敗: $(basename "$LATEST_BACKUP")"
        exit 1
    fi
else
    log_error "最新のバックアップが見つかりません"
    exit 1
fi

#################################################
# 8. バックアップ完了
#################################################
log_info "========================================="
log_info "データベースバックアップが完了しました！"
log_info "========================================="
log_info "バックアップファイル: $(basename "$LATEST_BACKUP")"
log_info "バックアップディレクトリ: $BACKUP_DIR"
log_info "保持日数: $KEEP_DAYS 日"
log_info ""
log_info "リストア手順:"
echo "  cd $BACKUP_DIR"
echo "  tar -xzf shift_${DATE_ONLY}.tar.gz"
echo "  cp shift_*.db $DB_PATH"
log_info ""
log_info "Cron設定例（毎日午前3時に実行）:"
echo "  0 3 * * * /var/www/shift/scripts/backup-db.sh >> /var/log/shift-backup.log 2>&1"
