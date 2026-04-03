// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

/**
 * @title PythPriceAdapter
 * @dev Adapter for Pyth Network price feeds with multi-chain support
 */
contract PythPriceAdapter {
    
    IPyth public immutable pyth;
    
    // Mapping from asset address to Pyth price feed ID
    mapping(address => bytes32) public assetToPriceFeedId;
    
    // Mapping from asset symbol to price feed ID for easy lookup
    mapping(string => bytes32) public symbolToPriceFeedId;
    
    event PriceFeedRegistered(address indexed asset, string symbol, bytes32 priceFeedId);
    event PriceUpdated(address indexed asset, int64 price, uint64 timestamp);
    
    constructor(address _pythContract) {
        require(_pythContract != address(0), "Invalid Pyth contract");
        pyth = IPyth(_pythContract);
    }
    
    /**
     * @dev Register a price feed for an asset
     */
    function registerPriceFeed(
        address _asset,
        string memory _symbol,
        bytes32 _priceFeedId
    ) external {
        require(_asset != address(0), "Invalid asset");
        require(_priceFeedId != bytes32(0), "Invalid price feed ID");
        
        assetToPriceFeedId[_asset] = _priceFeedId;
        symbolToPriceFeedId[_symbol] = _priceFeedId;
        
        emit PriceFeedRegistered(_asset, _symbol, _priceFeedId);
    }
    
    /**
     * @dev Get current price for an asset
     */
    function getPrice(address _asset) external view returns (uint256) {
        bytes32 priceFeedId = assetToPriceFeedId[_asset];
        require(priceFeedId != bytes32(0), "Price feed not registered");
        
        PythStructs.Price memory priceData = pyth.getPriceUnsafe(priceFeedId);
        require(priceData.price > 0, "Invalid price");
        
        // Convert price to uint256 with proper decimals
        uint256 price = uint256(uint64(priceData.price));
        
        // Adjust for exponent (Pyth uses negative exponents)
        if (priceData.expo < 0) {
            uint256 exponent = uint256(uint32(-priceData.expo));
            return price * (10 ** (18 - exponent));
        } else {
            uint256 exponent = uint256(uint32(priceData.expo));
            return price * (10 ** (18 + exponent));
        }
    }
    
    /**
     * @dev Get price by symbol
     */
    function getPriceBySymbol(string memory _symbol) external view returns (uint256) {
        bytes32 priceFeedId = symbolToPriceFeedId[_symbol];
        require(priceFeedId != bytes32(0), "Price feed not registered");
        
        PythStructs.Price memory priceData = pyth.getPriceUnsafe(priceFeedId);
        require(priceData.price > 0, "Invalid price");
        
        uint256 price = uint256(uint64(priceData.price));
        
        if (priceData.expo < 0) {
            uint256 exponent = uint256(uint32(-priceData.expo));
            return price * (10 ** (18 - exponent));
        } else {
            uint256 exponent = uint256(uint32(priceData.expo));
            return price * (10 ** (18 + exponent));
        }
    }
    
    /**
     * @dev Update price with Pyth price update data
     */
    function updatePrice(
        bytes[] calldata priceUpdateData
    ) external payable {
        uint256 fee = pyth.getUpdateFee(priceUpdateData);
        require(msg.value >= fee, "Insufficient fee");
        
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);
    }
    
    /**
     * @dev Get price with confidence interval
     */
    function getPriceWithConfidence(address _asset) external view returns (
        uint256 price,
        uint256 confidence,
        uint256 timestamp
    ) {
        bytes32 priceFeedId = assetToPriceFeedId[_asset];
        require(priceFeedId != bytes32(0), "Price feed not registered");
        
        PythStructs.Price memory priceData = pyth.getPriceUnsafe(priceFeedId);
        
        uint256 basePrice = uint256(uint64(priceData.price));
        uint256 conf = uint256(uint64(priceData.conf));
        
        if (priceData.expo < 0) {
            uint256 exponent = uint256(uint32(-priceData.expo));
            price = basePrice * (10 ** (18 - exponent));
            confidence = conf * (10 ** (18 - exponent));
        } else {
            uint256 exponent = uint256(uint32(priceData.expo));
            price = basePrice * (10 ** (18 + exponent));
            confidence = conf * (10 ** (18 + exponent));
        }
        
        timestamp = priceData.publishTime;
    }
}
