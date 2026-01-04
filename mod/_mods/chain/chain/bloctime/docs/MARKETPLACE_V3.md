# MarketplaceV3 - Transfer-Based Market

## Overview

MarketplaceV3 removes the entire bidding system and implements a pure transfer-based marketplace where:

- **Direct Transfers**: Users transfer bloctime tokens directly to others
- **Separate Market Solver**: Market clearing happens in a dedicated solver contract
- **No Bidding**: Eliminates bid creation, acceptance, rejection complexity
- **Simple & Clean**: Focused on core transfer functionality

## Architecture

### MarketplaceV3.sol
- Handles direct bloctime token transfers
- Applies treasury fees
- Records transfer history
- No bidding logic

### MarketSolver.sol
- Separate contract for market clearing
- Order matching algorithms
- Price discovery mechanisms
- Can be upgraded independently

## Key Changes from V2

### Removed
- ✗ Bid system (BidSystem.sol)
- ✗ Bid creation/acceptance/rejection
- ✗ Escrow for bids
- ✗ Rental listings
- ✗ Fractional sales

### Added
- ✓ Direct bloctime transfers
- ✓ Separate market solver contract
- ✓ Transfer history tracking
- ✓ Simplified fee structure

## Usage

### Transfer BlocTime

```solidity
// Transfer bloctime to another user
function transfer(address to, uint256 amount) external returns (uint256)
```

```javascript
const recipient = '0x...';
const amount = ethers.parseEther('100');

// Approve marketplace to spend bloctime
await blocTimeToken.approve(marketplaceAddress, amount);

// Transfer
const tx = await marketplace.transfer(recipient, amount);
const receipt = await tx.wait();
```

### Market Solver

```solidity
// Create market order in solver
function createOrder(uint256 amount, uint256 price, bool isBuy) external returns (uint256)

// Solve market (owner only)
function solveMarket(uint256[] calldata orderIds) external
```

```javascript
// Create buy order
const amount = ethers.parseEther('100');
const price = ethers.parseEther('1.5');
const isBuy = true;

await marketSolver.createOrder(amount, price, isBuy);

// Owner solves market
const orderIds = [1, 2, 3, 4];
await marketSolver.solveMarket(orderIds);
```

## Events

### MarketplaceV3
```solidity
event TransferCreated(uint256 indexed transferId, address indexed from, address indexed to, uint256 amount);
event TransferExecuted(uint256 indexed transferId);
event MarketSolverUpdated(address indexed newSolver);
event TreasuryUpdated(address indexed newTreasury);
event TreasuryFeeUpdated(uint256 newFeeBps);
```

### MarketSolver
```solidity
event OrderCreated(uint256 indexed orderId, address indexed user, uint256 amount, uint256 price, bool isBuy);
event OrderFilled(uint256 indexed orderId, uint256 indexed matchedOrderId);
event MarketCleared(uint256 clearingPrice, uint256 volume);
```

## Deployment

```javascript
// Deploy MarketplaceV3
const MarketplaceV3 = await ethers.getContractFactory('MarketplaceV3');
const marketplace = await MarketplaceV3.deploy(
  blocTimeTokenAddress,
  treasuryAddress,
  250 // 2.5% fee
);

// Deploy MarketSolver
const MarketSolver = await ethers.getContractFactory('MarketSolver');
const solver = await MarketSolver.deploy();

// Connect solver to marketplace
await marketplace.setMarketSolver(await solver.getAddress());
```

## Benefits

1. **Simplicity**: No complex bidding logic
2. **Modularity**: Market solving separated from transfers
3. **Upgradability**: Can swap solver contracts
4. **Gas Efficiency**: Fewer state changes
5. **Flexibility**: Multiple solver strategies possible

## Migration from V2

To migrate from MarketplaceV2:

1. Deploy MarketplaceV3 and MarketSolver
2. Users withdraw from V2 listings/bids
3. Transfer bloctime directly in V3
4. Use solver for market clearing

## Security

- ReentrancyGuard on all state-changing functions
- Treasury-only admin functions
- Fee caps (max 10%)
- Transfer validation

## License

MIT
