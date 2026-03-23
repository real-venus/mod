# ERC-8004 Frontend

A comprehensive frontend application for interacting with the ERC-8004 AI Agent Identity & Reputation Protocol on Ethereum.

## 🌟 Features

- **Agent Registration** - Register new AI agents with identity NFTs
- **Agent Marketplace** - Browse and discover AI agents
- **Reputation System** - View and submit feedback for agents
- **Validation Proofs** - Submit and verify agent task validations
- **Wallet Integration** - Connect with MetaMask and other Web3 wallets
- **Responsive Design** - Beautiful UI that works on all devices
- **Dark Mode** - Automatic dark mode support

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- MetaMask or compatible Web3 wallet

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Update contract addresses in .env.local and lib/config.ts

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
app/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx           # Home page with marketplace
│   ├── globals.css        # Global styles
│   └── agent/[id]/        # Agent detail pages
├── components/            # React components
│   ├── WalletConnect.tsx  # Wallet connection
│   ├── RegisterAgent.tsx  # Agent registration form
│   ├── AgentMarketplace.tsx # Agent browser
│   ├── AgentCard.tsx      # Agent card component
│   ├── ReputationPanel.tsx # Reputation display
│   └── ValidationPanel.tsx # Validation proofs
├── lib/                   # Utilities
│   ├── ethereum.ts        # Ethereum helpers
│   └── config.ts          # Contract addresses
├── types/                 # TypeScript types
│   └── erc8004.ts         # ERC-8004 interfaces
└── public/                # Static assets
```

## 🔧 Configuration

Update contract addresses in `lib/config.ts`:

```typescript
export const CHAIN_CONFIG = {
  mainnet: {
    chainId: 1,
    contracts: {
      identityRegistry: '0x...', // Update with deployed address
      reputationRegistry: '0x...', // Update with deployed address
      validationRegistry: '0x...', // Update with deployed address
    },
  },
  // ... other networks
};
```

## 🎨 Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Web3**: ethers.js v6
- **UI Icons**: lucide-react
- **Notifications**: react-toastify

## 📚 ERC-8004 Standard

ERC-8004 provides three core registries for AI agents:

1. **Identity Registry** - NFT-based agent identity and metadata
2. **Reputation Registry** - Transparent feedback and ratings
3. **Validation Registry** - Cryptographic proofs of agent actions

Learn more:
- [ERC-8004 Guide (QuickNode)](https://blog.quicknode.com/erc-8004-a-developers-guide-to-trustless-ai-agent-identity/)
- [ERC-8004 Overview (OneKey)](https://onekey.so/blog/ecosystem/everything-you-need-to-know-about-erc-8004-20260210113200/)
- [Ledger Academy](https://www.ledger.com/academy/glossary/erc-8004)

## 🛠️ Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## 🌐 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Other Platforms

Build the production bundle:

```bash
npm run build
npm start
```

Deploy the `.next` folder to your hosting platform.

## 🔐 Security Notes

- Never commit private keys or sensitive data
- Always verify contract addresses before transactions
- Use testnet for development and testing
- Audit smart contracts before mainnet deployment

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## 🔗 Links

- [ERC-8004 Specification](https://iq.wiki/wiki/erc-8004)
- [Ethereum Documentation](https://ethereum.org/en/developers/docs/)
- [Next.js Documentation](https://nextjs.org/docs)
- [ethers.js Documentation](https://docs.ethers.org/v6/)

---

Built with ❤️ for the AI Agent Economy
