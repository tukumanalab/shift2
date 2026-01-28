module.exports = {
  apps: [{
    name: 'shift-app',
    script: './dist/src/index.js',
    instances: 2,
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    },
    env_file: '/var/www/shift/shared/.env',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: '/var/www/shift/shared/logs/error.log',
    out_file: '/var/www/shift/shared/logs/out.log',
    merge_logs: true,
    time: true
  }]
};
