import time
import json
import os
import requests
from datetime import datetime, timedelta
from collections import defaultdict

CHAINS = {
    'ethereum': {
        'subgraph': 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
        'explorer': 'https://api.etherscan.io/api',
        'explorer_key_env': 'ETHERSCAN_API_KEY',
    },
    'base': {
        'subgraph': 'https://api.thegraph.com/subgraphs/name/messari/uniswap-v3-base',
        'explorer': 'https://api.basescan.org/api',
        'explorer_key_env': 'BASESCAN_API_KEY',
    },
    'arbitrum': {
        'subgraph': 'https://api.thegraph.com/subgraphs/name/messari/uniswap-v3-arbitrum',
        'explorer': 'https://api.arbiscan.io/api',
        'explorer_key_env': 'ARBISCAN_API_KEY',
    },
    'polygon': {
        'subgraph': 'https://api.thegraph.com/subgraphs/name/messari/uniswap-v3-polygon',
        'explorer': 'https://api.polygonscan.com/api',
        'explorer_key_env': 'POLYGONSCAN_API_KEY',
    },
}

STABLES = {'USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'LUSD', 'USDD', 'GUSD', 'USDP', 'USDbC'}
WETH_SYMBOLS = {'WETH', 'WBTC', 'WMATIC', 'WBNB'}

SWAPS_QUERY = """
query GetSwaps($timestamp_gte: BigInt!, $skip: Int!, $first: Int!) {
  swaps(
    first: $first
    skip: $skip
    orderBy: timestamp
    orderDirection: desc
    where: { timestamp_gte: $timestamp_gte }
  ) {
    id
    timestamp
    origin
    amount0
    amount1
    amountUSD
    token0 { id symbol decimals }
    token1 { id symbol decimals }
    pool { id }
  }
}
"""

SWAPS_BY_ORIGIN_QUERY = """
query GetSwapsByOrigin($origin: Bytes!, $timestamp_gte: BigInt!, $skip: Int!, $first: Int!) {
  swaps(
    first: $first
    skip: $skip
    orderBy: timestamp
    orderDirection: desc
    where: { origin: $origin, timestamp_gte: $timestamp_gte }
  ) {
    id
    timestamp
    origin
    amount0
    amount1
    amountUSD
    token0 { id symbol decimals }
    token1 { id symbol decimals }
    pool { id }
  }
}
"""


def _subgraph_query(url, query, variables, retries=3):
    for attempt in range(retries):
        try:
            resp = requests.post(url, json={'query': query, 'variables': variables}, timeout=30)
            data = resp.json()
            if 'errors' in data:
                print(f"Subgraph error: {data['errors']}")
                return []
            return data.get('data', {}).get('swaps', [])
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
            else:
                print(f"Subgraph request failed after {retries} attempts: {e}")
                return []


def _paginate_swaps(url, query, variables, max_pages=10):
    all_swaps = []
    for page in range(max_pages):
        v = {**variables, 'skip': page * 1000, 'first': 1000}
        batch = _subgraph_query(url, query, v)
        if not batch:
            break
        all_swaps.extend(batch)
        if len(batch) < 1000:
            break
        time.sleep(0.3)
    return all_swaps


def _classify_swap(swap):
    """Determine what the trader bought/sold and the USD value."""
    t0 = swap['token0']['symbol']
    t1 = swap['token1']['symbol']
    a0 = float(swap['amount0'])
    a1 = float(swap['amount1'])
    usd = abs(float(swap['amountUSD']))

    # In Uniswap V3 swaps: positive amount = token entering pool, negative = token leaving pool
    # Trader receives the token leaving the pool (negative amount)
    if a0 < 0:
        bought, sold = t0, t1
        bought_addr, sold_addr = swap['token0']['id'], swap['token1']['id']
    else:
        bought, sold = t1, t0
        bought_addr, sold_addr = swap['token1']['id'], swap['token0']['id']

    return {
        'timestamp': int(swap['timestamp']),
        'origin': swap['origin'],
        'bought': bought,
        'sold': sold,
        'bought_addr': bought_addr,
        'sold_addr': sold_addr,
        'usd': usd,
        'pool': swap['pool']['id'],
    }


def _compute_pnl(swaps):
    """
    Compute realized PnL for a trader from their swap history.

    Strategy: track cost basis per token. When trader buys a non-stable token,
    record the USD cost. When they sell it, realize PnL = sell_usd - proportional_cost.
    """
    # cost_basis[token_addr] = {'total_cost_usd': float, 'balance': float}
    positions = defaultdict(lambda: {'cost_usd': 0.0, 'amount': 0.0})
    realized_pnl = 0.0
    wins = 0
    losses = 0
    tokens_traded = set()

    for s in sorted(swaps, key=lambda x: x['timestamp']):
        bought = s['bought']
        sold = s['sold']
        bought_addr = s['bought_addr']
        usd = s['usd']

        if usd == 0:
            continue

        tokens_traded.add(bought)
        tokens_traded.add(sold)

        is_buy = sold.upper() in STABLES or sold.upper() in WETH_SYMBOLS
        is_sell = bought.upper() in STABLES or bought.upper() in WETH_SYMBOLS

        if is_buy and not is_sell:
            # Buying a token with stables/ETH — add to cost basis
            pos = positions[bought_addr]
            pos['cost_usd'] += usd
            pos['amount'] += 1  # track as unit trades since we don't have exact token amounts
        elif is_sell and not is_buy:
            # Selling a token for stables/ETH — realize PnL
            sold_addr = s['sold_addr']
            pos = positions[sold_addr]
            if pos['amount'] > 0:
                avg_cost = pos['cost_usd'] / pos['amount']
                pnl = usd - avg_cost
                realized_pnl += pnl
                pos['cost_usd'] -= avg_cost
                pos['amount'] -= 1
                if pos['amount'] < 0:
                    pos['amount'] = 0
                    pos['cost_usd'] = 0
                if pnl > 0:
                    wins += 1
                else:
                    losses += 1
            else:
                # No cost basis — treat full sell as profit (e.g. airdrop)
                realized_pnl += usd
                wins += 1
        # Token-to-token swaps: skip for PnL (hard to price without stable reference)

    tokens_traded -= STABLES
    tokens_traded -= WETH_SYMBOLS

    total = wins + losses
    return {
        'pnl_usd': round(realized_pnl, 2),
        'wins': wins,
        'losses': losses,
        'win_rate': round(wins / total, 3) if total > 0 else 0,
        'tokens_traded': sorted(tokens_traded),
        'trade_count': total,
    }


class Mod:
    description = "Multi-chain DEX trader scanner — finds profitable traders to copy"

    def __init__(self, graph_api_key=None):
        self.graph_api_key = graph_api_key or os.environ.get('GRAPH_API_KEY', '')
        self._cache_dir = os.path.join(os.path.dirname(__file__), '.cache')
        os.makedirs(self._cache_dir, exist_ok=True)

    def _get_subgraph_url(self, chain):
        cfg = CHAINS.get(chain)
        if not cfg:
            raise ValueError(f"Unknown chain: {chain}. Available: {list(CHAINS.keys())}")
        url = cfg['subgraph']
        if self.graph_api_key and 'gateway.thegraph.com' in url:
            url = url.replace('api.thegraph.com', f'gateway.thegraph.com/api/{self.graph_api_key}')
        return url

    def _get_explorer_key(self, chain):
        cfg = CHAINS[chain]
        return os.environ.get(cfg['explorer_key_env'], '')

    def _fetch_recent_swaps(self, chain, days, max_pages=10):
        """Fetch recent swaps from a chain's Uniswap V3 subgraph."""
        url = self._get_subgraph_url(chain)
        since = int((datetime.utcnow() - timedelta(days=days)).timestamp())
        return _paginate_swaps(url, SWAPS_QUERY, {'timestamp_gte': str(since)}, max_pages)

    def _fetch_trader_swaps(self, address, chain, days, max_pages=20):
        """Fetch all swaps for a specific trader address."""
        url = self._get_subgraph_url(chain)
        since = int((datetime.utcnow() - timedelta(days=days)).timestamp())
        return _paginate_swaps(
            url, SWAPS_BY_ORIGIN_QUERY,
            {'origin': address.lower(), 'timestamp_gte': str(since)},
            max_pages
        )

    def _fetch_explorer_txns(self, address, chain, days):
        """Supplementary: fetch token transfers from block explorer API."""
        cfg = CHAINS.get(chain)
        if not cfg:
            return []
        api_key = self._get_explorer_key(chain)
        if not api_key:
            return []

        since = int((datetime.utcnow() - timedelta(days=days)).timestamp())
        params = {
            'module': 'account',
            'action': 'tokentx',
            'address': address,
            'startblock': 0,
            'endblock': 99999999,
            'sort': 'desc',
            'apikey': api_key,
        }
        try:
            resp = requests.get(cfg['explorer'], params=params, timeout=30)
            data = resp.json()
            if data.get('status') != '1':
                return []
            return [tx for tx in data.get('result', []) if int(tx.get('timeStamp', 0)) >= since]
        except Exception as e:
            print(f"Explorer API error ({chain}): {e}")
            return []

    def scan(self, days=30, chains=None, min_trades=5, min_profit_pct=10, limit=50, max_pages=5):
        """
        Scan for profitable traders across chains.

        Args:
            days: Look-back period in days (default 30)
            chains: List of chains to scan (default: all)
            min_trades: Minimum number of trades to qualify
            min_profit_pct: Minimum PnL % to include (not used for ranking, just filtering)
            limit: Max number of traders to return
            max_pages: Max subgraph pages per chain for initial scan (1 page = 1000 swaps)

        Returns:
            List of trader dicts sorted by pnl_usd descending
        """
        if chains is None:
            chains = list(CHAINS.keys())

        print(f"Scanning {len(chains)} chains over {days} days...")

        # Step 1: Collect recent swaps and extract unique traders
        all_traders = defaultdict(lambda: {'chains': set(), 'swap_count': 0})

        for chain in chains:
            print(f"  Fetching swaps from {chain}...")
            raw_swaps = self._fetch_recent_swaps(chain, days, max_pages)
            print(f"    Got {len(raw_swaps)} swaps")

            for swap in raw_swaps:
                origin = swap['origin'].lower()
                all_traders[origin]['chains'].add(chain)
                all_traders[origin]['swap_count'] += 1

        # Step 2: Filter to active traders
        active = {
            addr: info for addr, info in all_traders.items()
            if info['swap_count'] >= min_trades
        }
        print(f"  Found {len(active)} traders with >= {min_trades} swaps")

        # Step 3: Analyze top traders (by swap count, most active first)
        sorted_by_activity = sorted(active.items(), key=lambda x: x[1]['swap_count'], reverse=True)
        # Cap analysis to avoid rate limits — analyze top 200 most active
        candidates = sorted_by_activity[:200]

        results = []
        for i, (addr, info) in enumerate(candidates):
            if i % 20 == 0 and i > 0:
                print(f"  Analyzed {i}/{len(candidates)} traders...")
                time.sleep(1)

            trader_swaps = []
            for chain in info['chains']:
                raw = self._fetch_trader_swaps(addr, chain, days)
                classified = [_classify_swap(s) for s in raw]
                trader_swaps.extend(classified)
                time.sleep(0.2)

            if len(trader_swaps) < min_trades:
                continue

            pnl = _compute_pnl(trader_swaps)

            if pnl['trade_count'] < min_trades:
                continue

            total_volume = sum(s['usd'] for s in trader_swaps)
            pnl_pct = (pnl['pnl_usd'] / total_volume * 100) if total_volume > 0 else 0

            results.append({
                'address': addr,
                'chains': sorted(info['chains']),
                'pnl_usd': pnl['pnl_usd'],
                'pnl_pct': round(pnl_pct, 2),
                'trade_count': pnl['trade_count'],
                'total_swaps': len(trader_swaps),
                'win_rate': pnl['win_rate'],
                'volume_usd': round(total_volume, 2),
                'tokens_traded': pnl['tokens_traded'][:10],
                'first_trade': datetime.utcfromtimestamp(min(s['timestamp'] for s in trader_swaps)).strftime('%Y-%m-%d'),
                'last_trade': datetime.utcfromtimestamp(max(s['timestamp'] for s in trader_swaps)).strftime('%Y-%m-%d'),
            })

        # Sort by PnL descending
        results.sort(key=lambda x: x['pnl_usd'], reverse=True)
        results = results[:limit]

        print(f"\nTop {len(results)} profitable traders:")
        for i, r in enumerate(results[:10]):
            print(f"  {i+1}. {r['address'][:10]}... PnL: ${r['pnl_usd']:,.2f} ({r['pnl_pct']}%) "
                  f"Win: {r['win_rate']*100:.0f}% Trades: {r['trade_count']} Vol: ${r['volume_usd']:,.0f}")

        # Cache results
        cache_file = os.path.join(self._cache_dir, f"scan_{days}d_{'_'.join(chains)}.json")
        with open(cache_file, 'w') as f:
            json.dump(results, f, indent=2)

        return results

    def analyze(self, address, days=30, chain='ethereum'):
        """
        Deep analysis of a single trader's swap history.

        Args:
            address: Ethereum address to analyze
            days: Look-back period
            chain: Chain to analyze on

        Returns:
            Dict with detailed PnL breakdown
        """
        print(f"Analyzing {address[:10]}... on {chain} ({days} days)")

        raw = self._fetch_trader_swaps(address, chain, days)
        if not raw:
            return {'error': 'No swaps found', 'address': address, 'chain': chain}

        swaps = [_classify_swap(s) for s in raw]
        pnl = _compute_pnl(swaps)
        total_volume = sum(s['usd'] for s in swaps)

        # Group by token for per-token breakdown
        by_token = defaultdict(list)
        for s in swaps:
            if s['bought'] not in STABLES and s['bought'] not in WETH_SYMBOLS:
                by_token[s['bought']].append(s)
            if s['sold'] not in STABLES and s['sold'] not in WETH_SYMBOLS:
                by_token[s['sold']].append(s)

        token_breakdown = {}
        for token, token_swaps in by_token.items():
            buys = [s for s in token_swaps if s['bought'] == token]
            sells = [s for s in token_swaps if s['sold'] == token]
            token_breakdown[token] = {
                'buys': len(buys),
                'sells': len(sells),
                'buy_volume': round(sum(s['usd'] for s in buys), 2),
                'sell_volume': round(sum(s['usd'] for s in sells), 2),
            }

        # Explorer supplement
        explorer_txns = self._fetch_explorer_txns(address, chain, days)

        timestamps = [s['timestamp'] for s in swaps]

        result = {
            'address': address,
            'chain': chain,
            'days': days,
            'total_swaps': len(swaps),
            'pnl_usd': pnl['pnl_usd'],
            'pnl_pct': round((pnl['pnl_usd'] / total_volume * 100) if total_volume > 0 else 0, 2),
            'win_rate': pnl['win_rate'],
            'wins': pnl['wins'],
            'losses': pnl['losses'],
            'trade_count': pnl['trade_count'],
            'volume_usd': round(total_volume, 2),
            'tokens_traded': pnl['tokens_traded'],
            'token_breakdown': dict(sorted(token_breakdown.items(), key=lambda x: x[1]['buy_volume'], reverse=True)),
            'first_trade': datetime.utcfromtimestamp(min(timestamps)).strftime('%Y-%m-%d %H:%M'),
            'last_trade': datetime.utcfromtimestamp(max(timestamps)).strftime('%Y-%m-%d %H:%M'),
            'explorer_txns_found': len(explorer_txns),
            'recent_swaps': [
                {
                    'time': datetime.utcfromtimestamp(s['timestamp']).strftime('%Y-%m-%d %H:%M'),
                    'bought': s['bought'],
                    'sold': s['sold'],
                    'usd': s['usd'],
                }
                for s in sorted(swaps, key=lambda x: x['timestamp'], reverse=True)[:20]
            ],
        }

        print(f"  PnL: ${result['pnl_usd']:,.2f} ({result['pnl_pct']}%)")
        print(f"  Win rate: {result['win_rate']*100:.0f}% ({result['wins']}W / {result['losses']}L)")
        print(f"  Volume: ${result['volume_usd']:,.0f} across {len(result['tokens_traded'])} tokens")

        return result

    def top(self, days=30, chain='ethereum', limit=20, max_pages=5):
        """
        Quick scan of a single chain for top traders.

        Args:
            days: Look-back period
            chain: Chain to scan
            limit: Number of traders to return
            max_pages: Pages of swaps to fetch (1000 per page)
        """
        return self.scan(days=days, chains=[chain], limit=limit, max_pages=max_pages)

    def cached(self):
        """List cached scan results."""
        files = []
        for f in os.listdir(self._cache_dir):
            if f.endswith('.json'):
                path = os.path.join(self._cache_dir, f)
                mtime = datetime.fromtimestamp(os.path.getmtime(path)).strftime('%Y-%m-%d %H:%M')
                files.append({'file': f, 'modified': mtime})
        return files

    def load(self, filename):
        """Load a cached scan result."""
        path = os.path.join(self._cache_dir, filename)
        with open(path) as f:
            return json.load(f)
