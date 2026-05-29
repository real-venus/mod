---
name: hyperliquid
description: Copy-trade any Hyperliquid wallet by N-day performance and compose them into vault-backed indexes
---

# hyperliquid

Copy-trading + index composer for Hyperliquid.

```
src/
  mod.py        # high-level orchestrator (serve/kill/status/forward)
  api/          # Rust API (axum + tokio) — the hot path
  app/          # Next.js 14 frontend
```

## Quick start

```python
import mod as m
hl = m.mod('hyperliquid')()

hl.build()                     # cargo build --release
hl.serve()                     # api on 8919, app on 3919
hl.status()                    # service + api health
hl.kill()                      # stop both
```

## What it does

- **Top Traders** — paginate the HL leaderboard, hydrate each candidate's
  fills inside an N-day window, score by pnl / volume / win-rate / Sharpe.
  Mirrors the same activity-based scoring used by `polymarket/active-traders`.
- **Copy follows** — register a `follower → leader` relationship with
  size-pct, per-trade caps, allow/deny coin lists. The Rust engine polls
  each leader and emits scaled "signals" you can sign + submit.
- **Indexes** — pick N traders, weight them, optionally auto-build
  (`autoIndex` weights by ∝ pnl). Backtest weighted PnL over the window.
- **Private vaults** — for any index you own, generate a `createVault`
  action payload, sign with your owner key, and link the resulting
  vault address. Only the owner can deposit/withdraw — the index then
  routes signals through it.

## API surface

`mod.py` exposes everything as forwardable fns. Highlights:

```python
hl.top_traders(days=7, min_per_day=1, pool=200)
hl.analyze_trader('0xabc…', days=14)

hl.create_index(name='Top10', owner='0x…', legs=[
    {'address': '0x…', 'weight': 0.3},
], days_window=7, notional_pct=50)
hl.index_perf(idx_id, days=7)
hl.vault_intent(idx_id, initial_usd=100)        # returns sign-this payload

hl.create_follow(follower='0x…', leader='0x…', size_pct=10)
hl.list_signals(follower='0x…')
```

The same operations are reachable via `POST /forward` on the Rust API
for keyless mod-protocol consumers.

## Vault create payload

`vault_intent(index_id, initial_usd)` returns:

```json
{
  "action": {"type":"createVault","name":"…","initialUsd":100000000,"nonce":...},
  "owner": "0x…",
  "exchange_url": "https://api.hyperliquid.xyz/exchange"
}
```

The Rust binary stays keyless on purpose — signing happens in the
caller (browser wallet, SDK, etc.). The `/forward` passthrough then
relays the signed payload to Hyperliquid's `/exchange`.

## Ports

| service  | port | env override         |
| -------- | ---- | -------------------- |
| Rust API | 8919 | `PORT`               |
| Next app | 3919 | passed by `serve`    |
| Testnet  | —    | `HYPERLIQUID_TESTNET=true` |
