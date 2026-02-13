# Codex 📊

> *"Simplicity is the ultimate sophistication."* - Leonardo da Vinci

## Overview

Codex is an elegant Uniswap GraphQL scraper that provides seamless access to DeFi data via The Graph Protocol. Built for developers who demand clean APIs, production-ready code, and comprehensive insights into Uniswap V2/V3 liquidity pools, tokens, and trading activity.

## ✨ Features

- **📊 Comprehensive Data Access**: Query pools, tokens, swaps, and historical data
- **🔄 Multi-Version Support**: Works with both Uniswap V2 and V3
- **⚡ Real-Time Insights**: Live price tracking, volume metrics, and liquidity data
- **🎯 Powerful Queries**: Search tokens, analyze pools, track recent swaps
- **🏛️ Clean Architecture**: Single cohesive class, elegant API design
- **🛡️ Production Ready**: Robust error handling, timeout protection
- **🐳 Docker Support**: Containerized deployment for consistency
- **📦 Zero Bloat**: Minimal dependencies, maximum performance

## 🚀 Quick Start

### Installation

```bash
# Navigate to codex directory
cd /Users/broski/mod/mod/_orbit/codex

# Install dependencies
pip install -r requirements.txt
```

### Basic Usage

```python
from codex.mod import Mod

# Initialize the scraper (defaults to Uniswap V3)
codex = Mod()

# Get top pools by TVL
top_pools = codex.get_top_pools(limit=5)

# Get comprehensive token data
uni_token = codex.get_token_data("0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984")

# Get current token price in USD
price = codex.get_token_price("0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984")
print(f"UNI Price: ${price:.2f}")

# Get pool data and statistics
pool = codex.get_pool_data("0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8")
stats = codex.get_pool_stats("0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8")

# Search for tokens
results = codex.search_tokens("WETH", limit=10)

# Get recent swaps
swaps = codex.get_recent_swaps(limit=20)
```

### Quick Convenience Function

```python
from codex.mod import scrape_uniswap

# Get top pools
data = scrape_uniswap("top_pools", limit=5)

# Get token data by address
data = scrape_uniswap("token:0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984")

# Get pool data by address
data = scrape_uniswap("pool:0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8")

# Search tokens by symbol
data = scrape_uniswap("USDC", limit=5)
```

## 📚 Documentation

For comprehensive documentation, advanced examples, and complete API reference, see **[TUTORIAL.md](TUTORIAL.md)**.

## 🏗️ Project Structure

```
codex/
├── codex/
│   └── mod.py           # Core Codex implementation (single class)
├── Dockerfile           # Docker configuration
├── docker-compose.yml   # Container orchestration
├── requirements.txt     # Python dependencies
├── TUTORIAL.md          # Comprehensive tutorial and examples
└── README.md            # Project overview (this file)
```

## 🐳 Docker Deployment

Run Codex in a containerized environment:

```bash
# Build and launch with Docker Compose
docker-compose up --build

# Run in detached mode
docker-compose up -d

# Stop containers
docker-compose down
```

The service will be available on port `50119`.

## 🎯 Core Methods

### Data Retrieval

- `get_token_data(address, limit)` - Comprehensive token information
- `get_pool_data(address, limit)` - Detailed pool data with swaps
- `get_top_pools(limit)` - Top pools by total value locked
- `get_token_price(address)` - Current USD price for any token
- `get_token_volume_24h(address)` - 24-hour trading volume

### Analytics

- `get_pool_stats(address)` - Statistical analysis of pool activity
- `search_tokens(search_term, limit)` - Find tokens by symbol/name
- `get_recent_swaps(pool_address, token_address, limit)` - Recent trading activity

### Utilities

- `forward(token_address, pool_address, limit)` - Smart routing entry point
- `format_output(data, pretty)` - Pretty-print JSON results

## 💡 Use Cases

- **📈 DeFi Analytics**: Track liquidity, volume, and trading patterns
- **💰 Price Monitoring**: Real-time token price tracking and alerts
- **🔍 Market Research**: Discover trending pools and tokens
- **🤖 Trading Bots**: Integrate live market data into automated strategies
- **📊 Dashboard Development**: Power DeFi dashboards with fresh data
- **🎓 Educational Projects**: Learn about DeFi data structures

## 🔧 Advanced Usage

### Using Uniswap V2

```python
# Initialize with V2
codex_v2 = Mod(version="v2")
pools = codex_v2.get_top_pools(limit=10)
```

### Custom Timeout

```python
# Increase timeout for slow connections
codex = Mod(timeout=60)
```

### Raw GraphQL Queries

```python
codex = Mod()

# Execute custom GraphQL queries
query = """
query($id: ID!) {
    token(id: $id) {
        symbol
        name
        totalValueLockedUSD
    }
}
"""

result = codex._query(query, {"id": "0x..."})
```

## 🌟 Philosophy

Codex is built on foundational principles:

- **Single Responsibility** → One class, one purpose: scrape Uniswap data
- **Simplicity First** → Clean API, no unnecessary complexity
- **Production Quality** → Battle-tested, reliable, efficient
- **Developer Experience** → Intuitive methods, comprehensive docs
- **Minimal Dependencies** → Just `requests`, nothing more

## 🎯 Performance

- ⚡ **Fast**: Direct GraphQL queries to The Graph
- 🪶 **Lightweight**: Single file, minimal overhead
- 🔄 **Reliable**: Robust error handling and validation
- 🛡️ **Safe**: Timeout protection, graceful failures

## 📝 API Reference

See **[TUTORIAL.md](TUTORIAL.md)** for complete API documentation with examples.

## 🐛 Troubleshooting

### Connection Issues

If queries fail, ensure The Graph endpoints are accessible:
- Check your internet connection
- Verify firewall settings
- Try increasing timeout: `Mod(timeout=60)`

### Invalid Addresses

Token/pool addresses must be valid Ethereum addresses:
- Use checksummed or lowercase format
- Include `0x` prefix
- Verify address on Etherscan

## 🔗 Resources

- [The Graph Documentation](https://thegraph.com/docs/)
- [Uniswap V3 Subgraph](https://thegraph.com/explorer/subgraph/uniswap/uniswap-v3)
- [Uniswap V2 Subgraph](https://thegraph.com/explorer/subgraph/uniswap/uniswap-v2)

---

**🚀 Ready to explore DeFi data?**

👉 **Start with the [TUTORIAL.md](TUTORIAL.md) for hands-on examples!**

*Crafted with precision, purpose, and passion.* ⚡

---

<div align="center">
  <sub>Built by developers, for developers. Made with ❤️ and ☕</sub>
</div>
