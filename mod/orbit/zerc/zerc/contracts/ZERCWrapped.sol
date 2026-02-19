// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "./TFHE.sol";
import "./ZERC20.sol";

/// @title IERC20Minimal — Minimal ERC20 interface for wrapping
interface IERC20Minimal {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
}

/// @title ZERCWrapped — Wrap a standard ERC20 into a confidential ZERC20
/// @notice Based on Zama's ConfidentialERC20Wrapped pattern.
///         Users deposit plaintext ERC20 tokens and receive encrypted ZERC20 balance.
///         Unwrapping requires Gateway decryption to verify sufficient encrypted balance.
///
/// Flow:
///   wrap():   ERC20 → contract custody → encrypted ZERC20 balance credited
///   unwrap(): Request decryption via Gateway → callback releases ERC20 if sufficient
contract ZERCWrapped is ZERC20 {

    IERC20Minimal public immutable UNDERLYING;
    uint8 internal immutable _underlyingDecimals;

    /// @dev Track pending unwrap requests awaiting Gateway decryption callback
    struct UnwrapRequest {
        address account;
        uint64 amount;
        uint256 timestamp;
    }

    uint256 public nextRequestId;
    mapping(uint256 => UnwrapRequest) public unwrapRequests;

    /// @dev Lock accounts during pending unwrap to prevent double-spend
    mapping(address => bool) public isAccountRestricted;

    event Wrap(address indexed account, uint64 amount);
    event Unwrap(address indexed account, uint64 amount);
    event UnwrapRequested(address indexed account, uint256 requestId, uint64 amount);
    event UnwrapFailed(address indexed account, uint64 amount, string reason);

    constructor(
        address underlying_
    ) ZERC20(
        string(abi.encodePacked("Confidential ", IERC20Minimal(underlying_).name())),
        string(abi.encodePacked("z", IERC20Minimal(underlying_).symbol()))
    ) {
        UNDERLYING = IERC20Minimal(underlying_);
        _underlyingDecimals = IERC20Minimal(underlying_).decimals();
    }

    /// @notice Wrap: deposit standard ERC20, receive encrypted ZERC20 balance.
    ///         The deposit amount is public but immediately becomes encrypted
    ///         as part of the recipient's euint64 balance.
    /// @param amount Amount in underlying token's decimals
    function wrap(uint256 amount) external {
        require(!isAccountRestricted[msg.sender], "ZERCWrapped: account restricted");

        // Pull underlying tokens
        require(
            UNDERLYING.transferFrom(msg.sender, address(this), amount),
            "ZERCWrapped: transfer failed"
        );

        // Adjust for decimal difference (underlying may be 18 decimals, ZERC is 6)
        uint256 adjusted = amount / (10 ** (_underlyingDecimals - decimals()));
        require(adjusted <= type(uint64).max, "ZERCWrapped: amount too high");

        uint64 mintAmount = uint64(adjusted);
        _totalSupply += mintAmount;
        _unsafeMint(msg.sender, mintAmount);

        emit Wrap(msg.sender, mintAmount);
    }

    /// @notice Unwrap: request decryption of balance check.
    ///         Account is locked until Gateway callback resolves.
    /// @param amount Amount in ZERC20 decimals (6)
    function unwrap(uint64 amount) external {
        require(!isAccountRestricted[msg.sender], "ZERCWrapped: account restricted");

        // Lock account to prevent transfers during pending unwrap
        isAccountRestricted[msg.sender] = true;

        // Create encrypted balance check
        ebool canUnwrap = TFHE.le(amount, _balances[msg.sender]);
        TFHE.allowThis(canUnwrap);

        // Store request for Gateway callback
        uint256 requestId = nextRequestId++;
        unwrapRequests[requestId] = UnwrapRequest({
            account: msg.sender,
            amount: amount,
            timestamp: block.timestamp
        });

        // In production: Gateway.requestDecryption() would be called here
        // The Gateway decrypts canUnwrap and calls callbackUnwrap()

        emit UnwrapRequested(msg.sender, requestId, amount);
    }

    /// @notice Gateway callback after decryption of the balance check.
    ///         In production this is called by the Gateway with the decrypted bool.
    /// @param requestId The unwrap request ID
    /// @param canUnwrap  Decrypted result of (amount <= balance)
    function callbackUnwrap(uint256 requestId, bool canUnwrap) external {
        // In production: onlyGateway modifier
        UnwrapRequest memory req = unwrapRequests[requestId];
        require(req.account != address(0), "ZERCWrapped: invalid request");

        if (canUnwrap) {
            // Scale back to underlying decimals
            uint256 underlyingAmount = uint256(req.amount) * (10 ** (_underlyingDecimals - decimals()));

            // Burn encrypted balance
            _unsafeBurn(req.account, req.amount);
            _totalSupply -= req.amount;

            // Release underlying tokens
            require(
                UNDERLYING.transfer(req.account, underlyingAmount),
                "ZERCWrapped: underlying transfer failed"
            );

            emit Unwrap(req.account, req.amount);
        } else {
            emit UnwrapFailed(req.account, req.amount, "insufficient balance");
        }

        // Unlock account
        delete unwrapRequests[requestId];
        delete isAccountRestricted[req.account];
    }

    /// @dev Override transfer to check restriction
    function transfer(address to, euint64 amount) public virtual override returns (bool) {
        require(!isAccountRestricted[msg.sender], "ZERCWrapped: account restricted");
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, euint64 amount) public virtual override returns (bool) {
        require(!isAccountRestricted[from], "ZERCWrapped: account restricted");
        return super.transferFrom(from, to, amount);
    }
}
