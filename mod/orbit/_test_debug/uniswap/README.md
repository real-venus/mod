# Enhanced Uniswap Module

Production-ready Uniswap V3 integration with data scraping, price prediction, and MEV protection.

## Features

### 1. **Smart Routing & Aggregation**
- Multi-pool route optimization for best execution prices
- Cross-DEX aggregation to find liquidity across platforms
- Dynamic path finding that adapts to market conditions

### 2. **MEV Protection**
- Private transaction routing via Flashbots
- Protection against sandwich attacks and front-running
- Secure mempool submission

### 3. **Data Scraping & Prediction**
- Continuous pool state monitoring
- Price prediction models with momentum analysis
- Training data export for ML models

### 4. **Prediction Markets**
- Create markets for token price predictions
- Automated market maker for odds
- Real-time market resolution

### 5. **Gas Optimization**
- Batch swap execution to reduce transaction costs
- Optimized contract calls with minimal overhead
- Smart nonce management for faster confirmations

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- PM2 (automatically installed if missing)

### Installation

1. **Clone and navigate**
   ```bash
   cd /path/to/mod/orbit/uniswap
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start services**
   ```bash
   ./start.sh
   ```

### Management Scripts

```bash
./start.sh     # Start all services with PM2
./stop.sh      # Stop all services
./restart.sh   # Restart all services
./status.sh    # View service status
./logs.sh      # View real-time logs
```

### PM2 Commands

```bash
pm2 list                    # List all processes
pm2 logs                    # View all logs
pm2 logs uniswap-server     # View server logs
pm2 logs uniswap-app        # View app logs
pm2 monit                   # Real-time monitoring
pm2 restart uniswap-server  # Restart specific service
pm2 restart all             # Restart all services
```

## Architecture

```
uniswap/
├── server/              # Python backend (FastAPI/MCP)
│   ├── server.py        # Main server
│   └── requirements.txt # Python dependencies
├── app/                 # Next.js frontend
│   ├── app/            # App router pages
│   └── package.json    # Node dependencies
├── uniswap/            # Python module
│   └── mod.py          # Core Uniswap integration
├── ecosystem.config.js  # PM2 configuration
├── start.sh            # Start script
├── stop.sh             # Stop script
└── .env                # Environment variables
```

## Python API Usage

```python
from uniswap.mod import UniswapV3Mod
from web3 import Web3

# Initialize
w3 = Web3(Web3.HTTPProvider('https://mainnet.base.org'))
router = '0x2626664c2603336E57B271c5C0b26F421741e481'
uniswap = UniswapV3Mod(w3, router)

# Start data scraping
await uniswap.start_scraping(interval_seconds=60)

# Predict token value
prediction = uniswap.predict_token_value('WETH', horizon_minutes=60)
print(f"Predicted price: {prediction['predicted_price']}")

# Create prediction market
market = uniswap.create_prediction_market(
    token='WETH',
    target_price=3000.0,
    hours_until_expiry=24
)

# Place bet
bet = uniswap.bet_on_market(
    market_id=market['market_id'],
    user='0x...',
    is_yes=True,
    amount=100.0
)

# Execute protected swap
result = await uniswap.execute_swap_with_protection(
    token_in="0x4200000000000000000000000000000000000006",  # WETH
    token_out="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", # USDC
    amount=1000000,
    max_slippage=0.005  # 0.5%
)
```

## Key Benefits

✅ Better prices through intelligent routing
✅ Protection from MEV attacks
✅ Lower gas costs
✅ Price prediction and market intelligence
✅ Automated data collection for ML
✅ Production-ready PM2 deployment
✅ Higher capital efficiency for LPs
✅ Reduced slippage and failed transactions

## Production Deployment

The module uses PM2 for process management with:
- Automatic restarts on crashes
- Log rotation and management
- Memory limits and monitoring
- Zero-downtime deployment support

### Auto-start on system boot

```bash
pm2 startup
pm2 save
```

## Logs

Logs are stored in `./logs/`:
- `server-*.log` - Python server logs
- `app-*.log` - Next.js app logs

View logs in real-time:
```bash
./logs.sh
# or
pm2 logs
```