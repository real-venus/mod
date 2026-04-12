// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BridgeableToken
 * @dev ERC20 token with owner-controlled mint/burn for custom bridging
 * Owner can mint and burn tokens to facilitate cross-chain transfers
 * This is a temporary solution until migration to native bridging
 */
contract BridgeableToken is ERC20, Ownable {

    event BridgeMint(address indexed to, uint256 amount, string bridgeId);
    event BridgeBurn(address indexed from, uint256 amount, string bridgeId);
    event ContractSetOwnerless();
    event Commitment(bytes32 indexed sourceHash, address indexed evmAddress, string sourceAddress, string sourceType);

    // Commitment: keccak256(sourceAddress) => evmAddress
    mapping(bytes32 => address) public commitments;
    mapping(address => bytes32[]) public evmCommitments;

    /**
     * @dev Constructor
     * @param name Token name
     * @param symbol Token symbol
     * @param initialSupply Initial token supply minted to deployer
     */
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        if (initialSupply > 0) {
            _mint(msg.sender, initialSupply);
        }
    }
    
    /**
     * @dev Permanently renounce ownership, making the contract fully decentralized.
     * Locks: bridgeMint, bridgeBurn, batchBridgeMint, batchBridgeBurn.
     * This action is irreversible.
     */
    function setOwnerless() external onlyOwner {
        emit ContractSetOwnerless();
        renounceOwnership();
    }

    /**
     * @dev Mint tokens for bridging (owner only)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     * @param bridgeId Identifier for the bridge transaction
     */
    function bridgeMint(address to, uint256 amount, string memory bridgeId) external onlyOwner {
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Amount must be greater than 0");
        
        _mint(to, amount);
        emit BridgeMint(to, amount, bridgeId);
    }
    
    /**
     * @dev Burn tokens for bridging (owner only)
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     * @param bridgeId Identifier for the bridge transaction
     */
    function bridgeBurn(address from, uint256 amount, string memory bridgeId) external onlyOwner {
        require(from != address(0), "Cannot burn from zero address");
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(from) >= amount, "Insufficient balance to burn");
        
        _burn(from, amount);
        emit BridgeBurn(from, amount, bridgeId);
    }
    
    /**
     * @dev Batch mint for multiple addresses (owner only)
     * @param recipients Array of addresses to mint to
     * @param amounts Array of amounts to mint
     * @param bridgeId Identifier for the batch bridge transaction
     */
    function batchBridgeMint(
        address[] memory recipients,
        uint256[] memory amounts,
        string memory bridgeId
    ) external onlyOwner {
        require(recipients.length == amounts.length, "Arrays length mismatch");
        require(recipients.length > 0, "Empty arrays");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Cannot mint to zero address");
            require(amounts[i] > 0, "Amount must be greater than 0");
            
            _mint(recipients[i], amounts[i]);
            emit BridgeMint(recipients[i], amounts[i], bridgeId);
        }
    }
    
    /**
     * @dev Commit a source address (sr25519/solana) to an EVM address (owner only)
     * @param sourceHash keccak256 hash of the source address string
     * @param evmAddress Target EVM address
     * @param sourceAddress Original source address string
     * @param sourceType Type of source key (substrate or solana)
     */
    function commit(
        bytes32 sourceHash,
        address evmAddress,
        string memory sourceAddress,
        string memory sourceType
    ) external onlyOwner {
        require(commitments[sourceHash] == address(0), "Already committed");
        require(evmAddress != address(0), "Invalid EVM address");
        commitments[sourceHash] = evmAddress;
        evmCommitments[evmAddress].push(sourceHash);
        emit Commitment(sourceHash, evmAddress, sourceAddress, sourceType);
    }

    /**
     * @dev Get the EVM address committed to a source address hash
     */
    function getCommitment(bytes32 sourceHash) external view returns (address) {
        return commitments[sourceHash];
    }

    /**
     * @dev Get all source address hashes committed to an EVM address
     */
    function getEvmCommitments(address evmAddress) external view returns (bytes32[] memory) {
        return evmCommitments[evmAddress];
    }

    /**
     * @dev Batch burn from multiple addresses (owner only)
     * @param holders Array of addresses to burn from
     * @param amounts Array of amounts to burn
     * @param bridgeId Identifier for the batch bridge transaction
     */
    function batchBridgeBurn(
        address[] memory holders,
        uint256[] memory amounts,
        string memory bridgeId
    ) external onlyOwner {
        require(holders.length == amounts.length, "Arrays length mismatch");
        require(holders.length > 0, "Empty arrays");
        
        for (uint256 i = 0; i < holders.length; i++) {
            require(holders[i] != address(0), "Cannot burn from zero address");
            require(amounts[i] > 0, "Amount must be greater than 0");
            require(balanceOf(holders[i]) >= amounts[i], "Insufficient balance to burn");
            
            _burn(holders[i], amounts[i]);
            emit BridgeBurn(holders[i], amounts[i], bridgeId);
        }
    }
}
