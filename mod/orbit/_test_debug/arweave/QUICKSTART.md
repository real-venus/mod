# Arweave Module - Quick Start

## 🚀 Start the App

```bash
# From arweave module directory
./scripts/start.sh

# Or manually
cd app
npm install  # First time only
npm run dev
```

Access at: **http://localhost:8850**

## 📦 What You Get

### Web Interface (Port 8850)
- **Upload**: Store JSON/text data permanently on Arweave
- **Retrieve**: Fetch data by transaction ID
- **Wallet**: Check balance and calculate storage costs

### Python Module
```python
from arweave import ArweaveClient

ar = ArweaveClient()
tx_id = ar.add({"key": "value"})
data = ar.get(tx_id)
```

## ⚙️ Configuration

### Backend API (Optional)
For full functionality, start the Python backend:

```bash
cd ../../core
m.serve('api')
```

Set environment variable if needed:
```bash
export ARWEAVE_API=http://localhost:8000/arweave
```

### Wallet (Optional)
For actual uploads to Arweave:

```python
ar = ArweaveClient(wallet_path="path/to/wallet.json")
```

Get a wallet at https://arweave.app

## 📁 Project Structure

```
arweave/
├── arweave.py          # Python client library
├── app/                # Next.js web interface
│   ├── src/
│   │   └── app/
│   │       ├── api/arweave/    # Backend proxy
│   │       ├── page.tsx        # Main UI
│   │       └── ...
│   └── package.json
├── scripts/
│   └── start.sh       # Quick start script
└── README.md          # Full documentation
```

## ✨ Key Features

- 🌐 **Permanent Storage**: Data stored on Arweave is immutable
- 🔄 **IPFS-like API**: Familiar `add()`, `get()`, `cat()` interface
- 💰 **Cost Estimation**: Calculate storage prices before uploading
- 📊 **Wallet Management**: Check balance and transactions
- 🎨 **Modern UI**: Next.js with Tailwind CSS, dark mode support
- 🔒 **Type-Safe**: TypeScript throughout

## 🧪 Test the Build

```bash
cd app
npm run build
# Should complete with no errors
```

## 📚 Next Steps

- Read [README.md](README.md) for detailed API documentation
- Check [app/README.md](app/README.md) for frontend specifics
- See [TEST.md](app/TEST.md) for comprehensive testing guide

## 💡 Tips

- Data on Arweave is **permanent** - can't be deleted or modified
- One-time payment for **permanent** storage (~$0.005 per MB)
- All data is **public** via transaction ID
- Works with any Arweave gateway

## 🆘 Troubleshooting

**Port 8850 in use?**
```bash
# Kill existing process
lsof -ti:8850 | xargs kill -9
```

**Dependencies issues?**
```bash
cd app
rm -rf node_modules package-lock.json
npm install
```

**Backend not connecting?**
- Ensure backend API is running on port 8000
- Check `ARWEAVE_API` environment variable

## ✅ Verification

Your app is working if:
- [x] Builds without errors
- [x] Starts on http://localhost:8850
- [x] Shows three tabs: Upload, Retrieve, Wallet
- [x] UI is responsive and styled
- [x] API route responds at /api/arweave

---

**Built with the Mod Framework**
