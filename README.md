# 🌉 Sr25519 → ERC20 Bridge

**Trustlessly bridge Substrate tokens to Base with cryptographic proof of ownership**

[![Local Dev](https://img.shields.io/badge/API%20Keys-None%20Required-brightgreen)](./NO_API_KEYS.md)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## ⚡ 2-Minute Quick Start

```bash
# Install
npm install && pip install -r requirements.txt

# Test
npx hardhat test

# Run locally (Terminal 1)
npx hardhat node

# Deploy (Terminal 2)
npx hardhat run scripts/deploy.js --network localhost

# Start API
python mod.py
```

**No API keys. No testnet ETH. Just works.** → [Full Local Guide](./LOCAL_DEVELOPMENT.md)

---

## 🎯 What Is This?

A bridge that lets users **claim ERC20 tokens on Base** by proving they own an **sr25519 address** on a Substrate chain.

```
┌──────────────┐    Sign Message    ┌──────────────┐    Verify & Queue    ┌──────────────┐
│   Subwallet  │ ────────────────→  │   Backend    │ ──────────────────→  │   Bridge     │
│   (sr25519)  │                    │   (FastAPI)  │                      │   Contract   │
└──────────────┘                    └──────────────┘                      └──────────────┘
                                                                                  │
                                                                                  ▼
                                                                          ┌──────────────┐
                                                                          │   MetaMask   │
                                                                          │   (ERC20)    │
                                                                          └──────────────┘
```

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔐 **Cryptographic Proof** | sr25519 signatures verify ownership |
| 🚫 **No Double Claims** | On-chain enforcement, one claim per address |
| 📸 **Snapshot Support** | Rust tool captures Substrate chain state |
| ⚡ **Batch Processing** | Efficient multi-claim transactions |
| 🎨 **React Frontend** | Subwallet + MetaMask integration |
| 🐳 **Docker Ready** | One-command deployment |

---

## 📁 Project Structure

```
├── contracts/           # Solidity: BridgeToken.sol, Sr25519Bridge.sol
├── frontend/            # React: Sr25519Bridge.tsx
├── bridge/              # Rust: Substrate snapshot tool
├── scripts/             # Hardhat deployment
├── test/                # Contract tests
├── mod.py               # FastAPI backend
└── docs/
    ├── QUICKSTART.md    # Testnet/Mainnet deployment
    ├── BRIDGE.md        # Full API reference
    └── IMPLEMENTATION.md # Architecture deep-dive
```

---

## 🔧 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/claim` | POST | Submit claim with sr25519 signature |
| `/balance/{address}` | GET | Check claimable balance |
| `/process` | POST | Process pending claims (operator) |
| `/stats` | GET | Bridge statistics |

---

## 🚀 Deployment

### Local (No Config)
```bash
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
```

### Testnet
```bash
# Add PRIVATE_KEY to .env
npm run deploy:testnet
```

### Mainnet
```bash
npm run deploy:mainnet
```

---

## 🐳 Docker

```bash
docker-compose up --build
```

---

## 📚 Documentation

- **[NO_API_KEYS.md](./NO_API_KEYS.md)** — Zero-config development
- **[LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)** — Complete local setup
- **[QUICKSTART.md](./QUICKSTART.md)** — Deploy to networks
- **[BRIDGE.md](./BRIDGE.md)** — Full API & architecture
- **[IMPLEMENTATION.md](./IMPLEMENTATION.md)** — Technical details

---

## 🛡️ Security Model

| Trustless | Trust Required |
|-----------|----------------|
| ✅ Cryptographic ownership proof | ⚠️ Operator processes claims |
| ✅ On-chain double-claim prevention | ⚠️ Snapshot accuracy |
| ✅ Deterministic verification | ⚠️ Operator token balance |

**Recommendation:** Use multisig as operator for production.

---

## 🤝 Contributing

PRs welcome! Please read the existing docs before contributing.

---

## 📄 License

MIT

---

<div align="center">
  <b>Built for the Substrate ↔ EVM ecosystem</b><br>
  <sub>Cryptographic bridges, simplified.</sub>
</div>