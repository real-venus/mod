# Polymarket

Prediction market interface with Rust-powered trading, data, scraping, and backtesting.

## Quick Start

```python
import mod as m
p = m.mod('polymarket')()

# read-only (no key needed)
p.search("election")
p.trending()
p.markets(limit=10)

# with trading
p = m.mod('polymarket')(private_key="0x...")
p.auth()
p.buy(token_id, price=0.5, size=10)
```

## Server

The API server and Rust engine both live inside `polymarket/` alongside `mod.py`. The `serve()` method deploys both the FastAPI backend and the Next.js frontend.

```python
# start API (port 50091) + Next.js app (port 3091)
p.serve()

# API only
p.serve(api_only=True)

# app only
p.serve(app_only=True)

# stop
p.kill()

# check status
p.status()
```

Or run the server directly:

```bash
cd polymarket
POLYMARKET_PRIVATE_KEY=0x... uvicorn server:app --port 50091 --reload
```

## API Endpoints

### Market Data (no auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/markets` | List markets (limit, active, order) |
| GET | `/markets/{condition_id}` | Single market |
| GET | `/search?q=...` | Search markets |
| GET | `/trending` | Trending by volume |
| GET | `/by-liquidity` | Sorted by liquidity |
| GET | `/ending-soon` | Markets ending soon |
| GET | `/tags` | All market tags |
| GET | `/events` | List events |
| GET | `/events/{event_id}` | Single event |
| GET | `/orderbook/{token_id}` | Order book |
| GET | `/midpoint/{token_id}` | Midpoint price |
| GET | `/last-trade-price/{token_id}` | Last trade price |
| GET | `/price-history/{condition_id}` | Price history |

### Trading (requires POLYMARKET_PRIVATE_KEY)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/order` | Place limit order |
| POST | `/market-order` | Place market order |
| DELETE | `/order/{order_id}` | Cancel order |
| DELETE | `/orders` | Cancel all orders |
| GET | `/orders` | Open orders |
| GET | `/positions` | Current positions |
| GET | `/position-value` | Total position value |
| GET | `/trades` | Trade history |

### User Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/{address}/positions` | User positions |
| GET | `/users/{address}/trades` | User trade history |

### Scraping
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/scraper/discover?count=50` | Auto-discover markets |
| POST | `/scraper/start?interval=60` | Start scraper |
| POST | `/scraper/stop` | Stop scraper |
| GET | `/scraper/status` | Scraper status |

### History
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/history/prices/{condition_id}` | Stored prices |
| GET | `/history/trades/{condition_id}` | Stored trades |
| GET | `/history/markets` | All tracked markets |
| GET | `/history/stats` | Store stats |

### Backtesting
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/backtest` | Run backtest on stored data |

## Architecture

```
polymarket/
├── polymarket/                 # anchor dir (mod + engine + server)
│   ├── mod.py                  # Mod protocol class
│   ├── server.py               # FastAPI server (wraps mod.py)
│   ├── Cargo.toml              # Rust crate config
│   └── src/                    # Rust engine (polymarket-rs)
│       ├── lib.rs              # PyO3 module + PolymarketEngine
│       ├── auth.rs             # CLOB auth / signing
│       ├── signing.rs          # EIP-712 order signing
│       ├── clob.rs             # CLOB REST client
│       ├── gamma.rs            # Gamma API client
│       ├── ws.rs               # WebSocket streams
│       ├── history.rs          # SQLite history store + scraper
│       ├── backtest.rs         # Backtesting engine
│       └── types.rs            # Shared types
├── app/                        # Next.js frontend
├── config.json                 # Mod protocol config
├── docker-compose.yml
└── Dockerfile
```

## Build Rust Engine

```bash
pip install maturin

# via mod protocol
python -c "import mod as m; m.mod('polymarket')().build()"

# or manually (from polymarket/polymarket/)
cd polymarket && maturin develop --release
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `POLYMARKET_PRIVATE_KEY` | Private key for trading (optional for read-only) |
| `POLYMARKET_DB_PATH` | SQLite path for history (default: `polymarket_history.db`) |
| `PORT` | API server port (default: `50091`) |

## Mod Protocol

```python
import mod as m
p = m.mod('polymarket')()

p.search("bitcoin")         # market search
p.trending(20)              # trending markets
p.markets(limit=50)         # list markets
p.serve()                   # start API + app
p.kill()                    # stop services
p.status()                  # check running
p.test()                    # self-test
p.build()                   # compile rust engine
```

Port: `50091` (API) / `3091` (App)
