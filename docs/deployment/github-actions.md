# GitHub Actions設定ガイド

GitHub ActionsによるVPSへの自動デプロイ設定手順を説明します。

## 目次

1. [GitHub Secretsの設定](#github-secretsの設定)
2. [SSH鍵の準備](#ssh鍵の準備)
3. [ワークフローファイルの確認](#ワークフローファイルの確認)
4. [デプロイのトリガー](#デプロイのトリガー)
5. [デプロイの確認](#デプロイの確認)
6. [トラブルシューティング](#トラブルシューティング)

---

## GitHub Secretsの設定

GitHub Actionsで使用するシークレット情報を設定します。

### 1. Secretsページへの移動

1. GitHubリポジトリを開く
2. `Settings` → `Secrets and variables` → `Actions` をクリック
3. `New repository secret` をクリック

### 2. 必要なSecretsの設定

以下の5つのSecretを設定します。

#### VPS_HOST

VPSのIPアドレスまたはドメイン

```
Name: VPS_HOST
Value: 123.45.67.89
```

または

```
Value: your-vps.example.com
```

#### VPS_USERNAME

SSH接続用のユーザー名

```
Name: VPS_USERNAME
Value: deploy
```

推奨: `root`ではなく、専用のデプロイユーザーを使用してください。

#### VPS_SSH_KEY

SSH秘密鍵の全文

```
Name: VPS_SSH_KEY
Value: -----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
...
-----END OPENSSH PRIVATE KEY-----
```

**注意**:
- 秘密鍵の全文をコピーして貼り付けます
- 先頭と末尾の行も含めてください
- 改行はそのまま保持してください

#### VPS_PORT

SSHポート番号

```
Name: VPS_PORT
Value: 22
```

デフォルトポート以外を使用している場合は適宜変更してください。

#### APP_URL

アプリケーションのURL（ヘルスチェック用）

```
Name: APP_URL
Value: https://shift.example.com
```

**注意**: HTTPSのURLを使用してください（SSL証明書設定後）。

---

## SSH鍵の準備

### 1. デプロイ用SSH鍵の生成

ローカルマシンで新しいSSH鍵を生成します。

```bash
ssh-keygen -t ed25519 -C "github-actions@shift-app" -f ~/.ssh/shift_github_actions

# パスフレーズは空のままにする（GitHub Actions用）
```

### 2. 公開鍵をVPSに登録

```bash
# 公開鍵をVPSにコピー
ssh-copy-id -i ~/.ssh/shift_github_actions.pub deploy@YOUR_VPS_IP

# または手動でVPSに追加
cat ~/.ssh/shift_github_actions.pub
# VPSの ~/.ssh/authorized_keys に追加
```

### 3. 秘密鍵をGitHub Secretsに登録

```bash
# 秘密鍵を表示してコピー
cat ~/.ssh/shift_github_actions

# GitHub Secretsの VPS_SSH_KEY に貼り付け
```

### 4. SSH接続テスト

```bash
ssh -i ~/.ssh/shift_github_actions deploy@YOUR_VPS_IP
```

---

## ワークフローファイルの確認

ワークフローファイルは `.github/workflows/deploy.yml` に配置されています。

### ワークフローの構成

```yaml
name: Deploy to VPS

on:
  push:
    branches:
      - main  # mainブランチへのプッシュでトリガー

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - テスト実行
      - TypeScriptビルド
      - デプロイアーカイブ作成
      - VPSへ転送
      - デプロイスクリプト実行
      - ヘルスチェック
```

### カスタマイズ可能な項目

#### Node.jsバージョンの変更

```yaml
env:
  NODE_VERSION: '20.x'  # 変更可能
```

#### ビルドに含めるファイルの追加

```yaml
- name: Create deployment archive
  run: |
    # ファイルを追加
    cp your-file deploy/
```

---

## デプロイのトリガー

### 自動デプロイ（デフォルト）

mainブランチへのプッシュで自動デプロイ

```bash
git add .
git commit -m "Update feature"
git push origin main
```

### 手動デプロイ

ワークフローを手動実行するように変更する場合:

```yaml
on:
  workflow_dispatch:  # 手動実行を許可
  push:
    branches:
      - main
```

手動実行方法:
1. GitHubリポジトリの `Actions` タブ
2. `Deploy to VPS` ワークフローを選択
3. `Run workflow` ボタンをクリック

### タグプッシュ時のデプロイ

特定のバージョンタグでのみデプロイする場合:

```yaml
on:
  push:
    tags:
      - 'v*'  # v1.0.0 などのタグでトリガー
```

使用方法:
```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## デプロイの確認

### 1. GitHub Actionsログの確認

1. GitHubリポジトリの `Actions` タブを開く
2. 最新のワークフロー実行をクリック
3. 各ステップのログを確認

### 2. デプロイの進捗

各ステップの実行状況:

- ✅ **Checkout code**: リポジトリのクローン
- ✅ **Setup Node.js**: Node.js環境のセットアップ
- ✅ **Install dependencies**: 依存関係のインストール
- ✅ **Run tests**: テストの実行
- ✅ **Build TypeScript**: TypeScriptのビルド
- ✅ **Create deployment archive**: デプロイアーカイブの作成
- ✅ **Copy files to VPS**: VPSへのファイル転送
- ✅ **Deploy on VPS**: VPS上でのデプロイ実行
- ✅ **Health check**: アプリケーションのヘルスチェック

### 3. VPS上での確認

```bash
# SSH接続
ssh deploy@YOUR_VPS_IP

# PM2ステータス確認
pm2 status

# ログ確認
pm2 logs shift-app --lines 50

# リリース確認
ls -la /var/www/shift/releases/
readlink /var/www/shift/current
```

### 4. アプリケーションの確認

```bash
# ヘルスチェック
curl https://your-domain.com/api/health

# ブラウザでアクセス
open https://your-domain.com
```

---

## トラブルシューティング

### テストが失敗する

```bash
# ローカルでテスト実行
npm test

# カバレッジ確認
npm run test:coverage
```

### ビルドが失敗する

```bash
# ローカルでビルド確認
npm run build

# 型エラーの確認
npx tsc --noEmit
```

### SCP転送が失敗する

**エラー例:**
```
Permission denied (publickey)
```

**解決策:**
1. SSH鍵がGitHub Secretsに正しく設定されているか確認
2. VPSの~/.ssh/authorized_keysに公開鍵が登録されているか確認
3. SSH接続テストを実行

```bash
ssh -i ~/.ssh/shift_github_actions deploy@YOUR_VPS_IP
```

### デプロイスクリプトが失敗する

**確認項目:**
1. VPS上でスクリプトが実行可能か確認
```bash
ls -la /var/www/shift/deploy.sh
chmod +x /var/www/shift/deploy.sh
```

2. 環境変数ファイルが存在するか確認
```bash
ls -la /var/www/shift/shared/.env
```

3. PM2が正しくインストールされているか確認
```bash
pm2 --version
```

### ヘルスチェックが失敗する

**エラー例:**
```
Health check failed after 10 attempts
```

**解決策:**
1. アプリケーションが正常に起動しているか確認
```bash
pm2 status
pm2 logs shift-app
```

2. ポート3000が使用されているか確認
```bash
lsof -i :3000
```

3. 手動でヘルスチェック
```bash
curl http://localhost:3000/api/health
```

4. Nginxが正しく動作しているか確認
```bash
sudo nginx -t
sudo systemctl status nginx
```

---

## 高度な設定

### デプロイ前の承認

本番環境へのデプロイ前に手動承認を要求する場合:

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://your-domain.com
    steps:
      # ... (既存のステップ)
```

GitHub Settings → Environments → production → Required reviewers で承認者を設定。

### 複数環境へのデプロイ

ステージング環境と本番環境を分ける場合:

```yaml
on:
  push:
    branches:
      - main       # 本番環境
      - staging    # ステージング環境

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Set environment
        run: |
          if [ "${{ github.ref }}" == "refs/heads/main" ]; then
            echo "ENV=production" >> $GITHUB_ENV
            echo "VPS_HOST=${{ secrets.PROD_VPS_HOST }}" >> $GITHUB_ENV
          else
            echo "ENV=staging" >> $GITHUB_ENV
            echo "VPS_HOST=${{ secrets.STAGING_VPS_HOST }}" >> $GITHUB_ENV
          fi
```

### Slack通知

デプロイ完了時にSlackへ通知する場合:

```yaml
- name: Notify Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## 次のステップ

- [デプロイガイド](./README.md) - 全体の流れ
- [モニタリング設定](./monitoring.md) - 監視とログ管理
- [トラブルシューティング](./troubleshooting.md) - よくある問題
