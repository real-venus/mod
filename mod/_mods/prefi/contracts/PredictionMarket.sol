// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title PredictionMarket
 * @dev Epoch-based prediction market where players predict oracle prices and compete based on accuracy
 */
contract PredictionMarket is Ownable, ReentrancyGuard {
    
    struct Prediction {
        address player;
        uint256 predictedPrice;
        uint256 lockedAmount;
        uint256 timestamp;
    }
    
    struct Epoch {
        uint256 epochId;
        uint256 startTime;
        uint256 endTime;
        bool settled;
        uint256 actualPrice;
        uint256 totalLocked;
        mapping(address => Prediction) predictions;
        address[] players;
    }
    
    struct PlayerResult {
        address player;
        uint256 predictedPrice;
        uint256 lockedAmount;
        uint256 l1Distance;
        uint256 score;
        uint256 reward;
    }
    
    // State variables
    mapping(uint256 => Epoch) public epochs;
    mapping(address => bool) public approvedAssets;
    
    uint256 public currentEpochId;
    uint256 public epochDuration;
    address public priceOracle;
    address public assetAddress;
    
    // Events
    event EpochStarted(uint256 indexed epochId, uint256 startTime, uint256 endTime);
    event PredictionPlaced(uint256 indexed epochId, address indexed player, uint256 predictedPrice, uint256 lockedAmount);
    event EpochSettled(uint256 indexed epochId, uint256 actualPrice, uint256 totalRewards);
    event RewardClaimed(uint256 indexed epochId, address indexed player, uint256 reward, uint256 l1Distance);
    event AssetApproved(address indexed asset);
    
    constructor(address _priceOracle, address _assetAddress, uint256 _epochDuration) {
        priceOracle = _priceOracle;
        assetAddress = _assetAddress;
        epochDuration = _epochDuration;
        currentEpochId = 1;
        
        // Start first epoch
        _startNewEpoch();
    }
    
    /**
     * @dev Place prediction for current epoch
     */
    function placePrediction(
        uint256 _predictedPrice,
        uint256 _lockedAmount
    ) external nonReentrant {
        Epoch storage epoch = epochs[currentEpochId];
        
        require(block.timestamp < epoch.endTime, "Epoch ended");
        require(_predictedPrice > 0, "Invalid price prediction");
        require(_lockedAmount > 0, "Must lock tokens");
        require(epoch.predictions[msg.sender].player == address(0), "Already predicted");
        
        // Transfer locked tokens
        IERC20(assetAddress).transferFrom(msg.sender, address(this), _lockedAmount);
        
        // Record prediction
        epoch.predictions[msg.sender] = Prediction({
            player: msg.sender,
            predictedPrice: _predictedPrice,
            lockedAmount: _lockedAmount,
            timestamp: block.timestamp
        });
        
        epoch.players.push(msg.sender);
        epoch.totalLocked += _lockedAmount;
        
        emit PredictionPlaced(currentEpochId, msg.sender, _predictedPrice, _lockedAmount);
    }
    
    /**
     * @dev Settle epoch and calculate rewards based on L1 distance with pot distribution
     */
    function settleEpoch(uint256 _epochId) external nonReentrant {
        Epoch storage epoch = epochs[_epochId];
        
        require(block.timestamp >= epoch.endTime, "Epoch not ended");
        require(!epoch.settled, "Already settled");
        require(epoch.players.length > 0, "No predictions");
        
        // Get actual price from oracle
        uint256 actualPrice = IPriceOracle(priceOracle).getPrice(assetAddress);
        epoch.actualPrice = actualPrice;
        
        // Calculate L1 distances and scores
        PlayerResult[] memory results = new PlayerResult[](epoch.players.length);
        uint256 totalInverseDistance = 0;
        
        for (uint256 i = 0; i < epoch.players.length; i++) {
            address player = epoch.players[i];
            Prediction memory pred = epoch.predictions[player];
            
            // Calculate L1 distance: |predicted - actual|
            uint256 l1Distance = pred.predictedPrice > actualPrice 
                ? pred.predictedPrice - actualPrice 
                : actualPrice - pred.predictedPrice;
            
            // Score = lockedAmount / (1 + l1Distance)
            // Better predictions (lower distance) get higher scores
            uint256 score = (pred.lockedAmount * 1e18) / (1e18 + l1Distance);
            
            results[i] = PlayerResult({
                player: player,
                predictedPrice: pred.predictedPrice,
                lockedAmount: pred.lockedAmount,
                l1Distance: l1Distance,
                score: score,
                reward: 0
            });
            
            totalInverseDistance += score;
        }
        
        // Distribute rewards proportionally to scores from the total pot
        // The pot contains all locked tokens from all players
        uint256 totalRewards = epoch.totalLocked;
        
        for (uint256 i = 0; i < results.length; i++) {
            if (totalInverseDistance > 0) {
                // Reward = (playerScore / totalScores) × totalPot
                // This means better predictions get larger share of the pot
                results[i].reward = (results[i].score * totalRewards) / totalInverseDistance;
                
                // Transfer reward
                if (results[i].reward > 0) {
                    IERC20(assetAddress).transfer(results[i].player, results[i].reward);
                    
                    emit RewardClaimed(
                        _epochId,
                        results[i].player,
                        results[i].reward,
                        results[i].l1Distance
                    );
                }
            }
        }
        
        epoch.settled = true;
        emit EpochSettled(_epochId, actualPrice, totalRewards);
        
        // Start new epoch if this was current
        if (_epochId == currentEpochId) {
            currentEpochId++;
            _startNewEpoch();
        }
    }
    
    /**
     * @dev Start new epoch
     */
    function _startNewEpoch() internal {
        Epoch storage newEpoch = epochs[currentEpochId];
        newEpoch.epochId = currentEpochId;
        newEpoch.startTime = block.timestamp;
        newEpoch.endTime = block.timestamp + epochDuration;
        newEpoch.settled = false;
        
        emit EpochStarted(currentEpochId, newEpoch.startTime, newEpoch.endTime);
    }
    
    /**
     * @dev Get epoch info
     */
    function getEpochInfo(uint256 _epochId) external view returns (
        uint256 epochId,
        uint256 startTime,
        uint256 endTime,
        bool settled,
        uint256 actualPrice,
        uint256 totalLocked,
        uint256 playerCount
    ) {
        Epoch storage epoch = epochs[_epochId];
        return (
            epoch.epochId,
            epoch.startTime,
            epoch.endTime,
            epoch.settled,
            epoch.actualPrice,
            epoch.totalLocked,
            epoch.players.length
        );
    }
    
    /**
     * @dev Get player prediction for epoch
     */
    function getPlayerPrediction(uint256 _epochId, address _player) external view returns (
        uint256 predictedPrice,
        uint256 lockedAmount,
        uint256 timestamp
    ) {
        Prediction memory pred = epochs[_epochId].predictions[_player];
        return (pred.predictedPrice, pred.lockedAmount, pred.timestamp);
    }
    
    /**
     * @dev Get all players in epoch
     */
    function getEpochPlayers(uint256 _epochId) external view returns (address[] memory) {
        return epochs[_epochId].players;
    }
    
    /**
     * @dev Update epoch duration (owner only)
     */
    function updateEpochDuration(uint256 _newDuration) external onlyOwner {
        require(_newDuration >= 1 hours, "Duration too short");
        epochDuration = _newDuration;
    }
    
    /**
     * @dev Update oracle address (owner only)
     */
    function updateOracle(address _newOracle) external onlyOwner {
        require(_newOracle != address(0), "Invalid oracle");
        priceOracle = _newOracle;
    }
    
    /**
     * @dev Update asset address (owner only)
     */
    function updateAsset(address _newAsset) external onlyOwner {
        require(_newAsset != address(0), "Invalid asset");
        assetAddress = _newAsset;
    }
    
    /**
     * @dev Approve asset for predictions (owner only)
     */
    function approveAsset(address _asset) external onlyOwner {
        approvedAssets[_asset] = true;
        emit AssetApproved(_asset);
    }
}

/**
 * @dev Price Oracle Interface
 */
interface IPriceOracle {
    function getPrice(address asset) external view returns (uint256);
}
