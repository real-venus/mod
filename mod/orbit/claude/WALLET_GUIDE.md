# Wallet Manager Guide

The Claude Jobs interface includes a comprehensive wallet manager that allows you to view your wallet balance, transaction history, and token holdings.

## Features

### 💎 Overview Tab
- **Balance Display**: View your native ETH balance with USD estimate
- **Wallet Information**:
  - Full wallet address with copy function
  - Network details (name and chain ID)
  - Wallet type (MetaMask, SubWallet, Local, or Password-derived)
- **Seed Phrase Management**: For local wallets, securely view and copy your recovery phrase
- **Quick Actions**: Refresh wallet data or disconnect

### 📜 Transactions Tab
- **Transaction History**: View recent transactions from the blockchain
- **Smart Filtering**: Filter by all, sent, or received transactions
- **Transaction Details**:
  - Transaction hash (clickable to copy)
  - From/To addresses
  - Value in ETH
  - Status (success/failed)
  - Timestamp
  - Block number
  - Gas information
- **Export Functionality**: Export transaction history to CSV format
- **Caching**: Transaction data is cached for 5 minutes for better performance

### 🪙 Tokens Tab
- **Native Token**: Always shows your ETH balance with USD value
- **ERC20 Tokens**: Automatically detects common tokens on supported networks
- **Supported Networks**:
  - Ethereum Mainnet (USDC, USDT, WBTC, DAI)
  - Base Mainnet (USDC)
  - Base Sepolia (USDC)
  - Polygon (USDC, USDT)
- **Balance Display**: Shows token balance with USD value (when available)

## How to Use

### Opening the Wallet Manager

1. Make sure you're connected with a wallet (MetaMask, SubWallet, Local, or Password)
2. Click on your wallet address in the top header bar
3. The Wallet Manager modal will open

### Viewing Transaction History

1. Open the Wallet Manager
2. Click on the "TRANSACTIONS" tab
3. Use the filter buttons to view:
   - **ALL**: All transactions
   - **SEND**: Only outgoing transactions
   - **RECEIVE**: Only incoming transactions
4. Click on any transaction hash to copy it to clipboard
5. Click "EXPORT CSV" to download your transaction history

### Managing Your Wallet

#### Local Wallet Seed Phrase
If you're using a local wallet:
1. Go to the "OVERVIEW" tab
2. Click "SHOW SEED PHRASE"
3. **⚠️ WARNING**: Keep this phrase secret and secure
4. Click "COPY" to copy the phrase to clipboard
5. Store it in a secure location (password manager, hardware wallet, etc.)

#### Refreshing Data
- Click "REFRESH DATA" in the Overview tab to reload:
  - Current balance
  - Network information
  - Transaction history
  - Token balances

#### Disconnecting
- Click "DISCONNECT WALLET" to log out
- This clears your authentication token and returns you to the login screen

## Wallet Types Explained

### 🦊 MetaMask
- Browser extension wallet
- Transactions require confirmation in MetaMask
- Most widely used Ethereum wallet

### 🔵 SubWallet
- Multi-chain browser extension wallet
- Supports Ethereum, Polkadot, and more
- Transactions require confirmation in SubWallet

### 🔑 Local Wallet
- Generated and stored in your browser's localStorage
- BIP-39 mnemonic phrase (12-24 words)
- **Important**: Back up your seed phrase!
- Persists across browser sessions
- Lost if you clear browser data without backing up

### 🔐 Password-Derived Wallet
- Deterministic wallet derived from a password using keccak256
- Same password always generates the same wallet
- No seed phrase - your password IS the key
- **Important**: Use a strong, unique password!

## Transaction History Details

### What's Shown
- **Last ~10,000 blocks**: Recent transaction history
- **Real-time status**: Success, failed, or pending
- **Gas information**: Gas used and gas price (when available)
- **Value**: Amount of ETH transferred
- **Type**: Send, receive, or contract interaction

### Performance Notes
- Transaction history is cached for 5 minutes
- First load may take a few seconds to scan the blockchain
- Subsequent views use cached data for instant display
- Click "REFRESH DATA" to force a new blockchain scan

### Limitations
- History shows last ~50 blocks worth of transactions (for performance)
- For complete history, use a block explorer like Etherscan
- Some networks may have limited transaction scanning
- Contract interactions show minimal details

## Token Detection

### Automatic Detection
The wallet manager automatically checks for common ERC20 tokens on supported networks:

#### Ethereum Mainnet (Chain ID: 1)
- USDC (USD Coin)
- USDT (Tether USD)
- WBTC (Wrapped Bitcoin)
- DAI (Dai Stablecoin)

#### Base Mainnet (Chain ID: 8453)
- USDC (USD Coin)

#### Base Sepolia (Chain ID: 84532)
- USDC (USD Coin)

#### Polygon (Chain ID: 137)
- USDC (USD Coin)
- USDT (Tether USD)

### Token Balance Display
- Only tokens with non-zero balances are shown
- Balances are formatted with appropriate decimals
- USD values shown when available

## Export Formats

### CSV Export
When you export transactions, you get a CSV file with:
- Transaction hash
- From address
- To address
- Value in ETH
- Transaction type (send/receive)
- Status (success/failed/pending)
- Block number
- ISO timestamp
- Gas used
- Gas price

### File Naming
Exported files are named:
```
transactions-[address-prefix]-[timestamp].csv
```

Example: `transactions-0x1234...5678-1234567890.csv`

## Security Best Practices

### 🔒 Seed Phrase Security
1. **Never share** your seed phrase with anyone
2. **Never** store it in plain text on your computer
3. **Always** back it up in multiple secure locations
4. **Write it down** on paper and store securely
5. **Consider** using a hardware wallet for large amounts

### 🛡️ General Security
1. Always verify the website URL before connecting
2. Use different passwords for different services
3. Enable 2FA where available
4. Be cautious of phishing attempts
5. Regularly check your transaction history for unauthorized activity

### 💰 Safe Practices
1. Never keep large amounts in browser wallets
2. Test with small amounts first
3. Double-check recipient addresses before sending
4. Be aware of gas fees before confirming transactions
5. Use hardware wallets for long-term storage

## Troubleshooting

### Transaction History Not Loading
1. Check your internet connection
2. Ensure you're connected to the correct network
3. Try clicking "REFRESH DATA"
4. Clear browser cache and reload
5. Check browser console for errors

### Tokens Not Showing
1. Verify you're on a supported network
2. Check that you actually have tokens in your wallet (use a block explorer)
3. Tokens must be from the common token list for your network
4. Try refreshing the wallet data

### Balance Shows 0
1. Confirm you're connected to the correct network
2. Check your wallet address on a block explorer
3. Wait for network sync to complete
4. Try disconnecting and reconnecting

### Can't Copy to Clipboard
1. Ensure your browser allows clipboard access
2. Try clicking the copy button again
3. Manually select and copy the text
4. Check browser permissions

## Advanced Usage

### Using Wallet Utilities in Code

The wallet manager includes utility functions you can use in your own code:

```typescript
import {
  formatAddress,
  formatEth,
  getExplorerUrl,
  getNetworkName,
  getTimeAgo,
  exportToCSV,
  copyToClipboard,
} from "../utils/wallet";

// Format addresses
formatAddress("0x1234567890abcdef1234567890abcdef12345678");
// Returns: "0x1234...5678"

// Format ETH values
formatEth("1234567890000000000", 4);
// Returns: "1.2345"

// Get block explorer URL
getExplorerUrl(1, "0x123...", "tx");
// Returns: "https://etherscan.io/tx/0x123..."

// Get network name
getNetworkName(84532);
// Returns: "Base Sepolia"

// Get time ago string
getTimeAgo(1234567890);
// Returns: "2d ago" or similar

// Export transactions
exportToCSV(transactions, walletAddress);

// Copy to clipboard
await copyToClipboard("text to copy");
```

### Caching System

Transaction history is cached in localStorage with the key:
```
claude_wallet_history_[address]
```

Cache expires after 5 minutes. You can manually clear cache by:
```typescript
import { clearCachedHistory } from "../utils/wallet";
clearCachedHistory("0x1234...");
```

## Network Support

### Fully Supported Networks
- ✅ Ethereum Mainnet (1)
- ✅ Base Mainnet (8453)
- ✅ Base Sepolia (84532)
- ✅ Polygon (137)

### Partial Support (Balance only)
- ⚠️ Goerli Testnet (5)
- ⚠️ Sepolia Testnet (11155111)
- ⚠️ Mumbai Testnet (80001)
- ⚠️ Arbitrum One (42161)
- ⚠️ Optimism Mainnet (10)

### Adding Custom Networks

To add support for custom tokens on a network, edit:
```typescript
// app/src/utils/wallet.ts
export const COMMON_TOKENS: Record<number, Array<{
  address: string;
  symbol: string;
  decimals: number;
  name: string;
}>>
```

## Future Enhancements

Planned features for future releases:
- 🔄 Live transaction monitoring with notifications
- 📊 Charts and analytics for transaction history
- 🏷️ Transaction labeling and notes
- 📱 Mobile-optimized view
- 🔗 Support for more networks
- 🎨 Custom token addition
- 💱 Built-in token swaps
- 📧 Email transaction receipts
- 🔍 Advanced search and filtering
- 📈 Portfolio tracking across multiple wallets

## Support

For issues or questions:
- Check the [main README](README.md)
- Review [TROUBLESHOOTING](README.md#troubleshooting)
- Submit issues on GitHub
- Join the community Discord

---

**Built with ❤️ for the Mod ecosystem**

BISMILLAH
