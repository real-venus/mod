# Mod Framework Architecture

> **A complete modular development ecosystem with Python framework, blockchain integration, and AI-powered interfaces**

[![Python](https://img.shields.io/badge/Python-3.11+-blue?logo=python)](https://python.org)
[![Next.js](https://img.shields.io/badge/Next.js-14.0.4-black?logo=next.js)](https://nextjs.org/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue)](https://soliditylang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com/)

---

## 📚 Table of Contents

- [Overview](#overview)
- [Repository Structure](#repository-structure)
- [Core Components](#core-components)
- [Quick Start](#quick-start)
- [Documentation Index](#documentation-index)

---

## 🎯 Overview

The **Mod Framework** is a comprehensive ecosystem for building, deploying, and managing decentralized modular applications. It combines:

1. **Python Framework** (`mod/`) - Core module management and orchestration
2. **Blockchain Layer** (`mod/core/chain/`) - EVM smart contracts and on-chain infrastructure
3. **Frontend Application** (`mod/core/app/`) - Next.js 14 web interface with AI chat
4. **API Server** (`mod/core/api/`) - Python FastAPI backend
5. **Module Ecosystem** (`mod/orbit/`) - 100+ reusable modules for various domains

---

## 📂 Repository Structure

```
~/mod/
├── README.md                    # Main framework documentation
├── MOD_ARCHITECTURE.md          # This file - architecture overview
├── setup.py                     # Python package installation
├── requirements.txt             # Python dependencies
├── docker-compose.yml           # Container orchestration
├── mod.json                     # Root configuration
│
├── mod/                         # Python module framework
│   ├── core/                    # Core modules
│   │   ├── mod.py              # Main framework class (67KB)
│   │   ├── utils.py            # Utilities (75KB)
│   │   ├── chain/              # Blockchain contracts & tooling
│   │   ├── app/                # Next.js frontend application
│   │   ├── api/                # FastAPI backend server
│   │   ├── server/             # Server management
│   │   ├── store/              # Key-value storage
│   │   ├── key/                # Cryptographic key management
│   │   ├── cli/                # Command-line interface
│   │   ├── router/             # API routing
│   │   └── tester/             # Testing utilities
│   │
│   └── orbit/                   # Module ecosystem (140+ modules)
│       ├── agent/              # AI agents
│       ├── claude/             # Claude AI integration
│       ├── web/                # Web scraping & search
│       ├── ipfs/               # IPFS storage
│       ├── safe/               # Gnosis Safe multisig
│       ├── bridge/             # Cross-chain bridges
│       ├── cache/              # Caching utilities
│       ├── skill/              # Reusable skills
│       ├── filecoin/           # Filecoin storage
│       ├── namespace/          # Name resolution
│       └── ...                 # 130+ more modules
│
└── scripts/                     # Deployment & automation scripts
```

---

## 🏗️ Core Components

### 1. **Mod Framework** (`~/mod/mod/core/mod.py`)

The heart of the system - a Python framework for modular application development.

**Key Features:**
- 📦 Dynamic module loading and management
- 🔧 Function discovery and execution (`m.fn('module/function')`)
- 🌐 HTTP server deployment (`m.serve('module')`)
- 🔐 Cryptographic operations (signing, encryption, keys)
- 💾 Persistent storage with optional encryption
- 🤖 AI integration (OpenRouter, Claude)
- 🔗 Git operations and repository management

**Documentation:** [/README.md](/Users/broski/mod/README.md)

---

### 2. **Blockchain Layer** (`~/mod/mod/core/chain/`)

Production-ready EVM smart contracts forming the **BlocTime Protocol**.

**Smart Contracts:**
- 🏦 **Treasury** - Multi-token revenue distribution to governance holders
- 🛒 **Market** - Marketplace with instant withdrawals and multi-token support
- 📝 **Registry** - Module registration and management
- ⏰ **BlocTime** - Staking token with multiplier-based rewards
- 🎫 **TokenGate** - Token whitelist & oracle integration
- 🔒 **Perms** - Role-based access control
- 📊 **Oracles** - Price feeds (Chainlink, Pyth, Manual)

**Tech Stack:**
- Solidity 0.8.20
- Hardhat development framework
- OpenZeppelin security libraries
- Comprehensive test suite (100% coverage)

**Documentation:** [/mod/mod/core/chain/README.md](/Users/broski/mod/mod/core/chain/README.md)

**Contract Documentation:**
- [Treasury](/Users/broski/mod/mod/core/chain/contracts/treasury/README.md)
- [Market](/Users/broski/mod/mod/core/chain/contracts/market/README.md)
- [Registry](/Users/broski/mod/mod/core/chain/contracts/registry/README.md)
- [BlocTime](/Users/broski/mod/mod/core/chain/contracts/bloctime/README.md)
- [TokenGate](/Users/broski/mod/mod/core/chain/contracts/tokengate/README.md)
- [Oracles](/Users/broski/mod/mod/core/chain/contracts/oracles/README.md)
- [Perms](/Users/broski/mod/mod/core/chain/contracts/perms/README.md)

---

### 3. **Frontend Application** (`~/mod/mod/core/app/`)

Modern Next.js 14 application with AI-powered module interaction.

**Key Features:**
- 🤖 **AI Chat Interface** - Natural language module interaction
- 📦 **Module Marketplace** - Discover, fork, and deploy modules
- 💰 **Treasury Management** - Deposits, withdrawals, on-chain billing
- 🔐 **Multi-Wallet Support** - MetaMask, Phantom, SubWallet, local keys
- 🌐 **Multi-Chain** - EVM, Substrate (Polkadot), Solana
- 📊 **Transaction Tracking** - Real-time monitoring with visualizations
- 🎨 **Dark/Light Theme** - Responsive UI with Framer Motion

**Tech Stack:**
- Next.js 14.0.4 (App Router)
- React 18
- TypeScript 5.3
- Tailwind CSS 3.4
- ethers.js v6
- @polkadot/api

**Documentation:** [/mod/mod/core/app/README.md](/Users/broski/mod/mod/core/app/README.md)

---

### 4. **API Server** (`~/mod/mod/core/api/`)

Python FastAPI backend for module execution and orchestration.

**Features:**
- ⚡ FastAPI async server
- 🔌 Dynamic module endpoint generation
- 🔐 Authentication and authorization
- 📊 Request logging and analytics
- 🐳 Docker deployment ready

**Documentation:** [/mod/mod/core/api/README.md](/Users/broski/mod/mod/core/api/README.md)

---

### 5. **Module Ecosystem** (`~/mod/mod/orbit/`)

130+ pre-built modules covering diverse domains:

**AI & Agents:**
- `agent` - AI agent framework
- `claude` - Claude AI integration
- `model` - Model management

**Blockchain:**
- `safe` - Gnosis Safe multisig
- `bridge` - Cross-chain bridges
- `ipfs` - IPFS storage
- `filecoin` - Filecoin integration
- `zama` - FHE (Fully Homomorphic Encryption)
- `phala` - TEE (Trusted Execution Environment)

**Web & Data:**
- `web` - Web scraping
- `websearch` - Search integration
- `cache` - Caching layer
- `localfs` - Local filesystem

**Development:**
- `dev` - Development utilities
- `test_base` - Testing framework
- `skill` - Reusable skills
- `namespace` - Name resolution

**And many more...**

---

### 6. **Storage Layer** (`~/mod/mod/core/store/`)

Lightweight persistent key-value store with Docker support.

**Features:**
- 🔑 Simple get/set API
- 💾 Bulletproof persistence
- 🐳 Docker native
- ⚡ Lightning fast
- 🧪 Battle tested

**Documentation:** [/mod/mod/core/store/README.md](/Users/broski/mod/mod/core/store/README.md)

---

## 🚀 Quick Start

### Installation

```bash
# Clone repository
git clone <repository-url>
cd ~/mod

# Install Python framework
pip install -e ./

# Verify installation
m mods                    # List available modules
```

### Basic Usage

```bash
# Module management
m mods                    # List all modules
m info api               # Get module information
m code api               # View module code
m dp api                 # Get module directory path

# Server operations
m serve api              # Start API server on port 8000
m servers                # List running servers
m kill api               # Stop server

# Development
m test api               # Run tests
m push "commit msg"      # Git commit and push
```

### Python API

```python
import mod as m

# Load and execute modules
api = m.mod('api')()
result = api.some_function()

# Or use function syntax
result = m.fn('api/some_function')(param='value')

# Server deployment
m.serve('api', port=8000)

# Cryptographic operations
key = m.get_key('my_key')
signature = m.sign({'data': 'value'}, key='my_key')

# Storage
m.put('key', {'data': 'value'}, encrypt=True)
data = m.get('key')
```

### Deploy Blockchain Contracts

```bash
cd ~/mod/mod/core/chain

# Local development
npm install
npx hardhat compile
npx hardhat test

# Deploy to testnet (Base Sepolia)
npx hardhat run scripts/deploy.js --network baseSepolia

# Deploy to mainnet
npx hardhat run scripts/deploy.js --network base
```

### Start Frontend Application

```bash
cd ~/mod/mod/core/app

# Install dependencies
npm install

# Development server
npm run dev

# Production build
npm run build
npm start

# Docker deployment
docker-compose up -d
```

---

## 📖 Documentation Index

### Core Documentation
- [Main README](./README.md) - Framework overview and CLI guide
- [This File](./MOD_ARCHITECTURE.md) - Architecture documentation

### Component Documentation
- [Chain/Contracts](./mod/core/chain/README.md) - Smart contracts
- [Frontend App](./mod/core/app/README.md) - Next.js application
- [API Server](./mod/core/api/README.md) - FastAPI backend
- [Store](./mod/core/store/README.md) - Key-value storage

### Contract Documentation
- [Treasury Contract](./mod/core/chain/contracts/treasury/README.md)
- [Market Contract](./mod/core/chain/contracts/market/README.md)
- [Registry Contract](./mod/core/chain/contracts/registry/README.md)
- [BlocTime Staking](./mod/core/chain/contracts/bloctime/README.md)
- [TokenGate](./mod/core/chain/contracts/tokengate/README.md)
- [Oracles](./mod/core/chain/contracts/oracles/README.md)
- [Permissions](./mod/core/chain/contracts/perms/README.md)

---

## 🔧 Configuration

### Root Configuration (`~/mod/mod.json`)

```json
{
  "name": "mod",
  "version": "0.1.0",
  "port_range": [8000, 9000],
  "shortcuts": {
    "m": "mod",
    "c": "mod"
  }
}
```

### Chain Configuration (`~/mod/mod/core/chain/config.json`)

Network endpoints, contract addresses, and deployment settings.

### App Configuration (`~/mod/mod/core/app/src/config.json`)

API endpoints, network settings, and contract addresses for frontend.

---

## 🎯 Use Cases

### 1. **Build Modular Python Applications**
Use the mod framework to create composable, reusable modules with built-in server deployment, crypto, and storage.

### 2. **Deploy DeFi Protocols**
Launch the BlocTime Protocol smart contracts for staking, marketplace, and treasury management.

### 3. **Create Web3 Frontends**
Use the Next.js app as a template for building blockchain-integrated applications.

### 4. **Manage Multi-Sig Wallets**
Integrate Gnosis Safe for secure multi-signature operations (custom implementation).

### 5. **Build AI-Powered DApps**
Combine AI chat interface with on-chain operations for intelligent contract interaction.

---

## 🧪 Testing

```bash
# Test Python framework
cd ~/mod
pytest

# Test smart contracts
cd ~/mod/mod/core/chain
npm test
npx hardhat coverage

# Test frontend
cd ~/mod/mod/core/app
npm run lint
npm run build

# Test API server
cd ~/mod/mod/core/api
python -m pytest
```

---

## 🐳 Docker Deployment

### Full Stack

```bash
cd ~/mod
docker-compose up -d
```

This starts:
- Python API server
- Next.js frontend
- PostgreSQL database
- IPFS node (optional)
- Blockchain node (optional)

### Individual Components

```bash
# Chain development
cd ~/mod/mod/core/chain
docker-compose up -d

# Frontend only
cd ~/mod/mod/core/app
docker-compose up -d

# API only
cd ~/mod/mod/core/api
docker-compose up -d
```

---

## 🔐 Security

- ✅ **Smart Contract Audits**: OpenZeppelin libraries, comprehensive tests
- ✅ **Key Management**: Client-side key generation and storage
- ✅ **Encryption**: AES encryption for sensitive data
- ✅ **Authentication**: Signature-based authentication
- ✅ **Access Control**: Role-based permissions
- ✅ **HTTPS Only**: Enforced in production
- ✅ **ReentrancyGuard**: Protection on all state-changing functions

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

See individual component READMEs for specific contribution guidelines.

---

## 📜 License

MIT License - See LICENSE file for details

---

## 🔗 Quick Links

| Component | Documentation | Directory |
|-----------|--------------|-----------|
| **Framework** | [README.md](./README.md) | `~/mod/` |
| **Blockchain** | [Chain README](./mod/core/chain/README.md) | `~/mod/mod/core/chain/` |
| **Frontend** | [App README](./mod/core/app/README.md) | `~/mod/mod/core/app/` |
| **API** | [API README](./mod/core/api/README.md) | `~/mod/mod/core/api/` |
| **Storage** | [Store README](./mod/core/store/README.md) | `~/mod/mod/core/store/` |

---

<p align="center">
  <strong>Built with ❤️ by the Mod team</strong><br/>
  <em>"Simplicity is the ultimate sophistication." — Leonardo da Vinci</em>
</p>
