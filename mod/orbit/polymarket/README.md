# polymarket

Polymarket prediction market interface with trading, data, scraping, and backtesting. Rust-powered engine with Python CLI and Mario-themed Next.js terminal app.

## Capabilities

- **Market Data**: Search, list, filter, and sort prediction markets by volume/liquidity/end date
- **Trading**: Place limit and market orders via Polymarket CLOB (requires wallet + API credentials)
- **Copy Trading**: Track top traders by PNL/volume, view their positions and activity
- **Portfolio**: View positions, P&L, open orders
- **Scraping**: Background price/trade history scraper with SQLite storage
- **Backtesting**: Run threshold-based backtests on stored historical data
- **Categories**: politics, sports, crypto, pop-culture, business, science, tech, ai

## Usage

### Python
```python
import mod as m
p = m.mod('polymarket')()

# Read-only
p.search("election")
p.trending(limit=20)
p.markets(limit=100, order="volume")
p.market("0x...")                   # single market by condition_id
p.by_liquidity(limit=20)
p.ending_soon(limit=20)
p.events(limit=50, tag="crypto")
p.orderbook("0x...")                # order book by token_id
p.midpoint("0x...")                 # midpoint price
p.tags()                            # all categories

# Trading (requires private_key)
p = m.mod('polymarket')(private_key="0x...")
p.auth()                            # derive CLOB API credentials
p.buy("0x...", price=0.5, size=10)
p.sell("0x...", price=0.7, size=10)
p.market_buy("0x...", size=10)
p.market_sell("0x...", size=10)
p.positions()
p.open_orders()
p.cancel(order_id)
p.cancel_all()

# Scraping
p.discover(count=50)                # auto-track top markets
p.scrape(interval=60)               # start background scraper
p.scrape_status()
p.stored_prices("0x...", start=0, end=9999999999)
p.stored_trades("0x...")
p.store_stats()

# Backtesting
p.backtest(start=0, end=9999999999, strategy="threshold",
           buy_threshold=0.3, sell_threshold=0.7,
           initial_capital=1000, position_size_pct=10)

# Server
p.serve()                           # start API + Next.js app
p.serve(api_only=True)              # API only
p.kill()                            # stop all services
p.status()                          # check service status
```

### CLI
```bash
m polymarket/search query=election
m polymarket/markets limit=20
m polymarket/trending limit=10
m polymarket/by_liquidity limit=10
m polymarket/ending_soon limit=10
m polymarket/orderbook token_id=0x...
m polymarket/buy token_id=0x... price=0.5 size=10
m polymarket/sell token_id=0x... price=0.7 size=10
m polymarket/positions
m polymarket/open_orders
m polymarket/backtest start=0 end=9999999999 strategy=threshold
m polymarket/scrape interval=60
m polymarket/scrape_stop
m polymarket/serve
m polymarket/kill
m polymarket/status
m polymarket/test
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| GET | /markets | List markets (params: _limit, order, active, end_date_min, end_date_max) |
| GET | /markets/{condition_id} | Get single market |
| GET | /search | Search markets (params: q, _limit) |
| GET | /trending | Trending by volume |
| GET | /orderbook/{token_id} | Get order book |
| GET | /positions | Get positions (params: user) |
| GET | /trades | Get trade history (params: user) |
| POST | /order | Place limit order (auth required) |
| POST | /market-order | Place market order (auth required) |
| POST | /backtest | Run backtest |

## Structure

```
polymarket/
├── config.json              # mod config (ports 50091/3091)
├── skill.md                 # this file
├── polymarket/
│   └── mod.py               # Python module (Polymarket class)
└── app/                     # Next.js 14 app (Mario-themed terminal)
    ├── app/
    │   ├── page.tsx          # main page (markets, copy trading, portfolio tabs)
    │   ├── docs/page.tsx     # API documentation page
    │   ├── layout.tsx        # root layout with CRT overlay
    │   ├── globals.css       # pixel/Mario theme CSS
    │   ├── components/
    │   │   ├── Header.tsx    # logo, search, filters, wallet connect
    │   │   ├── MarketCard.tsx # market row (question, YES/NO bars, stats)
    │   │   ├── MarketsGrid.tsx # paginated market list
    │   │   ├── TradePanel.tsx # order placement (limit/market, YES/NO)
    │   │   ├── CopyTrading.tsx # top trader leaderboard
    │   │   ├── PositionsTable.tsx # portfolio positions
    │   │   └── AuthPanel.tsx # wallet auth panel
    │   ├── context/
    │   │   └── AuthContext.tsx # wallet + CLOB auth state
    │   ├── lib/
    │   │   ├── types.ts      # TypeScript interfaces
    │   │   ├── polymarket.ts # API helpers, categories, normalization
    │   │   └── auth.ts       # EIP-712 signing, credential derivation
    │   └── api/
    │       ├── polymarket/route.ts # proxy to Gamma/Data API
    │       └── clob/route.ts      # proxy to CLOB API (auth forwarding)
    ├── tailwind.config.ts
    ├── next.config.mjs
    └── package.json
```

## Search

Search operates across two domains — **markets** and **traders** — through a three-layer architecture: Next.js frontend, Rust proxy with caching, and upstream Polymarket APIs.

### Market Search

1. User types a query in the `TopBar` search input
2. Query updates global `FiltersContext` state and syncs to the URL as `?q=<query>`
3. `MarketsGrid` calls `searchMarkets()` which hits the Rust proxy at `/?endpoint=public-search&q=<query>`
4. The proxy routes `public-search` to `gamma-api.polymarket.com/public-search`
5. Gamma returns `{events: [{..., markets: [...]}]}` — the frontend flattens this into a market list
6. Results are normalized and cached client-side keyed by `search_<query>_<limit>`

### Trader Search

1. Same `TopBar` input, same `FiltersContext` — the `search` value applies to whichever page is active
2. On `/traders`, `CopyTrading` passes the search param to `fetchTradersPage()` for server-side filtering
3. `matchTraderSearch()` matches against both wallet **address** and **market titles** the trader has positions in
4. The Rust backend's `/active-traders` endpoint serves trader data from a two-phase pipeline: leaderboard fetch from the Data API, then enrichment with per-trader activity scraping

### Caching

Markets/search hit the Polymarket API live (short TTL). Trader data and historical data are **persisted to disk** on first fetch and never re-requested — survives server restarts, no risk of rate limits.

| Layer | What | TTL | Storage |
|-------|------|-----|---------|
| **Frontend** (localStorage) | Market search, price history, market trades, positions, wallet trades | Hourly (same-hour = no refetch) | Browser |
| **Rust proxy** (in-memory) | Markets, events, search | 5 min | Memory only |
| **Rust proxy** (memory + disk) | Trader activity, positions, price history, market trades, leaderboard | 24h memory / **indefinite on disk** | `/tmp/polymarket-proxy-cache/` |
| **Pipeline** (memory + disk) | Aggregated active-trader data | 1 hour, warmed in background | `/tmp/polymarket-active-traders-cache/` |

**Persistent endpoints** (disk-cached on first fetch): `activity`, `positions`, `users/`, `trades`, `v1/` (leaderboard), `holders`, `value`, `prices-history`, `market-trades`

**Ephemeral endpoints** (memory-only, fine to re-hit API): `markets`, `events`, `public-search`, `book`, `midpoint`, `price`

The proxy serves stale cache on upstream errors and sets `x-cache: HIT|MISS|STALE` headers.

### URL Sync

All filter state is serialized to URL params via `FiltersContext` so search results are shareable:

```
/traders?q=election&days=7&cat=politics&minvol=100
```

Parameter mapping: `search→q`, `daysAgo→days`, `category→cat`, `minTrades→mint`, `minPerDay→minpd`, `minVolume→minvol`, `minBuyVolume→minbuy`, `minSellVolume→minsell`, `minPnl→minpnl`

## Environment Variables

| Variable | Description |
|----------|-------------|
| NEXT_PUBLIC_API_URL | Backend API URL (default http://localhost:50091) |
| NEXT_PUBLIC_BASE_PATH | Base path for app routing (default /polymarket) |
| POLYMARKET_PRIVATE_KEY | Wallet private key for trading (Python only) |

## Mod Protocol

- **Module**: `polymarket`
- **Ports**: API 50091, App 3091
- **Serve**: `m polymarket/serve` (FastAPI + Next.js)
- **Kill**: `m polymarket/kill`
- **Config**: `config.json` with endpoints, fns, ports
- **Logs**: `/tmp/polymarket/api.log`, `/tmp/polymarket/app.log`
