// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../tokengate/TokenGate.sol";

/**
 * @title Market
 * @dev Market contract integrated with TokenGate for modular token management
 * Removes manual price management and delegates to TokenGate oracle system
 * Allows users to withdraw after a lockup period (1 week)
 */
contract Market is ERC20, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // Treasury
    address public treasury;
    
    // TokenGate integration
    TokenGate public tokenGate;
    
    // Transaction tracking
    uint256 public nextTransactionId = 1;
    
    // Withdrawal lockup period (1 week = 604800 seconds)
    uint256 public constant WITHDRAWAL_LOCKUP = 7 days;
    
    // User deposit tracking for withdrawal lockup
    struct Deposit {
        uint256 amount;
        uint256 timestamp;
    }
    
    mapping(address => Deposit[]) public userDeposits;
    
    // Transaction history
    struct Transaction {
        address user;
        uint256 amount;
        bool isCredit;
        uint256 timestamp;
        address paymentToken;
    }
    
    // Events
    event Credit(uint256 indexed txId, address indexed user, uint256 amount, address paymentToken, uint256 paidAmount);
    event Debit(uint256 indexed txId, address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount, address indexed token);
    event TreasuryUpdated(address indexed newTreasury);
    event TokenGateUpdated(address indexed newTokenGate);
    
    constructor(
        string memory name,
        string memory symbol,
        address _treasury,
        address _tokenGate
    ) ERC20(name, symbol) {
        require(_treasury != address(0), "Invalid treasury");
        require(_tokenGate != address(0), "Invalid tokengate");
        treasury = _treasury;
        tokenGate = TokenGate(_tokenGate);
    }
    
    /**
     * @dev Returns 8 decimals to match stable pricing standard
     */
    function decimals() public pure override returns (uint8) {
        return 8;
    }
    
    // ========== TREASURY MANAGEMENT ==========
    
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }
    
    // ========== TOKENGATE MANAGEMENT ==========
    
    function setTokenGate(address _tokenGate) external onlyOwner {
        require(_tokenGate != address(0), "Invalid tokengate");
        tokenGate = TokenGate(_tokenGate);
        emit TokenGateUpdated(_tokenGate);
    }
    
    // ========== MARKET FUNCTIONALITY ==========
    
    /**
     * @dev Credit stable tokens to user by paying with whitelisted token
     * Uses TokenGate for token validation and oracle pricing
     * ALLOWANCE MUST BE SET BEFORE CALLING THIS FUNCTION
     */
    function credit(address paymentToken, uint256 stableAmount) external nonReentrant returns (uint256) {
        require(stableAmount > 0, "Invalid amount");
        require(tokenGate.isTokenWhitelisted(paymentToken), "Token not whitelisted");
        
        // Get price from TokenGate oracle
        (uint256 tokenPrice, uint8 tokenDecimals,) = tokenGate.getTokenPrice(paymentToken);
        require(tokenPrice > 0, "Invalid price");
        
        // Calculate payment required based on oracle pricing
        uint256 paymentAmount = (stableAmount * (10 ** tokenDecimals)) / tokenPrice;
        
        // Transfer payment to treasury - REQUIRES PRIOR APPROVAL
        IERC20(paymentToken).safeTransferFrom(msg.sender, treasury, paymentAmount);
        
        // Mint stable tokens to user
        _mint(msg.sender, stableAmount);
        
        // Track deposit with timestamp for withdrawal lockup
        userDeposits[msg.sender].push(Deposit({
            amount: stableAmount,
            timestamp: block.timestamp
        }));
        
        uint256 txId = nextTransactionId++;
        
        emit Credit(txId, msg.sender, stableAmount, paymentToken, paymentAmount);
        return txId;
    }
    
    /**
     * @dev Debit stable tokens from user (owner can debit anyone)
     * Burns stable tokens and tracks spending
     */
    function debit(address user, uint256 stableAmount) external nonReentrant returns (uint256) {
        require(stableAmount > 0, "Invalid amount");
        require(msg.sender == owner() || msg.sender == user, "Not authorized");
        require(balanceOf(user) >= stableAmount, "Insufficient balance");
        
        // Burn stable tokens from user
        _burn(user, stableAmount);
        
        uint256 txId = nextTransactionId++;

        emit Debit(txId, user, stableAmount);
        return txId;
    }
    
    /**
     * @dev Get withdrawable amount for user (only unlocked deposits)
     */
    function getWithdrawableAmount(address user) public view returns (uint256) {
        uint256 withdrawable = 0;
        Deposit[] storage deposits = userDeposits[user];
        
        for (uint256 i = 0; i < deposits.length; i++) {
            if (block.timestamp >= deposits[i].timestamp + WITHDRAWAL_LOCKUP) {
                withdrawable += deposits[i].amount;
            }
        }
        
        return withdrawable;
    }
    
    /**
     * @dev Withdraw unlocked stable tokens back to payment token
     * Users can only withdraw deposits that have passed the lockup period
     */
    function withdraw(address paymentToken, uint256 stableAmount) external nonReentrant {
        require(stableAmount > 0, "Invalid amount");
        require(tokenGate.isTokenWhitelisted(paymentToken), "Token not whitelisted");
        require(balanceOf(msg.sender) >= stableAmount, "Insufficient balance");
        
        // Check withdrawable amount (only unlocked deposits)
        uint256 withdrawable = getWithdrawableAmount(msg.sender);
        require(withdrawable >= stableAmount, "Amount locked, wait for lockup period");
        
        // Get price from TokenGate oracle
        (uint256 tokenPrice, uint8 tokenDecimals,) = tokenGate.getTokenPrice(paymentToken);
        require(tokenPrice > 0, "Invalid price");
        
        // Calculate payment amount to return
        uint256 paymentAmount = (stableAmount * (10 ** tokenDecimals)) / tokenPrice;
        
        // Remove from deposits (FIFO - oldest first)
        uint256 remaining = stableAmount;
        Deposit[] storage deposits = userDeposits[msg.sender];
        
        for (uint256 i = 0; i < deposits.length && remaining > 0; i++) {
            if (block.timestamp >= deposits[i].timestamp + WITHDRAWAL_LOCKUP) {
                if (deposits[i].amount <= remaining) {
                    remaining -= deposits[i].amount;
                    // Remove deposit by replacing with last and popping
                    deposits[i] = deposits[deposits.length - 1];
                    deposits.pop();
                    i--; // Adjust index since we replaced current element
                } else {
                    deposits[i].amount -= remaining;
                    remaining = 0;
                }
            }
        }
        
        // Burn stable tokens
        _burn(msg.sender, stableAmount);
        
        // Transfer payment token from treasury to user
        IERC20(paymentToken).safeTransferFrom(treasury, msg.sender, paymentAmount);
        
        emit Withdrawal(msg.sender, stableAmount, paymentToken);
    }
    
    /**
     * @dev Get user stable token balance (uses ERC20 balanceOf)
     */
    function getBalance(address user) external view returns (uint256) {
        return balanceOf(user);
    }
    
    /**
     * @dev Get user deposit count
     */
    function getDepositCount(address user) external view returns (uint256) {
        return userDeposits[user].length;
    }
    
    /**
     * @dev Get user deposit details
     */
    function getDeposit(address user, uint256 index) external view returns (uint256 amount, uint256 timestamp, bool unlocked) {
        require(index < userDeposits[user].length, "Invalid index");
        Deposit storage deposit = userDeposits[user][index];
        return (
            deposit.amount,
            deposit.timestamp,
            block.timestamp >= deposit.timestamp + WITHDRAWAL_LOCKUP
        );
    }
    
    /**
     * @dev Check if token is whitelisted via TokenGate
     */
    function isTokenWhitelisted(address token) external view returns (bool) {
        return tokenGate.isTokenWhitelisted(token);
    }
    
    /**
     * @dev Get token price via TokenGate oracle
     */
    function getTokenPrice(address token) external view returns (uint256 price, uint8 decimals, uint256 timestamp) {
        return tokenGate.getTokenPrice(token);
    }
}
