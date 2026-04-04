# BlocTime Protocol - API Reference

## Smart Contract APIs

### BlocTime Contract

#### Staking Functions

```solidity
function stake(uint256 amount, uint256 lockBlocks) external nonReentrant
```
**Description**: Stake native tokens and earn BlocTime tokens based on lock duration multiplier.

**Parameters**:
- `amount`: Amount of native tokens to stake
- `lockBlocks`: Number of blocks to lock tokens

**Events**: `Staked(address indexed user, uint256 amount, uint256 lockBlocks, uint256 blocTimeEarned)`

---

```solidity
function unstake(uint256 stakeId) external nonReentrant
```
**Description**: Unstake tokens after lock period expires and burn BlocTime tokens.

**Parameters**:
- `stakeId`: ID of the stake position

**Events**: `Unstaked(address indexed user, uint256 amount, uint256 blocTimeBurned)`

---

```solidity
function getMultiplier(uint256 lockBlocks) public view returns (uint256)
```
**Description**: Calculate multiplier for given lock duration using linear interpolation.

**Returns**: Multiplier in basis points (10000 = 1.0x)

---

#### Configuration Functions

```solidity
function setPoints(Point[] memory _points) external onlyOwner
```
**Description**: Set multiplier curve points (must be monotonically increasing).

**Parameters**:
- `_points`: Array of {blocks, multiplier} points

---

### Market Contract

#### Credit/Debit Functions

```solidity
function credit(address token, uint256 stableAmount) external nonReentrant
```
**Description**: Credit stable tokens by paying with whitelisted tokens at oracle price.

**Parameters**:
- `token`: Payment token address (must be whitelisted)
- `stableAmount`: Amount of stable tokens to receive (8 decimals)

**Events**: `Credit(address indexed user, address token, uint256 stableAmount, uint256 paymentAmount)`

---

```solidity
function debit(uint256 amount) external nonReentrant
```
**Description**: Burn stable tokens from balance.

**Parameters**:
- `amount`: Amount to debit

**Events**: `Debit(address indexed user, uint256 amount)`

---

#### TokenGate Integration

```solidity
function setTokenGate(address _tokenGate) external onlyOwner
```
**Description**: Update TokenGate contract for token whitelist and pricing.

---

### Registry Contract

```solidity
function registerModule(
    uint256 pricePerBlock,
    uint256 maxConcurrentUsers,
    string memory metadataURI
) external returns (uint256)
```
**Description**: Register a new module for rental.

**Returns**: Module ID

**Events**: `ModuleRegistered(uint256 indexed moduleId, address indexed owner)`

---

```solidity
function updateModule(
    uint256 moduleId,
    uint256 pricePerBlock,
    uint256 maxConcurrentUsers,
    string memory metadataURI
) external
```
**Description**: Update module parameters (owner only).

---

### Treasury Contract

```solidity
function fund(address token, uint256 amount) external nonReentrant
```
**Description**: Fund treasury with tokens for distribution.

**Events**: `Funded(address indexed token, uint256 amount)`

---

```solidity
function distribute(address token) external nonReentrant
```
**Description**: Distribute accumulated tokens to governance token holders.

**Events**: `Distributed(address indexed token, uint256 amount, uint256 timestamp)`

---

```solidity
function claim(address token) external nonReentrant
```
**Description**: Claim accumulated rewards for a specific token.

**Events**: `Claimed(address indexed user, address indexed token, uint256 amount)`

---

```solidity
function getClaimableAmount(address user, address token) public view returns (uint256)
```
**Description**: Calculate claimable amount for user.

**Returns**: Claimable token amount

---

### Oracle Adapters

#### ManualPriceOracle

```solidity
function setPrice(address token, uint256 price, uint8 decimals) external onlyOwner
```
**Description**: Manually set token price.

**Parameters**:
- `token`: Token address
- `price`: Price in USD
- `decimals`: Price decimals

---

```solidity
function getPrice(address token) external view returns (uint256 price, uint8 decimals)
```
**Description**: Get current token price.

---

#### ChainlinkAdapter

```solidity
function setPriceFeed(address token, address priceFeed) external onlyOwner
```
**Description**: Set Chainlink price feed for token.

---

#### PythAdapter

```solidity
function setPriceId(address token, bytes32 priceId) external onlyOwner
```
**Description**: Set Pyth Network price ID for token.

---

### TokenGate Contract

```solidity
function whitelistToken(address token) external onlyOwner
```
**Description**: Add token to whitelist.

---

```solidity
function removeToken(address token) external onlyOwner
```
**Description**: Remove token from whitelist.

---

```solidity
function isWhitelisted(address token) external view returns (bool)
```
**Description**: Check if token is whitelisted.

---

## Events Reference

### BlocTime Events

```solidity
event Staked(address indexed user, uint256 amount, uint256 lockBlocks, uint256 blocTimeEarned);
event Unstaked(address indexed user, uint256 amount, uint256 blocTimeBurned);
event PointsUpdated(uint256 pointCount);
```

### Market Events

```solidity
event Credit(address indexed user, address token, uint256 stableAmount, uint256 paymentAmount);
event Debit(address indexed user, uint256 amount);
event TokenGateUpdated(address indexed newTokenGate);
```

### Treasury Events

```solidity
event Funded(address indexed token, uint256 amount);
event Distributed(address indexed token, uint256 amount, uint256 timestamp);
event Claimed(address indexed user, address indexed token, uint256 amount);
event GovernanceTokenSet(address indexed token);
```

### Registry Events

```solidity
event ModuleRegistered(uint256 indexed moduleId, address indexed owner);
event ModuleUpdated(uint256 indexed moduleId);
event ModuleDeactivated(uint256 indexed moduleId);
```

## Error Codes

| Error | Description |
|-------|-------------|
| `Exceeds max lock blocks` | Lock period exceeds maximum allowed |
| `Still locked` | Attempting to unstake before lock expires |
| `Invalid stake ID` | Stake position not found |
| `Token not whitelisted` | Payment token not accepted |
| `Insufficient balance` | User balance too low |
| `No claimable amount` | Nothing to claim |
| `Invalid price` | Oracle price is zero or invalid |
| `Blocks must be monotonically increasing` | Multiplier points not in order |

## Gas Estimates

| Function | Estimated Gas |
|----------|---------------|
| `stake()` | ~150,000 |
| `unstake()` | ~100,000 |
| `credit()` | ~120,000 |
| `claim()` | ~80,000 |
| `distribute()` | ~60,000 |
| `registerModule()` | ~200,000 |

---

**Built with 💎 by the BlocTime Team**
