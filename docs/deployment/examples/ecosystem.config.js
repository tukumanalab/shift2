// PM2設定ファイル例 - シフト管理アプリケーション
// パス: /var/www/shift/current/ecosystem.config.js

module.exports = {
  apps: [{
    // アプリケーション名
    name: 'shift-app',

    // エントリーポイント
    script: './dist/src/index.js',

    // クラスタモード設定
    instances: 2,  // CPUコア数に応じて調整（'max'で全コア使用）
    exec_mode: 'cluster',  // クラスタモード（負荷分散）

    // 自動再起動設定
    autorestart: true,  // クラッシュ時に自動再起動
    watch: false,  // ファイル変更の監視（本番環境ではfalse推奨）
    max_memory_restart: '500M',  // メモリ制限（超えたら再起動）
    max_restarts: 10,  // 最大再起動回数
    min_uptime: '10s',  // 最小稼働時間（これ以下で終了した場合は再起動しない）

    // 環境変数
    env: {
      NODE_ENV: 'production'
    },

    // 環境変数ファイル
    env_file: '/var/www/shift/shared/.env',

    // ログ設定
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: '/var/www/shift/shared/logs/error.log',
    out_file: '/var/www/shift/shared/logs/out.log',
    merge_logs: true,  // クラスタモードでログをマージ
    time: true,  // ログにタイムスタンプを追加

    // プロセス間通信（IPC）
    kill_timeout: 5000,  // シャットダウンのタイムアウト（ms）
    listen_timeout: 3000,  // ポートリスニングのタイムアウト（ms）
    shutdown_with_message: true,  // シャットダウンメッセージを送信

    // クラスタモードの待機時間
    wait_ready: true,  // ready信号を待つ
    listen_timeout: 3000,  // ready信号のタイムアウト

    // エラーハンドリング
    exp_backoff_restart_delay: 100,  // 再起動の指数バックオフ遅延
  }],

  // デプロイ設定（オプション）
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-vps-host.com',
      ref: 'origin/main',
      repo: 'git@github.com:your-username/your-repo.git',
      path: '/var/www/shift',
      'post-deploy': 'npm ci && npm run build && pm2 reload ecosystem.config.js --env production',
      'post-setup': 'npm ci && npm run build',
      ssh_options: 'StrictHostKeyChecking=no'
    }
  }
};

// PM2コマンド例:
//
// アプリの起動:
//   pm2 start ecosystem.config.js
//
// アプリのリロード（ゼロダウンタイム）:
//   pm2 reload ecosystem.config.js
//
// アプリの再起動:
//   pm2 restart ecosystem.config.js
//
// アプリの停止:
//   pm2 stop ecosystem.config.js
//
// アプリの削除:
//   pm2 delete ecosystem.config.js
//
// ステータス確認:
//   pm2 status
//   pm2 list
//
// ログの表示:
//   pm2 logs shift-app
//   pm2 logs shift-app --lines 100
//
// モニタリング:
//   pm2 monit
//
// 詳細情報:
//   pm2 show shift-app
//
// 設定の保存（システム再起動時に自動起動）:
//   pm2 save
//
// スタートアップスクリプトの生成:
//   pm2 startup
