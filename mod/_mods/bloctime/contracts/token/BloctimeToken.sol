// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BlocTimeToken
 * @dev ERC20 token representing bloctime - minted based on staking duration
 */
contract BlocTimeToken is ERC20, Ownable {
    address public stakingContract;
    
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}
    
    function setStakingContract(address _stakingContract) external onlyOwner {
        require(stakingContract == address(0), "Already set");
        stakingContract = _stakingContract;
    }
    
    function mint(address to, uint256 amount) external {
        require(msg.sender == stakingContract, "Only staking contract");
        _mint(to, amount);
    }
    
    function burn(address from, uint256 amount) external {
        require(msg.sender == stakingContract, "Only staking contract");
        _burn(from, amount);
    }
}
