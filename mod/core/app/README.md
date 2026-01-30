# MOD Protocol - Decentralized Module Marketplace

> **Build Once, Earn Forever - The Future of Code Monetization**

[![Next.js](https://img.shields.io/badge/Next.js-14.0.4-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38bdf8)](https://tailwindcss.com/)

## 🚀 What is MOD?

MOD Protocol is a **decentralized function marketplace** where developers publish code modules and earn money every time someone uses them. Think **GitHub meets AWS Lambda meets Crypto**.

- **For Developers:** Monetize your code with zero infrastructure
- **For Users:** Pay only for what you use, no subscriptions
- **For Everyone:** Verifiable, composable, unstoppable applications

## ⚡ Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

## ✨ Key Features

### 🔐 Multi-Wallet Support
- **Polkadot** (Subwallet) - Substrate chains
- **Ethereum** (Metamask) - EVM chains  
- **Solana** (Phantom) - High-performance execution
- **Local** - Browser-based key management with signing/verification

### 💬 Interactive Chat Interface
- **Module Selector** - Browse and select from available modules with autocomplete
- **Schema Editor** - Configure parameters with JSON schema validation
- **Transaction Panel** - Real-time transaction tracking with cost display
- **Resizable Layout** - Drag-and-drop split screen for optimal workflow

### 🛡️ Security First
- **Auto-Verification** - Every signature verified immediately after signing
- **Message Signing** - Sign messages with your private key
- **Signature Verification** - Verify signatures from other users
- **Client-side Keys** - Your keys never leave your device

### 🎨 Modern UI/UX
- **Terminal Aesthetic** - Hacker-style green-on-black theme
- **Responsive Design** - Mobile-first with Tailwind CSS
- **Smooth Animations** - Framer Motion transitions
- **Smart Autocomplete** - Intelligent module/function suggestions

## 📁 Project Structure

```
src/
├── app/                    # Next.js app router
│   ├── chat/              # Chat interface with transactions
│   ├── mod/               # Module exploration & management
│   └── user/              # User profiles & wallet integration
├── mod/
│   ├── chat/              # Chat components & transaction panel
│   ├── client/            # API client with authentication
│   ├── key/               # Cryptographic key management (SR25519, ECDSA)
│   ├── wallet/            # Multi-wallet adapters
│   └── user/              # User components (Sign/Verify, Transfer)
```

## 🎯 Core Workflows

### Register a Module
```python
api = Api(key="your_key")
api.reg(mod="my_awesome_function")
# Done! Now earn when people use it
```

### Call a Module
```python
result = api.call(
    fn="image_resizer/resize",
    params={"width": 800},
    cost=0.01
)
```

### Use Smart Module Selector
1. Type module name (e.g., "image")
2. See filtered suggestions in real-time
3. Select module, then type "/" for functions
4. Pick function from autocomplete dropdown
5. Hit Enter to execute

### Sign & Verify Messages
1. Enter message in Sign panel
2. Click "$ SIGN" - signature auto-verified
3. Copy signature with 📋 button
4. Verify any signature in Verify panel

## 🔧 Configuration

Create `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_CHAIN_ENDPOINT=ws://localhost:9944
NEXT_PUBLIC_NETWORK=local
```

## 🐳 Docker Deployment

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## 📦 Tech Stack

**Frontend:**
- Next.js 14 (App Router + Server Components)
- React 18 with TypeScript
- Tailwind CSS + Framer Motion

**Blockchain:**
- @polkadot/api - Substrate interaction
- ethers - Ethereum integration
- Cryptographic signing/verification

**Storage:**
- IPFS - Decentralized content storage
- Immutable version history

## 🔒 Security Best Practices

1. ✅ **Always verify signatures** before trusting them
2. ✅ **Check auto-verify results** after signing messages  
3. ✅ **Never share private keys** - they stay in your browser
4. ✅ **Read what you sign** - understand the message content
5. ✅ **Use HTTPS in production** - protect data in transit

## 🌟 Why MOD?

| Traditional Cloud | MOD Protocol |
|------------------|-------------|
| AWS charges you | You charge users |
| Code can disappear | Stored forever on IPFS |
| Trust Amazon | Verify cryptographically |
| Complex billing | Automatic micropayments |
| Vendor lock-in | Use any module |

**Join the revolution. Build once, earn forever.**

## 📚 Documentation

- [User Profile Module](./src/mod/user/README.md) - Sign/Verify guide
- [One Pager](./docs/onepager.md) - Quick overview
- [Whitepaper](./docs/whitepaper.md) - Technical deep dive

## 🚀 Deployment

### Vercel (Recommended)
```bash
npm i -g vercel
vercel
```

### Docker
```bash
docker build -t mod-app .
docker run -p 3000:3000 mod-app
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

## 📄 License

MIT License - See LICENSE file

---

**Built with ⚡ by the MOD Protocol Team**

*"Simplicity is the ultimate sophistication." - Leonardo da Vinci*

## 🔗 Quick Links

- **Dev Server:** `npm run dev` → http://localhost:3000
- **Production:** `npm run build && npm start`
- **Docker:** `docker-compose up -d`
- **Lint:** `npm run lint`
- **Format:** `npm run format:fix`
