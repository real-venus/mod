# TokenGate Module

## Overview

`TokenGate.sol` is a **modular token whitelist and oracle management contract** designed to be used with Market contracts. It separates token gating logic from market logic for better modularity and reusability.

## Key Features

- **Modular Design**: Separate contract for token management
- **Oracle Integration**: Each token requires its own oracle adapter
- **Flexible Oracle Support**: Works with Chainlink, Pyth, or Manual oracles
- **Token Whitelist**: Manage which tokens are accepted for payments
- **Upgradeable**: Can switch oracle adapters without redeploying market

## Architecture

```
MarketModular
    ↓ (uses)
TokenGate
    ↓ (uses)
IOracleAdapter
    ↓ (implements)
ChainlinkAdapter / PythAdapter / ManualPriceOracle
```

## Contract Functions

### Oracle Management

```solidity
// Set or update oracle adapter
function setOracle(address _oracle) external onlyOwner
```

### Token Whitelist Management

```solidity
// Whitelist single token (requires oracle price feed)
function whitelistToken(address token) external onlyOwner

// Batch whitelist multiple tokens
function batchWhitelistTokens(address[] calldata tokens) external onlyOwner

// Remove token from whitelist
function delistToken(address token) external onlyOwner
```

### View Functions

```solidity
// Check if token is whitelisted
function isTokenWhitelisted(address token) public view returns (bool)

// Get list of all whitelisted tokens
function getTokenList() external view returns (address[] memory)

// Get current price for a token from oracle
function getTokenPrice(address token) external view returns (uint256 price, uint8 decimals, uint256 timestamp)
```

## Usage Flow

### 1. Deploy Oracle Adapter

```solidity
// Option A: Manual Oracle (for testing)
ManualPriceOracle oracle = new ManualPriceOracle();
oracle.setPrice(WETH, 200000000000, 8); // $2000 with 8 decimals

// Option B: Chainlink Oracle (for production)
ChainlinkAdapter oracle = new ChainlinkAdapter();
oracle.setPriceFeed(WETH, chainlinkETHUSDFeed);

// Option C: Pyth Oracle (for low-latency)
PythAdapter oracle = new PythAdapter(pythContractAddress);
oracle.setPriceId(WETH, ethPriceId);
```

### 2. Deploy TokenGate

```solidity
TokenGate tokenGate = new TokenGate(address(oracle));
```

### 3. Whitelist Tokens

```solidity
// Single token
tokenGate.whitelistToken(WETH);

// Batch tokens
address[] memory tokens = [WETH, USDC, DAI];
tokenGate.batchWhitelistTokens(tokens);
```

### 4. Deploy Market with TokenGate

```solidity
MarketModular market = new MarketModular(
    "Stable Token",
    "STABLE",
    treasuryAddress,
    address(tokenGate)
);
```

### 5. Use Market

```solidity
// User approves payment token
IERC20(WETH).approve(marketAddress, amount);

// Market uses TokenGate to validate token and get price
market.credit(WETH, stableAmount);
```

## Oracle Requirements

**Each token MUST have an oracle adapter configured before whitelisting:**

```solidity
// This will FAIL if oracle doesn't have price feed for token
tokenGate.whitelistToken(newToken);
// Reverts with: "No oracle price feed"
```

**Correct flow:**

```solidity
// 1. Configure oracle for token
oracle.setPrice(newToken, price, decimals); // Manual
// OR
oracle.setPriceFeed(newToken, chainlinkFeed); // Chainlink
// OR
oracle.setPriceId(newToken, pythPriceId); // Pyth

// 2. Then whitelist token
tokenGate.whitelistToken(newToken); // ✅ Success
```

## Modularity Benefits

### 1. Separation of Concerns
- Market handles credit/debit logic
- TokenGate handles token validation and pricing
- Oracle adapters handle price feeds

### 2. Reusability
- One TokenGate can be used by multiple markets
- Easy to upgrade oracle without touching market

### 3. Flexibility
- Switch between oracle providers (Chainlink → Pyth)
- Add/remove tokens without market changes
- Deploy new markets with existing TokenGate

## Security Features

- ✅ **Oracle Validation**: Checks `oracle.hasPriceFeed()` before whitelisting
- ✅ **Price Validation**: Ensures price > 0 on every transaction
- ✅ **Access Control**: Only owner can manage tokens and oracle
- ✅ **Modular Upgrades**: Can switch oracle without redeploying market

## Events

```solidity
event OracleUpdated(address indexed newOracle);
event TokenWhitelisted(address indexed token);
event TokenDelisted(address indexed token);
```

## Integration with MarketModular

```solidity
// Market delegates to TokenGate
function credit(address paymentToken, uint256 stableAmount) external {
    // Check whitelist via TokenGate
    require(tokenGate.isTokenWhitelisted(paymentToken), "Token not whitelisted");
    
    // Get price via TokenGate oracle
    (uint256 price, ,) = tokenGate.getTokenPrice(paymentToken);
    
    // ... rest of credit logic
}
```

## Comparison: Integrated vs Modular

| Feature | Market.sol (Integrated) | MarketModular.sol (Modular) |
|---------|------------------------|-----------------------------|
| Token Management | Built-in | Separate TokenGate |
| Oracle Support | Built-in | Via TokenGate |
| Reusability | Low | High |
| Upgradeability | Redeploy market | Swap TokenGate |
| Complexity | Lower | Slightly higher |
| Gas Cost | Slightly lower | Slightly higher |
| Best For | Simple use cases | Production systems |

## Testing

```javascript
const { expect } = require("chai");

describe("TokenGate", function () {
  it("Should require oracle price feed before whitelisting", async function () {
    const oracle = await ManualPriceOracle.deploy();
    const tokenGate = await TokenGate.deploy(oracle.address);
    
    // This should fail - no price feed
    await expect(
      tokenGate.whitelistToken(token.address)
    ).to.be.revertedWith("No oracle price feed");
    
    // Set price feed
    await oracle.setPrice(token.address, ethers.parseUnits("1", 8), 8);
    
    // Now should succeed
    await tokenGate.whitelistToken(token.address);
    expect(await tokenGate.isTokenWhitelisted(token.address)).to.be.true;
  });
});
```

## Best Practices

1. **Deploy Oracle First**: Always deploy and configure oracle before TokenGate
2. **Configure Price Feeds**: Ensure all tokens have oracle price feeds before whitelisting
3. **Use Manual Oracle for Testing**: Start with ManualPriceOracle, upgrade to Chainlink/Pyth for production
4. **Monitor Oracle Health**: Check price freshness and oracle uptime
5. **Keep TokenGate Separate**: Don't couple TokenGate logic with market logic

---

**Built with 💎 by the BlocTime Team**
