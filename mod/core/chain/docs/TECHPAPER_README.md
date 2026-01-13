# BlocTime Technical Whitepaper - README

## Overview

This directory contains the **BlocTime Protocol Technical Whitepaper** (`TECHPAPER.tex`), a comprehensive LaTeX document detailing the mathematical models, smart contract architecture, security considerations, and implementation specifications of the BlocTime ecosystem.

## Document Structure

### Main Sections

1. **Introduction** - Protocol overview and design philosophy
2. **Core Contracts** - Detailed specifications of all smart contracts:
   - BlocTime Token & Staking Contract
   - Market Contract
   - Treasury Contract
   - Registry Contract
   - Permissions Contract
   - Oracle Adapters
3. **Security Considerations** - Reentrancy protection, access control, economic security
4. **Gas Optimization** - Storage patterns and batch operations
5. **Integration Patterns** - Contract interaction flows and oracle integration
6. **Deployment & Configuration** - Deployment sequence and configuration parameters
7. **Testing & Verification** - Test coverage and verification procedures
8. **Future Enhancements** - Planned features and improvements
9. **Appendices** - Contract addresses and API reference

## Compiling the Document

### Prerequisites

- LaTeX distribution (TeX Live, MiKTeX, or MacTeX)
- Required packages: `amsmath`, `amsfonts`, `amssymb`, `graphicx`, `hyperref`, `listings`, `xcolor`, `geometry`

### Compilation Commands

```bash
# Standard compilation
pdflatex TECHPAPER.tex
pdflatex TECHPAPER.tex  # Run twice for references

# With bibliography (if added)
pdflatex TECHPAPER.tex
bibtex TECHPAPER
pdflatex TECHPAPER.tex
pdflatex TECHPAPER.tex

# Using latexmk (recommended)
latexmk -pdf TECHPAPER.tex
```

### Online Compilation

You can also compile this document using:
- **Overleaf**: Upload `TECHPAPER.tex` to [overleaf.com](https://www.overleaf.com)
- **ShareLaTeX**: Similar online LaTeX editor

## Key Mathematical Models

### 1. BlocTime Earning Formula

```
B_earned = A_staked × M(t)
```

Where:
- `B_earned` = BlocTime tokens earned
- `A_staked` = Amount of native tokens staked
- `M(t)` = Multiplier function based on lock duration

### 2. Multiplier Calculation

```
M(t) = M_0 + ((M_1 - M_0) × (t - t_0)) / (t_1 - t_0)
```

Linear interpolation between configured multiplier points.

### 3. Treasury Distribution

```
C_holder = (D_total × (10000 - P_owner) / 10000) × (B_holder / S_total)
```

Where:
- `C_holder` = Claimable amount for holder
- `D_total` = Total distributable amount
- `P_owner` = Owner percentage (basis points)
- `B_holder` = Holder's governance token balance
- `S_total` = Total governance token supply

### 4. Market Pricing

```
P_required = (S_amount × 10^d_token) / P_token
```

Where:
- `P_required` = Payment amount required
- `S_amount` = Stable token amount desired
- `d_token` = Token decimals
- `P_token` = Token price (8 decimals USD)

## Contract Architecture

```
BlocTime Protocol
├── BlocTime.sol          # Staking + token minting
├── Market.sol            # NFT marketplace
├── Registry.sol          # Module registration
├── Treasury.sol          # Revenue distribution
├── Perms.sol             # Access control
├── Token.sol             # ERC20 implementation
└── oracles/
    ├── IOracleAdapter.sol
    ├── ChainlinkAdapter.sol
    ├── PythAdapter.sol
    └── ManualPriceOracle.sol
```

## Security Features

- ✅ **ReentrancyGuard** on all state-changing functions
- ✅ **SafeERC20** for token transfers
- ✅ **Access Control** via Perms contract
- ✅ **Monotonic Multipliers** enforcement
- ✅ **Overflow Protection** (Solidity 0.8+)
- ✅ **Zero Address Validation**

## Configuration Parameters

| Parameter | Contract | Default |
|-----------|----------|----------|
| maxLockBlocks | BlocTime | Configurable |
| distributionPercentage | BlocTime | ≤ 10000 |
| ownerPercentage | Treasury | ≤ 10000 |
| maxChildKeys | Perms | 100 |
| maxKeySize | Perms | 1024 bytes |

## Testing

The whitepaper references comprehensive test coverage:

```bash
npx hardhat test
npx hardhat verify --network <network> <address>
```

## Related Documents

- **[NONTECHPAPER.tex](./NONTECHPAPER.tex)** - Non-technical guide for general audience
- **[README.md](../README.md)** - Main project README
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deployment guide
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Contribution guidelines

## Future Enhancements

Planned features documented in the whitepaper:
- Governance voting mechanisms
- Time-weighted voting power
- Cross-chain bridge integration
- Advanced oracle aggregation
- AMM integration
- NFT support in Registry

## License

MIT License - See LICENSE file for details

## Contact

For technical questions about the whitepaper:
- Open an issue in the repository
- Join the community Discord
- Email: tech@bloctime.io

---

**Built with 💎 by the BlocTime Team**

*"Simplicity is the ultimate sophistication." - Leonardo da Vinci*