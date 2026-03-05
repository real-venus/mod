const path = require('path');

module.exports = {
  apps: [
    {
      name: 'uniswap-server',
      script: 'python3',
      args: 'server/server.py',
      cwd: path.resolve(__dirname),
      interpreter: 'none',
      env: {
        BASE_RPC_URL: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
        PRIVATE_KEY: process.env.PRIVATE_KEY || '',
        PORT: process.env.PORT || '8080',
        NODE_ENV: 'production',
        PYTHONUNBUFFERED: '1'
      },
      error_file: path.resolve(__dirname, 'logs/server-error.log'),
      out_file: path.resolve(__dirname, 'logs/server-out.log'),
      log_file: path.resolve(__dirname, 'logs/server-combined.log'),
      merge_logs: true,
      time: true,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      min_uptime: '10s',
      max_memory_restart: '500M',
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      kill_timeout: 5000,
      wait_ready: false,
      listen_timeout: 10000
    },
    {
      name: 'uniswap-app',
      script: 'npm',
      args: 'run start',
      cwd: path.resolve(__dirname, 'app'),
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.APP_PORT || '3000',
        HOSTNAME: '0.0.0.0'
      },
      error_file: path.resolve(__dirname, 'logs/app-error.log'),
      out_file: path.resolve(__dirname, 'logs/app-out.log'),
      log_file: path.resolve(__dirname, 'logs/app-combined.log'),
      merge_logs: true,
      time: true,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      min_uptime: '10s',
      max_memory_restart: '1G',
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      kill_timeout: 5000,
      wait_ready: false,
      listen_timeout: 10000
    }
  ],

  deploy: {
    production: {
      user: 'broski',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/mod.git',
      path: '/Users/broski/mod/mod/orbit/uniswap',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
