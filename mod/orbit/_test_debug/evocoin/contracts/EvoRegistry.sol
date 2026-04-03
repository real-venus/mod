// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract EvoRegistry is Ownable {
    struct TokenInfo {
        address tokenAddress;
        address creator;
        string name;
        string symbol;
        uint8 curveType;
        uint256 curveParam;
        string metadata;
        uint256 createdAt;
        bool active;
        uint256 fitnessScore;
    }

    uint256 public nextTokenId = 1;
    mapping(uint256 => TokenInfo) public tokens;
    mapping(address => uint256) public tokenToId;
    mapping(address => uint256[]) public creatorTokens;
    address[] public allTokenAddresses;

    address public factory;

    event TokenRegistered(uint256 indexed id, address indexed token, address indexed creator);
    event FitnessUpdated(uint256 indexed id, uint256 newScore);
    event TokenDeprecated(uint256 indexed id);
    event MetadataUpdated(uint256 indexed id, string metadata);

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    function setFactory(address _factory) external onlyOwner {
        factory = _factory;
    }

    function registerToken(
        address tokenAddress,
        address creator,
        string memory name,
        string memory symbol,
        uint8 curveType,
        uint256 curveParam,
        string memory metadata
    ) external onlyFactory {
        uint256 id = nextTokenId++;
        tokens[id] = TokenInfo({
            tokenAddress: tokenAddress,
            creator: creator,
            name: name,
            symbol: symbol,
            curveType: curveType,
            curveParam: curveParam,
            metadata: metadata,
            createdAt: block.timestamp,
            active: true,
            fitnessScore: 0
        });
        tokenToId[tokenAddress] = id;
        creatorTokens[creator].push(id);
        allTokenAddresses.push(tokenAddress);

        emit TokenRegistered(id, tokenAddress, creator);
    }

    function updateFitness(uint256 tokenId, uint256 score) external onlyOwner {
        require(tokens[tokenId].active, "Token not active");
        tokens[tokenId].fitnessScore = score;
        emit FitnessUpdated(tokenId, score);
    }

    function batchUpdateFitness(
        uint256[] calldata tokenIds,
        uint256[] calldata scores
    ) external onlyOwner {
        require(tokenIds.length == scores.length, "Length mismatch");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (tokens[tokenIds[i]].active) {
                tokens[tokenIds[i]].fitnessScore = scores[i];
                emit FitnessUpdated(tokenIds[i], scores[i]);
            }
        }
    }

    function deprecateToken(uint256 tokenId) external onlyOwner {
        tokens[tokenId].active = false;
        emit TokenDeprecated(tokenId);
    }

    function updateMetadata(uint256 tokenId, string memory metadata) external {
        require(tokens[tokenId].creator == msg.sender, "Not creator");
        tokens[tokenId].metadata = metadata;
        emit MetadataUpdated(tokenId, metadata);
    }

    function getToken(uint256 id) external view returns (TokenInfo memory) {
        return tokens[id];
    }

    function getTokenByAddress(address addr) external view returns (TokenInfo memory) {
        return tokens[tokenToId[addr]];
    }

    function getCreatorTokens(address creator) external view returns (uint256[] memory) {
        return creatorTokens[creator];
    }

    function getAllTokens() external view returns (address[] memory) {
        return allTokenAddresses;
    }

    function getTokenCount() external view returns (uint256) {
        return nextTokenId - 1;
    }

    function getTokensPaginated(uint256 offset, uint256 limit)
        external view returns (TokenInfo[] memory)
    {
        uint256 total = allTokenAddresses.length;
        if (offset >= total) return new TokenInfo[](0);
        uint256 end = offset + limit > total ? total : offset + limit;
        TokenInfo[] memory result = new TokenInfo[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = tokens[tokenToId[allTokenAddresses[i]]];
        }
        return result;
    }
}
