"use client";

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CubeIcon,
  GlobeAltIcon,
  WrenchScrewdriverIcon,
  BoltIcon,
  ShieldCheckIcon,
  ArrowsRightLeftIcon,
  ChevronDownIcon,
  CommandLineIcon,
  CpuChipIcon,
  CurrencyDollarIcon,
  RocketLaunchIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  ServerStackIcon,
  KeyIcon,
  CircleStackIcon,
  SparklesIcon,
  FolderOpenIcon,
  Cog6ToothIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline';

/* ─── types ─── */
type TabKey = 'overview' | 'framework' | 'app' | 'architecture' | 'tokenomics' | 'quickstart';

interface DocSection {
  id: string;
  title: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color: string;
  blocks: ContentBlock[];
}

type ContentBlock =
  | { kind: 'text'; value: string }
  | { kind: 'code'; lang: string; value: string }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  | { kind: 'list'; items: string[] };

/* ─── tab definitions ─── */
const TABS: { key: TabKey; label: string; prefix: string }[] = [
  { key: 'overview', label: 'OVERVIEW', prefix: 'OVR' },
  { key: 'framework', label: 'FRAMEWORK', prefix: 'FRM' },
  { key: 'app', label: 'CORE APP', prefix: 'APP' },
  { key: 'architecture', label: 'ARCHITECTURE', prefix: 'ARC' },
  { key: 'tokenomics', label: 'TOKENOMICS', prefix: 'TKN' },
  { key: 'quickstart', label: 'GET STARTED', prefix: 'GO!' },
];

/* ─── content by tab ─── */
const tabSections: Record<TabKey, DocSection[]> = {
  /* ────────── OVERVIEW ────────── */
  overview: [
    {
      id: 'what-is-mod',
      title: 'What is Mod?',
      icon: CubeIcon,
      color: '#a78bfa',
      blocks: [
        { kind: 'text', value: 'MOD Protocol is like GitHub meets AWS Lambda meets Crypto — a decentralized marketplace where developers can publish code modules and get paid every time someone uses them.' },
        { kind: 'text', value: 'It combines a module registry, an AI chat interface, a multi-chain wallet, and a quest system into one unified experience. Modules are self-contained units of logic — functions, APIs, smart contracts, or AI agents — that can be created, forked, and composed together.' },
        { kind: 'list', items: [
          'Publish code to IPFS (permanent, decentralized storage)',
          'Set a price per execution (micropayments)',
          'Earn automatically when people use your modules',
          'Verify everything with cryptographic signatures',
        ]},
      ],
    },
    {
      id: 'the-problem',
      title: 'The Problem',
      icon: BoltIcon,
      color: '#ef4444',
      blocks: [
        { kind: 'text', value: "Today's internet is dominated by centralized platforms that control your data, code, and revenue. Developers can't easily monetize their work, users can't verify what code is running, and apps break when companies shut down services." },
        { kind: 'table', headers: ['Traditional Cloud', 'MOD Protocol'], rows: [
          ['AWS charges you', 'You charge users'],
          ['Code can disappear', 'Stored forever on IPFS'],
          ['Trust Amazon', 'Verify cryptographically'],
          ['Complex billing', 'Automatic micropayments'],
          ['Vendor lock-in', 'Use any module'],
        ]},
      ],
    },
    {
      id: 'key-features',
      title: 'Key Features',
      icon: SparklesIcon,
      color: '#10b981',
      blocks: [
        { kind: 'table', headers: ['Feature', 'Description'], rows: [
          ['AI Chat Interface', 'Interact with modules through natural language with resizable split panels'],
          ['Module Marketplace', 'Discover, fork, deploy, and version-control modules'],
          ['Treasury System', 'Manage deposits, withdrawals, and on-chain billing'],
          ['Multi-Wallet Support', 'MetaMask, Phantom, SubWallet, and local browser keys'],
          ['Multi-Network', 'Substrate (Polkadot), EVM, and Solana chain support'],
          ['Transaction Tracking', 'Real-time monitoring with Recharts visualizations'],
          ['Key Management', 'ECDSA & SR25519 key generation, signing, and verification'],
          ['Smart Contracts', 'On-chain Registry, Market, Treasury, Token, and TokenGate'],
          ['Quests & Rewards', 'Structured challenges with leaderboards and token bounties'],
        ]},
      ],
    },
    {
      id: 'use-cases',
      title: 'Use Cases',
      icon: RocketLaunchIcon,
      color: '#f59e0b',
      blocks: [
        { kind: 'text', value: 'MOD Protocol supports a wide range of decentralized application patterns:' },
        { kind: 'list', items: [
          'AI Models — Train a model, publish it, earn passive income per query ($0.05/call)',
          'Data APIs — Build a crypto price aggregator, traders pay $0.001 per price check',
          'Utility Functions — Image optimizer, PDF converter, etc. — pay per use',
          'Decentralized Oracles — Price feeds, weather data, any off-chain data on-chain',
          'Data Pipelines — Chain scraper → NLP → storage modules together',
          'Indie Developers — "Build once, earn forever. No marketing, no servers, just code."',
          'Businesses — "Pay only for what you use. No monthly subscriptions, no vendor lock-in."',
        ]},
      ],
    },
    {
      id: 'how-it-works',
      title: 'How It Works',
      icon: ArrowsRightLeftIcon,
      color: '#3b82f6',
      blocks: [
        { kind: 'text', value: 'A typical execution flow in 5 steps:' },
        { kind: 'code', lang: 'text', value: `1. Developer uploads "image_resizer" module
2. User calls: resize_image(photo.jpg, width=800)
3. MOD executes the code in a sandboxed environment
4. User pays $0.01 in tokens
5. Developer gets $0.007, protocol gets $0.003` },
        { kind: 'text', value: 'Revenue split: 70% to module creator, 20% to protocol treasury, 10% to infrastructure providers.' },
      ],
    },
  ],

  /* ────────── FRAMEWORK ────────── */
  framework: [
    {
      id: 'cli-commands',
      title: 'CLI Commands',
      icon: CommandLineIcon,
      color: '#10b981',
      blocks: [
        { kind: 'text', value: 'The Mod framework provides a CLI tool (m or c) for all common operations. Install with pip install -e ./ from the mod root.' },
        { kind: 'code', lang: 'bash', value: `# Server Management
m serve api              # Serve API on port 8000
m kill api              # Stop server
m killall               # Stop all servers
m servers               # List running servers
m namespace             # Show module → URL mapping

# Module Information
m dp api                # Get directory path
m code api              # Get class code
m code api/function     # Get function code
m schema api/function   # Get function schema
m content api           # Get full module content
m info api              # Get complete module info
m mods                  # List all modules

# Module Operations
m addmod <path>         # Add module from path/GitHub
m rmmod <name>          # Remove module
m cpmod from to         # Copy module
m clone <url>           # Clone from GitHub

# Development
m app                   # Deploy application
m test <mod>            # Run tests
m push "message"        # Git commit and push

# AI Integration
m ask "question"        # Ask AI (OpenRouter)
m help mod "question"   # Get help about module
m about mod "query"     # Ask about module` },
      ],
    },
    {
      id: 'module-management',
      title: 'Module Management (Python)',
      icon: WrenchScrewdriverIcon,
      color: '#a78bfa',
      blocks: [
        { kind: 'text', value: 'Modules are the core building blocks. Each module encapsulates a specific capability — from simple utility functions to full AI agents.' },
        { kind: 'code', lang: 'python', value: `import mod as m

# List and discover modules
modules = m.mods()                    # All modules
core_mods = m.core_mods()            # Core modules only
local_mods = m.local_mods()          # Local modules only

# Module info
info = m.info('module_name')         # Complete module info
schema = m.schema('module_name')     # Function signatures
code = m.code('module_name')         # Source code
content = m.content('module_name')   # All files (file2content)
cid = m.cid('module_name')          # Content hash

# Check existence
exists = m.mod_exists('module_name')
is_file = m.is_mod_file('module_name')` },
        { kind: 'text', value: 'Modules follow an "anchor file" pattern — the main file can be named mod.py, agent.py, block.py, or match the module name.' },
        { kind: 'code', lang: 'text', value: `mods/
├── my_module/
│   ├── mod.py          # Anchor file (main class)
│   ├── config.json     # Configuration
│   ├── README.md       # Documentation
│   └── utils.py        # Helpers` },
      ],
    },
    {
      id: 'function-execution',
      title: 'Function Execution',
      icon: BoltIcon,
      color: '#f59e0b',
      blocks: [
        { kind: 'code', lang: 'python', value: `# Get and call functions
fn = m.fn('module/function')
result = fn(param='value')

# Alternative syntax
result = m.fn('module/').forward()   # Calls module.forward()
result = m.fn('/function')           # Calls mod.function()

# Check if function exists
if m.isfn('module/function'):
    result = m.fn('module/function')()

# Get function schema
schema = m.fnschema('module/function')
# Returns: {'input': {...}, 'output': {...}, 'docs': '...'}` },
        { kind: 'text', value: 'Functions can also be submitted asynchronously for background processing.' },
        { kind: 'code', lang: 'python', value: `# Async execution
future = m.submit('module/function', params={'key': 'val'})
result = future.result()

# Custom executor (thread, process, or async)
executor = m.mod('executor')(mode='thread', max_workers=10)` },
      ],
    },
    {
      id: 'server-management',
      title: 'Server Management',
      icon: ServerStackIcon,
      color: '#3b82f6',
      blocks: [
        { kind: 'code', lang: 'python', value: `# Serve modules
m.serve('api', port=8000)
m.serve('model.openrouter', remote=True)

# Server info
servers = m.servers()                 # List active servers
namespace = m.namespace()             # Module → URL mapping
exists = m.server_exists('api')

# Control servers
m.kill('api')                        # Stop specific server
m.kill_all()                         # Stop all servers` },
      ],
    },
    {
      id: 'crypto-keys',
      title: 'Cryptography & Keys',
      icon: KeyIcon,
      color: '#ec4899',
      blocks: [
        { kind: 'code', lang: 'python', value: `# Key management
key = m.get_key('my_key')
address = key.address
keys = m.keys()

# Sign and verify
signature = m.sign({'data': 'value'}, key='my_key')
is_valid = m.verify(
    data={'data': 'value'},
    signature=signature,
    address=address
)

# Encrypt/decrypt
encrypted = m.encrypt('secret', key='my_key', password='pwd')
decrypted = m.decrypt(encrypted, key='my_key', password='pwd')

# Generate mnemonic
mnemonic = m.mnemonic(words=24)` },
      ],
    },
    {
      id: 'storage-caching',
      title: 'Storage & Caching',
      icon: CircleStackIcon,
      color: '#06b6d4',
      blocks: [
        { kind: 'code', lang: 'python', value: `# Store with optional encryption
m.put('key', {'data': 'value'}, encrypt=True, password='pwd')

# Retrieve with max age (seconds)
data = m.get('key', default={}, max_age=3600)

# Storage paths
storage_dir = m.storage_dir('module_name')  # ~/.mod/module_name
path = m.get_path('my_data')` },
        { kind: 'text', value: 'File operations:' },
        { kind: 'code', lang: 'python', value: `# Read/write
content = m.text('/path/to/file')
m.put_text('/path/to/file', 'content')

# JSON
m.put_json('config', {'key': 'value'})
data = m.get_json('config', default={})

# File listing
files = m.files('./path', search='*.py', depth=4)
dirs = m.ls('./path')
all_files = m.glob('./path/**/*.py')` },
      ],
    },
    {
      id: 'ai-integration',
      title: 'AI Integration',
      icon: SparklesIcon,
      color: '#8b5cf6',
      blocks: [
        { kind: 'code', lang: 'python', value: `# Ask questions
answer = m.ask("How does this work?", stream=True)
answer = m.ask("Explain", mod='api', context=True)

# Module-specific help
help_text = m.help('module', 'what does this do?')
about = m.about('module', 'explain this feature')

# Code analysis
how = m.how('module', 'how does function X work?')` },
      ],
    },
    {
      id: 'git-ops',
      title: 'Git Operations',
      icon: CodeBracketIcon,
      color: '#f97316',
      blocks: [
        { kind: 'code', lang: 'python', value: `# Push changes
m.push("commit message", mod='module_name')
m.push("fix bug", "and update docs", safety=True)

# Repository info
is_repo = m.isrepo('module_name')
git_info = m.git_info(path='./repo')
repos = m.repos(search='mod')

# Clone repositories
m.clone('https://github.com/user/repo')
m.clone('user/repo')  # Auto-adds github.com` },
      ],
    },
  ],

  /* ────────── CORE APP ────────── */
  app: [
    {
      id: 'app-overview',
      title: 'Core App Overview',
      icon: CubeIcon,
      color: '#a78bfa',
      blocks: [
        { kind: 'text', value: 'The Mod Core App is a decentralized module marketplace and AI-powered development platform built on Next.js 14 with React 18, TypeScript 5.3, and Tailwind CSS.' },
        { kind: 'table', headers: ['Feature', 'Description'], rows: [
          ['AI Chat Interface', 'Resizable split panels, module selector, schema editor, voice input, transaction history'],
          ['Module Marketplace', 'Visual module cards, admin panel, version control, CID-based content storage, fork & create'],
          ['User System', 'Profile pages, multi-wallet auth, billing & credits, module registry, portfolio'],
          ['Wallet Integration', 'MetaMask (EVM), Phantom (Solana), SubWallet (Polkadot), Local browser keys'],
        ]},
      ],
    },
    {
      id: 'project-structure',
      title: 'Project Structure',
      icon: FolderOpenIcon,
      color: '#10b981',
      blocks: [
        { kind: 'code', lang: 'text', value: `src/
├── app/                    # Next.js App Router pages
│   ├── chat/              # AI chat interface
│   ├── docs/              # Documentation (this page)
│   ├── mod/               # Module detail & explore pages
│   ├── user/              # User profile pages
│   ├── network/           # Network overview
│   ├── treasury/          # Treasury & deposits
│   ├── transactions/      # Transaction history
│   ├── buidl/             # Module builder
│   ├── quests/            # Quest system with API docs
│   └── home/              # Landing page
├── chat/                  # Chat system (components, hooks, types)
├── mod/                   # Module management (API, editor, versions)
├── user/                  # User system (admin, billing, portfolio)
├── wallet/                # Wallet adapters (MetaMask, Phantom, etc.)
├── network/               # Network config & contract interfaces
├── client/                # API client (HTTP, auth, token refresh)
├── contracts/             # Smart contract ABIs
├── context/               # React contexts (User, Theme, Sidebar, etc.)
├── key/                   # Key management (ECDSA, SR25519)
├── header/                # Header, SearchBar, Logo
├── components/            # Shared components (Sidebar, ThemeToggle)
├── ui/                    # Base UI primitives (Loading, CopyButton, QR)
├── types/                 # Shared TypeScript types
└── config.json            # API & network configuration` },
      ],
    },
    {
      id: 'tech-stack',
      title: 'Tech Stack',
      icon: CpuChipIcon,
      color: '#3b82f6',
      blocks: [
        { kind: 'table', headers: ['Layer', 'Technology', 'Purpose'], rows: [
          ['Framework', 'Next.js 14', 'React framework with App Router'],
          ['UI', 'React 18', 'Component library'],
          ['Language', 'TypeScript 5.3', 'Type safety'],
          ['Styling', 'Tailwind CSS 3.4', 'Utility-first styling'],
          ['Animation', 'Framer Motion', 'Smooth transitions'],
          ['Charts', 'Recharts', 'Data visualization'],
          ['EVM', 'Ethers.js 6.13', 'Ethereum/EVM interaction'],
          ['Substrate', '@polkadot/api', 'Polkadot chain interaction'],
          ['Icons', 'Heroicons + Lucide', 'Icon libraries'],
          ['DnD', '@dnd-kit', 'Drag and drop'],
          ['Notifications', 'React Toastify', 'Toast notifications'],
          ['Numbers', 'BigNumber.js', 'Precise number handling'],
        ]},
      ],
    },
    {
      id: 'app-config',
      title: 'Configuration',
      icon: Cog6ToothIcon,
      color: '#f59e0b',
      blocks: [
        { kind: 'text', value: 'Environment variables (.env.local):' },
        { kind: 'code', lang: 'bash', value: `NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_CHAIN_ENDPOINT=ws://localhost:9944
NEXT_PUBLIC_NETWORK=local` },
        { kind: 'text', value: 'Available npm scripts:' },
        { kind: 'table', headers: ['Command', 'Description'], rows: [
          ['npm run dev', 'Start development server with hot reload'],
          ['npm run build', 'Create optimized production build'],
          ['npm run start', 'Start production server'],
          ['npm run lint', 'Run ESLint checks'],
          ['npm run format', 'Check code formatting (Prettier)'],
          ['npm run format:fix', 'Auto-fix code formatting'],
        ]},
      ],
    },
    {
      id: 'smart-contracts',
      title: 'Smart Contracts',
      icon: DocumentTextIcon,
      color: '#ec4899',
      blocks: [
        { kind: 'text', value: 'Mod deploys five core smart contracts on-chain:' },
        { kind: 'table', headers: ['Contract', 'Purpose'], rows: [
          ['Registry', 'Module registration, versioning, and discovery'],
          ['Market', 'Module marketplace — pricing, purchasing, and revenue distribution'],
          ['Treasury', 'Protocol treasury — deposits, withdrawals, and fee collection'],
          ['Token', 'MOD ERC-20 token for payments and governance'],
          ['TokenGate', 'Access control — gate module usage by token holdings'],
        ]},
        { kind: 'text', value: 'Contract ABIs are stored in src/contracts// and accessed via Ethers.js.' },
      ],
    },
    {
      id: 'wallet-details',
      title: 'Wallet Integration',
      icon: ShieldCheckIcon,
      color: '#06b6d4',
      blocks: [
        { kind: 'text', value: 'The wallet system uses a unified adapter pattern, supporting four wallet types:' },
        { kind: 'table', headers: ['Wallet', 'Ecosystem', 'Key Type'], rows: [
          ['MetaMask', 'Ethereum / EVM chains', 'ECDSA (secp256k1)'],
          ['Phantom', 'Solana', 'Ed25519'],
          ['SubWallet', 'Polkadot / Substrate', 'SR25519'],
          ['Local Keys', 'Browser-based', 'ECDSA & SR25519'],
        ]},
        { kind: 'text', value: 'Authentication flow: Connect wallet → Sign message → Server verifies signature → JWT issued → Auto-refresh on expiry.' },
      ],
    },
  ],

  /* ────────── ARCHITECTURE ────────── */
  architecture: [
    {
      id: 'core-components',
      title: 'Core Components',
      icon: ServerStackIcon,
      color: '#a78bfa',
      blocks: [
        { kind: 'text', value: 'MOD Protocol is built on four layers:' },
        { kind: 'table', headers: ['Layer', 'Technology', 'Responsibility'], rows: [
          ['Storage', 'IPFS', 'Content-addressed storage, immutable version history, distributed availability'],
          ['Authentication', 'SR25519 / ECDSA', 'Signature schemes, token-based authorization, address-based identity'],
          ['Execution', 'Python runtime', 'Async task processing, local & remote execution, result caching'],
          ['Registry', 'Smart contracts', 'Module discovery, versioning, owner-based access control, schema validation'],
        ]},
      ],
    },
    {
      id: 'data-flow',
      title: 'Data Flow',
      icon: ArrowsRightLeftIcon,
      color: '#3b82f6',
      blocks: [
        { kind: 'code', lang: 'text', value: `User → Token Generation → API Call → Task Creation →
IPFS Storage → Execution → Result Storage → User` },
        { kind: 'text', value: 'The frontend communicates with the backend via REST APIs and WebSocket connections for real-time updates. Modules are executed in sandboxed environments and their outputs are validated before being committed on-chain.' },
      ],
    },
    {
      id: 'module-registration',
      title: 'Module Registration',
      icon: DocumentTextIcon,
      color: '#10b981',
      blocks: [
        { kind: 'text', value: 'When a module is registered, the following process occurs:' },
        { kind: 'list', items: [
          'Hash all module files to IPFS (content addressing)',
          'Generate function schema from code introspection',
          'Create a signed info object with owner key',
          'Update the on-chain registry contract',
        ]},
        { kind: 'code', lang: 'python', value: `info = api.reg(
    mod="mymodule",
    key=owner_key,
    comment="Initial release"
)` },
        { kind: 'text', value: 'Each version links to its predecessor, creating an immutable audit trail:' },
        { kind: 'code', lang: 'text', value: `v3 (current) → v2 → v1 → genesis` },
      ],
    },
    {
      id: 'function-exposure',
      title: 'Function Exposure & Schema',
      icon: CodeBracketIcon,
      color: '#f59e0b',
      blocks: [
        { kind: 'text', value: 'Modules declare callable functions with typed schemas:' },
        { kind: 'code', lang: 'json', value: `{
  "fns": ["forward", "train", "predict"],
  "schema": {
    "forward": {
      "input": {"type": "string"},
      "output": {"type": "object"}
    }
  }
}` },
      ],
    },
    {
      id: 'security-model',
      title: 'Security Model',
      icon: ShieldCheckIcon,
      color: '#ef4444',
      blocks: [
        { kind: 'text', value: 'Every transaction in MOD is cryptographically signed and verified:' },
        { kind: 'code', lang: 'python', value: `# Signature generation
signature = key.sign(data, mode="str")

# Verification
valid = verify(data, signature, address, mode="str")` },
        { kind: 'text', value: 'Access control operates at three levels:' },
        { kind: 'list', items: [
          'Owner-based — Only module owner can update or delete',
          'Function-level — Whitelist which functions are exposed',
          'Token-gated — Require payment or token holdings for execution',
        ]},
        { kind: 'text', value: 'Attack mitigations:' },
        { kind: 'list', items: [
          'Replay protection via timestamp validation',
          'Signature verification on every transaction',
          'Per-user rate limiting',
          'Sandboxed execution environments',
          'Client-side key management (keys never leave the browser)',
        ]},
      ],
    },
    {
      id: 'governance',
      title: 'Governance',
      icon: GlobeAltIcon,
      color: '#8b5cf6',
      blocks: [
        { kind: 'text', value: 'Protocol governance follows a structured proposal process:' },
        { kind: 'list', items: [
          'Proposal — Community submits improvement proposals',
          'Voting — Token-weighted governance votes',
          'Implementation — Phased rollout with testing periods',
          'Challenge Period — 7-day window for module updates',
          'Dispute Resolution — Community arbitration with slashing for malicious actors',
          'Treasury Management — On-chain transparency for all protocol spending',
        ]},
      ],
    },
  ],

  /* ────────── TOKENOMICS ────────── */
  tokenomics: [
    {
      id: 'token-structure',
      title: 'Token Structure',
      icon: CurrencyDollarIcon,
      color: '#f59e0b',
      blocks: [
        { kind: 'text', value: 'The MOD Token is an ERC-20 token that powers all interactions in the protocol. Every API call includes a signed token with the following structure:' },
        { kind: 'code', lang: 'text', value: `key::to::cost::time::data::signature

Components:
  key       Sender's address (SS58 or hex)
  to        Recipient module/user
  cost      Execution cost in tokens
  time      Unix timestamp
  data      JSON payload
  signature Cryptographic proof` },
      ],
    },
    {
      id: 'cost-model',
      title: 'Cost Model',
      icon: CircleStackIcon,
      color: '#10b981',
      blocks: [
        { kind: 'text', value: 'Execution costs are composed of four components:' },
        { kind: 'table', headers: ['Component', 'Description'], rows: [
          ['Base Cost', 'Minimum fee per function call'],
          ['Compute Cost', 'Based on execution time and resources'],
          ['Storage Cost', 'IPFS pinning fees for persisted data'],
          ['Network Cost', 'Cross-module communication overhead'],
        ]},
        { kind: 'text', value: 'Most calls cost between $0.001 and $0.01. Module owners set their own pricing.' },
      ],
    },
    {
      id: 'revenue-distribution',
      title: 'Revenue Distribution',
      icon: ArrowsRightLeftIcon,
      color: '#a78bfa',
      blocks: [
        { kind: 'table', headers: ['Recipient', 'Share', 'Purpose'], rows: [
          ['Module Owner', '70%', 'Revenue for the developer who created the module'],
          ['Protocol Treasury', '20%', 'Funds protocol development and maintenance'],
          ['Infrastructure Providers', '10%', 'Rewards for running execution nodes'],
        ]},
        { kind: 'text', value: 'Treasury allocation is governed by community vote. All transactions are visible on-chain for full transparency.' },
      ],
    },
    {
      id: 'staking',
      title: 'Staking & Governance',
      icon: ShieldCheckIcon,
      color: '#ec4899',
      blocks: [
        { kind: 'text', value: 'MOD tokens serve multiple purposes within the protocol:' },
        { kind: 'list', items: [
          'Pay for function executions (micropayments)',
          'Earn from published modules (passive income)',
          'Vote on protocol upgrades (governance)',
          'Stake for higher revenue share',
          'Gate access to premium modules (TokenGate)',
        ]},
      ],
    },
  ],

  /* ────────── GET STARTED ────────── */
  quickstart: [
    {
      id: 'install-framework',
      title: 'Install the Framework',
      icon: CommandLineIcon,
      color: '#10b981',
      blocks: [
        { kind: 'text', value: 'Requirements: Python 3.11+, Docker and docker-compose. Optional: VSCode, Git.' },
        { kind: 'code', lang: 'bash', value: `git clone <repository-url>
cd ~/mod
pip install -e ./` },
        { kind: 'text', value: 'Once installed, the m (or c) CLI is available globally.' },
      ],
    },
    {
      id: 'run-core-app',
      title: 'Run the Core App',
      icon: RocketLaunchIcon,
      color: '#3b82f6',
      blocks: [
        { kind: 'text', value: 'Requirements: Node.js 18+, npm or yarn.' },
        { kind: 'code', lang: 'bash', value: `cd mod/core/app
npm install
npm run dev
# App available at http://localhost:3000` },
        { kind: 'text', value: 'Or deploy with Docker:' },
        { kind: 'code', lang: 'bash', value: `docker-compose up -d   # Build and run
docker-compose logs -f  # View logs
docker-compose down     # Stop` },
      ],
    },
    {
      id: 'create-module',
      title: 'Create Your First Module',
      icon: WrenchScrewdriverIcon,
      color: '#a78bfa',
      blocks: [
        { kind: 'code', lang: 'bash', value: `# Clone a template
m clone https://github.com/user/template
m cpmod template my_module

# Develop
m code my_module          # View code
m serve my_module         # Test server
m test my_module          # Run tests

# Deploy
m app my_module           # Deploy app
m push "Initial release"  # Git commit and push` },
      ],
    },
    {
      id: 'publish-module',
      title: 'Publish & Monetize',
      icon: CurrencyDollarIcon,
      color: '#f59e0b',
      blocks: [
        { kind: 'text', value: 'Register your module on-chain and start earning:' },
        { kind: 'code', lang: 'python', value: `import mod as m

# Register module
api = m.mod('api')()
api.reg(mod="my_awesome_function")
# Done! Now earn money when people use it` },
        { kind: 'text', value: 'Users can call your module with just two lines:' },
        { kind: 'code', lang: 'python', value: `api = m.mod('api')()
result = api.call(fn="my_awesome_function/forward", params={"input": "hello"})` },
      ],
    },
    {
      id: 'connect-wallet',
      title: 'Connect & Use the App',
      icon: ShieldCheckIcon,
      color: '#ec4899',
      blocks: [
        { kind: 'list', items: [
          'Visit the app at the deployed URL or localhost:3000',
          'Click the wallet button to connect MetaMask, Phantom, SubWallet, or create local keys',
          'Browse modules in the Explore page',
          'Try the AI Chat to interact with modules through natural language',
          'Check Quests for guided challenges and token bounties',
          'Use the Treasury page to manage deposits and withdrawals',
        ]},
      ],
    },
    {
      id: 'best-practices',
      title: 'Best Practices',
      icon: BookOpenIcon,
      color: '#06b6d4',
      blocks: [
        { kind: 'list', items: [
          'Module Naming — Use dot notation (e.g., model.openrouter)',
          'Anchor Files — Name the main file mod.py or match the module name',
          'Configuration — Always include config.json with module metadata',
          'Documentation — Add README.md to each module',
          'Security — Use encryption for sensitive data storage',
          'Testing — Write tests for all critical functionality (m test <mod>)',
        ]},
      ],
    },
  ],
};

/* ─── renderers ─── */

function CodeBlock({ lang, value }: { lang: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group overflow-hidden rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
      <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <span className="text-[10px] font-mono uppercase tracking-widest opacity-50" style={{ color: 'var(--accent-primary, #10b981)' }}>{lang}</span>
        <button onClick={copy} className="text-[10px] font-mono opacity-40 hover:opacity-100 transition-all hover:text-emerald-400">
          {copied ? 'copied!' : 'copy'}
        </button>
      </div>
      <pre className="px-4 py-3 overflow-x-auto text-[13px] leading-relaxed font-mono whitespace-pre" style={{ color: 'var(--text-primary)' }}>
        {value}
      </pre>
    </div>
  );
}

function TableBlock({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border-color)' }}>
      <table className="w-full">
        <thead>
          <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
            {headers.map((h, i) => (
              <th key={i} className="text-left px-4 py-2.5 font-semibold uppercase text-[11px] tracking-wider" style={{ color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="transition-colors" style={{ borderBottom: '1px solid var(--border-color)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-[13px]" style={{ color: j === 0 ? 'var(--text-primary)' : 'var(--text-secondary)', fontFamily: j === 0 ? "'JetBrains Mono', monospace" : 'Inter, sans-serif' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BlockRenderer({ block }: { block: ContentBlock }) {
  switch (block.kind) {
    case 'text':
      return <p className="text-[14px] leading-[1.7]" style={{ color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}>{block.value}</p>;
    case 'code':
      return <CodeBlock lang={block.lang} value={block.value} />;
    case 'table':
      return <TableBlock headers={block.headers} rows={block.rows} />;
    case 'list':
      return (
        <ul className="space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-[14px] leading-[1.7]" style={{ color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}>
              <span className="shrink-0 mt-[2px]" style={{ color: 'var(--accent-primary, #10b981)' }}>&#x2022;</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
  }
}

/* ─── section accordion ─── */

function Section({ section, isExpanded, onToggle, index }: {
  section: DocSection;
  isExpanded: boolean;
  onToggle: () => void;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.03 }}
      className="border-b transition-all"
      style={{ borderColor: 'var(--border-color)', borderLeft: isExpanded ? `3px solid ${section.color}` : '3px solid transparent' }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 py-4 px-2 text-left transition-all group"
      >
        <span className="text-[11px] font-mono shrink-0 w-6 text-right" style={{ color: isExpanded ? section.color : 'var(--text-tertiary)' }}>{String(index + 1).padStart(2, '0')}</span>
        <h2 className="flex-1 text-xl uppercase tracking-[0.15em] group-hover:opacity-100 transition-all font-semibold" style={{ color: isExpanded ? 'var(--text-primary)' : 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', textShadow: isExpanded ? `0 0 30px ${section.color}40` : 'none' }}>
          {section.title}
        </h2>
        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDownIcon className="w-4 h-4" style={{ color: isExpanded ? section.color : 'var(--text-tertiary)' }} />
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="pb-5 pl-12 pr-2 space-y-4">
              {section.blocks.map((block, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <BlockRenderer block={block} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── main page ─── */

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const sections = tabSections[activeTab];

  // auto-expand first section when switching tabs
  const handleTabChange = (key: TabKey) => {
    setActiveTab(key);
    const first = tabSections[key]?.[0];
    setExpandedId(first?.id ?? null);
  };

  // filter sections by search
  const filteredSections = useMemo(() => {
    if (!search.trim()) return sections;
    const q = search.toLowerCase();
    return sections.filter(s => {
      if (s.title.toLowerCase().includes(q)) return true;
      return s.blocks.some(b => {
        if (b.kind === 'text' || b.kind === 'code') return b.value.toLowerCase().includes(q);
        if (b.kind === 'list') return b.items.some(i => i.toLowerCase().includes(q));
        if (b.kind === 'table') return b.headers.some(h => h.toLowerCase().includes(q)) || b.rows.some(r => r.some(c => c.toLowerCase().includes(q)));
        return false;
      });
    });
  }, [sections, search]);

  // auto-expand first on mount
  useState(() => {
    setExpandedId(tabSections.overview[0]?.id ?? null);
  });

  return (
    <div className="min-h-screen p-4 sm:p-8" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <div className="max-w-3xl mx-auto">
        {/* header */}
        <div className="mb-4">
          <p className="text-sm font-mono opacity-40 mb-1">$ mod docs</p>
          <p className="text-3xl font-semibold tracking-tight" style={{ fontFamily: 'Inter, sans-serif', color: 'var(--text-secondary)' }}>
            framework, app, architecture, tokenomics
          </p>
        </div>

        {/* search */}
        <div className="relative mb-4">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-mono opacity-30">/</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="search docs..."
            className="w-full pl-9 pr-4 py-3 text-sm focus:outline-none transition-all rounded-lg"
            style={{
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontFamily: 'Inter, sans-serif',
            }}
          />
        </div>

        {/* tabs */}
        <div className="flex flex-wrap gap-1 mb-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className="px-4 py-2.5 text-base uppercase tracking-[0.12em] transition-all border-b-2 font-medium"
                style={{
                  color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  borderColor: isActive ? 'var(--text-primary)' : 'transparent',
                  marginBottom: '-1px',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* section count */}
        {search.trim() && (
          <p className="text-xs mb-3 opacity-40" style={{ fontFamily: 'Inter, sans-serif' }}>
            {filteredSections.length} result{filteredSections.length !== 1 ? 's' : ''} for &quot;{search}&quot;
          </p>
        )}

        {/* sections */}
        <div>
          {filteredSections.map((section, index) => (
            <Section
              key={section.id}
              section={section}
              isExpanded={expandedId === section.id}
              onToggle={() => setExpandedId(expandedId === section.id ? null : section.id)}
              index={index}
            />
          ))}
          {filteredSections.length === 0 && (
            <div className="text-center py-16 text-sm opacity-30" style={{ fontFamily: 'Inter, sans-serif' }}>
              no results found
            </div>
          )}
        </div>

        {/* footer */}
        <div className="mt-8 pt-4 border-t text-center" style={{ borderColor: 'var(--border-color)' }}>
          <p className="text-xs font-mono uppercase tracking-[0.3em] opacity-20">
            mod protocol
          </p>
        </div>
      </div>
    </div>
  );
}
