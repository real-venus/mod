# Treasury Contract

Multi-token treasury system with proportional reward distribution based on governance token ownership.

## Overview

The **MultiTokenTreasury** contract enables ERC20 governance token holders to claim proportional shares of ALL tokens held in the treasury. If you own 20% of the governance token, you can claim 20% of every token in the treasury.

## Key Features

- **Proportional Distribution**: Claim share based on governance token ownership
- **Multi-Token Support**: Treasury can hold and distribute multiple ERC20 tokens
- **Owner Revenue Share**: Configurable percentage (0-100%) reserved for contract owner
- **Automatic Accounting**: Tracks claimed amounts to prevent double-claiming
- **Flexible Withdrawals**: Withdraw single token or all tokens at once

## Core Concepts

### Governance Token
The ERC20 token that determines ownership percentage in the treasury. Set once during initialization.

### Treasury Tokens
ERC20 tokens that can be deposited and claimed from the treasury. Multiple tokens supported.

### Owner Percentage
Basis points (0-10000) representing owner's share of treasury. Remaining percentage distributed to governance token holders.
- 1000 = 10%
- 2500 = 25%
- 5000 = 50%

## Main Functions

### Setup (Owner Only)

**setGovernanceToken(address _governanceToken)**
- Set the governance token (one-time only)
- Determines ownership percentages for all claims

**addTreasuryToken(address _treasuryToken)**
- Add new token to treasury
- Users can claim proportional shares of this token

**setOwnerPercentage(uint256 _percentage)**
- Update owner's revenue share (0-10000 basis points)
- Affects future claims only

### Funding

**fundTreasury(address token, uint256 amount)**
- Deposit tokens into treasury
- Anyone can fund the treasury
- Token must be whitelisted first

### Claiming (Token Holders)

**withdrawToken(address token)**
- Claim proportional share of specific token
- Based on governance token ownership percentage
- Automatically tracks claimed amounts

**withdrawAll()**
- Claim proportional share of ALL treasury tokens
- Single transaction for all claimable tokens
- Gas-efficient for multiple token claims

### Owner Claims

**ownerWithdraw(address token)**
- Owner claims their percentage of specific token
- Based on ownerPercentage setting
- Separate accounting from user claims

### Query Functions

**getClaimableAmount(address holder, address token) → uint256**
- Calculate claimable amount for holder for specific token
- Accounts for already claimed amounts

**getAllClaimableAmounts(address holder) → (address[] tokens, uint256[] amounts)**
- Get claimable amounts for all treasury tokens
- Returns parallel arrays of tokens and amounts

**getTreasuryInfo() → (address govToken, address[] tokens, uint256[] balances, uint256[] totalClaimedAmounts, uint256 ownerPct)**
- Get complete treasury state
- Current balances and total claimed per token

**getHolderInfo(address holder) → (uint256 governanceBalance, uint256 ownershipPercentage, address[] tokens, uint256[] claimedAmounts, uint256[] claimableAmounts)**
- Get holder's complete status
- Governance balance, ownership %, claimed and claimable amounts

## Distribution Formula

### User Claims
```
totalAvailable = currentBalance + totalClaimed + ownerClaimed
distributableAmount = totalAvailable × (10000 - ownerPercentage) / 10000
userShare = distributableAmount × userGovernanceBalance / totalGovernanceSupply
claimable = userShare - alreadyClaimed
```

### Owner Claims
```
totalAvailable = currentBalance + totalClaimed + ownerClaimed
ownerShare = totalAvailable × ownerPercentage / 10000
claimable = ownerShare - ownerAlreadyClaimed
```

## Usage Example

### Setup Treasury
```solidity
// Deploy with 25% owner share
MultiTokenTreasury treasury = new MultiTokenTreasury(2500);

// Set governance token
treasury.setGovernanceToken(blocTimeTokenAddress);

// Add treasury tokens
treasury.addTreasuryToken(usdcAddress);
treasury.addTreasuryToken(wethAddress);
treasury.addTreasuryToken(daiAddress);
```

### Fund Treasury
```solidity
// Approve tokens first
USDC.approve(treasuryAddress, 10000e6);

// Fund treasury
treasury.fundTreasury(usdcAddress, 10000e6);
```

### Claim Rewards
```solidity
// Check claimable amount
uint256 claimable = treasury.getClaimableAmount(msg.sender, usdcAddress);

// Claim single token
treasury.withdrawToken(usdcAddress);

// Or claim all tokens at once
treasury.withdrawAll();
```

### Owner Claim
```solidity
// Owner claims their share
treasury.ownerWithdraw(usdcAddress);
```

## Security Features

✅ **ReentrancyGuard**: Protection on all withdrawal functions
✅ **SafeERC20**: Safe token transfer operations
✅ **Access Control**: Owner-only administrative functions
✅ **Claim Tracking**: Prevents double-claiming
✅ **Proportional Math**: Fair distribution based on ownership
✅ **Emergency Withdraw**: Owner can recover tokens if needed

## Events

- `GovernanceTokenSet(address indexed token)` - Governance token configured
- `TreasuryTokenAdded(address indexed token)` - New token added to treasury
- `TreasuryFunded(address indexed funder, address indexed token, uint256 amount)` - Treasury funded
- `Withdrawn(address indexed holder, address indexed token, uint256 amount, uint256 ownership)` - User claimed tokens
- `OwnerPercentageUpdated(uint256 newPercentage)` - Owner percentage changed
- `OwnerWithdrawn(address indexed token, uint256 amount)` - Owner claimed tokens

## Integration Points

- **BlocTime Staking**: Governance token minted from staking
- **Marketplace**: Automatic treasury funding from fees
- **Multi-Token Payments**: All payment tokens flow to treasury
- **Revenue Sharing**: Transparent distribution to all stakeholders

## Gas Optimization

- Batch withdrawals via `withdrawAll()`
- Efficient array operations
- Minimal storage reads
- View functions for off-chain calculations

## Common Scenarios

### Scenario 1: User with 10% Governance Tokens
- Treasury has 1000 USDC, 5 ETH, 2000 DAI
- Owner percentage: 20%
- User can claim: 80 USDC (10% of 80%), 0.4 ETH, 160 DAI

### Scenario 2: Owner Claims
- Treasury has 1000 USDC
- Owner percentage: 25%
- Owner can claim: 250 USDC
- Remaining 750 USDC distributed to governance holders

### Scenario 3: Multiple Claims Over Time
- User claims 100 USDC
- Treasury receives 500 more USDC
- User's new claimable = (proportional share of 600 total) - 100 already claimed

## Best Practices

1. **Set governance token immediately** after deployment
2. **Add treasury tokens** before funding begins
3. **Regular claims** to avoid large gas costs from accumulated tokens
4. **Monitor ownership %** as governance token supply changes
5. **Use withdrawAll()** for gas efficiency when claiming multiple tokens

## License

MIT License - See LICENSE file for details

---

**Built with 💎 for fair and transparent revenue distribution**