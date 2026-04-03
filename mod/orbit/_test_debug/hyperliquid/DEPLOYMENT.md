# Hyperliquid Dashboard - Deployment Guide

## Running with PM2

PM2 is the recommended process manager for production deployments. It handles:
- Auto-restart on crashes
- Log management
- Process monitoring
- Cluster mode support
- Startup scripts

### Quick Deploy

```bash
# Start in testnet mode (safe)
./start.sh testnet

# Or mainnet mode (real trading)
./start.sh mainnet
```

### PM2 Management

```bash
# View status
pm2 status

# View logs
pm2 logs hyperliquid

# Restart services
pm2 restart hyperliquid-api
pm2 restart hyperliquid-app
pm2 restart all

# Stop services
./stop.sh

# Monitor in real-time
pm2 monit
```

### Auto-Start on System Boot

Set up PM2 to start automatically when your server reboots:

```bash
# Generate startup script
pm2 startup

# Save current process list
pm2 save
```

## Environment Configuration

### Development
```bash
# .env
HYPERLIQUID_TESTNET=true
HYPERLIQUID_WALLET_ADDRESS=0x...
```

### Production
```bash
# .env
HYPERLIQUID_TESTNET=false
HYPERLIQUID_WALLET_ADDRESS=0x...
HYPERLIQUID_API_KEY=your_key
HYPERLIQUID_API_SECRET=your_secret
```

## Ecosystem Configuration

Edit `ecosystem.config.js` to customize PM2 behavior:

```javascript
{
  name: 'hyperliquid-api',
  instances: 1,              // Number of instances
  max_memory_restart: '1G',  // Auto-restart if exceeds memory
  autorestart: true,         // Auto-restart on crash
  watch: false,              // Watch for file changes
}
```

## Monitoring & Logs

### View Logs
```bash
# All logs
pm2 logs

# Specific service
pm2 logs hyperliquid-api
pm2 logs hyperliquid-app

# Last 100 lines
pm2 logs --lines 100

# Follow logs in real-time
pm2 logs --lines 0
```

### Log Files

Logs are stored in `./logs/`:
- `api-out.log` - API stdout
- `api-error.log` - API stderr
- `app-out.log` - App stdout
- `app-error.log` - App stderr

### Monitoring Dashboard

```bash
# Terminal UI
pm2 monit

# Web dashboard (optional)
pm2 install pm2-server-monit
```

## Security Best Practices

### API Keys
- Store in environment variables, never in code
- Use read-only keys when possible
- Rotate keys regularly
- Limit IP access if available

### Network
- Use firewall to restrict access
- Consider running behind nginx reverse proxy
- Enable HTTPS in production

### Environment Files
```bash
# Protect .env files
chmod 600 server/.env
chmod 600 app/.env.local

# Never commit to git
echo "server/.env" >> .gitignore
echo "app/.env.local" >> .gitignore
```

## Reverse Proxy (Nginx)

Example nginx configuration:

```nginx
# Dashboard
server {
    listen 80;
    server_name hyperliquid.yourdomain.com;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# API
server {
    listen 80;
    server_name api.hyperliquid.yourdomain.com;

    location / {
        proxy_pass http://localhost:8002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Docker Deployment (Optional)

If you prefer Docker, create a `docker-compose.yml`:

```yaml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    ports:
      - "8002:8002"
    environment:
      - HYPERLIQUID_TESTNET=true
    env_file:
      - server/.env
    restart: unless-stopped

  app:
    build:
      context: .
      dockerfile: Dockerfile.app
    ports:
      - "3002:3002"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8002
    depends_on:
      - api
    restart: unless-stopped
```

## Scaling

### Horizontal Scaling (Multiple Instances)

Edit `ecosystem.config.js`:

```javascript
{
  name: 'hyperliquid-api',
  instances: 4,  // Run 4 instances
  exec_mode: 'cluster'
}
```

### Vertical Scaling (More Resources)

```javascript
{
  name: 'hyperliquid-api',
  max_memory_restart: '2G',  // Increase memory limit
}
```

## Health Checks

### Manual Check
```bash
# Check API health
curl http://localhost:8002/

# Check app health
curl http://localhost:3002/
```

### Automated Monitoring
```bash
# PM2 monitoring
pm2 install pm2-auto-pull  # Auto-update from git
pm2 install pm2-logrotate  # Rotate logs
```

## Backup & Recovery

### Backup Configuration
```bash
# Backup PM2 configuration
pm2 save

# Backup env files
tar -czf hyperliquid-config-backup.tar.gz server/.env app/.env.local ecosystem.config.js
```

### Recovery
```bash
# Restore PM2 processes
pm2 resurrect

# Or restart from scratch
./start.sh testnet
```

## Updates & Maintenance

### Update Dependencies
```bash
# Stop services
./stop.sh

# Update Python dependencies
cd server && pip3 install -r requirements.txt --upgrade && cd ..

# Update Node dependencies
cd app && npm update && cd ..

# Restart
./start.sh
```

### Zero-Downtime Reload
```bash
pm2 reload hyperliquid-api
pm2 reload hyperliquid-app
```

## Troubleshooting

### High Memory Usage
```bash
# Check memory
pm2 list

# Restart to clear memory
pm2 restart hyperliquid-api
```

### Process Crashes
```bash
# View error logs
pm2 logs hyperliquid-api --err

# Common fixes:
# 1. Check .env configuration
# 2. Verify API credentials
# 3. Check network connectivity
# 4. Review error logs
```

### Port Conflicts
```bash
# Find what's using port 8002
lsof -i :8002

# Kill process if needed
kill -9 <PID>

# Or change port in .env
```

## Performance Tuning

### API Server
```python
# In server/api.py, adjust uvicorn settings:
uvicorn.run(
    app,
    host="0.0.0.0",
    port=8002,
    workers=4,  # Multiple workers
    log_level="info"
)
```

### Next.js App
```bash
# Build for production
cd app
npm run build
npm run start  # Use production server instead of dev
```

## Monitoring Checklist

- [ ] PM2 processes are running
- [ ] Logs are rotating properly
- [ ] Memory usage is stable
- [ ] API endpoints respond quickly
- [ ] No error spikes in logs
- [ ] Backups are current

## Support

For deployment issues:
1. Check `pm2 logs hyperliquid`
2. Verify `.env` configuration
3. Test API: `curl http://localhost:8002/`
4. Review this deployment guide
