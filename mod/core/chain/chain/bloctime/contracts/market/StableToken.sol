// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title StableToken
 * @dev Independent ERC20 token for marketplace stable value
 * Minted based on TokenGate pricing - represents stable credits/debits
 */
contract StableToken is ERC20, Ownable {
    address public marketplace;
    
    event MarketplaceUpdated(address indexed newMarketplace);
    
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}
    
    function setMarketplace(address _marketplace) external onlyOwner {
        require(_marketplace != address(0), "Invalid marketplace");
        marketplace = _marketplace;
        emit MarketplaceUpdated(_marketplace);
    }
    
    /**
     * @dev Mint stable tokens based on payment received
     * Only marketplace can mint
     */
    function mint(address to, uint256 amount) external {
        require(msg.sender == marketplace, "Only marketplace");
        _mint(to, amount);
    }
    
    /**
     * @dev Burn stable tokens for debit transactions
     * Only marketplace can burn
     */
    function burn(address from, uint256 amount) external {
        require(msg.sender == marketplace, "Only marketplace");
        _burn(from, amount);
    }
    
    /**
     * @dev Returns 8 decimals to match stable pricing standard
     */
    function decimals() public pure override returns (uint8) {
        return 8;
    }
}