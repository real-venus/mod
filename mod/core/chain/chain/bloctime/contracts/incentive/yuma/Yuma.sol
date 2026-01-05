// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title YumaIncentive
 * @dev Yuma-style incentive mechanism where users can claim locked funds from Market contract
 * by providing valid signatures of datahash + timestamp
 * Validators sign off on data submissions and users claim rewards
 */
contract YumaIncentive is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    IERC20 public rewardToken;
    address public marketContract;
    
    // Validator management
    mapping(address => bool) public isValidator;
    address[] public validators;
    uint256 public requiredSignatures = 1;
    
    // Claim tracking
    mapping(bytes32 => bool) public claimedDataHashes;
    mapping(address => uint256) public totalClaimed;
    
    // Reward pool from market
    uint256 public totalRewardPool;
    uint256 public totalDistributed;
    
    struct Claim {
        address claimer;
        bytes32 dataHash;
        uint256 timestamp;
        uint256 amount;
        uint256 claimTime;
    }
    
    mapping(bytes32 => Claim) public claims;
    bytes32[] public claimHistory;
    
    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);
    event RequiredSignaturesUpdated(uint256 newRequired);
    event RewardClaimed(address indexed claimer, bytes32 indexed dataHash, uint256 amount, uint256 timestamp);
    event RewardPoolFunded(address indexed funder, uint256 amount);
    event MarketContractUpdated(address indexed newMarket);
    
    constructor(address _rewardToken, address _marketContract) {
        require(_rewardToken != address(0), "Invalid token");
        require(_marketContract != address(0), "Invalid market");
        rewardToken = IERC20(_rewardToken);
        marketContract = _marketContract;
    }
    
    /**
     * @dev Add validator who can sign off on data submissions
     */
    function addValidator(address validator) external onlyOwner {
        require(validator != address(0), "Invalid validator");
        require(!isValidator[validator], "Already validator");
        
        isValidator[validator] = true;
        validators.push(validator);
        
        emit ValidatorAdded(validator);
    }
    
    /**
     * @dev Remove validator
     */
    function removeValidator(address validator) external onlyOwner {
        require(isValidator[validator], "Not a validator");
        
        isValidator[validator] = false;
        
        // Remove from array
        for (uint256 i = 0; i < validators.length; i++) {
            if (validators[i] == validator) {
                validators[i] = validators[validators.length - 1];
                validators.pop();
                break;
            }
        }
        
        emit ValidatorRemoved(validator);
    }
    
    /**
     * @dev Set required number of validator signatures
     */
    function setRequiredSignatures(uint256 _required) external onlyOwner {
        require(_required > 0 && _required <= validators.length, "Invalid required count");
        requiredSignatures = _required;
        emit RequiredSignaturesUpdated(_required);
    }
    
    /**
     * @dev Set market contract address
     */
    function setMarketContract(address _marketContract) external onlyOwner {
        require(_marketContract != address(0), "Invalid market");
        marketContract = _marketContract;
        emit MarketContractUpdated(_marketContract);
    }
    
    /**
     * @dev Fund reward pool (can be called by market contract or owner)
     */
    function fundRewardPool(uint256 amount) external nonReentrant {
        require(amount > 0, "Invalid amount");
        require(msg.sender == marketContract || msg.sender == owner(), "Not authorized");
        
        rewardToken.transferFrom(msg.sender, address(this), amount);
        totalRewardPool += amount;
        
        emit RewardPoolFunded(msg.sender, amount);
    }
    
    /**
     * @dev Claim locked funds by providing signatures of datahash + timestamp
     * @param dataHash Hash of the submitted data
     * @param timestamp Timestamp of data submission
     * @param amount Amount to claim
     * @param signatures Array of validator signatures
     */
    function claimReward(
        bytes32 dataHash,
        uint256 timestamp,
        uint256 amount,
        bytes[] memory signatures
    ) external nonReentrant {
        require(amount > 0, "Invalid amount");
        require(signatures.length >= requiredSignatures, "Insufficient signatures");
        require(!claimedDataHashes[dataHash], "Already claimed");
        require(totalRewardPool - totalDistributed >= amount, "Insufficient reward pool");
        
        // Verify timestamp is not too old (within 7 days)
        require(block.timestamp - timestamp <= 7 days, "Timestamp too old");
        require(timestamp <= block.timestamp, "Future timestamp");
        
        // Create message hash: keccak256(abi.encodePacked(claimer, dataHash, timestamp, amount))
        bytes32 messageHash = keccak256(abi.encodePacked(msg.sender, dataHash, timestamp, amount));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        
        // Verify signatures from unique validators
        address[] memory signers = new address[](signatures.length);
        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = ethSignedHash.recover(signatures[i]);
            require(isValidator[signer], "Invalid validator signature");
            
            // Check for duplicate signers
            for (uint256 j = 0; j < i; j++) {
                require(signers[j] != signer, "Duplicate signature");
            }
            signers[i] = signer;
        }
        
        // Mark as claimed
        claimedDataHashes[dataHash] = true;
        
        // Record claim
        claims[dataHash] = Claim({
            claimer: msg.sender,
            dataHash: dataHash,
            timestamp: timestamp,
            amount: amount,
            claimTime: block.timestamp
        });
        claimHistory.push(dataHash);
        
        // Update stats
        totalClaimed[msg.sender] += amount;
        totalDistributed += amount;
        
        // Transfer reward
        rewardToken.transfer(msg.sender, amount);
        
        emit RewardClaimed(msg.sender, dataHash, amount, timestamp);
    }
    
    /**
     * @dev Get claim info
     */
    function getClaim(bytes32 dataHash) external view returns (
        address claimer,
        uint256 timestamp,
        uint256 amount,
        uint256 claimTime,
        bool claimed
    ) {
        Claim memory claim = claims[dataHash];
        return (
            claim.claimer,
            claim.timestamp,
            claim.amount,
            claim.claimTime,
            claimedDataHashes[dataHash]
        );
    }
    
    /**
     * @dev Get all validators
     */
    function getValidators() external view returns (address[] memory) {
        return validators;
    }
    
    /**
     * @dev Get claim history
     */
    function getClaimHistory(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
        uint256 total = claimHistory.length;
        if (offset >= total) {
            return new bytes32[](0);
        }
        
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        
        bytes32[] memory result = new bytes32[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = claimHistory[i];
        }
        
        return result;
    }
    
    /**
     * @dev Get available reward pool
     */
    function getAvailableRewards() external view returns (uint256) {
        return totalRewardPool - totalDistributed;
    }
    
    /**
     * @dev Get user stats
     */
    function getUserStats(address user) external view returns (
        uint256 claimed,
        uint256 claimCount
    ) {
        uint256 count = 0;
        for (uint256 i = 0; i < claimHistory.length; i++) {
            if (claims[claimHistory[i]].claimer == user) {
                count++;
            }
        }
        return (totalClaimed[user], count);
    }
    
    /**
     * @dev Emergency withdraw (owner only)
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        rewardToken.transfer(owner(), amount);
    }
}
