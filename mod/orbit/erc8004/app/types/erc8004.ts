export interface AgentIdentity {
  tokenId: string;
  owner: string;
  metadataURI: string;
  capabilities: string[];
  protocols: string[];
  createdAt: number;
}

export interface AgentMetadata {
  name: string;
  description: string;
  version: string;
  capabilities: string[];
  communicationProtocols: string[];
  endpoint?: string;
  avatar?: string;
}

export interface ReputationScore {
  agentId: string;
  totalFeedback: number;
  positiveCount: number;
  negativeCount: number;
  averageRating: number;
  reputationScore: number;
}

export interface FeedbackEntry {
  id: string;
  agentId: string;
  reviewer: string;
  rating: number;
  comment: string;
  taskHash: string;
  timestamp: number;
}

export interface ValidationProof {
  id: string;
  agentId: string;
  taskHash: string;
  proofType: 'optimistic' | 'zk-proof' | 'tee';
  proofData: string;
  validator: string;
  status: 'pending' | 'verified' | 'failed';
  timestamp: number;
}

export interface AgentTask {
  id: string;
  agentId: string;
  requester: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: string;
  timestamp: number;
}

export const ERC8004_IDENTITY_ABI = [
  'function registerAgent(string memory metadataURI) external returns (uint256)',
  'function getAgentIdentity(uint256 tokenId) external view returns (address owner, string memory metadataURI, uint256 createdAt)',
  'function transferAgent(address to, uint256 tokenId) external',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function tokenURI(uint256 tokenId) external view returns (string memory)',
  'event AgentRegistered(uint256 indexed tokenId, address indexed owner, string metadataURI)',
  'event AgentTransferred(uint256 indexed tokenId, address indexed from, address indexed to)',
];

export const ERC8004_REPUTATION_ABI = [
  'function submitFeedback(uint256 agentId, uint8 rating, string memory comment, bytes32 taskHash) external',
  'function getReputation(uint256 agentId) external view returns (uint256 totalFeedback, uint256 positiveCount, uint256 averageRating)',
  'function getFeedback(uint256 agentId, uint256 index) external view returns (address reviewer, uint8 rating, string memory comment, uint256 timestamp)',
  'function getFeedbackCount(uint256 agentId) external view returns (uint256)',
  'event FeedbackSubmitted(uint256 indexed agentId, address indexed reviewer, uint8 rating, bytes32 taskHash)',
];

export const ERC8004_VALIDATION_ABI = [
  'function submitValidation(uint256 agentId, bytes32 taskHash, uint8 proofType, bytes memory proofData) external',
  'function verifyProof(uint256 validationId) external returns (bool)',
  'function getValidation(uint256 validationId) external view returns (uint256 agentId, bytes32 taskHash, uint8 proofType, address validator, uint8 status, uint256 timestamp)',
  'function getAgentValidations(uint256 agentId) external view returns (uint256[] memory)',
  'event ValidationSubmitted(uint256 indexed validationId, uint256 indexed agentId, bytes32 taskHash, uint8 proofType)',
  'event ValidationVerified(uint256 indexed validationId, bool success)',
];
