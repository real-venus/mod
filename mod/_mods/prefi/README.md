# PreFi - Decentralized Prediction Finance Protocol

## Overview
PreFi is a decentralized prediction market protocol that uses L2 distance-based scoring to reward accurate predictions. Users stake tokens on price predictions, and rewards are distributed based on prediction accuracy weighted by stake amount.

## Core Features

### 🎯 L2 Distance Scoring
- Uses Euclidean distance (L2 norm) to measure prediction accuracy
- Score formula: `stake / (1 + distance²)`
- Closer predictions with higher stakes earn more rewards

### 💰 Staking Mechanism
- Minimum stake requirement configurable by admin
- Stake tokens locked until market resolution
- Proportional reward distribution based on scores

### 🔮 Oracle Integration
- Trusted oracle resolves markets with actual prices
- Time-locked markets prevent early resolution
- Immutable resolution once set

### 🛡️ Security Features
- ReentrancyGuard protection
- Pausable in emergencies
- Owner-controlled admin functions
- Platform fee mechanism (max 10%)

## Smart Contracts

### PreFiCore.sol
Main contract handling:
- Market creation and management
- Prediction submission and staking
- Market resolution via oracle
- Reward calculation and distribution
- Fee collection

### ScoreL2.sol
Separate scoring contract for:
- L2 distance calculations
- Score computation
- Batch processing
- Square root approximations

## Usage

### Creating a Market
```solidity
bytes32 marketId = preFi.createMarket(
    "BTC/USD",
    block.timestamp + 7 days
);
```

### Making a Prediction
```solidity
// Approve tokens first
token.approve(address(preFi), stakeAmount);

// Submit prediction
preFi.predict(
    marketId,
    50000 * 1e18, // predicted price
    1000 * 1e18   // stake amount
);
```

### Resolving Market (Oracle)
```solidity
preFi.resolveMarket(
    marketId,
    48500 * 1e18 // actual price
);
```

### Claiming Rewards
```solidity
preFi.claimReward(marketId);
```

## Scoring Algorithm

### Distance Calculation
```
distance² = (predicted_price - actual_price)²
```

### Score Calculation
```
score = (stake_amount × 10¹⁸) / (10¹⁸ + distance²)
```

### Reward Distribution
```
reward = (user_score / total_score) × reward_pool
reward_pool = total_staked - platform_fee
```

## Configuration

### Constructor Parameters
- `stakeToken`: ERC20 token address for staking
- `oracle`: Address authorized to resolve markets
- `minStake`: Minimum stake amount required
- `platformFee`: Fee in basis points (100 = 1%)

### Admin Functions
- `setOracle(address)`: Update oracle address
- `setMinStake(uint256)`: Update minimum stake
- `setPlatformFee(uint256)`: Update platform fee
- `withdrawFees()`: Withdraw accumulated fees
- `pause()/unpause()`: Emergency controls

## Events

```solidity
event MarketCreated(bytes32 marketId, string asset, uint256 targetTimestamp);
event PredictionMade(bytes32 marketId, address predictor, uint256 predictedPrice, uint256 stakedAmount);
event MarketResolved(bytes32 marketId, uint256 actualPrice);
event RewardClaimed(bytes32 marketId, address predictor, uint256 reward);
```

## Security Considerations

1. **Oracle Trust**: System relies on honest oracle for price feeds
2. **Front-running**: Consider using commit-reveal for predictions
3. **Market Manipulation**: Minimum stake helps prevent spam
4. **Fee Limits**: Platform fee capped at 10%
5. **Reentrancy**: Protected via ReentrancyGuard

## Deployment

```bash
# Install dependencies
npm install @openzeppelin/contracts

# Compile
npx hardhat compile

# Deploy
npx hardhat run scripts/deploy.js --network mainnet
```

## Testing

```bash
npx hardhat test
```

## License
MIT

## Contributing
Contributions welcome! Please submit PRs with tests.

## Roadmap

- [ ] Multi-asset support
- [ ] Automated oracle integration (Chainlink)
- [ ] NFT prediction receipts
- [ ] Governance token
- [ ] Cross-chain deployment
- [ ] Advanced scoring models (L1, custom)
- [ ] Prediction pools/syndicates
- [ ] Mobile app integration

## Contact

Discord: [Join PreFi Community]
Twitter: [@PreFiProtocol]
GitHub: [github.com/prefi]
