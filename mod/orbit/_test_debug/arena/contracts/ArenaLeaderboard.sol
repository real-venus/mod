// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title ArenaLeaderboard
 * @notice Manages agent rankings and score updates with authority-based scoring
 */
contract ArenaLeaderboard is Ownable, ReentrancyGuard {

    struct AgentScore {
        address owner;
        string agentId;
        uint256 score;
        uint256 lastUpdateBlock;
        uint256 totalRewardsClaimed;
    }

    // Agent ID => AgentScore
    mapping(string => AgentScore) public agents;

    // Ordered list of agent IDs (top to bottom)
    string[] public leaderboard;

    // Authority addresses that can update scores
    mapping(address => bool) public scoreAuthorities;

    // Agent ID => exists
    mapping(string => bool) public agentExists;

    // Owner => agent IDs they own
    mapping(address => string[]) public ownerAgents;

    event AgentRegistered(string indexed agentId, address indexed owner);
    event ScoreUpdated(string indexed agentId, uint256 newScore, uint256 oldScore);
    event AuthorityAdded(address indexed authority);
    event AuthorityRemoved(address indexed authority);
    event RewardClaimed(string indexed agentId, uint256 amount);

    constructor() Ownable(msg.sender) {
        scoreAuthorities[msg.sender] = true;
    }

    /**
     * @notice Register a new agent
     * @param agentId Unique identifier for the agent
     */
    function registerAgent(string calldata agentId) external {
        require(!agentExists[agentId], "Agent already exists");
        require(bytes(agentId).length > 0, "Agent ID cannot be empty");

        agents[agentId] = AgentScore({
            owner: msg.sender,
            agentId: agentId,
            score: 0,
            lastUpdateBlock: block.number,
            totalRewardsClaimed: 0
        });

        agentExists[agentId] = true;
        ownerAgents[msg.sender].push(agentId);
        leaderboard.push(agentId);

        emit AgentRegistered(agentId, msg.sender);
    }

    /**
     * @notice Update agent score (only by authorities)
     * @param agentId Agent to update
     * @param newScore New score value
     */
    function updateScore(string calldata agentId, uint256 newScore) external {
        require(scoreAuthorities[msg.sender], "Not authorized");
        require(agentExists[agentId], "Agent does not exist");

        uint256 oldScore = agents[agentId].score;
        agents[agentId].score = newScore;
        agents[agentId].lastUpdateBlock = block.number;

        _reorderLeaderboard(agentId);

        emit ScoreUpdated(agentId, newScore, oldScore);
    }

    /**
     * @notice Add a score authority
     * @param authority Address to grant authority
     */
    function addAuthority(address authority) external onlyOwner {
        scoreAuthorities[authority] = true;
        emit AuthorityAdded(authority);
    }

    /**
     * @notice Remove a score authority
     * @param authority Address to revoke authority
     */
    function removeAuthority(address authority) external onlyOwner {
        scoreAuthorities[authority] = false;
        emit AuthorityRemoved(authority);
    }

    /**
     * @notice Get leaderboard rankings
     * @param limit Maximum number of results
     * @return Array of agent IDs in ranking order
     */
    function getLeaderboard(uint256 limit) external view returns (string[] memory) {
        uint256 length = limit < leaderboard.length ? limit : leaderboard.length;
        string[] memory result = new string[](length);

        for (uint256 i = 0; i < length; i++) {
            result[i] = leaderboard[i];
        }

        return result;
    }

    /**
     * @notice Get agent details
     * @param agentId Agent identifier
     */
    function getAgent(string calldata agentId) external view returns (AgentScore memory) {
        require(agentExists[agentId], "Agent does not exist");
        return agents[agentId];
    }

    /**
     * @notice Get agent rank (1-indexed)
     * @param agentId Agent identifier
     */
    function getRank(string calldata agentId) external view returns (uint256) {
        require(agentExists[agentId], "Agent does not exist");

        for (uint256 i = 0; i < leaderboard.length; i++) {
            if (keccak256(bytes(leaderboard[i])) == keccak256(bytes(agentId))) {
                return i + 1;
            }
        }

        return 0;
    }

    /**
     * @notice Get all agents owned by an address
     * @param owner Owner address
     */
    function getOwnerAgents(address owner) external view returns (string[] memory) {
        return ownerAgents[owner];
    }

    /**
     * @notice Record reward claim (called by RewardPool)
     * @param agentId Agent claiming reward
     * @param amount Amount claimed
     */
    function recordRewardClaim(string calldata agentId, uint256 amount) external {
        require(agentExists[agentId], "Agent does not exist");
        agents[agentId].totalRewardsClaimed += amount;
        emit RewardClaimed(agentId, amount);
    }

    /**
     * @dev Reorder leaderboard after score update (bubble sort for simplicity)
     */
    function _reorderLeaderboard(string memory agentId) internal {
        uint256 index = 0;

        // Find agent's current position
        for (uint256 i = 0; i < leaderboard.length; i++) {
            if (keccak256(bytes(leaderboard[i])) == keccak256(bytes(agentId))) {
                index = i;
                break;
            }
        }

        uint256 agentScore = agents[agentId].score;

        // Bubble up if score increased
        while (index > 0 && agents[leaderboard[index - 1]].score < agentScore) {
            string memory temp = leaderboard[index - 1];
            leaderboard[index - 1] = leaderboard[index];
            leaderboard[index] = temp;
            index--;
        }

        // Bubble down if score decreased
        while (index < leaderboard.length - 1 && agents[leaderboard[index + 1]].score > agentScore) {
            string memory temp = leaderboard[index + 1];
            leaderboard[index + 1] = leaderboard[index];
            leaderboard[index] = temp;
            index++;
        }
    }
}
