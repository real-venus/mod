# Sr25519 to ERC20 Bridge 🌉

> *Bridge your Substrate tokens to Base with cryptographic proof of ownership*

## 🎉 No API Keys Required!

Develop and test the complete bridge stack locally **without any API keys**. See [NO_API_KEYS.md](./NO_API_KEYS.md) and [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md).

## Overview

A trustless bridge system that enables users to claim ERC20 tokens on Base by proving ownership of their sr25519 addresses on Substrate-based chains. The bridge operator acts as a trusted intermediary, verifying cryptographic signatures and distributing tokens.

## ✨ Features

- **🔑 Cryptographic Proof**: Users prove ownership via sr25519 signatures
- **🚫 No Double Claims**: On-chain enforcement prevents duplicate claims
- **📊 Snapshot Support**: Rust tool for capturing Substrate chain state
- **⚡ Batch Processing**: Efficient batch distribution of tokens
- **🎯 Simple UX**: Connect Subwallet + MetaMask, sign, and claim
- **🛡️ Production Ready**: Smart contracts, API backend, and React frontend
- **🐳 Docker Support**: Containerized deployment for consistency

## 🚀 Quick Start

### 🏃 Local Development (No API Keys Required!)

Get started in under 2 minutes with zero configuration:

```bash
# Install
npm install && pip install -r requirements.txt

# Compile & test
npx hardhat compile && npx hardhat test

# Start local blockchain
npx hardhat node

# Deploy to local network (in another terminal)
npx hardhat run scripts/deploy.js --network localhost

# Start backend
python mod.py
```

**See [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) for complete local setup guide.**

### 🌐 Testnet/Mainnet Deployment

For real network deployment, see **[QUICKSTART.md](./QUICKSTART.md)**.

Required:
- `PRIVATE_KEY` in `.env` for deployment

Optional:
- `BASESCAN_API_KEY` for contract verification (can deploy without this)

### 3. Generate Snapshot

```bash
cd bridge
cargo run -- snap --show-report
```

### 4. Start Backend

```bash
python mod.py
```

### 5. Integrate Frontend

```tsx
import Sr25519Bridge from './frontend/Sr25519Bridge';

export default function Page() {
  return <Sr25519Bridge />;
}
```

## 📚 Documentation

- **[NO_API_KEYS.md](./NO_API_KEYS.md)** - 🎉 No API keys needed! Start here
- **[LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)** - ⭐ Complete local setup guide (2 minutes)
- **[QUICKSTART.md](./QUICKSTART.md)** - Deploy to testnet/mainnet
- **[BRIDGE.md](./BRIDGE.md)** - Complete architecture and API reference
- **[IMPLEMENTATION.md](./IMPLEMENTATION.md)** - Implementation details

## 🏗️ Project Structure

```
bridge/
├── contracts/
│   ├── BridgeToken.sol       # ERC20 token for bridged assets
│   └── Sr25519Bridge.sol     # Bridge contract with claim tracking
├── frontend/
│   └── Sr25519Bridge.tsx     # React component (Subwallet + MetaMask)
├── scripts/
│   └── deploy.js             # Hardhat deployment script
├── test/
│   └── Bridge.test.js        # Contract tests
├── bridge/                   # Rust snapshot tool
│   └── src/main.rs          # Substrate chain snapshot
├── mod.py                    # Python FastAPI backend
├── hardhat.config.js         # Hardhat configuration
├── package.json              # Node dependencies
├── requirements.txt          # Python dependencies
├── QUICKSTART.md            # Quick start guide
├── BRIDGE.md                # Full documentation
└── README.md                # This file
```

## 🐳 Docker Deployment

Run BaseMod in a containerized environment for consistency and portability:

```bash
# Build and launch with Docker Compose
docker-compose up --build

# Run in detached mode
docker-compose up -d

# Stop containers
docker-compose down
```

## 🔧 Extending BaseMod

BaseMod is architected for extensibility. Create custom modules by inheriting from the base class:

```python
from base.mod import BaseMod

class MyCustomMod(BaseMod):
    """Extended module with custom functionality"""
    
    def custom_method(self, data):
        """Your custom business logic"""
        processed = self.multiply(data, 2)
        return processed
    
    def advanced_crypto_analysis(self):
        """Combine base features for advanced use cases"""
        price = self.get_bittenso_price()
        # Add your analysis logic
        return analysis_result
```

## 💡 Use Cases

- **🏢 Enterprise Applications**: Foundation for scalable, modular systems
- **📊 Cryptocurrency Monitoring**: Real-time price tracking and analysis
- **🎓 Educational Projects**: Learn modular design patterns and best practices
- **🔌 API Integration**: Template for building API-driven applications
- **⚙️ Microservices**: Base component for distributed architectures

## 🤝 Contributing

Contributions are welcome and appreciated! Here's how you can help:

- 🐛 **Report bugs** via GitHub issues
- 💡 **Suggest features** and improvements
- 🔀 **Submit pull requests** with enhancements
- 📖 **Improve documentation** and examples
- ⭐ **Star the project** if you find it useful

## 📝 License

This project is open source and available for use under permissive licensing.

## 🌟 Philosophy

BaseMod is built on foundational principles:

- **SOLID Principles** → Maintainable, scalable code architecture
- **Simplicity First** → Elegant solutions over complex implementations
- **Modular Design** → Composable, reusable components
- **Production Quality** → Enterprise-grade reliability and performance
- **Developer Experience** → Intuitive APIs and comprehensive documentation

## 🎯 Performance

- ⚡ **Fast**: Optimized for low-latency operations
- 🪶 **Lightweight**: Minimal resource footprint
- 🔄 **Scalable**: Designed to handle growth
- 🛡️ **Reliable**: Robust error handling and validation

## 🔗 Quick Links

- 📘 [Complete Tutorial](TUTORIAL.md)
- 🐳 [Docker Hub](#) (if applicable)
- 📦 [PyPI Package](#) (if applicable)
- 💬 [Community Forum](#) (if applicable)

---

**🚀 Ready to build something extraordinary?**

👉 **Start with the [TUTORIAL.md](TUTORIAL.md) for hands-on examples and advanced patterns!**

*Crafted with precision, purpose, and passion.* ⚡

---

<div align="center">
  <sub>Built by developers, for developers. Made with ❤️ and ☕</sub>
</div>