# Strats

Polymarket strategies as Python classes — like ERC-20 standardizes tokens, the `Strat` interface in `base.py` standardizes copy-trading logic so the live engine and backtest engine can drive any strategy through the same methods.

## The canonical interface

```python
class Strat(ABC):
    def setup(self) -> None
    def sync() -> SyncResult                    # read-only, idempotent
    def signal(sync) -> list[Order]             # pure: decides what to trade
    def execute(orders) -> list[ExecutionResult] # side-effecting: places orders
    def tick() -> TickResult                    # sync → signal → execute
    def backtest(history) -> BacktestResult     # historical replay
    def teardown() -> None
    def state() -> dict
```

The engine only ever calls these methods. Your strategy is a subclass that fills in `signal()` and `backtest()` — the rest has working defaults.

## Live engine cycle

Every `scan_minutes` (configured per-strat in the LIVE tab):

1. Engine calls `strat.tick()`
2. `tick()` runs `sync()` → `signal()` → `execute()` and returns `TickResult`
3. Engine logs the result, schedules next cycle

## Backtest cycle

One-shot replay over a historical window:

1. Engine collects historical trades for the strat's watchlist
2. Engine calls `strat.backtest(history)`
3. Strat replays its `signal()` logic deterministically and returns a `BacktestResult` (curve, fees, gas, final PnL, ROI)

The UI's P&L curve, trade feed, and fee/gas/total/gross row all read directly from `BacktestResult`.

## Writing a custom strat

Two paths:

### Path A — Edit `copytrader.py` in place

The reference `CopyTrader` mirrors trades from a watchlist with weights. Edit:

- `_should_mirror(trade)` — filter trades (skip certain markets / outcomes / prices)
- `_per_trade_size_usd(trade)` — change sizing (e.g. fixed size, Kelly-fraction, vol-scaled)
- `_slippage_adjusted_price(trade)` — limit-price rule (aggressive vs. patient)

### Path B — Subclass `Strat`

For strategies that aren't pure mirroring (e.g. momentum, mean-reversion, market-making):

```python
from polymarket.strats import Strat, Order, OrderSide

class MeanReversion(Strat):
    def signal(self, sync):
        # ignore sync.trader_trades — generate orders from your own logic
        orders = []
        for token_id, qty in sync.open_positions.items():
            mid = sync.extras["mid_prices"][token_id]
            if mid < 0.4:   # cheap — accumulate
                orders.append(Order(token_id, OrderSide.BUY, size=10, price=mid))
            elif mid > 0.6: # rich — trim
                orders.append(Order(token_id, OrderSide.SELL, size=qty * 0.5, price=mid))
        return orders

    def backtest(self, history):
        # ... use the same signal() logic over a historical mid-price series
        ...
```

## I/O is engine-provided

Strats never open HTTP sockets directly. The engine passes `StratConfig.fetch_trader_trades`, `fetch_wallet_usdc`, `fetch_open_positions`, `place_order` — your strat code calls those. This is what lets the same `signal()` work for both live and backtest (engine swaps in historical-replay versions for backtest).

## Why this shape

- **`sync` separate from `signal`**: keeps the decision logic pure, so backtest can reuse it deterministically. If you mix I/O into `signal()`, you lose backtest credibility.
- **`backtest()` mandatory**: every strat has a self-contained replay. The UI's "what would this have done last 7 days?" requires it.
- **`signal()` returns `Order`, not raw API calls**: lets the engine batch, rate-limit, or route across venues without strat changes.
- **No throttle in the base class**: every detected trade flows through `signal()`. If you want throttling, do it explicitly in your override (`_should_mirror` returning False past N/hour). The default mirrors everything — copy engines are about being fast, not filtering.

## File layout

```
src/strats/
  __init__.py          # public exports: Strat, StratConfig, Order, ...
  base.py              # abstract Strat + dataclasses (the "ABI")
  copytrader.py        # reference implementation (editable template)
  README.md            # this file
```
