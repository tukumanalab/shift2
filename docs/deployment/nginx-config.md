# Nginx設定詳細ガイド

Nginxをリバースプロキシとして設定し、SSL/TLS対応とパフォーマンス最適化を行います。

## 基本設定

詳細な設定例は [examples/nginx.conf](./examples/nginx.conf) を参照してください。

### HTTPからHTTPSへのリダイレクト

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

### リバースプロキシ設定

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### SSL/TLS設定

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
```

### Gzip圧縮

```nginx
gzip on;
gzip_vary on;
gzip_comp_level 6;
gzip_types text/plain text/css application/json application/javascript;
```

## 設定の反映

```bash
# 設定テスト
sudo nginx -t

# リロード
sudo systemctl reload nginx
```
