// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "./TFHE.sol";

/// @title IZERC20 — Interface for a Zero-knowledge ERC20 token
/// @notice Based on Zama fhEVM ConfidentialERC20 interface.
///         All balances and transfer amounts are encrypted as euint64 handles.
///         Events emit placeholder values to prevent information leakage.
interface IZERC20 {
    /// @notice Emitted on approval. Amount is always PLACEHOLDER (type(uint256).max).
    event Approval(address indexed owner, address indexed spender, uint256 placeholder);

    /// @notice Emitted on transfer. The transferId maps to an encrypted error code.
    event Transfer(address indexed from, address indexed to, uint256 transferId);

    // -- Encrypted input variants (user submits ciphertext + ZK proof) --

    function approve(
        address spender,
        einput encryptedAmount,
        bytes calldata inputProof
    ) external returns (bool);

    function transfer(
        address to,
        einput encryptedAmount,
        bytes calldata inputProof
    ) external returns (bool);

    function transferFrom(
        address from,
        address to,
        einput encryptedAmount,
        bytes calldata inputProof
    ) external returns (bool);

    // -- Handle variants (contract-to-contract with existing ciphertext) --

    function approve(address spender, euint64 amount) external returns (bool);
    function transfer(address to, euint64 amount) external returns (bool);
    function transferFrom(address from, address to, euint64 amount) external returns (bool);

    // -- View functions --

    /// @notice Returns the encrypted balance handle. Caller must have ACL access
    ///         and use Gateway re-encryption to view the plaintext.
    function balanceOf(address account) external view returns (euint64);

    /// @notice Returns the encrypted allowance handle.
    function allowance(address owner, address spender) external view returns (euint64);

    /// @notice Total supply is public (not encrypted).
    function totalSupply() external view returns (uint64);

    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}
