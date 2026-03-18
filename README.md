<div align="center">

```
 _____ _______ ______
|     |       |      \
| | | |   -   |   -  |
|_|_|_|_______|______/
```

### Modular Operating Daemon

**Write code. Register it on-chain. Get paid when people use it.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-yellow.svg)](https://python.org)
[![Solidity 0.8.20](https://img.shields.io/badge/solidity-0.8.20-363636.svg)](https://soliditylang.org)
[![Next.js 14](https://img.shields.io/badge/next.js-14-black.svg)](https://nextjs.org)
[![Base Sepolia](https://img.shields.io/badge/chain-Base%20Sepolia-0052FF.svg)](https://base.org)

</div>

---

MOD is a modular development framework that combines Python module orchestration, EVM smart contracts, and AI-powered interfaces into one system. Developers write functions, register them on-chain, set a price, and earn revenue every time someone calls them.

```
 Developer ──> MOD Protocol ──> Users
 writes fn     registers        call fn
 sets price    to chain         pay token
     ^                            |
     └─────── revenue ────────────┘
```

## Quick Start

```bash
# 1. Install the framework
pip install -e ./

# 2. Explore modules
m mods                    # list all 140+ modules
m info <module>           # module details
m serve api               # start API server on :8000

# 3. Start the blockchain (separate terminal)
cd mod/core/chain
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost

# 4. Launch the frontend (separate terminal)
cd mod/core/app
npm install && npm run dev    # frontend on :3000
```

## Architecture

```
mod/
├── core/
│   ├── mod.py             # Framework engine
│   ├── utils.py           # Shared utilities
│   ├── chain/             # Solidity smart contracts (BlocTime Protocol)
│   ├── app/               # Next.js 14 frontend (TypeScript, Tailwind)
│   ├── api/               # FastAPI backend (async, auto-generated endpoints)
│   ├── server/            # Process management
│   ├── store/             # Encrypted key-value storage
│   ├── key/               # Crypto key management
│   ├── cli/               # CLI interface
│   └── router/            # API routing
│
└── orbit/                 # 140+ community modules
    ├── agent/             # AI agents
    ├── claude/            # Claude integration
    ├── ipfs/              # IPFS storage
    ├── safe/              # Gnosis Safe multisig
    ├── bridge/            # Cross-chain bridges
    ├── web/               # Web scraping
    ├── cache/             # Caching layer
    └── ...
```

## CLI

| Command | Description |
|---------|-------------|
| `m mods` | List all available modules |
| `m info <mod>` | Module details and metadata |
| `m code <mod>` | View module source code |
| `m dp <mod>` | Get module directory path |
| `m serve <mod>` | Start a module server |
| `m servers` | List running servers |
| `m kill <mod>` | Stop a module server |
| `m test <mod>` | Run module tests |
| `m push "msg"` | Git commit and push |

## Python API

```python
import mod as m

# Load and run any module
api = m.mod('api')()
result = m.fn('api/some_function')(param='value')

# Server management
m.serve('api', port=8000)
m.kill('api')

# Crypto — keys, signing, encryption
key = m.get_key('my_key')
sig = m.sign({'data': 'value'}, key='my_key')

# Encrypted storage
m.put('key', {'data': 'value'}, encrypt=True)
data = m.get('key')

# AI
response = m.ask('explain this code', model='claude')
```

## BlocTime Protocol

On-chain layer for module registration, payments, and governance. Deployed on **Base Sepolia** (chain ID `84532`).

| Contract | Purpose |
|----------|---------|
| **Treasury** | Multi-token revenue distribution |
| **Market** | Module marketplace with instant withdrawals |
| **Registry** | On-chain module registration and management |
| **BlocTime** | Staking with time-multiplier rewards |
| **TokenGate** | Token whitelist + oracle integration |
| **Perms** | Role-based access control |
| **Oracles** | Price feeds (Chainlink, Pyth, manual) |

Built with Solidity 0.8.20 and OpenZeppelin.

### Deploy

```bash
# Local
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost

# Testnet
npx hardhat run scripts/deploy.js --network baseSepolia

# Mainnet
npx hardhat run scripts/deploy.js --network base
```

## Security

- OpenZeppelin contract libraries
- ReentrancyGuard on all state-changing functions
- Signature-based authentication
- AES-256 encryption for sensitive storage
- Role-based access control (on-chain + off-chain)
- Client-side key generation
- HTTPS enforced in production

## Documentation

| Resource | Description |
|----------|-------------|
| [Architecture](MOD_ARCHITECTURE.md) | System design deep dive |
| [Smart Contracts](mod/core/chain/README.md) | BlocTime protocol docs |
| [Frontend](mod/core/app/README.md) | Next.js application |
| [API Server](mod/core/api/README.md) | FastAPI endpoints |
| [Storage](mod/core/store/README.md) | Key-value store |
| [Whitepaper](mod/core/app/docs/) | Protocol whitepaper |

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/name`)
3. Make your changes
4. Run tests (`m test <module>`)
5. Submit a PR

---

<div align="center">

*"Simplicity is the ultimate sophistication."* — Leonardo da Vinci

MIT License

</div>
