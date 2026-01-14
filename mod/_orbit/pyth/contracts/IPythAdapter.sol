// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IPythAdapter
 * @dev Interface for Pyth price adapter
 */
interface IPythAdapter {
    
    /**
     * @dev Get current price for an asset
     */
    function getPrice(address _asset) external view returns (uint256);
    
    /**
     * @dev Get price by symbol
     */
    function getPriceBySymbol(string memory _symbol) external view returns (uint256);
    
    /**
     * @dev Get price with confidence interval
     */
    function getPriceWithConfidence(address _asset) external view returns (
        uint256 price,
        uint256 confidence,
        uint256 timestamp
    );
    
    /**
     * @dev Update price with Pyth price update data
     */
    function updatePrice(bytes[] calldata priceUpdateData) external payable;
    
    /**
     * @dev Register a price feed for an asset
     */
    function registerPriceFeed(
        address _asset,
        string memory _symbol,
        bytes32 _priceFeedId
    ) external;
}
