# ERC-8004 Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      USER INTERFACE                         │
│                     (Next.js Frontend)                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├── Wallet Connection
                            ├── Agent Registration
                            ├── Marketplace Browsing
                            ├── Reputation Management
                            └── Validation Submission
                            │
┌─────────────────────────────────────────────────────────────┐
│                      WEB3 LAYER                             │
│                     (ethers.js v6)                          │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐ ┌───────▼────────┐ ┌───────▼────────┐
│   Identity     │ │   Reputation   │ │   Validation   │
│   Registry     │ │   Registry     │ │   Registry     │
│   (ERC-721)    │ │   Contract     │ │   Contract     │
└────────────────┘ └────────────────┘ └────────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                    ┌───────▼────────┐
                    │   Ethereum     │
                    │   Blockchain   │
                    └────────────────┘
```

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         app/                                │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  layout.tsx (Root Layout)                            │  │
│  │  - ToastContainer                                    │  │
│  │  - Global styles                                     │  │
│  │  - Metadata                                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  page.tsx (Home)                                     │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │  WalletConnect                                  │ │  │
│  │  │  - Connect wallet                               │ │  │
│  │  │  - Display address                              │ │  │
│  │  │  - Handle network changes                       │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  │                                                      │  │
│  │  ┌─────────────────┐ ┌──────────────────┐          │  │
│  │  │  Marketplace    │ │  RegisterAgent   │          │  │
│  │  │  - Agent grid   │ │  - Form inputs   │          │  │
│  │  │  - Search       │ │  - Capabilities  │          │  │
│  │  │  - Stats        │ │  - Protocols     │          │  │
│  │  └─────────────────┘ └──────────────────┘          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  agent/[id]/page.tsx (Detail)                        │  │
│  │  ┌──────────────────┐ ┌─────────────────────────┐   │  │
│  │  │  Overview        │ │  ReputationPanel        │   │  │
│  │  │  - Description   │ │  - Stats                │   │  │
│  │  │  - Capabilities  │ │  - Feedback list        │   │  │
│  │  │  - Details       │ │  - Submit form          │   │  │
│  │  └──────────────────┘ └─────────────────────────┘   │  │
│  │  ┌─────────────────────────────────────┐            │  │
│  │  │  ValidationPanel                    │            │  │
│  │  │  - Validation stats                 │            │  │
│  │  │  - History                          │            │  │
│  │  │  - Submit proof form                │            │  │
│  │  └─────────────────────────────────────┘            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Agent Registration Flow

```
User Input
    │
    ├── Fill form (name, description, etc.)
    ├── Add capabilities
    ├── Add protocols
    │
    ▼
RegisterAgent Component
    │
    ├── Validate inputs
    ├── Create metadata JSON
    ├── Encode as base64
    │
    ▼
Ethereum Layer (lib/ethereum.ts)
    │
    ├── Get signer
    ├── Connect to Identity Registry
    ├── Call registerAgent(metadataURI)
    │
    ▼
Smart Contract
    │
    ├── Mint ERC-721 NFT
    ├── Store metadata URI
    ├── Emit AgentRegistered event
    │
    ▼
Transaction Receipt
    │
    ├── Extract token ID
    ├── Show success notification
    └── Reset form
```

### Reputation Submission Flow

```
User Action
    │
    ├── Select agent
    ├── Rate (1-10)
    ├── Write comment
    │
    ▼
ReputationPanel Component
    │
    ├── Validate rating and comment
    ├── Prepare transaction data
    │
    ▼
Ethereum Layer
    │
    ├── Get signer
    ├── Connect to Reputation Registry
    ├── Call submitFeedback(agentId, rating, comment, taskHash)
    │
    ▼
Smart Contract
    │
    ├── Store feedback on-chain
    ├── Update reputation score
    ├── Emit FeedbackSubmitted event
    │
    ▼
UI Update
    │
    ├── Show success notification
    ├── Reload feedback list
    └── Close form
```

### Marketplace Loading Flow

```
Component Mount
    │
    ▼
AgentMarketplace Component
    │
    ├── Initialize state
    ├── Call loadAgents()
    │
    ▼
Load Identity Data
    │
    ├── Connect to Identity Registry
    ├── Loop through token IDs (1-20)
    ├── Call getAgentIdentity(tokenId)
    ├── Parse metadata from URI
    │
    ▼
Load Reputation Data
    │
    ├── Connect to Reputation Registry
    ├── For each agent: getReputation(tokenId)
    ├── Calculate average rating
    │
    ▼
Load Validation Data
    │
    ├── Connect to Validation Registry
    ├── For each agent: getAgentValidations(tokenId)
    ├── Count validations
    │
    ▼
Render UI
    │
    ├── Display agent cards
    ├── Show statistics
    └── Enable search
```

## State Management

```
┌─────────────────────────────────────────────────────────────┐
│                    Component State                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  WalletConnect                                              │
│  ├── address: string | null                                 │
│  ├── isConnecting: boolean                                  │
│  └── useEffect: Monitor account changes                     │
│                                                             │
│  RegisterAgent                                              │
│  ├── formData: AgentMetadata                                │
│  ├── isRegistering: boolean                                 │
│  ├── capabilityInput: string                                │
│  └── protocolInput: string                                  │
│                                                             │
│  AgentMarketplace                                           │
│  ├── agents: AgentIdentity[]                                │
│  ├── filteredAgents: AgentIdentity[]                        │
│  ├── searchTerm: string                                     │
│  ├── agentMetadata: Record<string, AgentMetadata>           │
│  ├── agentStats: Record<string, Stats>                      │
│  └── isLoading: boolean                                     │
│                                                             │
│  ReputationPanel                                            │
│  ├── reputation: ReputationScore | null                     │
│  ├── feedback: FeedbackEntry[]                              │
│  ├── showFeedbackForm: boolean                              │
│  ├── newFeedback: { rating, comment, taskHash }             │
│  └── isSubmitting: boolean                                  │
│                                                             │
│  ValidationPanel                                            │
│  ├── validations: ValidationProof[]                         │
│  ├── showSubmitForm: boolean                                │
│  ├── newValidation: { taskHash, proofType, proofData }      │
│  └── isSubmitting: boolean                                  │
└─────────────────────────────────────────────────────────────┘
```

## Network Layer

```
┌─────────────────────────────────────────────────────────────┐
│                  lib/ethereum.ts                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  getEthereumProvider()                                      │
│  └── Returns: BrowserProvider | null                        │
│                                                             │
│  connectWallet()                                            │
│  ├── Request accounts from MetaMask                         │
│  └── Returns: address | null                                │
│                                                             │
│  switchChain(chainName)                                     │
│  ├── Check current network                                  │
│  ├── Switch or add network                                  │
│  └── Handle errors                                          │
│                                                             │
│  getIdentityContract(chainName)                             │
│  ├── Get provider                                           │
│  ├── Create contract instance                               │
│  └── Returns: Contract                                      │
│                                                             │
│  getReputationContract(chainName)                           │
│  └── Returns: Contract                                      │
│                                                             │
│  getValidationContract(chainName)                           │
│  └── Returns: Contract                                      │
│                                                             │
│  getSigner()                                                │
│  └── Returns: Signer for transactions                       │
└─────────────────────────────────────────────────────────────┘
```

## Configuration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  lib/config.ts                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CHAIN_CONFIG                                               │
│  ├── mainnet                                                │
│  │   ├── chainId: 1                                         │
│  │   ├── name: "Ethereum Mainnet"                           │
│  │   ├── rpcUrl: "https://eth.llamarpc.com"                 │
│  │   └── contracts                                          │
│  │       ├── identityRegistry                               │
│  │       ├── reputationRegistry                             │
│  │       └── validationRegistry                             │
│  │                                                          │
│  ├── sepolia                                                │
│  │   └── (similar structure)                                │
│  │                                                          │
│  └── baseSepolia                                            │
│      └── (similar structure)                                │
│                                                             │
│  DEFAULT_CHAIN = 'baseSepolia'                              │
└─────────────────────────────────────────────────────────────┘
```

## Type System

```
┌─────────────────────────────────────────────────────────────┐
│                  types/erc8004.ts                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  AgentIdentity                                              │
│  ├── tokenId: string                                        │
│  ├── owner: string                                          │
│  ├── metadataURI: string                                    │
│  ├── capabilities: string[]                                 │
│  ├── protocols: string[]                                    │
│  └── createdAt: number                                      │
│                                                             │
│  AgentMetadata                                              │
│  ├── name: string                                           │
│  ├── description: string                                    │
│  ├── version: string                                        │
│  ├── capabilities: string[]                                 │
│  ├── communicationProtocols: string[]                       │
│  ├── endpoint?: string                                      │
│  └── avatar?: string                                        │
│                                                             │
│  ReputationScore                                            │
│  ├── agentId: string                                        │
│  ├── totalFeedback: number                                  │
│  ├── positiveCount: number                                  │
│  ├── negativeCount: number                                  │
│  ├── averageRating: number                                  │
│  └── reputationScore: number                                │
│                                                             │
│  FeedbackEntry                                              │
│  ├── id: string                                             │
│  ├── agentId: string                                        │
│  ├── reviewer: string                                       │
│  ├── rating: number                                         │
│  ├── comment: string                                        │
│  ├── taskHash: string                                       │
│  └── timestamp: number                                      │
│                                                             │
│  ValidationProof                                            │
│  ├── id: string                                             │
│  ├── agentId: string                                        │
│  ├── taskHash: string                                       │
│  ├── proofType: 'optimistic' | 'zk-proof' | 'tee'           │
│  ├── proofData: string                                      │
│  ├── validator: string                                      │
│  ├── status: 'pending' | 'verified' | 'failed'              │
│  └── timestamp: number                                      │
│                                                             │
│  Contract ABIs                                              │
│  ├── ERC8004_IDENTITY_ABI[]                                 │
│  ├── ERC8004_REPUTATION_ABI[]                               │
│  └── ERC8004_VALIDATION_ABI[]                               │
└─────────────────────────────────────────────────────────────┘
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Production Setup                         │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
    ┌───▼────┐         ┌────▼────┐        ┌────▼────┐
    │ Vercel │         │ Docker  │        │   CDN   │
    │  Edge  │         │Container│        │ Static  │
    └────────┘         └─────────┘        └─────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                    ┌───────▼────────┐
                    │  Next.js App   │
                    │   (Frontend)   │
                    └────────────────┘
                            │
                    ┌───────▼────────┐
                    │   User Browser │
                    │   + MetaMask   │
                    └────────────────┘
                            │
                    ┌───────▼────────┐
                    │   Ethereum     │
                    │   Network      │
                    └────────────────┘
```

## Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Frontend Validation                                        │
│  ├── Input sanitization                                     │
│  ├── Type checking (TypeScript)                             │
│  ├── URL validation                                         │
│  └── Form validation                                        │
│                                                             │
│  Web3 Security                                              │
│  ├── Wallet signature verification                          │
│  ├── Transaction preview                                    │
│  ├── Network validation                                     │
│  └── Contract address verification                          │
│                                                             │
│  Smart Contract Security                                    │
│  ├── Access control                                         │
│  ├── Reentrancy protection                                  │
│  ├── Input validation                                       │
│  └── Event emission                                         │
│                                                             │
│  Infrastructure Security                                    │
│  ├── HTTPS only                                             │
│  ├── Environment variables                                  │
│  ├── No private keys in code                                │
│  └── Secure RPC endpoints                                   │
└─────────────────────────────────────────────────────────────┘
```

## Performance Optimization

```
┌─────────────────────────────────────────────────────────────┐
│                    Optimization Strategy                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Frontend                                                   │
│  ├── Code splitting (Next.js automatic)                     │
│  ├── Image optimization                                     │
│  ├── Lazy loading components                                │
│  └── Minimal re-renders                                     │
│                                                             │
│  Data Loading                                               │
│  ├── Parallel contract calls                                │
│  ├── Batch reads where possible                             │
│  ├── In-memory caching                                      │
│  └── Efficient state updates                                │
│                                                             │
│  User Experience                                            │
│  ├── Loading states                                         │
│  ├── Optimistic updates (potential)                         │
│  ├── Error boundaries                                       │
│  └── Progressive enhancement                                │
└─────────────────────────────────────────────────────────────┘
```

## Extension Points

```
┌─────────────────────────────────────────────────────────────┐
│              Future Enhancement Locations                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. IPFS Integration                                        │
│     └── lib/ipfs.ts (new file)                              │
│                                                             │
│  2. GraphQL Indexer                                         │
│     └── lib/graphql.ts (new file)                           │
│                                                             │
│  3. Agent Communication                                     │
│     └── lib/messaging.ts (new file)                         │
│                                                             │
│  4. Advanced Search                                         │
│     └── components/AdvancedSearch.tsx                       │
│                                                             │
│  5. Analytics                                               │
│     └── lib/analytics.ts (new file)                         │
│                                                             │
│  6. Multi-language                                          │
│     └── lib/i18n/ (new directory)                           │
└─────────────────────────────────────────────────────────────┘
```
