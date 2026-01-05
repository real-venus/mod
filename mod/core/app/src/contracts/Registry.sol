// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Registry {
    // Double map: owner => modId => ipfsHash
    mapping(address => mapping(uint256 => string)) private modules;
    
    // Track module ownership and existence
    mapping(address => mapping(uint256 => bool)) private moduleExists;
    
    // Track moderators for each module
    mapping(address => mapping(uint256 => mapping(address => bool))) private moduleModerators;
    
    // Events
    event ModuleRegistered(address indexed owner, uint256 indexed modId, string ipfsHash);
    event ModuleUpdated(address indexed owner, uint256 indexed modId, string ipfsHash);
    event ModuleDeregistered(address indexed owner, uint256 indexed modId);
    event ModuleTransferred(address indexed from, address indexed to, uint256 indexed modId, string ipfsHash);
    event ModeratorAdded(address indexed owner, uint256 indexed modId, address indexed moderator);
    event ModeratorRemoved(address indexed owner, uint256 indexed modId, address indexed moderator);
    
    // Modifiers
    modifier onlyOwner(uint256 modId) {
        require(moduleExists[msg.sender][modId], "Module does not exist or you are not the owner");
        _;
    }
    
    modifier onlyOwnerOrModerator(address owner, uint256 modId) {
        require(
            moduleExists[owner][modId] && (msg.sender == owner || moduleModerators[owner][modId][msg.sender]),
            "Not authorized: must be owner or moderator"
        );
        _;
    }
    
    // Register a new module
    function register(uint256 modId, string memory ipfsHash) public {
        require(!moduleExists[msg.sender][modId], "Module already exists");
        require(bytes(ipfsHash).length > 0, "IPFS hash cannot be empty");
        
        modules[msg.sender][modId] = ipfsHash;
        moduleExists[msg.sender][modId] = true;
        
        emit ModuleRegistered(msg.sender, modId, ipfsHash);
    }
    
    // Update an existing module
    function update(uint256 modId, string memory ipfsHash) public {
        require(moduleExists[msg.sender][modId], "Module does not exist");
        require(bytes(ipfsHash).length > 0, "IPFS hash cannot be empty");
        
        modules[msg.sender][modId] = ipfsHash;
        
        emit ModuleUpdated(msg.sender, modId, ipfsHash);
    }
    
    // Deregister a module (remove/delete)
    function deregister(uint256 modId) public onlyOwner(modId) {
        delete modules[msg.sender][modId];
        delete moduleExists[msg.sender][modId];
        
        emit ModuleDeregistered(msg.sender, modId);
    }
    
    // Remove a module (alias for deregister for clarity)
    function remove(uint256 modId) public {
        deregister(modId);
    }
    
    // Transfer module ownership to another address
    function transfer(address to, uint256 modId) public onlyOwner(modId) {
        require(to != address(0), "Invalid recipient address");
        require(to != msg.sender, "Cannot transfer to yourself");
        require(!moduleExists[to][modId], "Module already exists for recipient");
        
        string memory ipfsHash = modules[msg.sender][modId];
        
        // Remove from sender
        delete modules[msg.sender][modId];
        delete moduleExists[msg.sender][modId];
        
        // Add to recipient
        modules[to][modId] = ipfsHash;
        moduleExists[to][modId] = true;
        
        emit ModuleTransferred(msg.sender, to, modId, ipfsHash);
    }
    
    // Transfer ownership (alias for transfer)
    function transferOwnership(address to, uint256 modId) public {
        transfer(to, modId);
    }
    
    // Add a moderator to a module
    function addModerator(uint256 modId, address moderator) public onlyOwner(modId) {
        require(moderator != address(0), "Invalid moderator address");
        require(moderator != msg.sender, "Owner is already a moderator");
        require(!moduleModerators[msg.sender][modId][moderator], "Moderator already exists");
        
        moduleModerators[msg.sender][modId][moderator] = true;
        
        emit ModeratorAdded(msg.sender, modId, moderator);
    }
    
    // Remove a moderator from a module
    function removeModerator(uint256 modId, address moderator) public onlyOwner(modId) {
        require(moduleModerators[msg.sender][modId][moderator], "Moderator does not exist");
        
        delete moduleModerators[msg.sender][modId][moderator];
        
        emit ModeratorRemoved(msg.sender, modId, moderator);
    }
    
    // Get module IPFS hash
    function getModule(address owner, uint256 modId) public view returns (string memory) {
        require(moduleExists[owner][modId], "Module does not exist");
        return modules[owner][modId];
    }
    
    // Check if module exists
    function exists(address owner, uint256 modId) public view returns (bool) {
        return moduleExists[owner][modId];
    }
    
    // Check if address is a moderator for a module
    function isModerator(address owner, uint256 modId, address moderator) public view returns (bool) {
        return moduleModerators[owner][modId][moderator];
    }
}
