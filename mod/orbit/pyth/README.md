# Pyth Network Integration Module 🚀

Complete Pyth Network price feed integration with multi-chain support and smart contract adapters.

## ✨ Features

- **Multi-Chain Support** - Base, Ethereum, Arbitrum, Optimism, Polygon, Avalanche, BSC
- **Comprehensive Price Feeds** - Crypto, Equity, FX, Metals, Rates
- **Smart Contract Adapters** - Production-ready Solidity contracts
- **Python Interface** - Easy-to-use Python module for price feed management
- **Real-time Updates** - Live price data from Pyth Network

## 🔗 Supported Chains

| Chain | Pyth Contract Address |
|-------|----------------------|
| Base (Default) | `0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a` |
| Ethereum | `0x4305FB66699C3B2702D4d05CF36551390A4c69C6` |
| Arbitrum | `0xff1a0f4744e8582DF1aE09D5611b887B6a12925C` |
| Optimism | `0xff1a0f4744e8582DF1aE09D5611b887B6a12925C` |
| Polygon | `0xff1a0f4744e8582DF1aE09D5611b887B6a12925C` |
| Avalanche | `0x4305FB66699C3B2702D4d05CF36551390A4c69C6` |
| BSC | `0x4D7E825f80bDf85e913E0DD2A2D54927e9dE1594` |

## 🚀 Quick Start

### Python Module

```python
from pyth.mod import BaseMod

# Initialize with Base chain (default)
mod = BaseMod(chain="base")

# Get all available price feeds
feeds = mod.get_all_price_feeds()

# List crypto feeds
crypto_feeds = mod.list_crypto_feeds()

# Get price by symbol
btc_price = mod.get_price_by_symbol("BTC/USD")

# Switch to different chain
mod.switch_chain("ethereum")

# Get chain info
info = mod.get_feed_info()
```

### Smart Contracts

```solidity
import "./contracts/PythPriceAdapter.sol";

// Deploy adapter
PythPriceAdapter adapter = new PythPriceAdapter(pythContractAddress);

// Register price feed
adapter.registerPriceFeed(
    assetAddress,
    "BTC/USD",
    priceFeedId
);

// Get price
uint256 price = adapter.getPrice(assetAddress);

// Get price with confidence
(uint256 price, uint256 confidence, uint256 timestamp) = 
    adapter.getPriceWithConfidence(assetAddress);
```

## 📦 Installation

```bash
# Install Python dependencies
pip install requests

# Install Solidity dependencies
npm install @pythnetwork/pyth-sdk-solidity
npm install @openzeppelin/contracts
```

## 📁 Project Structure

```
pyth/
├── pyth/
│   └── mod.py              # Python module for price feeds
├── contracts/
│   ├── PythPriceAdapter.sol    # Main Pyth adapter contract
│   └── IPythAdapter.sol        # Adapter interface
├── README.md
└── TUTORIAL.md
```

## 🛠️ Python API Reference

### BaseMod Class

#### Methods

- `get_all_price_feeds()` - Fetch all available Pyth price feeds
- `get_price_feeds_by_type(asset_type)` - Filter feeds by type (crypto, equity, fx, metal, rates)
- `get_latest_price(price_feed_id)` - Get latest price for specific feed ID
- `get_price_by_symbol(symbol)` - Get price by symbol (e.g., 'BTC/USD')
- `list_crypto_feeds()` - List all cryptocurrency feeds
- `list_equity_feeds()` - List all equity/stock feeds
- `list_fx_feeds()` - List all foreign exchange feeds
- `get_supported_chains()` - Get list of supported chains
- `get_chain_contract(chain)` - Get Pyth contract for specific chain
- `switch_chain(chain)` - Switch to different blockchain
- `get_feed_info()` - Get comprehensive feed information

## 🔐 Smart Contract API

### PythPriceAdapter

#### Functions

- `getPrice(address _asset)` - Get current price for asset
- `getPriceBySymbol(string _symbol)` - Get price by symbol
- `getPriceWithConfidence(address _asset)` - Get price with confidence interval
- `updatePrice(bytes[] priceUpdateData)` - Update price with Pyth data
- `registerPriceFeed(address _asset, string _symbol, bytes32 _priceFeedId)` - Register new feed

## 📊 Asset Types

- **Crypto** - Cryptocurrency pairs (BTC/USD, ETH/USD, etc.)
- **Equity** - Stock prices (AAPL, TSLA, etc.)
- **FX** - Foreign exchange rates (EUR/USD, GBP/USD, etc.)
- **Metal** - Precious metals (XAU/USD, XAG/USD, etc.)
- **Rates** - Interest rates and yields

## 🌐 API Endpoints

- **Hermes API**: `https://hermes.pyth.network`
- **Benchmarks API**: `https://benchmarks.pyth.network/v1/shims/tradingview`

## 📄 License

MIT License - feel free to use in your projects.

---

*Built with Pyth Network - Real-time, decentralized price feeds* ⚡
