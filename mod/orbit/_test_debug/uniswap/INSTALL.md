# Installation Guide

## Prerequisites

### System Requirements
- **Operating System**: macOS, Linux, or WSL2
- **Python**: 3.11 or higher
- **Node.js**: 18.x or higher
- **npm**: 9.x or higher

### Check Your Environment

```bash
python3 --version  # Should be 3.11+
node --version     # Should be v18.x+
npm --version      # Should be 9.x+
```

## Step-by-Step Installation

### 1. Navigate to Module Directory

```bash
cd /Users/broski/mod/mod/orbit/uniswap
```

### 2. Install PM2 Globally (if not already installed)

```bash
npm install -g pm2
pm2 --version  # Verify installation
```

### 3. Install Python Dependencies

```bash
cd server
pip3 install -r requirements.txt
cd ..
```

### 4. Install Node.js Dependencies

```bash
cd app
npm install
cd ..
```

### 5. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your settings:
```bash
nano .env  # or use your preferred editor
```

**Required settings:**
- `BASE_RPC_URL` - Your Base network RPC endpoint
- `PRIVATE_KEY` - (Optional) For automated swaps

**Optional settings:**
- `APP_PORT` - Port for Next.js app (default: 3000)
- `PORT` - Port for Python server (default: 8080)
- `NODE_ENV` - Environment mode (production/development)

### 6. Build Next.js Application

```bash
cd app
npm run build
cd ..
```

## Starting the Services

### Quick Start

```bash
./start.sh
```

This will:
1. Create logs directory
2. Load environment variables
3. Install any missing dependencies
4. Build the Next.js app (if needed)
5. Start both services with PM2
6. Display status and helpful commands

### Manual Start (Alternative)

```bash
pm2 start ecosystem.config.js
pm2 save
```

## Verifying Installation

### 1. Check PM2 Status

```bash
pm2 list
```

You should see two processes:
- `uniswap-server` - Running
- `uniswap-app` - Running

### 2. Check Server Health

```bash
curl http://localhost:8080/health
```

Expected response:
```json
{
  "status": "healthy",
  "connected": true,
  "block": 12345678
}
```

### 3. Check App

Open browser to: `http://localhost:3000`

### 4. View Logs

```bash
./logs.sh
# or
pm2 logs
```

## Auto-Start on System Boot

To enable automatic start on system reboot:

```bash
pm2 startup
# Follow the instructions provided
pm2 save
```

## Troubleshooting

### Services Won't Start

**Check logs:**
```bash
pm2 logs
```

**Common issues:**
- Port already in use: Change `APP_PORT` or `PORT` in `.env`
- Missing dependencies: Run `./start.sh` again
- Invalid RPC URL: Check `BASE_RPC_URL` in `.env`

### Can't Connect to RPC

**Test RPC connection:**
```bash
curl https://mainnet.base.org \
  -X POST \
  -H "Content-Type: application/json" \
  --data '{"method":"eth_blockNumber","params":[],"id":1,"jsonrpc":"2.0"}'
```

**Solutions:**
- Use a different RPC provider
- Check firewall settings
- Verify network connectivity

### Build Errors

**Clear build cache:**
```bash
cd app
rm -rf .next node_modules
npm install
npm run build
cd ..
```

### PM2 Out of Memory

**Increase memory limit in `ecosystem.config.js`:**
```javascript
max_memory_restart: '1G',  // Increase as needed
```

## Uninstalling

### 1. Stop All Services

```bash
./stop.sh
```

### 2. Remove from PM2 Startup

```bash
pm2 unstartup
```

### 3. Delete PM2 Config

```bash
pm2 delete all
pm2 save --force
```

### 4. Remove Files (Optional)

```bash
cd ..
rm -rf uniswap
```

## Next Steps

- Read [README.md](README.md) for usage examples
- Check [server/README.md](server/README.md) for API documentation
- Review [ecosystem.config.js](ecosystem.config.js) for PM2 configuration
- Configure monitoring and alerts

## Support

For issues and questions:
- Check logs: `./logs.sh`
- View status: `./status.sh`
- Restart services: `./restart.sh`
