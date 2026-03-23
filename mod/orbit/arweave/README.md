# Arweave Module

Permanent decentralized storage on the Arweave network with IPFS-like interface.

## Overview

This module provides a Python client and Next.js web interface for interacting with Arweave, the permanent data storage protocol.

## Components

### Python Client (`arweave.py`)

```python
from arweave import ArweaveClient

# Initialize client
ar = ArweaveClient(gateway="https://arweave.net")

# Upload data
tx_id = ar.add({"key": "value"})

# Retrieve data
data = ar.get(tx_id)

# Get balance
balance = ar.balance()

# Calculate price
price = ar.price(1024)  # bytes
```

### Web Interface (`app/`)

A Next.js application providing a user-friendly interface for:
- Uploading JSON and text data
- Retrieving data by transaction ID
- Checking wallet balance
- Calculating storage costs

## Quick Start

### Web App

```bash
# Start the web interface
./scripts/start.sh

# Or manually
cd app
npm install
npm run dev
```

Access at: http://localhost:8850

### Python Module

```bash
# Use via mod framework
m.mod('arweave').test()

# Or import directly
from arweave import ArweaveClient
ar = ArweaveClient()
```

## Features

- **IPFS-like Interface**: Familiar `add()`, `get()`, `cat()` methods
- **Permanent Storage**: Data stored on Arweave is immutable and permanent
- **Wallet Management**: Load JWK wallet, check balance
- **Price Estimation**: Calculate storage costs before uploading
- **Tags Support**: Add metadata tags to transactions
- **File Operations**: Upload and download files

## API

### ArweaveClient

```python
class ArweaveClient:
    def __init__(self, gateway: str = "https://arweave.net",
                 wallet_path: Optional[str] = None)

    # Upload
    def add(self, data: Dict[str, Any], tags: Optional[Dict] = None) -> str
    def add_file(self, file_path: str, tags: Optional[Dict] = None) -> str

    # Retrieve
    def get(self, cid: str) -> Dict[str, Any]
    def cat(self, cid: str) -> bytes
    def get_file(self, cid: str, output_path: Optional[str] = None) -> bytes

    # Wallet
    def load_wallet(self, path: str)
    def get_address(self) -> Optional[str]
    def balance(self) -> float

    # Pricing
    def price(self, size: int) -> float

    # Utility
    def cid(self, data: Dict) -> str
    def test(self) -> bool
```

## Configuration

### Environment Variables

- `ARWEAVE_API`: Backend API URL (default: `http://localhost:8000/arweave`)

### Wallet Setup

To upload data, you need an Arweave wallet:

```python
ar = ArweaveClient(wallet_path="path/to/wallet.json")
```

Generate a wallet at https://arweave.app

## Storage Costs

Arweave charges a one-time fee for permanent storage:
- Price is calculated in AR tokens based on data size
- Use `ar.price(bytes)` to estimate costs
- Current rates: ~$0.005 per MB (varies with AR price)

## Architecture

```
arweave/
├── arweave.py              # Python client
├── app/                    # Next.js web interface
│   ├── src/
│   │   └── app/
│   │       ├── api/arweave/  # API routes
│   │       ├── page.tsx      # Main UI
│   │       └── ...
│   └── package.json
├── scripts/
│   └── start.sh           # Startup script
└── README.md
```

## Examples

### Upload JSON Data

```python
ar = ArweaveClient()
data = {"message": "Hello Arweave!", "timestamp": 1234567890}
tx_id = ar.add(data, tags={"Content-Type": "application/json"})
print(f"Uploaded: {tx_id}")
```

### Retrieve Data

```python
data = ar.get(tx_id)
print(data)
```

### Upload File

```python
tx_id = ar.add_file("document.pdf", tags={"Type": "Document"})
```

### Check Balance

```python
balance = ar.balance()
print(f"Balance: {balance} AR")
```

## Important Notes

- **Permanent Storage**: Data cannot be deleted once uploaded
- **Immutable**: Uploaded data cannot be modified
- **Public**: All data is publicly accessible via transaction ID
- **Costs**: One-time payment for permanent storage
- **Gateway**: Uses arweave.net by default, but any gateway works

## Development

### Backend Integration

The web app requires the Python backend API:

```bash
cd ../../core
m.serve('api')
```

This starts FastAPI server that the Next.js app calls.

### Port Configuration

- Web App: 8850
- Backend API: 8000

## Resources

- [Arweave Website](https://arweave.org)
- [Arweave Docs](https://docs.arweave.org)
- [Arweave Gateway](https://arweave.net)
- [Get AR Tokens](https://arweave.app)

## License

Part of the Mod framework ecosystem.
