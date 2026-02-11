# 🚀 Mod Core App

> **A decentralized module marketplace and AI-powered development platform built on Next.js 14**

[![Next.js](https://img.shields.io/badge/Next.js-14.0.4-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com/)
[![Ethers.js](https://img.shields.io/badge/Ethers.js-6.13-764ABC?logo=ethereum)](https://docs.ethers.org/)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🤖 **AI Chat Interface** | Interact with modules through natural language with resizable split panels |
| 📦 **Module Marketplace** | Discover, fork, deploy, and version-control modules |
| 💰 **Treasury System** | Manage deposits, withdrawals, and on-chain billing |
| 🔐 **Multi-Wallet Support** | MetaMask, Phantom, SubWallet, and local browser keys |
| 🌐 **Multi-Network** | Substrate (Polkadot), EVM, and Solana chain support |
| 📊 **Transaction Tracking** | Real-time transaction monitoring with Recharts visualizations |
| 🎨 **Dark/Light Theme** | Beautiful responsive UI with Framer Motion animations |
| 🔑 **Key Management** | ECDSA & SR25519 key generation, signing, and verification |
| 📝 **Smart Contracts** | On-chain Registry, Market, Treasury, Token, and TokenGate |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+
- **npm** or **yarn**
- **Docker** (optional, for containerized deployment)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd mod/core/app

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── chat/              # AI chat interface
│   ├── mod/               # Module detail & explore pages
│   ├── user/              # User profile pages
│   ├── network/           # Network overview
│   ├── treasury/          # Treasury & deposits
│   ├── transactions/      # Transaction history
│   ├── buidl/             # Module builder
│   ├── home/              # Landing page
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx           # Entry page
│   └── globals.css        # Global styles
├── chat/                  # Chat system
│   ├── components/        # Chat UI (bubbles, tabs, voice, schema)
│   ├── hooks/             # useChatState, useModules, useFetchedSchemas
│   ├── transactions/      # Transaction cards & panels
│   ├── types.ts           # Chat type definitions
│   └── utils.ts           # Chat utilities
├── mod/                   # Module management
│   ├── api/               # Module API panel & owner selector
│   ├── app/               # Module app renderer
│   ├── content/           # Module content & CID display
│   ├── edit/              # Module editor
│   ├── explore/           # Module explore page with filters
│   ├── transactions/      # Module transaction history
│   ├── update/            # Module update flow
│   └── versions/          # Module version tracking
├── user/                  # User system
│   ├── admin/             # Admin panel
│   ├── billing/           # Billing & withdrawals
│   ├── buy/               # Buy bloctime
│   ├── contracts/         # User contracts view
│   ├── create/            # Create modules
│   ├── edit/              # Edit modules
│   ├── marketplace/       # Bloctime marketplace & TokenGate
│   ├── mods/              # User's modules list
│   ├── portfolio/         # Portfolio overview
│   ├── reg/               # Module registration
│   ├── transfer/          # Token transfers
│   ├── txs/               # User transactions
│   └── update/            # Update modules
├── wallet/                # Wallet adapters
│   ├── adapters/          # MetaMask, Phantom, SubWallet, Local
│   ├── WalletAuthButton   # Auth button component
│   ├── WalletRegistry     # Wallet registry
│   └── types.ts           # Wallet type definitions
├── network/               # Network configuration
│   ├── network.ts         # Network utilities
│   ├── Market.ts          # Market contract interface
│   └── NetworkSelector    # Network selector component
├── client/                # API client
│   ├── client.ts          # HTTP client
│   ├── auth.ts            # Authentication
│   ├── tokenRefresh.ts    # Token refresh logic
│   └── tokenExpiry.ts     # Token expiry handling
├── contracts/             # Smart contract ABIs
│   └── abi/               # Registry, Market, Treasury, Token, etc.
├── context/               # React contexts
│   ├── UserContext        # User state
│   ├── ThemeContext        # Dark/light theme
│   ├── SidebarContext     # Sidebar state
│   ├── SplitScreenContext # Split screen layout
│   └── ...                # Search, Layout, Wallet, etc.
├── key/                   # Key management
│   ├── keys/ecdsa.ts      # ECDSA key operations
│   ├── keys/sr25519.ts    # SR25519 key operations
│   └── LocalKeyManager    # Browser key management UI
├── header/                # Header components
│   ├── Header.tsx         # Main header
│   ├── SearchBar.tsx      # Search functionality
│   └── Logo.tsx           # Logo component
├── components/            # Shared components
│   ├── Sidebar.tsx        # Navigation sidebar
│   ├── ThemeToggle.tsx    # Theme switcher
│   └── ResizableDivider   # Resizable panels
├── ui/                    # Base UI primitives
│   ├── Loading.tsx        # Loading states
│   ├── CopyButton.tsx     # Copy to clipboard
│   ├── QRCode.tsx         # QR code generator
│   └── SkeletonCard.tsx   # Skeleton loaders
├── styles/                # Additional styles
├── types/                 # Shared TypeScript types
│   ├── dex.ts             # DEX types
│   ├── price.ts           # Price types
│   └── wallet.ts          # Wallet types
├── config.json            # API & network configuration
└── utils.ts               # Shared utilities
```

---

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file in the project root:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_CHAIN_ENDPOINT=ws://localhost:9944
NEXT_PUBLIC_NETWORK=local
```

### App Configuration

Edit `src/config.json` for API endpoints and network settings.

See `base.config.js` for Next.js configuration options:

```javascript
const baseConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: { appDir: true },
  images: { domains: ['localhost'] },
};
```

---

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Create optimized production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint checks |
| `npm run format` | Check code formatting with Prettier |
| `npm run format:fix` | Auto-fix code formatting |
| `./scripts/start.sh` | Start via Docker |
| `./scripts/stop.sh` | Stop Docker containers |
| `./scripts/build.sh` | Build script |

---

## 🎯 Key Components

### 🤖 Chat Interface
- **Resizable Split Panels** — Drag-and-drop divider between chat and code/params
- **Module Selector** — Browse and select modules to interact with
- **Schema Editor** — Configure module parameters with auto-generated forms
- **Voice Control** — Voice input support
- **Transaction History** — Track all interactions in real-time
- **Tab System** — Chat, Code, Params, and Transactions tabs

### 📦 Module Management
- **Module Cards** — Visual module representation with settings
- **Admin Panel** — Module configuration and permissions
- **Version Control** — Track and manage module updates
- **Content Management** — CID-based content storage
- **Fork & Create** — Fork existing modules or create from scratch

### 👤 User System
- **Profile Pages** — User information, modules, and activity
- **Wallet Connection** — Multi-wallet authentication
- **Billing & Credits** — Market credit system with withdrawals
- **Module Registry** — Register, update, and manage modules
- **Portfolio** — Overview of holdings and activity

### 🔐 Wallet Integration
- **MetaMask** — EVM chain support via Ethers.js
- **Phantom** — Solana wallet integration
- **SubWallet** — Polkadot/Substrate via @polkadot/api
- **Local Keys** — Browser-based ECDSA & SR25519 key management

---

## 📦 Tech Stack

### Core
| Package | Version | Purpose |
|---------|---------|----------|
| Next.js | 14.0.4 | React framework with App Router |
| React | 18 | UI library |
| TypeScript | 5.3 | Type safety |

### Blockchain
| Package | Purpose |
|---------|----------|
| `ethers` | Ethereum/EVM interaction |
| `@polkadot/api` | Substrate chain interaction |
| `@polkadot/extension-dapp` | Polkadot wallet integration |
| `@polkadot/util-crypto` | Cryptographic utilities |

### UI/UX
| Package | Purpose |
|---------|----------|
| Tailwind CSS | Utility-first styling |
| Framer Motion | Smooth animations |
| Headless UI | Accessible components |
| Lucide React | Icon library |
| Recharts | Data visualization |
| React Toastify | Toast notifications |
| @dnd-kit | Drag and drop |

### Utilities
| Package | Purpose |
|---------|----------|
| BigNumber.js | Precise number handling |
| Lodash | Utility functions |
| QR Code Styling | QR code generation |

---

## 🧪 Testing

```bash
# Type checking
npx tsc --noEmit

# Lint
npm run lint

# Smart contract tests
node test/Market.test.js
```

---

## 🚢 Deployment

### Vercel (Recommended)

```bash
npm i -g vercel
vercel
```

### Docker

```bash
# Build image
docker build -t mod-core-app .

# Run container
docker run -p 3000:3000 mod-core-app
```

### Docker Compose

```bash
docker-compose up -d
```

---

## 🔒 Security

- **Client-side Key Management** — Keys never leave the browser
- **Signature Verification** — Message signing and verification for auth
- **Token Refresh** — Automatic token expiry handling with refresh flow
- **HTTPS Only** — Enforced in production deployments
- **CSP Headers** — Content Security Policy configured

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT © Mod Protocol

---

<p align="center">
  <strong>Built with ❤️ by the Mod team</strong><br/>
  <em>"Simplicity is the ultimate sophistication." — Leonardo da Vinci</em>
</p>
