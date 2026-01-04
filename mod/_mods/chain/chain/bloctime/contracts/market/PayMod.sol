// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title PayMod
 * @dev Simplified payment module - prices set directly via list, no map
 */
contract PayMod is Ownable {
    struct TokenInfo {
        address token;
        uint256 price; // Manual price in USD (8 decimals)
        uint8 decimals; // Token decimals
        uint256 timestamp;
    }
    
    TokenInfo[] public tokenList;
    
    event PricesSet(uint256 count, uint256 timestamp);
    event PricesCleared();
    
    function setPrices(address[] calldata tokens, uint256[] calldata prices, uint8[] calldata decimals) external onlyOwner {
        require(tokens.length == prices.length && tokens.length == decimals.length, "Array length mismatch");
        
        // Clear existing list
        delete tokenList;
        
        // Set new prices
        for (uint256 i = 0; i < tokens.length; i++) {
            require(tokens[i] != address(0), "Invalid token");
            require(prices[i] > 0, "Invalid price");
            
            tokenList.push(TokenInfo({
                token: tokens[i],
                price: prices[i],
                decimals: decimals[i],
                timestamp: block.timestamp
            }));
        }
        
        emit PricesSet(tokens.length, block.timestamp);
    }
    
    function clearPrices() external onlyOwner {
        delete tokenList;
        emit PricesCleared();
    }
    
    function isTokenModed(address token) external view returns (bool) {
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (tokenList[i].token == token) {
                return true;
            }
        }
        return false;
    }
    
    function getTokenPrice(address token) external view returns (uint256 price, uint8 decimals, uint256 timestamp) {
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (tokenList[i].token == token) {
                return (tokenList[i].price, tokenList[i].decimals, tokenList[i].timestamp);
            }
        }
        revert("Price not set");
    }
    
    function getTokenList() external view returns (TokenInfo[] memory) {
        return tokenList;
    }
    
    function calculatePayment(
        address paymentToken,
        uint256 blocTimeAmount,
        uint256 blocTimePriceUSD
    ) external view returns (uint256) {
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (tokenList[i].token == paymentToken) {
                uint256 totalCostUSD = blocTimeAmount * blocTimePriceUSD;
                return (totalCostUSD * (10 ** tokenList[i].decimals)) / tokenList[i].price;
            }
        }
        revert("Price not set");
    }
}
