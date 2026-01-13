# Market Contracts

This folder contains the marketplace and payment-related smart contracts for the BlocTime system.

## Contracts

### Market.sol
Simplified marketplace for buying bloctime with whitelisted tokens. Tracks user bloctime with start/stop mechanism and deducts on transfers.

**Key Features:**
- Buy bloctime using whitelisted payment tokens
- Start/stop bloctime sessions
- Automatic deduction of elapsed blocks
- Transfer bloctime between users
- Integration with TokenGate for multi-token support

**Main Functions:**
- `buy(address paymentToken, uint256 blocTimeAmount)` - Purchase bloctime
- `startBlocTime()` - Start consuming bloctime
- `stopBlocTime()` - Stop and settle bloctime usage
- `transfer(address to, uint256 amount)` - Transfer bloctime to another user
- `getUserBlocTime(address user)` - Get user's bloctime status

### TokenGate.sol
Payment module that manages whitelisted tokens and their prices for bloctime purchases.

**Key Features:**
- Manual price setting for supported tokens
- Multi-token payment support
- Price calculation based on USD value
- Token whitelist management

**Main Functions:**
- `setPrices(address[] tokens, uint256[] prices, uint8[] decimals)` - Set token prices
- `isTokenModed(address token)` - Check if token is whitelisted
- `getTokenPrice(address token)` - Get token price info
- `calculatePayment(address paymentToken, uint256 blocTimeAmount, uint256 blocTimePriceUSD)` - Calculate payment required

### BlocTimeTracker.sol
Tracks user bloctime sessions with start/stop mechanism and automatic deduction on transfers.

**Key Features:**
- Session-based bloctime tracking
- Automatic deduction of elapsed blocks
- Purchase bloctime with multiple payment tokens
- Before-transfer hooks for balance management

**Main Functions:**
- `startSession()` - Start a bloctime session
- `stopSession()` - Stop session and deduct elapsed blocks
- `purchaseBlocTime(address paymentToken, uint256 blocTimeAmount, uint256 blocTimePriceUSD)` - Buy bloctime
- `beforeTransfer(address from)` - Hook for automatic deduction before transfers
- `getUserSession(address user)` - Get user session details

## Usage Flow

1. **Setup**: Deploy TokenGate and set whitelisted tokens with prices
2. **Purchase**: Users buy bloctime using supported payment tokens
3. **Consume**: Users start sessions to consume bloctime
4. **Track**: System automatically tracks and deducts elapsed blocks
5. **Transfer**: Users can transfer unused bloctime to others

## Integration

These contracts integrate with:
- **Registry**: Module registration and metadata
- **BlocTimeToken**: ERC20 token representing bloctime
- **Treasury**: Payment collection and distribution

## Security

- ReentrancyGuard protection on critical functions
- Owner-only administrative functions
- Balance validation before transfers
- Safe token transfer patterns using SafeERC20

## Events

- `BlocTimePurchased` - Bloctime purchase completed
- `BlocTimeStarted` - Session started
- `BlocTimeStopped` - Session stopped
- `BlocTimeTransferred` - Bloctime transferred between users
- `PricesSet` - Token prices updated
