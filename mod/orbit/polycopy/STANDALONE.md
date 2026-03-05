# Polycopy - Standalone Architecture

## Summary

The `polycopy` module is now **self-contained** and does not depend on the `polymarket` module for core functionality.

## What Changed

### Before
- Required `polymarket` module to be loaded for all operations
- Used `m.mod('polymarket')()` throughout the codebase
- Could not run monitoring or analysis without polymarket installed

### After
- **Self-contained API client** (`polycopy.api.PolymarketAPI`) for data fetching
- **Optional polymarket dependency** only required for trading execution
- **Full monitoring and analysis** works without polymarket module

## Architecture

```
polycopy/
├── api.py              # NEW: Self-contained API clients
│   ├── PolymarketAPI          # Data fetching (no dependencies)
│   └── PolymarketTrading      # Trading wrapper (requires polymarket)
├── mod.py              # UPDATED: Uses PolymarketAPI by default
├── traders.py          # No changes (already used direct HTTP)
├── monitor.py          # No changes (uses client interface)
├── executor.py         # UPDATED: Uses PolymarketTrading for live trades
├── copier.py           # No changes
└── config.py           # No changes
```

## Dependency Matrix

| Feature | Requires polymarket? | Implementation |
|---------|---------------------|----------------|
| Trader search | ❌ No | Direct HTTP via `TraderSearch` |
| Leaderboards | ❌ No | Direct HTTP via `TraderSearch` |
| Position monitoring | ❌ No | `PolymarketAPI.get_user_positions()` |
| Trade history | ❌ No | `PolymarketAPI.get_user_trades()` |
| Analytics (APR, ROI, etc.) | ❌ No | Local calculations |
| Dry-run mode | ❌ No | Simulation in `TradeExecutor` |
| Live trading | ✅ Yes | `PolymarketTrading` → `m.mod('polymarket')` |

## API Clients

### PolymarketAPI (Self-Contained)
```python
from polycopy.api import PolymarketAPI

client = PolymarketAPI()
positions = client.get_user_positions('0xABC...')
trades = client.get_user_trades('0xABC...', limit=10)
```

**No dependencies** - uses only `requests` library for direct HTTP calls.

### PolymarketTrading (Requires polymarket module)
```python
from polycopy.api import PolymarketTrading

# This will raise ImportError if polymarket module not available
trading = PolymarketTrading(private_key='your_key')
result = trading.place_order(token_id='123', side='BUY', size=100, price=0.5)
```

**Requires** `polymarket` module for order execution.

## Usage Examples

### Without polymarket module
```python
import mod as m

# Initialize polycopy
pc = m.mod('polycopy')()

# ✅ All these work without polymarket:
traders = pc.top_apr(window='30d', limit=20)
profile = pc.trader_profile('0xABC...')
status = pc.get_status(['0xABC...'])
comparison = pc.compare_traders(['0xABC...', '0xDEF...'])

# ✅ Dry-run mode works without polymarket:
pc.forward('0xABC...', dry_run=True, multiplier=0.5)
```

### With polymarket module
```python
import mod as m

pc = m.mod('polycopy')()

# ✅ Live trading requires polymarket:
pc.forward(
    '0xABC...',
    dry_run=False,  # Live trading
    private_key='your_key',
    multiplier=1.0
)
```

## Error Handling

### Missing polymarket module
When live trading is attempted without the polymarket module:

```python
# executor.py will print:
Warning: Trading requires polymarket module: [error details]

# Trade execution will return:
{'success': False, 'error': 'No trading client configured'}
```

### Graceful Degradation
The module will:
1. ✅ Work normally for all monitoring/analysis features
2. ⚠️ Print warnings when trading is attempted without polymarket
3. ❌ Return error results instead of crashing

## Testing

Run the standalone test suite:
```bash
python3 test_standalone.py
```

This verifies:
- Imports work without polymarket
- API client initializes correctly
- Monitoring features function independently
- Trading gracefully requires polymarket when needed

## Migration Guide

If you have existing code using polycopy:

### Before (still works)
```python
polycopy = m.mod('polycopy')()
polycopy.forward('0xABC...')  # Uses PolymarketAPI internally now
```

### After (no changes needed)
The same code works but now:
- Uses `PolymarketAPI` for monitoring
- Only loads `polymarket` module when trading is enabled
- Fails gracefully if polymarket unavailable

## Benefits

1. **Faster startup** - No polymarket module loading unless trading
2. **Fewer dependencies** - Analysis/monitoring works standalone
3. **Better error messages** - Clear when polymarket is required
4. **Easier testing** - Can test monitoring without trading setup
5. **More modular** - Clear separation of data vs trading concerns

## Implementation Details

### Lazy Loading Pattern
```python
class TradeExecutor:
    def __init__(self, private_key, config):
        self._client = None  # Not loaded yet
        self._private_key = private_key

    @property
    def client(self):
        if self._client is None and self._private_key:
            # Only load polymarket when first needed
            self._client = PolymarketTrading(private_key=self._private_key)
        return self._client
```

### Direct API Pattern
```python
class PolymarketAPI:
    def get_user_positions(self, address):
        url = f"{self.base_url}/users/{address}/positions"
        response = self.session.get(url, timeout=10)
        # Direct HTTP - no polymarket module needed
        return response.json()
```

## Future Enhancements

Potential improvements:
- [ ] Implement order placement via direct API (remove polymarket dependency entirely)
- [ ] Add WebSocket support for real-time monitoring
- [ ] Cache trader data to reduce API calls
- [ ] Add retry logic with exponential backoff

## Questions

**Q: Do I need to change my existing code?**
A: No, existing code continues to work unchanged.

**Q: Can I still use polymarket module if I want?**
A: Yes, for live trading it's still required. For monitoring, it's now optional.

**Q: Will this break if polymarket module is installed?**
A: No, it works with or without polymarket module installed.

**Q: How do I enable live trading?**
A: Set `dry_run=False` and provide `private_key`. The polymarket module must be available.
