# Uniswap

Uniswap V3 multi-chain connector. Pools, swaps, tokens, and historical data across 5 EVM chains with round-robin multi-source architecture.

## Capabilities

- **Multi-Chain** — Ethereum, Arbitrum, Base, Polygon, Optimism
- **Multi-Source** — Direct RPC (4 free RPCs/chain), Envio HyperSync (2000x faster), The Graph (optional)
- **Pool Discovery** — top pools by TVL, dynamic discovery via Swap event scanning
- **Swap History** — recent swaps, pool-specific swaps, daily OHLCV data
- **Token Prices** — derived from sqrtPriceX96 + stablecoin anchoring, USD estimation
- **Smart Caching** — disk-based JSON cache with per-method TTLs
- **Data Persistence** — save/load/list/delete local JSON snapshots
- **Explorer** — scan blocks, discover all pools + compute token prices (no API keys needed)

## Usage

```python
from uniswap.mod import Mod

m = Mod(api_key='your-thegraph-key')  # api_key optional

# pools
pools = m.get_pools(chain='ethereum', limit=20)
pool = m.get_pool(chain='ethereum', pool_id='0x88e6...')
history = m.get_pool_day_data(chain='ethereum', pool_id='0x88e6...', days=30)

# swaps
swaps = m.get_swaps(chain='arbitrum', days=7, source='hypersync')
pool_swaps = m.get_swaps_by_pool(chain='base', pool_id='0x...', days=30)

# tokens
tokens = m.get_tokens(chain='ethereum', limit=20)

# explore (fully open-source, no API keys)
result = m.explore(chain='ethereum', blocks=5000, min_volume_usd=1000)

# data management
m.save_data(pools, name='top_pools', chain='ethereum')
saved = m.list_saved(chain='ethereum')

# utilities
m.chains()       # list supported chains
m.health()       # health check
m.test()         # test all data sources
m.clear_cache()  # clear disk cache
```

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/pools` | Top pools (chain, limit, orderBy, source) |
| GET | `/pool/{pool_id}` | Pool details |
| GET | `/pool/{pool_id}/history` | Daily OHLCV |
| GET | `/swaps` | Recent swaps |
| GET | `/swaps/{pool_id}` | Swaps for pool |
| GET | `/tokens` | Top tokens |
| GET | `/explore` | Scan blocks, discover pools (SSE streaming) |
| GET | `/chains` | Supported chains |
| POST | `/clear-cache` | Clear cache |
| POST | `/save` | Save data |
| GET | `/saved` | List saved files |

## Structure

```
uniswap/mod.py      # core Mod class (1700+ lines)
server/server.py     # FastAPI backend (port 50088)
app/                 # Next.js dashboard (port 3088)
test/test_mod.py     # unit + integration tests
data/cache/          # disk cache
config.json          # module metadata + schema
```

## Env

No API keys required for RPC + HyperSync. Optional `GRAPH_API_KEY` for The Graph subgraphs.
