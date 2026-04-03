// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title QuestBoard
 * @dev On-chain evaluation market. Creators post quests with escrowed rewards,
 * assign referees to judge responses, and referees take a fee for their service.
 *
 * Flow:
 * 1. Creator creates quest, escrowing reward tokens into this contract
 * 2. Creator assigns a referee (defaults to self). Third-party referees must accept.
 * 3. Responders submit responses (hashes stored on-chain, content off-chain)
 * 4. Referee approves a response → funds split: treasury + referee + responder
 * 5. Or referee rejects / creator cancels → funds return to creator
 *
 * Security:
 * - Escrow holds funds until resolution
 * - Referee cannot approve their own response
 * - Referee fee capped at MAX_REFEREE_FEE_BPS (50%)
 * - Treasury fee is protocol-level and non-negotiable
 * - Only creator can cancel, only referee can judge
 * - ReentrancyGuard on all state-changing external calls
 */
contract QuestBoard is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ========== CONSTANTS ==========

    uint256 public constant TREASURY_FEE_BPS = 500;       // 5% = 500 bps
    uint256 public constant MAX_REFEREE_FEE_BPS = 5000;   // 50% max
    uint256 public constant BPS_DENOMINATOR = 10000;

    // ========== STATE ==========

    IERC20 public paymentToken;
    address public treasury;
    uint256 public nextQuestId = 1;

    enum QuestStatus { Open, Completed, Cancelled }
    enum ResponseStatus { Pending, Approved, Rejected }

    struct Quest {
        uint256 id;
        address creator;
        address referee;
        bool refereeAccepted;
        uint256 refereeFee;        // in basis points
        uint256 reward;            // amount escrowed (in token units)
        bytes32 contentHash;       // IPFS/off-chain hash of title + description
        uint256 deadline;          // 0 = no deadline
        uint256 createdAt;
        QuestStatus status;
        uint256 responseCount;
        uint256 approvedResponseId; // 0 = none
    }

    struct Response {
        uint256 id;
        uint256 questId;
        address responder;
        bytes32 contentHash;       // IPFS/off-chain hash of response content
        uint256 createdAt;
        ResponseStatus status;
    }

    mapping(uint256 => Quest) public quests;
    mapping(uint256 => mapping(uint256 => Response)) public responses; // questId => responseIndex => Response
    mapping(uint256 => mapping(address => bool)) public hasResponded;  // questId => responder => bool

    // ========== EVENTS ==========

    event QuestCreated(
        uint256 indexed questId,
        address indexed creator,
        address indexed referee,
        uint256 reward,
        bytes32 contentHash,
        uint256 deadline
    );
    event RefereeAccepted(uint256 indexed questId, address indexed referee, uint256 feeBps);
    event RefereeDeclined(uint256 indexed questId, address indexed referee);
    event RefereeChanged(uint256 indexed questId, address indexed oldReferee, address indexed newReferee);
    event ResponseSubmitted(uint256 indexed questId, uint256 indexed responseId, address indexed responder, bytes32 contentHash);
    event ResponseApproved(
        uint256 indexed questId,
        uint256 indexed responseId,
        address indexed responder,
        uint256 responderAmount,
        uint256 refereeAmount,
        uint256 treasuryAmount
    );
    event ResponseRejected(uint256 indexed questId, uint256 indexed responseId);
    event QuestCancelled(uint256 indexed questId, uint256 refundAmount);
    event TreasuryUpdated(address indexed newTreasury);
    event ContractSetOwnerless();

    // ========== CONSTRUCTOR ==========

    constructor(address _paymentToken, address _treasury) {
        require(_paymentToken != address(0), "Invalid token");
        require(_treasury != address(0), "Invalid treasury");
        paymentToken = IERC20(_paymentToken);
        treasury = _treasury;
    }

    // ========== ADMIN ==========

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function setOwnerless() external onlyOwner {
        emit ContractSetOwnerless();
        renounceOwnership();
    }

    // ========== QUEST CREATION ==========

    /**
     * @dev Create a quest with escrowed reward. Caller must have approved this contract.
     * @param reward Amount of payment tokens to escrow
     * @param referee Address of the referee (use address(0) or own address for self-referee)
     * @param refereeFee Fee in basis points the referee takes (ignored if self-referee, set by acceptReferee otherwise)
     * @param contentHash IPFS/off-chain hash of quest details
     * @param deadline Unix timestamp deadline (0 = no deadline)
     */
    function createQuest(
        uint256 reward,
        address referee,
        uint256 refereeFee,
        bytes32 contentHash,
        uint256 deadline
    ) external nonReentrant returns (uint256 questId) {
        require(reward > 0, "Reward must be > 0");
        require(contentHash != bytes32(0), "Content hash required");
        if (deadline > 0) {
            require(deadline > block.timestamp, "Deadline must be in future");
        }

        // Determine referee
        address resolvedReferee = (referee == address(0)) ? msg.sender : referee;
        bool isSelfReferee = (resolvedReferee == msg.sender);

        // Validate referee fee
        uint256 resolvedFee;
        bool refereeAccepted;
        if (isSelfReferee) {
            resolvedFee = 0;       // self-referee pays no fee to themselves
            refereeAccepted = true;
        } else {
            resolvedFee = 0;       // fee is set when referee accepts
            refereeAccepted = false;
        }

        // Escrow reward tokens
        paymentToken.safeTransferFrom(msg.sender, address(this), reward);

        questId = nextQuestId++;
        quests[questId] = Quest({
            id: questId,
            creator: msg.sender,
            referee: resolvedReferee,
            refereeAccepted: refereeAccepted,
            refereeFee: resolvedFee,
            reward: reward,
            contentHash: contentHash,
            deadline: deadline,
            createdAt: block.timestamp,
            status: QuestStatus.Open,
            responseCount: 0,
            approvedResponseId: 0
        });

        emit QuestCreated(questId, msg.sender, resolvedReferee, reward, contentHash, deadline);
    }

    // ========== REFEREE MANAGEMENT ==========

    /**
     * @dev Referee accepts the role and sets their fee.
     * @param questId The quest ID
     * @param feeBps Fee in basis points (0 to MAX_REFEREE_FEE_BPS)
     */
    function acceptReferee(uint256 questId, uint256 feeBps) external nonReentrant {
        Quest storage q = quests[questId];
        require(q.id > 0, "Quest not found");
        require(q.status == QuestStatus.Open, "Quest not open");
        require(q.referee == msg.sender, "Not designated referee");
        require(!q.refereeAccepted, "Already accepted");
        require(feeBps <= MAX_REFEREE_FEE_BPS, "Fee exceeds max");

        // Ensure treasury + referee fee don't eat entire reward
        require(TREASURY_FEE_BPS + feeBps < BPS_DENOMINATOR, "Combined fees too high");

        q.refereeAccepted = true;
        q.refereeFee = feeBps;

        emit RefereeAccepted(questId, msg.sender, feeBps);
    }

    /**
     * @dev Referee declines. Resets referee to creator (self-referee, 0 fee, auto-accepted).
     */
    function declineReferee(uint256 questId) external nonReentrant {
        Quest storage q = quests[questId];
        require(q.id > 0, "Quest not found");
        require(q.status == QuestStatus.Open, "Quest not open");
        require(q.referee == msg.sender, "Not designated referee");
        require(q.referee != q.creator, "Creator-referee cannot decline");
        require(!q.refereeAccepted, "Already accepted");

        address oldReferee = q.referee;
        q.referee = q.creator;
        q.refereeAccepted = true;
        q.refereeFee = 0;

        emit RefereeDeclined(questId, oldReferee);
        emit RefereeChanged(questId, oldReferee, q.creator);
    }

    /**
     * @dev Creator can change referee before referee has accepted and before any responses.
     */
    function changeReferee(uint256 questId, address newReferee) external nonReentrant {
        Quest storage q = quests[questId];
        require(q.id > 0, "Quest not found");
        require(q.status == QuestStatus.Open, "Quest not open");
        require(q.creator == msg.sender, "Not quest creator");
        require(!q.refereeAccepted || q.referee == q.creator, "Referee already accepted");
        require(q.responseCount == 0, "Responses already submitted");

        address oldReferee = q.referee;
        address resolved = (newReferee == address(0)) ? msg.sender : newReferee;
        bool isSelf = (resolved == msg.sender);

        q.referee = resolved;
        q.refereeAccepted = isSelf;
        q.refereeFee = 0;

        emit RefereeChanged(questId, oldReferee, resolved);
    }

    // ========== RESPONSES ==========

    /**
     * @dev Submit a response to a quest. One response per address per quest.
     * @param questId The quest to respond to
     * @param contentHash IPFS/off-chain hash of the response content
     */
    function submitResponse(uint256 questId, bytes32 contentHash) external nonReentrant returns (uint256 responseId) {
        Quest storage q = quests[questId];
        require(q.id > 0, "Quest not found");
        require(q.status == QuestStatus.Open, "Quest not open");
        require(q.refereeAccepted, "Referee has not accepted");
        require(contentHash != bytes32(0), "Content hash required");
        require(!hasResponded[questId][msg.sender], "Already responded");

        // Check deadline
        if (q.deadline > 0) {
            require(block.timestamp <= q.deadline, "Quest deadline passed");
        }

        q.responseCount++;
        responseId = q.responseCount;

        responses[questId][responseId] = Response({
            id: responseId,
            questId: questId,
            responder: msg.sender,
            contentHash: contentHash,
            createdAt: block.timestamp,
            status: ResponseStatus.Pending
        });

        hasResponded[questId][msg.sender] = true;

        emit ResponseSubmitted(questId, responseId, msg.sender, contentHash);
    }

    // ========== APPROVAL & PAYMENT ==========

    /**
     * @dev Referee approves a response. Triggers escrow release with fee splits.
     * @param questId The quest ID
     * @param responseId The response ID to approve
     */
    function approveResponse(uint256 questId, uint256 responseId) external nonReentrant {
        Quest storage q = quests[questId];
        require(q.id > 0, "Quest not found");
        require(q.status == QuestStatus.Open, "Quest not open");
        require(q.referee == msg.sender, "Not quest referee");
        require(q.refereeAccepted, "Referee not accepted");

        Response storage r = responses[questId][responseId];
        require(r.id > 0, "Response not found");
        require(r.status == ResponseStatus.Pending, "Response not pending");
        require(r.responder != msg.sender, "Cannot approve own response");

        // Calculate splits
        uint256 reward = q.reward;
        uint256 treasuryAmount = (reward * TREASURY_FEE_BPS) / BPS_DENOMINATOR;
        uint256 refereeAmount = (reward * q.refereeFee) / BPS_DENOMINATOR;
        uint256 responderAmount = reward - treasuryAmount - refereeAmount;

        require(responderAmount > 0, "Nothing left for responder");

        // Update state before transfers (CEI pattern)
        r.status = ResponseStatus.Approved;
        q.status = QuestStatus.Completed;
        q.approvedResponseId = responseId;

        // Transfer from escrow
        paymentToken.safeTransfer(treasury, treasuryAmount);
        if (refereeAmount > 0 && q.referee != q.creator) {
            paymentToken.safeTransfer(q.referee, refereeAmount);
        } else {
            // If self-referee, referee amount goes back to responder
            responderAmount += refereeAmount;
            refereeAmount = 0;
        }
        paymentToken.safeTransfer(r.responder, responderAmount);

        emit ResponseApproved(questId, responseId, r.responder, responderAmount, refereeAmount, treasuryAmount);
    }

    // ========== REJECTION ==========

    /**
     * @dev Referee rejects a response.
     */
    function rejectResponse(uint256 questId, uint256 responseId) external nonReentrant {
        Quest storage q = quests[questId];
        require(q.id > 0, "Quest not found");
        require(q.status == QuestStatus.Open, "Quest not open");
        require(q.referee == msg.sender, "Not quest referee");
        require(q.refereeAccepted, "Referee not accepted");

        Response storage r = responses[questId][responseId];
        require(r.id > 0, "Response not found");
        require(r.status == ResponseStatus.Pending, "Response not pending");

        r.status = ResponseStatus.Rejected;

        emit ResponseRejected(questId, responseId);
    }

    // ========== CANCELLATION ==========

    /**
     * @dev Creator cancels an open quest. Escrowed funds returned.
     * Can only cancel if no response has been approved.
     */
    function cancelQuest(uint256 questId) external nonReentrant {
        Quest storage q = quests[questId];
        require(q.id > 0, "Quest not found");
        require(q.status == QuestStatus.Open, "Quest not open");
        require(q.creator == msg.sender, "Not quest creator");

        uint256 refund = q.reward;
        q.status = QuestStatus.Cancelled;

        paymentToken.safeTransfer(q.creator, refund);

        emit QuestCancelled(questId, refund);
    }

    // ========== VIEW ==========

    function getQuest(uint256 questId) external view returns (Quest memory) {
        require(quests[questId].id > 0, "Quest not found");
        return quests[questId];
    }

    function getResponse(uint256 questId, uint256 responseId) external view returns (Response memory) {
        require(responses[questId][responseId].id > 0, "Response not found");
        return responses[questId][responseId];
    }

    function getQuestResponseCount(uint256 questId) external view returns (uint256) {
        return quests[questId].responseCount;
    }
}
