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
 * @dev Market contract with debit functionality that debits from client and credits provider with 5% treasury fee
 * Tracks total USDC accrued from fees (claimed and unclaimed)
 */
contract Market is ERC20, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    address public treasury;
    TokenGate public tokenGate;
    uint256 public nextTransactionId = 1;
    uint256 public constant TREASURY_FEE_PERCENT = 5; // 5% treasury fee

    // Track total USDC fees accrued by treasury as a single uint256
    uint256 public totalTreasuryFeesAccrued;
    
    event Credit(uint256 indexed txId, address indexed user, uint256 amount, address paymentToken, uint256 paidAmount);
    event Debit(uint256 indexed txId, address indexed client, address indexed provider, uint256 amount, uint256 treasuryFee, uint256 providerAmount);
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
    
    function decimals() public pure override returns (uint8) {
        return 18;
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
        
        uint256 paymentAmount = (stableAmount * (10 ** tokenDecimals)) / tokenPrice;
        
        IERC20(paymentToken).safeTransferFrom(msg.sender, this , paymentAmount);
        _mint(msg.sender, stableAmount);
        
        uint256 txId = nextTransactionId++;
        emit Credit(txId, msg.sender, stableAmount, paymentToken, paymentAmount);
        return txId;
    }
    
    /**
     * @dev Debit from client and credit to provider with 5% treasury fee
     * Only owner can call this function to debit from any address to any address
     * Tracks treasury fees accrued in stable token terms
     */
    function debit(address client, address provider, uint256 stableAmount) external onlyOwner nonReentrant returns (uint256) {
        require(stableAmount > 0, "Invalid amount");
        require(client != address(0), "Invalid client");
        require(provider != address(0), "Invalid provider");
        require(balanceOf(client) >= stableAmount, "Insufficient balance");
        
        // Calculate treasury fee (5%)
        uint256 treasuryFee = (stableAmount * TREASURY_FEE_PERCENT) / 100;
        uint256 providerAmount = stableAmount - treasuryFee;
        
        // Burn from client
        _burn(client, stableAmount);

        // Mint treasury fee to treasury
        _mint(treasury, treasuryFee);

        // Track total treasury fees accrued (in stable token terms)
        totalTreasuryFeesAccrued += treasuryFee;

        // Mint provider amount to provider
        _mint(provider, providerAmount);
        
        uint256 txId = nextTransactionId++;
        emit Debit(txId, client, provider, stableAmount, treasuryFee, providerAmount);
        return txId;
    }
    
    function withdraw(address paymentToken, uint256 stableAmount) external nonReentrant returns (uint256) {
        require(stableAmount > 0, "Invalid amount");
        require(balanceOf(msg.sender) >= stableAmount, "Insufficient balance");
        require(tokenGate.isTokenWhitelisted(paymentToken), "Token not whitelisted");
        
        (uint256 tokenPrice, uint8 tokenDecimals,) = tokenGate.getTokenPrice(paymentToken);
        require(tokenPrice > 0, "Invalid price");
        
        uint256 withdrawAmount = (stableAmount * (10 ** tokenDecimals)) / tokenPrice;

        _burn(msg.sender, stableAmount);
        IERC20(paymentToken).safeTransfer(msg.sender, withdrawAmount);
        
        uint256 txId = nextTransactionId++;
        emit Withdrawal(txId, msg.sender, stableAmount, paymentToken, withdrawAmount);
        return txId;
    }
    
    /**
     * @dev Get claimed treasury fees (current treasury balance)
     */
    function getClaimedTreasuryFeesUSD() external view returns (uint256) {
        return balanceOf(treasury);
    }
    
    /**
     * @dev Get unclaimed treasury fees (total accrued - current balance)
     */
    function getUnclaimedTreasuryFFeesUSD() external view returns (uint256) {
        uint256 currentBalance = balanceOf(treasury);
        return totalTreasuryFeesAccrued > currentBalance ? totalTreasuryFeesAccrued - currentBalance : 0;
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
