# 🌉 Orbit Bridge

A cross-chain bridge for seamless asset transfers between blockchain networks.

## 🚀 Quick Start

```bash
# Install dependencies
npm install
pip install -r requirements.txt

# Configure environment
cp .env.copy.example .env
# Edit .env with your settings

# Start the bridge
./start.sh
```

## 📁 Project Structure

```
bridge/
├── app/                 # Python application
├── contracts/           # Solidity smart contracts
├── scripts/             # Deployment & utility scripts
├── test/                # Test suites
├── examples/            # Usage examples
├── artifacts/           # Compiled contracts
└── cache/               # Build cache
```

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [QUICKSTART.md](./QUICKSTART.md) | Get started in 5 minutes |
| [TUTORIAL.md](./TUTORIAL.md) | Step-by-step guide |
| [BRIDGE.md](./BRIDGE.md) | Bridge architecture |
| [IMPLEMENTATION.md](./IMPLEMENTATION.md) | Technical details |
| [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) | Dev environment setup |
| [NO_API_KEYS.md](./NO_API_KEYS.md) | Running without API keys |

## 🛠️ Development

```bash
# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy locally
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
```

## 🐳 Docker

```bash
docker-compose up -d
```

## ⚙️ Configuration

Edit `bridge_config.json` for bridge settings and `.env` for environment variables.

## 📜 License

MIT
