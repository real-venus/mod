# Base App - Next.js Frontend

> **A modern, responsive web application for interacting with the Base Protocol ecosystem**

[![Next.js](https://img.shields.io/badge/Next.js-14.0.4-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38bdf8)](https://tailwindcss.com/)

## 🚀 Overview

Base App is a comprehensive frontend application for the Base Protocol, providing:

1. **Module Management**: Register, update, and explore modules
2. **User Profiles**: Wallet integration and user management
3. **Chat Interface**: Interactive module communication
4. **Marketplace**: Browse and interact with available modules
5. **Multi-Wallet Support**: Subwallet, Metamask, Phantom, Local wallets

## 📚 Key Features

### 🔐 Wallet Integration
- **Polkadot**: Subwallet adapter for substrate chains
- **Ethereum**: Metamask support for EVM chains
- **Solana**: Phantom wallet integration
- **Local**: Browser-based key management

### 🎨 Modern UI/UX
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Dark Mode**: Built-in theme support
- **Animations**: Framer Motion for smooth transitions
- **MDX Support**: Rich content with embedded components

### ⚡ Performance
- **App Router**: Next.js 14 with React Server Components
- **SWC Minification**: Fast builds and optimized bundles
- **Image Optimization**: Automatic image handling
- **Code Splitting**: Lazy loading for optimal performance

## 🛠️ Setup & Development

### Prerequisites

```bash
Node.js 18+
npm or yarn
```

### Quick Start

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

# Lint code
npm run lint

# Format code
npm run format:fix
```

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
│   ├── chat/              # Chat interface
│   ├── mod/               # Module pages
│   ├── user/              # User profiles
│   └── layout.tsx         # Root layout
├── mod/                   # Core modules
│   ├── chat/              # Chat components
│   ├── client/            # API client
│   ├── context/           # React contexts
│   ├── header/            # Header components
│   ├── key/               # Key management
│   ├── mod/               # Module components
│   ├── network/           # Network utilities
│   ├── sidebar/           # Sidebar components
│   ├── ui/                # UI components
│   ├── user/              # User components
│   └── wallet/            # Wallet adapters
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

See `base.config.js` for Next.js configuration:

```javascript
const baseConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    appDir: true,
  },
  images: {
    domains: ['localhost'],
  },
};
```

## 🎯 Key Components

### Chat Interface
- **Resizable Panels**: Drag-and-drop split screen
- **Module Selector**: Browse and select modules
- **Schema Editor**: Configure module parameters
- **Transaction History**: Track all interactions

### Module Management
- **Module Cards**: Visual module representation
- **Admin Panel**: Module configuration
- **Version Control**: Track module updates
- **Content Management**: IPFS integration

### User System
- **Profile Pages**: User information and modules
- **Wallet Connection**: Multi-wallet support
- **Transaction Management**: Transfer, stake, claim
- **Module Registry**: Register and update modules

## 🧪 Testing

```bash
# Run tests (when configured)
npm test

# Type checking
npx tsc --noEmit

# Lint
npm run lint
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

## 📦 Dependencies

### Core
- **Next.js 14**: React framework
- **React 18**: UI library
- **TypeScript**: Type safety

### Blockchain
- **@polkadot/api**: Substrate interaction
- **@polkadot/extension-dapp**: Wallet integration
- **@polkadot/util-crypto**: Cryptographic utilities

### UI/UX
- **Tailwind CSS**: Utility-first styling
- **Framer Motion**: Animations
- **Headless UI**: Accessible components
- **Lucide React**: Icon library

### Utilities
- **BigNumber.js**: Precise number handling
- **Lodash**: Utility functions
- **React Toastify**: Notifications

## 🔒 Security

- **Client-side Key Management**: Secure local storage
- **Signature Verification**: Message signing/verification
- **HTTPS Only**: Production deployment
- **CSP Headers**: Content Security Policy

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

---

**Built with ⚡ by the Base Team**

*"Simplicity is the ultimate sophistication." - Leonardo da Vinci*
