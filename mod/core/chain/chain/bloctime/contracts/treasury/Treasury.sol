// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MultiTokenTreasury
 * @dev Treasury contract that allows ERC20 token holders to withdraw proportional shares of ALL tokens
 * If you own 20% of the governance ERC20, you can claim 20% of ALL tokens in the treasury
 * Owner gets N% of treasury, rest distributed to ERC20 holders
 */
contract MultiTokenTreasury is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public governanceToken;
    address[] public treasuryTokens;
    mapping(address => bool) public isTreasuryToken;
    
    mapping(address => mapping(address => uint256)) public claimed; // user => token => amount
    mapping(address => uint256) public totalClaimed; // token => total claimed
    
    uint256 public ownerPercentage; // in basis points (10000 = 100%)
    mapping(address => uint256) public ownerClaimed; // token => amount claimed by owner
    
    event GovernanceTokenSet(address indexed token);
    event TreasuryTokenAdded(address indexed token);
    event TreasuryFunded(address indexed funder, address indexed token, uint256 amount);
    event Withdrawn(address indexed holder, address indexed token, uint256 amount, uint256 ownership);
    event OwnerPercentageUpdated(uint256 newPercentage);
    event OwnerWithdrawn(address indexed token, uint256 amount);
    
    constructor(uint256 _ownerPercentage) {
        require(_ownerPercentage <= 10000, "Max 100%");
        ownerPercentage = _ownerPercentage;
    }
    
    /**
     * @dev Set owner percentage (only owner)
     */
    function setOwnerPercentage(uint256 _percentage) external onlyOwner {
        require(_percentage <= 10000, "Max 100%");
        ownerPercentage = _percentage;
        emit OwnerPercentageUpdated(_percentage);
    }
    
    /**
     * @dev Set the governance token (ERC20 that determines ownership)
     * Can only be set once
     */
    function setGovernanceToken(address _governanceToken) external onlyOwner {
        require(address(governanceToken) == address(0), "Already set");
        require(_governanceToken != address(0), "Invalid address");
        governanceToken = IERC20(_governanceToken);
        emit GovernanceTokenSet(_governanceToken);
    }
    
    /**
     * @dev Add a treasury token (can add multiple)
     */
    function addTreasuryToken(address _treasuryToken) external onlyOwner {
        require(_treasuryToken != address(0), "Invalid address");
        require(!isTreasuryToken[_treasuryToken], "Token already added");
        
        treasuryTokens.push(_treasuryToken);
        isTreasuryToken[_treasuryToken] = true;
        emit TreasuryTokenAdded(_treasuryToken);
    }
    
    /**
     * @dev Fund the treasury with tokens
     */
    function fundTreasury(address token, uint256 amount) external nonReentrant {
        require(isTreasuryToken[token], "Token not in treasury");
        require(amount > 0, "Amount must be > 0");
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit TreasuryFunded(msg.sender, token, amount);
    }
    
    /**
     * @dev Calculate claimable amount for owner for a specific token
     */
    function getOwnerClaimableAmount(address token) public view returns (uint256) {
        require(isTreasuryToken[token], "Token not in treasury");
        
        uint256 treasuryBalance = IERC20(token).balanceOf(address(this));
        uint256 totalAvailable = treasuryBalance + totalClaimed[token] + ownerClaimed[token];
        
        // Calculate owner's total share
        uint256 ownerTotalShare = (totalAvailable * ownerPercentage) / 10000;
        
        // Subtract what owner already claimed
        if (ownerTotalShare <= ownerClaimed[token]) return 0;
        
        return ownerTotalShare - ownerClaimed[token];
    }
    
    /**
     * @dev Owner withdraws their percentage
     */
    function ownerWithdraw(address token) external onlyOwner nonReentrant {
        uint256 claimable = getOwnerClaimableAmount(token);
        require(claimable > 0, "Nothing to claim");
        
        ownerClaimed[token] += claimable;
        
        IERC20(token).safeTransfer(owner(), claimable);
        emit OwnerWithdrawn(token, claimable);
    }
    
    /**
     * @dev Calculate claimable amount for a holder for a specific token
     */
    function getClaimableAmount(address holder, address token) public view returns (uint256) {
        require(address(governanceToken) != address(0), "Governance token not set");
        require(isTreasuryToken[token], "Token not in treasury");
        
        uint256 totalSupply = governanceToken.totalSupply();
        if (totalSupply == 0) return 0;
        
        uint256 holderBalance = governanceToken.balanceOf(holder);
        if (holderBalance == 0) return 0;
        
        uint256 treasuryBalance = IERC20(token).balanceOf(address(this));
        uint256 totalAvailable = treasuryBalance + totalClaimed[token] + ownerClaimed[token];
        
        // Calculate distributable amount (total - owner's share)
        uint256 distributableAmount = (totalAvailable * (10000 - ownerPercentage)) / 10000;
        
        // Calculate holder's share based on ownership percentage
        uint256 totalShare = (distributableAmount * holderBalance) / totalSupply;
        
        // Subtract what they've already claimed
        uint256 alreadyClaimed = claimed[holder][token];
        if (totalShare <= alreadyClaimed) return 0;
        
        return totalShare - alreadyClaimed;
    }
    
    /**
     * @dev Get claimable amounts for all treasury tokens
     */
    function getAllClaimableAmounts(address holder) external view returns (
        address[] memory tokens,
        uint256[] memory amounts
    ) {
        tokens = treasuryTokens;
        amounts = new uint256[](treasuryTokens.length);
        
        for (uint256 i = 0; i < treasuryTokens.length; i++) {
            amounts[i] = getClaimableAmount(holder, treasuryTokens[i]);
        }
        
        return (tokens, amounts);
    }
    
    /**
     * @dev Withdraw proportional share of a specific token
     */
    function withdrawToken(address token) public nonReentrant {
        uint256 claimable = getClaimableAmount(msg.sender, token);
        require(claimable > 0, "Nothing to claim");
        
        uint256 holderBalance = governanceToken.balanceOf(msg.sender);
        uint256 totalSupply = governanceToken.totalSupply();
        uint256 ownershipBps = (holderBalance * 10000) / totalSupply;
        
        claimed[msg.sender][token] += claimable;
        totalClaimed[token] += claimable;
        
        IERC20(token).safeTransfer(msg.sender, claimable);
        emit Withdrawn(msg.sender, token, claimable, ownershipBps);
    }
    
    /**
     * @dev Withdraw proportional share of ALL treasury tokens
     */
    function withdrawAll() external nonReentrant {
        require(treasuryTokens.length > 0, "No treasury tokens");
        
        uint256 holderBalance = governanceToken.balanceOf(msg.sender);
        uint256 totalSupply = governanceToken.totalSupply();
        uint256 ownershipBps = (holderBalance * 10000) / totalSupply;
        
        for (uint256 i = 0; i < treasuryTokens.length; i++) {
            address token = treasuryTokens[i];
            uint256 claimable = getClaimableAmount(msg.sender, token);
            
            if (claimable > 0) {
                claimed[msg.sender][token] += claimable;
                totalClaimed[token] += claimable;
                
                IERC20(token).safeTransfer(msg.sender, claimable);
                emit Withdrawn(msg.sender, token, claimable, ownershipBps);
            }
        }
    }
    
    /**
     * @dev Get treasury info
     */
    function getTreasuryInfo() external view returns (
        address govToken,
        address[] memory tokens,
        uint256[] memory balances,
        uint256[] memory totalClaimedAmounts,
        uint256 ownerPct
    ) {
        tokens = treasuryTokens;
        balances = new uint256[](treasuryTokens.length);
        totalClaimedAmounts = new uint256[](treasuryTokens.length);
        
        for (uint256 i = 0; i < treasuryTokens.length; i++) {
            balances[i] = IERC20(treasuryTokens[i]).balanceOf(address(this));
            totalClaimedAmounts[i] = totalClaimed[treasuryTokens[i]];
        }
        
        return (address(governanceToken), tokens, balances, totalClaimedAmounts, ownerPercentage);
    }
    
    /**
     * @dev Get holder info
     */
    function getHolderInfo(address holder) external view returns (
        uint256 governanceBalance,
        uint256 ownershipPercentage,
        address[] memory tokens,
        uint256[] memory claimedAmounts,
        uint256[] memory claimableAmounts
    ) {
        uint256 govBalance = address(governanceToken) != address(0) ? governanceToken.balanceOf(holder) : 0;
        uint256 totalSupply = address(governanceToken) != address(0) ? governanceToken.totalSupply() : 0;
        uint256 ownership = totalSupply > 0 ? (govBalance * 10000) / totalSupply : 0;
        
        tokens = treasuryTokens;
        claimedAmounts = new uint256[](treasuryTokens.length);
        claimableAmounts = new uint256[](treasuryTokens.length);
        
        for (uint256 i = 0; i < treasuryTokens.length; i++) {
            claimedAmounts[i] = claimed[holder][treasuryTokens[i]];
            claimableAmounts[i] = getClaimableAmount(holder, treasuryTokens[i]);
        }
        
        return (govBalance, ownership, tokens, claimedAmounts, claimableAmounts);
    }
    
    /**
     * @dev Get all treasury tokens
     */
    function getTreasuryTokens() external view returns (address[] memory) {
        return treasuryTokens;
    }
    
    /**
     * @dev Emergency withdraw (owner only)
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
