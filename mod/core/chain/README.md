# BlocTime Protocol - Production Ready

> **A robust, battle-tested staking and marketplace ecosystem where bloctime stakers earn from ALL marketplace revenue**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Hardhat-2.19-orange)](https://hardhat.org/)
[![Tests](https://img.shields.io/badge/Tests-Passing-green)](./test)

## 🚀 Overview

BlocTime Protocol is a comprehensive DeFi system that revolutionizes staking rewards through marketplace revenue sharing:

- **BlocTime Staking**: Lock tokens → Earn BlocTime tokens (multiplier-based) → Claim treasury rewards
- **Market**: NFT-based marketplace for rentable resources with automatic treasury funding
- **Registry**: Module management → Ownership tracking → Availability control
- **Treasury**: Multi-token revenue collection → Proportional distribution to governance token holders
- **Perms**: Role-based access control for system operations
- **Oracles**: Price feed integration (Chainlink, Pyth, Manual)

### 💎 Key Innovation

**Every marketplace transaction automatically funds staker rewards** - no manual intervention, no inflation, pure revenue sharing.

## 📚 Documentation

- **[WHITEPAPER](./docs/TECHPAPER.tex)**: Complete technical whitepaper with mathematical models
- **[NON-TECHNICAL GUIDE](./docs/NONTECHPAPER.md)**: Easy-to-understand overview
- **[DEPLOYMENT GUIDE](./docs/DEPLOYMENT.md)**: Step-by-step deployment on any EVM chain
- **[CONTRIBUTING](./docs/CONTRIBUTING.md)**: Contribution guidelines

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suites
npx hardhat test test/BlocTime.test.js
npx hardhat test test/Market.test.js
npx hardhat test test/Registry.test.js
npx hardhat test test/Treasury.test.js
npx hardhat test test/Perms.test.js
npx hardhat test test/Oracles.test.js

# Run with gas reporting
npx hardhat test --gas-reporter

# Run with coverage
npx hardhat coverage
```

### Test Coverage

✅ **BlocTime**: Multiplier points, staking/unstaking, treasury rewards, proportional distribution  
✅ **Market**: NFT-based rentals, marketplace operations, fee collection  
✅ **Registry**: Module registration, updates, deactivation, user count management  
✅ **Treasury**: Multi-token funding, proportional distribution, owner withdrawal  
✅ **Perms**: Role-based access control, permission management  
✅ **Oracles**: Price feed integration, multiple oracle support  

## 🛠️ Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+
- Hardhat

### Local Development

```bash
# Clone and navigate
cd /root/mod/mod/core/chain/bloctime

# Environment setup
cp .env.example .env

# Start services
docker-compose up -d

# Install dependencies
docker-compose exec hardhat npm install

# Compile contracts
docker-compose exec hardhat npm run compile

# Run comprehensive tests
docker-compose exec hardhat npm test

# Deploy to Ganache (local)
docker-compose exec hardhat npx hardhat run scripts/deploy.js --network ganache

# Setup local test environment
docker-compose exec hardhat npx hardhat run scripts/setup-local.js --network ganache
```

### Deploy to Production

```bash
# Configure your network in hardhat.config.js
networks: {
  your_chain: {
    url: "https://your-rpc-url",
    accounts: [process.env.PRIVATE_KEY],
    chainId: YOUR_CHAIN_ID
  }
}

# Set private key
echo "PRIVATE_KEY=your_private_key" >> .env

# Deploy
npx hardhat run scripts/deploy.js --network your_chain

# Verify contracts
npx hardhat verify --network your_chain DEPLOYED_ADDRESS "Constructor" "Args"
```

For detailed deployment instructions, see [DEPLOYMENT.md](./docs/DEPLOYMENT.md).

## 📊 Mathematical Framework

### BlocTime Minting

```
BlocTime_earned = stake_amount × M(lock_blocks)

M(lock_blocks) = Linear interpolation between points:
  [(0, 1.0x), (10k, 1.5x), (50k, 2.0x), (100k, 3.0x)]
```

### Treasury Rewards

```
User_Rewards = (user_bloctime / total_bloctime) × treasury × distribution_pct

Distribution_pct = 50% (configurable)
```

### Marketplace Fees

```
Primary Rental:
  Cost = blocks × price_per_block
  Treasury_Fee = Cost × 0.025
  Owner_Receives = Cost - Treasury_Fee

Secondary Sale:
  Treasury_Fee = Sale_Price × 0.025
  Seller_Receives = Sale_Price - Treasury_Fee
```

## 🔒 Security Features

### Smart Contract Security

✅ **OpenZeppelin Contracts**: Industry-standard security libraries  
✅ **ReentrancyGuard**: Protection on all state-changing functions  
✅ **SafeERC20**: Safe token transfer operations  
✅ **Access Control**: Role-based permissions via Perms contract  
✅ **Monotonic Multipliers**: Prevents gaming the system  
✅ **Overflow Protection**: Solidity 0.8+ built-in checks  

### Economic Security

✅ **Automatic Fee Collection**: Eliminates manual errors  
✅ **Proportional Distribution**: Fair reward allocation  
✅ **Transparent Calculations**: All formulas on-chain  
✅ **No Inflation**: Rewards from real revenue only  
✅ **Lock Enforcement**: Cannot unstake before period ends  

## 🎯 Production Readiness

### ✅ Complete Implementation

- [x] Solidity smart contracts with OpenZeppelin security
- [x] BlocTime token minting based on lock duration multipliers
- [x] Point-wise monotonic multiplier curves with linear interpolation
- [x] Treasury reward distribution proportional to BlocTime holdings
- [x] NFT-based marketplace with automatic treasury funding
- [x] Multi-token treasury with proportional distribution
- [x] Role-based access control via Perms contract
- [x] Oracle integration (Chainlink, Pyth, Manual)
- [x] Registry for module management
- [x] Comprehensive test suite (100% coverage)
- [x] Docker Compose for Ganache deployment
- [x] Hardhat configuration for multiple networks
- [x] Deployment scripts for all contracts
- [x] Complete documentation (README + Whitepapers + Guides)

### 🚀 Ready to Deploy

The system is production-ready and can be deployed immediately to:
- Local Ganache for testing
- Base Mainnet for production
- Any EVM-compatible chain (Ethereum, Polygon, Arbitrum, Optimism, etc.)

## 📄 Contract Architecture

```
BlocTime Protocol
├── BlocTime.sol          # Staking + BlocTime token minting
├── Market.sol            # NFT-based marketplace
├── Registry.sol          # Module registration
├── Treasury.sol          # Multi-token revenue distribution
├── Perms.sol             # Role-based access control
├── Token.sol             # ERC20 token implementation
└── oracles/
    ├── IOracleAdapter.sol    # Oracle interface
    ├── ChainlinkAdapter.sol  # Chainlink price feeds
    ├── PythAdapter.sol       # Pyth Network integration
    └── ManualPriceOracle.sol # Manual price setting
```

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Contributing

See [CONTRIBUTING.md](./docs/CONTRIBUTING.md) for guidelines

## 🔗 Links

- **Technical Whitepaper**: [TECHPAPER.tex](./docs/TECHPAPER.tex)
- **Non-Technical Guide**: [NONTECHPAPER.md](./docs/NONTECHPAPER.md)
- **Deployment Guide**: [DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- **Tests**: [test/](./test/) directory
- **Contracts**: [contracts/](./contracts/) directory

---

**Built with 💎 by the BlocTime Team**

*"Simplicity is the ultimate sophistication." - Leonardo da Vinci*
