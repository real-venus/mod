// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./SpokeToken.sol";

contract HubExchange is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public evoToken;

    uint8 public constant LINEAR = 0;
    uint8 public constant EXPONENTIAL = 1;
    uint8 public constant SIGMOID = 2;
    uint8 public constant FIXED = 3;

    struct SpokeConfig {
        bool active;
        uint8 curveType;
        uint256 curveParam;
        uint16 buyFeeBps;
        uint16 sellFeeBps;
        uint16 burnBps;
        address creator;
        uint256 reserveBalance;
        uint256 totalVolume;
        uint256 totalTrades;
    }

    mapping(address => SpokeConfig) public spokes;
    address public factory;

    uint256 constant SCALE = 1e18;

    event Buy(address indexed spoke, address indexed buyer, uint256 evoIn, uint256 tokensOut);
    event Sell(address indexed spoke, address indexed seller, uint256 tokensIn, uint256 evoOut);
    event SpokeRegistered(address indexed spoke, address indexed creator, uint8 curveType);
    event SpokeDeprecated(address indexed spoke);

    constructor(address _evoToken) {
        evoToken = IERC20(_evoToken);
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    function setFactory(address _factory) external onlyOwner {
        factory = _factory;
    }

    function registerSpoke(
        address spoke,
        uint8 curveType,
        uint256 curveParam,
        uint16 buyFeeBps,
        uint16 sellFeeBps,
        uint16 burnBps,
        address creator
    ) external onlyFactory {
        require(!spokes[spoke].active, "Already registered");
        require(curveType <= 3, "Invalid curve type");
        require(buyFeeBps <= 1000, "Buy fee max 10%");
        require(sellFeeBps <= 1000, "Sell fee max 10%");
        require(burnBps <= 10000, "Invalid burn bps");

        spokes[spoke] = SpokeConfig({
            active: true,
            curveType: curveType,
            curveParam: curveParam,
            buyFeeBps: buyFeeBps,
            sellFeeBps: sellFeeBps,
            burnBps: burnBps,
            creator: creator,
            reserveBalance: 0,
            totalVolume: 0,
            totalTrades: 0
        });

        emit SpokeRegistered(spoke, creator, curveType);
    }

    function buy(
        address spoke,
        uint256 evoAmount,
        uint256 minTokensOut
    ) external nonReentrant returns (uint256 tokensOut) {
        SpokeConfig storage config = spokes[spoke];
        require(config.active, "Spoke not active");
        require(evoAmount > 0, "Zero amount");

        uint256 fee = (evoAmount * config.buyFeeBps) / 10000;
        uint256 evoAfterFee = evoAmount - fee;

        uint256 currentSupply = SpokeToken(spoke).totalSupply();
        tokensOut = _calculateBuyReturn(config, currentSupply, evoAfterFee);
        require(tokensOut >= minTokensOut, "Slippage exceeded");

        evoToken.safeTransferFrom(msg.sender, address(this), evoAmount);
        _distributeFee(fee, config);

        config.reserveBalance += evoAfterFee;
        config.totalVolume += evoAmount;
        config.totalTrades += 1;

        SpokeToken(spoke).mint(msg.sender, tokensOut);
        emit Buy(spoke, msg.sender, evoAmount, tokensOut);
    }

    function sell(
        address spoke,
        uint256 tokenAmount,
        uint256 minEvoOut
    ) external nonReentrant returns (uint256 evoOut) {
        SpokeConfig storage config = spokes[spoke];
        require(config.active, "Spoke not active");
        require(tokenAmount > 0, "Zero amount");

        uint256 currentSupply = SpokeToken(spoke).totalSupply();
        uint256 evoBeforeFee = _calculateSellReturn(config, currentSupply, tokenAmount);

        uint256 fee = (evoBeforeFee * config.sellFeeBps) / 10000;
        evoOut = evoBeforeFee - fee;
        require(evoOut >= minEvoOut, "Slippage exceeded");
        require(evoBeforeFee <= config.reserveBalance, "Insufficient reserve");

        SpokeToken(spoke).burn(msg.sender, tokenAmount);
        _distributeFee(fee, config);

        config.reserveBalance -= evoBeforeFee;
        config.totalVolume += evoBeforeFee;
        config.totalTrades += 1;

        evoToken.safeTransfer(msg.sender, evoOut);
        emit Sell(spoke, msg.sender, tokenAmount, evoOut);
    }

    function deprecateSpoke(address spoke) external onlyOwner {
        require(spokes[spoke].active, "Not active");
        spokes[spoke].active = false;
        emit SpokeDeprecated(spoke);
    }

    // --- BONDING CURVE MATH ---

    function _calculateBuyReturn(
        SpokeConfig storage config,
        uint256 currentSupply,
        uint256 evoIn
    ) internal view returns (uint256) {
        if (config.curveType == LINEAR) {
            return _linearBuy(config.curveParam, currentSupply, evoIn);
        } else if (config.curveType == EXPONENTIAL) {
            return _exponentialBuy(config.curveParam, currentSupply, evoIn);
        } else if (config.curveType == SIGMOID) {
            return _sigmoidBuy(config.curveParam, currentSupply, evoIn);
        } else {
            return (evoIn * SCALE) / config.curveParam;
        }
    }

    function _calculateSellReturn(
        SpokeConfig storage config,
        uint256 currentSupply,
        uint256 tokenAmount
    ) internal view returns (uint256) {
        if (config.curveType == LINEAR) {
            return _linearSell(config.curveParam, currentSupply, tokenAmount);
        } else if (config.curveType == EXPONENTIAL) {
            return _exponentialSell(config.curveParam, currentSupply, tokenAmount);
        } else if (config.curveType == SIGMOID) {
            return _sigmoidSell(config.curveParam, currentSupply, tokenAmount);
        } else {
            return (tokenAmount * config.curveParam) / SCALE;
        }
    }

    // LINEAR: price = slope * supply / SCALE
    // Integral-based: dS = sqrt(S^2 + 2*evoIn*SCALE/slope) - S
    function _linearBuy(uint256 slope, uint256 S, uint256 evoIn) internal pure returns (uint256) {
        if (slope == 0) return 0;
        uint256 twoEvoScaled = (2 * evoIn * SCALE) / slope;
        uint256 inner = S * S + twoEvoScaled;
        uint256 sqrtInner = _sqrt(inner);
        return sqrtInner > S ? sqrtInner - S : 0;
    }

    function _linearSell(uint256 slope, uint256 S, uint256 dS) internal pure returns (uint256) {
        if (dS > S) dS = S;
        return slope * (2 * S * dS - dS * dS) / (2 * SCALE);
    }

    // EXPONENTIAL: price = param * (supply/SCALE)^2 — spot price approximation
    function _exponentialBuy(uint256 param, uint256 S, uint256 evoIn) internal pure returns (uint256) {
        uint256 spotPrice = (param * S * S) / (SCALE * SCALE);
        if (spotPrice == 0) spotPrice = param / SCALE;
        if (spotPrice == 0) spotPrice = 1;
        return (evoIn * SCALE) / spotPrice;
    }

    function _exponentialSell(uint256 param, uint256 S, uint256 dS) internal pure returns (uint256) {
        uint256 spotPrice = (param * S * S) / (SCALE * SCALE);
        if (spotPrice == 0) spotPrice = param / SCALE;
        if (spotPrice == 0) spotPrice = 1;
        return (dS * spotPrice) / SCALE;
    }

    // SIGMOID: price = SCALE * S / (S + midpoint)
    function _sigmoidBuy(uint256 midpoint, uint256 S, uint256 evoIn) internal pure returns (uint256) {
        uint256 spotPrice;
        if (S == 0) {
            spotPrice = SCALE / (midpoint > 10 ? 10 : midpoint > 0 ? midpoint : 1);
        } else {
            spotPrice = (SCALE * S) / (S + midpoint);
        }
        if (spotPrice == 0) spotPrice = 1;
        return (evoIn * SCALE) / spotPrice;
    }

    function _sigmoidSell(uint256 midpoint, uint256 S, uint256 dS) internal pure returns (uint256) {
        if (S == 0) return 0;
        uint256 spotPrice = (SCALE * S) / (S + midpoint);
        if (spotPrice == 0) return 0;
        return (dS * spotPrice) / SCALE;
    }

    function _distributeFee(uint256 fee, SpokeConfig storage config) internal {
        if (fee == 0) return;
        uint256 burnAmount = (fee * config.burnBps) / 10000;
        uint256 creatorAmount = fee - burnAmount;
        if (creatorAmount > 0) {
            evoToken.safeTransfer(config.creator, creatorAmount);
        }
    }

    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    // --- VIEW ---

    function getSpotPrice(address spoke) external view returns (uint256) {
        SpokeConfig storage config = spokes[spoke];
        require(config.active, "Not active");
        uint256 supply = SpokeToken(spoke).totalSupply();
        if (config.curveType == LINEAR) {
            return (config.curveParam * supply) / SCALE;
        } else if (config.curveType == EXPONENTIAL) {
            uint256 price = (config.curveParam * supply * supply) / (SCALE * SCALE);
            return price == 0 ? config.curveParam / SCALE : price;
        } else if (config.curveType == SIGMOID) {
            if (supply == 0) return 0;
            return (SCALE * supply) / (supply + config.curveParam);
        } else {
            return config.curveParam;
        }
    }

    function getSpokeInfo(address spoke) external view returns (
        bool active,
        uint8 curveType,
        uint256 curveParam,
        uint16 buyFeeBps,
        uint16 sellFeeBps,
        address creator,
        uint256 reserveBalance,
        uint256 totalVolume,
        uint256 totalTrades,
        uint256 totalSupply
    ) {
        SpokeConfig storage c = spokes[spoke];
        return (
            c.active, c.curveType, c.curveParam,
            c.buyFeeBps, c.sellFeeBps,
            c.creator, c.reserveBalance,
            c.totalVolume, c.totalTrades,
            SpokeToken(spoke).totalSupply()
        );
    }
}
