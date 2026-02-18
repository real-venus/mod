// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../tokengate/TokenGate.sol";

interface IDebit {
    function executeDebitUnsigned(address client, address provider, uint256 stableAmount) external returns (uint256);
    function executeDebit(address client, address provider, uint256 stableAmount, uint256 deadline, bytes memory signature) external returns (uint256);
}

/**
 * @title Market
 * @dev Market contract for credit/withdraw with oracle price conversion.
 * Debit functionality is handled by a separate Debit contract, supporting both
 * unsigned (owner-only, backward compatible) and EIP-712 signed modes.
 * Includes: pausability, oracle staleness checks, slippage protection, rounding safeguards.
 */
contract Market is ERC20, ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    address public treasury;
    TokenGate public tokenGate;
    address public debitContract;
    uint256 public nextTransactionId = 1;
    uint256 public maxOracleAge;
    uint256 public constant TREASURY_FEE_PERCENT = 5;

    uint256 public totalTreasuryFeesAccrued;

    event Credit(uint256 indexed txId, address indexed user, uint256 amount, address paymentToken, uint256 paidAmount);
    event Debit(uint256 indexed txId, address indexed client, address indexed provider, uint256 amount);
    event Withdrawal(uint256 indexed txId, address indexed user, uint256 amount, address paymentToken, uint256 receivedAmount);
    event TreasuryUpdated(address indexed newTreasury);
    event TokenGateUpdated(address indexed newTokenGate);
    event DebitContractUpdated(address indexed newDebitContract);
    event MaxOracleAgeUpdated(uint256 newMaxAge);

    modifier onlyDebitContract() {
        require(msg.sender == debitContract, "Only debit contract");
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        address _treasury,
        address _tokenGate,
        uint256 _maxOracleAge
    ) ERC20(name, symbol) {
        require(_treasury != address(0), "Invalid treasury");
        require(_tokenGate != address(0), "Invalid tokengate");
        require(_maxOracleAge > 0, "Invalid max oracle age");
        treasury = _treasury;
        tokenGate = TokenGate(_tokenGate);
        maxOracleAge = _maxOracleAge;
    }

    function decimals() public pure override returns (uint8) {
        return 8;
    }

    // ========== ADMIN ==========

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

    function setDebitContract(address _debitContract) external onlyOwner {
        require(_debitContract != address(0), "Invalid debit contract");
        debitContract = _debitContract;
        emit DebitContractUpdated(_debitContract);
    }

    function setMaxOracleAge(uint256 _maxOracleAge) external onlyOwner {
        require(_maxOracleAge > 0, "Invalid max oracle age");
        maxOracleAge = _maxOracleAge;
        emit MaxOracleAgeUpdated(_maxOracleAge);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ========== DEBIT CONTRACT INTERFACE ==========

    /**
     * @dev Burn tokens from an address. Only callable by the authorized Debit contract.
     */
    function debitBurn(address from, uint256 amount) external onlyDebitContract {
        _burn(from, amount);
    }

    /**
     * @dev Mint tokens to an address. Only callable by the authorized Debit contract.
     */
    function debitMint(address to, uint256 amount) external onlyDebitContract {
        _mint(to, amount);
    }

    /**
     * @dev Track treasury fees accrued. Only callable by the authorized Debit contract.
     */
    function addTreasuryFees(uint256 amount) external onlyDebitContract {
        totalTreasuryFeesAccrued += amount;
    }

    // ========== DEBIT (BACKWARD COMPATIBLE) ==========

    /**
     * @dev Debit that routes through the Debit contract.
     * If signature is empty, uses the unsigned path (requires signatureRequired == false).
     * If signature is provided, uses the signed EIP-712 path.
     * @param client The address being debited
     * @param provider The address receiving payment
     * @param stableAmount Amount in stable tokens (8 decimals)
     * @param deadline Signature expiry timestamp (0 for unsigned)
     * @param signature Packed EIP-712 signature bytes (empty for unsigned)
     */
    function debit(
        address client,
        address provider,
        uint256 stableAmount,
        uint256 deadline,
        bytes memory signature
    ) external onlyOwner returns (uint256) {
        require(debitContract != address(0), "Debit contract not set");
        uint256 txId;
        if (signature.length == 0) {
            txId = IDebit(debitContract).executeDebitUnsigned(client, provider, stableAmount);
        } else {
            txId = IDebit(debitContract).executeDebit(client, provider, stableAmount, deadline, signature);
        }
        emit Debit(txId, client, provider, stableAmount);
        return txId;
    }

    // ========== CORE ==========

    /**
     * @dev Deposit payment tokens and receive stable market tokens.
     * @param paymentToken Address of the whitelisted payment token
     * @param stableAmount Amount of stable tokens to mint (8 decimals)
     * @param maxPaymentAmount Maximum payment tokens the caller is willing to spend (slippage protection)
     */
    function credit(address paymentToken, uint256 stableAmount, uint256 maxPaymentAmount) external nonReentrant whenNotPaused returns (uint256) {
        require(stableAmount > 0, "Invalid amount");
        require(tokenGate.isTokenWhitelisted(paymentToken), "Token not whitelisted");

        (uint256 tokenPrice, uint8 priceDecimals, uint256 priceTimestamp) = tokenGate.getTokenPrice(paymentToken);
        require(tokenPrice > 0, "Invalid price");
        require(block.timestamp - priceTimestamp <= maxOracleAge, "Stale oracle price");

        uint8 paymentDecimals = IERC20Metadata(paymentToken).decimals();
        uint256 paymentAmount = (stableAmount * 10**uint256(paymentDecimals) * 10**uint256(priceDecimals)) / (tokenPrice * 10**uint256(decimals()));

        require(paymentAmount > 0, "Amount too small");
        require(paymentAmount <= maxPaymentAmount, "Exceeds max payment");

        IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), paymentAmount);
        _mint(msg.sender, stableAmount);

        uint256 txId = nextTransactionId++;
        emit Credit(txId, msg.sender, stableAmount, paymentToken, paymentAmount);
        return txId;
    }

    /**
     * @dev Burn stable market tokens and receive payment tokens back.
     * @param paymentToken Address of the whitelisted payment token to receive
     * @param stableAmount Amount of stable tokens to burn (8 decimals)
     * @param minReceiveAmount Minimum payment tokens the caller expects to receive (slippage protection)
     */
    function withdraw(address paymentToken, uint256 stableAmount, uint256 minReceiveAmount) external nonReentrant whenNotPaused returns (uint256) {
        require(stableAmount > 0, "Invalid amount");
        require(balanceOf(msg.sender) >= stableAmount, "Insufficient balance");
        require(tokenGate.isTokenWhitelisted(paymentToken), "Token not whitelisted");

        (uint256 tokenPrice, uint8 priceDecimals, uint256 priceTimestamp) = tokenGate.getTokenPrice(paymentToken);
        require(tokenPrice > 0, "Invalid price");
        require(block.timestamp - priceTimestamp <= maxOracleAge, "Stale oracle price");

        uint8 paymentDecimals = IERC20Metadata(paymentToken).decimals();
        uint256 withdrawAmount = (stableAmount * 10**uint256(paymentDecimals) * 10**uint256(priceDecimals)) / (tokenPrice * 10**uint256(decimals()));

        require(withdrawAmount > 0, "Amount too small");
        require(withdrawAmount >= minReceiveAmount, "Below min receive");

        _burn(msg.sender, stableAmount);
        IERC20(paymentToken).safeTransfer(msg.sender, withdrawAmount);

        uint256 txId = nextTransactionId++;
        emit Withdrawal(txId, msg.sender, stableAmount, paymentToken, withdrawAmount);
        return txId;
    }

    // ========== VIEW ==========

    function getClaimedTreasuryFeesUSD() external view returns (uint256) {
        return balanceOf(treasury);
    }

    function getUnclaimedTreasuryFeesUSD() external view returns (uint256) {
        uint256 currentBalance = balanceOf(treasury);
        return totalTreasuryFeesAccrued > currentBalance ? totalTreasuryFeesAccrued - currentBalance : 0;
    }

    function getBalance(address user) external view returns (uint256) {
        return balanceOf(user);
    }

    function isTokenWhitelisted(address token) external view returns (bool) {
        return tokenGate.isTokenWhitelisted(token);
    }

    function getTokenPrice(address token) external view returns (uint256 price, uint8 tokenDecimals, uint256 timestamp) {
        return tokenGate.getTokenPrice(token);
    }
}
