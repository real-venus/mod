# Deployment Guide

## Quick Reference

```bash
./start.sh      # Start all services
./stop.sh       # Stop all services
./restart.sh    # Restart all services
./status.sh     # View status
./logs.sh       # View logs
./test.sh       # Run tests
```

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│              PM2 Process Manager            │
├─────────────────────┬───────────────────────┤
│  uniswap-server     │    uniswap-app        │
│  (Python/aiohttp)   │    (Next.js)          │
│  Port: 8080         │    Port: 3000         │
│  Auto-restart: ✓    │    Auto-restart: ✓    │
│  Memory: 500MB      │    Memory: 1GB        │
│  Logs: logs/        │    Logs: logs/        │
└─────────────────────┴───────────────────────┘
```

## Services

### 1. Uniswap Server (Python)
- **Purpose**: Backend API for Uniswap V3 operations
- **Port**: 8080 (configurable via `PORT` env var)
- **Technology**: Python 3.11+, aiohttp, web3.py
- **Endpoints**:
  - `GET /` - Server info
  - `GET /health` - Health check
  - `POST /rpc` - Generic RPC
  - `GET /quote` - Get swap quote
  - `GET /balance` - Get token balance

### 2. Uniswap App (Next.js)
- **Purpose**: Frontend interface
- **Port**: 3000 (configurable via `APP_PORT` env var)
- **Technology**: Next.js 14, React 18, Tailwind CSS
- **Features**: Swap interface, wallet integration, real-time quotes

## Environment Configuration

### Required Variables
```bash
BASE_RPC_URL=https://mainnet.base.org  # Base network RPC
```

### Optional Variables
```bash
PRIVATE_KEY=                          # For automated swaps
APP_PORT=3000                         # Next.js app port
PORT=8080                             # Python server port
NODE_ENV=production                   # Environment mode
FLASHBOTS_RPC_URL=                    # MEV protection
```

## PM2 Configuration

The `ecosystem.config.js` file defines:

### Server Process
- **Name**: `uniswap-server`
- **Restart Policy**: Auto-restart on crash (max 10 times)
- **Memory Limit**: 500MB (restart if exceeded)
- **Min Uptime**: 10 seconds (before considered stable)
- **Restart Delay**: 3 seconds
- **Kill Timeout**: 5 seconds (graceful shutdown)

### App Process
- **Name**: `uniswap-app`
- **Restart Policy**: Auto-restart on crash (max 10 times)
- **Memory Limit**: 1GB (restart if exceeded)
- **Min Uptime**: 10 seconds
- **Restart Delay**: 3 seconds
- **Kill Timeout**: 5 seconds

## Log Management

### Log Locations
```
logs/
├── server-error.log      # Server errors only
├── server-out.log        # Server stdout
├── server-combined.log   # Server all output
├── app-error.log         # App errors only
├── app-out.log           # App stdout
└── app-combined.log      # App all output
```

### View Logs
```bash
# Real-time all logs
./logs.sh
# or
pm2 logs

# Specific service
pm2 logs uniswap-server
pm2 logs uniswap-app

# Last 100 lines
pm2 logs --lines 100

# Filter errors
pm2 logs --err
```

### Log Rotation
PM2 automatically handles log rotation. Configure in ecosystem.config.js:
```javascript
max_size: "10M",      // Rotate when log reaches 10MB
retain: 30,           // Keep last 30 rotated logs
```

## Production Deployment

### 1. Initial Setup
```bash
# Install dependencies
pip3 install -r server/requirements.txt
cd app && npm install && npm run build && cd ..

# Configure environment
cp .env.example .env
nano .env  # Edit with your settings

# Start services
./start.sh
```

### 2. Auto-Start on Boot
```bash
# Generate startup script
pm2 startup

# Run the command it outputs (with sudo)
# Then save current process list
pm2 save
```

### 3. Verify Deployment
```bash
# Run full test suite
./test.sh

# Check status
./status.sh

# Monitor resources
pm2 monit
```

## Monitoring & Alerts

### Basic Monitoring
```bash
# Process status
pm2 list

# Resource usage
pm2 monit

# Detailed info
pm2 describe uniswap-server
pm2 describe uniswap-app
```

### PM2 Plus (Optional)
For advanced monitoring, metrics, and alerts:
```bash
pm2 link <secret> <public>
```

Features:
- Real-time dashboard
- Exception tracking
- Custom metrics
- Email/Slack alerts
- Transaction tracing

## Scaling

### Vertical Scaling
Increase resources in `ecosystem.config.js`:
```javascript
max_memory_restart: '2G',  // Increase memory limit
```

### Horizontal Scaling (App only)
```javascript
instances: 2,              // Run 2 instances
exec_mode: 'cluster'       // Enable cluster mode
```

**Note**: Server uses fork mode (single instance) due to state management.

## Backup & Recovery

### Backup PM2 Configuration
```bash
pm2 save
cp ~/.pm2/dump.pm2 backup/
```

### Restore Configuration
```bash
pm2 resurrect
# or
pm2 start ecosystem.config.js
```

### Backup Environment
```bash
cp .env .env.backup
```

## Troubleshooting

### Services Won't Start
```bash
# Check PM2 logs
pm2 logs

# Check system resources
free -h        # Memory
df -h          # Disk
netstat -tlnp  # Ports
```

### Port Already in Use
```bash
# Find process using port
lsof -i :8080
lsof -i :3000

# Change port in .env
echo "PORT=8081" >> .env
echo "APP_PORT=3001" >> .env
```

### High Memory Usage
```bash
# Check memory usage
pm2 monit

# Restart service
pm2 restart uniswap-server
pm2 restart uniswap-app

# Lower memory limit
# Edit ecosystem.config.js
max_memory_restart: '300M'
```

### Service Keeps Crashing
```bash
# View error logs
pm2 logs --err

# Disable auto-restart temporarily
pm2 stop uniswap-server
pm2 start ecosystem.config.js --no-autorestart

# Check minimum uptime
# May need to increase in ecosystem.config.js
min_uptime: '30s'
```

## Security Best Practices

1. **Environment Variables**: Never commit `.env` file
2. **Private Keys**: Use secure key management (vault, HSM)
3. **Firewall**: Restrict access to ports 3000 and 8080
4. **Updates**: Keep dependencies updated
5. **Monitoring**: Enable alerts for crashes and errors
6. **Backups**: Regular backups of configuration and data
7. **HTTPS**: Use reverse proxy (nginx) with SSL in production

## Updates & Maintenance

### Update Dependencies
```bash
# Python
pip3 install -r server/requirements.txt --upgrade

# Node.js
cd app && npm update && cd ..
```

### Update Code
```bash
# Pull latest changes
git pull

# Rebuild app
cd app && npm run build && cd ..

# Restart services
./restart.sh
```

### Zero-Downtime Deployment
```bash
# Reload instead of restart
pm2 reload uniswap-app
pm2 reload uniswap-server
```

## Performance Optimization

### Python Server
- Use PyPy for faster execution
- Enable connection pooling for web3
- Cache frequently accessed data
- Use async/await properly

### Next.js App
- Enable image optimization
- Use ISR (Incremental Static Regeneration)
- Implement caching strategies
- Optimize bundle size

### PM2 Optimization
```javascript
// ecosystem.config.js
node_args: '--max-old-space-size=1024',  // Increase heap size
cron_restart: '0 0 * * *',               // Daily restart at midnight
```

## Support & Documentation

- **Installation**: See [INSTALL.md](INSTALL.md)
- **Usage**: See [README.md](README.md)
- **API Documentation**: See [server/README.md](server/README.md)
- **PM2 Documentation**: https://pm2.keymetrics.io/docs
