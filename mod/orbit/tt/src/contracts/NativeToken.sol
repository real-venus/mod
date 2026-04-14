// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title NativeToken
 * @dev Simple ERC20 token used as the staking token for StakeTime.
 */
contract NativeToken is ERC20 {
    constructor(uint256 initialSupply) ERC20("Native Token", "NTV") {
        _mint(msg.sender, initialSupply);
    }
}
