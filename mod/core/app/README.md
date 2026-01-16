# Base App - Next.js Frontend

> **A modern, responsive web application for interacting with the Base Protocol ecosystem**

[![Next.js](https://img.shields.io/badge/Next.js-14.0.4-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38bdf8)](https://tailwindcss.com/)

## 🚀 Overview

Base App is a comprehensive frontend application for the Base Protocol, providing:

- **Module Management**: Register, update, and explore modules
- **User Profiles**: Wallet integration and user management
- **Chat Interface**: Interactive module communication with real-time transactions
- **Marketplace**: Browse and interact with available modules
- **Multi-Wallet Support**: Subwallet, Metamask, Phantom, Local wallets

## ✨ Key Features

### 🔐 Wallet Integration
- **Polkadot**: Subwallet adapter for substrate chains
- **Ethereum**: Metamask support for EVM chains
- **Solana**: Phantom wallet integration
- **Local**: Browser-based key management with signing/verification

### 🎨 Modern UI/UX
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Dark Mode**: Terminal/hacker aesthetic with green-on-black theme
- **Animations**: Framer Motion for smooth transitions
- **MDX Support**: Rich content with embedded components
- **Split Screen**: Resizable panels for optimal workflow

### ⚡ Performance
- **App Router**: Next.js 14 with React Server Components
- **SWC Minification**: Fast builds and optimized bundles
- **Image Optimization**: Automatic image handling
- **Code Splitting**: Lazy loading for optimal performance

### 🔒 Security Features
- **Auto-Verification**: Every signature is automatically verified after signing
- **Message Signing**: Sign messages with your private key
- **Signature Verification**: Verify signatures from other users
- **Client-side Key Management**: Keys never leave your device

## 🛠️ Quick Start

### Prerequisites

```bash
Node.js 18+
npm or yarn
```

### Installation & Development

```bash
# Navigate to app directory
cd /root/mod/mod/core/app

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📁 Project Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── chat/              # Chat interface with transactions
│   ├── mod/               # Module pages and exploration
│   ├── user/              # User profiles and management
│   └── layout.tsx         # Root layout
├── mod/                   # Core modules
│   ├── chat/              # Chat components & transaction panel
│   ├── client/            # API client with authentication
│   ├── context/           # React contexts (User, Market, Sidebar)
│   ├── header/            # Header components
│   ├── key/               # Key management (SR25519, ECDSA)
│   ├── mod/               # Module components
│   ├── network/           # Network utilities & market allowance
│   ├── sidebar/           # Sidebar components
│   ├── ui/                # UI components (Loading, Copy, etc.)
│   ├── user/              # User components (Sign/Verify, Transfer)
│   └── wallet/            # Wallet adapters (Subwallet, Metamask, Phantom)
└── contracts/             # Smart contracts (Solidity)
```

## 🔧 Configuration

### Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_CHAIN_ENDPOINT=ws://localhost:9944
NEXT_PUBLIC_NETWORK=local
```

### Base Config

See `base.config.js` for Next.js configuration with SWC minification and app router support.

## 🎯 Core Components

### Chat Interface
- **Resizable Panels**: Drag-and-drop split screen layout
- **Module Selector**: Browse and select modules
- **Schema Editor**: Configure module parameters with JSON schema
- **Transaction History**: Real-time transaction tracking with cost display
- **Keyboard Navigation**: Arrow keys for page navigation

### Module Management
- **Module Cards**: Visual module representation with settings
- **Admin Panel**: Module configuration and updates
- **Version Control**: Track module versions and changes
- **Content Management**: IPFS integration for decentralized storage

### User System
- **Profile Pages**: User information, modules, and transactions
- **Wallet Connection**: Multi-wallet support with auto-detection
- **Transaction Management**: Transfer, stake, claim operations
- **Module Registry**: Register and update your modules
- **Sign/Verify**: Message signing with auto-verification

### Security Panel
- **Message Signing**: Sign any message with your private key
- **Auto-Verification**: Signatures are verified immediately after creation
- **Signature Verification**: Verify signatures from other users
- **Public Key Display**: Easy access to your public key

## 🧪 Testing

```bash
# Type checking
npx tsc --noEmit

# Lint code
npm run lint

# Format code
npm run format:fix
```

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Docker

```bash
# Build image
docker build -t base-app .

# Run container
docker run -p 3000:3000 base-app
```

## 📦 Key Dependencies

### Core
- **Next.js 14**: React framework with App Router
- **React 18**: UI library with Server Components
- **TypeScript**: Type safety and better DX

### Blockchain
- **@polkadot/api**: Substrate chain interaction
- **@polkadot/extension-dapp**: Wallet integration
- **@polkadot/util-crypto**: Cryptographic utilities
- **ethers**: Ethereum interaction

### UI/UX
- **Tailwind CSS**: Utility-first styling
- **Framer Motion**: Smooth animations
- **Headless UI**: Accessible components
- **Lucide React**: Modern icon library

### Utilities
- **BigNumber.js**: Precise number handling
- **Lodash**: Utility functions
- **React Toastify**: Toast notifications

## 🔒 Security Best Practices

1. **Always verify signatures** before trusting them
2. **Check auto-verify results** after signing messages
3. **Never share your private key** - it stays in your browser
4. **Understand what you're signing** - read messages carefully
5. **Use HTTPS in production** - protect data in transit

## 📚 Documentation

- [User Profile Module](./src/mod/user/README.md) - Sign/Verify documentation
- [Transaction Debug](./TRANSACTION_DEBUG.md) - Transaction panel troubleshooting
- [Analysis](./ANALYSIS.md) - Cost field implementation guide

## 🐛 Known Issues & Fixes

### Transaction Panel Not Showing Transactions
- **Issue**: Filter logic bug on line 83 of TransactionsPanel.tsx
- **Fix**: Remove the line that filters out user transactions when showOnlyMyTx is false
- **Details**: See [TRANSACTION_DEBUG.md](./TRANSACTION_DEBUG.md)

### Cost Field Missing
- **Issue**: Transaction interfaces don't include cost field
- **Fix**: Add `cost?: number` to Transaction interfaces
- **Details**: See [ANALYSIS.md](./ANALYSIS.md)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

## 📄 License

MIT License - See LICENSE file for details

---

**Built with ⚡ by the Base Team**

*"Simplicity is the ultimate sophistication." - Leonardo da Vinci*

## 🎯 Quick Links

- **Development**: `npm run dev` → [http://localhost:3000](http://localhost:3000)
- **Production Build**: `npm run build && npm start`
- **Docker**: `docker-compose up -d`
- **Lint**: `npm run lint`
- **Format**: `npm run format:fix`
