# ⚡ PreFi Quick Start Guide

Get your prediction market running in **5 minutes**!

## 🎯 What You'll Deploy

A fully functional prediction market on Base with:
- ✅ Uniswap V3, Chainlink, and Polymarket oracles
- ✅ Beautiful UI with wallet connection
- ✅ L2 distance-based fair scoring
- ✅ Ready for mainnet or testnet

## 📦 One-Line Install

```bash
cd /Users/broski/mod/mod/orbit/prefi && npm install && cd app && npm install && cd ..
```

## �� 3 Steps to Deploy

### Step 1: Configure (2 minutes)

```bash
# Root .env
cp .env.example .env
# Add your PRIVATE_KEY

# Frontend .env
cd app && cp .env.example .env
# Add your NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
```

Get WalletConnect ID: https://cloud.walletconnect.com

### Step 2: Deploy Contracts (2 minutes)

**Testnet:**
```bash
npx hardhat run scripts/deploy-modular.js --network baseSepolia
```

**Mainnet:**
```bash
npx hardhat run scripts/deploy-modular.js --network base
```

Copy contract addresses to `app/.env`

### Step 3: Launch UI (1 minute)

```bash
cd app
npm run dev
```

Visit: http://localhost:3000

## 🎉 That's It!

You now have:
- ✅ Multi-oracle prediction market
- ✅ 3 sample markets created
- ✅ Beautiful UI running locally

## 📊 What Was Deployed

### Contracts
1. **UniswapV3PriceOracle** - Decentralized TWAP prices
2. **ChainlinkPriceOracle** - Professional price feeds
3. **PolymarketOracle** - Real-world event predictions
4. **PreFiModular** - Main prediction market
5. **MockERC20** - Test token (testnet only)

### Sample Markets
1. ETH/USD (Uniswap V3 TWAP)
2. ETH/USD (Chainlink)
3. "Will Bitcoin reach $100k?" (Polymarket)

## 🚀 Next Steps

### Create Your First Prediction

```javascript
// In the UI or via contract:
1. Connect wallet
2. Choose a market
3. Enter your prediction
4. Stake tokens
5. Submit!
```

### Create a Custom Market

```solidity
// Via contract owner
await preFi.createMarket(
    "My Custom Market",
    ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MY_ASSET")),
    0, // Uniswap V3
    oracleData,
    7 * 24 * 60 * 60 // 7 days
);
```

### Build Custom Oracle

```solidity
contract MyOracle is IPriceOracle {
    function getPrice(bytes32 asset, bytes calldata data)
        external view returns (uint256, uint256, uint8)
    {
        // Your logic here
        return (price, timestamp, confidence);
    }

    function supportsAsset(bytes32) external pure returns (bool) {
        return true;
    }

    function getMetadata() external pure returns (
        string memory,
        string memory,
        string memory
    ) {
        return ("My Oracle", "Description", "CUSTOM");
    }
}

// Deploy and register
await preFi.registerOracle(3, myOracle.address);
```

## 📚 Documentation

- **[DEPLOY.md](./DEPLOY.md)** - Full deployment guide
- **[ORACLES.md](./ORACLES.md)** - Oracle types & usage
- **[README_COMPLETE.md](./README_COMPLETE.md)** - Complete docs
- **[FEATURES.md](./FEATURES.md)** - Feature overview

## 💡 Tips

### Test Before Mainnet
Always deploy to Base Sepolia first:
```bash
npx hardhat run scripts/deploy-modular.js --network baseSepolia
```

### Get Testnet ETH
Base Sepolia Faucet: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

### Verify Contracts
```bash
npx hardhat verify --network baseSepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

### Monitor Gas Costs
```bash
REPORT_GAS=true npx hardhat test
```

## 🎨 UI Customization

Edit `app/src/app/globals.css` for styling:

```css
:root {
  --accent-blue: #0052ff;
  --accent-green: #00ff88;
}
```

## 🔧 Common Commands

```bash
# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to testnet
npm run deploy:testnet

# Deploy to mainnet
npm run deploy:mainnet

# Start frontend
cd app && npm run dev

# Build for production
cd app && npm run build
```

## 🐛 Troubleshooting

### "Insufficient funds"
- Get testnet ETH from faucet
- Check wallet has enough for gas

### "Network not supported"
- Verify hardhat.config.js network settings
- Check RPC URLs are accessible

### Frontend not connecting
- Verify contract addresses in app/.env
- Clear browser cache
- Reconnect wallet

### Deployment failed
- Check private key in .env (no 0x prefix)
- Verify network name matches config
- Ensure sufficient gas

## 📊 Network Info

### Base Sepolia (Testnet)
- Chain ID: 84532
- RPC: https://sepolia.base.org
- Explorer: https://sepolia.basescan.org
- Faucet: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

### Base Mainnet
- Chain ID: 8453
- RPC: https://mainnet.base.org
- Explorer: https://basescan.org

## 🎁 What's Included

### Smart Contracts
- ✅ Modular oracle system
- ✅ L2 distance scoring
- ✅ ReentrancyGuard protection
- ✅ Pausable emergency stop
- ✅ Fee collection mechanism

### Frontend
- ✅ Next.js 14 with App Router
- ✅ TypeScript
- ✅ Tailwind CSS
- ✅ RainbowKit wallet UI
- ✅ Framer Motion animations
- ✅ Toast notifications
- ✅ Mobile responsive

### Oracles
- ✅ Uniswap V3 (any token pair)
- ✅ Chainlink (BTC, ETH, etc)
- ✅ Polymarket (real-world events)
- ✅ Custom (build your own)

## 🚀 Deploy to Production

### Frontend on Vercel

1. Push to GitHub
2. Import on Vercel
3. Add environment variables
4. Deploy!

### Contracts on Mainnet

```bash
# Final checklist
- [ ] Tested on testnet
- [ ] Contract verified
- [ ] Frontend working
- [ ] Wallet funded
- [ ] API keys set

# Deploy
npm run deploy:mainnet
```

## 💬 Support

- **Docs**: See /docs folder
- **Issues**: GitHub Issues
- **Discord**: [Join Community]

---

## ⚡ Super Quick Deploy (YOLO Mode)

```bash
# Clone, configure, deploy
git clone <repo>
cd prefi
cp .env.example .env && nano .env
npm install && npx hardhat compile
npx hardhat run scripts/deploy-modular.js --network baseSepolia
cd app && cp .env.example .env && nano .env
npm install && npm run dev
```

🎉 **Done! Your prediction market is live!**

---

**Built with ❤️ on Base | Powered by Uniswap V3, Chainlink & Polymarket**
