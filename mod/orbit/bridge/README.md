# 🌉 Orbit Bridge

> A powerful cross-chain bridge for seamless asset transfers between blockchain networks.

## 🚀 Quick Start

```bash
# Install dependencies
npm install
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start the bridge
./start.sh
```

## 📁 Project Structure

```
bridge/
├── app/              # Main application code
├── bridge/           # Core bridge logic
├── contracts/        # Smart contracts
├── scripts/          # Deployment & utility scripts
├── test/             # Test suite
├── examples/         # Usage examples
├── artifacts/        # Compiled contracts
└── cache/            # Build cache
```

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [QUICKSTART.md](./QUICKSTART.md) | Get up and running fast |
| [TUTORIAL.md](./TUTORIAL.md) | Step-by-step guide |
| [IMPLEMENTATION.md](./IMPLEMENTATION.md) | Technical details |
| [BRIDGE.md](./BRIDGE.md) | Bridge architecture |
| [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) | Dev environment setup |
| [NO_API_KEYS.md](./NO_API_KEYS.md) | Running without API keys |

## ⚙️ Configuration

Edit `bridge_config.json` for bridge settings and `.env` for environment variables.

## 🐳 Docker

```bash
docker-compose up -d
```

## 🧪 Testing

```bash
npm test
npx hardhat test
```

## 📜 License

MIT

---

**Built with ❤️ by the Orbit Team**