# 🎨 PreFi Feature Overview

## ✨ What Makes PreFi Special

PreFi is the first **modular prediction market** that supports multiple oracle types on Base L2.

### 🔌 Modular Oracle System

Unlike traditional prediction markets locked to a single data source, PreFi supports:

- **Uniswap V3**: Decentralized token price feeds
- **Chainlink**: Professional-grade price oracles
- **Polymarket**: Real-world event probabilities
- **Custom**: Build your own oracle for ANY data source

### 📊 Create Any Prediction Market

Examples of what you can build:

#### Financial Markets
- ✅ ETH price predictions (Uniswap/Chainlink)
- ✅ BTC/USD forecasts
- ✅ Altcoin price targets
- ✅ DeFi protocol TVL predictions

#### Real-World Events (Polymarket)
- ✅ Election outcomes
- ✅ Sports results
- ✅ Economic indicators (GDP, inflation)
- ✅ Entertainment (Oscars, Grammy winners)

#### Custom Predictions
- ✅ GitHub stars by date
- ✅ Weather forecasts
- ✅ Social metrics (Twitter followers)
- ✅ NFT floor prices
- ✅ DAO governance outcomes

### 🎯 L2 Distance Scoring

Fair reward distribution based on accuracy:

\`\`\`
score = stake / (1 + distance²)
\`\`\`

- Closer predictions earn more
- Higher stakes amplify rewards
- Mathematically fair distribution
- No arbitrary judging

### 🚀 Deploy Anywhere

- ⚡ **Base Mainnet**: Low fees, fast finality
- 🧪 **Base Sepolia**: Testnet with faucets
- 🔮 **Future**: Any EVM chain

### 🎨 Beautiful UI

- Modern glassmorphism design
- Animated gradients and transitions
- Mobile-responsive
- RainbowKit wallet connection
- Real-time price updates
- Toast notifications

### 🔐 Security First

- ReentrancyGuard protection
- Pausable in emergencies
- Owner access controls
- SafeERC20 transfers
- Comprehensive input validation
- Open source & auditable

## 📈 Example Use Cases

### 1. Crypto Price Predictions
\`\`\`
Market: "ETH Price on Jan 1, 2025"
Oracle: Chainlink ETH/USD
Users predict: $3,500, $4,000, $4,500
Winner: Closest to actual price
\`\`\`

### 2. DeFi Events
\`\`\`
Market: "Will Aave V3 TVL hit $10B?"
Oracle: Custom (fetch from DeFi Llama)
Users stake: YES or NO
Outcome: Measured at end date
\`\`\`

### 3. Real-World Events
\`\`\`
Market: "Will BTC hit $100k in 2024?"
Oracle: Polymarket adapter
Users predict: probability %
Outcome: YES/NO from Polymarket
\`\`\`

### 4. NFT Markets
\`\`\`
Market: "CryptoPunks floor price in 6 months"
Oracle: Custom (OpenSea API)
Users predict: floor price in ETH
Winner: Closest prediction
\`\`\`

## 🛠️ For Developers

### Easy Integration

\`\`\`solidity
// Create a market
preFi.createMarket(
    "Your Market Name",
    assetId,
    oracleType,
    oracleData,
    duration
);
\`\`\`

### Build Custom Oracles

\`\`\`solidity
contract MyOracle is IPriceOracle {
    function getPrice(bytes32 asset, bytes calldata data)
        external view returns (uint256, uint256, uint8)
    {
        // Fetch from any source
        return (price, timestamp, confidence);
    }
}
\`\`\`

### Hook into Events

\`\`\`javascript
// Listen for predictions
preFi.on("PredictionPlaced", (marketId, player, value, stake) => {
    console.log(\`New bet: \${stake} on \${value}\`);
});

// Listen for settlements
preFi.on("MarketSettled", (marketId, actualValue, rewards) => {
    console.log(\`Market settled at \${actualValue}\`);
});
\`\`\`

## 🎁 Future Roadmap

- [ ] **Chainlink Automation**: Auto-settle markets
- [ ] **Cross-chain**: Deploy to Optimism, Arbitrum
- [ ] **Social Features**: Leaderboards, achievements
- [ ] **NFT Receipts**: Tokenized predictions
- [ ] **Governance**: Community-driven parameters
- [ ] **Mobile App**: React Native
- [ ] **Advanced Charts**: TradingView integration
- [ ] **Prediction Pools**: Team predictions
- [ ] **Referral System**: Earn from referrals

## 🌐 Network Support

### Current
- ✅ Base Mainnet (8453)
- ✅ Base Sepolia (84532)

### Planned
- 🔜 Optimism
- 🔜 Arbitrum
- 🔜 Polygon zkEVM

## 🎨 UI Features

- ✨ Glassmorphism cards
- 🎭 Animated gradients
- 📱 Mobile responsive
- 🌙 Dark mode (default)
- 💫 Smooth animations
- 🔔 Toast notifications
- 📊 Real-time updates
- 🎯 Intuitive UX

## 💎 For Users

### How to Participate

1. **Connect Wallet** - RainbowKit support
2. **Browse Markets** - See active predictions
3. **Place Bet** - Stake + predict value
4. **Wait for Settlement** - Oracle resolves
5. **Claim Rewards** - Get your winnings!

### Strategy Tips

- 🎯 **Accuracy matters**: Get close to win
- 💰 **Stake wisely**: Higher stakes = bigger rewards
- ⏰ **Timing**: Early predictions lock in edge
- 📊 **Do research**: Use oracle data
- 🎲 **Diversify**: Multiple predictions spread risk

## 📞 Get Started

1. Read [DEPLOY.md](./DEPLOY.md) - Deployment guide
2. Read [ORACLES.md](./ORACLES.md) - Oracle setup
3. Read [README_COMPLETE.md](./README_COMPLETE.md) - Full docs
4. Deploy on testnet first
5. Launch your first market!

---

**Built with ❤️ on Base**
