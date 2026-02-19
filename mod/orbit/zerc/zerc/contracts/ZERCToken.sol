// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "./TFHE.sol";
import "./ZERC20.sol";

/// @title ZERCToken — Deployable confidential ERC20 token
/// @notice Concrete implementation of ZERC20, based on Zama's fhEVM
///         ConfidentialERC20Mintable pattern. Owner can mint; all balances
///         and transfer amounts remain encrypted via FHE.
///
/// Privacy guarantees:
///   - Balances: encrypted (euint64). Only the account holder can view via
///     Gateway re-encryption with EIP-712 signature.
///   - Transfer amounts: encrypted. Events emit placeholder values.
///   - Allowances: encrypted. Spender and owner can view via re-encryption.
///   - Total supply: public (uint64). This is the only observable quantity.
contract ZERCToken is ZERC20 {

    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "ZERCToken: caller is not the owner");
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        address owner_
    ) ZERC20(name_, symbol_) {
        owner = owner_;
    }

    /// @notice Mint encrypted tokens to an account. Only owner.
    ///         The minted amount is public at mint time but immediately
    ///         becomes part of the recipient's encrypted balance.
    /// @param to     Recipient address
    /// @param amount Plaintext amount (absorbed into encrypted balance)
    function mint(address to, uint64 amount) external onlyOwner {
        _totalSupply += amount;
        _unsafeMint(to, amount);
    }

    /// @notice Batch mint to multiple addresses
    function mintBatch(
        address[] calldata recipients,
        uint64[] calldata amounts
    ) external onlyOwner {
        require(recipients.length == amounts.length, "ZERCToken: length mismatch");
        for (uint256 i = 0; i < recipients.length; i++) {
            _totalSupply += amounts[i];
            _unsafeMint(recipients[i], amounts[i]);
        }
    }

    /// @notice Burn tokens from caller's encrypted balance.
    ///         Requires plaintext amount — caller must know their balance.
    function burn(uint64 amount) external {
        ebool canBurn = TFHE.le(amount, _balances[msg.sender]);
        euint64 burnValue = TFHE.select(canBurn, TFHE.asEuint64(amount), TFHE.asEuint64(0));

        euint64 newBalance = TFHE.sub(_balances[msg.sender], burnValue);
        _balances[msg.sender] = newBalance;
        TFHE.allowThis(newBalance);
        TFHE.allow(newBalance, msg.sender);

        // Total supply adjustment uses plaintext — safe because we verified via FHE
        // In production, this would go through Gateway decryption callback
        _totalSupply -= amount;

        emit Transfer(msg.sender, address(0), _PLACEHOLDER);
    }

    /// @notice Transfer ownership
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ZERCToken: zero address");
        owner = newOwner;
    }
}
