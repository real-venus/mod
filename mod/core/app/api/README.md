# Zcash L2 with IPFS State Storage

## 🚀 Revolutionary L2 Solution for Zcash

This system creates a Layer 2 solution for Zcash that stores state roots in IPFS and anchors them to the Zcash blockchain. Each L2 block's merkle root and IPFS hash are permanently recorded on Zcash, creating an immutable audit trail.

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   IPFS      │────▶│  L2 Bridge   │────▶│   Zcash     │
│  (State)    │     │  (Processor) │     │ (Anchor)    │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  PostgreSQL  │
                    │  (Indexer)   │
                    └──────────────┘
```

## 💡 How It Works

1. **L2 Transactions**: Users submit transactions to the L2 bridge
2. **Block Creation**: Transactions are batched into L2 blocks
3. **Merkle Root**: A merkle tree is created from all transactions
4. **IPFS Storage**: Complete block state is stored in IPFS
5. **Zcash Anchoring**: IPFS hash + merkle root are written to Zcash blockchain
6. **Verification**: Anyone can verify L2 state by checking Zcash + IPFS

## 🔥 Quick Start

```bash
# Clone and start
git clone <your-repo>
cd <repo-dir>

# Create data directories
mkdir -p data/{ipfs,zcash,l2-state,postgres}

# Start all services
docker-compose up -d

# Check health
curl http://localhost:3000/health
```

## 📡 API Endpoints

### Submit L2 Transaction
```bash
curl -X POST http://localhost:3000/api/l2/transaction \
  -H "Content-Type: application/json" \
  -d '{
    "from": "zs1...",
    "to": "zs1...",
    "amount": 1000000,
    "data": {"memo": "Payment for services"}
  }'
```

### Create L2 Block
```bash
curl -X POST http://localhost:3000/api/l2/block/create
```

### Get Block Info
```bash
curl http://localhost:3000/api/l2/block/1
```

### Get State from IPFS
```bash
curl http://localhost:3000/api/l2/state/<ipfs-hash>
```

## 🎯 Key Features

- ✅ **Decentralized State**: All L2 state stored on IPFS
- ✅ **Zcash Anchoring**: Immutable proof on Zcash blockchain
- ✅ **Merkle Proofs**: Verify any transaction in any block
- ✅ **Fast Finality**: L2 transactions confirm instantly
- ✅ **Low Cost**: Batch hundreds of transactions per Zcash tx
- ✅ **Privacy Ready**: Compatible with Zcash shielded addresses

## 🔧 Configuration

Edit `zcash.conf` for Zcash node settings.
Edit `docker-compose.yml` for service configuration.

### Environment Variables

```bash
IPFS_API=http://ipfs:5001
ZCASH_RPC=http://zcash:8232
ZCASH_USER=zcashrpc
ZCASH_PASSWORD=changeme
POSTGRES_DB=zcash_l2
POSTGRES_USER=l2user
POSTGRES_PASSWORD=l2pass
```

## 📊 Database Schema

### l2_blocks
- `block_number`: Sequential L2 block number
- `merkle_root`: Root hash of transaction merkle tree
- `ipfs_hash`: IPFS CID of complete block state
- `zcash_txid`: Zcash transaction ID containing anchor
- `state_data`: Full block data (JSONB)

### l2_transactions
- `tx_hash`: L2 transaction hash
- `block_number`: Which L2 block includes this tx
- `from_address`: Sender
- `to_address`: Recipient
- `amount`: Transfer amount
- `data`: Additional transaction data

## 🛡️ Security

- All state changes are cryptographically verified
- Merkle proofs allow verification without full state
- IPFS provides content-addressed storage (tamper-proof)
- Zcash blockchain provides immutable ordering

## 🚀 Production Deployment

1. Use mainnet Zcash (remove `testnet=1` from zcash.conf)
2. Secure RPC credentials
3. Enable SSL/TLS for API endpoints
4. Set up monitoring and alerting
5. Configure backup strategies for PostgreSQL
6. Pin important IPFS content

## 🌟 Future Enhancements

- [ ] Optimistic rollups
- [ ] ZK-SNARK proofs for privacy
- [ ] Cross-chain bridges
- [ ] Smart contract support
- [ ] Decentralized sequencer

## 💪 Long Live Pliny!

This is just the beginning. We're building the future of scalable, private, decentralized finance on Zcash.

**LFG! 🚀🚀🚀**

---

*Built with ❤️ for the Zcash community*