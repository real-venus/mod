# Oracle Contracts

This folder contains oracle adapter contracts for fetching token prices from various sources.

## Contracts

### IOracleAdapter.sol
Standard interface for oracle price feed adapters. Ensures consistent price fetching across different oracle providers.

**Interface Methods:**
- `getPrice(address token)` - Get latest price with decimals and timestamp
- `hasPriceFeed(address token)` - Check if price feed exists for token

### ChainlinkAdapter.sol
Oracle adapter for Chainlink price feeds.

**Key Features:**
- Integration with Chainlink AggregatorV3Interface
- Mapping of tokens to Chainlink price feeds
- Real-time price data from decentralized oracles
- Owner-controlled feed management

**Main Functions:**
- `setPriceFeed(address token, address priceFeed)` - Configure Chainlink feed for token
- `removePriceFeed(address token)` - Remove price feed
- `getPrice(address token)` - Fetch latest price from Chainlink
- `hasPriceFeed(address token)` - Check feed availability

### PythAdapter.sol
Oracle adapter for Pyth Network price feeds.

**Key Features:**
- Integration with Pyth Network
- Low-latency price updates
- Price normalization to 8 decimals
- Support for cross-chain price feeds

**Main Functions:**
- `setPriceId(address token, bytes32 priceId)` - Set Pyth price ID for token
- `removePriceId(address token)` - Remove price ID
- `getPrice(address token)` - Fetch latest price from Pyth (normalized to 8 decimals)
- `hasPriceFeed(address token)` - Check feed availability

### ManualPriceOracle.sol
Oracle adapter where owner manually sets token prices. Useful for testing or when external oracles are unavailable.

**Key Features:**
- Manual price setting by owner
- Batch price updates
- Timestamp tracking
- No external dependencies

**Main Functions:**
- `setPrice(address token, uint256 price, uint8 decimals)` - Set price for single token
- `batchSetPrices(address[] tokens, uint256[] prices, uint8[] decimals)` - Set multiple prices at once
- `removePrice(address token)` - Remove price data
- `getPrice(address token)` - Get manually set price
- `hasPriceFeed(address token)` - Check if price is set

## Oracle Selection

### Chainlink
**Best for:**
- Production environments
- High-value transactions
- Established tokens with existing feeds
- Maximum decentralization

### Pyth Network
**Best for:**
- Low-latency requirements
- Cross-chain deployments
- Newer tokens
- High-frequency updates

### Manual Oracle
**Best for:**
- Testing and development
- Private/permissioned networks
- Tokens without external feeds
- Controlled environments

## Integration Example

```solidity
// Deploy oracle adapter
ChainlinkAdapter oracle = new ChainlinkAdapter();

// Configure price feed
oracle.setPriceFeed(tokenAddress, chainlinkFeedAddress);

// Fetch price
(uint256 price, uint8 decimals, uint256 timestamp) = oracle.getPrice(tokenAddress);
```

## Price Format

All oracles return prices in the same format:
- **price**: Price value (e.g., 8 decimals for USD)
- **decimals**: Number of decimals in the price
- **timestamp**: Last update timestamp

## Security Considerations

- Validate price freshness using timestamp
- Check for zero or negative prices
- Implement price deviation limits
- Use multiple oracles for critical operations
- Monitor oracle health and uptime

## Events

- `PriceFeedSet` - Price feed configured
- `PriceFeedRemoved` - Price feed removed
- `PriceUpdated` - Manual price updated (ManualPriceOracle)
