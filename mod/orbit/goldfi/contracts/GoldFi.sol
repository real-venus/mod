// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GoldFi
 * @notice Quadratic reward trading competition for precious metals (gold, silver, +more).
 *         Tracks trader PnL, distributes inflation pool using x^2 / -x^2 curve. Weekly epochs.
 *         Designed for Uniswap-traded assets (PAXG, etc.) with oracle-reported PnL.
 */
contract GoldFi is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    // ── Structs ─────────────────────────────────────────────────────

    struct Asset {
        string symbol;       // e.g. "PAXG", "SLV"
        address token;       // ERC20 address on this chain
        address pairToken;   // quote token (USDC)
        bool active;
    }

    struct Trader {
        address addr;
        int256 pnlBps;       // PnL in basis points reported by oracle (e.g. +2000 = +20%)
        int256 score;         // quadratic score: sign(pnl) * pnl^2
        uint256 reward;       // computed reward from inflation pool
        bool claimed;
        bool registered;
    }

    struct Epoch {
        uint256 epochId;
        uint256 startTime;
        uint256 endTime;
        uint256 inflationPool;  // total tokens to distribute
        bool settled;
        uint256 totalPositiveScore;
        uint256 traderCount;
    }

    // ── State ───────────────────────────────────────────────────────

    IERC20 public immutable rewardToken;    // token used for inflation pool (e.g. USDC)
    address public oracle;                   // authorized PnL reporter
    uint256 public epochDuration;            // default: 7 days
    uint256 public epochCounter;
    uint256 public platformFeeBps;           // basis points, max 500 (5%)
    uint256 public accumulatedFees;

    // Assets
    uint256 public assetCount;
    mapping(uint256 => Asset) public assets;
    mapping(string => uint256) public assetBySymbol;

    // Epochs
    mapping(uint256 => Epoch) public epochs;
    uint256 public currentEpochId;

    // Traders: epochId => trader address => Trader
    mapping(uint256 => mapping(address => Trader)) public traders;
    // epochId => list of trader addresses
    mapping(uint256 => address[]) public epochTraders;
    // Persistent registry (survives epoch resets)
    mapping(address => bool) public registeredTraders;
    address[] public traderList;

    // ── Events ──────────────────────────────────────────────────────

    event AssetAdded(uint256 indexed assetId, string symbol, address token);
    event AssetToggled(uint256 indexed assetId, bool active);
    event TraderRegistered(address indexed trader);
    event TraderUnregistered(address indexed trader);
    event EpochStarted(uint256 indexed epochId, uint256 startTime, uint256 endTime, uint256 inflationPool);
    event PnlReported(uint256 indexed epochId, address indexed trader, int256 pnlBps);
    event EpochSettled(uint256 indexed epochId, uint256 totalDistributed);
    event RewardClaimed(uint256 indexed epochId, address indexed trader, uint256 amount);
    event OracleUpdated(address indexed newOracle);

    // ── Constructor ─────────────────────────────────────────────────

    constructor(
        address _rewardToken,
        address _oracle,
        uint256 _epochDuration,
        uint256 _platformFeeBps
    ) {
        require(_rewardToken != address(0), "Invalid reward token");
        require(_oracle != address(0), "Invalid oracle");
        require(_platformFeeBps <= 500, "Fee too high");

        rewardToken = IERC20(_rewardToken);
        oracle = _oracle;
        epochDuration = _epochDuration > 0 ? _epochDuration : 7 days;
        platformFeeBps = _platformFeeBps;
    }

    // ── Asset Management ────────────────────────────────────────────

    function addAsset(string calldata symbol, address token, address pairToken) external onlyOwner {
        require(bytes(symbol).length > 0, "Empty symbol");
        require(token != address(0), "Invalid token");
        require(assetBySymbol[symbol] == 0, "Asset exists");

        assetCount++;
        assets[assetCount] = Asset({
            symbol: symbol,
            token: token,
            pairToken: pairToken,
            active: true
        });
        assetBySymbol[symbol] = assetCount;

        emit AssetAdded(assetCount, symbol, token);
    }

    function toggleAsset(uint256 assetId, bool active) external onlyOwner {
        require(assetId > 0 && assetId <= assetCount, "Invalid asset");
        assets[assetId].active = active;
        emit AssetToggled(assetId, active);
    }

    // ── Trader Registration ─────────────────────────────────────────

    function register() external whenNotPaused {
        require(!registeredTraders[msg.sender], "Already registered");
        registeredTraders[msg.sender] = true;
        traderList.push(msg.sender);
        emit TraderRegistered(msg.sender);
    }

    function unregister() external {
        require(registeredTraders[msg.sender], "Not registered");
        // Can't unregister during active unsettled epoch if you have reported PnL
        if (currentEpochId > 0 && !epochs[currentEpochId].settled) {
            require(!traders[currentEpochId][msg.sender].registered, "Epoch active");
        }
        registeredTraders[msg.sender] = false;
        emit TraderUnregistered(msg.sender);
    }

    // ── Epoch Lifecycle ─────────────────────────────────────────────

    function startEpoch(uint256 inflationPool) external onlyOwner whenNotPaused {
        // If there's a current epoch, it must be settled
        if (currentEpochId > 0) {
            require(epochs[currentEpochId].settled, "Previous epoch not settled");
        }

        // Transfer inflation pool from owner
        require(inflationPool > 0, "Zero pool");
        rewardToken.safeTransferFrom(msg.sender, address(this), inflationPool);

        epochCounter++;
        currentEpochId = epochCounter;

        uint256 start = block.timestamp;
        uint256 end = start + epochDuration;

        epochs[currentEpochId] = Epoch({
            epochId: currentEpochId,
            startTime: start,
            endTime: end,
            inflationPool: inflationPool,
            settled: false,
            totalPositiveScore: 0,
            traderCount: 0
        });

        // Enroll all registered traders
        for (uint256 i = 0; i < traderList.length; i++) {
            address addr = traderList[i];
            if (registeredTraders[addr]) {
                traders[currentEpochId][addr] = Trader({
                    addr: addr,
                    pnlBps: 0,
                    score: 0,
                    reward: 0,
                    claimed: false,
                    registered: true
                });
                epochTraders[currentEpochId].push(addr);
                epochs[currentEpochId].traderCount++;
            }
        }

        emit EpochStarted(currentEpochId, start, end, inflationPool);
    }

    /**
     * @notice Oracle reports PnL for a trader in basis points.
     *         e.g. +2000 = +20%, -500 = -5%
     *         Can be called multiple times (updates overwrite).
     */
    function reportPnl(
        uint256 epochId,
        address trader,
        int256 pnlBps
    ) external {
        require(msg.sender == oracle, "Not oracle");
        require(epochId == currentEpochId, "Not current epoch");
        require(!epochs[epochId].settled, "Epoch settled");
        require(traders[epochId][trader].registered, "Trader not enrolled");

        traders[epochId][trader].pnlBps = pnlBps;

        emit PnlReported(epochId, trader, pnlBps);
    }

    /**
     * @notice Batch report PnL for multiple traders
     */
    function reportPnlBatch(
        uint256 epochId,
        address[] calldata traderAddrs,
        int256[] calldata pnlValues
    ) external {
        require(msg.sender == oracle, "Not oracle");
        require(traderAddrs.length == pnlValues.length, "Length mismatch");
        require(epochId == currentEpochId, "Not current epoch");
        require(!epochs[epochId].settled, "Epoch settled");

        for (uint256 i = 0; i < traderAddrs.length; i++) {
            if (traders[epochId][traderAddrs[i]].registered) {
                traders[epochId][traderAddrs[i]].pnlBps = pnlValues[i];
                emit PnlReported(epochId, traderAddrs[i], pnlValues[i]);
            }
        }
    }

    /**
     * @notice Settle the epoch: compute quadratic scores and distribute rewards.
     *         score = pnl >= 0 ? pnl^2 : -(pnl^2)
     *         Only positive scores share the inflation pool.
     */
    function settleEpoch(uint256 epochId) external nonReentrant {
        require(msg.sender == oracle || msg.sender == owner(), "Not authorized");
        Epoch storage epoch = epochs[epochId];
        require(!epoch.settled, "Already settled");
        require(block.timestamp >= epoch.endTime, "Epoch not ended");

        address[] storage traderAddrs = epochTraders[epochId];
        uint256 totalPositive = 0;

        // Phase 1: compute quadratic scores
        for (uint256 i = 0; i < traderAddrs.length; i++) {
            Trader storage t = traders[epochId][traderAddrs[i]];
            int256 pnl = t.pnlBps;

            if (pnl >= 0) {
                // x^2 (positive direction)
                t.score = pnl * pnl;
                totalPositive += uint256(t.score);
            } else {
                // -(x^2) (negative direction)
                t.score = -(pnl * pnl);
                // negative scores don't contribute to pool
            }
        }

        epoch.totalPositiveScore = totalPositive;

        // Phase 2: compute rewards
        uint256 feeAmount = (epoch.inflationPool * platformFeeBps) / 10000;
        accumulatedFees += feeAmount;
        uint256 rewardPool = epoch.inflationPool - feeAmount;
        uint256 totalDistributed = 0;

        for (uint256 i = 0; i < traderAddrs.length; i++) {
            Trader storage t = traders[epochId][traderAddrs[i]];
            if (t.score > 0 && totalPositive > 0) {
                t.reward = (rewardPool * uint256(t.score)) / totalPositive;
                totalDistributed += t.reward;
            }
        }

        epoch.settled = true;
        emit EpochSettled(epochId, totalDistributed);
    }

    /**
     * @notice Claim reward for a settled epoch
     */
    function claimReward(uint256 epochId) external nonReentrant {
        require(epochs[epochId].settled, "Not settled");
        Trader storage t = traders[epochId][msg.sender];
        require(t.registered, "Not enrolled");
        require(!t.claimed, "Already claimed");
        require(t.reward > 0, "No reward");

        t.claimed = true;
        rewardToken.safeTransfer(msg.sender, t.reward);

        emit RewardClaimed(epochId, msg.sender, t.reward);
    }

    // ── View Functions ──────────────────────────────────────────────

    function getEpochTraders(uint256 epochId) external view returns (address[] memory) {
        return epochTraders[epochId];
    }

    function getTraderInfo(uint256 epochId, address trader) external view returns (
        int256 pnlBps,
        int256 score,
        uint256 reward,
        bool claimed,
        bool enrolled
    ) {
        Trader memory t = traders[epochId][trader];
        return (t.pnlBps, t.score, t.reward, t.claimed, t.registered);
    }

    function getLeaderboard(uint256 epochId) external view returns (
        address[] memory addrs,
        int256[] memory scores,
        uint256[] memory rewards
    ) {
        address[] storage list = epochTraders[epochId];
        addrs = new address[](list.length);
        scores = new int256[](list.length);
        rewards = new uint256[](list.length);

        for (uint256 i = 0; i < list.length; i++) {
            Trader memory t = traders[epochId][list[i]];
            addrs[i] = t.addr;
            scores[i] = t.score;
            rewards[i] = t.reward;
        }
    }

    function getTraderCount() external view returns (uint256) {
        return traderList.length;
    }

    function getCurrentEpoch() external view returns (
        uint256 epochId,
        uint256 startTime,
        uint256 endTime,
        uint256 inflationPool,
        bool settled,
        uint256 traderCount
    ) {
        Epoch memory e = epochs[currentEpochId];
        return (e.epochId, e.startTime, e.endTime, e.inflationPool, e.settled, e.traderCount);
    }

    // ── Admin ───────────────────────────────────────────────────────

    function setOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Invalid oracle");
        oracle = _oracle;
        emit OracleUpdated(_oracle);
    }

    function setEpochDuration(uint256 _duration) external onlyOwner {
        require(_duration >= 1 hours, "Too short");
        epochDuration = _duration;
    }

    function setPlatformFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 500, "Fee too high");
        platformFeeBps = _feeBps;
    }

    function withdrawFees() external onlyOwner {
        uint256 amount = accumulatedFees;
        accumulatedFees = 0;
        rewardToken.safeTransfer(owner(), amount);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
