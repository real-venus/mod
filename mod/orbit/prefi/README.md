# 🎯 PreFi - Modular Prediction Markets on Base

> **The first prediction market platform with pluggable oracle support**

![PreFi](https://img.shields.io/badge/Base-Mainnet-blue) ![Uniswap V3](https://img.shields.io/badge/Uniswap-V3-pink) ![Chainlink](https://img.shields.io/badge/Chainlink-Oracle-blue) ![Polymarket](https://img.shields.io/badge/Polymarket-Integrated-purple)

Predict anything. Use any data source. Win rewards.

## ⚡ Quick Start

```bash
# Install
npm install && cd app && npm install

# Deploy to testnet
npx hardhat run scripts/deploy-modular.js --network baseSepolia

# Launch UI
cd app && npm run dev
```

**→ Full guide:** [QUICKSTART.md](./QUICKSTART.md)

## ✨ Why PreFi?

### 🔌 Modular Oracle System

**First prediction market to support multiple oracle types:**

- 🦄 **Uniswap V3** - Decentralized TWAP for any token pair
- 🔗 **Chainlink** - Professional-grade price feeds
- 🎲 **Polymarket** - Real-world event outcomes
- 🛠️ **Custom** - Build your own oracle for ANY data

### 🎯 Fair L2 Distance Scoring

Mathematical accuracy-based rewards:
```
score = stake / (1 + distance²)
```

Closer predictions + higher stakes = bigger rewards

### 🚀 Production Ready

- ⚡ Deploy in 5 minutes
- 🔐 Audited patterns (OpenZeppelin)
- 📱 Beautiful responsive UI
- 🌐 Base mainnet & testnet support
- ✅ Fully tested contracts

## 📊 What You Can Build

### Financial Markets
- Token price predictions (ETH, BTC, alts)
- DeFi TVL forecasts
- Trading volume estimates
- Custom token analytics

### Real-World Events
- Elections & politics
- Sports outcomes
- Economic indicators
- Entertainment awards

### Custom Predictions
- GitHub stars by date
- Weather forecasts
- Social media metrics
- NFT floor prices
- DAO governance

**→ See examples:** [FEATURES.md](./FEATURES.md)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│           PreFi Modular Contract            │
│  ┌────────────────────────────────────────┐ │
│  │    L2 Distance Scoring Engine          │ │
│  └────────────────────────────────────────┘ │
└──────────┬──────────────┬──────────────┬────┘
           │              │              │
     ┌─────▼────┐  ┌──────▼─────┐  ┌────▼─────┐
     │ Uniswap  │  │ Chainlink  │  │Polymarket│
     │ V3 TWAP  │  │Price Feeds │  │ Markets  │
     └──────────┘  └────────────┘  └──────────┘
                        │
                   ┌────▼────┐
                   │ Custom  │
                   │ Oracles │
                   └─────────┘
```

## 📦 Installation

```bash
# Clone repo
cd /Users/broski/mod/mod/orbit/prefi

# Install contract dependencies
npm install

# Install frontend dependencies
cd app && npm install

# Compile contracts
npx hardhat compile
```

## 🚀 Deployment

### Testnet (Recommended First)

```bash
# 1. Configure environment
cp .env.example .env
# Add your PRIVATE_KEY

# 2. Deploy contracts
npx hardhat run scripts/deploy-modular.js --network baseSepolia

# 3. Update frontend config
cd app
cp .env.example .env
# Add contract addresses and WALLETCONNECT_PROJECT_ID

# 4. Run frontend
npm run dev
```

### Mainnet

```bash
# Deploy to Base mainnet
npx hardhat run scripts/deploy-modular.js --network base
```

**→ Full deployment guide:** [DEPLOY.md](./DEPLOY.md)

## 🔮 Oracle Usage

### Uniswap V3 - Token Prices

```javascript
const oracleData = ethers.utils.defaultAbiCoder.encode(
    ["address", "address", "uint24", "uint32"],
    [WETH, USDC, 3000, 1800] // 0.3% pool, 30min TWAP
);

await preFi.createMarket(
    "ETH/USD Prediction",
    assetId,
    0, // UNISWAP_V3
    oracleData,
    7 * 24 * 60 * 60
);
```

### Chainlink - Major Assets

```javascript
await preFi.createMarket(
    "BTC/USD (Chainlink)",
    ethers.utils.keccak256(ethers.utils.toUtf8Bytes("BTC/USD")),
    1, // CHAINLINK
    "0x", // No data needed
    duration
);
```

### Polymarket - Events

```javascript
await preFi.createMarket(
    "Will Bitcoin hit $100k in 2024?",
    marketId,
    2, // POLYMARKET  
    ethers.utils.defaultAbiCoder.encode(["bool"], [true]), // YES price
    30 * 24 * 60 * 60
);
```

**→ Oracle guide:** [ORACLES.md](./ORACLES.md)

## 🎨 UI Features

- ✨ Glassmorphism design
- 🎭 Animated gradients
- 📱 Mobile responsive
- 🌙 Dark mode
- 💫 Smooth transitions
- 🔔 Toast notifications
- 📊 Real-time updates
- 🎯 Intuitive UX

## 📚 Documentation

| Guide | Description |
|-------|-------------|
| [QUICKSTART.md](./QUICKSTART.md) | 5-minute setup guide |
| [DEPLOY.md](./DEPLOY.md) | Comprehensive deployment |
| [ORACLES.md](./ORACLES.md) | Oracle types & integration |
| [FEATURES.md](./FEATURES.md) | Complete feature overview |
| [README_COMPLETE.md](./README_COMPLETE.md) | Full technical docs |

## 🛠️ Tech Stack

### Smart Contracts
- Solidity 0.8.19
- Hardhat
- OpenZeppelin (Security)
- Uniswap V3 SDK
- Chainlink Contracts

### Frontend
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Wagmi + Viem
- RainbowKit
- Ethers.js v6
- Framer Motion

### Oracles
- Uniswap V3 TWAP
- Chainlink Price Feeds
- Polymarket Adapter
- Custom Oracle Interface

## 🌐 Networks

### Base Mainnet (8453)
- **RPC**: https://mainnet.base.org
- **Explorer**: https://basescan.org
- **Uniswap Factory**: `0x33128a8fC17869897dcE68Ed026d694621f6FDfD`

### Base Sepolia (84532)
- **RPC**: https://sepolia.base.org
- **Explorer**: https://sepolia.basescan.org
- **Faucet**: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

## 🔐 Security

- ✅ ReentrancyGuard on all state changes
- ✅ Pausable emergency stop
- ✅ Access control (Ownable)
- ✅ SafeERC20 for transfers
- ✅ Input validation
- ✅ Staleness checks
- ✅ Open source
- ✅ Based on OpenZeppelin

## 🧪 Testing

```bash
# Run all tests
npx hardhat test

# With gas reporting
REPORT_GAS=true npx hardhat test

# Coverage
npx hardhat coverage
```

## 📈 Example Markets

### Price Predictions
```
"ETH will be $5,000 on Jan 1, 2025"
Oracle: Chainlink ETH/USD
Reward: Closest prediction wins
```

### Binary Events
```
"Will Bitcoin reach $100k in 2024?"
Oracle: Polymarket
Outcome: YES/NO
```

### Custom Metrics
```
"Uniswap V3 TVL in 30 days"
Oracle: Custom (DeFi Llama API)
Reward: Proportional to accuracy
```

## 🎁 Coming Soon

- [ ] Chainlink Automation (auto-settle)
- [ ] Mobile app (React Native)
- [ ] Social features (leaderboards)
- [ ] NFT prediction receipts
- [ ] Governance token
- [ ] Cross-chain (Optimism, Arbitrum)
- [ ] Advanced charting
- [ ] Prediction pools

## 🤝 Contributing

Contributions welcome!

1. Fork the repo
2. Create feature branch
3. Commit changes
4. Push and PR

## 📝 License

MIT License - see [LICENSE](./LICENSE)

## 🙏 Acknowledgments

- **Base** - Amazing L2 platform
- **Uniswap** - Decentralized oracle infrastructure
- **Chainlink** - Professional oracle network
- **Polymarket** - Prediction market innovation
- **OpenZeppelin** - Security primitives

## 📞 Support

- **Docs**: See docs folder
- **Issues**: [GitHub Issues](https://github.com/yourusername/prefi/issues)
- **Discord**: [Join Community]
- **Twitter**: [@PreFiProtocol]

---

## ⚡ TL;DR

**Deploy a prediction market in 3 commands:**

```bash
npm install && cd app && npm install
npx hardhat run scripts/deploy-modular.js --network baseSepolia
cd app && npm run dev
```

**→ Read:** [QUICKSTART.md](./QUICKSTART.md)

---

<div align="center">

**Built with ❤️ on Base**

[Deploy Now](./QUICKSTART.md) • [Docs](./DEPLOY.md) • [Oracles](./ORACLES.md) • [Features](./FEATURES.md)

</div>
