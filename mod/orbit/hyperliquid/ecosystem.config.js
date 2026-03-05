module.exports = {
  apps: [
    {
      name: 'hyperliquid-api',
      script: 'uvicorn',
      args: 'api:app --host 0.0.0.0 --port 8002 --reload',
      interpreter: 'python3',
      cwd: './server',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        PYTHONUNBUFFERED: '1',
        HYPERLIQUID_TESTNET: 'true',
        HYPERLIQUID_WALLET_ADDRESS: '',
        HYPERLIQUID_API_KEY: '',
        HYPERLIQUID_API_SECRET: '',
        PORT: '8002'
      },
      env_production: {
        PYTHONUNBUFFERED: '1',
        HYPERLIQUID_TESTNET: 'false',
        HYPERLIQUID_WALLET_ADDRESS: '',
        HYPERLIQUID_API_KEY: '',
        HYPERLIQUID_API_SECRET: '',
        PORT: '8002'
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      name: 'hyperliquid-app',
      script: 'npm',
      args: 'run dev',
      cwd: './app',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NEXT_PUBLIC_API_URL: 'http://localhost:8002',
        NODE_ENV: 'development',
        PORT: '3002'
      },
      env_production: {
        NEXT_PUBLIC_API_URL: 'http://localhost:8002',
        NODE_ENV: 'production',
        PORT: '3002'
      },
      error_file: './logs/app-error.log',
      out_file: './logs/app-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
}
