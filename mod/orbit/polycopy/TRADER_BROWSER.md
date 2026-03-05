# 🔍 Interactive Trader Browser Guide

The polycopy module now includes an **interactive trader browser** - no more manually pasting addresses!

## Quick Start

```python
import mod as m

polycopy = m.mod('polycopy')()

# Launch the interactive browser
polycopy.browse()
```

## Interactive Menu

When you run `browse()`, you'll see:

```
================================================================================
🔍 Polymarket Trader Browser
================================================================================

Options:
  1. Browse top APR traders
  2. Browse top volume traders
  3. Browse top PnL traders
  4. Search by custom criteria
  5. Lookup trader by address
  6. Exit

Select option (1-6):
```

## Features

### 1️⃣ Browse by Top APR
- Shows traders ranked by annualized return percentage
- Default filters: min $10k volume, last 30 days
- Perfect for finding consistent high performers

### 2️⃣ Browse by Top Volume
- Shows most active traders by trading volume
- Great for finding established, active traders
- Higher volume = more reliable data

### 3️⃣ Browse by Top PnL
- Shows traders by absolute profit
- Find the biggest winners
- Good for following whale strategies

### 4️⃣ Custom Search
- Set your own criteria:
  - Minimum APR percentage
  - Minimum trading volume
  - Maximum results to show
- Perfect for finding niche opportunities

### 5️⃣ Direct Lookup
- Enter a specific trader address
- View their full profile
- Quick copy if it's a known good trader

## Trader List View

After browsing, you'll see a formatted leaderboard:

```
====================================================================================================
Rank   #     Username             Volume          PnL             ROI %      APR %
----------------------------------------------------------------------------------------------------
1      1     CryptoWhale         $250,000        $125,000        50.0%      182.5%     ⭐
2      2     SmartTrader         $180,000        $90,000         50.0%      182.5%     ⭐
3      3     MarketMaker         $500,000        $100,000        20.0%      73.0%
```

## Selection Options

Once you see the trader list, you can:

### Select Single Trader
```
Your selection: 1
```

### Select Multiple Traders
```
Your selection: 1,3,5
```

### Select Range
```
Your selection: 1-10
```

### Select All
```
Your selection: all
```

### View Detailed Profile
```
Your selection: v
Enter trader number for details: 1

================================================================================
📊 Trader Profile: 0xc257ea7e3a81ca8e16df8935d44d513959fa358e
================================================================================

💰 Performance Metrics:
  PnL:              $125,000.00
  Volume:           $250,000.00
  ROI:              50.00%
  APR:              182.50%
  Leaderboard Rank: 1

📈 Portfolio:
  Active Positions: 5
  Total Value:      $12,500.00
  Total Trades:     47

🎯 Recent Positions:
  1. Will Trump win 2024 election?... (Yes, $5,000)
  2. Bitcoin above $100k by EOY?... (Yes, $3,000)
  ...

✅ Copy this trader? (y/n):
```

## Auto-Start vs Manual

### Auto-Start (Default)
```python
polycopy.browse()  # Automatically starts copy trading after selection
```

### Manual Start
```python
# Just select traders, save to config, but don't start yet
result = polycopy.browse(auto_start=False)

# Later, manually start
polycopy.copy_trades(result['addresses'])
```

## Customization Examples

### High APR Hunters
```python
polycopy.browse(
    min_apr=150,        # Only >150% APR
    min_volume=100000,  # Min $100k volume for reliability
    window='7d',        # Recent week performance
    limit=10
)
```

### Conservative Selection
```python
polycopy.browse(
    min_apr=50,         # Moderate APR
    min_volume=500000,  # Very high volume = proven track record
    window='30d',       # Month-long track record
    limit=20
)
```

### Quick Wins
```python
polycopy.browse(
    window='1d',        # Today's top performers
    min_volume=10000,   # Active today
    limit=5,
    auto_start=True
)
```

## Workflow Example

```python
import mod as m

polycopy = m.mod('polycopy')()

# Step 1: Browse and select traders interactively
polycopy.browse(
    window='30d',
    min_apr=100,
    min_volume=50000,
    auto_start=False  # Don't start yet
)

# Step 2: Review your saved config
config = m.get('polycopy/config')
print(f"Selected traders: {config['addresses']}")

# Step 3: Customize settings
polycopy.config_update(
    dry_run=True,       # Safe mode for testing
    multiplier=0.5,     # 50% of their position sizes
    max_trade_size=100  # $100 max per trade
)

# Step 4: Start copy trading
polycopy.copy_trades(config['addresses'])

# Step 5: Monitor progress
stats = polycopy.stats()
print(stats)
```

## Tips

✅ **DO:**
- Start with `auto_start=False` to review selections first
- Use reasonable filters (`min_volume >= 10000` to filter noise)
- View detailed profiles (`v` command) before copying
- Test with `dry_run=True` first

❌ **DON'T:**
- Copy traders with very low volume (could be lucky one-offs)
- Select too many traders at once (start with 1-3)
- Skip viewing profiles of top performers
- Forget to set risk limits in config

## Integration with Other Features

### After selection, you can:

```python
# Get profiles of selected traders
addresses = m.get('polycopy/config')['addresses']
for addr in addresses:
    profile = polycopy.trader_profile(addr)
    print(f"{addr}: APR {profile['apr']}%")

# Compare your selected traders
polycopy.compare_traders(addresses)

# Start monitoring
polycopy.forward(addresses, mode='monitor')

# Start copy trading
polycopy.forward(addresses, mode='copy', dry_run=True)

# Run as server
m.serve('polycopy', addresses=addresses, mode='server')
```

## Keyboard Shortcuts

- `1-9`: Browse/search options
- `Enter number`: Select trader
- `1,2,3`: Multi-select
- `1-10`: Range select
- `all`: Select all
- `v`: View details
- `q`: Go back
- `6`: Exit browser

## Next Steps

After selecting traders:
1. Review their profiles: `polycopy.trader_profile(address)`
2. Compare performance: `polycopy.compare_traders(addresses)`
3. Start with dry run: `polycopy.forward(addresses, dry_run=True)`
4. Go live: `polycopy.forward(addresses, dry_run=False)`
5. Monitor stats: `polycopy.stats()`

---

**No more copy-pasting addresses! 🎉**
