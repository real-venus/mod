import { ethers } from 'ethers'
import config from '@/config.json'

// Contract ABIs
const LEADERBOARD_ABI = [
  'function registerAgent(string calldata agentId) external',
  'function updateScore(string calldata agentId, uint256 newScore) external',
  'function getLeaderboard(uint256 limit) external view returns (string[] memory)',
  'function getAgent(string calldata agentId) external view returns (address owner, string memory agentId, uint256 score, uint256 lastUpdateBlock, uint256 totalRewardsClaimed)',
  'function getRank(string calldata agentId) external view returns (uint256)',
  'function getOwnerAgents(address owner) external view returns (string[] memory)',
  'function scoreAuthorities(address) external view returns (bool)',
  'function addAuthority(address authority) external',
  'event AgentRegistered(string indexed agentId, address indexed owner)',
  'event ScoreUpdated(string indexed agentId, uint256 newScore, uint256 oldScore)',
]

const REWARD_POOL_ABI = [
  'function addEthLiquidity() external payable',
  'function addLiquidity(address token, uint256 amount) external',
  'function claimRewards(string calldata agentId, address token) external',
  'function getPendingRewards(string calldata agentId, address token) external view returns (uint256)',
  'function ethLiquidity() external view returns (uint256)',
  'function blocksPerDistribution() external view returns (uint256)',
  'function lastDistributionBlock() external view returns (uint256)',
  'function rewardsPerDistribution() external view returns (uint256)',
  'function updateDistributionSettings(uint256 _blocksPerDistribution, uint256 _rewardsPerDistribution) external',
  'function triggerDistribution() external',
  'event LiquidityAdded(address indexed token, address indexed provider, uint256 amount)',
  'event RewardClaimed(string indexed agentId, address indexed token, uint256 amount)',
]

export async function getProvider() {
  if (typeof window.ethereum === 'undefined') {
    throw new Error('MetaMask not installed')
  }

  const provider = new ethers.BrowserProvider(window.ethereum)
  const network = await provider.getNetwork()

  if (network.chainId !== BigInt(84532)) {
    throw new Error('Please switch to Base Sepolia network')
  }

  return provider
}

export async function getSigner() {
  const provider = await getProvider()
  return provider.getSigner()
}

export async function getLeaderboardContract(needsSigner = false) {
  const address = config.contracts.ArenaLeaderboard

  if (needsSigner) {
    const signer = await getSigner()
    return new ethers.Contract(address, LEADERBOARD_ABI, signer)
  }

  const provider = await getProvider()
  return new ethers.Contract(address, LEADERBOARD_ABI, provider)
}

export async function getRewardPoolContract(needsSigner = false) {
  const address = config.contracts.RewardPool

  if (needsSigner) {
    const signer = await getSigner()
    return new ethers.Contract(address, REWARD_POOL_ABI, signer)
  }

  const provider = await getProvider()
  return new ethers.Contract(address, REWARD_POOL_ABI, provider)
}
