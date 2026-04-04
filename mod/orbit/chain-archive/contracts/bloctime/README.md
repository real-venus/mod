# BlocTime Token System

## Overview

The BlocTime token system consists of two core contracts that work together to create a time-weighted staking mechanism:

1. **BlocTimeToken.sol** - ERC20 token representing accumulated bloctime
2. **BlocTimeStaking.sol** - Staking contract with duration-based multipliers

## BlocTimeToken

### Purpose
A simple ERC20 token that can only be minted/burned by the staking contract. Represents the user's accumulated "bloctime" based on their staking duration.

### Key Features
- Standard ERC20 implementation
- Mint/burn restricted to staking contract only
- One-time staking contract assignment

### Functions
```solidity
function setStakingContract(address _stakingContract) external onlyOwner
function mint(address to, uint256 amount) external
function burn(address from, uint256 amount) external
```

## BlocTimeStaking

### Purpose
Stake native tokens for a specified duration and earn BlocTime tokens based on a multiplier curve. Supports multiple concurrent stakes per user.

### Key Concepts

#### Multiplier Points
Define the relationship between lock duration and reward multiplier:
- Points are (blocks, multiplier) pairs
- Multipliers in basis points (10000 = 1x)
- Must be monotonically increasing
- Linear interpolation between points

**Example:**
```javascript
[
  { blocks: 0, multiplier: 10000 },      // 0 blocks = 1.0x
  { blocks: 10000, multiplier: 15000 },  // 10k blocks = 1.5x
  { blocks: 50000, multiplier: 20000 },  // 50k blocks = 2.0x
  { blocks: 100000, multiplier: 30000 }  // 100k blocks = 3.0x
]
```

#### BlocTime Calculation
```
BlocTime_earned = stake_amount × M(lock_blocks) / 10000

Where M(lock_blocks) is linearly interpolated from the points
```

### Core Functions

#### Admin Functions
```solidity
// Set multiplier curve points
function setPoints(Point[] calldata _points) external onlyOwner

// Update system parameters
function setParams(uint256 _maxLockBlocks, uint256 _distributionPercentage) external onlyOwner
```

#### User Functions
```solidity
// Stake tokens for specified duration
function stake(uint256 amount, uint256 lockBlocks) external nonReentrant

// Unstake specific position after lock period
function unstake(uint256 stakeId) external nonReentrant

// View user's stake IDs
function getUserStakeIds(address user) external view returns (uint256[] memory)

// View specific stake position
function getStakePosition(address user, uint256 stakeId) external view returns (
    uint256 amount,
    uint256 startBlock,
    uint256 lockBlocks,
    uint256 blocTimeBalance,
    uint256 blocksRemaining
)
```

#### View Functions
```solidity
// Get multiplier for any block count
function getMultiplier(uint256 blockCount) public view returns (uint256)

// Get all configured points
function getAllPoints() external view returns (Point[] memory)

// Get number of points
function getPointCount() external view returns (uint256)
```

### Usage Example

```javascript
// 1. Deploy contracts
const staking = await BlocTimeStaking.deploy(
    nativeTokenAddress,
    "BlocTime Token",
    "BLOC",
    100000,  // maxLockBlocks
    5000     // 50% distribution percentage
);

// 2. Set multiplier curve
await staking.setPoints([
    { blocks: 0, multiplier: 10000 },
    { blocks: 50000, multiplier: 20000 },
    { blocks: 100000, multiplier: 30000 }
]);

// 3. User stakes tokens
await nativeToken.approve(stakingAddress, amount);
await staking.stake(amount, 50000); // Lock for 50k blocks

// 4. User receives BlocTime tokens
// BlocTime = amount × 2.0 (from multiplier curve)

// 5. After lock period, unstake
await staking.unstake(stakeId);
// Returns native tokens, burns BlocTime tokens
```

### Security Features

✅ **ReentrancyGuard** - All state-changing functions protected
✅ **SafeERC20** - Safe token transfers
✅ **Monotonic Multipliers** - Prevents gaming the system
✅ **Lock Enforcement** - Cannot unstake before period ends
✅ **Multiple Stakes** - Each stake tracked independently
✅ **Emergency Withdraw** - Owner can recover tokens if needed

### Events

```solidity
event Staked(address indexed user, uint256 stakeId, uint256 amount, uint256 lockBlocks, uint256 blocTimeEarned)
event Unstaked(address indexed user, uint256 stakeId, uint256 amount, uint256 blocTimeReturned)
event ParamsUpdated(Params params)
event PointsSet(uint256 pointCount)
```

### Design Decisions

1. **Multiple Stakes**: Users can have multiple concurrent stakes with different durations
2. **Linear Interpolation**: Smooth multiplier curve between points
3. **Basis Points**: Multipliers use 10000 = 1x for precision
4. **Monotonic Enforcement**: Points must be increasing to prevent exploits
5. **Legacy Compatibility**: Maintains old `stakes` mapping for backward compatibility

### Integration with Ecosystem

- **Tracker**: Uses BlocTime tokens for session tracking
- **Marketplace**: Treasury rewards distributed based on BlocTime holdings
- **Registry**: Can track staking modules

---

**Built with 💎 by the BlocTime Team**