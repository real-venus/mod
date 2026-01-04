// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./PayMod.sol";
import "../registry/Registry.sol";
import "../token/BloctimeToken.sol";

/**
 * @title Marketplace
 * @dev Simplified marketplace for buying bloctime with whitelisted tokens
 * Tracks user bloctime with start/stop mechanism and deducts on transfers
 * Sends all proceeds to configurable treasury (EOA, contract, or multisig)
 */
contract Marketplace is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    BlocTimeToken public blocTimeToken;
    PayMod public payMod;
    Registry public registry;
    address public treasury;
    
    uint256 public blocTimePriceUSD; // 8 decimals
    uint256 public nextPurchaseId = 1;
    
    struct UserBlocTime {
        uint256 startBlock;
        uint256 stopBlock;
        uint256 totalBlocTime;
    }
    
    mapping(address => UserBlocTime) public userBlocTime;
    
    event BlocTimePriceUpdated(uint256 newPrice);
    event BlocTimePurchased(uint256 indexed purchaseId, address indexed buyer, uint256 amount, address paymentToken, uint256 paidAmount);
    event BlocTimeTransferred(address indexed from, address indexed to, uint256 amount);
    event BlocTimeStarted(address indexed user, uint256 startBlock);
    event BlocTimeStopped(address indexed user, uint256 stopBlock, uint256 blocksUsed);
    event TreasuryUpdated(address indexed newTreasury);
    
    constructor(address _blocTimeToken, address _payMod, address _registry, address _treasury) {
        require(_blocTimeToken != address(0) && _payMod != address(0) && _registry != address(0) && _treasury != address(0), "Invalid addresses");
        blocTimeToken = BlocTimeToken(_blocTimeToken);
        payMod = PayMod(_payMod);
        registry = Registry(_registry);
        treasury = _treasury;
    }
    
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }
    
    function setBlocTimePrice(uint256 newPriceUSD) external onlyOwner {
        require(newPriceUSD > 0, "Invalid price");
        blocTimePriceUSD = newPriceUSD;
        emit BlocTimePriceUpdated(newPriceUSD);
    }
    
    function buy(address paymentToken, uint256 blocTimeAmount) external nonReentrant returns (uint256) {
        require(blocTimeAmount > 0, "Invalid amount");
        require(payMod.isTokenModed(paymentToken), "Token not whitelisted");
        
        // Stop current session if active before buying more
        if (userBlocTime[msg.sender].startBlock > 0 && userBlocTime[msg.sender].stopBlock == 0) {
            _stopBlocTime(msg.sender);
        }
        
        uint256 paymentAmount = payMod.calculatePayment(paymentToken, blocTimeAmount, blocTimePriceUSD);
        IERC20(paymentToken).safeTransferFrom(msg.sender, treasury, paymentAmount);
        blocTimeToken.mint(msg.sender, blocTimeAmount);
        
        // Add to user's total bloctime
        userBlocTime[msg.sender].totalBlocTime += blocTimeAmount;

        uint256 purchaseId = nextPurchaseId++;
        emit BlocTimePurchased(purchaseId, msg.sender, blocTimeAmount, paymentToken, paymentAmount);
        return purchaseId;
    }
    
    function startBlocTime() external {
        require(userBlocTime[msg.sender].totalBlocTime > 0, "No bloctime available");
        require(userBlocTime[msg.sender].startBlock == 0 || userBlocTime[msg.sender].stopBlock > 0, "Already started");
        
        userBlocTime[msg.sender].startBlock = block.number;
        userBlocTime[msg.sender].stopBlock = 0;
        
        emit BlocTimeStarted(msg.sender, block.number);
    }
    
    function stopBlocTime() external {
        require(userBlocTime[msg.sender].startBlock > 0, "Not started");
        require(userBlocTime[msg.sender].stopBlock == 0, "Already stopped");
        
        _stopBlocTime(msg.sender);
    }
    
    function _stopBlocTime(address user) internal {
        uint256 startBlock = userBlocTime[user].startBlock;
        uint256 stopBlock = block.number;
        uint256 blocksUsed = stopBlock - startBlock;
        
        // Deduct blocks used from total bloctime
        if (blocksUsed >= userBlocTime[user].totalBlocTime) {
            userBlocTime[user].totalBlocTime = 0;
        } else {
            userBlocTime[user].totalBlocTime -= blocksUsed;
        }
        
        userBlocTime[user].stopBlock = stopBlock;
        
        emit BlocTimeStopped(user, stopBlock, blocksUsed);
    }
    
    function transfer(address to, uint256 amount) external nonReentrant {
        require(to != address(0) && amount > 0, "Invalid params");
        require(blocTimeToken.balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        // Stop current session if active before transfer
        if (userBlocTime[msg.sender].startBlock > 0 && userBlocTime[msg.sender].stopBlock == 0) {
            _stopBlocTime(msg.sender);
        }
        
        // Deduct from sender's total bloctime
        require(userBlocTime[msg.sender].totalBlocTime >= amount, "Insufficient bloctime");
        userBlocTime[msg.sender].totalBlocTime -= amount;
        
        // Add to recipient's total bloctime
        userBlocTime[to].totalBlocTime += amount;
        
        blocTimeToken.transferFrom(msg.sender, to, amount);
        emit BlocTimeTransferred(msg.sender, to, amount);
    }
    
    function getUserBlocTime(address user) external view returns (uint256 startBlock, uint256 stopBlock, uint256 totalBlocTime, uint256 remainingBlocTime) {
        UserBlocTime memory ubt = userBlocTime[user];
        
        uint256 remaining = ubt.totalBlocTime;
        
        // If currently active, calculate remaining based on current block
        if (ubt.startBlock > 0 && ubt.stopBlock == 0) {
            uint256 blocksUsed = block.number - ubt.startBlock;
            if (blocksUsed >= ubt.totalBlocTime) {
                remaining = 0;
            } else {
                remaining = ubt.totalBlocTime - blocksUsed;
            }
        }
        
        return (ubt.startBlock, ubt.stopBlock, ubt.totalBlocTime, remaining);
    }
}
