// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title BlocTimeTracker
 * @dev Tracks user bloctime sessions with start/stop mechanism using client signatures
 * Allows both client and server to submit signed session data on-chain
 * MODULAR: Only handles session tracking - no payment/purchase logic
 */
contract BlocTimeTracker is Ownable {
    using ECDSA for bytes32;
    
    IERC20 public blocTimeToken;
    uint256 public epochInterval;
    uint256 public lastEpochBlock;
    
    struct UserSession {
        uint256 startBlock;
        uint256 stopBlock;
        uint256 totalBlocTime;
        bool isActive;
    }
    
    mapping(address => UserSession) public userSessions;
    mapping(bytes32 => bool) public usedSignatures;
    
    event SessionStarted(address indexed user, uint256 startBlock, uint256 blocTimeBalance, address submitter);
    event SessionStopped(address indexed user, uint256 stopBlock, uint256 blocksElapsed, uint256 remainingBlocTime, address submitter);
    event BlocTimeDeducted(address indexed user, uint256 blocksElapsed, uint256 remainingBlocTime);
    event EpochIntervalUpdated(uint256 newInterval);
    event MapCleared(uint256 epochBlock, uint256 usersCleared);
    
    constructor(address _blocTimeToken, uint256 _epochInterval) {
        blocTimeToken = IERC20(_blocTimeToken);
        epochInterval = _epochInterval;
        lastEpochBlock = block.number;
    }
    
    /**
     * @dev Set epoch interval for map clearing (only owner)
     * @param _epochInterval Number of blocks between map clears
     */
    function setEpochInterval(uint256 _epochInterval) external onlyOwner {
        require(_epochInterval > 0, "Invalid epoch interval");
        epochInterval = _epochInterval;
        emit EpochIntervalUpdated(_epochInterval);
    }
    
    /**
     * @dev Clear the userSessions and usedSignatures maps (only owner or auto-triggered)
     */
    function clearMaps() public {
        require(msg.sender == owner() || block.number >= lastEpochBlock + epochInterval, "Not authorized or epoch not reached");
        
        // Note: Solidity doesn't allow direct deletion of mappings
        // This function serves as a marker for off-chain tracking
        // In practice, you'd need to track addresses separately to clear them
        
        lastEpochBlock = block.number;
        emit MapCleared(block.number, 0);
    }
    
    /**
     * @dev Start a session with client signature - can be submitted by client or server
     * @param user The user address
     * @param startBlock The block number to start from
     * @param signature The signature from the client authorizing the start
     */
    function startSessionWithSignature(
        address user,
        uint256 startBlock,
        bytes memory signature
    ) external {
        UserSession storage session = userSessions[user];
        require(!session.isActive, "Session already active");
        
        // Verify signature
        bytes32 messageHash = keccak256(abi.encodePacked("START", user, startBlock));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        require(!usedSignatures[ethSignedHash], "Signature already used");
        
        address signer = ethSignedHash.recover(signature);
        require(signer == user, "Invalid signature");
        
        uint256 balance = blocTimeToken.balanceOf(user);
        require(balance > 0, "No bloctime balance");
        
        session.startBlock = startBlock;
        session.stopBlock = 0;
        session.totalBlocTime = balance;
        session.isActive = true;
        
        usedSignatures[ethSignedHash] = true;
        
        emit SessionStarted(user, startBlock, balance, msg.sender);
    }
    
    /**
     * @dev Stop a session with client signature - can be submitted by client or server
     * @param user The user address
     * @param stopBlock The block number to stop at
     * @param signature The signature from the client authorizing the stop
     */
    function stopSessionWithSignature(
        address user,
        uint256 stopBlock,
        bytes memory signature
    ) external {
        UserSession storage session = userSessions[user];
        require(session.isActive, "No active session");
        
        // Verify signature
        bytes32 messageHash = keccak256(abi.encodePacked("STOP", user, stopBlock));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        require(!usedSignatures[ethSignedHash], "Signature already used");
        
        address signer = ethSignedHash.recover(signature);
        require(signer == user, "Invalid signature");
        
        uint256 blocksElapsed = stopBlock - session.startBlock;
        session.stopBlock = stopBlock;
        session.isActive = false;
        
        // Deduct elapsed blocks from user's bloctime balance
        uint256 currentBalance = blocTimeToken.balanceOf(user);
        require(currentBalance >= blocksElapsed, "Insufficient bloctime");
        
        // Burn or transfer the elapsed bloctime
        require(blocTimeToken.transferFrom(user, address(this), blocksElapsed), "Deduction failed");
        
        uint256 remaining = currentBalance - blocksElapsed;
        
        usedSignatures[ethSignedHash] = true;
        
        emit SessionStopped(user, stopBlock, blocksElapsed, remaining, msg.sender);
    }
    
    /**
     * @dev Legacy direct start session (kept for backward compatibility)
     */
    function startSession() external {
        UserSession storage session = userSessions[msg.sender];
        require(!session.isActive, "Session already active");
        
        uint256 balance = blocTimeToken.balanceOf(msg.sender);
        require(balance > 0, "No bloctime balance");
        
        session.startBlock = block.number;
        session.stopBlock = 0;
        session.totalBlocTime = balance;
        session.isActive = true;
        
        emit SessionStarted(msg.sender, block.number, balance, msg.sender);
    }
    
    /**
     * @dev Legacy direct stop session (kept for backward compatibility)
     */
    function stopSession() external {
        UserSession storage session = userSessions[msg.sender];
        require(session.isActive, "No active session");
        
        uint256 blocksElapsed = block.number - session.startBlock;
        session.stopBlock = block.number;
        session.isActive = false;
        
        // Deduct elapsed blocks from user's bloctime balance
        uint256 currentBalance = blocTimeToken.balanceOf(msg.sender);
        require(currentBalance >= blocksElapsed, "Insufficient bloctime");
        
        // Burn or transfer the elapsed bloctime
        require(blocTimeToken.transferFrom(msg.sender, address(this), blocksElapsed), "Deduction failed");
        
        uint256 remaining = currentBalance - blocksElapsed;
        
        emit SessionStopped(msg.sender, block.number, blocksElapsed, remaining, msg.sender);
    }
    
    /**
     * @dev Hook called before token transfers to deduct elapsed blocks if session is active
     */
    function beforeTransfer(address from) external {
        UserSession storage session = userSessions[from];
        
        if (session.isActive) {
            uint256 blocksElapsed = block.number - session.startBlock;
            uint256 currentBalance = blocTimeToken.balanceOf(from);
            
            if (currentBalance >= blocksElapsed) {
                // Deduct elapsed blocks
                require(blocTimeToken.transferFrom(from, address(this), blocksElapsed), "Auto-deduction failed");
                
                // Reset start block to current
                session.startBlock = block.number;
                
                emit BlocTimeDeducted(from, blocksElapsed, currentBalance - blocksElapsed);
            } else {
                // Insufficient balance, stop session
                session.isActive = false;
                session.stopBlock = block.number;
            }
        }
    }
    
    /**
     * @dev Get user session info
     */
    function getUserSession(address user) external view returns (
        uint256 startBlock,
        uint256 stopBlock,
        uint256 totalBlocTime,
        bool isActive,
        uint256 blocksElapsed
    ) {
        UserSession memory session = userSessions[user];
        uint256 elapsed = session.isActive ? block.number - session.startBlock : 0;
        
        return (
            session.startBlock,
            session.stopBlock,
            session.totalBlocTime,
            session.isActive,
            elapsed
        );
    }
    
    /**
     * @dev Withdraw collected bloctime tokens
     */
    function withdrawBlocTime(uint256 amount) external onlyOwner {
        blocTimeToken.transfer(owner(), amount);
    }
}
