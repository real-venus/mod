module.exports = {
  apps: [
    {
      name: 'openclaw-gateway',
      script: 'openclaw',
      args: 'gateway --port 18789 --verbose',
      interpreter: 'none',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: 'openclaw-api',
      script: 'uvicorn',
      args: 'api:app --host 0.0.0.0 --port 50120',
      interpreter: 'none',
      cwd: '/root/mod/mod/orbit/openclaw',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      env: {
        PYTHONPATH: '/root/mod',
        OPENCLAW_GATEWAY_PORT: '18789',
      },
    },
    {
      name: 'openclaw-app',
      script: 'node_modules/.bin/next',
      args: 'start -p 3120',
      cwd: '/root/mod/mod/orbit/openclaw/app',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      env: {
        NEXT_PUBLIC_API_URL: 'http://localhost:50120',
        NODE_ENV: 'production',
      },
    },
  ],
}
