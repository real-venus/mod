// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Subnet.sol";

/**
 * @title StakeTime
 * @dev Consensus mechanism for a subnet. Users stake nativeToken ON validators,
 *      receiving StakeTime (STT) ERC20 proportional to amount × M(lockBlocks).
 *
 *      Consensus: Yuma blocktime scoring with exponential decay. Validators
 *      check in to accumulate score. Each epoch, fresh Subnet tokens are minted
 *      as emissions and distributed proportional to blocktime score. Commission
 *      goes to validators, the rest to stakers by STT weight.
 *
 *      Slashing: Validators can be slashed for misbehavior. All stakers on
 *      a slashed validator lose a percentage of their stake. Auto-deactivates
 *      after maxSlashCount slashes.
 */
contract StakeTime is ERC20, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ── Types ────────────────────────────────────────────────────────────────

    enum KeyType { Ecdsa, Ed25519, Sr25519 }

    struct Validator {
        string key;
        KeyType keyType;
        uint64 registeredBlock;
        uint256 commissionBps;  // basis points (1000 = 10%)
        bool active;
    }

    struct StakePosition {
        uint256 stakeId;
        address staker;
        bytes32 validatorKeyHash;
        uint256 amount;         // nativeToken locked
        uint256 startBlock;
        uint256 lockBlocks;
        uint256 stakeTimeBalance; // STT minted
    }

    struct ValidatorScore {
        uint64 lastSeenBlock;
        uint256 blocktimeScore;
        uint256 earned;
    }

    struct Point {
        uint256 blocks;
        uint256 multiplier;     // basis points (10000 = 1x)
    }

    // ── Events ───────────────────────────────────────────────────────────────

    event ValidatorRegistered(bytes32 indexed keyHash, string key, uint8 keyType, uint256 commissionBps);
    event CommissionUpdated(bytes32 indexed keyHash, uint256 newCommissionBps);
    event ValidatorDeactivated(bytes32 indexed keyHash);

    event Staked(address indexed staker, bytes32 indexed validatorKeyHash, uint256 stakeId, uint256 amount, uint256 lockBlocks, uint256 stakeTimeEarned);
    event Unstaked(address indexed staker, bytes32 indexed validatorKeyHash, uint256 stakeId, uint256 amount, uint256 stakeTimeBurned);

    event Slashed(bytes32 indexed keyHash, uint256 totalSlashed, uint256 slashCount);

    event Checkin(bytes32 indexed keyHash, uint64 blockNumber, uint256 newScore);
    event BlockProduced(uint64 blockNumber, bytes32 indexed proposer);
    event EmissionsDistributed(uint64 epoch, uint256 totalDistributed);
    event StakerRewardDistributed(bytes32 indexed validatorKeyHash, address indexed staker, uint256 amount);
    event ValidatorRewardClaimed(bytes32 indexed keyHash, address indexed to, uint256 amount);

    event PointsSet(uint256 pointCount);
    event MaxStakersUpdated(uint256 newMax);

    // ── State ────────────────────────────────────────────────────────────────

    IERC20 public nativeToken;
    Subnet public subnet;

    // Validators
    mapping(bytes32 => Validator) public validators;
    bytes32[] public validatorKeys;

    // Staking
    uint256 public nextStakeId;
    uint256 public maxStakersPerValidator;
    uint256 public maxLockBlocks;
    uint256 public defaultCommissionBps;
    uint256 public epochLength;

    mapping(uint256 => StakePosition) public stakePositions;
    mapping(address => uint256[]) internal _userStakeIds;
    mapping(bytes32 => uint256[]) internal _validatorStakeIds;
    mapping(bytes32 => uint256) public validatorTotalStakeTime;

    // Max stakers per validator per epoch
    mapping(bytes32 => mapping(uint256 => uint256)) public validatorStakerCountPerEpoch;
    mapping(bytes32 => mapping(uint256 => mapping(address => bool))) public hasStakedInEpoch;

    uint256 public currentEpoch;

    // Slashing
    uint256 public slashBps;
    uint256 public maxSlashCount;
    address public slashTreasury;
    mapping(bytes32 => uint256) public validatorSlashed;
    mapping(bytes32 => uint256) public validatorSlashCount;

    // Consensus
    mapping(bytes32 => ValidatorScore) public scores;
    mapping(bytes32 => uint256) public validatorBalances;
    mapping(address => uint256) public stakerRewards;
    uint64 public currentBlock;
    uint64 public lastEmissionBlock;
    uint256 public totalBlocktime;
    uint256 public emissionRate;
    uint256 public decayBps;

    // Multiplier curve
    Point[] public points;

    // ── Constructor ──────────────────────────────────────────────────────────

    constructor(
        address _nativeToken,
        address _subnet,
        uint256 _maxLockBlocks,
        uint256 _maxStakersPerValidator,
        uint256 _defaultCommissionBps,
        uint64  _epochLength,
        uint256 _emissionRate,
        uint256 _decayBps
    ) ERC20("StakeTime", "STT") {
        require(_defaultCommissionBps <= 5000, "commission max 50%");
        require(_decayBps < 10000, "decay must be < 100%");

        nativeToken = IERC20(_nativeToken);
        subnet = Subnet(_subnet);
        maxLockBlocks = _maxLockBlocks;
        maxStakersPerValidator = _maxStakersPerValidator;
        defaultCommissionBps = _defaultCommissionBps;
        epochLength = _epochLength;
        emissionRate = _emissionRate;
        decayBps = _decayBps;

        points.push(Point({ blocks: 0, multiplier: 10000 }));
    }

    // ── Validator Registration ───────────────────────────────────────────────

    function registerValidator(string calldata key, KeyType keyType) external {
        bytes32 kh = keccak256(abi.encodePacked(key));
        require(!validators[kh].active, "already registered");

        validators[kh] = Validator({
            key: key,
            keyType: keyType,
            registeredBlock: uint64(block.number),
            commissionBps: defaultCommissionBps,
            active: true
        });
        validatorKeys.push(kh);

        emit ValidatorRegistered(kh, key, uint8(keyType), defaultCommissionBps);
    }

    function registerValidatorAdmin(
        string calldata key,
        KeyType keyType,
        uint256 commissionBps
    ) external onlyOwner {
        require(commissionBps <= 5000, "commission max 50%");
        bytes32 kh = keccak256(abi.encodePacked(key));
        require(!validators[kh].active, "already registered");

        validators[kh] = Validator({
            key: key,
            keyType: keyType,
            registeredBlock: uint64(block.number),
            commissionBps: commissionBps,
            active: true
        });
        validatorKeys.push(kh);

        emit ValidatorRegistered(kh, key, uint8(keyType), commissionBps);
    }

    function setValidatorCommission(string calldata key, uint256 newCommissionBps) external {
        require(newCommissionBps <= 5000, "commission max 50%");
        bytes32 kh = keccak256(abi.encodePacked(key));
        Validator storage v = validators[kh];
        require(v.active, "not registered");

        if (v.keyType == KeyType.Ecdsa) {
            require(
                keccak256(abi.encodePacked(_addressToString(msg.sender))) ==
                keccak256(abi.encodePacked(_toLower(v.key))),
                "sender mismatch"
            );
        } else {
            require(msg.sender == owner(), "only owner for non-ECDSA");
        }

        v.commissionBps = newCommissionBps;
        emit CommissionUpdated(kh, newCommissionBps);
    }

    function deactivateValidator(string calldata key) external onlyOwner {
        bytes32 kh = keccak256(abi.encodePacked(key));
        validators[kh].active = false;
        emit ValidatorDeactivated(kh);
    }

    // ── Consensus: Checkin ───────────────────────────────────────────────────

    function checkin(string calldata key) external {
        bytes32 kh = keccak256(abi.encodePacked(key));
        require(validators[kh].active, "not registered");

        Validator storage v = validators[kh];
        if (v.keyType == KeyType.Ecdsa) {
            require(
                keccak256(abi.encodePacked(_addressToString(msg.sender))) ==
                keccak256(abi.encodePacked(_toLower(v.key))),
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
            if (validators[kh].active) {
                _applyCheckin(kh);
            }
        }
    }

    // ── Consensus: Block Production ──────────────────────────────────────────

    function produceBlock() external returns (bytes32 proposer) {
        require(totalBlocktime > 0, "no active validators");

        currentBlock++;
        proposer = _selectProposer();

        if (currentBlock - lastEmissionBlock >= epochLength) {
            _distribute();
        }

        emit BlockProduced(currentBlock, proposer);
    }

    function distributeEmissions() external {
        require(
            currentBlock - lastEmissionBlock >= epochLength,
            "epoch not reached"
        );
        _distribute();
    }

    // ── Consensus: Reward Claims ─────────────────────────────────────────────

    function claimStakerRewards() external nonReentrant {
        uint256 amount = stakerRewards[msg.sender];
        require(amount > 0, "nothing to claim");
        stakerRewards[msg.sender] = 0;
        IERC20(address(subnet)).safeTransfer(msg.sender, amount);
    }

    function claimValidatorRewards(string calldata key, address to) external {
        bytes32 kh = keccak256(abi.encodePacked(key));
        require(validators[kh].active, "not registered");

        Validator storage v = validators[kh];
        if (v.keyType == KeyType.Ecdsa) {
            require(
                keccak256(abi.encodePacked(_addressToString(msg.sender))) ==
                keccak256(abi.encodePacked(_toLower(v.key))),
                "sender mismatch"
            );
        } else {
            require(msg.sender == owner(), "only owner for non-ECDSA");
        }

        uint256 amount = validatorBalances[kh];
        require(amount > 0, "nothing to claim");
        validatorBalances[kh] = 0;

        IERC20(address(subnet)).safeTransfer(to, amount);
        emit ValidatorRewardClaimed(kh, to, amount);
    }

    // ── Epoch (backward compat for external consensus modules) ─────────────

    function advanceEpoch() external onlyOwner {
        currentEpoch++;
    }

    // ── Slashing ─────────────────────────────────────────────────────────────

    function slashValidator(string calldata key) external onlyOwner nonReentrant {
        bytes32 kh = keccak256(abi.encodePacked(key));
        require(validators[kh].active, "validator not active");
        require(slashBps > 0, "slashing not configured");

        uint256[] memory stakeIds = _validatorStakeIds[kh];
        uint256 totalSlashedAmount = 0;

        for (uint256 i = 0; i < stakeIds.length; i++) {
            StakePosition storage pos = stakePositions[stakeIds[i]];
            if (pos.amount == 0) continue;

            uint256 penalty = (pos.amount * slashBps) / 10000;
            uint256 sttPenalty = (pos.stakeTimeBalance * slashBps) / 10000;

            pos.amount -= penalty;
            pos.stakeTimeBalance -= sttPenalty;
            validatorTotalStakeTime[kh] -= sttPenalty;
            _burn(pos.staker, sttPenalty);

            totalSlashedAmount += penalty;
        }

        validatorSlashed[kh] += totalSlashedAmount;
        validatorSlashCount[kh]++;

        if (totalSlashedAmount > 0 && slashTreasury != address(0)) {
            nativeToken.safeTransfer(slashTreasury, totalSlashedAmount);
        }

        if (maxSlashCount > 0 && validatorSlashCount[kh] >= maxSlashCount) {
            validators[kh].active = false;
            emit ValidatorDeactivated(kh);
        }

        emit Slashed(kh, totalSlashedAmount, validatorSlashCount[kh]);
    }

    // ── Staking ──────────────────────────────────────────────────────────────

    function stakeOn(
        string calldata validatorKey,
        uint256 amount,
        uint256 lockBlocks
    ) external nonReentrant {
        require(amount > 0, "amount must be > 0");
        require(lockBlocks <= maxLockBlocks, "exceeds max lock blocks");

        bytes32 kh = keccak256(abi.encodePacked(validatorKey));
        Validator storage v = validators[kh];
        require(v.active, "validator not active");

        if (!hasStakedInEpoch[kh][currentEpoch][msg.sender]) {
            validatorStakerCountPerEpoch[kh][currentEpoch]++;
            require(
                validatorStakerCountPerEpoch[kh][currentEpoch] <= maxStakersPerValidator,
                "max stakers reached for this validator this epoch"
            );
            hasStakedInEpoch[kh][currentEpoch][msg.sender] = true;
        }

        nativeToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 multiplier = getMultiplier(lockBlocks);
        uint256 sttAmount = (amount * multiplier) / 10000;

        uint256 stakeId = nextStakeId++;
        stakePositions[stakeId] = StakePosition({
            stakeId: stakeId,
            staker: msg.sender,
            validatorKeyHash: kh,
            amount: amount,
            startBlock: block.number,
            lockBlocks: lockBlocks,
            stakeTimeBalance: sttAmount
        });

        _userStakeIds[msg.sender].push(stakeId);
        _validatorStakeIds[kh].push(stakeId);
        validatorTotalStakeTime[kh] += sttAmount;

        _mint(msg.sender, sttAmount);

        emit Staked(msg.sender, kh, stakeId, amount, lockBlocks, sttAmount);
    }

    function unstakeFrom(uint256 stakeId) external nonReentrant {
        StakePosition storage pos = stakePositions[stakeId];
        require(pos.staker == msg.sender, "not your stake");
        require(pos.amount > 0, "no active stake");
        require(block.number >= pos.startBlock + pos.lockBlocks, "still locked");

        bytes32 kh = pos.validatorKeyHash;
        uint256 amount = pos.amount;
        uint256 sttAmount = pos.stakeTimeBalance;

        validatorTotalStakeTime[kh] -= sttAmount;
        _burn(msg.sender, sttAmount);

        _removeFromArray(_userStakeIds[msg.sender], stakeId);
        _removeFromArray(_validatorStakeIds[kh], stakeId);

        delete stakePositions[stakeId];

        nativeToken.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, kh, stakeId, amount, sttAmount);
    }

    // ── Multiplier Curve ─────────────────────────────────────────────────────

    function setPoints(Point[] calldata _points) external onlyOwner {
        require(_points.length > 0, "must provide at least one point");

        for (uint256 i = 0; i < _points.length; i++) {
            require(_points[i].multiplier >= 10000, "multiplier must be >= 1x");
            require(_points[i].blocks <= maxLockBlocks, "exceeds max blocks");
            if (i > 0) {
                require(_points[i].blocks > _points[i-1].blocks, "blocks must increase");
                require(_points[i].multiplier >= _points[i-1].multiplier, "multiplier must not decrease");
            }
        }

        delete points;
        for (uint256 i = 0; i < _points.length; i++) {
            points.push(_points[i]);
        }
        emit PointsSet(_points.length);
    }

    function getMultiplier(uint256 blockCount) public view returns (uint256) {
        if (points.length == 0) return 10000;
        if (blockCount <= points[0].blocks) return points[0].multiplier;
        if (blockCount >= points[points.length - 1].blocks) return points[points.length - 1].multiplier;

        for (uint256 i = 0; i < points.length - 1; i++) {
            if (blockCount >= points[i].blocks && blockCount <= points[i + 1].blocks) {
                return _interpolate(
                    points[i].blocks, points[i].multiplier,
                    points[i + 1].blocks, points[i + 1].multiplier,
                    blockCount
                );
            }
        }
        return points[points.length - 1].multiplier;
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    function setMaxStakersPerValidator(uint256 _max) external onlyOwner {
        maxStakersPerValidator = _max;
        emit MaxStakersUpdated(_max);
    }

    function setMaxLockBlocks(uint256 _max) external onlyOwner {
        maxLockBlocks = _max;
    }

    function setDefaultCommissionBps(uint256 bps) external onlyOwner {
        require(bps <= 5000, "max 50%");
        defaultCommissionBps = bps;
    }

    function setEmissionRate(uint256 rate) external onlyOwner {
        emissionRate = rate;
    }

    function setDecayBps(uint256 bps) external onlyOwner {
        require(bps < 10000, "decay must be < 100%");
        decayBps = bps;
    }

    function setSlashBps(uint256 bps) external onlyOwner {
        require(bps <= 5000, "max 50%");
        slashBps = bps;
    }

    function setSlashTreasury(address treasury) external onlyOwner {
        slashTreasury = treasury;
    }

    function setMaxSlashCount(uint256 count) external onlyOwner {
        maxSlashCount = count;
    }

    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    // ── Views ────────────────────────────────────────────────────────────────

    function getValidator(string calldata key) external view returns (
        string memory _key, uint8 _keyType, uint64 _registeredBlock,
        uint256 _commissionBps, bool _active
    ) {
        bytes32 kh = keccak256(abi.encodePacked(key));
        Validator storage v = validators[kh];
        return (v.key, uint8(v.keyType), v.registeredBlock, v.commissionBps, v.active);
    }

    function getValidatorByHash(bytes32 kh) external view returns (
        string memory _key, uint8 _keyType, uint64 _registeredBlock,
        uint256 _commissionBps, bool _active
    ) {
        Validator storage v = validators[kh];
        return (v.key, uint8(v.keyType), v.registeredBlock, v.commissionBps, v.active);
    }

    function validatorCount() external view returns (uint256) {
        return validatorKeys.length;
    }

    function getValidatorKeyHash(uint256 index) external view returns (bytes32) {
        return validatorKeys[index];
    }

    function isValidatorActive(bytes32 kh) external view returns (bool) {
        return validators[kh].active;
    }

    function getValidatorCommission(bytes32 kh) external view returns (uint256) {
        return validators[kh].commissionBps;
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

    function getConsensusState() external view returns (
        uint64 _currentBlock, uint64 _lastEmissionBlock,
        uint256 _totalBlocktime, uint256 _emissionRate, uint256 _epochLength
    ) {
        return (currentBlock, lastEmissionBlock, totalBlocktime, emissionRate, epochLength);
    }

    function getUserStakeIds(address user) external view returns (uint256[] memory) {
        return _userStakeIds[user];
    }

    function getValidatorStakeIds(string calldata key) external view returns (uint256[] memory) {
        return _validatorStakeIds[keccak256(abi.encodePacked(key))];
    }

    function getValidatorStakeIdsByHash(bytes32 kh) external view returns (uint256[] memory) {
        return _validatorStakeIds[kh];
    }

    function getStakePosition(uint256 stakeId) external view returns (
        address staker, bytes32 validatorKeyHash, uint256 amount,
        uint256 startBlock, uint256 lockBlocks, uint256 stakeTimeBalance,
        uint256 blocksRemaining
    ) {
        StakePosition storage pos = stakePositions[stakeId];
        uint256 elapsed = block.number > pos.startBlock ? block.number - pos.startBlock : 0;
        uint256 remaining = pos.lockBlocks > elapsed ? pos.lockBlocks - elapsed : 0;
        return (pos.staker, pos.validatorKeyHash, pos.amount, pos.startBlock,
                pos.lockBlocks, pos.stakeTimeBalance, remaining);
    }

    function getValidatorTotalStakeTime(string calldata key) external view returns (uint256) {
        return validatorTotalStakeTime[keccak256(abi.encodePacked(key))];
    }

    function getValidatorTotalStakeTimeByHash(bytes32 kh) external view returns (uint256) {
        return validatorTotalStakeTime[kh];
    }

    function getLeaderboard(uint256 limit) external view returns (
        bytes32[] memory keys, uint256[] memory topScores
    ) {
        uint256 len = validatorKeys.length;
        if (limit > len) limit = len;

        bytes32[] memory allKeys = new bytes32[](len);
        uint256[] memory allScores = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            allKeys[i] = validatorKeys[i];
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

    // ── Internal: Consensus ──────────────────────────────────────────────────

    function _applyCheckin(bytes32 kh) internal {
        ValidatorScore storage s = scores[kh];
        uint64 bn = uint64(block.number);
        uint64 delta = s.lastSeenBlock == 0 ? 1 : bn - s.lastSeenBlock;
        if (delta > epochLength) delta = uint64(epochLength);

        s.blocktimeScore = _decay(s.blocktimeScore) + delta;
        s.lastSeenBlock = bn;

        _recalcTotal();
        emit Checkin(kh, bn, s.blocktimeScore);
    }

    function _selectProposer() internal view returns (bytes32 proposer) {
        uint256 rand = uint256(keccak256(abi.encodePacked(
            block.prevrandao, currentBlock, block.timestamp
        )));
        uint256 target = rand % totalBlocktime;

        uint256 len = validatorKeys.length;
        uint256 cumulative = 0;
        for (uint256 i = 0; i < len; i++) {
            bytes32 kh = validatorKeys[i];
            if (!validators[kh].active) continue;
            uint256 score = scores[kh].blocktimeScore;
            if (score == 0) continue;

            cumulative += score;
            if (cumulative > target) {
                proposer = kh;
                break;
            }
        }
    }

    function _distribute() internal {
        if (totalBlocktime == 0) return;

        uint256 totalDistributed = 0;
        uint256 len = validatorKeys.length;

        for (uint256 i = 0; i < len; i++) {
            bytes32 kh = validatorKeys[i];
            if (!validators[kh].active) continue;

            ValidatorScore storage s = scores[kh];
            if (s.blocktimeScore == 0) continue;

            uint256 validatorShare = (emissionRate * s.blocktimeScore) / totalBlocktime;
            totalDistributed += _distributeValidatorShare(kh, validatorShare);

            s.blocktimeScore = _decay(s.blocktimeScore);
        }

        lastEmissionBlock = currentBlock;
        currentEpoch++;
        _recalcTotal();

        emit EmissionsDistributed(currentBlock, totalDistributed);
    }

    function _distributeValidatorShare(bytes32 kh, uint256 validatorShare) internal returns (uint256) {
        subnet.mint(address(this), validatorShare);

        ValidatorScore storage s = scores[kh];
        uint256 totalSTT = validatorTotalStakeTime[kh];
        uint256 commissionBps = validators[kh].commissionBps;

        if (totalSTT == 0) {
            validatorBalances[kh] += validatorShare;
            s.earned += validatorShare;
        } else {
            uint256 commission = (validatorShare * commissionBps) / 10000;
            uint256 stakerPool = validatorShare - commission;

            validatorBalances[kh] += commission;
            s.earned += commission;

            uint256[] memory stakeIds = _validatorStakeIds[kh];
            uint256 distributed = 0;

            for (uint256 j = 0; j < stakeIds.length; j++) {
                StakePosition storage pos = stakePositions[stakeIds[j]];
                if (pos.amount == 0) continue;

                uint256 reward = (stakerPool * pos.stakeTimeBalance) / totalSTT;
                stakerRewards[pos.staker] += reward;
                distributed += reward;

                emit StakerRewardDistributed(kh, pos.staker, reward);
            }

            if (stakerPool > distributed) {
                validatorBalances[kh] += stakerPool - distributed;
                s.earned += stakerPool - distributed;
            }
        }

        return validatorShare;
    }

    function _decay(uint256 score) internal view returns (uint256) {
        return (score * (10000 - decayBps)) / 10000;
    }

    function _recalcTotal() internal {
        uint256 total = 0;
        uint256 len = validatorKeys.length;
        for (uint256 i = 0; i < len; i++) {
            bytes32 kh = validatorKeys[i];
            if (validators[kh].active) {
                total += scores[kh].blocktimeScore;
            }
        }
        totalBlocktime = total;
    }

    // ── Internal: Utils ──────────────────────────────────────────────────────

    function _interpolate(uint256 x0, uint256 y0, uint256 x1, uint256 y1, uint256 x) internal pure returns (uint256) {
        if (x0 == x1) return y0;
        return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }

    function _removeFromArray(uint256[] storage arr, uint256 val) internal {
        for (uint256 i = 0; i < arr.length; i++) {
            if (arr[i] == val) {
                arr[i] = arr[arr.length - 1];
                arr.pop();
                return;
            }
        }
    }

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

    function _toLower(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] >= 0x41 && b[i] <= 0x5A) {
                b[i] = bytes1(uint8(b[i]) + 32);
            }
        }
        return string(b);
    }
}
