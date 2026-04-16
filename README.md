<div align="center">

```
 _____ _______ ______
|     |       |      \
| | | |   -   |   -  |
|_|_|_|_______|______/
```

# Modular Operating Daemon

**Build modules. Register on-chain. Get paid when people use them.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-yellow.svg)](https://python.org)
[![Solidity 0.8.20](https://img.shields.io/badge/solidity-0.8.20-363636.svg)](https://soliditylang.org)
[![Next.js 14](https://img.shields.io/badge/next.js-14-black.svg)](https://nextjs.org)
[![Base Sepolia](https://img.shields.io/badge/chain-Base%20Sepolia-0052FF.svg)](https://base.org)

[Quick Start](#quick-start) • [Documentation](#documentation) • [Architecture](#architecture) • [CLI Reference](#cli)

</div>

---

## What is MOD?

MOD is a **modular development framework** that turns code into programmable money. Write a Python module, register it on-chain, set your price—earn revenue every time someone uses it.

Think **npm meets blockchain**: composable modules with built-in monetization.

**The Flow:**
```
Developer          MOD Protocol        Users
   │                    │                │
   ├─ write module ────>│                │
   ├─ set price ───────>│                │
   │                    ├─ register ────>│
   │                    │  on-chain      │
   │                    │<─── call fn ───┤
   │                    │<─── pay token ─┤
   │<──── revenue ──────┤                │
```

### Why MOD?

- 🧩 **200+ Orbit Modules** — AI agents, DeFi protocols, IPFS storage, web3 bridges, prediction markets
- ⛓️ **On-Chain Registry** — Immutable module marketplace with payments & governance (Base Sepolia)
- 🚀 **Zero-Config Deployment** — `m serve <module>` auto-generates API endpoints, no boilerplate
- 🔐 **Security First** — AES-256 encryption, ED25519 signatures, role-based access, ReentrancyGuard
- 🤖 **AI-Native** — Claude integration, persistent agent memory, vector embeddings
- 💰 **Built-in Monetization** — Set pricing, receive payments, instant withdrawals (80/20 revenue split)

## Quick Start

### Prerequisites

- **Python 3.11+** — Core framework runtime
- **Node.js 18+** — Frontend & Hardhat tooling
- **Git** — Version control

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/mod.git
cd mod
pip install -e .
```

### 2. Start Core Services

Open **3 terminals** and run:

```bash
# Terminal 1: Local blockchain (Hardhat node + contracts)
cd mod/core/chain
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost

# Terminal 2: API server (FastAPI auto-routing)
m serve api
# → http://localhost:8000

# Terminal 3: Frontend (Next.js 14)
cd mod/core/app
npm install && npm run dev
# → http://localhost:3000
```

**You're now running the full stack:** smart contracts, API, and UI.

### 3. Explore Modules

```bash
m mods                    # List all 200+ modules
m info agent              # View module details (config, endpoints, dependencies)
m code agent              # Read source code
m serve agent             # Start agent server with auto-routing
```

Visit **http://localhost:3000** to browse the UI and interact with modules.

### 4. Use the Python API

```python
import mod as m

# Load any module dynamically
agent = m.mod('agent')()

# Call module functions (RPC-style)
result = m.fn('agent/chat')({'message': 'Explain MOD to me'})

# Start/stop servers programmatically
m.serve('api', port=8000)
m.kill('api')
```

**That's it!** You can now build, deploy, and monetize modules.

## Architecture

MOD is a **three-layer system**: user modules (Orbit), framework engine (Core), and on-chain protocol (Chain).

```
┌─────────────────────────────────────────────────────────┐
│ ORBIT — User Modules (200+)                             │
│ ┌──────────┬──────────┬──────────┬──────────┬─────────┐│
│ │  agent   │  claude  │   safe   │  bridge  │   web   ││
│ │  ipfs    │  cache   │  defi    │  uniswap │ goldfi  ││
│ │  prefi   │  squid   │hyperliquid│  zcash  │   ...   ││
│ └──────────┴──────────┴──────────┴──────────┴─────────┘│
│ Plug-and-play modules with auto-generated APIs           │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ CORE — Framework Engine                                 │
│ ┌──────────┬──────────┬──────────┬──────────┬─────────┐│
│ │  mod.py  │ utils.py │   api    │   app    │   cli   ││
│ │  store   │   key    │  router  │  server  │  gate   ││
│ └──────────┴──────────┴──────────┴──────────┴─────────┘│
│ Module loading • Crypto • Storage • Routing • Auth      │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ CHAIN — BlocTime Protocol (Base Sepolia)                │
│ ┌──────────┬──────────┬──────────┬──────────┬─────────┐│
│ │ Registry │  Market  │ Treasury │ BlocTime │ Oracles ││
│ │TokenGate │  Perms   │          │          │         ││
│ └──────────┴──────────┴──────────┴──────────┴─────────┘│
│ On-chain registry • Payments • Revenue splits • Staking │
└─────────────────────────────────────────────────────────┘
```

### Directory Structure

```
mod/
├── core/
│   ├── mod.py             # Framework engine (module loading, crypto, storage)
│   ├── utils.py           # Shared utilities (networking, async, system)
│   ├── chain/             # Solidity contracts (BlocTime Protocol)
│   ├── app/               # Next.js 14 frontend (TypeScript, Tailwind, ethers.js)
│   ├── api/               # FastAPI backend (auto-generated endpoints)
│   ├── server/            # Process & server management
│   ├── store/             # Encrypted key-value storage (AES-256)
│   ├── key/               # Crypto key management (ED25519, ECDSA, SR25519)
│   ├── cli/               # CLI interface (m command)
│   ├── router/            # API routing & gateway
│   ├── gate/              # Authentication & token gating
│   └── registry/          # Module registry (local + on-chain)
│
└── orbit/                 # 200+ modules (user & community)
    ├── agent/             # AI agents with memory & skills
    ├── claude/            # Claude API integration (Rust + React)
    ├── safe/              # Gnosis Safe multisig (on-chain + SDK)
    ├── bridge/            # Cross-chain bridges (Across, Squid, Hyperlane)
    ├── goldfi/            # Gold-backed stablecoin
    ├── prefi/             # Prediction markets
    ├── uniswap/           # Uniswap v3 integration
    ├── hyperliquid/       # Hyperliquid perpetual DEX
    ├── ipfs/              # IPFS storage
    ├── arweave/           # Permanent storage
    ├── web/               # Web scraping & automation
    └── ...                # 190+ more modules
```

## CLI Reference

### Module Discovery
```bash
m mods                    # list all 200+ modules
m info <module>           # module details (config, endpoints, dependencies)
m code <module>           # view module source code
m dp <module>             # get module directory path
```

### Server Management
```bash
m serve <module>          # start module server (auto-detects port)
m servers                 # list all running servers
m kill <module>           # stop a module server
m restart <module>        # restart a module server
```

### Development
```bash
m test <module>           # run module tests
m build <module>          # build module (Docker, npm, etc.)
m deploy <module>         # deploy module to registry
m logs <module>           # tail module logs
```

### Git Operations
```bash
m push "commit message"   # add, commit, and push
m status                  # git status
m diff                    # git diff
```

## Python API

### Module Loading
```python
import mod as m

# Load any module
agent = m.mod('agent')()
api = m.mod('api')()

# Call module functions
result = m.fn('agent/chat')({'message': 'Hello!'})
data = m.fn('api/fetch')({'url': 'https://example.com'})

# Get module info
info = m.info('agent')
code = m.code('agent')
```

### Server Management
```python
# Start servers
m.serve('api', port=8000)
m.serve('agent', port=8001)

# Check status
servers = m.servers()

# Stop servers
m.kill('api')
```

### Cryptography
```python
# Key management
key = m.get_key('my_key')              # get or create key
pub = m.get_pubkey('my_key')           # get public key

# Signing & verification
sig = m.sign({'data': 'value'}, key='my_key')
valid = m.verify(sig, {'data': 'value'}, pub)

# Encryption & decryption
encrypted = m.encrypt('secret', key='my_key')
decrypted = m.decrypt(encrypted, key='my_key')
```

### Storage
```python
# Simple key-value
m.put('user:123', {'name': 'Alice', 'balance': 100})
user = m.get('user:123')

# Encrypted storage
m.put('api_key', 'secret', encrypt=True)
key = m.get('api_key')

# JSON storage
m.put_json('config', {'port': 8000, 'host': 'localhost'})
config = m.get_json('config')
```

### AI & Agents
```python
# Ask Claude
response = m.ask('Explain how MOD works', model='claude')

# Load agent
agent = m.mod('agent')()
result = agent.chat('What can you do?')

# Use memory
m.fn('agent/remember')({'key': 'fact', 'value': 'MOD is awesome'})
memory = m.fn('agent/recall')({'query': 'MOD'})
```

## BlocTime Protocol

The **on-chain layer** for module registration, payments, and governance.

**Network:** Base Sepolia (testnet) • Chain ID `84532`
**Mainnet:** Base (coming soon)

### Smart Contracts

| Contract | Purpose | Features |
|----------|---------|----------|
| **Registry** | Module registration & management | Module metadata, versioning, ownership |
| **Market** | Module marketplace | Pricing, purchases, instant withdrawals |
| **Treasury** | Revenue distribution | Multi-token splits, revenue sharing |
| **BlocTime** | Staking & rewards | Time-multiplier rewards, governance weight |
| **TokenGate** | Access control | Token whitelist, payment requirements |
| **Perms** | Role-based access | Admin, developer, user roles |
| **Oracles** | Price feeds | Chainlink, Pyth, manual feeds |

Built with **Solidity 0.8.20** and **OpenZeppelin** contracts (Ownable, ReentrancyGuard, ECDSA).

### Payment Flow

1. **Register Module** — Developer submits metadata to Registry contract
2. **Set Price** — Module listed on Market with token price (ETH, USDC, etc.)
3. **User Calls Module** — Payment sent to Treasury on function call
4. **Revenue Split** — Automatic distribution: 80% developer, 20% protocol
5. **Instant Withdrawal** — No vesting, no delays—withdraw anytime

**Example:** User pays 0.01 ETH to call `agent/chat` → Developer receives 0.008 ETH instantly.

### Deployment

```bash
# 1. Local development
cd mod/core/chain
npx hardhat node                                      # terminal 1
npx hardhat run scripts/deploy.js --network localhost # terminal 2

# 2. Base Sepolia testnet
npx hardhat run scripts/deploy.js --network baseSepolia

# 3. Base mainnet (production)
npx hardhat run scripts/deploy.js --network base
```

### Verify Contracts

```bash
npx hardhat verify --network baseSepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

## Featured Orbit Modules

Explore **200+ production-ready modules** across AI, DeFi, infrastructure, and more.

### 🤖 AI & Agents
| Module | Description |
|--------|-------------|
| **agent** | Autonomous AI agents with memory, skills, and multi-step planning |
| **claude** | Claude API integration (Rust backend + React UI) |
| **memory** | Vector embeddings for semantic search & retrieval |
| **search** | LLM-powered module search — find the best module for any task (free tier) |

### 💰 DeFi & Blockchain
| Module | Description |
|--------|-------------|
| **safe** | Gnosis Safe multisig wallet integration (ethers.js + ABI) |
| **uniswap** | Uniswap v3 trading, liquidity pools, and analytics |
| **goldfi** | Gold-backed stablecoin protocol (XAU pegged) |
| **prefi** | Prediction markets with automated market maker |
| **bridge** | Cross-chain bridges (Across, Squid, Hyperlane) |
| **hyperliquid** | Hyperliquid perpetual DEX integration |
| **zcash** | Privacy-preserving transactions via Zcash |

### 🔧 Infrastructure
| Module | Description |
|--------|-------------|
| **ipfs** | Decentralized file storage & retrieval (IPFS/Filecoin) |
| **cache** | Distributed caching with Redis/Memcached |
| **web** | Web scraping, automation, and browser control |
| **api** | HTTP client with authentication & rate limiting |
| **db** | Database integrations (PostgreSQL, Redis, MongoDB) |

**[Browse all modules →](mod/orbit/)** | **[Create your own →](docs/MODULE_GUIDE.md)**

## Security

MOD is built with **security-first principles** at every layer.

### Cryptography
- **AES-256-GCM** encryption for sensitive data storage
- **ED25519, ECDSA, SR25519** signature schemes
- **Client-side key generation** — private keys never transmitted
- **HMAC-based authentication** for API requests

### Smart Contracts
- Built on **OpenZeppelin** audited libraries (Ownable, ReentrancyGuard, ECDSA)
- **ReentrancyGuard** on all state-changing functions
- **Role-based access control (RBAC)** for permissions
- **No proxy patterns** — immutable, predictable contracts
- Audited by [TODO: add audit firm when complete]

### Infrastructure
- **HTTPS enforced** in production (TLS 1.3)
- **Environment secrets** — never committed to git
- **Rate limiting** on all API endpoints (Redis-backed)
- **Token gating** for premium features (ERC-20/ERC-721)
- **Input validation** — all user inputs sanitized

**Report vulnerabilities:** security@mod.dev

## Documentation

### Core Documentation
- **[Smart Contracts](mod/core/chain/README.md)** — BlocTime protocol specification
- **[Frontend](mod/core/app/README.md)** — Next.js app architecture
- **[API Server](mod/core/api/README.md)** — FastAPI endpoints & auth
- **[Storage](mod/core/store/README.md)** — Encrypted key-value store
- **[CLI Guide](mod/core/cli/README.md)** — Command reference

### Module Development
- **[Creating Modules](docs/MODULE_GUIDE.md)** — How to build orbit modules
- **[Module API](docs/MODULE_API.md)** — Core functions & utilities
- **[Testing](docs/TESTING.md)** — Testing framework & best practices
- **[Deployment](docs/DEPLOYMENT.md)** — Publishing to registry

### Protocol
- **[Whitepaper](mod/core/app/docs/)** — Protocol design & economics
- **[Architecture](docs/ARCHITECTURE.md)** — System design overview
- **[Smart Contract Spec](docs/CONTRACTS.md)** — BlocTime protocol details

## Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository**
   ```bash
   gh repo fork mod-framework/mod
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/my-feature
   ```

3. **Make your changes**
   - Add tests for new features
   - Update documentation
   - Follow existing code style

4. **Run tests**
   ```bash
   m test <module>           # test specific module
   pytest                     # test all
   ```

5. **Submit a pull request**
   ```bash
   m push "Add my feature"
   gh pr create
   ```

### Contribution Ideas
- 🧩 Build new orbit modules
- 📚 Improve documentation
- 🐛 Fix bugs or add tests
- ⚡ Optimize performance
- 🎨 Enhance the UI

[View open issues →](https://github.com/mod-framework/mod/issues)

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Smart Contracts** | Solidity 0.8.20, Hardhat, OpenZeppelin, Ethers.js v6 |
| **Backend** | Python 3.11+, FastAPI, Redis, PostgreSQL |
| **Frontend** | Next.js 14, React 18, TypeScript, Tailwind CSS |
| **Blockchain** | Base Sepolia (testnet), Base (mainnet), ethers.js |
| **AI** | Claude API, OpenAI, Anthropic SDK |
| **Storage** | IPFS, local encrypted KV store (AES-256) |
| **DevOps** | Docker, Docker Compose, Hardhat |

## Roadmap

### Completed
- [x] Core framework & module system
- [x] BlocTime protocol (Base Sepolia testnet)
- [x] 200+ orbit modules (AI, DeFi, infrastructure, dev tools)
- [x] Next.js frontend + wallet integration
- [x] CLI tooling (`m` command)
- [x] AI agent framework with persistent memory

### In Progress
- [ ] **Mainnet launch** — Deploy to Base mainnet
- [ ] **Module marketplace UI** — Browse, search, and purchase modules
- [ ] **Developer dashboard** — Revenue tracking and analytics
- [ ] **Cross-chain registry sync** — Ethereum, Optimism, Arbitrum support

### Planned
- [ ] **DAO governance** — BlocTime-weighted voting for protocol upgrades
- [ ] **Module versioning** — Semantic versioning with upgrade paths
- [ ] **Enterprise features** — Private modules, custom pricing, SLAs
- [ ] **Ownerless mode** — `setOwnerless()` on all contracts for permanent autonomy

## Community & Support

Join thousands of developers building the modular economy.

- 💬 **Discord** — [discord.gg/mod](https://discord.gg/mod) — Get help, share modules, discuss ideas
- 🐦 **Twitter** — [@mod_framework](https://twitter.com/mod_framework) — Updates and announcements
- 📚 **Docs** — [docs.mod.dev](https://docs.mod.dev) — Comprehensive guides and API reference
- 🐙 **GitHub** — [github.com/mod-framework/mod](https://github.com/mod-framework/mod) — Source code and issues

**Need help?** Ask in Discord or open a GitHub issue.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

**[Get Started](#quick-start)** • **[View Modules](mod/orbit/)** • **[Read Docs](#documentation)** • **[Join Discord](https://discord.gg/mod)**

---

*Code is capital. Build. Deploy. Earn.*

Built with ❤️ by the MOD community

</div>
