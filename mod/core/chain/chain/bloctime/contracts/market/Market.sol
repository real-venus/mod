// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./TokenGate.sol";
import "./StableToken.sol";

/**
 * @title Market
 * @dev Debit/Credit marketplace using StableToken (independent ERC20)
 * No userBalances mapping - ERC20 balanceOf is sufficient
 */
contract Market is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    StableToken public stableToken;
    TokenGate public tokenGate;
    address public treasury;
    
    uint256 public nextTransactionId = 1;
    
    struct Transaction {
        address user;
        uint256 amount;
        bool isCredit;
        uint256 timestamp;
        address paymentToken;
    }
    
    event Credit(uint256 indexed txId, address indexed user, uint256 amount, address paymentToken, uint256 paidAmount);
    event Debit(uint256 indexed txId, address indexed user, uint256 amount);
    event TreasuryUpdated(address indexed newTreasury);
    
    constructor(address _stableToken, address _tokenGate, address _treasury) {
        require(_stableToken != address(0) && _tokenGate != address(0) && _treasury != address(0), "Invalid addresses");
        stableToken = StableToken(_stableToken);
        tokenGate = TokenGate(_tokenGate);
        treasury = _treasury;
    }
    
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }
    
    /**
     * @dev Credit stable tokens to user by paying with whitelisted token
     * Mints StableToken based on tokenGate pricing
     */
    function credit(address paymentToken, uint256 stableAmount) external nonReentrant returns (uint256) {
        require(stableAmount > 0, "Invalid amount");
        require(tokenGate.isTokenModed(paymentToken), "Token not whitelisted");
        
        // Calculate payment required based on tokenGate pricing
        (uint256 tokenPrice, uint8 tokenDecimals,) = tokenGate.getTokenPrice(paymentToken);
        uint256 paymentAmount = (stableAmount * (10 ** tokenDecimals)) / tokenPrice;
        
        // Transfer payment to treasury
        IERC20(paymentToken).safeTransferFrom(msg.sender, treasury, paymentAmount);
        
        // Mint stable tokens to user
        stableToken.mint(msg.sender, stableAmount);
        
        uint256 txId = nextTransactionId++;
        
        emit Credit(txId, msg.sender, stableAmount, paymentToken, paymentAmount);
        return txId;
    }
    
    /**
     * @dev Debit stable tokens from user
     * Burns StableToken
     */
    function debit(uint256 stableAmount) external nonReentrant returns (uint256) {
        require(stableAmount > 0, "Invalid amount");
        require(stableToken.balanceOf(msg.sender) >= stableAmount, "Insufficient balance");
        
        // Burn stable tokens from user
        stableToken.burn(msg.sender, stableAmount);
        
        uint256 txId = nextTransactionId++;

        emit Debit(txId, msg.sender, stableAmount);
        return txId;
    }
    
    /**
     * @dev Get user stable token balance (uses ERC20 balanceOf)
     */
    function getBalance(address user) external view returns (uint256) {
        return stableToken.balanceOf(user);
    }
    
}