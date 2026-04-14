// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./StakeTime.sol";

/**
 * @title Subnet
 * @dev Emission & distribution layer on top of StakeTime. Default: Yuma Consensus.
 *
 *      I(StakeTime) — the incentive function:
 *        - Validators check in → accumulate blocktime scores with exponential decay
 *        - Each epoch: emissions distributed proportional to blocktime score
 *        - Validator takes commission, stakers get the rest proportional to their STT
 *
 *      Reads validator/staking state from the StakeTime contract.
 *      Holds nativeToken for emission payouts.
 */
contract Subnet is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ── Types ────────────────────────────────────────────────────────────────

    struct ValidatorScore {
        uint64 lastSeenBlock;
        uint256 blocktimeScore;
        uint256 earned;
    }

    struct ConsensusState {
        uint64 currentBlock;
        uint64 lastEmissionBlock;
        uint256 totalBlocktime;
        uint256 emissionRate;   // nativeToken per epoch
        uint256 decayBps;       // decay basis points (500 = 5%)
        uint64 epochLength;     // blocks per epoch
    }

    // ── Events ───────────────────────────────────────────────────────────────

    event Checkin(bytes32 indexed keyHash, uint64 blockNumber, uint256 newScore);
    event BlockProduced(uint64 blockNumber, bytes32 indexed proposer);
    event EmissionsDistributed(uint64 epoch, uint256 totalDistributed);
    event StakerRewardDistributed(bytes32 indexed validatorKeyHash, address indexed staker, uint256 amount);
    event ValidatorRewardClaimed(bytes32 indexed keyHash, address indexed to, uint256 amount);

    // ── State ────────────────────────────────────────────────────────────────

    StakeTime public stakeTime;
    IERC20 public nativeToken;
    ConsensusState public consensus;

    // Per-validator scoring (keyed by keyHash from StakeTime)
    mapping(bytes32 => ValidatorScore) public scores;

    // Reward balances
    mapping(bytes32 => uint256) public validatorBalances; // validator commission
    mapping(address => uint256) public stakerRewards;     // staker emission rewards

    // ── Constructor ──────────────────────────────────────────────────────────

    constructor(
        address _stakeTime,
        address _nativeToken,
        uint256 _emissionRate,
        uint256 _decayBps,
        uint64  _epochLength
    ) {
        require(_decayBps < 10000, "decay must be < 100%");

        stakeTime = StakeTime(_stakeTime);
        nativeToken = IERC20(_nativeToken);

        consensus = ConsensusState({
            currentBlock: 0,
            lastEmissionBlock: 0,
            totalBlocktime: 0,
            emissionRate: _emissionRate,
            decayBps: _decayBps,
            epochLength: _epochLength
        });
    }

    // ── Checkin ──────────────────────────────────────────────────────────────

    function checkin(string calldata key) external {
        bytes32 kh = keccak256(abi.encodePacked(key));
        require(stakeTime.isValidatorActive(kh), "not registered");

        (,uint8 keyType,,,) = stakeTime.getValidatorByHash(kh);

        if (StakeTime.KeyType(keyType) == StakeTime.KeyType.Ecdsa) {
            require(
                keccak256(abi.encodePacked(_addressToString(msg.sender))) ==
                keccak256(abi.encodePacked(key)),
                "sender mismatch"
            );
        } else {
            require(msg.sender == owner(), "only owner relays non-ECDSA checkins");
        }

        _applyCheckin(kh);
    }

    function batchCheckin(string[] calldata keys) external onlyOwner {
        for (uint256 i = 0; i < keys.length; i++) {
            bytes32 kh = keccak256(abi.encodePacked(keys[i]));
            if (stakeTime.isValidatorActive(kh)) {
                _applyCheckin(kh);
            }
        }
    }

    function _applyCheckin(bytes32 kh) internal {
        ValidatorScore storage s = scores[kh];
        uint64 bn = uint64(block.number);
        uint64 delta = s.lastSeenBlock == 0 ? 1 : bn - s.lastSeenBlock;
        if (delta > consensus.epochLength) delta = consensus.epochLength;

        s.blocktimeScore = _decay(s.blocktimeScore) + delta;
        s.lastSeenBlock = bn;

        _recalcTotal();
        emit Checkin(kh, bn, s.blocktimeScore);
    }

    // ── Block Production ─────────────────────────────────────────────────────

    function produceBlock() external returns (bytes32 proposer) {
        require(consensus.totalBlocktime > 0, "no active validators");

        consensus.currentBlock++;

        uint256 rand = uint256(keccak256(abi.encodePacked(
            block.prevrandao, consensus.currentBlock, block.timestamp
        )));
        uint256 target = rand % consensus.totalBlocktime;

        uint256 len = stakeTime.validatorCount();
        uint256 cumulative = 0;
        for (uint256 i = 0; i < len; i++) {
            bytes32 kh = stakeTime.getValidatorKeyHash(i);
            if (!stakeTime.isValidatorActive(kh)) continue;
            uint256 score = scores[kh].blocktimeScore;
            if (score == 0) continue;

            cumulative += score;
            if (cumulative > target) {
                proposer = kh;
                break;
            }
        }

        if (consensus.currentBlock - consensus.lastEmissionBlock >= consensus.epochLength) {
            _distribute();
        }

        emit BlockProduced(consensus.currentBlock, proposer);
    }

    // ── Emission Distribution ────────────────────────────────────────────────

    function distributeEmissions() external {
        require(
            consensus.currentBlock - consensus.lastEmissionBlock >= consensus.epochLength,
            "epoch not reached"
        );
        _distribute();
    }

    function _distribute() internal {
        if (consensus.totalBlocktime == 0) return;

        uint256 totalDistributed = 0;
        uint256 len = stakeTime.validatorCount();

        for (uint256 i = 0; i < len; i++) {
            bytes32 kh = stakeTime.getValidatorKeyHash(i);
            if (!stakeTime.isValidatorActive(kh)) continue;

            ValidatorScore storage s = scores[kh];
            if (s.blocktimeScore == 0) continue;

            // Validator's share of total emissions
            uint256 validatorShare = (consensus.emissionRate * s.blocktimeScore) / consensus.totalBlocktime;
            uint256 totalSTT = stakeTime.getValidatorTotalStakeTimeByHash(kh);
            uint256 commissionBps = stakeTime.getValidatorCommission(kh);

            if (totalSTT == 0) {
                // No stakers — validator keeps 100%
                validatorBalances[kh] += validatorShare;
                s.earned += validatorShare;
            } else {
                // Commission to validator
                uint256 commission = (validatorShare * commissionBps) / 10000;
                uint256 stakerPool = validatorShare - commission;

                validatorBalances[kh] += commission;
                s.earned += commission;

                // Distribute stakerPool proportional to STT on this validator
                uint256[] memory stakeIds = stakeTime.getValidatorStakeIdsByHash(kh);
                uint256 distributed = 0;

                for (uint256 j = 0; j < stakeIds.length; j++) {
                    (address staker,, uint256 amount,,, uint256 sttBalance,) =
                        stakeTime.getStakePosition(stakeIds[j]);
                    if (amount == 0) continue;

                    uint256 reward = (stakerPool * sttBalance) / totalSTT;
                    stakerRewards[staker] += reward;
                    distributed += reward;

                    emit StakerRewardDistributed(kh, staker, reward);
                }

                // Dust to validator
                if (stakerPool > distributed) {
                    validatorBalances[kh] += stakerPool - distributed;
                    s.earned += stakerPool - distributed;
                }
            }

            totalDistributed += validatorShare;
            s.blocktimeScore = _decay(s.blocktimeScore);
        }

        consensus.lastEmissionBlock = consensus.currentBlock;
        _recalcTotal();

        // Advance epoch in StakeTime (for staker cap tracking)
        try stakeTime.advanceEpoch() {} catch {}

        emit EmissionsDistributed(consensus.currentBlock, totalDistributed);
    }

    // ── Reward Claims ────────────────────────────────────────────────────────

    function claimStakerRewards() external nonReentrant {
        uint256 amount = stakerRewards[msg.sender];
        require(amount > 0, "nothing to claim");
        stakerRewards[msg.sender] = 0;
        nativeToken.safeTransfer(msg.sender, amount);
    }

    function claimValidatorRewards(string calldata key, address to) external {
        bytes32 kh = keccak256(abi.encodePacked(key));
        require(stakeTime.isValidatorActive(kh), "not registered");

        (,uint8 keyType,,,) = stakeTime.getValidatorByHash(kh);

        if (StakeTime.KeyType(keyType) == StakeTime.KeyType.Ecdsa) {
            require(
                keccak256(abi.encodePacked(_addressToString(msg.sender))) ==
                keccak256(abi.encodePacked(key)),
                "sender mismatch"
            );
        } else {
            require(msg.sender == owner(), "only owner for non-ECDSA");
        }

        uint256 amount = validatorBalances[kh];
        require(amount > 0, "nothing to claim");
        validatorBalances[kh] = 0;

        nativeToken.safeTransfer(to, amount);
        emit ValidatorRewardClaimed(kh, to, amount);
    }

    // ── Decay ────────────────────────────────────────────────────────────────

    function _decay(uint256 score) internal view returns (uint256) {
        return (score * (10000 - consensus.decayBps)) / 10000;
    }

    function _recalcTotal() internal {
        uint256 total = 0;
        uint256 len = stakeTime.validatorCount();
        for (uint256 i = 0; i < len; i++) {
            bytes32 kh = stakeTime.getValidatorKeyHash(i);
            if (stakeTime.isValidatorActive(kh)) {
                total += scores[kh].blocktimeScore;
            }
        }
        consensus.totalBlocktime = total;
    }

    // ── Views ────────────────────────────────────────────────────────────────

    function getBlock() external view returns (
        uint64, uint64, uint256, uint256, uint256, uint64
    ) {
        ConsensusState storage c = consensus;
        return (c.currentBlock, c.lastEmissionBlock, c.totalBlocktime,
                c.emissionRate, c.decayBps, c.epochLength);
    }

    function getValidatorScore(bytes32 kh) external view returns (
        uint64 lastSeenBlock, uint256 blocktimeScore, uint256 earned
    ) {
        ValidatorScore storage s = scores[kh];
        return (s.lastSeenBlock, s.blocktimeScore, s.earned);
    }

    function getValidatorBalance(string calldata key) external view returns (uint256) {
        return validatorBalances[keccak256(abi.encodePacked(key))];
    }

    function getStakerRewards(address staker) external view returns (uint256) {
        return stakerRewards[staker];
    }

    function getLeaderboard(uint256 limit) external view returns (
        bytes32[] memory keys, uint256[] memory topScores
    ) {
        uint256 len = stakeTime.validatorCount();
        if (limit > len) limit = len;

        bytes32[] memory allKeys = new bytes32[](len);
        uint256[] memory allScores = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            allKeys[i] = stakeTime.getValidatorKeyHash(i);
            allScores[i] = scores[allKeys[i]].blocktimeScore;
        }

        for (uint256 i = 0; i < limit; i++) {
            uint256 maxIdx = i;
            for (uint256 j = i + 1; j < len; j++) {
                if (allScores[j] > allScores[maxIdx]) maxIdx = j;
            }
            if (maxIdx != i) {
                (allKeys[i], allKeys[maxIdx]) = (allKeys[maxIdx], allKeys[i]);
                (allScores[i], allScores[maxIdx]) = (allScores[maxIdx], allScores[i]);
            }
        }

        keys = new bytes32[](limit);
        topScores = new uint256[](limit);
        for (uint256 i = 0; i < limit; i++) {
            keys[i] = allKeys[i];
            topScores[i] = allScores[i];
        }
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    function setEmissionRate(uint256 rate) external onlyOwner {
        consensus.emissionRate = rate;
    }

    function setDecayBps(uint256 bps) external onlyOwner {
        require(bps < 10000, "decay must be < 100%");
        consensus.decayBps = bps;
    }

    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    // ── Internal Utils ───────────────────────────────────────────────────────

    function _addressToString(address addr) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes20 data = bytes20(addr);
        bytes memory str = new bytes(42);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2] = alphabet[uint8(data[i] >> 4)];
            str[3 + i * 2] = alphabet[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }
}
