// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "./TFHE.sol";
import "./IZERC20.sol";

/// @title TFHEErrors — Revert when msg.sender lacks ACL permission on a handle
interface TFHEErrors {
    error TFHESenderNotAllowed();
}

/// @title ZERC20 — Zero-knowledge ERC20 with Fully Homomorphic Encryption
/// @notice Based on Zama fhEVM ConfidentialERC20.
///         Balances and allowances are encrypted euint64 ciphertext handles.
///         Transfers use oblivious execution: both paths always run,
///         TFHE.select picks the result homomorphically.
///
/// Architecture (Zama coprocessor model):
///   1. Host chain stores bytes32 handles (pointers to ciphertexts)
///   2. FHE coprocessor network performs actual encrypted computation
///   3. Gateway re-encrypts results for authorized viewers (EIP-712 signed)
///   4. Zero-knowledge proofs accompany every encrypted input from users
abstract contract ZERC20 is IZERC20, TFHEErrors {

    /// @dev Placeholder value emitted in events to prevent leaking amounts
    uint256 internal constant _PLACEHOLDER = type(uint256).max;

    /// @dev Public total supply (only non-encrypted field)
    uint64 internal _totalSupply;

    string internal _name;
    string internal _symbol;

    /// @dev Encrypted balances: address → euint64 ciphertext handle
    mapping(address => euint64) internal _balances;

    /// @dev Encrypted allowances: owner → spender → euint64 ciphertext handle
    mapping(address => mapping(address => euint64)) internal _allowances;

    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    // ================================================================
    //  PUBLIC — ERC20-like interface with encrypted amounts
    // ================================================================

    function name() public view virtual returns (string memory) { return _name; }
    function symbol() public view virtual returns (string memory) { return _symbol; }

    /// @notice Decimals fixed to 6 per Zama convention (euint64 max ≈ 1.8e19)
    function decimals() public view virtual returns (uint8) { return 6; }

    function totalSupply() public view virtual returns (uint64) { return _totalSupply; }

    /// @notice Returns encrypted balance handle. Use Gateway re-encryption to view.
    function balanceOf(address account) public view virtual returns (euint64) {
        return _balances[account];
    }

    /// @notice Returns encrypted allowance handle.
    function allowance(address owner, address spender) public view virtual returns (euint64) {
        return _allowances[owner][spender];
    }

    // ----------------------------------------------------------------
    //  approve — encrypted input from user
    // ----------------------------------------------------------------

    function approve(
        address spender,
        einput encryptedAmount,
        bytes calldata inputProof
    ) public virtual returns (bool) {
        approve(spender, TFHE.asEuint64(encryptedAmount, inputProof));
        return true;
    }

    /// @notice Approve with an existing euint64 handle (contract-to-contract)
    function approve(address spender, euint64 amount) public virtual returns (bool) {
        _isSenderAllowedForAmount(amount);
        address owner = msg.sender;
        _approve(owner, spender, amount);
        emit Approval(owner, spender, _PLACEHOLDER);
        return true;
    }

    // ----------------------------------------------------------------
    //  transfer — encrypted input from user
    // ----------------------------------------------------------------

    function transfer(
        address to,
        einput encryptedAmount,
        bytes calldata inputProof
    ) public virtual returns (bool) {
        transfer(to, TFHE.asEuint64(encryptedAmount, inputProof));
        return true;
    }

    /// @notice Transfer with an existing euint64 handle.
    ///         Uses oblivious execution: both balance updates always run.
    ///         If amount > balance, transferValue becomes 0 via TFHE.select.
    function transfer(address to, euint64 amount) public virtual returns (bool) {
        _isSenderAllowedForAmount(amount);
        // Encrypted comparison: amount <= sender's balance
        ebool canTransfer = TFHE.le(amount, _balances[msg.sender]);
        _transfer(msg.sender, to, amount, canTransfer);
        return true;
    }

    // ----------------------------------------------------------------
    //  transferFrom — encrypted input from user
    // ----------------------------------------------------------------

    function transferFrom(
        address from,
        address to,
        einput encryptedAmount,
        bytes calldata inputProof
    ) public virtual returns (bool) {
        transferFrom(from, to, TFHE.asEuint64(encryptedAmount, inputProof));
        return true;
    }

    /// @notice TransferFrom with allowance check — both allowance and balance
    ///         comparisons happen in encrypted space.
    function transferFrom(address from, address to, euint64 amount) public virtual returns (bool) {
        _isSenderAllowedForAmount(amount);
        address spender = msg.sender;
        ebool isTransferable = _updateAllowance(from, spender, amount);
        _transfer(from, to, amount, isTransferable);
        return true;
    }

    // ================================================================
    //  INTERNAL — Core FHE transfer logic
    // ================================================================

    /// @dev Set encrypted allowance and grant ACL access to both parties
    function _approve(address owner, address spender, euint64 amount) internal virtual {
        require(owner != address(0), "ZERC20: approve from zero address");
        require(spender != address(0), "ZERC20: approve to zero address");

        _allowances[owner][spender] = amount;
        TFHE.allowThis(amount);
        TFHE.allow(amount, owner);
        TFHE.allow(amount, spender);
    }

    /// @dev Oblivious transfer — both paths always execute.
    ///      transferValue = isTransferable ? amount : 0
    ///      Balances are updated with transferValue regardless.
    function _transfer(
        address from,
        address to,
        euint64 amount,
        ebool isTransferable
    ) internal virtual {
        _transferNoEvent(from, to, amount, isTransferable);
        emit Transfer(from, to, _PLACEHOLDER);
    }

    function _transferNoEvent(
        address from,
        address to,
        euint64 amount,
        ebool isTransferable
    ) internal virtual {
        require(from != address(0), "ZERC20: transfer from zero address");
        require(to != address(0), "ZERC20: transfer to zero address");

        // Oblivious select: if not transferable, amount becomes 0
        euint64 transferValue = TFHE.select(isTransferable, amount, TFHE.asEuint64(0));

        // Credit recipient
        euint64 newBalanceTo = TFHE.add(_balances[to], transferValue);
        _balances[to] = newBalanceTo;
        TFHE.allowThis(newBalanceTo);
        TFHE.allow(newBalanceTo, to);

        // Debit sender
        euint64 newBalanceFrom = TFHE.sub(_balances[from], transferValue);
        _balances[from] = newBalanceFrom;
        TFHE.allowThis(newBalanceFrom);
        TFHE.allow(newBalanceFrom, from);
    }

    /// @dev Check allowance and balance in encrypted space, return combined result
    function _updateAllowance(
        address owner,
        address spender,
        euint64 amount
    ) internal virtual returns (ebool) {
        euint64 currentAllowance = _allowances[owner][spender];

        // Both checks happen on ciphertexts — no information leaks
        ebool allowedTransfer = TFHE.le(amount, currentAllowance);
        ebool canTransfer = TFHE.le(amount, _balances[owner]);
        ebool isTransferable = TFHE.and_(canTransfer, allowedTransfer);

        // Conditionally deduct allowance only if transfer succeeds
        _approve(
            owner,
            spender,
            TFHE.select(isTransferable, TFHE.sub(currentAllowance, amount), currentAllowance)
        );

        return isTransferable;
    }

    /// @dev Mint new tokens (unsafe — no supply cap check)
    function _unsafeMint(address account, uint64 amount) internal virtual {
        _unsafeMintNoEvent(account, amount);
        emit Transfer(address(0), account, _PLACEHOLDER);
    }

    function _unsafeMintNoEvent(address account, uint64 amount) internal virtual {
        euint64 newBalance = TFHE.add(_balances[account], amount);
        _balances[account] = newBalance;
        TFHE.allowThis(newBalance);
        TFHE.allow(newBalance, account);
    }

    /// @dev Burn tokens (unsafe — assumes caller verified balance)
    function _unsafeBurn(address account, uint64 amount) internal virtual {
        euint64 newBalance = TFHE.sub(_balances[account], amount);
        _balances[account] = newBalance;
        TFHE.allowThis(newBalance);
        TFHE.allow(newBalance, account);
        emit Transfer(account, address(0), _PLACEHOLDER);
    }

    /// @dev Verify msg.sender has ACL permission on the ciphertext handle
    function _isSenderAllowedForAmount(euint64 amount) internal view virtual {
        if (!TFHE.isSenderAllowed(amount)) revert TFHESenderNotAllowed();
    }
}
