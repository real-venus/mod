// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IMarket
 * @dev Interface for Market contract debit operations
 */
interface IMarket {
    function debitBurn(address from, uint256 amount) external;
    function debitMint(address to, uint256 amount) external;
    function addTreasuryFees(uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function treasury() external view returns (address);
}

/**
 * @title Debit
 * @dev EIP-712 signature-based debit contract for the Market.
 * Requires client signature to authorize debits. Caches the most recent
 * transaction per client->provider pair for temporal tracking.
 */
contract Debit is EIP712, ReentrancyGuard, Ownable {
    using ECDSA for bytes32;

    IMarket public market;
    uint256 public constant TREASURY_FEE_PERCENT = 5;
    uint256 public nextTransactionId = 1;
    bool public signatureRequired;

    bytes32 public constant DEBIT_TYPEHASH = keccak256(
        "DebitAuthorization(address client,address provider,uint256 amount,uint256 nonce,uint256 deadline)"
    );

    mapping(address => uint256) public nonces;

    // Daily spending limit (8 decimals). Default: 1000 * 10^8
    uint256 public constant DEFAULT_DAILY_LIMIT = 1000_00000000;
    mapping(address => uint256) public dailyLimit;        // 0 means use default
    mapping(address => mapping(uint256 => uint256)) public dailySpent; // client => day => amount spent

    struct CachedDebit {
        uint256 amount;
        uint256 timestamp;
        uint256 nonce;
    }

    mapping(address => mapping(address => CachedDebit)) public lastDebit;

    event DebitExecuted(
        uint256 indexed txId,
        address indexed client,
        address indexed provider,
        uint256 amount,
        uint256 treasuryFee,
        uint256 providerAmount,
        uint256 nonce
    );
    event MarketUpdated(address indexed newMarket);
    event SignatureRequirementUpdated(bool required);
    event DailyLimitUpdated(address indexed client, uint256 newLimit);

    constructor(
        address _market
    ) EIP712("MarketDebit", "1") {
        require(_market != address(0), "Invalid market");
        market = IMarket(_market);
    }

    function setMarket(address _market) external onlyOwner {
        require(_market != address(0), "Invalid market");
        market = IMarket(_market);
        emit MarketUpdated(_market);
    }

    /**
     * @dev Toggle signature requirement. When false, owner/Market can call executeDebitUnsigned.
     * When true, all debits must go through executeDebit with a valid client EIP-712 signature.
     */
    function setSignatureRequired(bool _required) external onlyOwner {
        signatureRequired = _required;
        emit SignatureRequirementUpdated(_required);
    }

    /**
     * @dev Set your own daily spending limit. Must be > 0.
     */
    function setDailyLimit(uint256 _limit) external {
        require(_limit > 0, "Limit must be > 0");
        dailyLimit[msg.sender] = _limit;
        emit DailyLimitUpdated(msg.sender, _limit);
    }

    /**
     * @dev Returns the effective daily limit for a client.
     */
    function getEffectiveDailyLimit(address client) public view returns (uint256) {
        uint256 limit = dailyLimit[client];
        return limit > 0 ? limit : DEFAULT_DAILY_LIMIT;
    }

    /**
     * @dev Returns the current day number (UTC).
     */
    function _getCurrentDay() internal view returns (uint256) {
        return block.timestamp / 1 days;
    }

    /**
     * @dev Returns how much a client has spent today.
     */
    function getDailySpent(address client) external view returns (uint256) {
        return dailySpent[client][_getCurrentDay()];
    }

    /**
     * @dev Returns how much spending allowance a client has left today.
     */
    function getDailyRemaining(address client) external view returns (uint256) {
        uint256 limit = getEffectiveDailyLimit(client);
        uint256 spent = dailySpent[client][_getCurrentDay()];
        return spent >= limit ? 0 : limit - spent;
    }

    /**
     * @dev Verify EIP-712 signature and return the used nonce. Reverts on invalid sig.
     */
    function _verifySignature(
        address client,
        address provider,
        uint256 stableAmount,
        uint256 deadline,
        bytes memory signature
    ) internal returns (uint256 usedNonce) {
        require(signature.length == 65, "Invalid signature length");
        require(block.timestamp <= deadline, "Signature expired");

        usedNonce = nonces[client];
        bytes32 structHash = keccak256(abi.encode(
            DEBIT_TYPEHASH,
            client,
            provider,
            stableAmount,
            usedNonce,
            deadline
        ));

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }

        address signer = ECDSA.recover(_hashTypedDataV4(structHash), v, r, s);
        require(signer == client, "Invalid signature");

        nonces[client] = usedNonce + 1;
    }

    /**
     * @dev Execute the burn/mint operations on Market and cache the result.
     */
    function _executeTransfer(
        address client,
        address provider,
        uint256 stableAmount,
        uint256 usedNonce
    ) internal returns (uint256 txId) {
        // Enforce daily spending limit
        uint256 today = _getCurrentDay();
        uint256 limit = getEffectiveDailyLimit(client);
        uint256 spent = dailySpent[client][today];
        require(spent + stableAmount <= limit, "Daily spending limit exceeded");
        dailySpent[client][today] = spent + stableAmount;

        uint256 treasuryFee = (stableAmount * TREASURY_FEE_PERCENT) / 100;
        uint256 providerAmount = stableAmount - treasuryFee;

        market.debitBurn(client, stableAmount);
        market.debitMint(market.treasury(), treasuryFee);
        market.addTreasuryFees(treasuryFee);
        market.debitMint(provider, providerAmount);

        lastDebit[client][provider] = CachedDebit({
            amount: stableAmount,
            timestamp: block.timestamp,
            nonce: usedNonce
        });

        txId = nextTransactionId++;
        emit DebitExecuted(txId, client, provider, stableAmount, treasuryFee, providerAmount, usedNonce);
    }

    /**
     * @dev Execute a debit authorized by the client's EIP-712 signature.
     * @param client The address being debited (must be the signer)
     * @param provider The address receiving payment
     * @param stableAmount Amount in stable tokens (8 decimals) to debit
     * @param deadline Timestamp after which the signature expires
     * @param signature Packed ECDSA signature (65 bytes: r + s + v)
     */
    function executeDebit(
        address client,
        address provider,
        uint256 stableAmount,
        uint256 deadline,
        bytes memory signature
    ) external nonReentrant returns (uint256) {
        require(stableAmount > 0, "Invalid amount");
        require(client != address(0), "Invalid client");
        require(provider != address(0), "Invalid provider");
        require(market.balanceOf(client) >= stableAmount, "Insufficient balance");

        uint256 usedNonce = _verifySignature(client, provider, stableAmount, deadline, signature);
        return _executeTransfer(client, provider, stableAmount, usedNonce);
    }

    /**
     * @dev Execute a debit without signature. Only callable by the Market contract or Debit owner.
     * Only works when signatureRequired is false. This is the backward-compatible path
     * for the current token-based proof system. Flip signatureRequired to true when
     * ready to transition to EIP-712 client signatures.
     */
    function executeDebitUnsigned(
        address client,
        address provider,
        uint256 stableAmount
    ) external nonReentrant returns (uint256) {
        require(!signatureRequired, "Signatures required");
        require(msg.sender == address(market) || msg.sender == owner(), "Unauthorized");
        require(stableAmount > 0, "Invalid amount");
        require(client != address(0), "Invalid client");
        require(provider != address(0), "Invalid provider");
        require(market.balanceOf(client) >= stableAmount, "Insufficient balance");

        uint256 usedNonce = nonces[client];
        nonces[client] = usedNonce + 1;

        return _executeTransfer(client, provider, stableAmount, usedNonce);
    }

    // ========== VIEW ==========

    function getLastDebit(address _client, address _provider) external view returns (
        uint256 amount,
        uint256 timestamp,
        uint256 nonce
    ) {
        CachedDebit memory cached = lastDebit[_client][_provider];
        return (cached.amount, cached.timestamp, cached.nonce);
    }

    function getNonce(address _client) external view returns (uint256) {
        return nonces[_client];
    }

    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
