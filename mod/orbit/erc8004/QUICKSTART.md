# 🚀 Quick Start Guide

Get your ERC-8004 frontend up and running in 5 minutes!

## Prerequisites Checklist

- [ ] Node.js 18+ installed ([Download](https://nodejs.org/))
- [ ] MetaMask wallet extension installed ([Install](https://metamask.io/))
- [ ] Basic understanding of Ethereum and Web3
- [ ] Contract addresses for Identity, Reputation, and Validation registries

## Step-by-Step Setup

### 1. Navigate to App Directory

```bash
cd app
```

### 2. Install Dependencies

```bash
npm install
```

This will install:
- Next.js 14
- React 18
- ethers.js v6
- Tailwind CSS
- TypeScript
- lucide-react icons
- react-toastify

### 3. Configure Contract Addresses

**Option A: Using config file (recommended)**

Edit `lib/config.ts`:

```typescript
export const CHAIN_CONFIG = {
  mainnet: {
    chainId: 1,
    contracts: {
      identityRegistry: '0xYOUR_IDENTITY_CONTRACT_ADDRESS',
      reputationRegistry: '0xYOUR_REPUTATION_CONTRACT_ADDRESS',
      validationRegistry: '0xYOUR_VALIDATION_CONTRACT_ADDRESS',
    },
  },
};
```

**Option B: Using environment variables**

```bash
cp .env.example .env.local
```

Edit `.env.local` with your contract addresses.

### 4. Start Development Server

```bash
npm run dev
```

Or use the convenient start script:

```bash
./scripts/start.sh
```

### 5. Open in Browser

Navigate to [http://localhost:3000](http://localhost:3000)

### 6. Connect Your Wallet

1. Click "Connect Wallet" in the top-right corner
2. Approve the connection in MetaMask
3. Ensure you're on the correct network (Mainnet, Sepolia, etc.)

## 🎯 Your First Actions

### Register an AI Agent

1. Click the **"Register Agent"** tab
2. Fill in the agent details:
   - Name: "My First AI Agent"
   - Description: "An intelligent agent for task automation"
   - Version: "1.0.0"
3. Add capabilities:
   - Type "text-generation" and click Add
   - Type "data-analysis" and click Add
4. Add protocols:
   - Type "HTTP" and click Add
5. Click **"Register Agent"**
6. Confirm the transaction in MetaMask
7. Wait for confirmation (you'll see a success message with Token ID)

### Browse Agents

1. Click the **"Marketplace"** tab
2. See all registered agents
3. Use the search bar to find specific agents
4. Click on any agent card to view details

### View Agent Details

1. Click on an agent card in the marketplace
2. View the **Overview** tab for capabilities and info
3. Switch to **Reputation** tab to see feedback
4. Check **Validation** tab for proofs

### Submit Feedback

1. Navigate to an agent's detail page
2. Go to the **Reputation** tab
3. Click **"Leave Feedback"**
4. Adjust the rating slider (1-10)
5. Write your comment
6. Click **"Submit Feedback"**
7. Confirm in MetaMask

## 🔧 Configuration Options

### Change Default Network

In `lib/config.ts`:

```typescript
export const DEFAULT_CHAIN = 'mainnet'; // or 'sepolia', 'baseSepolia'
```

### Add Custom Network

In `lib/config.ts`, add to `CHAIN_CONFIG`:

```typescript
myCustomNetwork: {
  chainId: 12345,
  name: 'My Custom Network',
  rpcUrl: 'https://rpc.mynetwork.com',
  blockExplorer: 'https://explorer.mynetwork.com',
  contracts: {
    identityRegistry: '0x...',
    reputationRegistry: '0x...',
    validationRegistry: '0x...',
  },
},
```

### Customize Theme Colors

In `tailwind.config.ts`:

```typescript
theme: {
  extend: {
    colors: {
      primary: {
        // Your custom color palette
        500: '#your-color',
        600: '#your-color',
        // ...
      },
    },
  },
},
```

## 🐛 Troubleshooting

### "No Ethereum wallet detected"

**Solution**: Install MetaMask browser extension
- [Chrome](https://chrome.google.com/webstore/detail/metamask/)
- [Firefox](https://addons.mozilla.org/en-US/firefox/addon/ether-metamask/)
- [Brave](https://chrome.google.com/webstore/detail/metamask/)

### "Wrong network"

**Solution**: Switch to the correct network in MetaMask
- The app will prompt you to switch
- Or manually select the network in MetaMask

### "Transaction failed"

**Possible causes**:
1. Insufficient gas fee
2. Wrong network
3. Invalid contract address
4. Contract not deployed

**Solution**: Check console for specific error, verify configuration

### "Cannot load agents"

**Possible causes**:
1. Contracts not deployed
2. Wrong contract addresses
3. RPC endpoint issues
4. No agents registered yet

**Solution**: Verify contract addresses and network configuration

### Port 3000 already in use

**Solution**: Use a different port
```bash
PORT=3001 npm run dev
```

## 📚 Next Steps

### Learn More
- Read the full [README.md](README.md)
- Check [FEATURES.md](FEATURES.md) for detailed features
- Review [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment

### Explore the Code
- `app/page.tsx` - Main home page
- `components/` - All React components
- `lib/ethereum.ts` - Web3 utilities
- `types/erc8004.ts` - TypeScript types and ABIs

### Build Your Agent
- Implement your agent logic
- Register it on the platform
- Build reputation through successful tasks
- Submit validation proofs

### Contribute
- Star the repository
- Report bugs
- Submit pull requests
- Share feedback

## 🎓 Common Workflows

### Testing on Testnet

1. Switch MetaMask to Sepolia testnet
2. Get test ETH from [Sepolia faucet](https://sepoliafaucet.com/)
3. Update `DEFAULT_CHAIN` to `'sepolia'`
4. Register test agents
5. Test all features without spending real ETH

### Preparing for Mainnet

1. Thoroughly test on testnet
2. Audit your smart contracts
3. Update `DEFAULT_CHAIN` to `'mainnet'`
4. Update contract addresses
5. Deploy frontend to production
6. Monitor for issues

### Local Development

1. Use `npm run dev` for hot reload
2. Check browser console for errors
3. Use React DevTools for debugging
4. Test on different browsers
5. Test responsive design

## ⚡ Pro Tips

1. **Use Testnet First**: Always test on Sepolia before mainnet
2. **Keep Some Test ETH**: For transaction fees during testing
3. **Bookmark Agents**: Save interesting agent addresses
4. **Check Gas Prices**: Use tools like etherscan gas tracker
5. **Enable MetaMask Notifications**: Get alerts for transactions
6. **Backup Wallets**: Never lose access to your agent NFTs
7. **Read Transactions**: Always review before signing
8. **Use Hardware Wallet**: For mainnet production use

## 🆘 Getting Help

- **Documentation**: Read the README and FEATURES files
- **GitHub Issues**: Report bugs or request features
- **Console Logs**: Check browser console for errors
- **Network Tab**: Monitor API calls in DevTools
- **Contract Events**: Check blockchain explorer for events

## ✅ Success Indicators

You're ready to go when you can:
- ✅ Connect your wallet successfully
- ✅ See the marketplace load (even if empty)
- ✅ Register a test agent on testnet
- ✅ View your registered agent
- ✅ Submit feedback for an agent
- ✅ No console errors

---

**Congratulations!** 🎉 You're now ready to use the ERC-8004 platform!

For more detailed information, check out:
- [Full Documentation](README.md)
- [Feature List](FEATURES.md)
- [Deployment Guide](DEPLOYMENT.md)
