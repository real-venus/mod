# 🚀 PreFi Deployment Guide

Complete guide to deploy PreFi on Base Mainnet and Testnet with Uniswap V3 integration.

## 📋 Prerequisites

1. **Node.js & npm** (v16+)
```bash
node --version
npm --version
```

2. **Wallet with funds**
   - **Base Mainnet**: ETH for gas fees
   - **Base Sepolia**: Get testnet ETH from [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)

3. **API Keys**
   - BaseScan API key for contract verification: [https://basescan.org/myapikey](https://basescan.org/myapikey)
   - WalletConnect Project ID: [https://cloud.walletconnect.com](https://cloud.walletconnect.com)

## 🛠️ Step 1: Environment Setup

### Contract Environment (.env in root)

Create `/Users/broski/mod/mod/orbit/prefi/.env`:

```bash
# Private key (without 0x prefix)
PRIVATE_KEY=your_private_key_here

# RPC URLs (optional, uses public RPCs by default)
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# BaseScan API Key (for verification)
BASESCAN_API_KEY=your_basescan_api_key

# Optional: Gas reporting
REPORT_GAS=false
COINMARKETCAP_API_KEY=your_cmc_api_key
```

### Frontend Environment (app/.env)

Create `/Users/broski/mod/mod/orbit/prefi/app/.env`:

```bash
# WalletConnect Project ID
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Base Mainnet Contracts (fill after deployment)
NEXT_PUBLIC_PREFI_BASE=0x...
NEXT_PUBLIC_ORACLE_BASE=0x...
NEXT_PUBLIC_STAKE_TOKEN_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# Base Sepolia Contracts (fill after deployment)
NEXT_PUBLIC_PREFI_SEPOLIA=0x...
NEXT_PUBLIC_ORACLE_SEPOLIA=0x...
NEXT_PUBLIC_STAKE_TOKEN_SEPOLIA=0x...

# Optional: Custom RPC
NEXT_PUBLIC_BASE_RPC=https://mainnet.base.org
NEXT_PUBLIC_BASE_SEPOLIA_RPC=https://sepolia.base.org
```

## 📦 Step 2: Install Dependencies

### Contract Dependencies
```bash
cd /Users/broski/mod/mod/orbit/prefi
npm install
```

### Frontend Dependencies
```bash
cd app
npm install
```

## 🔨 Step 3: Compile Contracts

```bash
cd /Users/broski/mod/mod/orbit/prefi
npx hardhat compile
```

Expected output:
```
Compiled 15 Solidity files successfully
```

## 🌐 Step 4: Deploy to Base Sepolia (Testnet)

### Deploy Contracts
```bash
npx hardhat run scripts/deploy-base.js --network baseSepolia
```

This will:
1. Deploy UniswapV3Oracle
2. Deploy Mock ERC20 (for testnet only)
3. Deploy PreFiV3 contract
4. Create initial ETH/USD market
5. Save deployment info to `deployments/deployment-baseSepolia-{timestamp}.json`

### Copy Contract Addresses

After deployment, update `app/.env` with the printed addresses:
```bash
NEXT_PUBLIC_PREFI_SEPOLIA=0x... # PreFiV3 address
NEXT_PUBLIC_ORACLE_SEPOLIA=0x... # UniswapV3Oracle address
NEXT_PUBLIC_STAKE_TOKEN_SEPOLIA=0x... # Stake Token address
```

### Verify Contracts (Optional but Recommended)

```bash
npx hardhat verify --network baseSepolia <ORACLE_ADDRESS> 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24

npx hardhat verify --network baseSepolia <PREFI_ADDRESS> \
  <STAKE_TOKEN> <ORACLE_ADDRESS> <MIN_STAKE> 100
```

## 🎯 Step 5: Deploy to Base Mainnet

**⚠️ WARNING: Mainnet deployment requires real ETH. Double-check everything!**

### Deploy Contracts
```bash
npx hardhat run scripts/deploy-base.js --network base
```

This will use **USDC** as the stake token on mainnet (not a mock token).

### Update Frontend Environment

Update `app/.env` with mainnet addresses:
```bash
NEXT_PUBLIC_PREFI_BASE=0x...
NEXT_PUBLIC_ORACLE_BASE=0x...
NEXT_PUBLIC_STAKE_TOKEN_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 # Base USDC
```

### Verify Mainnet Contracts

```bash
npx hardhat verify --network base <ORACLE_ADDRESS> 0x33128a8fC17869897dcE68Ed026d694621f6FDfD

npx hardhat verify --network base <PREFI_ADDRESS> \
  0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 <ORACLE_ADDRESS> <MIN_STAKE> 100
```

## 🖥️ Step 6: Run Frontend

### Development Mode
```bash
cd app
npm run dev
```

Visit: [http://localhost:3000](http://localhost:3000)

### Production Build
```bash
cd app
npm run build
npm start
```

### Deploy to Vercel (Recommended)

1. Push code to GitHub
2. Import project on [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

## 🧪 Testing

### Test Contracts
```bash
cd /Users/broski/mod/mod/orbit/prefi
npx hardhat test
```

### Test on Local Network
```bash
# Terminal 1: Start local node
npx hardhat node

# Terminal 2: Deploy to local
npx hardhat run scripts/deploy-base.js --network localhost
```

## 📊 Network Information

### Base Mainnet (Chain ID: 8453)
- **RPC**: https://mainnet.base.org
- **Explorer**: https://basescan.org
- **Uniswap V3 Factory**: `0x33128a8fC17869897dcE68Ed026d694621f6FDfD`
- **WETH**: `0x4200000000000000000000000000000000000006`
- **USDC**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

### Base Sepolia (Chain ID: 84532)
- **RPC**: https://sepolia.base.org
- **Explorer**: https://sepolia.basescan.org
- **Faucet**: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
- **Uniswap V3 Factory**: `0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24`

## 🎨 Customization

### Update Platform Fee
```solidity
await preFi.setPlatformFee(200) // 2%
```

### Update Min Stake
```solidity
await preFi.setMinStake(ethers.parseEther("1"))
```

### Create New Market
```solidity
await preFi.createMarket(
  "BTC/USD",
  "0x...", // Token address
  7 * 24 * 60 * 60 // 7 days
)
```

## 🔐 Security Checklist

- [ ] Private keys stored securely (`.env` in `.gitignore`)
- [ ] Contracts verified on BaseScan
- [ ] Platform fee set appropriately (≤10%)
- [ ] Minimum stake set to prevent spam
- [ ] Oracle address set to trusted source
- [ ] Test all functions on testnet first
- [ ] Multi-sig wallet for contract ownership (recommended)

## 🐛 Troubleshooting

### "Insufficient funds" error
- Ensure wallet has enough ETH for gas
- Base Sepolia: Get testnet ETH from faucet

### "Network not supported"
- Check `hardhat.config.js` has correct network config
- Verify RPC URLs are accessible

### "Contract verification failed"
- Check constructor arguments match deployment
- Use `--constructor-args args.js` if needed

### Frontend not connecting
- Verify contract addresses in `app/.env`
- Check chain ID matches (8453 for mainnet, 84532 for testnet)
- Clear browser cache and reconnect wallet

## 📚 Additional Resources

- [Base Docs](https://docs.base.org)
- [Uniswap V3 Docs](https://docs.uniswap.org/protocol/concepts/V3-overview/oracle)
- [Hardhat Docs](https://hardhat.org/docs)
- [Next.js Docs](https://nextjs.org/docs)

## 🎉 Post-Deployment

1. **Share your dApp**: Get the Vercel URL
2. **Create initial markets**: ETH/USD, BTC/USD, etc.
3. **Test predictions**: Make some test predictions
4. **Monitor**: Watch for events and user activity
5. **Iterate**: Add new features and improvements

---

**Built with ❤️ on Base**
