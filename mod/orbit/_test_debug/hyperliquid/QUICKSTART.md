# Hyperliquid Dashboard - Quick Start Guide

Get your Hyperliquid trading dashboard running in under 5 minutes.

## Prerequisites Check

```bash
# Check Python version (need 3.11+)
python3 --version

# Check Node.js version (need 18+)
node --version

# Check npm
npm --version
```

If any are missing, install them first:
- **Python**: https://www.python.org/downloads/
- **Node.js**: https://nodejs.org/

## Installation (3 Steps)

### Step 1: Clone/Navigate
```bash
cd /Users/broski/mod/mod/orbit/hyperliquid
```

### Step 2: Configure (Optional for viewing only)
```bash
# Copy example env file
cp .env.example server/.env

# Edit with your details (optional - skip for read-only mode)
nano server/.env
```

For **read-only mode** (no trading), you can leave the API keys empty and just set:
```env
HYPERLIQUID_TESTNET=true
HYPERLIQUID_WALLET_ADDRESS=  # Leave empty for demo mode
```

For **full trading**, set all values:
```env
HYPERLIQUID_TESTNET=true
HYPERLIQUID_WALLET_ADDRESS=0xYourAddress
HYPERLIQUID_API_KEY=your_key
HYPERLIQUID_API_SECRET=your_secret
```

### Step 3: Start!
```bash
# Start in testnet mode (safe)
./start.sh testnet
```

That's it! The script will:
- ✅ Install all dependencies automatically
- ✅ Start both API and App with PM2
- ✅ Wait for services to be ready
- ✅ Display access URLs

## Access Your Dashboard

Once started, open in your browser:

- **Dashboard**: http://localhost:3002
- **API**: http://localhost:8002
- **API Docs**: http://localhost:8002/docs

## What You Can Do

### Without API Credentials (Read-Only)
- ✅ View market data
- ✅ See orderbooks
- ✅ View price charts
- ✅ Browse symbols
- ❌ Cannot place trades
- ❌ Cannot view positions

### With Wallet Address Only
- ✅ Everything above, plus:
- ✅ View your positions
- ✅ See your PnL
- ✅ Track portfolio value
- ❌ Cannot place trades

### With Full API Credentials
- ✅ Everything above, plus:
- ✅ Place limit orders
- ✅ Place market orders
- ✅ Close positions
- ✅ Cancel orders

## Getting API Credentials

1. Visit: https://app.hyperliquid.xyz/API
2. Connect your wallet
3. Generate API keys
4. **IMPORTANT**: Save your secret key (shown only once)
5. Add to `server/.env`

## Quick Commands

```bash
# Stop everything
./stop.sh

# Check status
./status.sh

# View logs
./logs.sh

# Restart
./restart.sh

# View API logs only
./logs.sh api

# View App logs only
./logs.sh app
```

## PM2 Commands (Advanced)

```bash
# View all processes
pm2 status

# Monitor in real-time
pm2 monit

# View logs
pm2 logs hyperliquid

# Restart specific service
pm2 restart hyperliquid-api
pm2 restart hyperliquid-app

# Stop specific service
pm2 stop hyperliquid-api
```

## Testnet vs Mainnet

### Testnet (Recommended First)
```bash
./start.sh testnet
```
- Safe for testing
- No real money
- Get testnet funds from faucet
- Perfect for learning

### Mainnet (Real Trading)
```bash
./start.sh mainnet
```
- Real funds at risk
- Requires API credentials
- **Start small!**
- Test on testnet first

## Directory Structure

```
hyperliquid/
├── app/              # Next.js dashboard (port 3002)
├── server/           # FastAPI backend (port 8002)
├── hyperliquid/      # Python module
├── logs/             # Log files (created automatically)
├── start.sh          # Start script
├── stop.sh           # Stop script
├── status.sh         # Status check
└── *.md              # Documentation
```

## Troubleshooting

### "Port already in use"
```bash
# Find what's using the port
lsof -i :8002   # For API
lsof -i :3002   # For App

# Kill the process
kill -9 <PID>
```

### "command not found: pm2"
```bash
npm install -g pm2
```

### "Python dependencies missing"
```bash
cd server
pip3 install -r requirements.txt
```

### "Node dependencies missing"
```bash
cd app
npm install
```

### Services won't start
```bash
# Check the logs
pm2 logs hyperliquid

# Or view specific service
pm2 logs hyperliquid-api
pm2 logs hyperliquid-app
```

### API returns errors
1. Check `server/.env` is configured
2. Verify Hyperliquid API is online
3. Check your API credentials are valid
4. Ensure sufficient wallet balance

## Next Steps

### Learn More
- [README_DASHBOARD.md](README_DASHBOARD.md) - Full dashboard guide
- [INSTALL.md](INSTALL.md) - Detailed installation
- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment
- [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) - Technical overview

### Configure
- Change ports in `.env` files
- Customize symbols in `app/src/components/TradingPanel.tsx`
- Adjust refresh intervals in components

### Deploy
- Set up auto-start: `pm2 startup && pm2 save`
- Configure nginx reverse proxy
- Enable HTTPS
- Set up monitoring

## Support

### Check Logs First
```bash
# All logs
pm2 logs hyperliquid

# Last 100 lines
pm2 logs --lines 100

# API only
pm2 logs hyperliquid-api

# App only
pm2 logs hyperliquid-app
```

### Common Solutions
1. **Restart services**: `./restart.sh`
2. **Check config**: Review `server/.env`
3. **Reinstall deps**: Run `./start.sh` again
4. **Clear PM2**: `pm2 delete all && ./start.sh`

### Get Help
- Read documentation in this directory
- Check Hyperliquid docs: https://hyperliquid.gitbook.io/
- Review error logs carefully

## Safety Checklist

Before trading on mainnet:

- [ ] Tested thoroughly on testnet
- [ ] API credentials are correct
- [ ] Wallet has sufficient balance
- [ ] Started with small position sizes
- [ ] Understand order types
- [ ] Know how to close positions
- [ ] `.env` file is secure (not committed to git)

## Features at a Glance

### Dashboard Tab
- Portfolio value
- Total PnL
- Open positions count
- Live statistics

### Trade Tab
- Price charts (6 timeframes)
- Live orderbook
- Order placement
- Quick symbol switching

### Positions Tab
- All open positions
- Real-time PnL
- Liquidation prices
- One-click close

## Configuration Files

- `server/.env` - API configuration
- `app/.env.local` - App configuration
- `ecosystem.config.js` - PM2 configuration

## Ports

Default ports (changeable in config):
- **App**: 3002
- **API**: 8002

## Auto-Start on Boot (Optional)

To start automatically when your computer boots:

```bash
pm2 startup
pm2 save
```

To disable:
```bash
pm2 unstartup
```

## Update

To update the dashboard:

```bash
# Stop services
./stop.sh

# Pull latest changes (if using git)
git pull

# Restart
./start.sh testnet
```

## Clean Slate

To completely reset:

```bash
# Stop everything
./stop.sh

# Remove PM2 processes
pm2 delete all

# Clear logs
rm -rf logs/*

# Reinstall
./start.sh testnet
```

---

**Ready to trade? Start with testnet mode and explore the dashboard!**

```bash
./start.sh testnet
```

Then visit: http://localhost:3002
