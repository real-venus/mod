# Polycopy - PM2 Setup Guide

This guide covers running Polycopy with PM2 instead of Docker.

## Quick Start

```bash
# Start both API and Web services
./start.sh

# Start in testnet mode (default - safe for testing)
./start.sh testnet

# Start in mainnet mode (REAL FUNDS - use with caution)
./start.sh mainnet

# Stop all services
./stop.sh
```

## Prerequisites

- Python 3.11+
- Node.js 16+
- PM2 (will be auto-installed if missing)

## PM2 Management

### View Process Status
```bash
pm2 status
```

### View Logs
```bash
# All logs
pm2 logs polycopy

# API logs only
pm2 logs polycopy-api

# Web logs only
pm2 logs polycopy-app

# Follow logs in real-time
pm2 logs polycopy-api --lines 100

# Clear logs
pm2 flush
```

### Process Control
```bash
# Restart all services
pm2 restart all

# Restart specific service
pm2 restart polycopy-api
pm2 restart polycopy-app

# Stop specific service
pm2 stop polycopy-api
pm2 stop polycopy-app

# Delete/remove services
pm2 delete polycopy-api
pm2 delete polycopy-app

# Monitor processes (interactive)
pm2 monit
```

### Auto-Start on System Reboot
```bash
# Generate startup script
pm2 startup

# Save current process list
pm2 save

# Disable startup
pm2 unstartup
```

## Services

### API Server
- **Port**: 8001
- **URL**: http://localhost:8001
- **Docs**: http://localhost:8001/docs
- **Health Check**: http://localhost:8001/api/health

### Web UI
- **Port**: 3001
- **URL**: http://localhost:3001

## Configuration

### Environment Variables

Edit `ecosystem.config.js` to customize:

```javascript
env: {
  PYTHONUNBUFFERED: '1',
  POLYCOPY_NETWORK: 'testnet',
  POLYCOPY_DRY_RUN: 'true'
}
```

### Network Modes

- **Testnet** (default): Safe for testing, dry-run enabled
- **Mainnet**: Real trading, use with caution

## Troubleshooting

### API Won't Start

```bash
# Check logs
pm2 logs polycopy-api --lines 50

# Check if port is in use
lsof -i :8001

# Restart API
pm2 restart polycopy-api
```

### Web UI Connection Error

1. Verify API is running: `curl http://localhost:8001/`
2. Check API logs: `pm2 logs polycopy-api`
3. Verify `.env.local` has correct API URL: `NEXT_PUBLIC_API_URL=http://localhost:8001`
4. Restart app: `pm2 restart polycopy-app`

### "Failed to connect to API" Error

This happens when the API server is not accessible. The Web UI will show:
- Red "API Disconnected" indicator in the header
- Toast notification (shown once, not repeatedly)

**Solutions**:
1. Check API is running: `pm2 status`
2. Verify API is accessible: `curl http://localhost:8001/`
3. Check firewall settings
4. Review API logs: `pm2 logs polycopy-api`

### Clear Everything and Restart

```bash
# Stop all
./stop.sh

# Clear PM2 logs
pm2 flush

# Delete PM2 processes
pm2 delete all

# Re-install dependencies and restart
./start.sh
```

## Log Files

PM2 maintains logs in:
- `logs/api-error.log` - API error logs
- `logs/api-out.log` - API output logs
- `logs/app-error.log` - Web error logs
- `logs/app-out.log` - Web output logs

You can also view logs via PM2's built-in logging:
```bash
pm2 logs --help
```

## Performance Monitoring

```bash
# Interactive monitoring dashboard
pm2 monit

# Get detailed info
pm2 show polycopy-api
pm2 show polycopy-app

# Memory usage
pm2 list
```

## Advantages Over Docker

1. **Native Performance**: No containerization overhead
2. **Easier Debugging**: Direct access to logs and processes
3. **Hot Reload**: Automatic reload on code changes (API and Web)
4. **Simple Management**: No Docker/compose needed
5. **Resource Efficient**: Lower memory footprint
6. **Better Integration**: Works seamlessly with local mod framework

## Migration from Docker

If you were using Docker:

1. Stop Docker containers:
   ```bash
   docker-compose down
   ```

2. Start with PM2:
   ```bash
   ./start.sh
   ```

All data in `~/.mod/polycopy/` will be preserved.
