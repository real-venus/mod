# Hyperliquid Trading Dashboard

A comprehensive web dashboard for trading on Hyperliquid DEX with real-time data, charts, and position management.

## Features

- 📊 **Real-time Market Data** - Live prices, orderbook, and candlestick charts
- 💹 **Advanced Trading** - Place limit and market orders directly from the dashboard
- 📈 **Portfolio Management** - Track positions, PnL, and account statistics
- 🎯 **Multi-Asset Support** - Trade BTC, ETH, SOL, ARB, OP, MATIC and more
- 🔄 **Auto-Refresh** - Real-time updates without manual refresh
- 🌙 **Dark Mode** - Beautiful dark theme optimized for traders
- 🤖 **Agent-Ready** - API endpoints for automated trading strategies
- 🔒 **Testnet Support** - Safe testing environment before live trading

## Quick Start

### 1. Start the Dashboard

```bash
# Testnet mode (recommended for testing)
./start.sh testnet

# Mainnet mode (real trading)
./start.sh mainnet
```

### 2. Access the Dashboard

- **Dashboard**: http://localhost:3002
- **API**: http://localhost:8002
- **API Docs**: http://localhost:8002/docs

### 3. Configure (Optional)

For trading functionality, add your API keys to `server/.env`:

```env
HYPERLIQUID_TESTNET=true
HYPERLIQUID_WALLET_ADDRESS=0xYourAddress
HYPERLIQUID_API_KEY=your_key
HYPERLIQUID_API_SECRET=your_secret
```

## Dashboard Features

### Overview Tab
- Portfolio value and total PnL
- Open positions count
- Real-time statistics

### Trade Tab
- Interactive price chart with multiple timeframes
- Live orderbook with depth visualization
- Order placement (limit & market)
- Symbol selector for quick switching

### Positions Tab
- All open positions with PnL tracking
- Entry price, mark price, and liquidation levels
- One-click position closing
- Real-time profit/loss updates

## API Endpoints

### Market Data
```bash
GET /market/{symbol}        # Market metadata
GET /orderbook/{symbol}     # L2 orderbook
GET /candles/{symbol}       # OHLCV data
```

### Trading
```bash
POST /order                 # Place order
DELETE /order/{symbol}/{id} # Cancel order
POST /position/{symbol}/close # Close position
```

### Account
```bash
GET /positions              # Open positions
GET /stats                  # Account stats
GET /user                   # User state
```

## Agent Trading

The API is designed for automated trading agents:

```python
import mod as m
import requests

# Get market data
response = requests.get('http://localhost:8002/market/BTC')
market = response.json()

# Place order
order = {
    'symbol': 'BTC',
    'is_buy': True,
    'size': 0.1,
    'price': 50000,
    'order_type': 'limit'
}
response = requests.post('http://localhost:8002/order', json=order)

# Check positions
positions = requests.get('http://localhost:8002/positions').json()
```

Or use the Python module directly:

```python
import mod as m

hl = m.mod('hyperliquid')()

# Fetch market data
market = hl.fetch_market_data('BTC')

# Place order
order = hl.place_order(
    symbol='BTC',
    is_buy=True,
    size=0.1,
    price=50000
)

# Get positions
state = hl.fetch_user_state('0xYourAddress')
```

## Management

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

# Or use PM2 directly
pm2 status
pm2 logs hyperliquid
pm2 monit
```

### Restart
```bash
pm2 restart hyperliquid
```

## Configuration

### Environment Variables

**Server** (`server/.env`):
```env
HYPERLIQUID_TESTNET=true
HYPERLIQUID_WALLET_ADDRESS=0x...
HYPERLIQUID_API_KEY=...
HYPERLIQUID_API_SECRET=...
PORT=8002
```

**App** (`app/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:8002
PORT=3002
```

### Supported Symbols

Default symbols: BTC, ETH, SOL, ARB, OP, MATIC

Add more in `app/src/components/TradingPanel.tsx`

### Timeframes

Available chart intervals: 1m, 5m, 15m, 1h, 4h, 1d

## Architecture

```
hyperliquid/
├── app/                    # Next.js dashboard
│   ├── src/
│   │   ├── app/           # Pages
│   │   ├── components/    # React components
│   │   └── lib/           # API client
│   └── package.json
│
├── server/                 # FastAPI backend
│   ├── api.py             # Main API server
│   └── requirements.txt
│
├── hyperliquid/
│   └── mod.py             # Python module
│
├── ecosystem.config.js     # PM2 configuration
├── start.sh               # Start script
├── stop.sh                # Stop script
└── status.sh              # Status check
```

## Security

- Never commit `.env` files to version control
- Keep API keys secure and rotate regularly
- Use testnet for testing strategies
- Consider IP restrictions on API keys
- Run behind reverse proxy in production

## Testnet vs Mainnet

### Testnet (Default)
- Safe for testing
- No real funds at risk
- Get testnet funds from Hyperliquid faucet
- Perfect for strategy development

### Mainnet
- Real trading with real funds
- Requires API credentials
- Always test on testnet first
- Start with small position sizes

## Monitoring

### PM2 Dashboard
```bash
pm2 monit
```

### Logs
```bash
pm2 logs hyperliquid-api   # API logs
pm2 logs hyperliquid-app   # App logs
pm2 logs hyperliquid --lines 100  # Last 100 lines
```

### Health Checks
```bash
curl http://localhost:8002/    # API health
curl http://localhost:3002/    # App health
```

## Troubleshooting

### Dashboard won't load
- Check `pm2 logs hyperliquid-app`
- Verify Node.js dependencies: `cd app && npm install`
- Check port 3002 is available

### API errors
- Check `pm2 logs hyperliquid-api`
- Verify Python dependencies: `cd server && pip3 install -r requirements.txt`
- Validate `.env` configuration

### Can't place orders
- Verify API credentials in `server/.env`
- Check wallet has sufficient balance
- Ensure correct network (testnet/mainnet)

### PM2 not found
```bash
npm install -g pm2
```

## Development

### Run in Development Mode

**Terminal 1 - API:**
```bash
cd server
uvicorn api:app --host 0.0.0.0 --port 8002 --reload
```

**Terminal 2 - App:**
```bash
cd app
npm run dev
```

### Build for Production

```bash
cd app
npm run build
npm run start
```

## Documentation

- [Installation Guide](INSTALL.md) - Detailed setup instructions
- [Deployment Guide](DEPLOYMENT.md) - Production deployment
- [Hyperliquid API Docs](README.md) - Python module documentation

## Support

For issues:
1. Check PM2 logs: `pm2 logs hyperliquid`
2. Review configuration in `.env` files
3. Verify Hyperliquid API status
4. Check [Hyperliquid Documentation](https://hyperliquid.gitbook.io/)

## License

MIT - Part of the Mod framework ecosystem
