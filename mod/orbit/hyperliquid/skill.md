# Hyperliquid

Hyperliquid DEX trading module. Perpetual futures on a fully on-chain orderbook.

## Capabilities

- **Market Data** — prices, orderbooks, candles, all mids
- **Trading** — limit orders, market orders, modify/cancel, close positions
- **Account** — positions, balances, open orders, fills, funding history
- **Vaults** — browse, deposit/withdraw, performance, leaderboard
- **Trader Analysis** — leaderboard, profiles, PnL history, volume search

## Usage

```python
from mod import HyperliquidMod

hl = HyperliquidMod()                          # public data only
hl = HyperliquidMod(api_key="...", api_secret="...")  # trading

# prices
hl.fetch_all_mids()
hl.fetch_orderbook("ETH")
hl.fetch_candles("BTC", interval="1h")

# trading
hl.place_order("ETH", is_buy=True, size=0.1, price=3000)
hl.market_order("ETH", is_buy=True, size=0.1)
hl.cancel_order("ETH", order_id=12345)
hl.close_position("ETH", address="0x...")

# account
hl.fetch_user_state("0x...")
hl.get_open_orders("0x...")
hl.get_balance("0x...")

# vaults
hl.list_vaults()
hl.get_top_vaults(sort_by="pnl", limit=10)
hl.deposit_to_vault("0xvault...", amount=100)

# research
hl.analyze_trader("0x...")
hl.analyze_vault("0xvault...")
hl.get_leaderboard("pnl")
```

## Structure

```
mod.py              # core module (HyperliquidMod class)
app/                # Next.js dashboard
server/             # FastAPI backend (server/api.py)
docs/               # README, install, deployment, quickstart guides
scripts/            # start, stop, restart, status, logs shell scripts
ecosystem.config.js # PM2 process config
```

## Env

See `.env.example` for required keys. Supports mainnet + testnet (`testnet=True`).
