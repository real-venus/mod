# Bridge Page

A full-featured bridge interface for claiming EVM tokens from Sr25519 addresses, with support for both MetaMask and Subwallet connections.

## Features

### Wallet Support
- **MetaMask**: Connect via MetaMask browser extension
- **Subwallet**: Connect via Subwallet browser extension for both EVM and Substrate chains

### Bridge Functionality
- **Claim Tokens**: Submit claims to bridge tokens from Sr25519 to EVM addresses
- **Balance Display**: View your bridged token balance in real-time
- **Claim Verification**: Automatically checks if an Sr25519 address has already claimed
- **Transaction History**: Track all your bridge claims with status updates

### UI/UX
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Dark/Light Theme**: Inherits theme from the app's global theme context
- **Real-time Updates**: Live balance updates after successful claims
- **Status Indicators**: Visual feedback for pending, processing, completed, and failed claims
- **Toast Notifications**: User-friendly notifications for all actions

## Usage

### Connecting a Wallet

1. Navigate to `/bridge` in the app
2. Choose your wallet type:
   - Click "MetaMask" to connect with MetaMask
   - Click "Subwallet" to connect with Subwallet
3. Approve the connection request in your wallet extension

### Submitting a Claim

1. Once connected, navigate to the "Claim" tab
2. Enter your **Sr25519 Address** (from the substrate chain)
3. Enter the **Recipient EVM Address** (defaults to your connected wallet)
4. Enter the **Claim Amount**
5. Click "Submit Claim" to process

The system will:
- Verify that the Sr25519 address hasn't already claimed
- Process the claim transaction
- Update your token balance
- Add the claim to your history

### Viewing History

1. Click the "History" tab to view all your claims
2. Each claim shows:
   - Status (pending, processing, completed, failed)
   - Sr25519 source address
   - EVM recipient address
   - Token amount
   - Transaction hash (when completed)
   - Timestamp

## Technical Details

### Contract Integration

The page integrates with two smart contracts:

1. **BridgeToken** (`0x170b8F3d6bA907984233Fa3F75B68e83d1750640`)
   - ERC20 token contract for bridged assets
   - Symbol: BCOM (Bridged Commune)
   - Used for balance queries and transfers

2. **Bridge** (`0x65f0414D968749Ff44eCC7B56A1a6AdE687E74c9`)
   - Main bridge contract
   - Handles claim verification and processing
   - Prevents double-claiming via `hasClaimed()` function

### Network

- **Chain**: Base Sepolia Testnet
- **Chain ID**: 84532
- **RPC**: https://sepolia.base.org

### State Management

The bridge page maintains the following state:

```typescript
- walletConnection: Tracks connected wallet type, address, and provider
- sr25519Address: Source address for claims
- recipientAddress: Destination EVM address
- claimAmount: Amount to bridge
- tokenBalance: Current bridged token balance
- claims: Array of historical claims
- hasClaimed: Boolean flag for duplicate claim prevention
```

### Wallet Detection

The page automatically detects and syncs with:
- MetaMask via `useMetaMask()` context hook
- Subwallet via `window.injectedWeb3['subwallet-js']`

## Development

### Adding New Features

To extend the bridge functionality:

1. **Add new contract methods**: Update the ABI arrays in the contract instantiation
2. **Add new claim types**: Extend the `BridgeClaim` interface
3. **Add new wallet types**: Add detection logic in the wallet connection functions

### Custom Styling

The page uses CSS variables for theming:
- `--bg-primary`: Main background
- `--bg-secondary`: Card backgrounds
- `--bg-tertiary`: Nested component backgrounds
- `--text-primary`: Main text color
- `--text-secondary`: Secondary text color
- `--text-tertiary`: Muted text color
- `--border-strong`: Strong border color
- `--border-color`: Default border color

### Dependencies

- `ethers`: Ethereum library for contract interactions
- `react-toastify`: Toast notifications
- `@heroicons/react`: Icon library
- `framer-motion`: Animation library

## Future Enhancements

Potential improvements:
- Batch claiming for multiple Sr25519 addresses
- Real-time claim status updates via websockets
- Integration with Safe multisig for admin functions
- Cross-chain bridge support for multiple networks
- Claim approval workflow for validators
- Historical analytics and charts
