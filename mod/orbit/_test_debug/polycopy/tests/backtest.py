"""
Backtest engine for polycopy.

Pulls real historical Swap events from on-chain via public RPCs,
replays them through the scoring and position-sizing logic,
and reports simulated copy trading performance.

Usage:
    python tests/backtest.py                         # default: Base, last 1000 blocks
    python tests/backtest.py --chain base --blocks 5000
    python tests/backtest.py --chain polygon --blocks 2000 --top 10
    python tests/backtest.py --chain arbitrum --blocks 3000 --min-trades 5
"""
import argparse
import json
import os
import sys
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

# Web3 interaction via direct RPC calls (no extra deps)
import ssl
import urllib.request
import urllib.error

# Create SSL context that works with Python 3.14+ (macOS cert issue)
_ssl_ctx = ssl.create_default_context()
try:
    import certifi
    _ssl_ctx.load_verify_locations(certifi.where())
except ImportError:
    _ssl_ctx.check_hostname = False
    _ssl_ctx.verify_mode = ssl.CERT_NONE

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# --- Constants ---

CHAIN_CONFIG = {
    'base': {
        'chain_id': 8453,
        'rpcs': [
            'https://mainnet.base.org',
            'https://base-rpc.publicnode.com',
            'https://base.drpc.org',
        ],
        'weth': '0x4200000000000000000000000000000000000006',
        'usdc': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        'block_time': 2.0,
    },
    'polygon': {
        'chain_id': 137,
        'rpcs': [
            'https://polygon-rpc.com',
            'https://polygon-bor-rpc.publicnode.com',
            'https://polygon.drpc.org',
        ],
        'weth': '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
        'usdc': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        'block_time': 2.0,
    },
    'arbitrum': {
        'chain_id': 42161,
        'rpcs': [
            'https://arb1.arbitrum.io/rpc',
            'https://arbitrum-one-rpc.publicnode.com',
            'https://arbitrum.drpc.org',
        ],
        'weth': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        'usdc': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        'block_time': 0.25,
    },
}

# Swap event topics
SWAP_V3_TOPIC = '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67'
SWAP_V2_TOPIC = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822'


# --- RPC Helpers ---

class RpcClient:
    """Simple JSON-RPC client with endpoint rotation."""

    def __init__(self, rpcs: List[str]):
        self.rpcs = rpcs
        self.idx = 0
        self.errors: Dict[str, int] = defaultdict(int)

    def call(self, method: str, params: list, retries: int = None) -> dict:
        if retries is None:
            retries = len(self.rpcs) * 2  # try each provider at least twice
        last_err = None
        for attempt in range(retries):
            url = self.rpcs[self.idx % len(self.rpcs)]
            self.idx += 1
            try:
                payload = json.dumps({
                    'jsonrpc': '2.0',
                    'method': method,
                    'params': params,
                    'id': 1
                }).encode()
                req = urllib.request.Request(
                    url, data=payload,
                    headers={
                        'Content-Type': 'application/json',
                        'User-Agent': 'polycopy-backtest/0.1',
                    }
                )
                with urllib.request.urlopen(req, timeout=15, context=_ssl_ctx) as resp:
                    result = json.loads(resp.read())
                if 'error' in result:
                    self.errors[url] += 1
                    last_err = result['error']
                    continue
                return result.get('result')
            except Exception as e:
                self.errors[url] += 1
                last_err = e
                time.sleep(0.3)
        raise RuntimeError(f"All RPC attempts failed for {method}: {last_err}")

    def get_block_number(self) -> int:
        r = self.call('eth_blockNumber', [])
        return int(r, 16)

    def get_logs(self, from_block: int, to_block: int, topics: list) -> list:
        params = [{
            'fromBlock': hex(from_block),
            'toBlock': hex(to_block),
            'topics': [topics],
        }]
        return self.call('eth_getLogs', params) or []

    def get_tx(self, tx_hash: str) -> Optional[dict]:
        return self.call('eth_getTransactionByHash', [tx_hash])


# --- Data Structures ---

@dataclass
class SwapRecord:
    block: int
    tx_hash: str
    trader: str  # tx.from (the actual wallet that initiated)
    pool: str
    dex: str  # v2 or v3
    amount0: int
    amount1: int
    token_in_idx: int  # 0 or 1
    raw_log: dict = field(repr=False, default=None)

@dataclass
class TraderProfile:
    address: str
    swaps: List[SwapRecord] = field(default_factory=list)
    total_volume_raw: int = 0
    unique_pools: set = field(default_factory=set)
    first_block: int = 0
    last_block: int = 0

@dataclass
class CopyResult:
    """Simulated result of copying a single trade."""
    original_trader: str
    block: int
    tx_hash: str
    dex: str
    scaled_amount_in: int
    estimated_amount_out: int
    slippage_cost_bps: int
    gas_estimate_usd: float
    would_profit: bool


# --- Core Backtest Logic ---

class Backtester:
    def __init__(self, chain: str, blocks: int, top_n: int, min_trades: int,
                 position_pct: float, slippage_bps: int):
        self.chain = chain
        self.chain_cfg = CHAIN_CONFIG[chain]
        self.rpc = RpcClient(self.chain_cfg['rpcs'])
        self.blocks = blocks
        self.top_n = top_n
        self.min_trades = min_trades
        self.position_pct = position_pct
        self.slippage_bps = slippage_bps
        self.traders: Dict[str, TraderProfile] = {}
        self.all_swaps: List[SwapRecord] = []

    def run(self):
        print(f"\n{'='*70}")
        print(f"  POLYCOPY BACKTEST — {self.chain.upper()}")
        print(f"{'='*70}")
        print(f"  Chain ID:      {self.chain_cfg['chain_id']}")
        print(f"  Blocks:        {self.blocks}")
        print(f"  Position size: {self.position_pct}%")
        print(f"  Slippage:      {self.slippage_bps} bps")
        print(f"  Min trades:    {self.min_trades}")
        print(f"  Top traders:   {self.top_n}")
        print(f"{'='*70}\n")

        # Phase 1: Fetch historical swap events
        self._fetch_swaps()

        if not self.all_swaps:
            print("No swap events found. Try increasing --blocks.")
            return

        # Phase 2: Identify traders and build profiles
        self._build_profiles()

        # Phase 3: Score and rank traders
        ranked = self._rank_traders()

        if not ranked:
            print(f"No traders with >= {self.min_trades} trades found.")
            return

        # Phase 4: Simulate copy trading the top traders
        self._simulate_copy(ranked)

        # Phase 5: Report
        self._report(ranked)

    def _fetch_swaps(self):
        print("[1/5] Fetching swap events from chain...")
        current_block = self.rpc.get_block_number()
        from_block = current_block - self.blocks
        to_block = current_block

        print(f"  Scanning blocks {from_block:,} to {to_block:,} ({self.blocks:,} blocks)")
        print(f"  ~{self.blocks * self.chain_cfg['block_time'] / 60:.0f} minutes of history")

        # Fetch in chunks of 500 blocks (public RPC limits)
        chunk_size = 500
        total_v3 = 0
        total_v2 = 0

        b = from_block
        while b <= to_block:
            end = min(b + chunk_size - 1, to_block)
            pct = (b - from_block) / max(1, to_block - from_block) * 100

            # V3 swaps
            try:
                logs_v3 = self.rpc.get_logs(b, end, SWAP_V3_TOPIC)
                for log in logs_v3:
                    swap = self._parse_v3_log(log)
                    if swap:
                        self.all_swaps.append(swap)
                        total_v3 += 1
            except Exception as e:
                print(f"  Warning: V3 getLogs failed at block {b}: {e}")

            # V2 swaps
            try:
                logs_v2 = self.rpc.get_logs(b, end, SWAP_V2_TOPIC)
                for log in logs_v2:
                    swap = self._parse_v2_log(log)
                    if swap:
                        self.all_swaps.append(swap)
                        total_v2 += 1
            except Exception as e:
                print(f"  Warning: V2 getLogs failed at block {b}: {e}")

            if int(pct) % 20 == 0 and b == from_block + (int(pct) // 20) * (to_block - from_block) // 5:
                print(f"  {pct:.0f}% — {total_v3 + total_v2} swaps found so far")

            b = end + 1
            time.sleep(0.1)  # rate limit courtesy

        print(f"  Done: {total_v3} V3 swaps + {total_v2} V2 swaps = {len(self.all_swaps)} total")

    def _parse_v3_log(self, log: dict) -> Optional[SwapRecord]:
        topics = log.get('topics', [])
        data = log.get('data', '0x')
        if len(topics) < 3 or len(data) < 322:  # 0x + 5*64
            return None

        block = int(log.get('blockNumber', '0x0'), 16)
        tx_hash = log.get('transactionHash', '')
        pool = log.get('address', '')

        # Decode data: int256 amount0, int256 amount1, ...
        data_hex = data[2:]  # strip 0x
        amount0 = int.from_bytes(bytes.fromhex(data_hex[0:64]), 'big', signed=True)
        amount1 = int.from_bytes(bytes.fromhex(data_hex[64:128]), 'big', signed=True)

        # Positive amount = token going INTO pool (user sold it)
        # Negative amount = token coming OUT of pool (user received it)
        token_in_idx = 0 if amount0 > 0 else 1

        return SwapRecord(
            block=block,
            tx_hash=tx_hash,
            trader='',  # resolved later
            pool=pool.lower(),
            dex='v3',
            amount0=amount0,
            amount1=amount1,
            token_in_idx=token_in_idx,
            raw_log=log,
        )

    def _parse_v2_log(self, log: dict) -> Optional[SwapRecord]:
        topics = log.get('topics', [])
        data = log.get('data', '0x')
        if len(topics) < 3 or len(data) < 258:  # 0x + 4*64
            return None

        block = int(log.get('blockNumber', '0x0'), 16)
        tx_hash = log.get('transactionHash', '')
        pool = log.get('address', '')

        data_hex = data[2:]
        amount0_in = int(data_hex[0:64], 16)
        amount0_out = int(data_hex[64:128], 16)
        amount1_in = int(data_hex[128:192], 16)
        amount1_out = int(data_hex[192:256], 16)

        if amount0_in > 0:
            token_in_idx = 0
            amount0 = amount0_in
            amount1 = -amount1_out
        else:
            token_in_idx = 1
            amount0 = -amount0_out
            amount1 = amount1_in

        return SwapRecord(
            block=block,
            tx_hash=tx_hash,
            trader='',
            pool=pool.lower(),
            dex='v2',
            amount0=amount0,
            amount1=amount1,
            token_in_idx=token_in_idx,
            raw_log=log,
        )

    def _build_profiles(self):
        print(f"\n[2/5] Resolving traders from {len(self.all_swaps)} swaps...")

        # Group by tx_hash to batch lookups
        tx_hashes = list(set(s.tx_hash for s in self.all_swaps if s.tx_hash))
        print(f"  {len(tx_hashes)} unique transactions to resolve")

        # Resolve tx sender for each unique tx_hash
        tx_to_sender: Dict[str, str] = {}
        resolved = 0
        for i, tx_hash in enumerate(tx_hashes):
            if i > 500:  # cap resolution to avoid rate limits
                print(f"  Capping at 500 tx lookups (have {len(tx_hashes)})")
                break
            try:
                tx = self.rpc.get_tx(tx_hash)
                if tx and 'from' in tx:
                    tx_to_sender[tx_hash] = tx['from'].lower()
                    resolved += 1
            except:
                pass

            if (i + 1) % 100 == 0:
                print(f"  Resolved {resolved}/{i+1} transactions...")
                time.sleep(0.2)

        print(f"  Resolved {resolved} senders")

        # Assign traders to swaps and build profiles
        for swap in self.all_swaps:
            trader = tx_to_sender.get(swap.tx_hash, '')
            if not trader:
                continue
            swap.trader = trader

            if trader not in self.traders:
                self.traders[trader] = TraderProfile(address=trader, first_block=swap.block)
            profile = self.traders[trader]
            profile.swaps.append(swap)
            profile.total_volume_raw += abs(swap.amount0) + abs(swap.amount1)
            profile.unique_pools.add(swap.pool)
            profile.last_block = max(profile.last_block, swap.block)

        print(f"  {len(self.traders)} unique traders identified")

    def _rank_traders(self) -> List[Tuple[str, TraderProfile, dict]]:
        print(f"\n[3/5] Scoring traders (min {self.min_trades} trades)...")

        ranked = []
        for addr, profile in self.traders.items():
            n = len(profile.swaps)
            if n < self.min_trades:
                continue

            # Heuristic scoring (without USD prices, use relative metrics)
            # 1. Trade frequency (more active = better signal)
            block_span = max(1, profile.last_block - profile.first_block)
            trades_per_100_blocks = n / block_span * 100

            # 2. Pool diversity (trading across more pools = more sophisticated)
            pool_diversity = len(profile.unique_pools)

            # 3. Consistency: ratio of V3 to total (V3 traders tend to be more sophisticated)
            v3_count = sum(1 for s in profile.swaps if s.dex == 'v3')
            v3_ratio = v3_count / n

            # 4. Volume (raw, not USD — bigger = more signal)
            vol_score = min(100, profile.total_volume_raw / (10**20))  # normalize

            # Composite score
            score = (
                trades_per_100_blocks * 20 +
                pool_diversity * 15 +
                v3_ratio * 30 +
                vol_score * 10 +
                min(n, 50) * 1.0  # reward trade count, capped
            )

            metrics = {
                'trades': n,
                'pools': pool_diversity,
                'v3_ratio': round(v3_ratio, 2),
                'frequency': round(trades_per_100_blocks, 2),
                'score': round(score, 1),
                'blocks_active': block_span,
            }
            ranked.append((addr, profile, metrics))

        ranked.sort(key=lambda x: x[2]['score'], reverse=True)
        top = ranked[:self.top_n]

        print(f"  {len(ranked)} traders qualified, showing top {min(self.top_n, len(ranked))}")
        print()
        print(f"  {'Rank':<5} {'Address':<44} {'Trades':<8} {'Pools':<7} {'V3%':<6} {'Score':<8}")
        print(f"  {'-'*5} {'-'*44} {'-'*8} {'-'*7} {'-'*6} {'-'*8}")
        for i, (addr, profile, metrics) in enumerate(top):
            print(f"  {i+1:<5} {addr:<44} {metrics['trades']:<8} {metrics['pools']:<7} "
                  f"{metrics['v3_ratio']*100:<5.0f}% {metrics['score']:<8.1f}")

        return top

    def _simulate_copy(self, ranked: List[Tuple[str, TraderProfile, dict]]):
        print(f"\n[4/5] Simulating copy trades (position={self.position_pct}%, slippage={self.slippage_bps}bps)...")

        self.copy_results: List[CopyResult] = []

        for addr, profile, metrics in ranked:
            for swap in profile.swaps:
                # Scale position
                amount_in = abs(swap.amount0 if swap.token_in_idx == 0 else swap.amount1)
                scaled = int(amount_in * self.position_pct / 100)
                if scaled == 0:
                    continue

                amount_out = abs(swap.amount1 if swap.token_in_idx == 0 else swap.amount0)
                scaled_out = int(amount_out * self.position_pct / 100) if amount_out else 0

                # Apply slippage
                slippage_loss = int(scaled_out * self.slippage_bps / 10000)
                estimated_out = scaled_out - slippage_loss

                # Estimate gas cost (rough: 150k gas * 30 gwei for V3, 120k for V2)
                gas_units = 150000 if swap.dex == 'v3' else 120000
                gas_gwei = 5 if self.chain in ('base', 'arbitrum') else 30
                gas_cost_eth = gas_units * gas_gwei * 1e-9
                gas_cost_usd = gas_cost_eth * 2500  # rough ETH price

                # Would this trade be profitable after gas?
                # Without exact USD values we estimate based on output ratio
                output_ratio = estimated_out / max(1, scaled) if scaled > 0 else 0
                would_profit = output_ratio > 0.5 and gas_cost_usd < 5

                self.copy_results.append(CopyResult(
                    original_trader=addr,
                    block=swap.block,
                    tx_hash=swap.tx_hash,
                    dex=swap.dex,
                    scaled_amount_in=scaled,
                    estimated_amount_out=estimated_out,
                    slippage_cost_bps=self.slippage_bps,
                    gas_estimate_usd=round(gas_cost_usd, 4),
                    would_profit=would_profit,
                ))

        print(f"  Simulated {len(self.copy_results)} copy trades")

    def _report(self, ranked: List[Tuple[str, TraderProfile, dict]]):
        print(f"\n[5/5] Backtest Results")
        print(f"{'='*70}")

        total = len(self.copy_results)
        if total == 0:
            print("  No trades simulated.")
            return

        profitable = sum(1 for r in self.copy_results if r.would_profit)
        unprofitable = total - profitable
        total_gas = sum(r.gas_estimate_usd for r in self.copy_results)
        v3_trades = sum(1 for r in self.copy_results if r.dex == 'v3')
        v2_trades = total - v3_trades

        print(f"\n  SUMMARY")
        print(f"  {'Chain:':<25} {self.chain.upper()} ({self.chain_cfg['chain_id']})")
        print(f"  {'Blocks scanned:':<25} {self.blocks:,}")
        print(f"  {'Time window:':<25} ~{self.blocks * self.chain_cfg['block_time'] / 60:.0f} min")
        print(f"  {'Total swaps found:':<25} {len(self.all_swaps):,}")
        print(f"  {'Unique traders:':<25} {len(self.traders):,}")
        print(f"  {'Qualified traders:':<25} {len(ranked)}")
        print(f"  {'Copy trades simulated:':<25} {total:,}")
        print(f"  {'V3 trades:':<25} {v3_trades} ({v3_trades/total*100:.0f}%)")
        print(f"  {'V2 trades:':<25} {v2_trades} ({v2_trades/total*100:.0f}%)")
        print(f"  {'Est. profitable:':<25} {profitable} ({profitable/total*100:.1f}%)")
        print(f"  {'Est. unprofitable:':<25} {unprofitable}")
        print(f"  {'Total est. gas cost:':<25} ${total_gas:.2f}")
        print(f"  {'Avg gas per trade:':<25} ${total_gas/total:.4f}")

        # Per-trader breakdown
        print(f"\n  PER-TRADER BREAKDOWN")
        print(f"  {'Trader':<44} {'Copies':<8} {'Win%':<8} {'Gas$':<10}")
        print(f"  {'-'*44} {'-'*8} {'-'*8} {'-'*10}")

        for addr, profile, metrics in ranked:
            trader_copies = [r for r in self.copy_results if r.original_trader == addr]
            if not trader_copies:
                continue
            wins = sum(1 for r in trader_copies if r.would_profit)
            gas = sum(r.gas_estimate_usd for r in trader_copies)
            win_pct = wins / len(trader_copies) * 100
            print(f"  {addr:<44} {len(trader_copies):<8} {win_pct:<7.1f}% ${gas:<9.2f}")

        # RPC health
        print(f"\n  RPC ENDPOINT STATS")
        for url, errs in sorted(self.rpc.errors.items(), key=lambda x: x[1], reverse=True):
            if errs > 0:
                print(f"  {url}: {errs} errors")
        if not any(self.rpc.errors.values()):
            print(f"  All endpoints healthy (0 errors)")

        print(f"\n{'='*70}")
        print(f"  Backtest complete.")
        print(f"{'='*70}\n")

        # Save results
        results_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            f'backtest_{self.chain}_{int(time.time())}.json'
        )
        results = {
            'chain': self.chain,
            'chain_id': self.chain_cfg['chain_id'],
            'blocks_scanned': self.blocks,
            'total_swaps': len(self.all_swaps),
            'unique_traders': len(self.traders),
            'qualified_traders': len(ranked),
            'copy_trades': total,
            'profitable_pct': round(profitable / total * 100, 1),
            'total_gas_usd': round(total_gas, 2),
            'top_traders': [
                {
                    'address': addr,
                    'score': metrics['score'],
                    'trades': metrics['trades'],
                    'pools': metrics['pools'],
                    'v3_ratio': metrics['v3_ratio'],
                }
                for addr, _, metrics in ranked
            ],
            'config': {
                'position_pct': self.position_pct,
                'slippage_bps': self.slippage_bps,
                'min_trades': self.min_trades,
                'top_n': self.top_n,
            }
        }
        with open(results_path, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"  Results saved to {results_path}")


def main():
    parser = argparse.ArgumentParser(description='Polycopy Backtester')
    parser.add_argument('--chain', default='base', choices=['base', 'polygon', 'arbitrum'],
                        help='Chain to backtest on')
    parser.add_argument('--blocks', type=int, default=1000,
                        help='Number of recent blocks to scan')
    parser.add_argument('--top', type=int, default=10,
                        help='Number of top traders to copy')
    parser.add_argument('--min-trades', type=int, default=3,
                        help='Minimum trades to qualify as a trader')
    parser.add_argument('--position-pct', type=float, default=10.0,
                        help='Position size as %% of original trade')
    parser.add_argument('--slippage', type=int, default=50,
                        help='Slippage tolerance in basis points')

    args = parser.parse_args()

    bt = Backtester(
        chain=args.chain,
        blocks=args.blocks,
        top_n=args.top,
        min_trades=args.min_trades,
        position_pct=args.position_pct,
        slippage_bps=args.slippage,
    )
    bt.run()


if __name__ == '__main__':
    main()
