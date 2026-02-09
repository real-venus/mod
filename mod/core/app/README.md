# 🚀 Mod Core App

> **A decentralized module marketplace and AI-powered development platform**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com/)

---

## ✨ Features

- 🤖 **AI Chat Interface** - Interact with modules through natural language
- 📦 **Module Marketplace** - Discover, fork, and deploy modules
- 💰 **Treasury System** - Manage deposits and withdrawals
- 🔐 **Multi-Wallet Support** - MetaMask, Phantom, SubWallet, Local Keys
- 🌐 **Multi-Network** - Support for multiple blockchain networks
- 📊 **Transaction Tracking** - Real-time transaction monitoring
- 🎨 **Dark/Light Theme** - Beautiful responsive UI

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Docker (optional)

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

### Docker

```bash
# Build and run with Docker Compose
docker-compose up -d
```

---

## 📁 Project Structure

```
src/
├── app/           # Next.js app router pages
├── chat/          # AI chat components & hooks
├── mod/           # Module management
├── user/          # User profiles & settings
├── wallet/        # Wallet adapters
├── network/       # Network configuration
├── contracts/     # Smart contract ABIs
├── context/       # React contexts
├── components/    # Shared UI components
└── ui/            # Base UI primitives
```

---

## 🔧 Configuration

Edit `src/config.json` for API endpoints and network settings.

---

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production |
| `./scripts/start.sh` | Docker start |
| `./scripts/stop.sh` | Docker stop |

---

## 📄 License

MIT © Mod Protocol

---

<p align="center">Built with ❤️ by the Mod team</p>