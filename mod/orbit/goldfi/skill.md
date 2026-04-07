# GoldFi

Quadratic reward trading competition for precious metals. Tracks gold/silver PnL on Hyperliquid & Uniswap, distributes inflation rewards using x² curve. Weekly epochs.

## Capabilities

- **Epochs** — start/end weekly competition periods with configurable inflation pools
- **Trader Management** — register/unregister wallets across exchanges
- **PnL Tracking** — sync live equity from Hyperliquid (futures) and Uniswap (spot)
- **Quadratic Rewards** — x² for profits, -x² for losses, only positive scores earn rewards
- **Leaderboard** — live rankings with reward projections
- **History** — completed epoch archives with distribution stats
- **Prices** — live gold/silver prices across exchanges

## Usage

```python
import mod as m
gf = m.mod('goldfi')()

# epoch lifecycle
gf.start_epoch(inflation_pool=1000)
gf.status()
gf.end_epoch()

# traders
gf.register('0xAlice', 'hyperliquid')
gf.unregister('0xAlice')

# tracking
gf.sync()
gf.leaderboard()
gf.get_prices()

# history
gf.history()
gf.rewards(epoch_id='epoch_123')

# services
gf.serve()          # start API + app
gf.kill()           # stop all
gf.health()         # check status

# test
gf.test()
```

## Structure

```
goldfi/mod.py       # core module (Mod class)
server/server.py    # FastAPI backend (port 50095)
app/                # Next.js dashboard (port 3095)
contracts/          # Solidity contracts (GoldFi.sol)
auth.py             # crypto signature auth
config.json         # module config
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Service health check |
| GET | /status | Current epoch status |
| GET | /leaderboard | Live standings |
| GET | /assets | Tracked asset registry |
| GET | /prices | Current prices |
| GET | /rewards | Reward distribution |
| GET | /history | Completed epochs |
| GET | /traders | Registered traders |
| POST | /register | Register trader |
| POST | /unregister | Remove trader |
| POST | /sync | Refresh PnL |
| POST | /start_epoch | Begin new epoch |
| POST | /end_epoch | Finalize epoch |
