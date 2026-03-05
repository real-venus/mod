module.exports = {
  apps: [
    {
      name: 'polycopy-api',
      script: 'uvicorn',
      args: 'api:app --host 0.0.0.0 --port 8001 --reload',
      interpreter: 'python3',
      cwd: './server',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        PYTHONUNBUFFERED: '1',
        POLYCOPY_NETWORK: 'testnet',
        POLYCOPY_DRY_RUN: 'true'
      },
      env_production: {
        PYTHONUNBUFFERED: '1',
        POLYCOPY_NETWORK: 'mainnet',
        POLYCOPY_DRY_RUN: 'false'
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      name: 'polycopy-app',
      script: 'npm',
      args: 'run dev',
      cwd: './app',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NEXT_PUBLIC_API_URL: 'http://localhost:8001',
        NODE_ENV: 'development',
        PORT: '3001'
      },
      env_production: {
        NEXT_PUBLIC_API_URL: 'http://localhost:8001',
        NODE_ENV: 'production',
        PORT: '3001'
      },
      error_file: './logs/app-error.log',
      out_file: './logs/app-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
}
