# Hyperliquid Dashboard - Installation Guide

## Prerequisites

- **Node.js** 18+ (for the Next.js app)
- **Python** 3.11+ (for the API server)
- **npm** or **yarn** (package manager)
- **PM2** (process manager - will be auto-installed)

## Quick Start

### 1. Install Dependencies

The `start.sh` script will automatically install all dependencies, but you can install them manually:

```bash
# Install Python dependencies
cd server
pip3 install -r requirements.txt
cd ..

# Install Node.js dependencies
cd app
npm install
cd ..
```

### 2. Configure Environment

Copy the example environment file and edit it:

```bash
cp .env.example server/.env
```

Edit `server/.env` with your configuration:

```env
# Use testnet for testing (recommended)
HYPERLIQUID_TESTNET=true

# Your wallet address (to view positions)
HYPERLIQUID_WALLET_ADDRESS=0xYourWalletAddress

# API credentials (for trading - get from https://app.hyperliquid.xyz/API)
HYPERLIQUID_API_KEY=your_api_key
HYPERLIQUID_API_SECRET=your_api_secret
```

### 3. Start the Dashboard

For **testnet** (recommended for testing):
```bash
./start.sh testnet
```

For **mainnet** (real trading):
```bash
./start.sh mainnet
```

The dashboard will be available at:
- **Dashboard UI**: http://localhost:3002
- **API**: http://localhost:8002
- **API Docs**: http://localhost:8002/docs

## Configuration

### Testnet Mode

Testnet is the default and safest way to test the dashboard:

```bash
./start.sh testnet
```

- Uses Hyperliquid testnet
- No real funds at risk
- Perfect for testing strategies

### Mainnet Mode

For live trading with real funds:

```bash
./start.sh mainnet
```

⚠️ **WARNING**: This uses real funds. Make sure you understand the risks.

## API Credentials

To enable trading functionality:

1. Visit https://app.hyperliquid.xyz/API
2. Generate API keys
3. Add them to `server/.env`:
   ```env
   HYPERLIQUID_API_KEY=your_key
   HYPERLIQUID_API_SECRET=your_secret
   ```

**Security Notes:**
- Never commit `.env` files to version control
- Keep your API keys secure
- Consider using read-only keys for monitoring
- Use IP restrictions if available

## Managing the Dashboard

### Start
```bash
./start.sh [testnet|mainnet]
```

### Stop
```bash
./stop.sh
```

### Status
```bash
./status.sh
```

Or use PM2 directly:
```bash
pm2 status                    # View all processes
pm2 logs hyperliquid         # View all logs
pm2 logs hyperliquid-api     # API logs only
pm2 logs hyperliquid-app     # App logs only
pm2 restart hyperliquid      # Restart all
pm2 monit                    # Real-time monitoring
```

## Troubleshooting

### API server won't start

Check the logs:
```bash
pm2 logs hyperliquid-api
```

Common issues:
- Missing Python dependencies: `cd server && pip3 install -r requirements.txt`
- Port already in use: Change `PORT` in `.env`
- Invalid API credentials: Check your `.env` file

### Dashboard app won't start

Check the logs:
```bash
pm2 logs hyperliquid-app
```

Common issues:
- Missing Node modules: `cd app && npm install`
- Port 3002 already in use: Change `PORT` in `app/.env.local`

### Can't place orders

Make sure:
1. API credentials are configured in `server/.env`
2. Your wallet has sufficient balance
3. You're using the correct network (testnet/mainnet)

### PM2 not found

Install PM2 globally:
```bash
npm install -g pm2
```

## Development Mode

For development with hot-reload:

### Terminal 1 - Run API server
```bash
cd server
uvicorn api:app --host 0.0.0.0 --port 8002 --reload
```

### Terminal 2 - Run Next.js app
```bash
cd app
npm run dev
```

## Production Deployment

For production use:

1. Build the Next.js app:
   ```bash
   cd app
   npm run build
   ```

2. Update `ecosystem.config.js` to use production mode:
   ```bash
   pm2 start ecosystem.config.js --env production
   ```

3. Set up PM2 to auto-start on system boot:
   ```bash
   pm2 startup
   pm2 save
   ```

## Ports

Default ports used:
- **API Server**: 8002
- **Dashboard App**: 3002

To change ports, edit:
- `server/.env` - Change `PORT`
- `app/.env.local` - Change `PORT` and `NEXT_PUBLIC_API_URL`
- `ecosystem.config.js` - Update port values

## Support

For issues:
1. Check logs: `pm2 logs hyperliquid`
2. Review Hyperliquid API docs: https://hyperliquid.gitbook.io/
3. Check your configuration in `.env` files
