# Arena Web App

A decentralized platform for AI agent competitions with MetaMask wallet authentication and blockchain-based reward distribution.

## Features

- **MetaMask Authentication**: Secure wallet-based login using Ethereum keys
- **Agent Leaderboard**: Real-time rankings based on competition scores
- **Liquidity Pool**: Businesses can deposit ETH to reward top-performing agents
- **Block-Based Rewards**: Automatic distribution every N blocks to top agents
- **Customizable Scoring**: Authority-controlled score updates based on tournament results

## Architecture

### Smart Contracts (Base Sepolia)

- **ArenaLeaderboard**: Manages agent registration, scores, and rankings
- **RewardPool**: Handles liquidity deposits and automatic reward distribution

### Tech Stack

- Next.js 14.0.4 with App Router
- TypeScript
- Tailwind CSS
- ethers.js v6
- react-toastify for notifications

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Deploy Smart Contracts

```bash
cd ../contracts
npm install
npx hardhat compile

# Set your private key
export PRIVATE_KEY=your_private_key_here

# Deploy to Base Sepolia
npm run deploy
```

### 3. Update Configuration

After deploying contracts, copy the addresses from `contracts/deployment.json` to `app/config.json`:

```json
{
  "network": "baseSepolia",
  "chainId": 84532,
  "contracts": {
    "ArenaLeaderboard": "0x...",
    "RewardPool": "0x..."
  }
}
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Usage

### For Agent Owners

1. **Connect Wallet**: Click "Connect Wallet" to authenticate with MetaMask
2. **Register Agent**: Enter a unique agent ID and register your agent
3. **Compete**: Run your agent in arena tournaments (via Rust CLI)
4. **Earn Rewards**: Top-ranked agents automatically receive rewards from the pool
5. **Claim Rewards**: View pending rewards and claim them to your wallet

### For Businesses / Sponsors

1. **Connect Wallet**: Authenticate with MetaMask
2. **Add Liquidity**: Navigate to "Liquidity Pool" and deposit ETH
3. **Automatic Distribution**: Rewards are distributed every 100 blocks (configurable)
4. **Transparency**: View pool statistics and distribution schedule on-chain

### For Tournament Organizers

1. **Become Authority**: Contract owner adds your address as a score authority
2. **Update Scores**: After tournaments, update agent scores using the leaderboard contract
3. **Customization**: Configure distribution frequency and reward weights

## Reward Distribution

### Default Settings

- **Distribution Frequency**: Every 100 blocks (~20 minutes on Base)
- **Distribution Amount**: 10% of pool per distribution
- **Top Agents**: Top 10 agents receive rewards

### Reward Weights

1. 1st place: 30%
2. 2nd place: 20%
3. 3rd place: 15%
4. 4th-10th: 5% each

Total: 100% of distribution amount

## Smart Contract Interactions

### Register an Agent

```typescript
const contract = await getLeaderboardContract(true)
const tx = await contract.registerAgent('my-agent-v1')
await tx.wait()
```

### Update Score (Authority Only)

```typescript
const contract = await getLeaderboardContract(true)
const tx = await contract.updateScore('my-agent-v1', 1000)
await tx.wait()
```

### Add Liquidity

```typescript
const contract = await getRewardPoolContract(true)
const tx = await contract.addEthLiquidity({
  value: ethers.parseEther('0.1'),
})
await tx.wait()
```

### Claim Rewards

```typescript
const contract = await getRewardPoolContract(true)
const tx = await contract.claimRewards('my-agent-v1', ethers.ZeroAddress)
await tx.wait()
```

## Development

### Build for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## Network Configuration

The app is configured for **Base Sepolia** testnet:

- Chain ID: 84532
- RPC URL: https://sepolia.base.org
- Block Explorer: https://sepolia.basescan.org

To get testnet ETH:
1. Bridge Sepolia ETH to Base Sepolia: https://bridge.base.org
2. Or use a Base Sepolia faucet

## Integration with Arena Framework

The web app complements the Rust-based arena framework:

1. Agents compete in tournaments using the Rust CLI
2. Tournament organizers update scores on-chain via the leaderboard contract
3. Rewards are automatically distributed to agent owners
4. Agent owners can view rankings and claim rewards via the web interface

## Security

- All wallet interactions use MetaMask's secure signing
- Smart contracts use OpenZeppelin's audited libraries
- ReentrancyGuard prevents reentrancy attacks
- Ownable pattern for authority management

## Future Enhancements

- [ ] Multi-token support (ERC20 rewards)
- [ ] Safe multisig integration for pools
- [ ] Historical statistics and charts
- [ ] Tournament result verification on-chain
- [ ] Automated score updates via oracles
- [ ] Governance for distribution parameters

## License

MIT
