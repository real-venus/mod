# Polycopy - Polymarket Copy Trading SDK

Monitor and automatically mirror trades from successful Polymarket traders. Scale from monitoring one address to N addresses in parallel with full risk management and dry-run testing.

## Features

- 🔍 **Trader Discovery**: Search top traders by APR, ROI, volume, and trade count - no sign-in required
- 📊 **Performance Analytics**: Calculate APR, ROI, Sharpe ratio, and profit metrics
- **Monitor Multiple Addresses**: Track any number of Polymarket wallets in parallel
- **Automated Copy Trading**: Automatically replicate positions as they're opened/closed
- **Risk Management**: Configurable position limits, trade sizes, and daily volume caps
- **Dry Run Mode**: Test strategies without executing real trades
- **Proportional Sizing**: Scale positions up/down with configurable multipliers
- **Server Mode**: Run continuously as a background service via PM2
- **Self-Contained**: No dependency on polymarket module for monitoring and analysis

## Dependencies

### Core Features (Monitoring & Analysis)
**No polymarket module required!** All monitoring, trader discovery, and analysis features use direct API calls:
- ✅ Trader search and leaderboards
- ✅ Position monitoring
- ✅ Performance analytics
- ✅ Dry-run mode

### Trading Features (Order Execution)
Requires the `polymarket` module for live trade execution:
- Place orders
- Execute copy trades
- Live trading

Install the polymarket module only if you need actual trading functionality.

## Quick Start

### Interactive Trader Browser (NEW! ⭐)

The easiest way to find and copy traders - interactive menu with search, filtering, and one-click selection:

```python
import mod as m

polycopy = m.mod('polycopy')()

# Launch interactive trader browser
polycopy.browse()
```

This opens an interactive menu where you can:
- 🔍 Browse top APR, volume, or profit traders
- 🎯 Search by custom criteria (APR, volume, trades)
- 📊 View detailed trader profiles
- ✅ Select multiple traders to copy
- 🚀 Auto-start copy trading

**Just browse without auto-starting:**
```python
polycopy.browse(auto_start=False)  # Select traders, save to config, but don't start yet
```

**Customize filters:**
```python
polycopy.browse(
    window='7d',
    min_apr=100,
    min_volume=50000,
    limit=30
)
```

### Programmatic Trader Search

```python
import mod as m

polycopy = m.mod('polycopy')()

# Find top 20 traders by APR in last 30 days
top_traders = polycopy.top_apr(window='30d', limit=20, min_volume=10000)

# Search with custom filters
smart_traders = polycopy.find_traders(
    window='7d',
    min_apr=100,        # >100% annualized return
    min_volume=50000,   # >$50k volume
    min_trades=10,      # At least 10 trades
    sort_by='apr'
)

# Get detailed trader profile
profile = polycopy.trader_profile('0xc257ea7e3a81ca8e16df8935d44d513959fa358e')
print(f"APR: {profile['apr']}%")
print(f"Positions: {profile['position_count']}")

# Compare multiple traders
comparison = polycopy.compare_traders([
    '0xc257ea7e3a81ca8e16df8935d44d513959fa358e',
    '0xb45a797faa52b0fd8adc56d30382022b7b12192c'
])
```

### Single Address (Dry Run)

```python
import mod as m

# Monitor and copy one address (dry run by default)
polycopy = m.mod('polycopy')()
polycopy.forward(
    addresses='0xABC123...',
    dry_run=True,
    multiplier=0.5,
    poll_interval=30
)
```

### Multiple Addresses (Parallel)

```python
# Monitor 3 addresses in parallel with live trading
polycopy.forward(
    addresses=[
        '0xABC123...',
        '0xDEF456...',
        '0x789GHI...'
    ],
    mode='copy',
    dry_run=False,
    multiplier=1.0,
    max_trade_size=500
)
```

### Server Mode (Continuous)

```python
# Run as background server
m.serve('polycopy',
    addresses=['0xABC123...', '0xDEF456...'],
    mode='server',
    dry_run=False,
    private_key='your_private_key'  # or will use m.key()
)

# Check stats
stats = m.fn('polycopy/stats')()
print(stats)

# Stop server
m.kill('polycopy')
```

### Monitor Only (No Trading)

```python
# Just fetch current status without copy trading
status = polycopy.forward(
    addresses='0xABC123...',
    mode='monitor'
)
print(status)
```

## Configuration

### Parameters

```python
config = {
    'addresses': [],                    # Target addresses to monitor
    'private_key': None,                # Your trading wallet (or use m.key())
    'multiplier': 1.0,                  # Position size multiplier (0.1x - 10x)
    'max_position_size': 1000.0,        # Max USD per position
    'max_trade_size': 500.0,            # Max USD per trade
    'min_trade_size': 1.0,              # Minimum trade size
    'slippage_tolerance': 1.0,          # Price slippage % tolerance
    'dry_run': True,                    # Safe default - simulates trades
    'poll_interval': 30,                # Seconds between API checks
    'risk_limits': {
        'max_daily_trades': 50,
        'max_daily_volume': 5000.0,
        'max_concurrent_positions': 20
    }
}

# Save config
polycopy.config_update(**config)
```

### Persistent Configuration

Configuration is automatically saved to `~/.mod/polycopy/config` and persists across sessions.

## Examples

### Conservative Copy Trading

```python
# Small positions, lots of safety checks
polycopy = m.mod('polycopy')()
polycopy.forward(
    addresses='0xTargetWhale...',
    multiplier=0.1,              # 10% of their size
    max_trade_size=100,          # Max $100 per trade
    max_position_size=500,       # Max $500 total per position
    dry_run=False,
    poll_interval=60             # Check every minute
)
```

### Aggressive Copy Trading

```python
# Larger positions, faster polling
polycopy.forward(
    addresses=['0xTrader1...', '0xTrader2...'],
    multiplier=2.0,              # 2x their size
    max_trade_size=2000,
    max_position_size=5000,
    dry_run=False,
    poll_interval=15             # Check every 15 seconds
)
```

### Risk Management Example

```python
polycopy.forward(
    addresses='0xTarget...',
    multiplier=1.0,
    risk_limits={
        'max_daily_trades': 20,      # Max 20 trades per day
        'max_daily_volume': 2000.0,  # Max $2000 volume per day
        'max_concurrent_positions': 10  # Max 10 open positions
    }
)
```

## API Reference

### Trader Discovery Methods (NEW!)

**`browse(window='30d', min_volume=10000, min_apr=None, limit=20, auto_start=True)`** ⭐
- Interactive trader browser with menu-driven search and selection
- Browse by APR, volume, PnL, or custom criteria
- View detailed profiles, select multiple traders
- `auto_start=True`: Automatically starts copy trading after selection
- Returns: Status dict with selected traders and monitoring status

**`find_traders(window='30d', limit=20, **filters)`**
- Search traders with advanced filtering
- Filters: `min_volume`, `min_pnl`, `min_trades`, `min_apr`, `min_roi`
- `sort_by`: 'pnl', 'vol', 'roi', 'apr' (default)
- Returns: List of trader dicts with enhanced metrics

**`top_apr(window='30d', limit=20, min_volume=10000)`**
- Quick access to top APR traders
- Returns: List sorted by annualized return percentage

**`trader_profile(address, window='30d')`**
- Get comprehensive trader profile
- Returns: Dict with positions, trades, leaderboard stats, metrics

**`compare_traders(addresses, window='30d')`**
- Compare multiple traders side-by-side
- Returns: Comparison dict sorted by APR

**`search_smart_traders(min_apr=100, min_volume=50000, min_trades=10)`**
- Find high-quality traders with strong metrics
- Returns: Traders matching all criteria

### Copy Trading Methods

**`forward(addresses, mode='copy', **kwargs)`**
- Main entry point
- `mode`: 'copy' (execute trades), 'monitor' (watch only), 'server' (continuous)
- Returns: Status dict with positions/trades/stats

**`stats()`**
- Get aggregated copy trading statistics
- Returns: Total trades, volume, success rate, active positions

**`positions(address=None)`**
- Get current positions for monitored address(es)
- Returns: Position data dict

**`config_update(**updates)`**
- Update configuration
- Returns: Validated config

**`stop()`**
- Stop all monitoring
- Returns: Final stats

## Architecture

```
polycopy/
├── mod.py          # Main anchor class with trader discovery
├── traders.py      # TraderSearch - leaderboard & analytics (NEW!)
├── search.py       # CLI tool for trader search (NEW!)
├── monitor.py      # AccountMonitor - polling & change detection
├── executor.py     # TradeExecutor - order execution + risk mgmt
├── copier.py       # CopyTradingMonitor - orchestration
└── config.py       # Configuration validation
```

### Data Flow

1. **AccountMonitor** polls Polymarket API every N seconds
2. **Change Detection** compares current vs previous positions
3. **CopyTradingMonitor** receives change events
4. **TradeExecutor** validates risk limits and executes trades
5. **Results** logged to `~/.mod/polycopy/trades/`

## Storage

Data stored in `~/.mod/polycopy/`:
- `config` - Persistent configuration
- `positions/{address}` - Tracked positions per address
- `trades/{timestamp}_{id}` - Trade execution history
- `stats` - Aggregated statistics
- `health` - Server health checks (server mode)

## Safety Features

1. **Dry Run Default**: `dry_run: True` prevents accidental live trading
2. **Position Limits**: Enforced before every trade execution
3. **Risk Manager**: Daily trade/volume limits with automatic resets
4. **State Persistence**: All trades logged for audit trail
5. **Error Handling**: Continues on individual failures, logs errors
6. **Rate Limiting**: 30-second default polling is API-friendly

## Tips

- **Start with dry_run=True** to test your strategy
- **Use small multipliers** (0.1-0.5) when starting live trading
- **Monitor stats regularly** with `polycopy.stats()`
- **Set conservative risk_limits** for first live runs
- **Check ~/.mod/polycopy/trades/** to audit trade history

## Troubleshooting

**"No trading client configured"**
- Set `private_key` parameter or ensure `m.key()` is configured

**"Daily trade limit reached"**
- Adjust `risk_limits.max_daily_trades` or wait for daily reset

**API errors**
- Check Polymarket API status
- Increase `poll_interval` to reduce rate limiting

**Slow performance with many addresses**
- Use server mode for optimal parallel execution
- Monitor system resources (threads = N addresses)

## Examples in the Wild

```python
# Example 1: Find top traders and copy the best one
pc = m.mod('polycopy')()
top = pc.top_apr(window='30d', limit=10, min_volume=50000)
best_trader = top[0]['proxyWallet']
pc.forward(best_trader, multiplier=0.5, dry_run=True)

# Example 2: Diversified copying across top 5 APR traders
top_5 = pc.search_smart_traders(min_apr=150, min_trades=10, limit=5)
addresses = [t['proxyWallet'] for t in top_5]
pc.forward(addresses, multiplier=0.2, dry_run=False)

# Example 3: Run as 24/7 server with elite traders
elite = pc.find_traders(min_apr=200, min_volume=100000, min_trades=20)
m.serve('polycopy', addresses=[t['proxyWallet'] for t in elite[:3]], mode='server')
```

## CLI Usage

Search for traders from the command line:

```bash
# Top 20 traders by APR
python polycopy/search.py --window 30d --limit 20

# Filter by criteria
python polycopy/search.py --min-apr 50 --min-volume 100000 --min-trades 10

# Sort by volume
python polycopy/search.py --sort vol --limit 10

# Get trader profile
python polycopy/search.py --profile 0xc257ea7e3a81ca8e16df8935d44d513959fa358e

# Compare traders
python polycopy/search.py --compare 0xc257ea... 0xb45a79...

# Output as JSON
python polycopy/search.py --min-apr 100 --json
```

## Trader Search Features

### Available Metrics

Each trader includes:
- **APR**: Annualized percentage return
- **ROI**: Actual return for the time window
- **Volume**: Total trading volume
- **PnL**: Profit and loss
- **Sharpe**: Risk-adjusted return estimate
- **Trade Count**: Number of trades (when fetched)

### Time Windows

- `1d`: Last 24 hours
- `7d`: Last 7 days
- `30d`: Last 30 days (default)
- `all`: All-time (~1 year for APR calc)

### No Authentication Required

All trader search features use Polymarket's public Data API - **no sign-in or API keys needed**.

## License

Part of the Mod framework ecosystem.
