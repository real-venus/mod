// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Sr25519Bridge
 * @dev Bridge contract for sr25519 to EVM token claims
 *
 * Flow:
 * 1. User signs timestamp with sr25519 key in Subwallet
 * 2. Backend verifies sr25519 signature off-chain
 * 3. Operator calls processClaim() to transfer tokens
 * 4. Each sr25519 address can only claim once
 */
contract Sr25519Bridge is Ownable, ReentrancyGuard {
    IERC20 public token;

    // Mapping from sr25519 address (as string/bytes32) to claimed status
    mapping(bytes32 => bool) public claimed;

    // Mapping from sr25519 to EVM address for tracking
    mapping(bytes32 => address) public claimRecipient;

    // Total amount claimed
    uint256 public totalClaimed;

    // Events
    event ClaimRegistered(bytes32 indexed sr25519Hash, address indexed recipient, uint256 amount);
    event ClaimProcessed(bytes32 indexed sr25519Hash, address indexed recipient, uint256 amount);

    constructor(address _token) Ownable(msg.sender) {
        token = IERC20(_token);
    }

    /**
     * @dev Process a claim after off-chain verification
     * @param sr25519Address The sr25519 address (SS58 format, hashed)
     * @param recipient The EVM address to receive tokens
     * @param amount Amount of tokens to distribute
     *
     * Only operator can call this after verifying signature
     */
    function processClaim(
        bytes32 sr25519Address,
        address recipient,
        uint256 amount
    ) external onlyOwner nonReentrant {
        require(!claimed[sr25519Address], "Already claimed");
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");

        // Mark as claimed
        claimed[sr25519Address] = true;
        claimRecipient[sr25519Address] = recipient;
        totalClaimed += amount;

        // Transfer tokens from operator to recipient
        require(
            token.transferFrom(owner(), recipient, amount),
            "Transfer failed"
        );

        emit ClaimProcessed(sr25519Address, recipient, amount);
    }

    /**
     * @dev Batch process multiple claims
     */
    function batchProcessClaims(
        bytes32[] calldata sr25519Addresses,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwner nonReentrant {
        require(
            sr25519Addresses.length == recipients.length &&
            recipients.length == amounts.length,
            "Array length mismatch"
        );

        for (uint256 i = 0; i < sr25519Addresses.length; i++) {
            if (!claimed[sr25519Addresses[i]]) {
                claimed[sr25519Addresses[i]] = true;
                claimRecipient[sr25519Addresses[i]] = recipients[i];
                totalClaimed += amounts[i];

                require(
                    token.transferFrom(owner(), recipients[i], amounts[i]),
                    "Transfer failed"
                );

                emit ClaimProcessed(sr25519Addresses[i], recipients[i], amounts[i]);
            }
        }
    }

    /**
     * @dev Check if an address has claimed
     */
    function hasClaimed(bytes32 sr25519Address) external view returns (bool) {
        return claimed[sr25519Address];
    }

    /**
     * @dev Update token address (emergency only)
     */
    function setToken(address _token) external onlyOwner {
        token = IERC20(_token);
    }
}
