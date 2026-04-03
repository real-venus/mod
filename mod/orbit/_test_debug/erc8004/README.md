# 🤖 ERC-8004 Protocol

> Trustless AI Agent Identity, Reputation & Validation on Ethereum

[![Next.js 14](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![Ethereum](https://img.shields.io/badge/Ethereum-Mainnet-purple.svg)](https://ethereum.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## 🎯 What is ERC-8004?

ERC-8004 is Ethereum's identity standard for AI agents, providing a comprehensive framework for agent discovery, reputation management, and action validation. Deployed on Ethereum Mainnet on January 29, 2026.

## ✨ Features

### Frontend Application
- **🤖 Agent Registration** - Register AI agents with NFT-based identity
- **🏪 Agent Marketplace** - Browse and discover registered agents
- **⭐ Reputation System** - Submit and view agent feedback
- **🛡️ Validation Proofs** - Submit and verify agent task validations
- **💼 Wallet Integration** - Connect with MetaMask and Web3 wallets
- **🎨 Modern UI** - Beautiful, responsive design with dark mode

### Three Core Registries

1. **Identity Registry** - NFT-based permanent agent identity (ERC-721)
2. **Reputation Registry** - Transparent feedback and performance tracking
3. **Validation Registry** - Cryptographic proofs (Optimistic, ZK-Proof, TEE)

## 🚀 Quick Start

### Frontend Application

```bash
# Navigate to app directory
cd app

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Update contract addresses in .env.local

# Start development server
npm run dev
```

Or use the start script:

```bash
cd app
./scripts/start.sh
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Python Module

```python
from erc8004.mod import Mod

# Initialize the module
mod = Mod()

# Execute operations
result = mod.forward(5, 10)
print(result)  # 15
```

## 📁 Project Structure

```
erc8004/
├── app/                        # Next.js frontend application
│   ├── app/                    # Next.js app directory
│   │   ├── page.tsx           # Home page with marketplace
│   │   ├── layout.tsx         # Root layout
│   │   └── agent/[id]/        # Agent detail pages
│   ├── components/            # React components
│   │   ├── WalletConnect.tsx  # Wallet connection
│   │   ├── RegisterAgent.tsx  # Agent registration
│   │   ├── AgentMarketplace.tsx # Agent browser
│   │   ├── AgentCard.tsx      # Agent card
│   │   ├── ReputationPanel.tsx # Reputation system
│   │   └── ValidationPanel.tsx # Validation proofs
│   ├── lib/                   # Utilities & config
│   ├── types/                 # TypeScript definitions
│   └── README.md              # Frontend documentation
├── erc8004/                   # Python module
│   └── mod.py                 # Core module
├── requirements.txt           # Python dependencies
├── docker-compose.yml         # Docker setup
└── README.md                  # This file
```

## 🔧 Configuration

### Update Contract Addresses

Edit `app/lib/config.ts` with deployed contract addresses:

```typescript
export const CHAIN_CONFIG = {
  mainnet: {
    chainId: 1,
    contracts: {
      identityRegistry: '0x...', // Your deployed address
      reputationRegistry: '0x...', // Your deployed address
      validationRegistry: '0x...', // Your deployed address
    },
  },
};
```

## 🎨 Tech Stack

### Frontend
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Web3**: ethers.js v6
- **UI**: lucide-react icons, react-toastify

### Backend
- **Language**: Python 3.8+
- **Blockchain**: Ethereum (Mainnet, Sepolia, Base)

## 📚 ERC-8004 Standard

### Identity Registry
- Assigns each agent a permanent NFT-based ID
- Links to metadata describing capabilities and protocols
- Enables agent discovery and ownership

### Reputation Registry
- Standardized feedback submission interface
- Transparent performance tracking
- Human and agent-submitted reviews

### Validation Registry
- **Optimistic Validation**: Stakers re-run and verify tasks
- **ZK-Proofs**: Zero-knowledge cryptographic proofs
- **TEE**: Trusted Execution Environment attestations

## 🌐 Resources

### Learn More
- [ERC-8004 Developer's Guide (QuickNode)](https://blog.quicknode.com/erc-8004-a-developers-guide-to-trustless-ai-agent-identity/)
- [Everything About ERC-8004 (OneKey)](https://onekey.so/blog/ecosystem/everything-you-need-to-know-about-erc-8004-20260210113200/)
- [ERC-8004 Explained (Ledger Academy)](https://www.ledger.com/academy/glossary/erc-8004)
- [What is ERC-8004? (CCN Education)](https://www.ccn.com/education/crypto/erc-8004-ai-agents-on-chain-ethereum-how-works-risks-explained/)
- [ERC-8004 Protocol Overview (PayRam)](https://www.payram.com/blog/what-is-erc-8004-protocol)

### Official Links
- [ERC-8004 Specification (IQ.wiki)](https://iq.wiki/wiki/erc-8004)
- [Ethereum Documentation](https://ethereum.org/en/developers/docs/)
- [Next.js Documentation](https://nextjs.org/docs)

## 🛠️ Development

```bash
# Run frontend development server
cd app
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## 🐳 Using Docker

```bash
# Build and run
docker-compose up --build

# Or build manually
docker build -t erc8004 .
docker run -it erc8004
```

## 🔐 Security Notes

- Never commit private keys or sensitive data
- Always verify contract addresses before transactions
- Use testnet (Sepolia, Base Sepolia) for development
- Audit smart contracts before mainnet deployment
- Review all transactions in wallet before signing

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🎯 Roadmap

- [ ] Smart contract deployment scripts
- [ ] IPFS integration for metadata storage
- [ ] Agent-to-agent communication protocols
- [ ] Advanced validation proof types
- [ ] Multi-chain support
- [ ] Mobile app
- [ ] GraphQL indexer for agent data

## 📞 Support

For questions, issues, or feature requests:
- Open an issue on GitHub
- Join our Discord community
- Follow us on Twitter

---

<p align="center">Built with ❤️ for the AI Agent Economy</p>
<p align="center">Deployed on Ethereum Mainnet • January 29, 2026</p>
