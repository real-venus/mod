// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Registry
 * @dev Minimal registry for managing asset metadata via dataHash (JSON from datahash)
 */
contract Registry {
    struct Module {
        address owner;
        string dataHash;
    }

    uint256 public nextModuleId = 1;
    
    mapping(uint256 => Module) public modules;
    mapping(address => uint256[]) public userModules;

    event ModuleRegistered(uint256 indexed moduleId, address indexed owner, string dataHash);
    event ModuleUpdated(uint256 indexed moduleId, string dataHash);

    modifier onlyModuleOwner(uint256 moduleId) {
        require(modules[moduleId].owner == msg.sender, "Not module owner");
        _;
    }

    /**
     * @dev Register a new module with dataHash (JSON metadata)
     * @param dataHash IPFS hash or metadata reference describing the asset as JSON
     */
    function registerModule(
        string memory dataHash
    ) external returns (uint256) {
        require(bytes(dataHash).length > 0, "Invalid dataHash");
        
        uint256 id = nextModuleId++;
        modules[id] = Module({
            owner: msg.sender,
            dataHash: dataHash
        });
        
        userModules[msg.sender].push(id);
        emit ModuleRegistered(id, msg.sender, dataHash);
        return id;
    }

    /**
     * @dev Update module dataHash (only owner)
     * @param moduleId Module ID
     * @param dataHash New dataHash
     */
    function updateModule(
        uint256 moduleId,
        string memory dataHash
    ) external onlyModuleOwner(moduleId) {
        require(bytes(dataHash).length > 0, "Invalid dataHash");
        modules[moduleId].dataHash = dataHash;
        emit ModuleUpdated(moduleId, dataHash);
    }

    /**
     * @dev Get module details
     */
    function getModule(uint256 id) external view returns (
        address owner,
        string memory dataHash
    ) {
        Module storage m = modules[id];
        return (m.owner, m.dataHash);
    }

    /**
     * @dev Get user's modules
     */
    function getUserModules(address user) external view returns (uint256[] memory) {
        return userModules[user];
    }
}
