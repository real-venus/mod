# MarketplaceV2 - Flexible Pricing Marketplace

## Overview

MarketplaceV2 is a flexible marketplace contract where sellers can set their own prices for different time intervals. It supports:

- **Custom Pricing**: Sellers set their own price per interval
- **Flexible Intervals**: Define custom interval durations (in blocks)
- **Multi-Token Support**: Accept any ERC20 token as payment
- **Treasury Integration**: Configurable treasury fee with support for any address (EOA, contract, or Safe multisig)
- **Dynamic Listings**: Update prices and availability on the fly

## Key Features

### 1. Flexible Listing Creation

Sellers can create listings with:
- Custom price per interval
- Custom interval duration (in blocks)
- Maximum number of intervals available
- Any ERC20 token for payment

### 2. Treasury Support

The treasury address can be:
- **EOA (Externally Owned Account)**: Regular wallet address
- **Smart Contract**: Any contract address
- **Safe Multisig**: Gnosis Safe or similar multisig wallet

Treasury receives a configurable percentage (in basis points) of each sale.

### 3. Safe Integration

To use a Safe multisig as treasury:

```javascript
// Deploy with Safe address as treasury
const safeAddress = '0x...' // Your Safe multisig address
const marketplace = await MarketplaceV2.deploy(safeAddress, 250) // 2.5% fee

// Treasury fees automatically sent to Safe
// Safe owners can manage funds through Safe UI
```

## Contract Interface

### Creating a Listing

```solidity
function createListing(
    address paymentToken,      // ERC20 token for payment
    uint256 pricePerInterval,  // Price per interval
    uint256 intervalDuration,  // Duration in blocks
    uint256 maxIntervals       // Max intervals available
) external returns (uint256 listingId)
```

### Purchasing Intervals

```solidity
function purchase(
    uint256 listingId,
    uint256 intervals
) external returns (uint256 purchaseId)
```

### Managing Treasury

```solidity
// Update treasury address (only callable by current treasury)
function updateTreasury(address newTreasury) external

// Update treasury fee (only callable by treasury)
function updateTreasuryFee(uint256 newFeeBps) external
```

## Usage Examples

### Example 1: Create a Listing

```javascript
const paymentToken = '0x...' // USDC, DAI, or any ERC20
const pricePerInterval = ethers.parseEther('10') // 10 tokens per interval
const intervalDuration = 7200 // ~1 day on most chains
const maxIntervals = 365 // 1 year worth of intervals

const tx = await marketplace.createListing(
  paymentToken,
  pricePerInterval,
  intervalDuration,
  maxIntervals
)

const receipt = await tx.wait()
const listingId = receipt.logs[0].args.listingId
```

### Example 2: Purchase Intervals

```javascript
const listingId = 1
const intervals = 30 // Buy 30 intervals

// Get listing details
const listing = await marketplace.getListing(listingId)
const totalCost = listing.pricePerInterval * BigInt(intervals)

// Approve payment
const token = new ethers.Contract(listing.paymentToken, ERC20_ABI, signer)
await token.approve(marketplaceAddress, totalCost)

// Purchase
await marketplace.purchase(listingId, intervals)
```

### Example 3: Update Listing

```javascript
// Seller can update price and max intervals
const newPrice = ethers.parseEther('15')
const newMaxIntervals = 500

await marketplace.updateListing(listingId, newPrice, newMaxIntervals)
```

### Example 4: Safe Multisig Treasury

```javascript
// Deploy with Safe as treasury
const safeAddress = '0x...' // Your Safe multisig
const treasuryFeeBps = 250 // 2.5%

const MarketplaceV2 = await ethers.getContractFactory('MarketplaceV2')
const marketplace = await MarketplaceV2.deploy(safeAddress, treasuryFeeBps)

// All treasury fees automatically sent to Safe
// Safe owners can:
// 1. View incoming fees in Safe UI
// 2. Propose transactions to use funds
// 3. Require multiple signatures for treasury updates

// To update treasury (requires Safe transaction):
// 1. Create transaction in Safe UI
// 2. Call marketplace.updateTreasury(newAddress)
// 3. Get required signatures from Safe owners
// 4. Execute transaction
```

## Events

```solidity
event ListingCreated(uint256 indexed listingId, address indexed seller, address paymentToken, uint256 pricePerInterval, uint256 intervalDuration, uint256 maxIntervals)
event ListingUpdated(uint256 indexed listingId, uint256 pricePerInterval, uint256 maxIntervals)
event ListingCancelled(uint256 indexed listingId)
event Purchase(uint256 indexed purchaseId, uint256 indexed listingId, address indexed buyer, uint256 intervals, uint256 totalCost, address paymentToken)
event TreasuryUpdated(address indexed newTreasury)
event TreasuryFeeUpdated(uint256 newFeeBps)
```

## Security Considerations

1. **Treasury Control**: Only the current treasury address can update treasury settings
2. **Fee Limits**: Maximum treasury fee is capped at 50% (5000 basis points)
3. **Reentrancy Protection**: All state-changing functions use ReentrancyGuard
4. **Safe Token Transfers**: Uses OpenZeppelin's SafeERC20 for all token operations

## Integration with Safe

### Setting Up Safe as Treasury

1. **Deploy Safe Multisig**:
   - Use Gnosis Safe UI or SDK
   - Add required owners
   - Set signature threshold

2. **Deploy MarketplaceV2**:
   ```javascript
   const marketplace = await MarketplaceV2.deploy(safeAddress, treasuryFeeBps)
   ```

3. **Manage Treasury via Safe**:
   - All fee payments automatically sent to Safe
   - Propose treasury updates through Safe UI
   - Require multiple signatures for changes

### Safe Transaction Examples

```javascript
// Using Safe SDK to update treasury
import Safe from '@safe-global/safe-core-sdk'

const safeSdk = await Safe.create({ ethAdapter, safeAddress })

// Create transaction to update treasury
const transaction = {
  to: marketplaceAddress,
  data: marketplace.interface.encodeFunctionData('updateTreasury', [newTreasuryAddress]),
  value: '0'
}

// Propose transaction
const safeTransaction = await safeSdk.createTransaction({ safeTransactionData: transaction })
const txHash = await safeSdk.getTransactionHash(safeTransaction)

// Sign and execute (requires threshold signatures)
await safeSdk.signTransaction(safeTransaction)
await safeSdk.executeTransaction(safeTransaction)
```

## Deployment

```javascript
const { ethers } = require('hardhat')

async function deployMarketplaceV2() {
  const [deployer] = await ethers.getSigners()
  
  const treasuryAddress = '0x...' // EOA, contract, or Safe address
  const treasuryFeeBps = 250 // 2.5%
  
  const MarketplaceV2 = await ethers.getContractFactory('MarketplaceV2')
  const marketplace = await MarketplaceV2.deploy(treasuryAddress, treasuryFeeBps)
  await marketplace.waitForDeployment()
  
  console.log('MarketplaceV2 deployed to:', await marketplace.getAddress())
  console.log('Treasury:', treasuryAddress)
  console.log('Treasury Fee:', treasuryFeeBps / 100, '%')
  
  return marketplace
}

deployMarketplaceV2()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
```

## Testing

Run tests:
```bash
npx hardhat test test/MarketplaceV2.test.js
```

## License

MIT
