# VPS セットアップガイド

このドキュメントは、`tukumana.si.aoyama.ac.jp` サーバー上でシフト管理アプリケーションをセットアップする手順を説明します。

以下の作業はすべて `tukumana.si.aoyama.ac.jp` にSSH接続した状態で実行してください。

```bash
ssh user@tukumana.si.aoyama.ac.jp
```

## 1. 必要なパッケージのインストール

```bash
# システムのアップデート
sudo apt update && sudo apt upgrade -y

# Node.js 20.xのインストール
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2のグローバルインストール
sudo npm install -g pm2

# Nginxのインストール
sudo apt install -y nginx
```

## 2. アプリケーションディレクトリの作成

```bash
# アプリケーションディレクトリを作成
sudo mkdir -p /srv/shift2
sudo chown $USER:www-data /srv/shift2
cd /srv/shift2
```

## 3. リポジトリのクローン

```bash
git clone git@github.com:tukumanalab/shift2.git .
```

## 4. 環境変数ファイルの作成

```bash
nano .env
```

以下の内容を入力（実際の値に置き換えてください）:

```bash
# Server Configuration
PORT=4050

# Database Configuration
DATABASE_PATH=./data/shift.db

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
- `GOOGLE_PRIVATE_KEY` は改行をそのまま複数行で記載してください
- ダブルクォートで囲むことを忘れずに

## 5. 依存関係のインストールとビルド

```bash
# 依存関係のインストール
npm ci

# TypeScriptのビルド
npm run build

# データベースディレクトリの作成
mkdir -p data
```

## 6. PM2での起動

```bash
# アプリケーションを起動
pm2 start dist/src/index.js --name shift-app

# PM2の設定を保存
pm2 save

# PM2を自動起動に設定
pm2 startup
# 表示されたコマンドを実行（通常はsudo付き）
```

## 7. Nginxの設定

### 7.1 Nginx設定ファイルの作成

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
        alias /srv/shift2/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 7.2 Nginx設定の有効化

```bash
# シンボリックリンクの作成
sudo ln -s /etc/nginx/sites-available/shift2 /etc/nginx/sites-enabled/

# 設定のテスト
sudo nginx -t

# Nginxの再起動
sudo systemctl reload nginx
```

## 8. データベースのマイグレーション（初回のみ）

Google Spreadsheetから既存データを移行する場合:

```bash
cd /srv/shift2
npm run migrate:users
npm run migrate:capacity-settings
npm run migrate:shifts
npm run migrate:special-shifts
```

## 9. 動作確認

### PM2ステータスの確認

```bash
pm2 status
pm2 logs shift-app
```

### ヘルスチェック

```bash
curl http://localhost:4050/api/health
# または
curl https://tukumana.si.aoyama.ac.jp/shift2/api/health
```

期待されるレスポンス:
```json
{
  "status": "ok",
  "timestamp": "2026-02-03T12:34:56.789Z"
}
```

### ブラウザでアクセス

```
https://tukumana.si.aoyama.ac.jp/shift2/
```

## 10. アプリケーションの更新

新しいコードをデプロイする場合:

```bash
cd /srv/shift2

# 最新のコードを取得
git pull origin main

# 依存関係の更新（package.jsonに変更がある場合）
npm ci

# TypeScriptの再ビルド
npm run build

# PM2でアプリを再起動
pm2 restart shift-app

# ログを確認
pm2 logs shift-app
```
