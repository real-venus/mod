// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MarketV2
 * @dev Combined Market contract with integrated StableToken and TokenGate functionality
 * All-in-one debit/credit marketplace with token whitelisting and stable token management
 */
contract Market is ERC20, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // Treasury
    address public treasury;
    
    // Transaction tracking
    uint256 public nextTransactionId = 1;
    
    // TokenGate functionality - Token whitelist and pricing
    struct TokenInfo {
        address token;
        uint256 price; // Manual price in USD (8 decimals)
        uint8 decimals; // Token decimals
        uint256 timestamp;
    }
    
    TokenInfo[] public tokenList;
    
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
    event TreasuryUpdated(address indexed newTreasury);
    event PricesSet(uint256 count, uint256 timestamp);
    event PricesCleared();
    
    constructor(
        string memory name,
        string memory symbol,
        address _treasury
    ) ERC20(name, symbol) {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
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
    
    // ========== TOKEN GATE FUNCTIONALITY ==========
    
    /**
     * @dev Set whitelisted tokens with prices (replaces entire list)
     */
    function setPrices(
        address[] calldata tokens,
        uint256[] calldata prices,
        uint8[] calldata tokenDecimals
    ) external onlyOwner {
        require(tokens.length == prices.length && tokens.length == tokenDecimals.length, "Array length mismatch");
        
        // Clear existing list
        delete tokenList;
        
        // Set new prices
        for (uint256 i = 0; i < tokens.length; i++) {
            require(tokens[i] != address(0), "Invalid token");
            require(prices[i] > 0, "Invalid price");
            
            tokenList.push(TokenInfo({
                token: tokens[i],
                price: prices[i],
                decimals: tokenDecimals[i],
                timestamp: block.timestamp
            }));
        }
        
        emit PricesSet(tokens.length, block.timestamp);
    }
    
    function clearPrices() external onlyOwner {
        delete tokenList;
        emit PricesCleared();
    }
    
    function isTokenModed(address token) public view returns (bool) {
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (tokenList[i].token == token) {
                return true;
            }
        }
        return false;
    }
    
    function getTokenPrice(address token) public view returns (uint256 price, uint8 tokenDecimals, uint256 timestamp) {
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (tokenList[i].token == token) {
                return (tokenList[i].price, tokenList[i].decimals, tokenList[i].timestamp);
            }
        }
        revert("Price not set");
    }
    
    function getTokenList() external view returns (TokenInfo[] memory) {
        return tokenList;
    }
    
    // ========== MARKET FUNCTIONALITY ==========
    
    /**
     * @dev Credit stable tokens to user by paying with whitelisted token
     * Mints stable tokens based on token pricing
     */
    function credit(address paymentToken, uint256 stableAmount) external nonReentrant returns (uint256) {
        require(stableAmount > 0, "Invalid amount");
        require(isTokenModed(paymentToken), "Token not whitelisted");
        
        // Calculate payment required based on pricing
        (uint256 tokenPrice, uint8 tokenDecimals,) = getTokenPrice(paymentToken);
        uint256 paymentAmount = (stableAmount * (10 ** tokenDecimals)) / tokenPrice;
        
        // Transfer payment to treasury
        IERC20(paymentToken).safeTransferFrom(msg.sender, treasury, paymentAmount);
        
        // Mint stable tokens to user
        _mint(msg.sender, stableAmount);
        
        uint256 txId = nextTransactionId++;
        
        emit Credit(txId, msg.sender, stableAmount, paymentToken, paymentAmount);
        return txId;
    }
    
    /**
     * @dev Debit stable tokens from user
     * Burns stable tokens
     */
    function debit(uint256 stableAmount) external nonReentrant returns (uint256) {
        require(stableAmount > 0, "Invalid amount");
        require(balanceOf(msg.sender) >= stableAmount, "Insufficient balance");
        
        // Burn stable tokens from user
        _burn(msg.sender, stableAmount);
        
        uint256 txId = nextTransactionId++;

        emit Debit(txId, msg.sender, stableAmount);
        return txId;
    }
    
    /**
     * @dev Get user stable token balance (uses ERC20 balanceOf)
     */
    function getBalance(address user) external view returns (uint256) {
        return balanceOf(user);
    }
}
