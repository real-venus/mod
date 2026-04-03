// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IArenaLeaderboard {
    function getRank(string calldata agentId) external view returns (uint256);
    function getAgent(string calldata agentId) external view returns (
        address owner,
        string memory agentId,
        uint256 score,
        uint256 lastUpdateBlock,
        uint256 totalRewardsClaimed
    );
    function recordRewardClaim(string calldata agentId, uint256 amount) external;
}

/**
 * @title RewardPool
 * @notice Manages liquidity pool and distributes rewards based on leaderboard rankings
 */
contract RewardPool is Ownable, ReentrancyGuard {

    IArenaLeaderboard public leaderboard;

    // Token => liquidity amount
    mapping(address => uint256) public liquidity;

    // ETH liquidity
    uint256 public ethLiquidity;

    // Distribution settings
    uint256 public blocksPerDistribution = 100; // Distribute every N blocks
    uint256 public lastDistributionBlock;
    uint256 public rewardsPerDistribution = 10; // Top 10 get rewards

    // Distribution weights (rank => percentage, sum = 100)
    mapping(uint256 => uint256) public rankWeights;

    // Agent ID => pending rewards (token => amount)
    mapping(string => mapping(address => uint256)) public pendingRewards;

    // Agent ID => pending ETH rewards
    mapping(string => uint256) public pendingEthRewards;

    event LiquidityAdded(address indexed token, address indexed provider, uint256 amount);
    event EthLiquidityAdded(address indexed provider, uint256 amount);
    event RewardsDistributed(uint256 blockNumber, uint256 totalAmount);
    event RewardClaimed(string indexed agentId, address indexed token, uint256 amount);
    event EthRewardClaimed(string indexed agentId, uint256 amount);

    constructor(address _leaderboard) Ownable(msg.sender) {
        leaderboard = IArenaLeaderboard(_leaderboard);
        lastDistributionBlock = block.number;

        // Default distribution: top 10 agents
        // 1st: 30%, 2nd: 20%, 3rd: 15%, 4th-10th: 5% each
        rankWeights[1] = 30;
        rankWeights[2] = 20;
        rankWeights[3] = 15;
        for (uint256 i = 4; i <= 10; i++) {
            rankWeights[i] = 5;
        }
    }

    /**
     * @notice Add ERC20 liquidity to the pool
     * @param token Token address
     * @param amount Amount to add
     */
    function addLiquidity(address token, uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");

        IERC20(token).transferFrom(msg.sender, address(this), amount);
        liquidity[token] += amount;

        emit LiquidityAdded(token, msg.sender, amount);

        _tryDistribute();
    }

    /**
     * @notice Add ETH liquidity to the pool
     */
    function addEthLiquidity() external payable nonReentrant {
        require(msg.value > 0, "Must send ETH");

        ethLiquidity += msg.value;

        emit EthLiquidityAdded(msg.sender, msg.value);

        _tryDistribute();
    }

    /**
     * @notice Claim pending rewards for an agent
     * @param agentId Agent identifier
     * @param token Token to claim (address(0) for ETH)
     */
    function claimRewards(string calldata agentId, address token) external nonReentrant {
        (address owner,,,,) = leaderboard.getAgent(agentId);
        require(msg.sender == owner, "Not agent owner");

        if (token == address(0)) {
            // Claim ETH
            uint256 amount = pendingEthRewards[agentId];
            require(amount > 0, "No pending ETH rewards");

            pendingEthRewards[agentId] = 0;

            (bool success,) = payable(msg.sender).call{value: amount}("");
            require(success, "ETH transfer failed");

            leaderboard.recordRewardClaim(agentId, amount);
            emit EthRewardClaimed(agentId, amount);
        } else {
            // Claim ERC20
            uint256 amount = pendingRewards[agentId][token];
            require(amount > 0, "No pending rewards");

            pendingRewards[agentId][token] = 0;

            IERC20(token).transfer(msg.sender, amount);

            leaderboard.recordRewardClaim(agentId, amount);
            emit RewardClaimed(agentId, token, amount);
        }
    }

    /**
     * @notice Get pending rewards for an agent
     * @param agentId Agent identifier
     * @param token Token address (address(0) for ETH)
     */
    function getPendingRewards(string calldata agentId, address token) external view returns (uint256) {
        if (token == address(0)) {
            return pendingEthRewards[agentId];
        }
        return pendingRewards[agentId][token];
    }

    /**
     * @notice Update distribution settings (owner only)
     */
    function updateDistributionSettings(
        uint256 _blocksPerDistribution,
        uint256 _rewardsPerDistribution
    ) external onlyOwner {
        blocksPerDistribution = _blocksPerDistribution;
        rewardsPerDistribution = _rewardsPerDistribution;
    }

    /**
     * @notice Update rank weights (owner only)
     * @param ranks Array of ranks to update
     * @param weights Array of weights (must sum to 100)
     */
    function updateRankWeights(uint256[] calldata ranks, uint256[] calldata weights) external onlyOwner {
        require(ranks.length == weights.length, "Array length mismatch");

        uint256 totalWeight = 0;
        for (uint256 i = 0; i < ranks.length; i++) {
            rankWeights[ranks[i]] = weights[i];
            totalWeight += weights[i];
        }

        require(totalWeight == 100, "Weights must sum to 100");
    }

    /**
     * @notice Try to distribute rewards if enough blocks have passed
     */
    function _tryDistribute() internal {
        if (block.number < lastDistributionBlock + blocksPerDistribution) {
            return;
        }

        _distributeRewards();
    }

    /**
     * @notice Distribute rewards to top agents based on leaderboard
     */
    function _distributeRewards() internal {
        string[] memory topAgents = _getTopAgents();

        // Distribute ETH rewards
        if (ethLiquidity > 0) {
            uint256 distributeAmount = (ethLiquidity * 10) / 100; // 10% per distribution

            for (uint256 i = 0; i < topAgents.length; i++) {
                uint256 rank = i + 1;
                uint256 weight = rankWeights[rank];
                if (weight > 0) {
                    uint256 reward = (distributeAmount * weight) / 100;
                    pendingEthRewards[topAgents[i]] += reward;
                    ethLiquidity -= reward;
                }
            }
        }

        lastDistributionBlock = block.number;
        emit RewardsDistributed(block.number, ethLiquidity);
    }

    /**
     * @dev Get top N agents from leaderboard
     */
    function _getTopAgents() internal view returns (string[] memory) {
        // This is a simplified version - in production, query from leaderboard contract
        string[] memory agents = new string[](rewardsPerDistribution);
        // Implementation would query leaderboard.getLeaderboard(rewardsPerDistribution)
        return agents;
    }

    /**
     * @notice Manual distribution trigger (owner only, for testing)
     */
    function triggerDistribution() external onlyOwner {
        _distributeRewards();
    }

    receive() external payable {
        ethLiquidity += msg.value;
        emit EthLiquidityAdded(msg.sender, msg.value);
    }
}
