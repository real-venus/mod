const path = require('path');
const fs = require('fs');

// Load config.json
let cfg = {};
try {
  cfg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'config.json'), 'utf8'));
} catch (e) {
  console.warn('config.json not found, using defaults');
}

const enginePort = process.env.PORT || cfg.engine?.port || 8080;
const appPort = process.env.APP_PORT || cfg.app?.port || 3000;
const dataPath = path.resolve(__dirname, cfg.engine?.data_path || 'data');
const baseRpc = process.env.BASE_RPC_URL || cfg.chains?.base?.rpc_url || 'https://base.gateway.tenderly.co';
const polygonRpc = process.env.POLYGON_RPC_URL || cfg.chains?.polygon?.rpc_url || 'https://polygon-bor-rpc.publicnode.com';

module.exports = {
  apps: [
    {
      name: 'uniswap-engine',
      script: path.resolve(__dirname, 'engine/target/release/uniswap-engine'),
      cwd: path.resolve(__dirname, 'engine'),
      interpreter: 'none',
      env: {
        BASE_RPC_URL: baseRpc,
        POLYGON_RPC_URL: polygonRpc,
        PORT: enginePort,
        DATA_PATH: dataPath,
        RUST_LOG: cfg.engine?.log_level || 'uniswap_engine=info',
        CONFIG_PATH: path.resolve(__dirname, 'config.json'),
      },
      error_file: path.resolve(__dirname, 'logs/engine-error.log'),
      out_file: path.resolve(__dirname, 'logs/engine-out.log'),
      log_file: path.resolve(__dirname, 'logs/engine-combined.log'),
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
      script: './node_modules/.bin/next',
      args: 'start',
      cwd: path.resolve(__dirname, 'app'),
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        PORT: appPort,
        HOSTNAME: '0.0.0.0',
        NEXT_PUBLIC_ENGINE_URL: `http://localhost:${enginePort}`,
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
  ]
};
