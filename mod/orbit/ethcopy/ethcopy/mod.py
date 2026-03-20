import time
import json
import os
import requests
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

STABLES = {'USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'LUSD', 'USDD', 'GUSD', 'USDP', 'USDbC'}
WETH_SYMBOLS = {'WETH', 'WBTC', 'WMATIC', 'WBNB'}

SWAP_TOPICS = {
    'v2': '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822',
    'v3': '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67',
}

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


def _rpc_call(url, method, params, timeout=15):
    resp = requests.post(url, json={
        'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params
    }, timeout=timeout)
    data = resp.json()
    if 'error' in data:
        raise Exception(data['error'].get('message', str(data['error'])))
    return data.get('result')


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
    t0 = swap['token0']['symbol']
    t1 = swap['token1']['symbol']
    a0 = float(swap['amount0'])
    usd = abs(float(swap['amountUSD']))

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
            pos = positions[bought_addr]
            pos['cost_usd'] += usd
            pos['amount'] += 1
        elif is_sell and not is_buy:
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
                realized_pnl += usd
                wins += 1

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


def _utcnow():
    return datetime.now(timezone.utc)


def _ts(epoch):
    return datetime.fromtimestamp(epoch, tz=timezone.utc)


class Mod:
    description = """
    Multi-chain DEX trader scanner with Rust-powered core.
    Finds profitable traders across Base, Polygon, Arbitrum, Ethereum.
    Watch wallets, track scores, scan chains with RPC failover.
    Rust engine for async RPC polling, scoring, and event processing.
    """

    DEFAULT_CONFIG = {
        'chains': [
            {
                'chain_id': 8453, 'name': 'base', 'enabled': True,
                'subgraph': 'https://api.thegraph.com/subgraphs/name/messari/uniswap-v3-base',
                'explorer': 'https://api.basescan.org/api',
                'explorer_key_env': 'BASESCAN_API_KEY',
                'rpc_urls': [
                    'https://mainnet.base.org',
                    'https://base.llamarpc.com',
                    'https://base-rpc.publicnode.com',
                    'https://base.drpc.org',
                    'https://rpc.ankr.com/base',
                ],
                'routers': [
                    {'address': '0x2626664c2603336E57B271c5C0b26F421741e481', 'name': 'Uniswap V3', 'type': 'v3'},
                    {'address': '0x6BDED42c6DA8FBf0d2bA55B2fa120C5e0c8D7891', 'name': 'SushiSwap', 'type': 'v2'},
                ],
            },
            {
                'chain_id': 137, 'name': 'polygon', 'enabled': True,
                'subgraph': 'https://api.thegraph.com/subgraphs/name/messari/uniswap-v3-polygon',
                'explorer': 'https://api.polygonscan.com/api',
                'explorer_key_env': 'POLYGONSCAN_API_KEY',
                'rpc_urls': [
                    'https://polygon-rpc.com',
                    'https://polygon.llamarpc.com',
                    'https://polygon-bor-rpc.publicnode.com',
                    'https://polygon.drpc.org',
                    'https://rpc.ankr.com/polygon',
                ],
                'routers': [
                    {'address': '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', 'name': 'Uniswap V3', 'type': 'v3'},
                    {'address': '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', 'name': 'SushiSwap', 'type': 'v2'},
                    {'address': '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', 'name': 'QuickSwap', 'type': 'v2'},
                ],
            },
            {
                'chain_id': 42161, 'name': 'arbitrum', 'enabled': True,
                'subgraph': 'https://api.thegraph.com/subgraphs/name/messari/uniswap-v3-arbitrum',
                'explorer': 'https://api.arbiscan.io/api',
                'explorer_key_env': 'ARBISCAN_API_KEY',
                'rpc_urls': [
                    'https://arb1.arbitrum.io/rpc',
                    'https://arbitrum.llamarpc.com',
                    'https://arbitrum-one-rpc.publicnode.com',
                    'https://arbitrum.drpc.org',
                    'https://rpc.ankr.com/arbitrum',
                ],
                'routers': [
                    {'address': '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', 'name': 'Uniswap V3', 'type': 'v3'},
                    {'address': '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', 'name': 'SushiSwap', 'type': 'v2'},
                    {'address': '0xc873fEcbd354f5A56E00E710B90EF4201db2448d', 'name': 'Camelot', 'type': 'v2'},
                ],
            },
            {
                'chain_id': 1, 'name': 'ethereum', 'enabled': True,
                'subgraph': 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
                'explorer': 'https://api.etherscan.io/api',
                'explorer_key_env': 'ETHERSCAN_API_KEY',
                'rpc_urls': [
                    'https://eth.llamarpc.com',
                    'https://ethereum-rpc.publicnode.com',
                    'https://eth.drpc.org',
                    'https://rpc.ankr.com/eth',
                    'https://rpc.flashbots.net',
                ],
                'routers': [
                    {'address': '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', 'name': 'Uniswap V3', 'type': 'v3'},
                    {'address': '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F', 'name': 'SushiSwap', 'type': 'v2'},
                ],
            },
        ],
        'wallets': [],
        'scores': {},
        'max_trade_usd': 100,
        'slippage_bps': 50,
        'daily_limit_usd': 1000,
        'min_score': 70.0,
        'min_trades': 5,
        'min_profit_pct': 10,
        'poll_interval_ms': 4000,
    }

    def __init__(self, config_path=None, graph_api_key=None, **kwargs):
        self.dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.config_path = config_path or os.path.join(self.dir, 'config.json')
        self.config = self._load_config()
        self.config.update({k: v for k, v in kwargs.items() if v is not None})
        self.graph_api_key = graph_api_key or os.environ.get('GRAPH_API_KEY', '')
        self._cache_dir = os.path.join(self.dir, '.cache')
        os.makedirs(self._cache_dir, exist_ok=True)
        self._rpc_stats = defaultdict(lambda: {'ok': 0, 'err': 0, 'last_latency': 0})
        # Rust engine (lazy init)
        self.engine = None

    def _load_config(self):
        if os.path.exists(self.config_path):
            with open(self.config_path, 'r') as f:
                saved = json.load(f)
            cfg = dict(self.DEFAULT_CONFIG)
            cfg.update(saved)
            return cfg
        return dict(self.DEFAULT_CONFIG)

    def _save_config(self):
        with open(self.config_path, 'w') as f:
            json.dump(self.config, f, indent=2)

    def _chain_by_name(self, name):
        name = name.lower()
        for c in self.config['chains']:
            if c['name'] == name:
                return c
        return None

    def _enabled_chains(self):
        return [c for c in self.config['chains'] if c.get('enabled', True)]

    def _get_subgraph_url(self, chain_cfg):
        url = chain_cfg['subgraph']
        if self.graph_api_key and 'api.thegraph.com' in url:
            url = url.replace('api.thegraph.com', f'gateway.thegraph.com/api/{self.graph_api_key}')
        return url

    def _get_explorer_key(self, chain_cfg):
        return os.environ.get(chain_cfg.get('explorer_key_env', ''), '')

    def _rpc(self, chain_cfg, method, params):
        urls = chain_cfg.get('rpc_urls', [])
        if not urls:
            raise Exception(f"No RPC URLs for {chain_cfg['name']}")
        last_err = None
        for url in urls:
            try:
                t0 = time.time()
                result = _rpc_call(url, method, params)
                latency = int((time.time() - t0) * 1000)
                self._rpc_stats[url]['ok'] += 1
                self._rpc_stats[url]['last_latency'] = latency
                return result
            except Exception as e:
                self._rpc_stats[url]['err'] += 1
                last_err = e
                continue
        raise last_err

    # === Rust engine ===

    def _ensure_engine(self):
        if self.engine is None:
            try:
                import ethcopy_rs
                self.engine = ethcopy_rs.EthcopyEngine(json.dumps(self.config))
            except ImportError:
                raise RuntimeError(
                    "ethcopy_rs not built. Run:\n"
                    f"  cd {os.path.join(self.dir, 'ethcopy-rs')}\n"
                    "  maturin develop --release"
                )

    def _has_engine(self):
        if self.engine is not None:
            return True
        try:
            import ethcopy_rs
            return True
        except ImportError:
            return False

    # === CLI dispatch ===

    def forward(self, cmd='status', **kwargs):
        commands = {
            'scan': self.scan,
            'top': self.top,
            'analyze': self.analyze,
            'watch': self.watch,
            'unwatch': self.unwatch,
            'wallets': self.list_wallets,
            'scores': self.scores,
            'refresh': self.refresh_scores,
            'status': self.status,
            'config': self.show_config,
            'set': self.set_config,
            'cached': self.cached,
            'load': self.load,
            'rpc': self.rpc_stats,
            'poll': self.poll_swaps,
            'start': self.start,
            'stop': self.stop,
            'events': self.events,
            'build': self.build,
        }
        fn = commands.get(cmd, self.status)
        return fn(**kwargs)

    # === Engine lifecycle ===

    def start(self, **kwargs):
        """Start the Rust scanning engine (continuous polling)."""
        self._ensure_engine()
        self.engine.start()
        self._save_config()
        return {
            'status': 'running',
            'chains': [c['name'] for c in self._enabled_chains()],
            'poll_interval_ms': self.config['poll_interval_ms'],
        }

    def stop(self, **kwargs):
        """Stop the engine."""
        if self.engine:
            self.engine.stop()
        return {'status': 'stopped'}

    def build(self, **kwargs):
        """Build the Rust bindings."""
        rs_dir = os.path.join(self.dir, 'ethcopy-rs')
        if not os.path.exists(rs_dir):
            return {'error': f'Rust crate not found at {rs_dir}'}
        ret = os.system(f'cd {rs_dir} && maturin develop --release')
        if ret == 0:
            return {'status': 'built', 'path': rs_dir}
        return {'status': 'build_failed', 'exit_code': ret}

    # === Status / Config ===

    def status(self, **kwargs):
        running = False
        if self.engine:
            try:
                running = self.engine.is_running()
            except Exception:
                pass
        return {
            'engine': 'rust' if self._has_engine() else 'python',
            'running': running,
            'chains': [
                {'name': c['name'], 'chain_id': c['chain_id'], 'enabled': c.get('enabled', True),
                 'rpcs': len(c.get('rpc_urls', [])), 'routers': len(c.get('routers', []))}
                for c in self.config['chains']
            ],
            'wallets': len(self.config['wallets']),
            'scored': len(self.config.get('scores', {})),
            'limits': {
                'max_trade_usd': self.config['max_trade_usd'],
                'slippage_bps': self.config['slippage_bps'],
                'daily_limit_usd': self.config['daily_limit_usd'],
            },
        }

    def show_config(self, **kwargs):
        return self.config

    def set_config(self, key=None, value=None, **kwargs):
        if not key:
            return {'error': 'key required', 'keys': [k for k in self.DEFAULT_CONFIG if k not in ('chains', 'wallets', 'scores')]}
        if key in ('max_trade_usd', 'daily_limit_usd', 'min_score', 'min_profit_pct'):
            value = float(value)
        elif key in ('slippage_bps', 'poll_interval_ms', 'min_trades'):
            value = int(value)
        self.config[key] = value
        self._save_config()
        return {'set': key, 'value': value}

    def rpc_stats(self, **kwargs):
        """RPC stats — uses Rust engine if available, else Python tracking."""
        if self.engine:
            return json.loads(self.engine.get_rpc_stats())
        stats = {}
        for url, s in self._rpc_stats.items():
            total = s['ok'] + s['err']
            stats[url] = {
                'requests': total,
                'success_rate': round(s['ok'] / total, 3) if total > 0 else 0,
                'last_latency_ms': s['last_latency'],
            }
        return stats

    # === Wallet Watch List ===

    def watch(self, address=None, label=None, **kwargs):
        if not address:
            return {'error': 'address required'}
        address = address.lower()
        wallets = self.config['wallets']
        existing = [w for w in wallets if (w if isinstance(w, str) else w.get('address', '')) == address]
        if not existing:
            wallets.append({'address': address, 'label': label or address[:10]})
            self._save_config()
        return {'watched': address, 'label': label, 'total': len(wallets)}

    def unwatch(self, address=None, **kwargs):
        if not address:
            return {'error': 'address required'}
        address = address.lower()
        before = len(self.config['wallets'])
        self.config['wallets'] = [
            w for w in self.config['wallets']
            if (w if isinstance(w, str) else w.get('address', '')) != address
        ]
        self._save_config()
        self.config.get('scores', {}).pop(address, None)
        return {'unwatched': address, 'removed': before - len(self.config['wallets'])}

    def list_wallets(self, **kwargs):
        scores = self.config.get('scores', {})
        result = []
        for w in self.config['wallets']:
            addr = w if isinstance(w, str) else w.get('address', '')
            label = w.get('label', addr[:10]) if isinstance(w, dict) else addr[:10]
            score = scores.get(addr, {})
            result.append({
                'address': addr,
                'label': label,
                'pnl_usd': score.get('pnl_usd', 0),
                'win_rate': score.get('win_rate', 0),
                'trade_count': score.get('trade_count', 0),
                'last_scored': score.get('scored_at', 'never'),
            })
        return result

    # === Scoring ===

    def scores(self, **kwargs):
        """Get trader scores — Rust engine scores if running, else config cache."""
        if self.engine:
            try:
                return json.loads(self.engine.get_scores())
            except Exception:
                pass
        return self.config.get('scores', {})

    def refresh_scores(self, days=7, **kwargs):
        """Refresh scores for all watched wallets via subgraph."""
        wallets = self.config['wallets']
        if not wallets:
            return {'error': 'no wallets watched'}

        scores = self.config.get('scores', {})
        print(f"Scoring {len(wallets)} wallets...")

        for w in wallets:
            addr = w if isinstance(w, str) else w.get('address', '')
            label = w.get('label', addr[:10]) if isinstance(w, dict) else addr[:10]

            all_swaps = []
            for chain_cfg in self._enabled_chains():
                url = self._get_subgraph_url(chain_cfg)
                since = int((_utcnow() - timedelta(days=days)).timestamp())
                raw = _paginate_swaps(url, SWAPS_BY_ORIGIN_QUERY, {
                    'origin': addr, 'timestamp_gte': str(since)
                }, max_pages=10)
                all_swaps.extend([_classify_swap(s) for s in raw])
                time.sleep(0.2)

            if not all_swaps:
                scores[addr] = {'pnl_usd': 0, 'win_rate': 0, 'trade_count': 0, 'scored_at': _utcnow().strftime('%Y-%m-%d %H:%M')}
                continue

            pnl = _compute_pnl(all_swaps)
            volume = sum(s['usd'] for s in all_swaps)
            scores[addr] = {
                'pnl_usd': pnl['pnl_usd'],
                'pnl_pct': round((pnl['pnl_usd'] / volume * 100) if volume > 0 else 0, 2),
                'win_rate': pnl['win_rate'],
                'wins': pnl['wins'],
                'losses': pnl['losses'],
                'trade_count': pnl['trade_count'],
                'volume_usd': round(volume, 2),
                'tokens': pnl['tokens_traded'][:10],
                'scored_at': _utcnow().strftime('%Y-%m-%d %H:%M'),
            }
            print(f"  {label}: ${pnl['pnl_usd']:,.2f} PnL, {pnl['win_rate']*100:.0f}% win, {pnl['trade_count']} trades")

        self.config['scores'] = scores
        self._save_config()
        return scores

    # === Polling — Rust fast path or Python fallback ===

    def poll_swaps(self, chain='base', blocks=100, **kwargs):
        """Poll swap events. Uses Rust engine if available, else Python RPC."""
        if self._has_engine():
            try:
                self._ensure_engine()
                return json.loads(self.engine.poll(chain, int(blocks)))
            except Exception as e:
                print(f"Rust poll failed, falling back to Python: {e}")

        # Python fallback
        chain_cfg = self._chain_by_name(chain)
        if not chain_cfg:
            return {'error': f'unknown chain: {chain}'}

        latest_hex = self._rpc(chain_cfg, 'eth_blockNumber', [])
        latest = int(latest_hex, 16)
        from_block = max(latest - int(blocks), 0)

        print(f"Polling {chain} blocks {from_block}-{latest}...")

        all_events = []
        for version, topic in SWAP_TOPICS.items():
            logs = self._rpc(chain_cfg, 'eth_getLogs', [{
                'fromBlock': hex(from_block),
                'toBlock': hex(latest),
                'topics': [topic],
            }])
            for log in (logs or []):
                all_events.append({
                    'version': version,
                    'address': log.get('address', ''),
                    'tx': log.get('transactionHash', ''),
                    'block': int(log.get('blockNumber', '0x0'), 16),
                })

        print(f"  Found {len(all_events)} swap events ({blocks} blocks)")
        return {
            'chain': chain,
            'from_block': from_block,
            'to_block': latest,
            'events': all_events[:200],
            'total': len(all_events),
        }

    def poll_all(self, blocks=100, **kwargs):
        """Poll all enabled chains. Rust engine does this in parallel."""
        if self._has_engine():
            try:
                self._ensure_engine()
                return json.loads(self.engine.poll_all(int(blocks)))
            except Exception as e:
                print(f"Rust poll_all failed, falling back to Python: {e}")

        results = []
        for c in self._enabled_chains():
            results.append(self.poll_swaps(chain=c['name'], blocks=blocks))
        return results

    def events(self, limit=50, **kwargs):
        """Get recent swap events from Rust engine."""
        if not self.engine:
            return {'error': 'engine not running, use start() first'}
        return json.loads(self.engine.get_events(int(limit)))

    # === Subgraph-based scanning (Python, unchanged) ===

    def _fetch_recent_swaps(self, chain_cfg, days, max_pages=10):
        url = self._get_subgraph_url(chain_cfg)
        since = int((_utcnow() - timedelta(days=days)).timestamp())
        return _paginate_swaps(url, SWAPS_QUERY, {'timestamp_gte': str(since)}, max_pages)

    def _fetch_trader_swaps(self, address, chain_cfg, days, max_pages=20):
        url = self._get_subgraph_url(chain_cfg)
        since = int((_utcnow() - timedelta(days=days)).timestamp())
        return _paginate_swaps(
            url, SWAPS_BY_ORIGIN_QUERY,
            {'origin': address.lower(), 'timestamp_gte': str(since)},
            max_pages
        )

    def _fetch_explorer_txns(self, address, chain_cfg, days):
        api_key = self._get_explorer_key(chain_cfg)
        if not api_key:
            return []
        since = int((_utcnow() - timedelta(days=days)).timestamp())
        params = {
            'module': 'account', 'action': 'tokentx',
            'address': address, 'startblock': 0, 'endblock': 99999999,
            'sort': 'desc', 'apikey': api_key,
        }
        try:
            resp = requests.get(chain_cfg['explorer'], params=params, timeout=30)
            data = resp.json()
            if data.get('status') != '1':
                return []
            return [tx for tx in data.get('result', []) if int(tx.get('timeStamp', 0)) >= since]
        except Exception as e:
            print(f"Explorer API error ({chain_cfg['name']}): {e}")
            return []

    def scan(self, days=30, chains=None, min_trades=None, min_profit_pct=None, limit=50, max_pages=5, **kwargs):
        """Scan for profitable traders across chains (subgraph + parallel)."""
        min_trades = min_trades or self.config.get('min_trades', 5)
        min_profit_pct = min_profit_pct or self.config.get('min_profit_pct', 10)

        if chains:
            chain_cfgs = [c for c in self.config['chains'] if c['name'] in chains]
        else:
            chain_cfgs = self._enabled_chains()

        print(f"Scanning {len(chain_cfgs)} chains over {days} days...")

        all_traders = defaultdict(lambda: {'chains': set(), 'swap_count': 0})

        def fetch_chain(cfg):
            name = cfg['name']
            print(f"  Fetching swaps from {name}...")
            swaps = self._fetch_recent_swaps(cfg, days, max_pages)
            print(f"    Got {len(swaps)} swaps from {name}")
            return name, swaps

        with ThreadPoolExecutor(max_workers=len(chain_cfgs)) as pool:
            futures = {pool.submit(fetch_chain, cfg): cfg for cfg in chain_cfgs}
            for future in as_completed(futures):
                chain_name, raw_swaps = future.result()
                for swap in raw_swaps:
                    origin = swap['origin'].lower()
                    all_traders[origin]['chains'].add(chain_name)
                    all_traders[origin]['swap_count'] += 1

        active = {
            addr: info for addr, info in all_traders.items()
            if info['swap_count'] >= min_trades
        }
        print(f"  Found {len(active)} traders with >= {min_trades} swaps")

        sorted_by_activity = sorted(active.items(), key=lambda x: x[1]['swap_count'], reverse=True)
        candidates = sorted_by_activity[:200]

        chain_map = {c['name']: c for c in chain_cfgs}
        results = []
        for i, (addr, info) in enumerate(candidates):
            if i % 20 == 0 and i > 0:
                print(f"  Analyzed {i}/{len(candidates)} traders...")
                time.sleep(1)

            trader_swaps = []
            for chain_name in info['chains']:
                cfg = chain_map.get(chain_name)
                if not cfg:
                    continue
                raw = self._fetch_trader_swaps(addr, cfg, days)
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
                'first_trade': _ts(min(s['timestamp'] for s in trader_swaps)).strftime('%Y-%m-%d'),
                'last_trade': _ts(max(s['timestamp'] for s in trader_swaps)).strftime('%Y-%m-%d'),
            })

        results.sort(key=lambda x: x['pnl_usd'], reverse=True)
        results = results[:limit]

        print(f"\nTop {len(results)} profitable traders:")
        for i, r in enumerate(results[:10]):
            print(f"  {i+1}. {r['address'][:10]}... PnL: ${r['pnl_usd']:,.2f} ({r['pnl_pct']}%) "
                  f"Win: {r['win_rate']*100:.0f}% Trades: {r['trade_count']} Vol: ${r['volume_usd']:,.0f}")

        ts = _utcnow().strftime('%Y%m%d_%H%M')
        cache_file = os.path.join(self._cache_dir, f"scan_{days}d_{ts}.json")
        with open(cache_file, 'w') as f:
            json.dump(results, f, indent=2)

        return results

    def analyze(self, address=None, days=30, chain='ethereum', **kwargs):
        if not address:
            return {'error': 'address required'}

        chain_cfg = self._chain_by_name(chain)
        if not chain_cfg:
            return {'error': f'unknown chain: {chain}'}

        print(f"Analyzing {address[:10]}... on {chain} ({days} days)")

        raw = self._fetch_trader_swaps(address, chain_cfg, days)
        if not raw:
            return {'error': 'No swaps found', 'address': address, 'chain': chain}

        swaps = [_classify_swap(s) for s in raw]
        pnl = _compute_pnl(swaps)
        total_volume = sum(s['usd'] for s in swaps)

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
                'buys': len(buys), 'sells': len(sells),
                'buy_volume': round(sum(s['usd'] for s in buys), 2),
                'sell_volume': round(sum(s['usd'] for s in sells), 2),
            }

        explorer_txns = self._fetch_explorer_txns(address, chain_cfg, days)
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
            'first_trade': _ts(min(timestamps)).strftime('%Y-%m-%d %H:%M'),
            'last_trade': _ts(max(timestamps)).strftime('%Y-%m-%d %H:%M'),
            'explorer_txns_found': len(explorer_txns),
            'recent_swaps': [
                {
                    'time': _ts(s['timestamp']).strftime('%Y-%m-%d %H:%M'),
                    'bought': s['bought'], 'sold': s['sold'], 'usd': s['usd'],
                }
                for s in sorted(swaps, key=lambda x: x['timestamp'], reverse=True)[:20]
            ],
        }

        print(f"  PnL: ${result['pnl_usd']:,.2f} ({result['pnl_pct']}%)")
        print(f"  Win rate: {result['win_rate']*100:.0f}% ({result['wins']}W / {result['losses']}L)")
        print(f"  Volume: ${result['volume_usd']:,.0f} across {len(result['tokens_traded'])} tokens")

        return result

    def top(self, days=30, chain='base', limit=20, max_pages=5, **kwargs):
        return self.scan(days=days, chains=[chain], limit=limit, max_pages=max_pages)

    def cached(self, **kwargs):
        files = []
        for f in os.listdir(self._cache_dir):
            if f.endswith('.json'):
                path = os.path.join(self._cache_dir, f)
                mtime = datetime.fromtimestamp(os.path.getmtime(path)).strftime('%Y-%m-%d %H:%M')
                size = os.path.getsize(path)
                files.append({'file': f, 'modified': mtime, 'size_kb': round(size / 1024, 1)})
        return files

    def load(self, filename=None, **kwargs):
        if not filename:
            return {'error': 'filename required', 'available': self.cached()}
        path = os.path.join(self._cache_dir, filename)
        with open(path) as f:
            return json.load(f)

    def __repr__(self):
        chains = [c['name'] for c in self._enabled_chains()]
        wallets = len(self.config['wallets'])
        engine = 'rust' if self._has_engine() else 'python'
        return f"<Ethcopy chains={chains} wallets={wallets} engine={engine}>"
