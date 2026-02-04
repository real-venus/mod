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
 * @dev Market contract with 8 decimals precision
 */
contract Market is ERC20, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    address public treasury;
    TokenGate public tokenGate;
    uint256 public nextTransactionId = 1;
    
    event Credit(uint256 indexed txId, address indexed user, uint256 amount, address paymentToken, uint256 paidAmount);
    event Debit(uint256 indexed txId, address indexed user, uint256 amount);
    event Withdrawal(uint256 indexed txId, address indexed user, uint256 amount, address paymentToken, uint256 receivedAmount);
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
     * @dev Returns 8 decimals as requested
     */
    function decimals() public pure override returns (uint8) {
        return 8;
    }
    
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }
    
    function setTokenGate(address _tokenGate) external onlyOwner {
        require(_tokenGate != address(0), "Invalid tokengate");
        tokenGate = TokenGate(_tokenGate);
        emit TokenGateUpdated(_tokenGate);
    }
    
    function credit(address paymentToken, uint256 stableAmount) external nonReentrant returns (uint256) {
        require(stableAmount > 0, "Invalid amount");
        require(tokenGate.isTokenWhitelisted(paymentToken), "Token not whitelisted");
        
        (uint256 tokenPrice, uint8 tokenDecimals,) = tokenGate.getTokenPrice(paymentToken);
        require(tokenPrice > 0, "Invalid price");
        
        // Calculate payment amount: stableAmount (8 decimals) -> paymentToken (tokenDecimals)
        // tokenPrice has 8 decimals, so: paymentAmount = stableAmount * 10^tokenDecimals / tokenPrice
        uint256 paymentAmount = (stableAmount * (10 ** tokenDecimals)) / tokenPrice;
        
        IERC20(paymentToken).safeTransferFrom(msg.sender, treasury, paymentAmount);
        _mint(msg.sender, stableAmount);
        
        uint256 txId = nextTransactionId++;
        emit Credit(txId, msg.sender, stableAmount, paymentToken, paymentAmount);
        return txId;
    }
    
    function debit(uint256 stableAmount) external nonReentrant returns (uint256) {
        require(stableAmount > 0, "Invalid amount");
        require(balanceOf(msg.sender) >= stableAmount, "Insufficient balance");
        
        _burn(msg.sender, stableAmount);
        
        uint256 txId = nextTransactionId++;
        emit Debit(txId, msg.sender, stableAmount);
        return txId;
    }
    
    function withdraw(address paymentToken, uint256 stableAmount) external nonReentrant returns (uint256) {
        require(stableAmount > 0, "Invalid amount");
        require(balanceOf(msg.sender) >= stableAmount, "Insufficient balance");
        require(tokenGate.isTokenWhitelisted(paymentToken), "Token not whitelisted");
        
        (uint256 tokenPrice, uint8 tokenDecimals,) = tokenGate.getTokenPrice(paymentToken);
        require(tokenPrice > 0, "Invalid price");
        
        // Calculate withdrawal amount: stableAmount (8 decimals) -> paymentToken (tokenDecimals)
        uint256 withdrawAmount = (stableAmount * (10 ** tokenDecimals)) / tokenPrice;
        
        _burn(msg.sender, stableAmount);
        IERC20(paymentToken).safeTransferFrom(treasury, msg.sender, withdrawAmount);
        
        uint256 txId = nextTransactionId++;
        emit Withdrawal(txId, msg.sender, stableAmount, paymentToken, withdrawAmount);
        return txId;
    }
    
    function getBalance(address user) external view returns (uint256) {
        return balanceOf(user);
    }
    
    function isTokenWhitelisted(address token) external view returns (bool) {
        return tokenGate.isTokenWhitelisted(token);
    }
    
    function getTokenPrice(address token) external view returns (uint256 price, uint8 decimals, uint256 timestamp) {
        return tokenGate.getTokenPrice(token);
    }
}
