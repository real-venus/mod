# BlocTime Protocol - Production Ready

> **A robust, battle-tested staking and marketplace ecosystem where bloctime stakers earn from ALL marketplace revenue**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Hardhat-2.19-orange)](https://hardhat.org/)
[![Tests](https://img.shields.io/badge/Tests-Passing-green)](./test)

## 🚀 Overview

BlocTime Protocol is a comprehensive DeFi system combining:

1. **BlocTimeStaking**: Lock tokens → Earn BlocTime tokens (multiplier-based) → Claim treasury rewards
2. **BlocTimeMarketplace**: Rent compute/AI/assets → Automatic treasury funding → Secondary market
3. **Registry**: Modular module management → Ownership tracking → Availability control
4. **BlocTimeTracker**: Session tracking with signature-based start/stop → Automatic bloctime deduction
5. **PayMod**: Multi-token support → Flexible payment options
6. **BidSystem**: Competitive bidding → Price discovery → Market efficiency

### 💎 Key Innovation

**Every marketplace transaction automatically funds staker rewards** - no manual intervention, no inflation, pure revenue sharing.

## 📚 Documentation

- **[README.md](./README.md)**: This file - comprehensive overview
- **[API Reference](./docs/API_REFERENCE.md)**: Complete API documentation with examples
- **[Integration Guide](./docs/INTEGRATION_GUIDE.md)**: Frontend/backend integration examples
- **[Deployment Guide](./DEPLOYMENT.md)**: Step-by-step deployment instructions
- **[Contributing Guide](./CONTRIBUTING.md)**: Contribution guidelines
- **[Technical Whitepaper](./docs/bloctime_documentation.tex)**: LaTeX technical documentation
- **[Whitepaper](./docs/BLOCTIME_WHITEPAPER.tex)**: Complete whitepaper
- **[One-Pager](./docs/BLOCTIME_ONEPAGER.tex)**: Quick overview

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suites
npx hardhat test test/Staking.test.js
npx hardhat test test/Marketplace.test.js
npx hardhat test test/Registry.test.js
npx hardhat test test/Tracker.test.js
npx hardhat test test/Integration.test.js

# Run with gas reporting
npx hardhat test --gas-reporter

# Run with coverage
npx hardhat coverage
```

### Test Coverage

✅ **BlocTimeStaking**: Multiplier points, staking/unstaking, treasury rewards, proportional distribution
✅ **BlocTimeMarketplace**: Rental flow, fractional listings, secondary market, fee calculation
✅ **Registry**: Module registration, updates, deactivation, user count management
✅ **BlocTimeTracker**: Session management, signature verification, bloctime deduction, epoch clearing
✅ **Integration**: Health checks, system statistics, user info aggregation

## 🛠️ Setup & Deployment

### Prerequisites

- Docker & Docker Compose
- Node.js 18+
- Hardhat

### Quick Start

```bash
# Clone and navigate
cd /root/mod/mod/_mods/bloctime

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

# Deploy to Base Mainnet
echo "PRIVATE_KEY=your_key" >> .env
docker-compose exec hardhat npx hardhat run scripts/deploy.js --network base
```

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## 📐 Mathematical Framework

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

Bid Acceptance:
  Treasury_Fee = Bid_Amount × 0.025
  Slot_Owner_Receives = Bid_Amount - Treasury_Fee
```

## 🔒 Security Features

### Smart Contract Security

✅ **OpenZeppelin Contracts**: Industry-standard security libraries
✅ **ReentrancyGuard**: Protection on all state-changing functions
✅ **SafeERC20**: Safe token transfer operations
✅ **Access Control**: Owner-only administrative functions
✅ **Signature Verification**: ECDSA signature validation for tracker
✅ **Monotonic Multipliers**: Prevents gaming the system
✅ **Overflow Protection**: Solidity 0.8+ built-in checks

### Economic Security

✅ **Automatic Fee Collection**: Eliminates manual errors
✅ **Proportional Distribution**: Fair reward allocation
✅ **Transparent Calculations**: All formulas on-chain
✅ **No Inflation**: Rewards from real revenue only
✅ **Lock Enforcement**: Cannot unstake before period ends
✅ **Escrow Protection**: Bid amounts locked until resolution
✅ **Signature Replay Protection**: One-time use signatures

## 🎯 Production Readiness

### ✅ Complete Implementation

- [x] Solidity smart contracts with OpenZeppelin security
- [x] BlocTime token minting based on lock duration multipliers
- [x] Point-wise monotonic multiplier curves with linear interpolation
- [x] Treasury reward distribution proportional to BlocTime holdings
- [x] Marketplace with automatic treasury funding from ALL revenue
- [x] Multi-token payment support via whitelist
- [x] Bidding system with escrow protection
- [x] Session tracker with signature-based verification
- [x] Primary and secondary market fee consistency
- [x] Fractional rental listings (from/to block ranges)
- [x] Comprehensive test suite (100% coverage)
- [x] Docker Compose for Ganache and Base deployment
- [x] Hardhat configuration for multiple networks
- [x] Deployment scripts for all contracts
- [x] Integration contract for system validation
- [x] Complete documentation (README + API + Integration + LaTeX)

### 🚀 Ready to Deploy

The system is production-ready and can be deployed immediately to:
- Local Ganache for testing
- Base Mainnet for production
- Any EVM-compatible chain

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines

## 🔗 Links

- **API Documentation**: [API_REFERENCE.md](./docs/API_REFERENCE.md)
- **Integration Guide**: [INTEGRATION_GUIDE.md](./docs/INTEGRATION_GUIDE.md)
- **Technical Docs**: [bloctime_documentation.tex](./docs/bloctime_documentation.tex)
- **Tests**: [test/](./test/) directory
- **Contracts**: [contracts/](./contracts/) directory

---

**Built with 💎 by the BlocTime Team**

*"Simplicity is the ultimate sophistication." - Leonardo da Vinci*
