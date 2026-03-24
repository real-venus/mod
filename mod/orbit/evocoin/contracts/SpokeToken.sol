// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract SpokeToken is ERC20 {
    address public immutable exchange;
    address public immutable creator;

    modifier onlyExchange() {
        require(msg.sender == exchange, "Only exchange");
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        address _exchange,
        address _creator
    ) ERC20(_name, _symbol) {
        exchange = _exchange;
        creator = _creator;
    }

    function mint(address to, uint256 amount) external onlyExchange {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyExchange {
        _burn(from, amount);
    }
}
