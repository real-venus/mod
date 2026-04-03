// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./SpokeToken.sol";
import "./EvoRegistry.sol";
import "./HubExchange.sol";

contract TokenFactory is Ownable {
    using SafeERC20 for IERC20;

    HubExchange public exchange;
    EvoRegistry public registry;
    IERC20 public evoToken;

    uint256 public creationFee;

    event TokenCreated(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        uint8 curveType,
        uint256 curveParam
    );

    constructor(
        address _exchange,
        address _registry,
        address _evoToken,
        uint256 _creationFee
    ) {
        exchange = HubExchange(_exchange);
        registry = EvoRegistry(_registry);
        evoToken = IERC20(_evoToken);
        creationFee = _creationFee;
    }

    function createToken(
        string memory name,
        string memory symbol,
        uint8 curveType,
        uint256 curveParam,
        uint16 buyFeeBps,
        uint16 sellFeeBps,
        uint16 burnBps,
        string memory metadata
    ) external returns (address) {
        if (creationFee > 0) {
            evoToken.safeTransferFrom(msg.sender, owner(), creationFee);
        }

        SpokeToken token = new SpokeToken(
            name, symbol, address(exchange), msg.sender
        );
        address tokenAddr = address(token);

        exchange.registerSpoke(
            tokenAddr, curveType, curveParam,
            buyFeeBps, sellFeeBps, burnBps, msg.sender
        );

        registry.registerToken(
            tokenAddr, msg.sender, name, symbol,
            curveType, curveParam, metadata
        );

        emit TokenCreated(tokenAddr, msg.sender, name, symbol, curveType, curveParam);
        return tokenAddr;
    }

    function setCreationFee(uint256 _fee) external onlyOwner {
        creationFee = _fee;
    }
}
