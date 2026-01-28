# VPSデプロイガイド

シフト管理アプリケーションをVPSに自動デプロイするための総合ガイドです。

## 目次

1. [概要](#概要)
2. [デプロイアーキテクチャ](#デプロイアーキテクチャ)
3. [クイックスタート](#クイックスタート)
4. [詳細ドキュメント](#詳細ドキュメント)
5. [ディレクトリ構成](#ディレクトリ構成)
6. [デプロイフロー](#デプロイフロー)
7. [よくある質問](#よくある質問)

---

## 概要

このドキュメントでは、GitHub ActionsからVPSへの自動デプロイ環境を構築する手順を説明します。

### 主要機能

- **自動デプロイ**: mainブランチへのプッシュで自動デプロイ
- **ゼロダウンタイム**: PM2のクラスタモードとシンボリックリンクによる無停止デプロイ
- **自動ロールバック**: ヘルスチェック失敗時の自動復旧
- **データベースバックアップ**: デプロイ時の自動バックアップ
- **リリース履歴管理**: 最新5つのリリースを保持

### 技術スタック

- **CI/CD**: GitHub Actions
- **プロセス管理**: PM2（クラスタモード、2インスタンス）
- **Webサーバー**: Nginx（リバースプロキシ + SSL/TLS）
- **データベース**: SQLite（WALモード）
- **VPS環境**: Ubuntu/Debian + SSH鍵認証

---

## デプロイアーキテクチャ

```
GitHub (main branch push)
    ↓
GitHub Actions
    ├─ テスト実行
    ├─ TypeScriptビルド
    ├─ デプロイアーカイブ作成
    └─ VPSへ転送 (SCP)
        ↓
VPS (/var/www/shift/)
    ├─ deploy.sh実行
    │   ├─ 新リリース作成
    │   ├─ 共有ファイルリンク
    │   ├─ PM2リロード
    │   └─ ヘルスチェック
    └─ PM2 (Cluster Mode)
        ├─ Instance 1 (Port 3000)
        └─ Instance 2 (Port 3000)
            ↓
        Nginx (Reverse Proxy)
            ↓
        HTTPS (Port 443)
```

---

## クイックスタート

### 前提条件

- VPS（Ubuntu 20.04以降またはDebian 11以降）
- ドメインまたはサブドメイン
- GitHubリポジトリへのアクセス権

### 1. VPS初期セットアップ

VPSにSSH接続し、セットアップスクリプトを実行します。

```bash
# リポジトリをクローン
git clone https://github.com/your-username/shift2.git
cd shift2

# セットアップスクリプトを実行
chmod +x scripts/vps-setup.sh
sudo ./scripts/vps-setup.sh
```

詳細は [VPSセットアップガイド](./setup-vps.md) を参照してください。

### 2. 環境変数の設定

```bash
# テンプレートをコピー
cp /var/www/shift/shared/.env.template /var/www/shift/shared/.env

# 環境変数を編集
vim /var/www/shift/shared/.env
```

必要な環境変数:
- `GOOGLE_CLIENT_ID`: Google OAuth クライアントID
- `GOOGLE_CALENDAR_ID`: Googleカレンダー ID
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: サービスアカウントメール
- `GOOGLE_PRIVATE_KEY`: サービスアカウント秘密鍵
- `AUTHORIZED_EMAILS`: 認証済みメールアドレス

### 3. Nginx設定

```bash
# 設定ファイルをコピーして編集
sudo cp /tmp/shift-app-nginx.conf /etc/nginx/sites-available/shift-app
sudo vim /etc/nginx/sites-available/shift-app

# your-domain.comを実際のドメインに変更
# （例: shift.example.com）

# 設定を有効化
sudo ln -s /etc/nginx/sites-available/shift-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

詳細は [Nginx設定ガイド](./nginx-config.md) を参照してください。

### 4. SSL証明書の取得

```bash
sudo certbot --nginx -d your-domain.com
```

### 5. GitHub Secrets設定

GitHubリポジトリの `Settings` → `Secrets and variables` → `Actions` で以下を設定:

| Secret名 | 説明 | 例 |
|---------|------|-----|
| `VPS_HOST` | VPSのIPアドレス | `123.45.67.89` |
| `VPS_USERNAME` | SSH接続用ユーザー名 | `deploy` |
| `VPS_SSH_KEY` | SSH秘密鍵（全文） | `-----BEGIN OPENSSH...` |
| `VPS_PORT` | SSHポート | `22` |
| `APP_URL` | アプリケーションURL | `https://shift.example.com` |

詳細は [GitHub Actions設定ガイド](./github-actions.md) を参照してください。

### 6. デプロイ実行

mainブランチにプッシュすると自動デプロイが開始されます。

```bash
git add .
git commit -m "Initial deployment setup"
git push origin main
```

GitHub Actionsのタブでデプロイ進捗を確認できます。

---

## 詳細ドキュメント

### セットアップ・設定

- [VPSセットアップガイド](./setup-vps.md) - VPS環境の構築手順
- [GitHub Actions設定ガイド](./github-actions.md) - CI/CD設定
- [Nginx設定詳細](./nginx-config.md) - Webサーバー設定

### 運用・保守

- [モニタリングとログ管理](./monitoring.md) - 監視とログ確認
- [ロールバック手順](./rollback.md) - 緊急時の復旧方法
- [セキュリティガイド](./security.md) - セキュリティ設定

### トラブルシューティング

- [トラブルシューティング](./troubleshooting.md) - よくある問題と解決策

---

## ディレクトリ構成

VPS上のディレクトリ構成:

```
/var/www/shift/
├── current/                    # 現在の本番環境（シンボリックリンク）
├── releases/                   # デプロイ履歴（タイムスタンプ付き）
│   ├── 20260126_120000/
│   ├── 20260126_150000/
│   └── 20260126_180000/
├── shared/                     # 永続化データ（リリース間で共有）
│   ├── data/                   # SQLiteデータベース
│   │   └── shift.db
│   ├── logs/                   # PM2ログ
│   └── .env                    # 環境変数
├── backup/                     # データベースバックアップ
│   └── daily/
├── deploy.sh                   # デプロイスクリプト
└── rollback.sh                 # ロールバックスクリプト
```

### シンボリックリンク方式の利点

- **ゼロダウンタイム**: 新しいリリースへの切り替えが瞬時
- **簡単なロールバック**: 以前のリリースへのリンクを張り直すだけ
- **データの永続化**: データベースとログは共有ディレクトリに保存

---

## デプロイフロー

### 1. GitHub Actions (CI/CD)

```yaml
1. テスト実行（npm run test:coverage）
2. TypeScriptビルド（npm run build）
3. デプロイアーカイブ作成
   - dist/ (ビルド済みコード)
   - node_modules/ (依存関係)
   - ecosystem.config.js (PM2設定)
   - 静的ファイル (HTML, CSS, JS)
4. VPSへ転送（SCP）
5. VPSでデプロイスクリプト実行
6. ヘルスチェック
```

### 2. VPSデプロイスクリプト (deploy.sh)

```bash
1. 新リリースディレクトリ作成（/var/www/shift/releases/TIMESTAMP）
2. アーカイブ展開
3. 共有ファイルへのシンボリックリンク作成
   - data/ → /var/www/shift/shared/data
   - .env → /var/www/shift/shared/.env
   - logs/ → /var/www/shift/shared/logs
4. データベースバックアップ
5. PM2リロード（ゼロダウンタイム）
6. ヘルスチェック（30秒間）
7. 成功時: 古いリリース削除（最新5つ保持）
8. 失敗時: 自動ロールバック
```

### 3. PM2プロセス管理

```javascript
// クラスタモード（2インスタンス）
instances: 2
exec_mode: 'cluster'

// リロード時の動作
pm2 reload ecosystem.config.js
  ↓
1. 新しいインスタンス起動
2. ヘルスチェック成功
3. 古いインスタンス停止
```

---

## よくある質問

### Q1: デプロイに失敗したらどうなりますか？

A1: 自動ロールバックが実行され、前のリリースに戻ります。

```bash
# 手動ロールバックも可能
cd /var/www/shift
./rollback.sh --previous
```

### Q2: データベースのバックアップはどこにありますか？

A2: `/var/www/shift/backup/daily/` に保存されます。30日間保持されます。

```bash
# バックアップ確認
ls -lh /var/www/shift/backup/daily/

# リストア手順
cd /var/www/shift/backup/daily
tar -xzf shift_YYYYMMDD.tar.gz
cp shift_*.db /var/www/shift/shared/data/shift.db
```

### Q3: PM2のログはどこで見られますか？

A3: `/var/www/shift/shared/logs/` に保存されています。

```bash
# リアルタイムログ
pm2 logs shift-app

# ログファイル
tail -f /var/www/shift/shared/logs/out.log
tail -f /var/www/shift/shared/logs/error.log
```

### Q4: SSL証明書の更新はどうすればいいですか？

A4: Let's Encryptの証明書は自動更新されます。

```bash
# 更新テスト
sudo certbot renew --dry-run

# 手動更新
sudo certbot renew
```

### Q5: 複数のインスタンスを実行したい場合は？

A5: `ecosystem.config.js` の `instances` を変更してください。

```javascript
// 全CPUコアを使用
instances: 'max'

// 特定の数
instances: 4
```

### Q6: デプロイのトリガーを変更したい場合は？

A6: `.github/workflows/deploy.yml` の `on` セクションを編集してください。

```yaml
# 手動実行
on:
  workflow_dispatch:

# タグプッシュ時
on:
  push:
    tags:
      - 'v*'
```

---

## サポート

問題が発生した場合は、以下を確認してください:

1. [トラブルシューティング](./troubleshooting.md) - よくある問題
2. GitHub Actions のログ
3. PM2のログ (`pm2 logs shift-app`)
4. Nginxのログ (`/var/log/nginx/shift-app-error.log`)

---

## 次のステップ

- [モニタリング設定](./monitoring.md) - アプリケーションの監視
- [セキュリティ強化](./security.md) - セキュリティ設定の見直し
- [バックアップ自動化](./monitoring.md#データベースバックアップの自動化) - Cron設定
