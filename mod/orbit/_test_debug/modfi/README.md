# ModFi - Lending Kingdom

DeFi lending aggregator on Base. Rust backend + 8-bit Mario HTML frontend.

## Run

```bash
cargo run
# http://localhost:8420
```

## API

- `GET /` - Frontend
- `GET /api/rates` - Live APY rates from Aave/Compound on Base (DeFi Llama)
- `GET /api/prices` - Token prices (DeFi Llama)
- `GET /api/positions/:address` - On-chain wallet balances (Base RPC)

## Stack

- **Backend**: Rust, Axum, Tokio, Reqwest
- **Frontend**: Vanilla HTML/CSS/JS, 8-bit pixel art theme
- **Data**: DeFi Llama (rates/prices), Base RPC (balances)
- **Contract**: Solidity 0.8.20 (LendingAggregator.sol)
