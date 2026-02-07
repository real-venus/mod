# 🔮 MOD Protocol

### The Decentralized Function Marketplace

> **Write Code. Get Paid. Forever.**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38bdf8?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

---

## 💡 The Problem

**Developers build amazing tools. Platforms keep the profits.**

- You write code → AWS/Vercel charges users → You get nothing
- Your open source work → Big tech monetizes it → You get GitHub stars
- You build APIs → Subscription fatigue kills adoption → You get frustrated

## ✨ The Solution

**MOD Protocol flips the script.**

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   Developer writes function  →  User calls function         │
│                              →  Developer gets paid          │
│                              →  Automatically. Forever.      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**No middleman. No subscriptions. Just code and crypto.**

---

## 🚀 Quick Start

```bash
# Clone & Install
git clone https://github.com/mod-protocol/mod
cd mod/core/app
npm install

# Run
npm run dev

# Open http://localhost:3000 🎉
```

**30 seconds to a decentralized function marketplace.**

---

## 🎯 How It Works

### For Developers (Earn Money)

```python
# 1. Register your module
api.reg(mod="image_resizer")

# 2. That's it. Every call = micropayment to you.
```

### For Users (Use Modules)

```python
# Call any module, pay only for what you use
result = api.call(
    fn="image_resizer/resize",
    params={"width": 800, "url": "..."},
    cost=0.001  # ~$0.001 per call
)
```

---

## 🔐 Multi-Chain Wallet Support

| Chain | Wallet | Signature |
|-------|--------|----------|
| 🟣 **Polkadot** | Subwallet | SR25519 |
| 🔷 **Ethereum** | Metamask | ECDSA |
| 🟢 **Solana** | Phantom | Ed25519 |
| 🔑 **Local** | Browser | All types |

**Your keys. Your wallet. Your choice.**

---

## 📁 Architecture

```
src/
├── app/                    # Next.js 14 App Router
│   ├── chat/              # 💬 Interactive module chat
│   ├── mod/               # 📦 Module explorer
│   └── user/              # 👤 User profiles
│
├── mod/
│   ├── chat/              # Chat UI components
│   ├── client/            # API client + auth
│   ├── key/               # 🔐 Crypto key management
│   ├── wallet/            # 💳 Multi-wallet adapters
│   └── contracts/         # 📜 Smart contract ABIs
```

---

## ⚡ Features

### 💬 Smart Chat Interface
- **Module Autocomplete** - Type and discover modules instantly
- **Schema Validation** - JSON schema for parameter validation  
- **Transaction Tracking** - Real-time cost & status display
- **Resizable Panels** - Drag-and-drop workspace

### 🛡️ Security First
- **Auto-Verification** - Every signature verified immediately
- **Client-Side Keys** - Keys never leave your device
- **Cryptographic Trust** - Verify, don't trust

### 🎨 Developer Experience
- **Terminal Aesthetic** - Hacker-style green-on-black
- **Smooth Animations** - Framer Motion transitions
- **Mobile Ready** - Responsive Tailwind design

---

## 🔧 Configuration

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_CHAIN_ENDPOINT=ws://localhost:9944
NEXT_PUBLIC_NETWORK=local
```

---

## 🐳 Docker

```bash
# One command deployment
docker-compose up -d

# Logs
docker-compose logs -f

# Stop
docker-compose down
```

---

## 📊 MOD vs Traditional

| | Traditional Cloud | MOD Protocol |
|---|---|---|
| **Revenue** | Platform keeps it | You keep it |
| **Storage** | Can disappear | IPFS forever |
| **Trust** | Trust the company | Verify cryptographically |
| **Billing** | Complex subscriptions | Automatic micropayments |
| **Lock-in** | Vendor dependent | Open & composable |

---

## 📚 Documentation

| Doc | Description |
|-----|-------------|
| [📄 One Pager](./docs/onepager.md) | Quick overview |
| [📖 Whitepaper](./docs/whitepaper.md) | Technical deep dive |
| [🔧 API Mechanics](./src/api/api/docs/API_MECHANICS.md) | Backend architecture |
| [👤 User Guide](./src/mod/user/README.md) | Sign/Verify guide |

---

## 🚀 Deploy

### Vercel (Recommended)
```bash
npm i -g vercel && vercel
```

### Docker
```bash
docker build -t mod-app . && docker run -p 3000:3000 mod-app
```

---

## 🤝 Contributing

```bash
# 1. Fork it
# 2. Create branch
git checkout -b feature/amazing

# 3. Commit
git commit -m 'Add amazing feature'

# 4. Push
git push origin feature/amazing

# 5. Open PR
```

---

## 📜 License

MIT License - Build freely.

---

<div align="center">

### 🌟 Build Once. Earn Forever.

**[Website](https://mod.protocol) • [Discord](https://discord.gg/mod) • [Twitter](https://twitter.com/modprotocol)**

*"Simplicity is the ultimate sophistication."* — Leonardo da Vinci

---

**Made with ⚡ by the MOD Protocol Team**

</div>