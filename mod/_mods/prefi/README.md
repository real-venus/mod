# Prefi - Decentralized Prediction Market Protocol 🎯

A robust, zero-sum prediction market protocol enabling users to bet on future asset prices with locked collateral. Built for Base, Ethereum, and local testing with Ganache, featuring modular oracle architecture and epoch-based competitions.

## 🌟 Core Features

- **Price Predictions**: Bet on future prices of whitelisted assets
- **Collateral Locking**: Lock approved ERC20 tokens (1 day - 1 month)
- **Epoch-Based Competition**: Fixed time windows with L1 distance scoring
- **Zero-Sum Distribution**: Pool distributed based on prediction accuracy
- **Modular Oracle System**: Aggregated pricing from 6+ oracle sources
- **Multi-Chain Support**: Deploy on Base, Ethereum, or Ganache
- **Weighted Predictions**: Lock more tokens for higher potential rewards

## 🏗️ Architecture

### Smart Contracts

```
prefi/
├── contracts/
│   ├── PredictionMarket.sol          # Main prediction market logic
│   ├── EpochPredictionMarket.sol     # Epoch-based competition variant
│   ├── Oracle.sol                    # Aggregator oracle with consensus
│   └── oracles/
│       ├── PriceOracle.sol           # Modular oracle base
│       ├── IPriceOracleAdapter.sol   # Standard adapter interface
│       └── adapters/
│           ├── ChainlinkAdapter.sol  # Chainlink price feeds
│           ├── PythAdapter.sol       # Pyth Network integration
│           ├── UniswapAdapter.sol    # Uniswap V3 TWAP
│           ├── BinanceAdapter.sol    # Binance Oracle
│           ├── CoinGeckoAdapter.sol  # CoinGecko API
│           └── CoinMarketCapAdapter.sol # CoinMarketCap API
```

### Oracle System

**Standardized Interface** (`IPriceOracleAdapter`):
```solidity
interface IPriceOracleAdapter {
    function getPrice(address _asset) external view returns (uint256 price);
    function supportsAsset(address _asset) external view returns (bool);
    function adapterName() external view returns (string memory);
}
```

**Supported Oracles**:
1. **Chainlink** - Decentralized, high reliability
2. **Pyth** - High-frequency, low latency
3. **Uniswap V3** - DEX-based TWAP
4. **Binance** - CEX price feeds
5. **CoinGecko** - Aggregated market data
6. **CoinMarketCap** - Market cap weighted

## 🚀 Quick Start

### Installation

```bash
cd prefi
npm install

# Setup environment
cp .env.example .env
# Edit .env with your API keys and private key
```

### Deploy to Ganache (Local)

```bash
# Terminal 1: Start Ganache
ganache-cli -p 7545 -i 1337

# Terminal 2: Deploy
npm run deploy:ganache
```

### Deploy to Base

```bash
# Base Sepolia (Testnet)
npm run deploy:baseSepolia

# Base Mainnet (Production)
npm run deploy:base
```

### Deploy to Ethereum

```bash
# Sepolia Testnet
npm run deploy:sepolia

# Mainnet
npm run deploy:mainnet
```

## 📊 How It Works

### Standard Prediction Market

1. **Place Prediction**: Choose asset, predict price, lock collateral
2. **Wait Period**: Tokens locked for chosen duration
3. **Settlement**: Oracle determines actual price at unlock time
4. **Points Award**: Earn points based on accuracy (USD won/lost)
5. **Weekly Distribution**: Every Friday, pool distributed to top performers

### Epoch-Based Competition

1. **Epoch Start**: Fixed time window begins (e.g., 1 day)
2. **Predictions**: Players lock tokens with price predictions
3. **Epoch End**: Oracle provides actual price
4. **L1 Scoring**: `score = lockedAmount / (1 + |predicted - actual|)`
5. **Distribution**: Rewards proportional to scores

**Example Scoring**:
```
Actual Price: $100

Player A: Predicted $102, Locked 1000 tokens
  Distance: 2 → Score: 1000/3 = 333.33

Player B: Predicted $95, Locked 500 tokens
  Distance: 5 → Score: 500/6 = 83.33

Player C: Predicted $100, Locked 200 tokens
  Distance: 0 → Score: 200/1 = 200

Total Pool: 1700 tokens
Player A Reward: (333.33/616.66) × 1700 = 918 tokens
Player B Reward: (83.33/616.66) × 1700 = 230 tokens
Player C Reward: (200/616.66) × 1700 = 552 tokens
```

## 🔧 Configuration

### Environment Variables

```env
# Network RPCs
GANACHE_URL=http://127.0.0.1:7545
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY

# Wallet
PRIVATE_KEY=0x...
# OR
MNEMONIC=word1 word2 ... word12

# API Keys
INFURA_KEY=your_infura_key
BASESCAN_API_KEY=your_basescan_key
ETHERSCAN_API_KEY=your_etherscan_key
COINGECKO_API_KEY=your_coingecko_key
COINMARKETCAP_API_KEY=your_cmc_key
```

### Oracle Setup

```javascript
// 1. Deploy main oracle
const oracle = await PriceOracle.deploy();

// 2. Deploy adapters
const chainlink = await ChainlinkAdapter.deploy(oracle.address);
const pyth = await PythAdapter.deploy(oracle.address, pythAddress);
const uniswap = await UniswapAdapter.deploy(oracle.address);

// 3. Register adapters
await oracle.addAdapter(chainlink.address);
await oracle.addAdapter(pyth.address);
await oracle.addAdapter(uniswap.address);

// 4. Configure assets
await chainlink.addAsset(btcAddress, chainlinkBtcFeed);
await pyth.addAsset(btcAddress, pythBtcId);
await uniswap.addAsset(btcAddress, btcWethPool);
```

## 📈 Usage Examples

### Place Prediction

```javascript
const market = await ethers.getContractAt("PredictionMarket", MARKET_ADDRESS);
const token = await ethers.getContractAt("IERC20", USDC_ADDRESS);

// Approve collateral
await token.approve(market.address, ethers.utils.parseUnits("100", 6));

// Place prediction
await market.placePrediction(
    WBTC_ADDRESS,                           // Asset to predict
    ethers.utils.parseEther("50000"),       // Predicted price: $50,000
    ethers.utils.parseUnits("100", 6),      // Collateral: 100 USDC
    USDC_ADDRESS,                           // Collateral token
    7 * 24 * 60 * 60                        // Lock: 1 week
);
```

### Epoch Competition

```javascript
const epochMarket = await ethers.getContractAt("EpochPredictionMarket", EPOCH_MARKET_ADDRESS);

// Check current epoch
const currentEpoch = await epochMarket.currentEpochId();
const epochInfo = await epochMarket.getEpochInfo(currentEpoch);

if (block.timestamp < epochInfo.endTime) {
    // Place prediction
    await token.approve(epochMarket.address, lockAmount);
    await epochMarket.placePrediction(
        ethers.utils.parseEther("50000"),  // Predicted price
        lockAmount                          // Lock amount
    );
} else {
    // Settle epoch
    await epochMarket.settleEpoch(currentEpoch);
}
```

## 🌐 Supported Networks

| Network | Chain ID | RPC URL | Explorer |
|---------|----------|---------|----------|
| Ganache | 1337 | http://127.0.0.1:7545 | - |
| Base Mainnet | 8453 | https://mainnet.base.org | https://basescan.org |
| Base Sepolia | 84532 | https://sepolia.base.org | https://sepolia.basescan.org |
| Ethereum Mainnet | 1 | https://mainnet.infura.io | https://etherscan.io |
| Ethereum Sepolia | 11155111 | https://sepolia.infura.io | https://sepolia.etherscan.io |

## 🔐 Security Features

- ✅ **ReentrancyGuard**: All state-changing functions protected
- ✅ **Access Control**: Owner-only administrative functions
- ✅ **Collateral Whitelist**: Only approved tokens accepted
- ✅ **Price Staleness**: Maximum age checks (1 hour default)
- ✅ **Oracle Consensus**: Weighted average with confidence scoring
- ✅ **Safe Math**: Overflow protection throughout
- ✅ **Emergency Controls**: Owner can pause/update critical parameters

## 🧪 Testing

```bash
# Run all tests
npm test

# With coverage
npm run coverage

# Gas report
npm run gas-report

# Specific test file
npx hardhat test test/PredictionMarket.test.js
```

## 📊 Gas Estimates

| Contract | Ganache | Base | Ethereum |
|----------|---------|------|----------|
| PriceOracle | Free | ~0.0008 ETH | ~0.02 ETH |
| Adapters (6x) | Free | ~0.0036 ETH | ~0.09 ETH |
| PredictionMarket | Free | ~0.0015 ETH | ~0.05 ETH |
| EpochPredictionMarket | Free | ~0.0012 ETH | ~0.04 ETH |
| **Total** | **Free** | **~0.007 ETH** | **~0.20 ETH** |

*Estimates vary with gas prices*

## 🛠️ Development

```bash
# Compile contracts
npm run compile

# Clean artifacts
npm run clean

# Run local node
npm run node

# Verify on Etherscan/Basescan
npx hardhat verify --network base DEPLOYED_ADDRESS "CONSTRUCTOR_ARG1" "CONSTRUCTOR_ARG2"
```

## 📚 Documentation

- [Deployment Guide](./DEPLOYMENT.md) - Detailed deployment instructions
- [Production Guide](./README.production.md) - Production deployment checklist
- [Epoch Prediction](./README.EPOCH_PREDICTION.md) - Epoch-based competition details
- [Oracle Architecture](./contracts/oracles/README.md) - Oracle system documentation

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - See [LICENSE](./LICENSE) for details

## 🔗 Links

- **Base Docs**: https://docs.base.org
- **Chainlink**: https://docs.chain.link
- **Pyth Network**: https://docs.pyth.network
- **Hardhat**: https://hardhat.org/docs

---

**Built with ❤️ for decentralized prediction markets**

*Empowering transparent, fair, and competitive price predictions on-chain* 🚀