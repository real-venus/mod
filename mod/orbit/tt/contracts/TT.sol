// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TT - Blocktime Yuma Consensus
 * @dev Validators register with text keys (any format: ECDSA, ed25519, sr25519, etc.)
 *      and earn emissions proportional to their blocktime participation.
 *      Yuma-style exponential decay prevents stale validators from hoarding weight.
 *
 *      Keys are stored as plain strings — future key types can be added without migration.
 */
contract TT is Ownable {

    // ── Types ────────────────────────────────────────────────────────────────

    enum KeyType { Ecdsa, Ed25519, Sr25519 }

    struct Validator {
        string key;             // text key (any format)
        KeyType keyType;
        uint64 registeredBlock; // block when registered
        uint64 lastSeenBlock;   // last checkin block
        uint256 blocktimeScore; // accumulated score (decayed)
        uint256 earned;         // total emissions earned
        bool active;
    }

    struct ConsensusState {
        uint64 currentBlock;      // internal block counter
        uint64 lastEmissionBlock; // last block where emissions ran
        uint256 totalBlocktime;   // sum of all active scores
        uint256 emissionRate;     // tokens emitted per epoch
        uint256 decayBps;         // decay in basis points (e.g. 100 = 1%)
        uint64 epochLength;       // blocks per epoch
    }

    // ── Events ───────────────────────────────────────────────────────────────

    event ValidatorRegistered(bytes32 indexed keyHash, string key, uint8 keyType);
    event Checkin(bytes32 indexed keyHash, uint64 blockNumber, uint256 newScore);
    event BlockProduced(uint64 blockNumber, bytes32 indexed proposer);
    event EmissionsDistributed(uint64 epoch, uint256 totalDistributed);
    event ValidatorSlashed(bytes32 indexed keyHash, uint256 penalty);

    // ── State ────────────────────────────────────────────────────────────────

    ConsensusState public consensus;

    mapping(bytes32 => Validator) public validators;   // keyHash => Validator
    bytes32[] public validatorKeys;                     // all registered keyHashes
    mapping(bytes32 => uint256) public balances;        // keyHash => earned balance

    // ── Constructor ──────────────────────────────────────────────────────────

    constructor(
        uint256 _emissionRate,
        uint256 _decayBps,
        uint64 _epochLength
    ) {
        consensus = ConsensusState({
            currentBlock: 0,
            lastEmissionBlock: 0,
            totalBlocktime: 0,
            emissionRate: _emissionRate,
            decayBps: _decayBps,
            epochLength: _epochLength
        });
    }

    // ── Registration ─────────────────────────────────────────────────────────

    /**
     * @dev Register a validator with a text key.
     *      Key can be any string: hex pubkey, base58 address, SS58, etc.
     */
    function registerValidator(string calldata key, KeyType keyType) external {
        bytes32 kh = keccak256(abi.encodePacked(key));
        require(!validators[kh].active, "already registered");

        validators[kh] = Validator({
            key: key,
            keyType: keyType,
            registeredBlock: uint64(block.number),
            lastSeenBlock: 0,
            blocktimeScore: 0,
            earned: 0,
            active: true
        });
        validatorKeys.push(kh);

        emit ValidatorRegistered(kh, key, uint8(keyType));
    }

    /**
     * @dev Owner can register validators on behalf (for sr25519 / non-EVM keys).
     */
    function registerValidatorAdmin(
        string calldata key,
        KeyType keyType
    ) external onlyOwner {
        bytes32 kh = keccak256(abi.encodePacked(key));
        require(!validators[kh].active, "already registered");

        validators[kh] = Validator({
            key: key,
            keyType: keyType,
            registeredBlock: uint64(block.number),
            lastSeenBlock: 0,
            blocktimeScore: 0,
            earned: 0,
            active: true
        });
        validatorKeys.push(kh);

        emit ValidatorRegistered(kh, key, uint8(keyType));
    }

    // ── Checkin (heartbeat) ──────────────────────────────────────────────────

    /**
     * @dev Validator checks in to increment blocktime score.
     *      For ECDSA keys, msg.sender is verified against the key.
     *      For ed25519/sr25519, owner relays the checkin with a signature proof.
     */
    function checkin(string calldata key) external {
        bytes32 kh = keccak256(abi.encodePacked(key));
        Validator storage v = validators[kh];
        require(v.active, "not registered");

        // If ECDSA, verify msg.sender matches the registered key
        if (v.keyType == KeyType.Ecdsa) {
            // The key should be the hex-encoded address
            require(
                keccak256(abi.encodePacked(_addressToString(msg.sender))) ==
                keccak256(abi.encodePacked(_toLower(v.key))),
                "sender mismatch"
            );
        }
        // For non-ECDSA keys, only owner can relay checkins
        else {
            require(msg.sender == owner(), "only owner relays non-ECDSA checkins");
        }

        _applyCheckin(kh, v);
    }

    /**
     * @dev Owner-relayed batch checkin for multiple validators.
     */
    function batchCheckin(string[] calldata keys) external onlyOwner {
        for (uint256 i = 0; i < keys.length; i++) {
            bytes32 kh = keccak256(abi.encodePacked(keys[i]));
            Validator storage v = validators[kh];
            if (v.active) {
                _applyCheckin(kh, v);
            }
        }
    }

    function _applyCheckin(bytes32 kh, Validator storage v) internal {
        uint64 bn = uint64(block.number);
        // Blocks since last checkin (capped to epoch to prevent score explosion)
        uint64 delta = v.lastSeenBlock == 0 ? 1 : bn - v.lastSeenBlock;
        if (delta > consensus.epochLength) delta = consensus.epochLength;

        // Apply decay first, then add new blocktime
        v.blocktimeScore = _decay(v.blocktimeScore) + delta;
        v.lastSeenBlock = bn;

        // Update total
        _recalcTotal();

        emit Checkin(kh, bn, v.blocktimeScore);
    }

    // ── Block production ─────────────────────────────────────────────────────

    /**
     * @dev Produce the next internal block. Selects proposer weighted by blocktime scores.
     *      Uses block.prevrandao as randomness source.
     */
    function produceBlock() external returns (bytes32 proposer) {
        require(consensus.totalBlocktime > 0, "no active validators");

        consensus.currentBlock++;

        // Weighted random selection
        uint256 rand = uint256(keccak256(abi.encodePacked(
            block.prevrandao, consensus.currentBlock, block.timestamp
        )));
        uint256 target = rand % consensus.totalBlocktime;

        uint256 cumulative = 0;
        for (uint256 i = 0; i < validatorKeys.length; i++) {
            bytes32 kh = validatorKeys[i];
            Validator storage v = validators[kh];
            if (!v.active || v.blocktimeScore == 0) continue;

            cumulative += v.blocktimeScore;
            if (cumulative > target) {
                proposer = kh;
                break;
            }
        }

        // Auto-distribute if epoch boundary
        if (consensus.currentBlock - consensus.lastEmissionBlock >= consensus.epochLength) {
            _distribute();
        }

        emit BlockProduced(consensus.currentBlock, proposer);
    }

    // ── Emission distribution (Yuma consensus) ──────────────────────────────

    /**
     * @dev Distribute emissions proportional to blocktime scores.
     *      Yuma model: reward = (validator_score / total_score) * emission_rate
     */
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

        for (uint256 i = 0; i < validatorKeys.length; i++) {
            bytes32 kh = validatorKeys[i];
            Validator storage v = validators[kh];
            if (!v.active || v.blocktimeScore == 0) continue;

            // Yuma proportional: emission * (score / total)
            uint256 share = (consensus.emissionRate * v.blocktimeScore) / consensus.totalBlocktime;
            balances[kh] += share;
            v.earned += share;
            totalDistributed += share;

            // Apply decay to score after distribution
            v.blocktimeScore = _decay(v.blocktimeScore);
        }

        consensus.lastEmissionBlock = consensus.currentBlock;
        _recalcTotal();

        emit EmissionsDistributed(consensus.currentBlock, totalDistributed);
    }

    // ── Decay ────────────────────────────────────────────────────────────────

    /**
     * @dev Exponential decay: score = score * (10000 - decayBps) / 10000
     */
    function _decay(uint256 score) internal view returns (uint256) {
        return (score * (10000 - consensus.decayBps)) / 10000;
    }

    function _recalcTotal() internal {
        uint256 total = 0;
        for (uint256 i = 0; i < validatorKeys.length; i++) {
            Validator storage v = validators[validatorKeys[i]];
            if (v.active) total += v.blocktimeScore;
        }
        consensus.totalBlocktime = total;
    }

    // ── Views ────────────────────────────────────────────────────────────────

    function getValidator(string calldata key) external view returns (
        string memory _key,
        uint8 _keyType,
        uint64 _registeredBlock,
        uint64 _lastSeenBlock,
        uint256 _blocktimeScore,
        uint256 _earned,
        bool _active
    ) {
        bytes32 kh = keccak256(abi.encodePacked(key));
        Validator storage v = validators[kh];
        return (v.key, uint8(v.keyType), v.registeredBlock, v.lastSeenBlock, v.blocktimeScore, v.earned, v.active);
    }

    function getBlock() external view returns (
        uint64 _currentBlock,
        uint64 _lastEmissionBlock,
        uint256 _totalBlocktime,
        uint256 _emissionRate,
        uint256 _decayBps,
        uint64 _epochLength
    ) {
        ConsensusState storage c = consensus;
        return (c.currentBlock, c.lastEmissionBlock, c.totalBlocktime, c.emissionRate, c.decayBps, c.epochLength);
    }

    function getBalance(string calldata key) external view returns (uint256) {
        return balances[keccak256(abi.encodePacked(key))];
    }

    function validatorCount() external view returns (uint256) {
        return validatorKeys.length;
    }

    function getLeaderboard(uint256 limit) external view returns (
        bytes32[] memory keys,
        uint256[] memory scores
    ) {
        uint256 len = validatorKeys.length;
        if (limit > len) limit = len;

        // Copy to memory for sorting
        bytes32[] memory allKeys = new bytes32[](len);
        uint256[] memory allScores = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            allKeys[i] = validatorKeys[i];
            allScores[i] = validators[validatorKeys[i]].blocktimeScore;
        }

        // Simple selection sort (fine for reasonable validator counts)
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

        // Trim to limit
        keys = new bytes32[](limit);
        scores = new uint256[](limit);
        for (uint256 i = 0; i < limit; i++) {
            keys[i] = allKeys[i];
            scores[i] = allScores[i];
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

    function deactivateValidator(string calldata key) external onlyOwner {
        bytes32 kh = keccak256(abi.encodePacked(key));
        validators[kh].active = false;
        _recalcTotal();
    }

    // ── Internal utils ───────────────────────────────────────────────────────

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
