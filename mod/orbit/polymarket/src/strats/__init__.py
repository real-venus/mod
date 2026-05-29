"""
polymarket.strats — programmable Polymarket strategies.

Strategies are Python classes with a canonical interface (Strat), the same
way ERC-20 standardizes `balanceOf` / `transfer`. The engine (live engine
in TS, backtest engine here) speaks to the strat through these methods —
nothing else. Owners write or fork classes to express custom logic.

See `base.py` for the abstract Strat interface and `copytrader.py` for
the reference implementation (mirrors trades from a watchlist with weights).
"""

from .base import (
    Strat,
    StratConfig,
    Order,
    OrderSide,
    TraderTrade,
    SyncResult,
    ExecutionResult,
    TickResult,
    BacktestResult,
)
from .copytrader import CopyTrader

__all__ = [
    "Strat",
    "StratConfig",
    "Order",
    "OrderSide",
    "TraderTrade",
    "SyncResult",
    "ExecutionResult",
    "TickResult",
    "BacktestResult",
    "CopyTrader",
]
