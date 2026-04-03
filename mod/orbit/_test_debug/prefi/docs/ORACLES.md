# 🔮 PreFi Oracle Guide

Complete guide to using multiple oracle types in PreFi prediction markets.

## 📊 Supported Oracle Types

PreFi supports **4 oracle types** for maximum flexibility:

1. **Uniswap V3** - Decentralized price feeds from liquidity pools
2. **Chainlink** - Professional price feeds with cryptographic proof
3. **Polymarket** - Prediction market probabilities
4. **Custom** - Build your own oracle adapter

## 🏗️ Oracle Architecture

### Universal Interface: `IPriceOracle`

All oracles implement a standard interface:

```solidity
interface IPriceOracle {
    function getPrice(bytes32 asset, bytes calldata data)
        external view returns (uint256 price, uint256 timestamp, uint8 confidence);

    function supportsAsset(bytes32 asset) external view returns (bool);

    function getMetadata() external view returns (
        string memory name,
        string memory description,
        string memory oracleType
    );
}
```

## 1️⃣ Uniswap V3 Oracle

### Overview
Time-weighted average price (TWAP) from Uniswap V3 liquidity pools on Base.

### Features
- ✅ Fully decentralized
- ✅ Manipulation-resistant (time-weighted)
- ✅ Works for any ERC20 pair
- ✅ No external dependencies

### Contract
`UniswapV3PriceOracle.sol`

### How to Create a Market

```javascript
const ethers = require('ethers');

// Encode oracle-specific data
const oracleData = ethers.utils.defaultAbiCoder.encode(
    ["address", "address", "uint24", "uint32"],
    [
        "0x4200000000000000000000000000000000000006", // WETH on Base
        "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
        3000,  // 0.3% fee tier
        1800   // 30 minute TWAP window
    ]
);

// Create market
await preFi.createMarket(
    "ETH/USD Price Prediction",
    ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ETH/USD")),
    0, // OracleType.UNISWAP_V3
    oracleData,
    7 * 24 * 60 * 60 // 7 days
);
```

### Fee Tiers
- **500** (0.05%) - Stablecoin pairs
- **3000** (0.3%) - Standard pairs (ETH/USDC, WBTC/ETH)
- **10000** (1%) - Exotic pairs

### Supported Pairs
Any Uniswap V3 pool on Base:
- ETH/USDC
- ETH/DAI
- WBTC/ETH
- Custom ERC20 pairs

### Confidence Level
**95%** - High confidence due to decentralized nature

---

## 2️⃣ Chainlink Oracle

### Overview
Industry-standard price feeds with cryptographic proof of data integrity.

### Features
- ✅ Professional-grade data
- ✅ Multiple data sources aggregated
- ✅ Staleness protection
- ✅ Widely trusted in DeFi

### Contract
`ChainlinkPriceOracle.sol`

### Available Feeds on Base

#### Base Mainnet
- **ETH/USD**: `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70`
- **BTC/USD**: `0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F`

#### Base Sepolia
- **ETH/USD**: `0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1`

[Full list of Base feeds →](https://docs.chain.link/data-feeds/price-feeds/addresses?network=base)

### How to Create a Market

```javascript
// No oracle data needed for Chainlink
// Asset ID must match registered feed

const assetId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ETH/USD"));

await preFi.createMarket(
    "ETH/USD (Chainlink)",
    assetId,
    1, // OracleType.CHAINLINK
    "0x", // No additional data needed
    7 * 24 * 60 * 60
);
```

### Adding Custom Feeds

Owner can add new price feeds:

```solidity
// Add BTC/USD feed
bytes32 assetId = keccak256("BTC/USD");
address feed = 0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F;

await chainlinkOracle.addFeed(assetId, feed);
```

### Staleness Protection
Prices older than 1 hour are rejected. Configurable via:

```solidity
await chainlinkOracle.setMaxPriceAge(3600); // 1 hour
```

### Confidence Level
**99%** - Very high confidence from professional oracle network

---

## 3️⃣ Polymarket Oracle

### Overview
Real-time prediction market probabilities from Polymarket.

### Features
- ✅ Real-world event outcomes
- ✅ Community-driven pricing
- ✅ Binary outcomes (YES/NO)
- ✅ Off-chain data bridge

### Contract
`PolymarketOracle.sol`

### Use Cases
- Election outcomes
- Sports predictions
- Economic indicators
- General yes/no questions

### How It Works

1. **Off-chain Updater** fetches Polymarket data
2. **Updates on-chain** with current probabilities
3. **Users predict** based on market sentiment
4. **Oracle resolves** with final outcome

### Creating a Market

```javascript
// Encode which side to track (YES or NO)
const oracleData = ethers.utils.defaultAbiCoder.encode(
    ["bool"],
    [true] // true = YES price, false = NO price
);

const marketId = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("BTC_100K_2024")
);

await preFi.createMarket(
    "Will Bitcoin reach $100k in 2024?",
    marketId,
    2, // OracleType.POLYMARKET
    oracleData,
    30 * 24 * 60 * 60 // 30 days
);
```

### Updating Market Data

Authorized updater (off-chain service):

```solidity
bytes32 marketId = keccak256("BTC_100K_2024");

// Update with current Polymarket data
await polymarketOracle.updateMarket(
    marketId,
    65, // YES price (65% probability)
    35, // NO price (35% probability)
    1250000e18 // 24h volume
);
```

### Resolving Markets

```solidity
// Resolve with final outcome
await polymarketOracle.resolveMarket(marketId, true); // YES won
```

### Confidence Calculation

Based on volume and recency:
- **90%** - High volume (>$10k), recent (<1 min)
- **75%** - Medium volume (>$1k), recent (<5 min)
- **60%** - Low volume, recent (<10 min)
- **40%** - Stale data

### Off-chain Updater (Example)

```javascript
// Node.js service to update Polymarket data
const axios = require('axios');

async function updatePolymarketPrices() {
    // Fetch from Polymarket API
    const response = await axios.get('https://clob.polymarket.com/markets/...');
    const market = response.data;

    // Update on-chain
    await polymarketOracle.updateMarket(
        marketId,
        market.yesPrice * 100,
        market.noPrice * 100,
        ethers.utils.parseEther(market.volume24h.toString())
    );
}

// Update every 5 minutes
setInterval(updatePolymarketPrices, 5 * 60 * 1000);
```

---

## 4️⃣ Custom Oracle

### Overview
Build your own oracle adapter for any data source.

### Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IPriceOracle.sol";

contract MyCustomOracle is IPriceOracle {
    function getPrice(
        bytes32 asset,
        bytes calldata data
    ) external view override returns (
        uint256 price,
        uint256 timestamp,
        uint8 confidence
    ) {
        // Your custom logic here
        // Could fetch from:
        // - Twitter sentiment analysis
        // - Weather data
        // - Sports scores
        // - Any API via off-chain resolver

        return (price, block.timestamp, 80);
    }

    function supportsAsset(bytes32 asset) external pure override returns (bool) {
        return true; // Define your logic
    }

    function getMetadata() external pure override returns (
        string memory name,
        string memory description,
        string memory oracleType
    ) {
        return (
            "My Custom Oracle",
            "Description of your oracle",
            "CUSTOM"
        );
    }
}
```

### Registering Custom Oracle

```solidity
// Deploy your oracle
const MyOracle = await ethers.getContractFactory("MyCustomOracle");
const oracle = await MyOracle.deploy();

// Register with PreFi
await preFi.registerOracle(3, oracle.address); // OracleType.CUSTOM
```

---

## 🎯 Choosing the Right Oracle

| Use Case | Recommended Oracle | Why |
|----------|-------------------|-----|
| **Token Prices** | Uniswap V3 or Chainlink | Decentralized + reliable |
| **Major Assets (BTC/ETH)** | Chainlink | Most trusted |
| **Emerging Tokens** | Uniswap V3 | Any pair with liquidity |
| **Real-world Events** | Polymarket | Community consensus |
| **Custom Data** | Custom Oracle | Full flexibility |

## 🔧 Oracle Management

### Viewing Oracle Info

```solidity
// Get market oracle details
(
    string memory name,
    string memory description,
    string memory oracleType
) = preFi.getOracleMetadata(marketId);
```

### Testing Oracle Before Market

```javascript
// Test if asset is supported
const assetId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ETH/USD"));
const isSupported = await uniswapOracle.supportsAsset(assetId);

// Get current price
const [price, timestamp, confidence] = await uniswapOracle.getPrice(
    assetId,
    oracleData
);

console.log(`Price: $${ethers.utils.formatUnits(price, 18)}`);
console.log(`Confidence: ${confidence}%`);
```

## 🛡️ Security Considerations

### Uniswap V3
- ✅ Use longer TWAP intervals (30+ min) for resistance to manipulation
- ✅ Verify pool has sufficient liquidity
- ⚠️ Pools with low liquidity can be manipulated

### Chainlink
- ✅ Check staleness (timestamp)
- ✅ Verify feed exists for your asset
- ✅ Monitor feed health on [Chainlink Docs](https://data.chain.link)

### Polymarket
- ✅ Set appropriate max price age
- ✅ Secure off-chain updater (use backend service, not client-side)
- ✅ Verify volume before trusting price
- ⚠️ Centralized updater is a trust point

### Custom
- ✅ Thoroughly audit your implementation
- ✅ Add staleness checks
- ✅ Implement confidence scoring
- ⚠️ You control data quality

## 📚 Examples

### Multi-Oracle Market

Create predictions with different oracles for comparison:

```javascript
// ETH/USD with 3 oracles
await preFi.createMarket("ETH/USD (Uniswap)", assetId, 0, uniData, duration);
await preFi.createMarket("ETH/USD (Chainlink)", assetId, 1, "0x", duration);
await preFi.createMarket("ETH/USD (Custom)", assetId, 3, customData, duration);
```

### Event-based with Polymarket

```javascript
// "Will candidate X win election?"
const eventId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ELECTION_2024"));
await preFi.createMarket(
    "Election 2024 Prediction",
    eventId,
    2, // Polymarket
    ethers.utils.defaultAbiCoder.encode(["bool"], [true]), // YES price
    90 * 24 * 60 * 60 // 90 days
);
```

---

## 🚀 Best Practices

1. **Test on Sepolia first** - Always deploy and test on testnet
2. **Monitor oracle health** - Check confidence levels and timestamps
3. **Set appropriate durations** - Longer for price feeds, shorter for events
4. **Diversify oracles** - Use multiple for critical markets
5. **Document oracle config** - Make it clear which oracle/settings used

---

**Need help?** Check the [main documentation](./README_COMPLETE.md) or [deployment guide](./DEPLOY.md)
