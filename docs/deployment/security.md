# セキュリティガイド

VPSとアプリケーションのセキュリティ設定について説明します。

## SSH設定

### SSH鍵認証の強制

```bash
sudo vim /etc/ssh/sshd_config
```

以下の設定を確認:
```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
PermitEmptyPasswords no
```

設定を反映:
```bash
sudo systemctl restart sshd
```

### SSHポート変更（オプション）

デフォルトポート22を変更することでセキュリティを向上できます。

```bash
sudo vim /etc/ssh/sshd_config
```

```
Port 2222  # 任意のポート番号
```

ファイアウォールルールも更新:
```bash
sudo ufw allow 2222/tcp
sudo systemctl restart sshd
```

## ファイアウォール設定

### UFW（Uncomplicated Firewall）

```bash
# デフォルトポリシー
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 必要なポートのみ許可
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'

# 有効化
sudo ufw enable

# ステータス確認
sudo ufw status verbose
```

### 特定IPからのアクセス制限

管理者のIPアドレスのみSSHを許可:

```bash
# すべてのSSHを拒否
sudo ufw delete allow OpenSSH

# 特定IPのみ許可
sudo ufw allow from YOUR_IP_ADDRESS to any port 22
```

## fail2ban設定

### インストールと基本設定

```bash
sudo apt-get install -y fail2ban
```

設定ファイル作成:
```bash
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo vim /etc/fail2ban/jail.local
```

基本設定:
```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
destemail = your-email@example.com

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 86400

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/shift-app-error.log
```

サービス起動:
```bash
sudo systemctl start fail2ban
sudo systemctl enable fail2ban

# ステータス確認
sudo fail2ban-client status
sudo fail2ban-client status sshd
```

## 環境変数の保護

### ファイルパーミッション

```bash
# .envファイルの権限を制限
chmod 600 /var/www/shift/shared/.env

# オーナーの確認
ls -la /var/www/shift/shared/.env
```

### 秘密情報の管理

- Google秘密鍵は環境変数でのみ管理
- コードに直接埋め込まない
- Git履歴に含めない（.gitignoreに追加済み）

## アプリケーションセキュリティ

### HTTPSの強制

Nginx設定でHTTPをHTTPSにリダイレクト:

```nginx
server {
    listen 80;
    return 301 https://$server_name$request_uri;
}
```

### セキュリティヘッダー

Nginx設定に以下を追加:

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### レート制限

Nginx設定でレート制限を設定:

```nginx
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    server {
        location /api/ {
            limit_req zone=api burst=20 nodelay;
        }
    }
}
```

## データベースセキュリティ

### ファイルパーミッション

```bash
# データベースファイルの権限
chmod 664 /var/www/shift/shared/data/shift.db
chmod 775 /var/www/shift/shared/data

# オーナーの確認
ls -la /var/www/shift/shared/data/
```

### バックアップの暗号化（オプション）

重要なデータの場合、バックアップを暗号化:

```bash
# GPG暗号化
gpg --symmetric --cipher-algo AES256 shift_backup.tar.gz

# 復号化
gpg --decrypt shift_backup.tar.gz.gpg > shift_backup.tar.gz
```

## システムアップデート

### 自動セキュリティアップデート

```bash
# unattended-upgradesのインストール
sudo apt-get install -y unattended-upgrades

# 設定
sudo dpkg-reconfigure -plow unattended-upgrades
```

設定ファイル:
```bash
sudo vim /etc/apt/apt.conf.d/50unattended-upgrades
```

```
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
};
Unattended-Upgrade::Automatic-Reboot "false";
```

### 手動アップデート

```bash
# パッケージリストの更新
sudo apt-get update

# セキュリティアップデートのみ
sudo apt-get upgrade -y
```

## ログ監視

### 重要なログファイル

```bash
# SSH認証ログ
sudo tail -f /var/log/auth.log

# Nginxアクセスログ
sudo tail -f /var/log/nginx/shift-app-access.log

# アプリケーションログ
pm2 logs shift-app

# fail2banログ
sudo tail -f /var/log/fail2ban.log
```

### ログローテーション

```bash
# logrotate設定
sudo vim /etc/logrotate.d/shift-app
```

```
/var/www/shift/shared/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 deploy deploy
}
```

## セキュリティチェックリスト

### 初期セットアップ時

- [ ] SSH鍵認証を設定
- [ ] パスワード認証を無効化
- [ ] rootログインを無効化
- [ ] UFWファイアウォールを有効化
- [ ] fail2banをインストール・設定
- [ ] 不要なサービスを停止
- [ ] システムを最新状態に更新

### 定期的なチェック（週次）

- [ ] fail2banのステータス確認
- [ ] 不審なログエントリの確認
- [ ] ディスク使用量の確認
- [ ] SSL証明書の有効期限確認

### 定期的なチェック（月次）

- [ ] システムアップデートの適用
- [ ] バックアップの検証
- [ ] アクセスログの分析
- [ ] セキュリティパッチの確認

## インシデント対応

### 不正アクセスが疑われる場合

1. **該当IPをブロック**
```bash
sudo ufw deny from SUSPICIOUS_IP
```

2. **ログの確認**
```bash
sudo grep "SUSPICIOUS_IP" /var/log/auth.log
sudo grep "SUSPICIOUS_IP" /var/log/nginx/shift-app-access.log
```

3. **SSH鍵の確認**
```bash
cat ~/.ssh/authorized_keys
```

4. **アクティブな接続の確認**
```bash
who
w
last
```

5. **必要に応じて秘密情報を更新**
- Google API キーの再生成
- SSH鍵の再生成
- パスワードの変更

## セキュリティ関連リソース

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [CIS Benchmarks](https://www.cisecurity.org/cis-benchmarks/)

## 次のステップ

- [モニタリング設定](./monitoring.md) - ログとアラートの設定
- [トラブルシューティング](./troubleshooting.md) - セキュリティ関連の問題解決
