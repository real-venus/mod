// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ManualOracle {
    address public owner;
    mapping(address => uint256) public prices;
    
    event PriceUpdated(address indexed token, uint256 price);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    function setPrice(address token, uint256 price) external onlyOwner {
        prices[token] = price;
        emit PriceUpdated(token, price);
    }
    
    function getPrice(address token) external view returns (uint256) {
        require(prices[token] > 0, "Price not set");
        return prices[token];
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
}
