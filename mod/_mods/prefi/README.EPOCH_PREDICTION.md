# Epoch-Based Prediction Market

## Overview

The **PredictionMarket** contract enables players to compete by predicting oracle prices within fixed time epochs. Players lock tokens with their predictions, and rewards are distributed based on prediction accuracy using L1 distance scoring.

## Key Features

✅ **Epoch-Based Competition**: Fixed time windows for predictions
✅ **L1 Distance Scoring**: Accuracy measured by absolute price difference
✅ **Weighted Predictions**: Lock more tokens to increase potential rewards
✅ **Automatic Settlement**: Epoch ends trigger reward distribution
✅ **Multi-Oracle Support**: Standardized adapters for Chainlink, Pyth, Uniswap, Binance, CoinGecko, CoinMarketCap
✅ **Fair Distribution**: Rewards proportional to (locked amount / distance)

## How It Works

### 1. Epoch Lifecycle

```
[Epoch Start] → [Prediction Period] → [Epoch End] → [Settlement] → [New Epoch]
     ↓                  ↓                    ↓             ↓
  Players join    Lock predictions    Get actual price  Distribute rewards
```

### 2. Prediction Mechanics

**During Epoch:**
- Players predict the asset price at epoch end
- Lock tokens to weight their prediction
- One prediction per player per epoch
- Predictions locked until epoch ends

**At Settlement:**
- Oracle provides actual price
- Calculate L1 distance: `|predicted - actual|`
- Calculate score: `lockedAmount / (1 + distance)`
- Distribute total pool proportionally to scores

### 3. Scoring Formula

```solidity
// L1 Distance (lower is better)
l1Distance = |predictedPrice - actualPrice|

// Score (higher is better)
score = lockedAmount / (1 + l1Distance)

// Reward Distribution
reward = (playerScore / totalScores) × totalPool
```

**Example:**
- Actual Price: $100
- Player A: Predicted $102, Locked 1000 tokens
  - Distance: 2
  - Score: 1000 / 3 = 333.33
- Player B: Predicted $95, Locked 500 tokens
  - Distance: 5
  - Score: 500 / 6 = 83.33
- Player C: Predicted $100, Locked 200 tokens
  - Distance: 0
  - Score: 200 / 1 = 200

Total Scores: 616.66
Total Pool: 1700 tokens

- Player A Reward: (333.33/616.66) × 1700 = 918 tokens
- Player B Reward: (83.33/616.66) × 1700 = 230 tokens  
- Player C Reward: (200/616.66) × 1700 = 552 tokens

## Oracle Adapters

### Standardized Interface

All adapters implement `IPriceOracleAdapter`:

```solidity
interface IPriceOracleAdapter {
    function getPrice(address _asset) external view returns (uint256 price);
    function supportsAsset(address _asset) external view returns (bool);
    function adapterName() external view returns (string memory);
}
```

### Supported Oracles

#### 1. **ChainlinkAdapter**
- Decentralized oracle network
- High reliability and security
- Wide asset coverage
- Real-time price feeds

```solidity
// Add Chainlink feed
chainlinkAdapter.addAsset(assetAddress, chainlinkFeedAddress);
```

#### 2. **PythAdapter**
- High-frequency price updates
- Low latency
- Cross-chain support
- Confidence intervals

```solidity
// Add Pyth price ID
pythAdapter.addAsset(assetAddress, pythPriceId);
```

#### 3. **UniswapAdapter**
- DEX-based pricing
- On-chain liquidity
- TWAP support
- Manipulation resistant

```solidity
// Add Uniswap V3 pool
uniswapAdapter.addAsset(assetAddress, poolAddress);
```

#### 4. **BinanceAdapter**
- CEX price feeds
- High liquidity reference
- Off-chain updates
- Batch price updates

```solidity
// Add Binance symbol
binanceAdapter.addAsset(assetAddress, "BTCUSDT");
```

#### 5. **CoinGeckoAdapter**
- Aggregated market data
- Wide token coverage
- Historical data
- Off-chain updates

```solidity
// Add CoinGecko ID
coinGeckoAdapter.addAsset(assetAddress, "bitcoin");
```

#### 6. **CoinMarketCapAdapter**
- Market cap weighted prices
- Comprehensive coverage
- Trusted data source
- Off-chain updates

```solidity
// Add CMC ID
coinMarketCapAdapter.addAsset(assetAddress, 1); // Bitcoin
```

## Usage Guide

### Deploy System

```javascript
// 1. Deploy main oracle
const oracle = await PriceOracle.deploy();

// 2. Deploy adapters
const chainlink = await ChainlinkAdapter.deploy(oracle.address);
const pyth = await PythAdapter.deploy(oracle.address, pythAddress);
const uniswap = await UniswapAdapter.deploy(oracle.address);
const binance = await BinanceAdapter.deploy(oracle.address, updaterAddress);

// 3. Register adapters
await oracle.addAdapter(chainlink.address);
await oracle.addAdapter(pyth.address);
await oracle.addAdapter(uniswap.address);
await oracle.addAdapter(binance.address);

// 4. Deploy prediction market
const market = await PredictionMarket.deploy(
    oracle.address,
    assetAddress,
    epochDuration // e.g., 1 day
);
```

### Configure Assets

```javascript
// Add asset to each adapter
await chainlink.addAsset(btcAddress, chainlinkBtcFeed);
await pyth.addAsset(btcAddress, pythBtcId);
await uniswap.addAsset(btcAddress, btcWethPool);
await binance.addAsset(btcAddress, "BTCUSDT");
```

### Place Prediction

```javascript
// Approve tokens
await token.approve(market.address, lockAmount);

// Place prediction
await market.placePrediction(
    predictedPrice, // e.g., 50000e18 for $50,000
    lockAmount      // e.g., 1000e18 tokens
);
```

### Settle Epoch

```javascript
// Anyone can trigger settlement after epoch ends
await market.settleEpoch(epochId);

// Rewards automatically distributed to winners
```

### Query Information

```javascript
// Get current epoch info
const epochInfo = await market.getEpochInfo(currentEpochId);

// Get player prediction
const prediction = await market.getPlayerPrediction(epochId, playerAddress);

// Get all players in epoch
const players = await market.getEpochPlayers(epochId);
```

## Oracle Aggregation

The main `PriceOracle` contract aggregates prices from all adapters:

```solidity
// Weighted average from all active adapters
function _updateAggregatedPrice(address _asset) internal {
    uint256 sum = 0;
    uint256 count = 0;
    
    for (uint256 i = 0; i < adapters.length; i++) {
        if (adapterPrices[_asset][adapters[i]].isValid) {
            sum += adapterPrices[_asset][adapters[i]].price;
            count++;
        }
    }
    
    uint256 avgPrice = sum / count;
    prices[_asset] = PriceData(avgPrice, block.timestamp, true);
}
```

## Security Features

✅ **ReentrancyGuard**: Protection on all state-changing functions
✅ **Access Control**: Owner-only administrative functions
✅ **Price Staleness**: Maximum age checks on oracle data
✅ **Adapter Validation**: Only approved adapters can update prices
✅ **Safe Math**: Overflow protection in all calculations
✅ **Emergency Controls**: Owner can update oracles and settings

## Events

```solidity
event EpochStarted(uint256 indexed epochId, uint256 startTime, uint256 endTime);
event PredictionPlaced(uint256 indexed epochId, address indexed player, uint256 predictedPrice, uint256 lockedAmount);
event EpochSettled(uint256 indexed epochId, uint256 actualPrice, uint256 totalRewards);
event RewardClaimed(uint256 indexed epochId, address indexed player, uint256 reward, uint256 l1Distance);
```

## Best Practices

1. **Multiple Oracles**: Use 3+ adapters for price reliability
2. **Epoch Duration**: Balance between activity and fairness (1-7 days recommended)
3. **Lock Amounts**: Set minimum to prevent spam
4. **Price Staleness**: Monitor oracle update frequency
5. **Settlement**: Automate with keeper bots for timely settlements
6. **Testing**: Thoroughly test with small amounts first

## Gas Optimization

- Batch operations where possible
- Efficient array operations in settlement
- View functions for off-chain calculations
- Minimal storage reads/writes

## Integration Example

```javascript
// Complete flow
const market = await PredictionMarket.at(marketAddress);

// 1. Check current epoch
const currentEpoch = await market.currentEpochId();
const epochInfo = await market.getEpochInfo(currentEpoch);

if (block.timestamp < epochInfo.endTime) {
    // 2. Place prediction
    await token.approve(market.address, lockAmount);
    await market.placePrediction(myPrediction, lockAmount);
} else {
    // 3. Settle if ended
    await market.settleEpoch(currentEpoch);
}

// 4. Check rewards
const players = await market.getEpochPlayers(currentEpoch);
for (const player of players) {
    const pred = await market.getPlayerPrediction(currentEpoch, player);
    console.log(`${player}: predicted ${pred.predictedPrice}, locked ${pred.lockedAmount}`);
}
```

## License

MIT License

---

**Built for fair, transparent, and competitive price prediction markets** 🎯
