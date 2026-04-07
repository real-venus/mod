# Hyperliquid Dashboard - Project Summary

## Overview

Complete trading dashboard for Hyperliquid DEX with:
- **Next.js frontend** - Modern React-based trading interface
- **FastAPI backend** - Python API server wrapping Hyperliquid module
- **PM2 process management** - Production-ready deployment
- **Real-time data** - Live prices, charts, and position updates

## Project Structure

```
hyperliquid/
├── app/                          # Next.js Frontend (Port 3002)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # Main dashboard page
│   │   │   ├── layout.tsx       # App layout
│   │   │   └── globals.css      # Global styles
│   │   ├── components/
│   │   │   ├── Header.tsx       # Navigation header
│   │   │   ├── Dashboard.tsx    # Stats overview
│   │   │   ├── TradingPanel.tsx # Order placement
│   │   │   ├── Positions.tsx    # Position tracking
│   │   │   ├── OrderBook.tsx    # Live orderbook
│   │   │   └── PriceChart.tsx   # Price charts
│   │   └── lib/
│   │       └── api.ts           # API client
│   ├── package.json
│   ├── next.config.js
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   └── .env.local
│
├── server/                       # FastAPI Backend (Port 8002)
│   ├── api.py                   # Main API server
│   └── requirements.txt         # Python dependencies
│
├── hyperliquid/                  # Python Module
│   └── mod.py                   # Hyperliquid API wrapper
│
├── ecosystem.config.js           # PM2 configuration
├── start.sh                      # Start script
├── stop.sh                       # Stop script
├── status.sh                     # Status check
├── restart.sh                    # Restart helper
├── logs.sh                       # Log viewer
│
├── README.md                     # Main documentation
├── README_DASHBOARD.md           # Dashboard guide
├── INSTALL.md                    # Installation guide
├── DEPLOYMENT.md                 # Deployment guide
└── .env.example                  # Environment template
```

## Technology Stack

### Frontend (app/)
- **Framework**: Next.js 14.0.4 (App Router)
- **UI**: React 18.2, TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **HTTP Client**: Axios
- **Notifications**: React-Toastify
- **Icons**: Lucide React

### Backend (server/)
- **Framework**: FastAPI 0.104.1
- **Server**: Uvicorn with auto-reload
- **Validation**: Pydantic 2.5
- **HTTP**: Requests
- **Crypto**: eth-account

### Infrastructure
- **Process Manager**: PM2
- **Python**: 3.11+
- **Node.js**: 18+

## Key Features

### Dashboard (Frontend)
1. **Overview Tab**
   - Portfolio value
   - Total PnL
   - Open positions count
   - Real-time statistics

2. **Trade Tab**
   - Interactive price chart (6 timeframes)
   - Live orderbook with depth
   - Order placement (limit/market)
   - Symbol selector

3. **Positions Tab**
   - All open positions
   - Real-time PnL tracking
   - Entry/mark/liquidation prices
   - One-click position closing

### API (Backend)

**Market Data Endpoints:**
- `GET /market/{symbol}` - Market metadata
- `GET /orderbook/{symbol}` - L2 orderbook
- `GET /candles/{symbol}` - OHLCV data

**Trading Endpoints:**
- `POST /order` - Place order
- `DELETE /order/{symbol}/{id}` - Cancel order
- `POST /position/{symbol}/close` - Close position

**Account Endpoints:**
- `GET /positions` - Open positions
- `GET /stats` - Account stats
- `GET /user` - User state
- `GET /` - Health check

## Configuration

### Environment Variables

**Server** (`server/.env`):
```env
HYPERLIQUID_TESTNET=true              # true/false
HYPERLIQUID_WALLET_ADDRESS=0x...      # Your wallet
HYPERLIQUID_API_KEY=...               # API key (trading)
HYPERLIQUID_API_SECRET=...            # API secret (trading)
PORT=8002                             # API port
```

**App** (`app/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:8002  # API URL
PORT=3002                                   # App port
```

## Quick Commands

```bash
# Start (testnet mode)
./start.sh testnet

# Start (mainnet mode)
./start.sh mainnet

# Stop all services
./stop.sh

# Check status
./status.sh

# View logs
./logs.sh          # All logs
./logs.sh api      # API only
./logs.sh app      # App only

# Restart
./restart.sh       # All services
./restart.sh api   # API only
./restart.sh app   # App only

# PM2 commands
pm2 status         # Process status
pm2 monit          # Live monitoring
pm2 logs           # View logs
pm2 restart all    # Restart all
```

## Data Flow

### Market Data Flow
```
User Browser
    ↓
Next.js App (3002)
    ↓ HTTP
FastAPI Server (8002)
    ↓
Hyperliquid Module (mod.py)
    ↓ HTTPS
Hyperliquid API
```

### Trading Flow
```
User → Place Order
    ↓
TradingPanel.tsx
    ↓
api.placeOrder()
    ↓
POST /order
    ↓
FastAPI validates
    ↓
hl.place_order()
    ↓
Hyperliquid API
    ↓
Order confirmed
```

### Real-time Updates
- **Charts**: Fetch every page load + interval selector
- **Orderbook**: Auto-refresh every 2 seconds
- **Positions**: Auto-refresh every 5 seconds
- **Stats**: Auto-refresh every 10 seconds

## Security Features

1. **Environment Isolation**
   - Separate .env files for server/app
   - Never commit credentials
   - .gitignore protection

2. **API Security**
   - CORS middleware
   - Request validation
   - Error handling
   - Timeout protection

3. **Trading Safety**
   - Testnet default
   - Confirmation prompts
   - Order validation
   - Error notifications

## Testing Strategy

### Manual Testing
1. Start in testnet mode
2. Test market data endpoints
3. Place small test orders
4. Monitor positions
5. Test position closing

### Automated Testing (Future)
- Unit tests for API endpoints
- Component tests for React
- Integration tests for trading flow
- E2E tests with Playwright

## Deployment Modes

### Development
```bash
# Terminal 1
cd server && uvicorn api:app --reload

# Terminal 2
cd app && npm run dev
```

### Production (PM2)
```bash
# Auto-managed by PM2
./start.sh mainnet

# Auto-restart on crash
# Auto-logging
# Auto-startup on boot (optional)
```

### Docker (Optional)
- Create Dockerfile.api
- Create Dockerfile.app
- Use docker-compose.yml

## Monitoring

### PM2 Dashboard
```bash
pm2 monit
```

### Log Files
- `logs/api-out.log` - API stdout
- `logs/api-error.log` - API errors
- `logs/app-out.log` - App stdout
- `logs/app-error.log` - App errors

### Health Checks
```bash
curl http://localhost:8002/  # API health
curl http://localhost:3002/  # App health
```

## Performance

### Optimization Points
1. **API Caching**: Add Redis for market data
2. **WebSocket**: Real-time orderbook updates
3. **Chart Data**: Cache candle data
4. **Code Splitting**: Lazy load components
5. **Image Optimization**: Next.js Image component

### Current Performance
- **API Response**: ~100-500ms (Hyperliquid dependent)
- **Page Load**: ~1-2s initial, instant navigation
- **Chart Updates**: Real-time with interval selection
- **Memory**: ~200MB API, ~500MB App

## Scaling Options

### Horizontal
```javascript
// ecosystem.config.js
{
  instances: 4,
  exec_mode: 'cluster'
}
```

### Vertical
- Increase PM2 memory limits
- Optimize API response caching
- Use CDN for static assets

### Load Balancing
- Nginx reverse proxy
- Multiple API instances
- Shared cache layer

## Future Enhancements

### Planned Features
- [ ] WebSocket support for real-time data
- [ ] Advanced charting (TradingView)
- [ ] Portfolio analytics
- [ ] Trade history viewer
- [ ] Multiple account support
- [ ] Alert system
- [ ] Mobile responsive design
- [ ] Dark/light theme toggle

### Trading Features
- [ ] Stop loss / Take profit
- [ ] Trailing stops
- [ ] OCO orders
- [ ] Position size calculator
- [ ] Risk/reward calculator

### Agent Features
- [ ] Strategy backtesting
- [ ] Paper trading mode
- [ ] Signal webhooks
- [ ] Trading bot templates

## Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Find process
lsof -i :8002

# Kill it
kill -9 <PID>
```

**Dependencies not found:**
```bash
cd server && pip3 install -r requirements.txt
cd app && npm install
```

**PM2 not found:**
```bash
npm install -g pm2
```

**API not responding:**
```bash
pm2 logs hyperliquid-api
# Check .env configuration
# Verify Hyperliquid API status
```

## Resources

### Documentation
- [Main README](README.md) - Python module docs
- [Dashboard Guide](README_DASHBOARD.md) - Full dashboard guide
- [Installation](INSTALL.md) - Setup instructions
- [Deployment](DEPLOYMENT.md) - Production deployment

### External Links
- [Hyperliquid Docs](https://hyperliquid.gitbook.io/)
- [Hyperliquid API](https://app.hyperliquid.xyz/API)
- [Next.js Docs](https://nextjs.org/docs)
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [PM2 Docs](https://pm2.keymetrics.io/)

## Support

For issues:
1. Check logs: `pm2 logs hyperliquid`
2. Review `.env` files
3. Verify API connectivity
4. Check Hyperliquid status
5. Review documentation

## License

MIT - Part of the Mod framework ecosystem
