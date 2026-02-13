# Codex Tutorial 🎓

## What is Codex?

Codex is an elegant, production-ready Uniswap GraphQL scraper that provides seamless access to DeFi data via The Graph Protocol. It's designed as a single, cohesive class that offers comprehensive access to Uniswap V2/V3 pools, tokens, swaps, and analytics.

## 📚 Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Core Concepts](#core-concepts)
4. [API Reference](#api-reference)
5. [Advanced Usage](#advanced-usage)
6. [Real-World Examples](#real-world-examples)
7. [Best Practices](#best-practices)

## Installation

```bash
# Navigate to codex directory
cd /root/mod/mod/_orbit/codex

# Install dependencies (just requests!)
pip install -r requirements.txt
```

That's it! Codex has minimal dependencies by design.

## Quick Start

### Basic Initialization

```python
from codex.mod import Mod

# Initialize with Uniswap V3 (default)
codex = Mod()

# Or use Uniswap V2
codex_v2 = Mod(version="v2")

# Custom timeout (default: 30 seconds)
codex = Mod(timeout=60)
```

### Your First Query

```python
# Get the top 5 pools by total value locked
top_pools = codex.get_top_pools(limit=5)

for pool in top_pools:
    token0 = pool['token0']['symbol']
    token1 = pool['token1']['symbol']
    tvl = float(pool['totalValueLockedUSD'])
    print(f"{token0}/{token1}: ${tvl:,.2f}")
```

Output:
```
WETH/USDC: $156,789,432.12
WETH/USDT: $98,543,210.45
WBTC/WETH: $67,234,567.89
...
```

## Core Concepts

### The `forward()` Method

The `forward()` method is your smart entry point that routes to the appropriate functionality:

```python
codex = Mod()

# Get token data by address
token = codex.forward(token_address="0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984")

# Get pool data by address
pool = codex.forward(pool_address="0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8")

# Get top pools (when no args provided)
pools = codex.forward(limit=10)
```

### Understanding Addresses

All Ethereum addresses are automatically normalized to lowercase:

```python
# These all work the same
codex.get_token_data("0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984")  # Checksummed
codex.get_token_data("0x1f9840a85d5af5bf1d1762f925bdaddc4201f984")  # Lowercase
```

## API Reference

### Data Retrieval Methods

#### `get_token_data(address, limit=10)`

Get comprehensive token information including price, volume, and liquidity.

```python
codex = Mod()
uni_token = codex.get_token_data("0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984")

print(f"Symbol: {uni_token['symbol']}")
print(f"Name: {uni_token['name']}")
print(f"Total Supply: {uni_token['totalSupply']}")
print(f"Volume USD: ${float(uni_token['volumeUSD']):,.2f}")
print(f"TVL USD: ${float(uni_token['totalValueLockedUSD']):,.2f}")
print(f"Transaction Count: {uni_token['txCount']}")
```

**Returns:** Dictionary with token data

**Fields:**
- `id`, `symbol`, `name`, `decimals`
- `totalSupply`, `volume`, `volumeUSD`
- `txCount`, `totalValueLocked`, `totalValueLockedUSD`
- `derivedETH`, `feesUSD`
- `whitelistPools` - Top pools for this token

#### `get_pool_data(address, limit=10)`

Get comprehensive pool data including tokens, liquidity, and recent swaps.

```python
codex = Mod()
pool = codex.get_pool_data("0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8")

print(f"Pair: {pool['token0']['symbol']}/{pool['token1']['symbol']}")
print(f"TVL: ${float(pool['totalValueLockedUSD']):,.2f}")
print(f"Volume: ${float(pool['volumeUSD']):,.2f}")
print(f"Fee Tier: {pool['feeTier']}")
print(f"Token0 Price: {pool['token0Price']}")
print(f"Token1 Price: {pool['token1Price']}")

# Access recent swaps
for swap in pool['swaps']:
    print(f"Swap: ${float(swap['amountUSD']):,.2f}")
```

**Returns:** Dictionary with pool data

**Fields:**
- Pool info: `id`, `feeTier`, `liquidity`, `sqrtPrice`, `tick`
- Token details: `token0`, `token1` (with symbol, name, decimals)
- Prices: `token0Price`, `token1Price`
- Volumes: `volumeToken0`, `volumeToken1`, `volumeUSD`
- TVL: `totalValueLockedToken0`, `totalValueLockedToken1`, `totalValueLockedUSD`
- Activity: `txCount`, `swaps` (recent swap history)

#### `get_top_pools(limit=10)`

Get top pools ranked by total value locked.

```python
codex = Mod()
top_pools = codex.get_top_pools(limit=5)

for i, pool in enumerate(top_pools, 1):
    pair = f"{pool['token0']['symbol']}/{pool['token1']['symbol']}"
    tvl = float(pool['totalValueLockedUSD'])
    volume = float(pool['volumeUSD'])
    print(f"{i}. {pair}: TVL ${tvl:,.0f} | Vol ${volume:,.0f}")
```

**Returns:** List of pool dictionaries

#### `get_token_price(address)`

Get current token price in USD.

```python
codex = Mod()

# UNI token
uni_price = codex.get_token_price("0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984")
print(f"UNI Price: ${uni_price:.2f}")

# WETH token
weth_price = codex.get_token_price("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2")
print(f"WETH Price: ${weth_price:.2f}")
```

**Returns:** Float (USD price) or None if unavailable

#### `get_token_volume_24h(address)`

Get 24-hour trading volume for a token.

```python
codex = Mod()
volume = codex.get_token_volume_24h("0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984")
print(f"24h Volume: ${volume:,.2f}")
```

**Returns:** Float (USD volume) or None if unavailable

#### `get_recent_swaps(pool_address=None, token_address=None, limit=10)`

Get recent swap transactions with flexible filtering.

```python
codex = Mod()

# All recent swaps
all_swaps = codex.get_recent_swaps(limit=20)

# Swaps for a specific pool
pool_swaps = codex.get_recent_swaps(
    pool_address="0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
    limit=10
)

# Swaps involving a specific token
token_swaps = codex.get_recent_swaps(
    token_address="0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    limit=10
)

# Display swap data
for swap in all_swaps[:5]:
    pool = swap['pool']
    pair = f"{pool['token0']['symbol']}/{pool['token1']['symbol']}"
    amount = float(swap['amountUSD'])
    timestamp = swap['timestamp']
    print(f"{pair}: ${amount:,.2f} at {timestamp}")
```

**Returns:** List of swap dictionaries

**Fields:**
- `id`, `timestamp`
- `pool` (with token0/token1 symbols)
- `amount0`, `amount1`, `amountUSD`
- `sender`, `recipient`

#### `search_tokens(search_term, limit=10)`

Search for tokens by symbol or name.

```python
codex = Mod()

# Search by symbol
usdc_tokens = codex.search_tokens("USDC", limit=5)

# Search by name
wrapped_tokens = codex.search_tokens("wrapped", limit=10)

for token in usdc_tokens:
    print(f"{token['symbol']} ({token['name']})")
    print(f"  Address: {token['id']}")
    print(f"  TVL: ${float(token['totalValueLockedUSD']):,.2f}")
```

**Returns:** List of token dictionaries

### Analytics Methods

#### `get_pool_stats(address)`

Get comprehensive statistics and analytics for a pool.

```python
codex = Mod()
stats = codex.get_pool_stats("0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8")

print(f"Pool: {stats['pair']}")
print(f"TVL: ${stats['tvl_usd']:,.2f}")
print(f"Volume: ${stats['volume_usd']:,.2f}")
print(f"Transactions: {stats['tx_count']:,}")
print(f"Recent Swap Volume: ${stats['recent_swap_volume']:,.2f}")
print(f"Recent Swap Count: {stats['recent_swap_count']}")
print(f"Avg Swap Size: ${stats['avg_swap_size']:,.2f}")
```

**Returns:** Dictionary with calculated statistics

**Fields:**
- `address`, `pair`
- `tvl_usd`, `volume_usd`, `tx_count`
- `token0_price`, `token1_price`, `liquidity`
- `recent_swap_volume`, `recent_swap_count`, `avg_swap_size`

### Utility Methods

#### `format_output(data, pretty=True)`

Format data for display with optional pretty printing.

```python
codex = Mod()
pools = codex.get_top_pools(limit=3)

# Pretty print (default)
print(codex.format_output(pools, pretty=True))

# Compact JSON
print(codex.format_output(pools, pretty=False))
```

**Returns:** JSON string

## Advanced Usage

### Monitoring Token Prices

```python
import time
from codex.mod import Mod

def monitor_price(token_address, interval=60):
    """Monitor token price at regular intervals."""
    codex = Mod()

    while True:
        price = codex.get_token_price(token_address)
        timestamp = time.strftime('%Y-%m-%d %H:%M:%S')

        if price:
            print(f"[{timestamp}] Price: ${price:.4f}")
        else:
            print(f"[{timestamp}] Price unavailable")

        time.sleep(interval)

# Monitor UNI token every minute
monitor_price("0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", interval=60)
```

### Building a Pool Scanner

```python
from codex.mod import Mod

def scan_top_pools_for_opportunities(min_tvl=1_000_000):
    """Scan top pools for trading opportunities."""
    codex = Mod()
    pools = codex.get_top_pools(limit=50)

    opportunities = []

    for pool in pools:
        tvl = float(pool['totalValueLockedUSD'])
        volume = float(pool['volumeUSD'])

        if tvl < min_tvl:
            continue

        # Calculate volume-to-TVL ratio (higher = more active)
        ratio = volume / tvl if tvl > 0 else 0

        if ratio > 0.1:  # More than 10% daily volume
            pair = f"{pool['token0']['symbol']}/{pool['token1']['symbol']}"
            opportunities.append({
                'pair': pair,
                'tvl': tvl,
                'volume': volume,
                'ratio': ratio,
                'address': pool['id']
            })

    # Sort by ratio
    opportunities.sort(key=lambda x: x['ratio'], reverse=True)

    print("High-Activity Pools:")
    for opp in opportunities[:10]:
        print(f"{opp['pair']:20} | TVL: ${opp['tvl']:>12,.0f} | "
              f"Vol: ${opp['volume']:>12,.0f} | Ratio: {opp['ratio']:.2%}")

scan_top_pools_for_opportunities()
```

### Analyzing Token Liquidity Distribution

```python
from codex.mod import Mod

def analyze_token_liquidity(token_address):
    """Analyze how a token's liquidity is distributed across pools."""
    codex = Mod()
    token_data = codex.get_token_data(token_address, limit=20)

    print(f"\nToken: {token_data['symbol']} ({token_data['name']})")
    print(f"Total TVL: ${float(token_data['totalValueLockedUSD']):,.2f}\n")

    pools = token_data.get('whitelistPools', [])
    total_pool_tvl = sum(float(p['totalValueLockedUSD']) for p in pools)

    print("Liquidity Distribution:")
    for i, pool in enumerate(pools[:10], 1):
        pair = f"{pool['token0']['symbol']}/{pool['token1']['symbol']}"
        tvl = float(pool['totalValueLockedUSD'])
        pct = (tvl / total_pool_tvl * 100) if total_pool_tvl > 0 else 0

        print(f"{i:2}. {pair:15} ${tvl:>12,.0f} ({pct:>5.1f}%)")

# Analyze UNI token
analyze_token_liquidity("0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984")
```

### Custom GraphQL Queries

For advanced users, you can execute custom GraphQL queries:

```python
from codex.mod import Mod

codex = Mod()

# Custom query for specific data
query = """
query($minTVL: BigDecimal!) {
    pools(first: 10,
          where: {totalValueLockedUSD_gt: $minTVL},
          orderBy: volumeUSD,
          orderDirection: desc) {
        id
        token0 {
            symbol
        }
        token1 {
            symbol
        }
        totalValueLockedUSD
        volumeUSD
    }
}
"""

result = codex._query(query, {"minTVL": "10000000"})
pools = result.get('pools', [])

for pool in pools:
    pair = f"{pool['token0']['symbol']}/{pool['token1']['symbol']}"
    print(f"{pair}: ${float(pool['volumeUSD']):,.0f}")
```

## Real-World Examples

### Example 1: Price Alert System

```python
from codex.mod import Mod
import time

def price_alert(token_address, target_price, check_interval=60):
    """Alert when token reaches target price."""
    codex = Mod()

    print(f"Monitoring for price >= ${target_price:.4f}")

    while True:
        current_price = codex.get_token_price(token_address)

        if current_price and current_price >= target_price:
            print(f"🚨 ALERT! Price reached: ${current_price:.4f}")
            break
        elif current_price:
            print(f"Current: ${current_price:.4f} (target: ${target_price:.4f})")

        time.sleep(check_interval)

# Alert when UNI reaches $10
price_alert("0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", target_price=10.0)
```

### Example 2: Liquidity Pool Tracker

```python
from codex.mod import Mod

def track_pool_changes(pool_address, interval=300):
    """Track changes in pool statistics over time."""
    codex = Mod()
    previous_stats = None

    while True:
        current_stats = codex.get_pool_stats(pool_address)

        if previous_stats:
            tvl_change = current_stats['tvl_usd'] - previous_stats['tvl_usd']
            vol_change = current_stats['volume_usd'] - previous_stats['volume_usd']

            print(f"\n=== Pool Update: {current_stats['pair']} ===")
            print(f"TVL: ${current_stats['tvl_usd']:,.2f} "
                  f"({'+'if tvl_change >= 0 else ''}{tvl_change:,.2f})")
            print(f"Volume: ${current_stats['volume_usd']:,.2f} "
                  f"({'+'if vol_change >= 0 else ''}{vol_change:,.2f})")

        previous_stats = current_stats
        time.sleep(interval)
```

### Example 3: Multi-Version Comparison

```python
from codex.mod import Mod

def compare_v2_v3_liquidity(token_symbol):
    """Compare token liquidity between V2 and V3."""
    v2 = Mod(version="v2")
    v3 = Mod(version="v3")

    # Search for token in both versions
    v2_tokens = v2.search_tokens(token_symbol, limit=1)
    v3_tokens = v3.search_tokens(token_symbol, limit=1)

    if v2_tokens and v3_tokens:
        v2_tvl = float(v2_tokens[0]['totalValueLockedUSD'])
        v3_tvl = float(v3_tokens[0]['totalValueLockedUSD'])
        total = v2_tvl + v3_tvl

        print(f"\nLiquidity Comparison for {token_symbol}:")
        print(f"V2: ${v2_tvl:>12,.2f} ({v2_tvl/total*100:.1f}%)")
        print(f"V3: ${v3_tvl:>12,.2f} ({v3_tvl/total*100:.1f}%)")
        print(f"Total: ${total:>12,.2f}")

compare_v2_v3_liquidity("UNI")
```

## Best Practices

### 1. Error Handling

Always wrap queries in try-except blocks:

```python
from codex.mod import Mod

codex = Mod()

try:
    token_data = codex.get_token_data("0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984")
    print(f"Symbol: {token_data['symbol']}")
except RuntimeError as e:
    print(f"Query failed: {e}")
```

### 2. Timeout Configuration

For unreliable connections, increase timeout:

```python
# Default: 30 seconds
codex = Mod(timeout=30)

# For slow connections
codex = Mod(timeout=60)
```

### 3. Rate Limiting

The Graph has rate limits. Add delays between requests:

```python
import time
from codex.mod import Mod

codex = Mod()
tokens = ["0x...", "0x...", "0x..."]

for token_address in tokens:
    data = codex.get_token_data(token_address)
    # Process data
    time.sleep(1)  # 1 second delay between requests
```

### 4. Data Validation

Always validate returned data:

```python
codex = Mod()
token_data = codex.get_token_data("0x...")

if token_data and 'symbol' in token_data:
    print(f"Token: {token_data['symbol']}")
else:
    print("Invalid or missing token data")
```

### 5. Caching Results

For repeated queries, cache results:

```python
from codex.mod import Mod
from functools import lru_cache
import time

class CachedCodex:
    def __init__(self):
        self.codex = Mod()
        self._cache = {}
        self._cache_timeout = 60  # 60 seconds

    def get_token_price(self, address):
        now = time.time()
        cache_key = f"price_{address}"

        if cache_key in self._cache:
            cached_time, cached_value = self._cache[cache_key]
            if now - cached_time < self._cache_timeout:
                return cached_value

        price = self.codex.get_token_price(address)
        self._cache[cache_key] = (now, price)
        return price

cached = CachedCodex()
price = cached.get_token_price("0x...")  # Cached for 60s
```

## 🐛 Troubleshooting

### Query Returns Empty Results

- Verify the address is correct (check on Etherscan)
- Ensure the token/pool exists on the Uniswap version you're querying
- Try with a different limit parameter

### Connection Timeouts

- Increase timeout: `Mod(timeout=60)`
- Check your internet connection
- Verify The Graph endpoints are accessible

### GraphQL Errors

- Check The Graph status: https://thegraph.com/explorer/
- Ensure query syntax is correct
- Try a simpler query first

## 🔗 Next Steps

- Explore [The Graph documentation](https://thegraph.com/docs/)
- Check [Uniswap V3 Subgraph schema](https://thegraph.com/explorer/subgraph/uniswap/uniswap-v3)
- Build custom analytics dashboards
- Integrate with trading bots
- Create price alert systems

---

*Ready to build something amazing? Start experimenting with Codex!* ⚡
