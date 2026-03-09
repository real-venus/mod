# ✅ PreFi Deployment Checklist

Use this checklist to ensure a smooth deployment to Base mainnet and testnet.

## 📋 Pre-Deployment

### Environment Setup
- [ ] Node.js 16+ installed
- [ ] npm/yarn installed
- [ ] Git repository initialized
- [ ] Dependencies installed (`npm install`)
- [ ] Contracts compiled (`npx hardhat compile`)

### Configuration Files
- [ ] `.env` created in root (from `.env.example`)
- [ ] `PRIVATE_KEY` added to `.env` (no 0x prefix)
- [ ] `BASESCAN_API_KEY` obtained and added
- [ ] `app/.env` created (from `app/.env.example`)
- [ ] `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` obtained and added

### Wallet Preparation
- [ ] Deployment wallet has testnet ETH (Base Sepolia)
- [ ] Deployment wallet has mainnet ETH (for mainnet deploy)
- [ ] Private key stored securely
- [ ] Wallet address noted for reference

## 🧪 Testnet Deployment (Base Sepolia)

### Pre-Launch
- [ ] Get testnet ETH from [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)
- [ ] Verify RPC URL works: https://sepolia.base.org
- [ ] Review `hardhat.config.js` network settings
- [ ] Choose deployment script:
  - [ ] `deploy-modular.js` (recommended - all oracles)
  - [ ] `deploy-base.js` (simple Uniswap V3 only)

### Deploy
- [ ] Run deployment: `npm run deploy:testnet`
- [ ] Verify all contracts deployed successfully
- [ ] Note contract addresses from console output
- [ ] Check `deployments/` folder for JSON record
- [ ] View contracts on [BaseScan Sepolia](https://sepolia.basescan.org)

### Verify Contracts
- [ ] Copy verification commands from deploy output
- [ ] Run `npx hardhat verify` for each contract
- [ ] Confirm verification on BaseScan

### Frontend Setup
- [ ] Update `app/.env` with contract addresses:
  - [ ] `NEXT_PUBLIC_PREFI_SEPOLIA`
  - [ ] `NEXT_PUBLIC_ORACLE_SEPOLIA`
  - [ ] `NEXT_PUBLIC_STAKE_TOKEN_SEPOLIA`
- [ ] Install frontend deps: `cd app && npm install`
- [ ] Start dev server: `npm run dev`
- [ ] Visit http://localhost:3000

### Testing
- [ ] Connect wallet to Base Sepolia
- [ ] Check if markets load correctly
- [ ] Mint test tokens (if using MockERC20)
- [ ] Place a test prediction
- [ ] Verify transaction on BaseScan
- [ ] Check prediction appears in UI
- [ ] Wait for market to end (or reduce duration for testing)
- [ ] Resolve market (owner only)
- [ ] Claim rewards
- [ ] Verify reward transfer

## 🚀 Mainnet Deployment (Base)

### Pre-Launch Checks
- [ ] All testnet testing completed successfully
- [ ] Contracts reviewed and audited
- [ ] Frontend tested thoroughly
- [ ] Platform fee set appropriately (≤10%)
- [ ] Min stake amount determined
- [ ] Oracle configurations reviewed
- [ ] Security checklist completed (see below)
- [ ] Terms of service prepared (if needed)
- [ ] Marketing materials ready

### Deploy to Mainnet
- [ ] **FINAL WARNING**: Mainnet deployment is permanent
- [ ] Double-check wallet has sufficient ETH for gas
- [ ] Run deployment: `npm run deploy:mainnet`
- [ ] Verify all contracts deployed
- [ ] Save deployment JSON file
- [ ] Note all contract addresses

### Verify Contracts
- [ ] Verify on BaseScan: `npx hardhat verify --network base <ADDRESS> <ARGS>`
- [ ] Confirm all contracts verified
- [ ] Check contract source code on BaseScan

### Frontend Configuration
- [ ] Update `app/.env` with mainnet addresses:
  - [ ] `NEXT_PUBLIC_PREFI_BASE`
  - [ ] `NEXT_PUBLIC_ORACLE_BASE`
  - [ ] `NEXT_PUBLIC_STAKE_TOKEN_BASE` (USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
- [ ] Build for production: `npm run build`
- [ ] Test production build locally: `npm start`

### Deploy Frontend
- [ ] Push code to GitHub
- [ ] Import project on Vercel/Netlify
- [ ] Add environment variables
- [ ] Deploy frontend
- [ ] Test live site
- [ ] Connect wallet to Base Mainnet
- [ ] Verify contract interactions work

### Post-Deploy
- [ ] Create initial markets
- [ ] Test each market type:
  - [ ] Uniswap V3 market
  - [ ] Chainlink market
  - [ ] Polymarket market (if using)
- [ ] Announce launch
- [ ] Monitor for issues
- [ ] Set up monitoring/alerts

## 🔐 Security Checklist

### Smart Contract Security
- [ ] ReentrancyGuard on all state-changing functions
- [ ] Pausable mechanism implemented
- [ ] Owner access controls in place
- [ ] Input validation on all functions
- [ ] SafeERC20 used for token transfers
- [ ] No floating point arithmetic
- [ ] Platform fee capped at 10%
- [ ] Oracle staleness checks implemented

### Operational Security
- [ ] Private keys never exposed
- [ ] `.env` files in `.gitignore`
- [ ] API keys secured
- [ ] Multi-sig wallet considered for owner
- [ ] Emergency pause plan in place
- [ ] Oracle monitoring set up
- [ ] Gas price limits considered

### Frontend Security
- [ ] HTTPS enabled
- [ ] Environment variables secured
- [ ] No sensitive data in client code
- [ ] Wallet connection secured (RainbowKit)
- [ ] Contract addresses validated
- [ ] XSS protection enabled

## 📊 Oracle Checklist

### Uniswap V3
- [ ] Factory address correct for network
- [ ] Pools exist for desired pairs
- [ ] TWAP interval appropriate (≥30 min)
- [ ] Pool has sufficient liquidity
- [ ] Fee tier selected (500/3000/10000)

### Chainlink
- [ ] Price feeds registered
- [ ] Feed addresses correct for Base
- [ ] Max price age set appropriately
- [ ] Staleness protection enabled
- [ ] Feeds monitored on chain.link

### Polymarket (if using)
- [ ] Off-chain updater secured
- [ ] Update frequency set
- [ ] Confidence thresholds configured
- [ ] Market IDs documented
- [ ] Resolution process established

### Custom Oracles (if any)
- [ ] Interface implementation complete
- [ ] Confidence scoring implemented
- [ ] Staleness checks added
- [ ] Data source documented
- [ ] Testing completed

## 📱 Frontend Checklist

### Functionality
- [ ] Wallet connection works
- [ ] Network switching works
- [ ] Markets load correctly
- [ ] Predictions can be placed
- [ ] Transactions confirm
- [ ] Rewards can be claimed
- [ ] All buttons functional
- [ ] Forms validate input

### UI/UX
- [ ] Mobile responsive
- [ ] Dark mode working
- [ ] Animations smooth
- [ ] Toast notifications appear
- [ ] Loading states present
- [ ] Error messages clear
- [ ] Design polished

### Performance
- [ ] Page load time acceptable
- [ ] Contract calls optimized
- [ ] Images optimized
- [ ] Bundle size reasonable
- [ ] No console errors

## 📚 Documentation Checklist

- [ ] README.md updated
- [ ] Contract addresses documented
- [ ] Deployment guide available
- [ ] Oracle usage explained
- [ ] Frontend setup documented
- [ ] API/ABI documented
- [ ] Examples provided
- [ ] Troubleshooting guide included

## 🎯 Launch Checklist

### Pre-Launch
- [ ] All tests passing
- [ ] Contracts verified
- [ ] Frontend deployed
- [ ] Domain configured (if custom)
- [ ] Social media accounts created
- [ ] Community channels set up (Discord, Telegram)
- [ ] Launch announcement drafted

### Launch Day
- [ ] Final testing completed
- [ ] Monitoring in place
- [ ] Team ready to respond
- [ ] Announcement published
- [ ] Initial markets created
- [ ] Demo predictions placed

### Post-Launch
- [ ] Monitor for issues
- [ ] Respond to user feedback
- [ ] Track metrics (users, volume, predictions)
- [ ] Address bugs quickly
- [ ] Engage with community
- [ ] Plan feature updates

## ⚠️ Risk Management

### Identified Risks
- [ ] Oracle manipulation (mitigation: TWAP, trusted feeds)
- [ ] Smart contract bugs (mitigation: OpenZeppelin, audits)
- [ ] Front-running (mitigation: commit-reveal future feature)
- [ ] Oracle downtime (mitigation: multiple oracle types)
- [ ] Liquidity issues (mitigation: minimum stake)

### Monitoring
- [ ] Contract events monitored
- [ ] Oracle prices monitored
- [ ] Gas prices tracked
- [ ] User activity tracked
- [ ] Error logs reviewed

### Emergency Procedures
- [ ] Pause contract procedure documented
- [ ] Owner key access confirmed
- [ ] Emergency contact list created
- [ ] Incident response plan written
- [ ] User communication plan ready

## ✅ Final Checks

Before Going Live:
- [ ] Everything above completed
- [ ] Team aligned on launch
- [ ] Support ready
- [ ] Marketing ready
- [ ] Analytics configured
- [ ] Backup plan in place

---

## 🎉 Ready to Launch?

If all checkboxes are completed, you're ready to deploy!

Run: `npm run deploy:mainnet`

**Good luck! 🚀**

---

**Need Help?**
- [QUICKSTART.md](./QUICKSTART.md) - Quick setup
- [DEPLOY.md](./DEPLOY.md) - Full deployment guide
- [ORACLES.md](./ORACLES.md) - Oracle help
- [FEATURES.md](./FEATURES.md) - Feature docs
