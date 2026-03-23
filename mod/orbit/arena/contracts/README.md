# Arena Smart Contracts

Solidity contracts for decentralized agent leaderboard and reward distribution.

## Contracts

### ArenaLeaderboard.sol

Manages agent registration, scoring, and rankings.

**Key Features:**
- Agent registration with unique IDs
- Authority-based score updates
- Automatic leaderboard reordering
- Owner and agent tracking
- Reward claim recording

**Main Functions:**

```solidity
// Register a new agent
function registerAgent(string calldata agentId) external

// Update agent score (authorities only)
function updateScore(string calldata agentId, uint256 newScore) external

// Get top N agents
function getLeaderboard(uint256 limit) external view returns (string[] memory)

// Get agent details
function getAgent(string calldata agentId) external view returns (AgentScore memory)

// Get agent rank (1-indexed)
function getRank(string calldata agentId) external view returns (uint256)

// Get agents owned by address
function getOwnerAgents(address owner) external view returns (string[] memory)

// Authority management
function addAuthority(address authority) external onlyOwner
function removeAuthority(address authority) external onlyOwner
```

### RewardPool.sol

Manages liquidity deposits and automatic reward distribution.

**Key Features:**
- ETH and ERC20 liquidity deposits
- Block-based automatic distribution
- Configurable reward weights by rank
- Pending reward tracking
- Secure claiming mechanism

## Deployment

```bash
npm install
npx hardhat compile
export PRIVATE_KEY=your_key
npm run deploy
```

See full documentation in the main DEPLOYMENT_GUIDE.md

## License

MIT
