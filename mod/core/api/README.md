# Wallet Follower Bot 🚀

Automated trading bot that follows a specific wallet's trades across:
- **Ethereum**: Uniswap V3 & V4
- **Solana**: Raydium & Orca

## Features ✨

- Real-time transaction monitoring
- Automatic trade copying with configurable slippage
- Multi-chain support (Ethereum + Solana)
- Docker containerized deployment
- Comprehensive logging
- Position size limits for risk management

## Quick Start 🏃

### 1. Clone and Configure

```bash
git clone <your-repo>
cd wallet-follower
cp .env.example .env
```

### 2. Edit `.env` with your settings:

```bash
TARGET_WALLET=0x...  # Wallet to follow
ETHEREUM_RPC=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
SOLANA_RPC=https://api.mainnet-beta.solana.com
PRIVATE_KEY=your_ethereum_private_key
SOLANA_PRIVATE_KEY=your_solana_private_key_base58
```

### 3. Run with Docker Compose

```bash
docker-compose up -d
```

### 4. Monitor Logs

```bash
docker-compose logs -f
# Or check the logs directory
tail -f logs/trading.log
```

## Configuration ⚙️

| Variable | Description | Default |
|----------|-------------|----------|
| `TARGET_WALLET` | Wallet address to follow | Required |
| `ETHEREUM_RPC` | Ethereum RPC endpoint | Required |
| `SOLANA_RPC` | Solana RPC endpoint | Required |
| `PRIVATE_KEY` | Your Ethereum private key | Required |
| `SOLANA_PRIVATE_KEY` | Your Solana private key (base58) | Required |
| `SLIPPAGE_BPS` | Slippage tolerance in basis points | 50 |
| `MAX_POSITION_SIZE` | Max position size in native token | 0.1 |
| `GAS_MULTIPLIER` | Gas price multiplier for faster execution | 1.2 |

## Architecture 🏗️

```
├── main.py                 # Entry point
├── ethereum_follower.py    # Ethereum monitoring & trading
├── solana_follower.py      # Solana monitoring & trading
├── docker-compose.yml      # Docker orchestration
├── Dockerfile             # Container definition
└── requirements.txt       # Python dependencies
```

## Supported DEXs 💱

### Ethereum
- ✅ Uniswap V3
- 🔄 Uniswap V4 (ready for launch)

### Solana
- ✅ Raydium
- ✅ Orca Whirlpools

## Safety Features 🛡️

- Position size limits
- Configurable slippage protection
- Gas price optimization
- Comprehensive error handling
- Transaction confirmation waiting

## Development 🔧

### Local Setup

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

### Testing

```bash
# Test with a small position size first
MAX_POSITION_SIZE=0.01 python main.py
```

## Warnings ⚠️

- **NEVER commit your `.env` file**
- **Start with small position sizes**
- **Test on testnet first**
- **Monitor gas costs carefully**
- **This is for educational purposes**

## License 📄

MIT License - Use at your own risk

---

*Built with precision and purpose* ⚡