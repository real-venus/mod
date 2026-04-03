#!/usr/bin/env python3
"""
Uniswap V3 Trader Discovery Scraper — Base Chain
Phase 1: Discover active pools from recent Swap events (no manual input)
Phase 2: Resolve pool tokens, estimate 1-day volume, filter >= 10k USD/day
Phase 3: Full 30-day scrape on qualifying pools, track all traders
Saves everything locally with live progress.
"""

import json
import os
import sys
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from web3 import Web3

# ─── Config ───────────────────────────────────────────────────────────────────

RPC_URL = os.getenv("BASE_RPC_URL", "https://mainnet.base.org")
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "scrape")
DAYS = int(os.getenv("SCRAPE_DAYS", "7"))
BLOCK_TIME = 2  # Base ~2s blocks
CHUNK_SIZE = 2_000  # blocks per eth_getLogs call
MIN_DAILY_VOL_USD = 10_000  # 10k USD/day minimum
DISCOVERY_BLOCKS = 2_000  # ~66 min of blocks for pool discovery

# Free public RPC gateways — round-robin to avoid rate limits
FREE_RPCS = [
    "https://mainnet.base.org",
    "https://base.gateway.tenderly.co",
    "https://base-rpc.publicnode.com",
    "https://base.meowrpc.com",
    "https://1rpc.io/base",
    "https://base.drpc.org",
]

# Swap event signature
SWAP_TOPIC = "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67"

# ERC20 ABI for token resolution
ERC20_ABI = [
    {"inputs": [], "name": "symbol", "outputs": [{"type": "string"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "decimals", "outputs": [{"type": "uint8"}], "stateMutability": "view", "type": "function"},
]

# Uniswap V3 Pool ABI for token0/token1/fee
POOL_ABI = [
    {"inputs": [], "name": "token0", "outputs": [{"type": "address"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "token1", "outputs": [{"type": "address"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "fee", "outputs": [{"type": "uint24"}], "stateMutability": "view", "type": "function"},
]

# Known token prices for USD estimation (updated as we discover tokens)
TOKEN_PRICES = {
    "WETH": 3000, "cbETH": 3100, "wstETH": 3400, "rETH": 3200,
    "USDC": 1, "USDbC": 1, "USDT": 1, "DAI": 1, "crvUSD": 1, "FRAX": 1, "LUSD": 1,
    "WBTC": 85000, "cbBTC": 85000, "tBTC": 85000,
    "AERO": 1.2, "DEGEN": 0.01, "BRETT": 0.05, "TOSHI": 0.0003,
    "VIRTUAL": 1.5, "HIGHER": 0.02, "MOG": 0.000002, "WELL": 0.04,
}

STABLES = {"USDC", "USDbC", "USDT", "DAI", "crvUSD", "FRAX", "LUSD"}

# Known routers/infra to exclude from trader rankings
EXCLUDED = set()

# ─── Helpers ──────────────────────────────────────────────────────────────────

class RpcRoundRobin:
    """Round-robin across multiple free RPC gateways to avoid rate limits"""
    def __init__(self, rpcs=None):
        self.rpcs = rpcs or FREE_RPCS
        self.index = 0
        self.providers = {}  # lazy cache

    def next_url(self):
        url = self.rpcs[self.index % len(self.rpcs)]
        self.index += 1
        return url

    def get_w3(self):
        url = self.next_url()
        if url not in self.providers:
            self.providers[url] = Web3(Web3.HTTPProvider(url, request_kwargs={"timeout": 30}))
        return self.providers[url], url


rpc_pool = RpcRoundRobin()


def decode_int256(hex_str: str) -> int:
    val = int(hex_str, 16)
    if val >= (1 << 255):
        val -= (1 << 256)
    return val


def estimate_usd(t0_sym, t1_sym, t0_dec, t1_dec, amount0_abs, amount1_abs):
    """Estimate USD volume from a swap using known token prices"""
    p0 = TOKEN_PRICES.get(t0_sym, 0)
    p1 = TOKEN_PRICES.get(t1_sym, 0)
    usd0 = (amount0_abs / (10 ** t0_dec)) * p0 if p0 else 0
    usd1 = (amount1_abs / (10 ** t1_dec)) * p1 if p1 else 0

    if t0_sym in STABLES:
        return usd0
    if t1_sym in STABLES:
        return usd1
    return max(usd0, usd1)


def progress_bar(done, total, width=35):
    pct = done / total if total > 0 else 0
    filled = int(width * pct)
    bar = "#" * filled + "-" * (width - filled)
    return f"[{bar}] {pct*100:5.1f}%"


def fetch_logs_retry(w3, params, retries=5):
    """Fetch logs with round-robin failover across gateways"""
    for attempt in range(retries):
        try:
            return w3.eth.get_logs(params)
        except Exception as e:
            if attempt < retries - 1:
                # Rotate to next gateway on failure
                fallback_w3, fallback_url = rpc_pool.get_w3()
                w3 = fallback_w3
                time.sleep(0.5 * (attempt + 1))
            else:
                return None
    return None


# ─── Phase 1: Discover Active Pools ──────────────────────────────────────────

def discover_active_pools(w3, current_block):
    """Scan recent Swap events to find all active Uniswap V3 pools"""
    print(f"=== Phase 1: Discovering Active Pools ({DISCOVERY_BLOCKS} blocks) ===")

    from_block = current_block - DISCOVERY_BLOCKS
    pools = defaultdict(int)
    chunk = 200

    for start in range(from_block, current_block + 1, chunk):
        end = min(start + chunk - 1, current_block)
        done = start - from_block
        pct = done / DISCOVERY_BLOCKS * 100
        sys.stdout.write(f"\r  Scanning... {pct:5.1f}% | pools: {len(pools)}")
        sys.stdout.flush()

        logs = fetch_logs_retry(w3, {
            "fromBlock": start,
            "toBlock": end,
            "topics": [SWAP_TOPIC],
        })
        if logs:
            for log in logs:
                pools[log["address"].lower()] += 1

        time.sleep(0.1)

    ranked = sorted(pools.items(), key=lambda x: -x[1])
    print(f"\n  Found {len(pools)} active pools")
    print(f"  Top 10 by swap count (last ~{DISCOVERY_BLOCKS * BLOCK_TIME // 60} min):")
    for addr, count in ranked[:10]:
        print(f"    {addr}  swaps={count}")
    print()

    return dict(ranked)


# ─── Phase 2: Resolve Tokens & Volume Check ──────────────────────────────────

def resolve_pools(w3, pool_counts, current_block):
    """Resolve token0/token1 for each pool and estimate daily volume"""
    print(f"=== Phase 2: Resolving Pool Tokens & Volume Check ===")

    # Only resolve pools with >= 3 swaps in discovery window (skip dead pools)
    active_addrs = [addr for addr, count in pool_counts.items() if count >= 3]
    print(f"  Resolving tokens for {len(active_addrs)} pools (>= 3 swaps)...")

    resolved = {}
    token_cache = {}
    import threading
    token_lock = threading.Lock()
    resolved_count = [0]

    def get_token_info_for(provider, addr):
        with token_lock:
            if addr in token_cache:
                return token_cache[addr]
        try:
            contract = provider.eth.contract(address=Web3.to_checksum_address(addr), abi=ERC20_ABI)
            sym = contract.functions.symbol().call()
            dec = contract.functions.decimals().call()
            info = {"symbol": sym, "decimals": dec, "address": addr}
        except:
            info = {"symbol": addr[:10], "decimals": 18, "address": addr}
        with token_lock:
            token_cache[addr] = info
        return info

    def resolve_one(pool_addr):
        rpc_w3, _ = rpc_pool.get_w3()
        try:
            pool_contract = rpc_w3.eth.contract(
                address=Web3.to_checksum_address(pool_addr), abi=POOL_ABI
            )
            t0_addr = pool_contract.functions.token0().call().lower()
            t1_addr = pool_contract.functions.token1().call().lower()
            fee = pool_contract.functions.fee().call()

            t0 = get_token_info_for(rpc_w3, t0_addr)
            t1 = get_token_info_for(rpc_w3, t1_addr)

            resolved_count[0] += 1
            return pool_addr, {
                "address": pool_addr,
                "token0": t0_addr,
                "token1": t1_addr,
                "token0_symbol": t0["symbol"],
                "token1_symbol": t1["symbol"],
                "token0_decimals": t0["decimals"],
                "token1_decimals": t1["decimals"],
                "fee": fee,
                "name": f"{t0['symbol']}/{t1['symbol']} {fee/10000:.2f}%",
                "discovery_swaps": pool_counts[pool_addr],
            }
        except:
            resolved_count[0] += 1
            return pool_addr, None

    # Concurrent resolution across round-robin RPCs (10 workers, spread across 6 gateways)
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(resolve_one, addr): addr for addr in active_addrs}
        for future in as_completed(futures):
            addr, result = future.result()
            if result:
                resolved[addr] = result
            sys.stdout.write(f"\r  Resolved {resolved_count[0]}/{len(active_addrs)} pools ({len(resolved)} valid)...")
            sys.stdout.flush()

    print(f"\n  Resolved {len(resolved)} pools")

    # Volume check: scan 1 day of swaps for resolved pools
    print(f"\n  Running 1-day volume check...")
    blocks_1d = 86400 // BLOCK_TIME
    vol_from = current_block - blocks_1d
    pool_volumes = defaultdict(float)

    pool_addrs_list = [Web3.to_checksum_address(a) for a in resolved.keys()]
    # Batch addresses
    batch_size = 50
    batches = [pool_addrs_list[i:i+batch_size] for i in range(0, len(pool_addrs_list), batch_size)]

    block = vol_from
    total_vol_blocks = current_block - vol_from

    while block <= current_block:
        to_block = min(block + CHUNK_SIZE - 1, current_block)
        done = to_block - vol_from
        sys.stdout.write(f"\r  Volume check: {progress_bar(done, total_vol_blocks)} pools checked: {len(pool_volumes)}")
        sys.stdout.flush()

        for batch in batches:
            logs = fetch_logs_retry(w3, {
                "fromBlock": block,
                "toBlock": to_block,
                "address": batch,
                "topics": [SWAP_TOPIC],
            })
            if logs:
                for log in logs:
                    pa = log["address"].lower()
                    pi = resolved.get(pa)
                    if not pi:
                        continue
                    data = log["data"].hex() if isinstance(log["data"], bytes) else log["data"][2:]
                    if len(data) < 128:
                        continue
                    a0 = abs(decode_int256(data[0:64]))
                    a1 = abs(decode_int256(data[64:128]))
                    usd = estimate_usd(
                        pi["token0_symbol"], pi["token1_symbol"],
                        pi["token0_decimals"], pi["token1_decimals"],
                        a0, a1,
                    )
                    pool_volumes[pa] += usd

        block = to_block + 1
        time.sleep(0.2)

    # Filter by daily volume
    qualifying = {}
    for addr, vol in pool_volumes.items():
        if vol >= MIN_DAILY_VOL_USD:
            qualifying[addr] = resolved[addr]
            qualifying[addr]["daily_volume_usd"] = round(vol, 2)

    qualifying = dict(sorted(qualifying.items(), key=lambda x: -pool_volumes[x[0]]))

    print(f"\n\n  {len(qualifying)} pools qualify (>= ${MIN_DAILY_VOL_USD:,}/day):")
    for addr, info in list(qualifying.items())[:25]:
        vol = pool_volumes[addr]
        print(f"    ${vol:>14,.2f}/day  {info['name']:<35}  {addr}")
    if len(qualifying) > 25:
        print(f"    ... and {len(qualifying) - 25} more")
    print()

    # Save pool list
    pools_file = os.path.join(DATA_DIR, "qualifying_pools.json")
    with open(pools_file, "w") as f:
        json.dump({
            "chain": "base",
            "min_daily_vol_usd": MIN_DAILY_VOL_USD,
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "total_pools_discovered": len(pool_counts),
            "pools_resolved": len(resolved),
            "qualifying_pools": len(qualifying),
            "pools": [{**v, "daily_volume_usd_1d": round(pool_volumes.get(k, 0), 2)}
                      for k, v in qualifying.items()],
        }, f, indent=2)
    print(f"  Saved pool list → {pools_file}\n")

    return qualifying


# ─── Phase 3: Full 30-Day Scrape ─────────────────────────────────────────────

def scrape_traders(w3, pools, current_block):
    """Full 30-day scrape of all qualifying pools"""
    print(f"=== Phase 3: Full {DAYS}-Day Trader Scrape ===")

    blocks_per_day = 86400 // BLOCK_TIME
    from_block = current_block - (blocks_per_day * DAYS)
    total_blocks = current_block - from_block

    pool_addrs = [Web3.to_checksum_address(a) for a in pools.keys()]

    print(f"  Block range: {from_block:,} → {current_block:,} ({total_blocks:,} blocks)")
    print(f"  Pools: {len(pool_addrs)}")
    chunks_needed = (total_blocks // CHUNK_SIZE) + 1
    print(f"  Est. requests: ~{chunks_needed * ((len(pool_addrs) + 49) // 50)}")
    print()

    traders = defaultdict(lambda: {
        "trade_count": 0,
        "volume_usd": 0.0,
        "tokens": defaultdict(int),
        "pools_used": set(),
        "first_block": float("inf"),
        "last_block": 0,
        "buys": 0,
        "sells": 0,
    })
    all_swaps = []
    total_events = 0
    errors = 0

    # Batch pool addresses
    batch_size = 50
    addr_batches = [pool_addrs[i:i+batch_size] for i in range(0, len(pool_addrs), batch_size)]

    block = from_block
    start_time = time.time()

    while block <= current_block:
        to_block = min(block + CHUNK_SIZE - 1, current_block)
        blocks_done = to_block - from_block

        elapsed = time.time() - start_time
        rate = blocks_done / elapsed if elapsed > 0 else 0
        eta = (total_blocks - blocks_done) / rate if rate > 0 else 0
        eta_str = f"{int(eta//3600)}h{int((eta%3600)//60)}m" if eta >= 3600 else f"{int(eta//60)}m{int(eta%60)}s"

        sys.stdout.write(
            f"\r  {progress_bar(blocks_done, total_blocks)} "
            f"block {to_block:,}/{current_block:,} | "
            f"swaps: {total_events:,} | "
            f"traders: {len(traders):,} | "
            f"ETA: {eta_str}   "
        )
        sys.stdout.flush()

        for batch in addr_batches:
            logs = fetch_logs_retry(w3, {
                "fromBlock": block,
                "toBlock": to_block,
                "address": batch,
                "topics": [SWAP_TOPIC],
            })

            if logs is None:
                errors += 1
                continue

            for log in logs:
                total_events += 1
                pool_addr = log["address"].lower()
                pool_info = pools.get(pool_addr)
                if not pool_info:
                    continue

                data = log["data"].hex() if isinstance(log["data"], bytes) else log["data"][2:]
                if len(data) < 320:
                    continue

                topics = log["topics"]
                if len(topics) < 3:
                    continue

                recipient_hex = topics[2].hex() if isinstance(topics[2], bytes) else topics[2][2:]
                recipient = "0x" + recipient_hex[24:].lower()
                sender_hex = topics[1].hex() if isinstance(topics[1], bytes) else topics[1][2:]
                sender = "0x" + sender_hex[24:].lower()

                if recipient in EXCLUDED:
                    continue

                trader_addr = recipient
                block_num = log["blockNumber"]

                amount0 = decode_int256(data[0:64])
                amount1 = decode_int256(data[64:128])
                amount0_abs = abs(amount0)
                amount1_abs = abs(amount1)

                t0_sym = pool_info["token0_symbol"]
                t1_sym = pool_info["token1_symbol"]

                if amount0 > 0:
                    token_in, token_out = t0_sym, t1_sym
                else:
                    token_in, token_out = t1_sym, t0_sym

                usd_vol = estimate_usd(
                    t0_sym, t1_sym,
                    pool_info["token0_decimals"], pool_info["token1_decimals"],
                    amount0_abs, amount1_abs,
                )

                t = traders[trader_addr]
                t["trade_count"] += 1
                t["volume_usd"] += usd_vol
                t["tokens"][token_in] += 1
                t["tokens"][token_out] += 1
                t["pools_used"].add(pool_info["name"])
                if block_num < t["first_block"]:
                    t["first_block"] = block_num
                if block_num > t["last_block"]:
                    t["last_block"] = block_num

                if token_in in STABLES:
                    t["buys"] += 1
                elif token_out in STABLES:
                    t["sells"] += 1

                all_swaps.append({
                    "tx": log["transactionHash"].hex() if isinstance(log["transactionHash"], bytes) else log["transactionHash"],
                    "block": block_num,
                    "pool": pool_info["name"],
                    "trader": trader_addr,
                    "in": token_in,
                    "out": token_out,
                    "usd": round(usd_vol, 2),
                })

        block = to_block + 1
        time.sleep(0.15)

    elapsed = time.time() - start_time
    print(f"\n\n=== Scan Complete ===")
    print(f"  Time: {int(elapsed//3600)}h {int((elapsed%3600)//60)}m {int(elapsed%60)}s")
    print(f"  Blocks scanned: {total_blocks:,}")
    print(f"  Total swap events: {total_events:,}")
    print(f"  Unique traders: {len(traders):,}")
    print(f"  Errors: {errors}")

    return traders, all_swaps, from_block, current_block, total_events, elapsed


# ─── Save & Report ────────────────────────────────────────────────────────────

def save_results(traders, all_swaps, from_block, to_block, total_events, elapsed):
    print(f"\n=== Saving Results ===")

    now = datetime.now(timezone.utc)
    ranked = []
    for addr, stats in traders.items():
        first_secs_ago = (to_block - stats["first_block"]) * BLOCK_TIME
        last_secs_ago = (to_block - stats["last_block"]) * BLOCK_TIME
        first_ts = (now - timedelta(seconds=first_secs_ago)).isoformat()
        last_ts = (now - timedelta(seconds=last_secs_ago)).isoformat()

        top_tokens = sorted(stats["tokens"].items(), key=lambda x: -x[1])[:5]
        active_days = ((stats["last_block"] - stats["first_block"]) * BLOCK_TIME) / 86400

        ranked.append({
            "address": addr,
            "trade_count": stats["trade_count"],
            "volume_usd": round(stats["volume_usd"], 2),
            "top_tokens": [t[0] for t in top_tokens],
            "pools_used": list(stats["pools_used"]),
            "first_seen": first_ts,
            "last_active": last_ts,
            "first_block": stats["first_block"],
            "last_block": stats["last_block"],
            "active_days": round(active_days, 1),
            "buys": stats["buys"],
            "sells": stats["sells"],
            "avg_trade_usd": round(stats["volume_usd"] / stats["trade_count"], 2) if stats["trade_count"] > 0 else 0,
        })

    ranked.sort(key=lambda x: -x["volume_usd"])
    for i, t in enumerate(ranked):
        t["rank"] = i + 1

    # 1. Top traders
    top_file = os.path.join(DATA_DIR, f"top_traders_{DAYS}d.json")
    with open(top_file, "w") as f:
        json.dump({
            "chain": "base",
            "chain_id": 8453,
            "days": DAYS,
            "scanned_at": now.isoformat(),
            "from_block": from_block,
            "to_block": to_block,
            "total_swaps": total_events,
            "total_traders": len(ranked),
            "scan_duration_secs": round(elapsed, 1),
            "traders": ranked[:500],
        }, f, indent=2)
    print(f"  Saved top 500 traders → {top_file}")

    # 2. Raw swaps (save in chunks to avoid memory issues)
    swaps_file = os.path.join(DATA_DIR, f"swaps_{DAYS}d.json")
    with open(swaps_file, "w") as f:
        json.dump({
            "chain": "base",
            "days": DAYS,
            "from_block": from_block,
            "to_block": to_block,
            "total": len(all_swaps),
            "swaps": all_swaps[-100_000:] if len(all_swaps) > 100_000 else all_swaps,  # Last 100k if too many
        }, f, indent=2)
    print(f"  Saved raw swaps ({min(len(all_swaps), 100_000):,} of {len(all_swaps):,}) → {swaps_file}")

    # 3. Summary
    summary_file = os.path.join(DATA_DIR, f"summary_{DAYS}d.json")
    pool_stats = defaultdict(lambda: {"swaps": 0, "volume_usd": 0})
    for s in all_swaps:
        pool_stats[s["pool"]]["swaps"] += 1
        pool_stats[s["pool"]]["volume_usd"] += s["usd"]

    with open(summary_file, "w") as f:
        json.dump({
            "chain": "base",
            "days": DAYS,
            "scanned_at": now.isoformat(),
            "blocks": {"from": from_block, "to": to_block, "total": to_block - from_block},
            "total_swaps": total_events,
            "total_traders": len(ranked),
            "total_volume_usd": round(sum(t["volume_usd"] for t in ranked), 2),
            "scan_duration_secs": round(elapsed, 1),
            "pools": {k: {"swaps": v["swaps"], "volume_usd": round(v["volume_usd"], 2)}
                      for k, v in sorted(pool_stats.items(), key=lambda x: -x[1]["volume_usd"])},
            "top_20": [{
                "rank": t["rank"],
                "address": t["address"],
                "trades": t["trade_count"],
                "volume_usd": t["volume_usd"],
                "avg_trade_usd": t["avg_trade_usd"],
                "tokens": t["top_tokens"],
                "buys": t["buys"],
                "sells": t["sells"],
                "active_days": t["active_days"],
            } for t in ranked[:20]],
        }, f, indent=2)
    print(f"  Saved summary → {summary_file}")

    # 4. Engine-compatible cache
    engine_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "discovery")
    os.makedirs(engine_dir, exist_ok=True)
    engine_file = os.path.join(engine_dir, f"base_{DAYS}.json")
    with open(engine_file, "w") as f:
        json.dump({
            "chain": "base",
            "days": 30,
            "scanned_at": now.isoformat(),
            "from_block": from_block,
            "to_block": to_block,
            "traders": [{
                "rank": t["rank"],
                "address": t["address"],
                "trade_count": t["trade_count"],
                "total_volume_usd": t["volume_usd"],
                "most_traded": t["top_tokens"][:3],
                "last_active": t["last_active"],
                "first_seen": t["first_seen"],
            } for t in ranked[:200]],
        }, f, indent=2)
    print(f"  Saved engine cache → {engine_file}")

    # Print leaderboard
    print(f"\n{'='*115}")
    print(f" TOP 30 TRADERS — Base Chain — {DAYS} Days")
    print(f"{'='*115}")
    print(f"{'#':>4}  {'Address':<44} {'Trades':>7} {'Buy':>5} {'Sell':>5}  {'Volume USD':>14}  {'Avg Trade':>10}  Tokens")
    print(f"{'-'*115}")
    for t in ranked[:30]:
        tokens = ", ".join(t["top_tokens"][:3])
        print(
            f"{t['rank']:>4}  {t['address']:<44} "
            f"{t['trade_count']:>7,} {t['buys']:>5,} {t['sells']:>5,}  "
            f"${t['volume_usd']:>13,.2f}  ${t['avg_trade_usd']:>9,.2f}  {tokens}"
        )

    total_vol = sum(t["volume_usd"] for t in ranked)
    print(f"\n  Total volume tracked: ${total_vol:,.2f}")
    print(f"  All data saved to: {DATA_DIR}/")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    os.makedirs(DATA_DIR, exist_ok=True)

    # Try primary RPC first, fall back to round-robin pool
    w3 = Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={"timeout": 30}))
    if not w3.is_connected():
        print(f"Primary RPC ({RPC_URL}) failed, trying round-robin gateways...")
        for url in FREE_RPCS:
            w3 = Web3(Web3.HTTPProvider(url, request_kwargs={"timeout": 30}))
            if w3.is_connected():
                print(f"  Connected via {url}")
                break
        else:
            print("FATAL: Cannot connect to any RPC gateway")
            sys.exit(1)

    current_block = w3.eth.block_number
    print(f"=== Uniswap V3 Trader Discovery — Base Chain ===")
    print(f"RPC: {RPC_URL} (+ {len(FREE_RPCS)} free gateways for failover)")
    print(f"Current block: {current_block:,}")
    print(f"Period: {DAYS} days | Min pool volume: ${MIN_DAILY_VOL_USD:,}/day")
    print(f"Output: {DATA_DIR}/")
    print()

    # Phase 1: Discover active pools from recent events
    pool_counts = discover_active_pools(w3, current_block)

    # Phase 2: Resolve tokens + volume check
    qualifying_pools = resolve_pools(w3, pool_counts, current_block)

    if not qualifying_pools:
        print("No qualifying pools found. Try lowering MIN_DAILY_VOL_USD.")
        sys.exit(1)

    # Phase 3: Full 30-day scrape
    traders, swaps, fb, tb, total_events, elapsed = scrape_traders(w3, qualifying_pools, current_block)

    # Save everything
    save_results(traders, swaps, fb, tb, total_events, elapsed)


if __name__ == "__main__":
    main()
