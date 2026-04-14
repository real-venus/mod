// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./subnet/StakeTime.sol";

/**
 * @title Registry
 * @dev Subnet registry with Bittensor-style deregistration.
 *      Max 420 subnets. When full, the subnet with the lowest score
 *      (locked stake + STT supply) gets replaced — unless it's still
 *      in its immunity period.
 *      Registration requires locking NativeToken.
 */
contract Registry is Ownable {
    using SafeERC20 for IERC20;

    // ── Types ────────────────────────────────────────────────────────────

    struct SubnetInfo {
        uint256 id;
        address owner;
        string name;
        address stakeTime;
        address incentive;
        uint256 registeredBlock;
        bool active;
    }

    // ── Events ───────────────────────────────────────────────────────────

    event SubnetRegistered(uint256 indexed id, address indexed owner, string name, address stakeTime, address incentive);
    event SubnetDeregistered(uint256 indexed id, address indexed replacedBy);
    event ImmunityPeriodUpdated(uint256 newPeriod);
    event RegistrationCostUpdated(uint256 newCost);

    // ── Constants & State ────────────────────────────────────────────────

    uint256 public constant MAX_SUBNETS = 420;

    IERC20 public nativeToken;
    uint256 public registrationCost;
    uint256 public immunityPeriod;  // blocks
    uint256 public nextSubnetId;

    mapping(uint256 => SubnetInfo) public subnets;
    mapping(uint256 => uint256) public lockedStake;  // per subnet
    uint256[] public subnetIds;  // active subnet ids for iteration
    mapping(address => uint256[]) internal _ownerSubnets;

    // ── Constructor ──────────────────────────────────────────────────────

    constructor(uint256 _immunityPeriod, address _nativeToken, uint256 _registrationCost) {
        require(_nativeToken != address(0), "zero nativeToken");
        immunityPeriod = _immunityPeriod;
        nativeToken = IERC20(_nativeToken);
        registrationCost = _registrationCost;
    }

    // ── Registration ─────────────────────────────────────────────────────

    function registerSubnet(
        string calldata name,
        address stakeTime,
        address incentive
    ) external returns (uint256 subnetId) {
        require(stakeTime != address(0), "zero stakeTime");
        require(incentive != address(0), "zero incentive");

        // Lock NativeToken
        if (registrationCost > 0) {
            nativeToken.safeTransferFrom(msg.sender, address(this), registrationCost);
        }

        // If at capacity, replace the weakest non-immune subnet
        if (_activeCount() >= MAX_SUBNETS) {
            (uint256 weakId, bool found) = _findWeakest();
            require(found, "all subnets immune");
            _deregister(weakId, msg.sender);
        }

        subnetId = nextSubnetId++;
        subnets[subnetId] = SubnetInfo({
            id: subnetId,
            owner: msg.sender,
            name: name,
            stakeTime: stakeTime,
            incentive: incentive,
            registeredBlock: block.number,
            active: true
        });
        lockedStake[subnetId] = registrationCost;
        subnetIds.push(subnetId);
        _ownerSubnets[msg.sender].push(subnetId);

        emit SubnetRegistered(subnetId, msg.sender, name, stakeTime, incentive);
    }

    function deregisterSubnet(uint256 subnetId) external {
        SubnetInfo storage s = subnets[subnetId];
        require(s.active, "not active");
        require(
            msg.sender == s.owner || msg.sender == owner(),
            "not authorized"
        );
        _deregister(subnetId, address(0));
    }

    // ── Views ────────────────────────────────────────────────────────────

    function getSubnet(uint256 subnetId) external view returns (
        uint256 id, address subnetOwner, string memory name,
        address stakeTime, address incentive,
        uint256 registeredBlock, bool active
    ) {
        SubnetInfo storage s = subnets[subnetId];
        return (s.id, s.owner, s.name, s.stakeTime, s.incentive, s.registeredBlock, s.active);
    }

    function getSubnetCount() external view returns (uint256) {
        return _activeCount();
    }

    function getAllSubnets() external view returns (SubnetInfo[] memory result) {
        uint256 count = _activeCount();
        result = new SubnetInfo[](count);
        uint256 idx;
        for (uint256 i = 0; i < subnetIds.length; i++) {
            SubnetInfo storage s = subnets[subnetIds[i]];
            if (s.active) {
                result[idx++] = s;
            }
        }
    }

    function isImmune(uint256 subnetId) public view returns (bool) {
        SubnetInfo storage s = subnets[subnetId];
        if (!s.active) return false;
        return block.number < s.registeredBlock + immunityPeriod;
    }

    function getStakeScore(uint256 subnetId) public view returns (uint256) {
        SubnetInfo storage s = subnets[subnetId];
        if (!s.active || s.stakeTime == address(0)) return 0;
        uint256 locked = lockedStake[subnetId];
        try StakeTime(s.stakeTime).totalSupply() returns (uint256 supply) {
            return locked + supply;
        } catch {
            return locked;
        }
    }

    function getWeakestSubnet() external view returns (uint256 weakId, uint256 weakScore, bool found) {
        uint256 minScore = type(uint256).max;
        for (uint256 i = 0; i < subnetIds.length; i++) {
            uint256 sid = subnetIds[i];
            SubnetInfo storage s = subnets[sid];
            if (!s.active) continue;
            if (isImmune(sid)) continue;

            uint256 score = getStakeScore(sid);
            if (score < minScore) {
                minScore = score;
                weakId = sid;
                found = true;
            }
        }
        weakScore = found ? minScore : 0;
    }

    function getOwnerSubnets(address subnetOwner) external view returns (uint256[] memory) {
        return _ownerSubnets[subnetOwner];
    }

    function getLockedStake(uint256 subnetId) external view returns (uint256) {
        return lockedStake[subnetId];
    }

    function getRegistrationCost() external view returns (uint256) {
        return registrationCost;
    }

    // ── Admin ────────────────────────────────────────────────────────────

    function setImmunityPeriod(uint256 _period) external onlyOwner {
        immunityPeriod = _period;
        emit ImmunityPeriodUpdated(_period);
    }

    function setRegistrationCost(uint256 _cost) external onlyOwner {
        registrationCost = _cost;
        emit RegistrationCostUpdated(_cost);
    }

    // ── Internal ─────────────────────────────────────────────────────────

    function _activeCount() internal view returns (uint256 count) {
        for (uint256 i = 0; i < subnetIds.length; i++) {
            if (subnets[subnetIds[i]].active) count++;
        }
    }

    function _findWeakest() internal view returns (uint256 weakId, bool found) {
        uint256 minScore = type(uint256).max;
        for (uint256 i = 0; i < subnetIds.length; i++) {
            uint256 sid = subnetIds[i];
            SubnetInfo storage s = subnets[sid];
            if (!s.active) continue;
            if (isImmune(sid)) continue;

            uint256 score = getStakeScore(sid);
            if (score < minScore) {
                minScore = score;
                weakId = sid;
                found = true;
            }
        }
    }

    function _deregister(uint256 subnetId, address replacedBy) internal {
        SubnetInfo storage s = subnets[subnetId];
        s.active = false;

        // Return locked tokens to subnet owner
        uint256 locked = lockedStake[subnetId];
        if (locked > 0) {
            lockedStake[subnetId] = 0;
            nativeToken.safeTransfer(s.owner, locked);
        }

        emit SubnetDeregistered(subnetId, replacedBy);
    }
}
