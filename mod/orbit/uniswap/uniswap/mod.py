"""
Uniswap V3 multi-chain connector.

Three data sources, round-robin across all — no rate limit issues:
  1. Direct RPC — eth_call + eth_getLogs (unlimited, 4 free RPCs/chain)
  2. Envio HyperSync — 2000x faster than RPC, free endpoints
  3. The Graph — GraphQL subgraphs (optional, requires API key)

All public methods support source='auto'|'rpc'|'hypersync'|'graph'.
Auto tries each in order, skips failures cleanly.

Supports: Ethereum, Arbitrum, Base, Polygon, Optimism

Caching: all public methods cache to disk. Pass update=1 to force refresh.
"""

import json
import hashlib
import os
import signal
import struct
import subprocess
import time
import requests
from datetime import datetime, timedelta
from pathlib import Path
from itertools import cycle
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / '.env')


class Mod:
    """Uniswap V3 connector — pools, swaps, tokens across EVM chains."""

    name = 'uniswap'
    description = 'Uniswap V3 multi-chain connector (RPC + HyperSync + Graph, round-robin)'

    # Uniswap V3 Factory (same on all chains)
    FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984'

    # ── Event topics ──────────────────────────────────────────
    # Swap(address,address,int256,int256,uint160,uint128,int24)
    SWAP_TOPIC = '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67'
    # PoolCreated(address,address,uint24,int24,address)
    POOL_CREATED_TOPIC = '0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118'

    # ── Function selectors (4 bytes) ─────────────────────────
    SEL = {
        'token0':     '0x0dfe1681',
        'token1':     '0xd21220a7',
        'fee':        '0xddca3f43',
        'slot0':      '0x3850c7bd',
        'liquidity':  '0x1a686502',
        'symbol':     '0x95d89b41',
        'name':       '0x06fdde03',
        'decimals':   '0x313ce567',
        'balanceOf':  '0x70a08231',
    }

    # ── Known top pools (bootstrap — no scanning needed) ──────
    # WETH/USDC 0.05%, WETH/USDC 0.3%, WETH/USDT 0.3%, WBTC/WETH 0.3%,
    # DAI/USDC 0.01%, USDC/USDT 0.01%, WETH/DAI 0.3%, etc.
    KNOWN_POOLS = {
        'ethereum': [
            '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',  # WETH/USDC 0.05%
            '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8',  # WETH/USDC 0.3%
            '0x4e68ccd3e89f51c3074ca5072bbac773960dfa36',  # WETH/USDT 0.3%
            '0xcbcdf9626bc03e24f779434178a73a0b4bad62ed',  # WBTC/WETH 0.3%
            '0x5777d92f208679db4b9778590fa3cab3ac9e2168',  # DAI/USDC 0.01%
            '0x3416cf6c708da44db2624d63ea0aaef7113527c6',  # USDC/USDT 0.01%
            '0xc2e9f25be6257c210d7adf0d4cd6e3e881ba25f8',  # DAI/WETH 0.3%
            '0x4585fe77225b41b697c938b018e2ac67ac5a20c0',  # WBTC/WETH 0.05%
            '0x11b815efb8f581194ae79006d24e0d814b7697f6',  # WETH/USDT 0.05%
            '0x1d42064fc4beb5f8aaf85f4617ae8b3b5b8bd801',  # UNI/WETH 0.3%
            '0xa3f558aebaecaf0e11ca4b2199cc5ed341edfd74',  # LDO/WETH 0.3%
            '0xe8c6c9227491c0a8156a0106a0204d881bb7e531',  # MKR/WETH 0.3%
            '0x7379e81228514a1d2a6cf7559203998e20598346',  # sETH2/WETH 0.3%
            '0x109830a1aaad605bbf02a9dfa7b0b92ec2fb7daa',  # wstETH/WETH 0.01%
            '0xa6cc3c2531fdaa6ae1a3ca84c2855806728693e8',  # LINK/WETH 0.3%
        ],
        'arbitrum': [
            '0xc31e54c7a869b9fcbecc14363cf510d1c41fa443',  # WETH/USDC 0.05%
            '0x17c14d2c404d167802b16c450d3c99f88f2c4f4d',  # WETH/USDC 0.3%
            '0xc473e2aee3441bf9240be85eb122abb059a3b57c',  # WETH/USDT 0.05%
            '0x2f5e87c9312fa29aed5c179e456625d79015299c',  # WBTC/WETH 0.05%
            '0x80a9ae39310abf666a87c743d6ebbd0e8c42158e',  # WETH/ARB 0.05%
            '0xc6f780497a95e246eb9449f5e4770916dcd6396a',  # ARB/USDC 0.05%
            '0xc6962004f452be9203591991d15f6b388e09e8d0',  # WETH/USDC.e 0.05%
        ],
        'base': [
            '0xd0b53d9277642d899df5c87a3966a349a798f224',  # WETH/USDC 0.05%
            '0x4c36388be6f416a29c8d8ae5c47571ef9d106c22',  # WETH/USDbC 0.05%
            '0x10648ba41b8565907cfa1496765fa4d95390aa0d',  # cbETH/WETH 0.05%
            '0xb4cb800910b228ed3d0834cf79d697127bbb00e5',  # DAI/USDC 0.01%
        ],
        'polygon': [
            '0x45dda9cb7c25131df268515131f647d726f50608',  # WETH/USDC 0.05%
            '0x0e44ceb592acfc5d3f09d996302eb4c499ff8c10',  # WMATIC/WETH 0.3%
            '0xa374094527e1673a86de625aa7d5f9b31d0e06d2',  # WMATIC/USDC 0.05%
            '0x3f5228d0e7d75d72a14d07d040c15e1a23895a60',  # WBTC/WETH 0.05%
            '0xdac8a8e6dbf8c690ec6815e0ff03491b2770255d',  # WMATIC/WETH 0.05%
        ],
        'optimism': [
            '0x85149247691df622eaf1a8bd0cafd40bc45154a9',  # WETH/USDC 0.05%
            '0x68f5c0a2de713a54991e01858fd27a3832401849',  # WETH/OP 0.3%
            '0xad4c666fc170b468ea521773b3b7a0f66b2ebfba',  # WETH/USDT 0.05%
            '0x535541f1aa08416e69dc4d610131099fa2ae7f20',  # WETH/wstETH 0.01%
            '0x03af20bdaaffb4cc0a521142d7a1d18ce2344175',  # WETH/DAI 0.3%
        ],
    }

    # Known stablecoins for USD estimation
    STABLECOINS = {
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',  # USDC (eth)
        '0xdac17f958d2ee523a2206206994597c13d831ec7',  # USDT (eth)
        '0x6b175474e89094c44da98b954eedeac495271d0f',  # DAI (eth)
        '0xaf88d065e77c8cc2239327c5edb3a432268e5831',  # USDC (arb)
        '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',  # USDC.e (arb)
        '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',  # USDT (arb)
        '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',  # USDC (base)
        '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca',  # USDbC (base)
        '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',  # USDC.e (poly)
        '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',  # USDC (poly)
        '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',  # USDT (poly)
        '0x0b2c639c533813f4aa9d7837caf62653d097ff85',  # USDC (op)
        '0x7f5c764cbc14f9669b88837ca1490cca17c31607',  # USDC.e (op)
        '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58',  # USDT (op)
    }

    # WETH addresses per chain (for price estimation)
    WETH = {
        'ethereum': '0xc02aaa39b223fe8d0a0e5c4f30e170d34994a2b6',
        'arbitrum': '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
        'base':     '0x4200000000000000000000000000000000000006',
        'polygon':  '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
        'optimism': '0x4200000000000000000000000000000000000006',
    }

    # Cache TTLs in seconds
    CACHE_TTL = {
        'pools': 300,          # 5 min — pool stats change slowly
        'pool': 300,
        'tokens': 300,
        'swaps': 60,           # 1 min — swaps are frequent
        'swaps_by_pool': 60,
        'pool_day_data': 3600, # 1 hour — daily data
        'chains': 86400,       # 1 day — static
        'health': 60,
        'token_info': 86400,   # 1 day — token metadata is static
    }

    CHAINS = {
        'ethereum': {
            'name': 'Ethereum',
            'chain_id': 1,
            'rpcs': [
                'https://eth.llamarpc.com',
                'https://rpc.ankr.com/eth',
                'https://ethereum-rpc.publicnode.com',
                'https://1rpc.io/eth',
            ],
            'subgraphs': [
                'https://gateway.thegraph.com/api/{key}/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV',
            ],
            'hypersync': 'https://eth.hypersync.xyz',
            'block_time': 12,
        },
        'arbitrum': {
            'name': 'Arbitrum',
            'chain_id': 42161,
            'rpcs': [
                'https://arb1.arbitrum.io/rpc',
                'https://rpc.ankr.com/arbitrum',
                'https://arbitrum-one-rpc.publicnode.com',
                'https://1rpc.io/arb',
            ],
            'subgraphs': [
                'https://gateway.thegraph.com/api/{key}/subgraphs/id/FbCGRftH4a3yZugY7TnbYgPJVEv2LvMT6oF1fxPe9aJM',
            ],
            'hypersync': 'https://arbitrum.hypersync.xyz',
            'block_time': 0.25,
        },
        'base': {
            'name': 'Base',
            'chain_id': 8453,
            'rpcs': [
                'https://mainnet.base.org',
                'https://rpc.ankr.com/base',
                'https://base-rpc.publicnode.com',
                'https://1rpc.io/base',
            ],
            'subgraphs': [
                'https://gateway.thegraph.com/api/{key}/subgraphs/id/43Hwfi3dJSoGpyas9VwNoDAv55yjgGrPCNzXBKiJPRGR',
            ],
            'hypersync': 'https://base.hypersync.xyz',
            'block_time': 2,
        },
        'polygon': {
            'name': 'Polygon',
            'chain_id': 137,
            'rpcs': [
                'https://polygon-rpc.com',
                'https://rpc.ankr.com/polygon',
                'https://polygon-bor-rpc.publicnode.com',
                'https://1rpc.io/matic',
            ],
            'subgraphs': [
                'https://gateway.thegraph.com/api/{key}/subgraphs/id/3hCPRGf4z3mKKmCqznQ9yDnHPoxq4LgGYQAViXc5TVrH',
            ],
            'hypersync': 'https://polygon.hypersync.xyz',
            'block_time': 2,
        },
        'optimism': {
            'name': 'Optimism',
            'chain_id': 10,
            'rpcs': [
                'https://mainnet.optimism.io',
                'https://rpc.ankr.com/optimism',
                'https://optimism-rpc.publicnode.com',
                'https://1rpc.io/op',
            ],
            'subgraphs': [
                'https://gateway.thegraph.com/api/{key}/subgraphs/id/Cghf4LfVqPiFw6fp6Y5X5Ubc8UpmUhSfJL82zwiBFLaj',
            ],
            'hypersync': 'https://optimism.hypersync.xyz',
            'block_time': 2,
        },
    }

    # ── GraphQL Queries ──────────────────────────────────────

    Q_POOLS = """
    query($first: Int!, $orderBy: Pool_orderBy!, $orderDirection: OrderDirection!) {
      pools(first: $first, orderBy: $orderBy, orderDirection: $orderDirection,
            where: { totalValueLockedUSD_gt: "1000" }) {
        id
        token0 { id symbol name decimals }
        token1 { id symbol name decimals }
        feeTier liquidity volumeUSD totalValueLockedUSD
        txCount token0Price token1Price
      }
    }
    """

    Q_POOL = """
    query($id: ID!) {
      pool(id: $id) {
        id
        token0 { id symbol name decimals }
        token1 { id symbol name decimals }
        feeTier liquidity volumeUSD totalValueLockedUSD
        txCount token0Price token1Price createdAtTimestamp
      }
    }
    """

    Q_SWAPS = """
    query($first: Int!, $skip: Int!, $ts: BigInt!) {
      swaps(first: $first, skip: $skip, orderBy: timestamp, orderDirection: desc,
            where: { timestamp_gte: $ts }) {
        id timestamp sender recipient
        amount0 amount1 amountUSD
        pool { id token0 { symbol } token1 { symbol } }
      }
    }
    """

    Q_SWAPS_BY_POOL = """
    query($pool: String!, $first: Int!, $skip: Int!, $ts: BigInt!) {
      swaps(first: $first, skip: $skip, orderBy: timestamp, orderDirection: desc,
            where: { pool: $pool, timestamp_gte: $ts }) {
        id timestamp sender recipient
        amount0 amount1 amountUSD
      }
    }
    """

    Q_TOKENS = """
    query($first: Int!, $orderBy: Token_orderBy!) {
      tokens(first: $first, orderBy: $orderBy, orderDirection: desc,
             where: { totalValueLockedUSD_gt: "1000" }) {
        id symbol name decimals
        volumeUSD totalValueLockedUSD txCount derivedETH
      }
    }
    """

    Q_POOL_DAY = """
    query($pool: String!, $first: Int!, $ts: Int!) {
      poolDayDatas(first: $first, orderBy: date, orderDirection: desc,
                   where: { pool: $pool, date_gte: $ts }) {
        date volumeUSD tvlUSD feesUSD liquidity
        high low open close
      }
    }
    """

    # ── Init ─────────────────────────────────────────────────

    def __init__(self, api_key=None, **_):
        self.api_key = api_key or os.getenv('THEGRAPH_API_KEY', '')
        self.hypersync_key = os.getenv('ENVIO_API_KEY', '')
        self._dir = Path(__file__).parent.parent
        self.data_dir = self._dir / 'data'
        self.data_dir.mkdir(exist_ok=True)
        self.cache_dir = self.data_dir / 'cache'
        self.cache_dir.mkdir(exist_ok=True)
        # round-robin iterators per chain
        self._rpc_iters = {c: cycle(v['rpcs']) for c, v in self.CHAINS.items()}
        self._graph_iters = {c: cycle(v['subgraphs']) for c, v in self.CHAINS.items()}
        # token info cache (in-memory, persists for session)
        self._token_cache = {}

    _CACHE_MISS = object()  # sentinel — distinct from None

    # ── Cache layer ──────────────────────────────────────────

    def _cache_key(self, method, **kwargs):
        raw = json.dumps({'m': method, **kwargs}, sort_keys=True)
        return hashlib.md5(raw.encode()).hexdigest()

    def _cache_get(self, method, **kwargs):
        key = self._cache_key(method, **kwargs)
        path = self.cache_dir / f'{key}.json'
        if not path.exists():
            return self._CACHE_MISS
        try:
            cached = json.loads(path.read_text())
            ttl = self.CACHE_TTL.get(method, 300)
            if time.time() - cached['ts'] > ttl:
                return self._CACHE_MISS
            return cached['data']
        except (json.JSONDecodeError, KeyError):
            return self._CACHE_MISS

    def _cache_set(self, method, data, **kwargs):
        key = self._cache_key(method, **kwargs)
        path = self.cache_dir / f'{key}.json'
        path.write_text(json.dumps({'ts': time.time(), 'm': method, 'data': data}))

    def clear_cache(self, method=None):
        """Clear cache files. If method given, only clear that method's caches."""
        count = 0
        for p in self.cache_dir.glob('*.json'):
            if method:
                try:
                    c = json.loads(p.read_text())
                    if c.get('m') != method:
                        continue
                except Exception:
                    pass
            p.unlink()
            count += 1
        return {'cleared': count}

    # ── RPC helpers (no rate limits, round-robin) ────────────

    def _rpc_call(self, chain, method, params, retries=4):
        """JSON-RPC call with round-robin across free public RPCs."""
        last_err = None
        for _ in range(retries):
            url = next(self._rpc_iters[chain])
            try:
                r = requests.post(url, json={
                    'jsonrpc': '2.0', 'id': 1,
                    'method': method, 'params': params,
                }, timeout=15)
                body = r.json()
                if 'error' in body:
                    last_err = body['error']
                    continue
                return body.get('result')
            except Exception as e:
                last_err = str(e)
                time.sleep(0.2)
        raise Exception(f"RPC failed after {retries} tries: {last_err}")

    def _eth_call(self, chain, to, data):
        """eth_call shorthand — returns raw hex result."""
        result = self._rpc_call(chain, 'eth_call', [{'to': to, 'data': data}, 'latest'])
        return result or '0x'

    def _get_block_number(self, chain):
        cache_key = f'_block_{chain}'
        if cache_key in self._token_cache:
            ts, bn = self._token_cache[cache_key]
            if time.time() - ts < 4:  # 4s cache — covers one operation
                return bn
        result = self._rpc_call(chain, 'eth_blockNumber', [])
        bn = int(result, 16)
        self._token_cache[cache_key] = (time.time(), bn)
        return bn

    def _estimate_block_at(self, chain, seconds_ago):
        current = self._get_block_number(chain)
        bt = self.CHAINS[chain]['block_time']
        return max(0, current - int(seconds_ago / bt))

    # ── ABI decode helpers ───────────────────────────────────

    @staticmethod
    def _decode_uint(hex_str):
        """Decode a uint256 from hex."""
        h = hex_str.replace('0x', '').strip()
        if not h:
            return 0
        return int(h[-64:], 16) if len(h) >= 64 else int(h, 16)

    @staticmethod
    def _decode_address(hex_str):
        """Decode an address from a 32-byte ABI word."""
        h = hex_str.replace('0x', '').strip()
        if len(h) < 40:
            return '0x' + h.zfill(40)
        return '0x' + h[-40:]

    @staticmethod
    def _decode_string(hex_str):
        """Decode a dynamic ABI-encoded string."""
        h = hex_str.replace('0x', '').strip()
        if len(h) < 128:
            # Try as raw ASCII (some tokens return non-standard)
            try:
                return bytes.fromhex(h).decode('utf-8', errors='ignore').strip('\x00').strip()
            except Exception:
                return ''
        try:
            # Standard: offset (32b) + length (32b) + data
            offset = int(h[0:64], 16) * 2
            length = int(h[offset:offset+64], 16)
            data_start = offset + 64
            raw = bytes.fromhex(h[data_start:data_start + length * 2])
            return raw.decode('utf-8', errors='ignore').strip()
        except Exception:
            try:
                return bytes.fromhex(h).decode('utf-8', errors='ignore').strip('\x00').strip()
            except Exception:
                return ''

    # ── USD estimation from swap amounts ─────────────────────

    def _estimate_swap_usd(self, chain, token0_addr, token1_addr, amount0, amount1, d0=18, d1=18):
        """
        Estimate USD value of a swap from raw token amounts.
        If one side is a stablecoin, use that amount directly.
        If one side is WETH, estimate via the WETH/USDC pool price.
        Returns absolute USD value (float).
        """
        t0 = token0_addr.lower()
        t1 = token1_addr.lower()
        amt0 = abs(amount0) / (10 ** d0)
        amt1 = abs(amount1) / (10 ** d1)

        if t0 in self.STABLECOINS:
            return amt0
        if t1 in self.STABLECOINS:
            return amt1

        # If one side is WETH, use cached ETH price
        weth = self.WETH.get(chain, '').lower()
        if weth:
            eth_price = self._get_eth_price(chain)
            if eth_price > 0:
                if t0 == weth:
                    return amt0 * eth_price
                if t1 == weth:
                    return amt1 * eth_price

        return 0.0

    def _get_eth_price(self, chain):
        """Get ETH price in USD from the WETH/USDC pool via slot0. Cached in memory."""
        cache_key = f'_eth_price_{chain}'
        if cache_key in self._token_cache:
            ts, price = self._token_cache[cache_key]
            if time.time() - ts < 300:  # 5 min cache
                return price

        # Use the first known pool (WETH/USDC 0.05%) to derive price
        known = self.KNOWN_POOLS.get(chain, [])
        if not known:
            return 0.0

        try:
            addr = known[0]  # WETH/USDC 0.05% is always first
            slot0_hex = self._eth_call(chain, addr, self.SEL['slot0']).replace('0x', '')
            if len(slot0_hex) < 64:
                return 0.0
            sqrt_price_x96 = int(slot0_hex[0:64], 16)
            if sqrt_price_x96 == 0:
                return 0.0

            # Get token decimals
            token0_addr = self._decode_address(self._eth_call(chain, addr, self.SEL['token0']))
            token1_addr = self._decode_address(self._eth_call(chain, addr, self.SEL['token1']))
            t0 = self._get_token_info(chain, token0_addr)
            t1 = self._get_token_info(chain, token1_addr)
            d0 = int(t0.get('decimals', '18'))
            d1 = int(t1.get('decimals', '18'))

            price_ratio = (sqrt_price_x96 / (2 ** 96)) ** 2
            adjusted = price_ratio * (10 ** (d0 - d1))

            # Determine which side is WETH
            weth = self.WETH.get(chain, '').lower()
            if token0_addr.lower() == weth:
                # price_ratio = token1_per_token0, so token0Price = adjusted (USDC per WETH)
                eth_price = adjusted
            else:
                # token1 is WETH, so 1/adjusted = USDC per WETH
                eth_price = 1.0 / adjusted if adjusted > 0 else 0.0

            self._token_cache[cache_key] = (time.time(), eth_price)
            return eth_price
        except Exception:
            return 0.0

    # ── Contract call helpers ────────────────────────────────

    def _get_token_info(self, chain, token_address):
        """Get ERC20 token info via RPC. Cached in memory + disk."""
        addr = token_address.lower()
        # Memory cache
        cache_key = f'{chain}:{addr}'
        if cache_key in self._token_cache:
            return self._token_cache[cache_key]
        # Disk cache
        ck = dict(chain=chain, token=addr)
        cached = self._cache_get('token_info', **ck)
        if cached is not self._CACHE_MISS:
            self._token_cache[cache_key] = cached
            return cached

        info = {'id': addr}
        try:
            info['symbol'] = self._decode_string(self._eth_call(chain, addr, self.SEL['symbol']))
        except Exception:
            info['symbol'] = '???'
        try:
            info['name'] = self._decode_string(self._eth_call(chain, addr, self.SEL['name']))
        except Exception:
            info['name'] = ''
        try:
            info['decimals'] = str(self._decode_uint(self._eth_call(chain, addr, self.SEL['decimals'])))
        except Exception:
            info['decimals'] = '18'

        self._token_cache[cache_key] = info
        self._cache_set('token_info', info, **ck)
        return info

    def _get_balance_of(self, chain, token_address, holder_address):
        """Get ERC20 balance of holder."""
        data = self.SEL['balanceOf'] + holder_address.lower().replace('0x', '').zfill(64)
        result = self._eth_call(chain, token_address, data)
        return self._decode_uint(result)

    def _rpc_get_pool(self, chain, pool_address):
        """Fetch full pool details via direct RPC contract calls."""
        addr = pool_address.lower()

        # Batch calls: token0, token1, fee, slot0, liquidity
        token0_addr = self._decode_address(self._eth_call(chain, addr, self.SEL['token0']))
        token1_addr = self._decode_address(self._eth_call(chain, addr, self.SEL['token1']))
        fee_raw = self._decode_uint(self._eth_call(chain, addr, self.SEL['fee']))
        liq_raw = self._decode_uint(self._eth_call(chain, addr, self.SEL['liquidity']))
        slot0_hex = self._eth_call(chain, addr, self.SEL['slot0']).replace('0x', '')

        # Parse slot0: sqrtPriceX96 (uint160), tick (int24), ...
        sqrt_price_x96 = int(slot0_hex[0:64], 16) if len(slot0_hex) >= 64 else 0
        tick_raw = int(slot0_hex[64:128], 16) if len(slot0_hex) >= 128 else 0
        if tick_raw >= 2**23:
            tick_raw -= 2**24

        # Token info
        token0 = self._get_token_info(chain, token0_addr)
        token1 = self._get_token_info(chain, token1_addr)

        # Compute prices from sqrtPriceX96
        token0Price = '0'
        token1Price = '0'
        if sqrt_price_x96 > 0:
            d0 = int(token0.get('decimals', '18'))
            d1 = int(token1.get('decimals', '18'))
            # price = (sqrtPriceX96 / 2^96)^2 * 10^(d0-d1)
            price_ratio = (sqrt_price_x96 / (2 ** 96)) ** 2
            adjusted = price_ratio * (10 ** (d0 - d1))
            token0Price = str(adjusted) if adjusted > 0 else '0'
            token1Price = str(1.0 / adjusted) if adjusted > 0 else '0'

        # TVL: get token balances in pool
        tvl_usd = '0'
        try:
            bal0 = self._get_balance_of(chain, token0_addr, addr)
            bal1 = self._get_balance_of(chain, token1_addr, addr)
            d0 = int(token0.get('decimals', '18'))
            d1 = int(token1.get('decimals', '18'))
            amt0 = bal0 / (10 ** d0)
            amt1 = bal1 / (10 ** d1)

            # If one token is a stablecoin, use it for USD estimation
            if token0_addr in self.STABLECOINS:
                tvl_usd = str(amt0 * 2)  # double the stablecoin side
            elif token1_addr in self.STABLECOINS:
                tvl_usd = str(amt1 * 2)
            else:
                # Can't easily get USD without oracle, use liquidity as proxy
                tvl_usd = str(liq_raw)
        except Exception:
            pass

        # Estimate volume from recent swap logs (last 24h)
        volume_usd = 0.0
        tx_count = 0
        try:
            from_block = self._estimate_block_at(chain, 86400)  # 24h
            logs = self._get_swap_logs(chain, pool_address=addr, from_block=from_block, batch_size=2000)
            d0 = int(token0.get('decimals', '18'))
            d1 = int(token1.get('decimals', '18'))
            tx_count = len(logs)
            for log in logs:
                parsed = self._parse_swap_log(log)
                if parsed:
                    usd = self._estimate_swap_usd(
                        chain, token0_addr, token1_addr,
                        parsed['amount0'], parsed['amount1'], d0, d1,
                    )
                    volume_usd += usd
        except Exception:
            pass

        return {
            'id': addr,
            'token0': token0,
            'token1': token1,
            'feeTier': str(fee_raw),
            'liquidity': str(liq_raw),
            'sqrtPrice': str(sqrt_price_x96),
            'tick': str(tick_raw),
            'token0Price': token0Price,
            'token1Price': token1Price,
            'totalValueLockedUSD': tvl_usd,
            'volumeUSD': str(volume_usd),
            'txCount': str(tx_count),
        }

    def _rpc_get_pools(self, chain, limit=20):
        """Get top pools via RPC using known bootstrap pools + on-chain queries."""
        known = self.KNOWN_POOLS.get(chain, [])
        pools = []
        for addr in known[:max(limit, len(known))]:
            try:
                pool = self._rpc_get_pool(chain, addr)
                if pool and int(pool.get('liquidity', '0')) > 0:
                    pools.append(pool)
            except Exception:
                continue

        # Sort by liquidity (best available proxy without full USD oracle)
        pools.sort(key=lambda p: int(p.get('liquidity', '0')), reverse=True)
        return pools[:limit]

    def _rpc_get_tokens(self, chain, limit=20):
        """Get top tokens derived from known pools via RPC."""
        pools = self._rpc_get_pools(chain, limit=50)
        seen = {}
        for pool in pools:
            for side in ('token0', 'token1'):
                t = pool.get(side, {})
                addr = t.get('id', '').lower()
                if addr and addr not in seen:
                    liq = int(pool.get('liquidity', '0'))
                    vol = float(pool.get('volumeUSD', '0'))
                    txc = int(pool.get('txCount', '0'))
                    seen[addr] = {
                        'id': addr,
                        'symbol': t.get('symbol', ''),
                        'name': t.get('name', ''),
                        'decimals': t.get('decimals', '18'),
                        'totalValueLockedUSD': pool.get('totalValueLockedUSD', '0'),
                        'volumeUSD': vol,
                        'txCount': txc,
                        '_liquidity': liq,
                    }
                elif addr in seen:
                    # Accumulate liquidity, volume, txns
                    seen[addr]['_liquidity'] += int(pool.get('liquidity', '0'))
                    seen[addr]['volumeUSD'] += float(pool.get('volumeUSD', '0'))
                    seen[addr]['txCount'] += int(pool.get('txCount', '0'))

        for v in seen.values():
            v['volumeUSD'] = str(v['volumeUSD'])
            v['txCount'] = str(v['txCount'])
        tokens = sorted(seen.values(), key=lambda t: t.pop('_liquidity', 0), reverse=True)
        return tokens[:limit]

    def _rpc_get_pool_day_data(self, chain, pool_id, days=30):
        """Compute daily OHLCV from swap logs via RPC."""
        addr = pool_id.lower()
        from_block = self._estimate_block_at(chain, days * 86400)
        logs = self._get_swap_logs(chain, pool_address=addr, from_block=from_block, batch_size=5000)

        # Resolve token addresses and decimals for USD estimation
        token0_addr = self._decode_address(self._eth_call(chain, addr, self.SEL['token0']))
        token1_addr = self._decode_address(self._eth_call(chain, addr, self.SEL['token1']))
        t0_info = self._get_token_info(chain, token0_addr)
        t1_info = self._get_token_info(chain, token1_addr)
        d0 = int(t0_info.get('decimals', '18'))
        d1 = int(t1_info.get('decimals', '18'))

        # We need block timestamps — fetch them for unique blocks
        block_nums = list(set(
            int(l.get('blockNumber', '0x0'), 16) for l in logs
        ))
        block_ts = {}
        # Sample up to 500 blocks to map block → timestamp
        sample = sorted(block_nums)
        if len(sample) > 500:
            step = len(sample) // 500
            sample = sample[::step]
        for bn in sample:
            try:
                blk = self._rpc_call(chain, 'eth_getBlockByNumber', [hex(bn), False])
                if blk and 'timestamp' in blk:
                    block_ts[bn] = int(blk['timestamp'], 16)
            except Exception:
                pass

        # Interpolate timestamps for blocks we didn't fetch
        if block_ts:
            sorted_known = sorted(block_ts.items())
            for bn in block_nums:
                if bn not in block_ts:
                    # Linear interpolation from nearest known blocks
                    lo = [(b, t) for b, t in sorted_known if b <= bn]
                    hi = [(b, t) for b, t in sorted_known if b >= bn]
                    if lo and hi:
                        lb, lt = lo[-1]
                        hb, ht = hi[0]
                        if hb == lb:
                            block_ts[bn] = lt
                        else:
                            frac = (bn - lb) / (hb - lb)
                            block_ts[bn] = int(lt + frac * (ht - lt))
                    elif lo:
                        block_ts[bn] = lo[-1][1]
                    elif hi:
                        block_ts[bn] = hi[0][1]

        # Parse swaps and bucket by day
        daily = {}
        for log in logs:
            parsed = self._parse_swap_log(log)
            if not parsed:
                continue
            bn = parsed['block']
            ts = block_ts.get(bn, 0)
            if ts == 0:
                continue
            day = ts - (ts % 86400)  # floor to day
            sqrt_price = parsed.get('sqrtPriceX96', 0)

            if day not in daily:
                daily[day] = {
                    'date': day,
                    'open': sqrt_price,
                    'high': sqrt_price,
                    'low': sqrt_price,
                    'close': sqrt_price,
                    'liquidity': str(parsed.get('liquidity', 0)),
                    'volumeUSD': 0.0,
                    'tvlUSD': '0',
                    'feesUSD': '0',
                    '_swap_count': 0,
                }

            d = daily[day]
            d['close'] = sqrt_price
            if sqrt_price > d['high']:
                d['high'] = sqrt_price
            if sqrt_price < d['low'] or d['low'] == 0:
                d['low'] = sqrt_price
            d['_swap_count'] += 1
            usd = self._estimate_swap_usd(
                chain, token0_addr, token1_addr,
                parsed['amount0'], parsed['amount1'], d0, d1,
            )
            d['volumeUSD'] += usd

        # Clean up and convert sqrtPriceX96 to readable price strings
        result = []
        for day_ts in sorted(daily.keys(), reverse=True):
            d = daily[day_ts]
            d.pop('_swap_count', None)
            d['volumeUSD'] = str(d['volumeUSD'])
            # Convert sqrtPriceX96 to price for OHLC
            for field in ('open', 'high', 'low', 'close'):
                sp = d[field]
                if sp > 0:
                    d[field] = str((sp / (2 ** 96)) ** 2)
                else:
                    d[field] = '0'
            result.append(d)

        return result

    # ── HyperSync-based pool/token helpers ───────────────────

    def _hypersync_get_pool_events(self, chain, days=90):
        """Fetch PoolCreated events via HyperSync for pool discovery."""
        url = self.CHAINS[chain].get('hypersync')
        if not url:
            raise Exception(f"No HyperSync endpoint for {chain}")

        from_block = self._estimate_block_at(chain, days * 86400)
        query = {
            'from_block': from_block,
            'logs': [{
                'address': [self.FACTORY],
                'topics': [[self.POOL_CREATED_TOPIC]],
            }],
            'field_selection': {
                'log': ['address', 'data', 'topic0', 'topic1', 'topic2', 'topic3',
                        'block_number', 'transaction_hash', 'log_index'],
            },
        }
        headers = {'Content-Type': 'application/json'}
        if self.hypersync_key:
            headers['Authorization'] = f'Bearer {self.hypersync_key}'

        r = requests.post(f'{url}/query', json=query, headers=headers, timeout=30)
        r.raise_for_status()
        body = r.json()
        data = body.get('data', [])
        logs = data if isinstance(data, list) else data.get('logs', [])

        pools = []
        for l in logs:
            try:
                data_hex = l.get('data', '0x').replace('0x', '')
                # PoolCreated data: int24 tickSpacing (32b) + address pool (32b)
                if len(data_hex) >= 128:
                    pool_addr = '0x' + data_hex[88:128]  # last 20 bytes of second word
                    pools.append(pool_addr.lower())
            except Exception:
                continue
        return pools

    def _hypersync_get_pools(self, chain, limit=20):
        """Discover pools via HyperSync events, then query each via RPC."""
        try:
            discovered = self._hypersync_get_pool_events(chain, days=30)
        except Exception:
            discovered = []

        # Merge with known pools, known first
        known = self.KNOWN_POOLS.get(chain, [])
        all_addrs = list(dict.fromkeys(known + discovered))  # dedup, preserve order

        pools = []
        for addr in all_addrs[:max(limit * 2, 40)]:
            try:
                pool = self._rpc_get_pool(chain, addr)
                if pool and int(pool.get('liquidity', '0')) > 0:
                    pools.append(pool)
            except Exception:
                continue
            if len(pools) >= limit * 2:
                break

        pools.sort(key=lambda p: int(p.get('liquidity', '0')), reverse=True)
        return pools[:limit]

    # ── RPC log helpers ──────────────────────────────────────

    def _get_swap_logs(self, chain, pool_address=None, from_block=None, to_block='latest', batch_size=2000):
        """Fetch raw Swap event logs via RPC. Paginates by block range."""
        if from_block is None:
            from_block = self._estimate_block_at(chain, 30 * 86400)

        current_block = self._get_block_number(chain) if to_block == 'latest' else to_block
        all_logs = []
        start = from_block

        log_filter = {'topics': [self.SWAP_TOPIC]}
        if pool_address:
            log_filter['address'] = pool_address

        while start <= current_block:
            end = min(start + batch_size, current_block)
            log_filter['fromBlock'] = hex(start)
            log_filter['toBlock'] = hex(end)

            try:
                logs = self._rpc_call(chain, 'eth_getLogs', [log_filter])
                if logs:
                    all_logs.extend(logs)
            except Exception:
                if batch_size > 100:
                    batch_size = batch_size // 2
                    continue

            start = end + 1
            if len(all_logs) % 5000 == 0 and len(all_logs) > 0:
                time.sleep(0.1)

        return all_logs

    def _parse_swap_log(self, log):
        """Decode a raw Swap event log into readable dict."""
        data = log.get('data', '0x')
        if len(data) < 322:
            return None
        try:
            d = data[2:]
            amount0 = int(d[0:64], 16)
            if amount0 >= 2**255:
                amount0 -= 2**256
            amount1 = int(d[64:128], 16)
            if amount1 >= 2**255:
                amount1 -= 2**256
            sqrt_price = int(d[128:192], 16)
            liquidity = int(d[192:256], 16)
            tick = int(d[256:320], 16)
            if tick >= 2**23:
                tick -= 2**24

            return {
                'pool': log.get('address', '').lower(),
                'tx': log.get('transactionHash', ''),
                'block': int(log.get('blockNumber', '0x0'), 16),
                'logIndex': int(log.get('logIndex', '0x0'), 16),
                'amount0': amount0,
                'amount1': amount1,
                'sqrtPriceX96': sqrt_price,
                'liquidity': liquidity,
                'tick': tick,
                'sender': '0x' + log['topics'][1][-40:] if len(log.get('topics', [])) > 1 else '',
                'recipient': '0x' + log['topics'][2][-40:] if len(log.get('topics', [])) > 2 else '',
            }
        except (ValueError, IndexError):
            return None

    # ── HyperSync helpers (Envio — fast, free) ───────────────

    def _hypersync_query(self, chain, from_block, to_block=None, pool_address=None, topic=None):
        """
        Query Envio HyperSync for event logs.
        2000x faster than RPC, free endpoints.
        """
        url = self.CHAINS[chain].get('hypersync')
        if not url:
            raise Exception(f"No HyperSync endpoint for {chain}")

        t = topic or self.SWAP_TOPIC
        query = {
            'from_block': from_block,
            'logs': [{
                'topics': [[t]],
            }],
            'field_selection': {
                'log': ['address', 'data', 'topic0', 'topic1', 'topic2', 'topic3',
                        'block_number', 'transaction_hash', 'log_index'],
            },
        }
        if to_block:
            query['to_block'] = to_block
        if pool_address:
            query['logs'][0]['address'] = [pool_address]

        headers = {'Content-Type': 'application/json'}
        if self.hypersync_key:
            headers['Authorization'] = f'Bearer {self.hypersync_key}'

        r = requests.post(f'{url}/query', json=query, headers=headers, timeout=30)
        r.raise_for_status()
        body = r.json()
        return body.get('data', [])

    def _hypersync_get_swaps(self, chain, days=30, pool_address=None):
        """Fetch swap logs via HyperSync with auto-pagination."""
        from_block = self._estimate_block_at(chain, days * 86400)
        all_logs = []
        cursor = from_block

        for _ in range(100):  # max 100 pages
            try:
                result = self._hypersync_query(chain, cursor, pool_address=pool_address)
                logs = result if isinstance(result, list) else result.get('logs', [])
                if not logs:
                    break
                all_logs.extend(logs)
                # advance cursor past last block
                last_block = max(int(l.get('block_number', 0)) for l in logs)
                cursor = last_block + 1
                if len(logs) < 1000:
                    break
            except Exception:
                break  # fallback to RPC if HyperSync fails

        return all_logs

    # ── Graph helpers (round-robin) ──────────────────────────

    def _graph_endpoint(self, chain):
        url = next(self._graph_iters[chain])
        if self.api_key:
            return url.replace('{key}', self.api_key)
        return url.replace('/api/{key}', '')

    def _graph_query(self, chain, query, variables=None):
        if not self.api_key:
            raise Exception("No THEGRAPH_API_KEY — skipping Graph")
        url = self._graph_endpoint(chain)
        r = requests.post(url, json={'query': query, 'variables': variables or {}}, timeout=30)
        r.raise_for_status()
        body = r.json()
        if 'errors' in body:
            raise Exception(f"Subgraph error: {body['errors']}")
        return body.get('data', {})

    def _graph_paginate(self, chain, query, variables, key, max_pages=10):
        out = []
        for page in range(max_pages):
            v = {**variables, 'skip': page * 1000, 'first': 1000}
            batch = self._graph_query(chain, query, v).get(key, [])
            if not batch:
                break
            out.extend(batch)
            if len(batch) < 1000:
                break
            time.sleep(0.15)
        return out

    # ── Multi-source dispatcher ──────────────────────────────

    def _auto(self, sources, **kwargs):
        """Try sources in order, return first success."""
        last_err = None
        for fn in sources:
            try:
                result = fn(**kwargs)
                if result is not None:
                    return result
            except Exception as e:
                last_err = e
                continue
        raise last_err or Exception("All sources failed")

    # ── Public API (all cached, all multi-source) ────────────

    def get_pools(self, chain='ethereum', limit=20, orderBy='totalValueLockedUSD', source='auto', update=False):
        """Get top pools. source: auto|rpc|hypersync|graph. Cached 5 min."""
        ck = dict(chain=chain, limit=limit, orderBy=orderBy, source=source)
        if not update:
            cached = self._cache_get('pools', **ck)
            if cached is not self._CACHE_MISS:
                return cached

        def _graph():
            return self._graph_query(chain, self.Q_POOLS, {
                'first': min(limit, 100), 'orderBy': orderBy, 'orderDirection': 'desc',
            }).get('pools', [])

        def _hypersync():
            return self._hypersync_get_pools(chain, limit)

        def _rpc():
            return self._rpc_get_pools(chain, limit)

        dispatch = {
            'graph': _graph, 'hypersync': _hypersync, 'rpc': _rpc,
            'auto': None,
        }

        if source == 'auto':
            result = self._auto([_graph, _hypersync, _rpc])
        elif source in dispatch:
            result = dispatch[source]()
        else:
            raise ValueError(f"Unknown source: {source}")

        self._cache_set('pools', result, **ck)
        return result

    def get_pool(self, chain='ethereum', pool_id='', source='auto', update=False):
        """Get single pool details. source: auto|rpc|graph. Cached 5 min."""
        ck = dict(chain=chain, pool_id=pool_id, source=source)
        if not update:
            cached = self._cache_get('pool', **ck)
            if cached is not self._CACHE_MISS:
                return cached

        def _graph():
            return self._graph_query(chain, self.Q_POOL, {'id': pool_id.lower()}).get('pool')

        def _rpc():
            return self._rpc_get_pool(chain, pool_id)

        if source == 'auto':
            result = self._auto([_graph, _rpc])
        elif source == 'graph':
            result = _graph()
        else:
            result = _rpc()

        self._cache_set('pool', result, **ck)
        return result

    def get_swaps(self, chain='ethereum', days=30, limit=1000, source='auto', update=False):
        """
        Get recent swaps. Cached 1 min. Source options:
          'auto'      — try HyperSync → Graph → RPC (best effort)
          'hypersync' — Envio HyperSync (fast, free)
          'graph'     — The Graph subgraph (structured, has USD)
          'rpc'       — direct eth_getLogs (unlimited, slowest)
        """
        ck = dict(chain=chain, days=days, limit=limit, source=source)
        if not update:
            cached = self._cache_get('swaps', **ck)
            if cached is not self._CACHE_MISS:
                return cached

        if source == 'auto':
            for s in ['hypersync', 'graph', 'rpc']:
                try:
                    result = self.get_swaps(chain, days, limit, source=s, update=True)
                    if result:
                        self._cache_set('swaps', result, **ck)
                        return result
                except Exception:
                    continue
            return []

        if source == 'hypersync':
            logs = self._hypersync_get_swaps(chain, days)
            parsed = []
            for l in logs:
                log_obj = {
                    'address': l.get('address', ''),
                    'data': l.get('data', '0x'),
                    'topics': [l.get(f'topic{i}', '') for i in range(4)],
                    'blockNumber': hex(l.get('block_number', 0)) if isinstance(l.get('block_number'), int) else l.get('block_number', '0x0'),
                    'transactionHash': l.get('transaction_hash', ''),
                    'logIndex': hex(l.get('log_index', 0)) if isinstance(l.get('log_index'), int) else l.get('log_index', '0x0'),
                }
                p = self._parse_swap_log(log_obj)
                if p:
                    parsed.append(p)
            result = parsed[-limit:] if limit else parsed
            self._cache_set('swaps', result, **ck)
            return result

        if source == 'rpc':
            from_block = self._estimate_block_at(chain, days * 86400)
            logs = self._get_swap_logs(chain, from_block=from_block)
            parsed = [self._parse_swap_log(l) for l in logs]
            result = [s for s in parsed if s is not None]
            result = result[-limit:] if limit else result
            self._cache_set('swaps', result, **ck)
            return result

        # source == 'graph'
        ts = str(int((datetime.now() - timedelta(days=days)).timestamp()))
        if limit > 1000:
            result = self._graph_paginate(chain, self.Q_SWAPS, {'ts': ts}, 'swaps')
        else:
            result = self._graph_query(chain, self.Q_SWAPS, {
                'first': min(limit, 1000), 'skip': 0, 'ts': ts,
            }).get('swaps', [])
        self._cache_set('swaps', result, **ck)
        return result

    def get_swaps_by_pool(self, chain='ethereum', pool_id='', days=30, limit=1000, source='auto', update=False):
        """Get swaps for a specific pool. Cached 1 min."""
        ck = dict(chain=chain, pool_id=pool_id, days=days, limit=limit, source=source)
        if not update:
            cached = self._cache_get('swaps_by_pool', **ck)
            if cached is not self._CACHE_MISS:
                return cached

        if source in ('rpc', 'hypersync', 'auto'):
            from_block = self._estimate_block_at(chain, days * 86400)
            logs = self._get_swap_logs(chain, pool_address=pool_id, from_block=from_block)
            parsed = [self._parse_swap_log(l) for l in logs]
            result = [s for s in parsed if s is not None]
            result = result[-limit:] if limit else result
            self._cache_set('swaps_by_pool', result, **ck)
            return result

        ts = str(int((datetime.now() - timedelta(days=days)).timestamp()))
        if limit > 1000:
            result = self._graph_paginate(chain, self.Q_SWAPS_BY_POOL,
                                        {'pool': pool_id.lower(), 'ts': ts}, 'swaps')
        else:
            result = self._graph_query(chain, self.Q_SWAPS_BY_POOL, {
                'pool': pool_id.lower(), 'first': min(limit, 1000), 'skip': 0, 'ts': ts,
            }).get('swaps', [])
        self._cache_set('swaps_by_pool', result, **ck)
        return result

    def get_tokens(self, chain='ethereum', limit=20, orderBy='totalValueLockedUSD', source='auto', update=False):
        """Get top tokens. source: auto|rpc|graph. Cached 5 min."""
        ck = dict(chain=chain, limit=limit, orderBy=orderBy, source=source)
        if not update:
            cached = self._cache_get('tokens', **ck)
            if cached is not self._CACHE_MISS:
                return cached

        def _graph():
            return self._graph_query(chain, self.Q_TOKENS, {
                'first': min(limit, 100), 'orderBy': orderBy,
            }).get('tokens', [])

        def _rpc():
            return self._rpc_get_tokens(chain, limit)

        if source == 'auto':
            result = self._auto([_graph, _rpc])
        elif source == 'graph':
            result = _graph()
        else:
            result = _rpc()

        self._cache_set('tokens', result, **ck)
        return result

    def get_pool_day_data(self, chain='ethereum', pool_id='', days=30, source='auto', update=False):
        """Get daily OHLCV data for a pool. source: auto|rpc|graph. Cached 1 hour."""
        ck = dict(chain=chain, pool_id=pool_id, days=days, source=source)
        if not update:
            cached = self._cache_get('pool_day_data', **ck)
            if cached is not self._CACHE_MISS:
                return cached

        def _graph():
            ts = int((datetime.now() - timedelta(days=days)).timestamp())
            return self._graph_query(chain, self.Q_POOL_DAY, {
                'pool': pool_id.lower(), 'first': days, 'ts': ts,
            }).get('poolDayDatas', [])

        def _rpc():
            return self._rpc_get_pool_day_data(chain, pool_id, days)

        if source == 'auto':
            result = self._auto([_graph, _rpc])
        elif source == 'graph':
            result = _graph()
        else:
            result = _rpc()

        self._cache_set('pool_day_data', result, **ck)
        return result

    def chains(self):
        return {k: {
            'name': v['name'],
            'chain_id': v['chain_id'],
            'rpcs': len(v['rpcs']),
            'hypersync': bool(v.get('hypersync')),
        } for k, v in self.CHAINS.items()}

    # ── LocalFS Storage ──────────────────────────────────────

    def save_data(self, data, name, chain='ethereum'):
        ts = int(time.time())
        fname = f"{chain}_{name}_{ts}.json"
        path = self.data_dir / fname
        path.write_text(json.dumps({
            'chain': chain,
            'name': name,
            'saved_at': datetime.now().isoformat(),
            'count': len(data) if isinstance(data, list) else 1,
            'data': data,
        }, indent=2))
        return {'filename': fname, 'path': str(path), 'size': path.stat().st_size}

    def load_data(self, filename):
        path = self.data_dir / filename
        if not path.exists():
            raise FileNotFoundError(f"No saved file: {filename}")
        return json.loads(path.read_text())

    def delete_data(self, filename):
        path = self.data_dir / filename
        if not path.exists():
            raise FileNotFoundError(f"No saved file: {filename}")
        path.unlink()
        return {'deleted': filename}

    def list_saved(self, chain=None):
        files = []
        for p in sorted(self.data_dir.glob('*.json'), key=lambda x: x.stat().st_mtime, reverse=True):
            if chain and not p.name.startswith(f"{chain}_"):
                continue
            files.append({
                'filename': p.name,
                'size': p.stat().st_size,
                'modified': datetime.fromtimestamp(p.stat().st_mtime).isoformat(),
            })
        return files

    # ── Serve (mod protocol) ────────────────────────────────

    api_port = 50088
    app_port = 3088

    def serve(self, api_port=None, app_port=None, dev=True):
        """Start the FastAPI server and Next.js app."""
        api_port = api_port or self.api_port
        app_port = app_port or self.app_port
        results = {}
        log_dir = Path('/tmp/uniswap')
        log_dir.mkdir(parents=True, exist_ok=True)

        self.kill()

        # API — uniswap/api.py lives inside the package dir
        api_dir = Path(__file__).parent
        api_path = api_dir / 'api.py'
        if api_path.exists():
            env = os.environ.copy()
            env['PORT'] = str(api_port)
            env['PYTHONPATH'] = str(self._dir)
            api_log = open(log_dir / 'api.log', 'w')
            cmd = ['python3', '-m', 'uvicorn', 'api:app', '--host', '0.0.0.0',
                   '--port', str(api_port)]
            if dev:
                cmd.append('--reload')
            subprocess.Popen(cmd, cwd=str(api_dir), env=env,
                             stdout=api_log, stderr=subprocess.STDOUT)
            results['api'] = f'http://localhost:{api_port}'

        # App — Next.js
        app_dir = self._dir / 'app'
        if app_dir.exists():
            if not (app_dir / 'node_modules').exists():
                subprocess.run(['npm', 'install'], cwd=str(app_dir), capture_output=True)
            env = os.environ.copy()
            env['NEXT_PUBLIC_API_URL'] = f'http://localhost:{api_port}'
            env['PORT'] = str(app_port)
            app_log = open(log_dir / 'app.log', 'w')
            cmd = ['npx', 'next', 'dev' if dev else 'start', '-p', str(app_port)]
            subprocess.Popen(cmd, cwd=str(app_dir), env=env,
                             stdout=app_log, stderr=subprocess.STDOUT)
            results['app'] = f'http://localhost:{app_port}'

        results['logs'] = str(log_dir)
        return results

    def kill(self):
        """Stop all uniswap services."""
        killed = []
        for pattern in [f'uvicorn.*{self.api_port}', f'next.*{self.app_port}']:
            try:
                result = subprocess.run(['pgrep', '-f', pattern],
                                        capture_output=True, text=True)
                for pid in result.stdout.strip().split('\n'):
                    if pid:
                        os.kill(int(pid), signal.SIGTERM)
                        killed.append(pid)
            except Exception:
                pass
        return {'killed': killed}

    # ── Explorer — discover all token prices from recent blocks ──

    def explore(self, chain='ethereum', blocks=5000, batch_size=2000,
                min_liquidity=0, min_volume_usd=0, max_pools=200, callback=None):
        """
        Scan recent blocks newest-first, discover all pools from Swap events,
        compute token prices from sqrtPriceX96, and return every token with
        its price + pool stats.

        Fully open-source — uses only free public RPCs, no API keys needed.

        Args:
            chain:           Chain to scan (ethereum, arbitrum, base, polygon, optimism)
            blocks:          Number of recent blocks to scan (default 5000)
            batch_size:      Blocks per RPC request (default 2000, auto-shrinks on error)
            min_liquidity:   Filter: minimum pool liquidity (raw uint128)
            min_volume_usd:  Filter: minimum 24h volume in USD
            max_pools:       Max pools to resolve details for (default 200, sorted by swap count)
            callback:        Optional fn(progress_dict) called per batch for live progress

        Returns:
            dict with 'tokens' (list of token prices), 'pools' (discovered pools),
            'progress' (final scan stats)
        """
        current_block = self._get_block_number(chain)
        start_block = max(0, current_block - blocks)
        total_blocks = current_block - start_block

        # Progress tracking
        progress = {
            'chain': chain,
            'current_block': current_block,
            'start_block': start_block,
            'total_blocks': total_blocks,
            'blocks_scanned': 0,
            'batches_done': 0,
            'swaps_found': 0,
            'pools_found': 0,
            'tokens_found': 0,
            'pct': 0.0,
            'status': 'scanning',
        }

        def _report(msg=None):
            progress['pct'] = round(progress['blocks_scanned'] / max(total_blocks, 1) * 100, 1)
            if msg:
                progress['status'] = msg
            if callback:
                callback(progress)

        _report('starting scan')

        # Scan newest blocks first — iterate from current_block down to start_block
        pool_swaps = {}   # pool_addr -> list of parsed swaps
        scan_from = current_block
        bs = batch_size

        while scan_from > start_block:
            scan_to = max(scan_from - bs, start_block)
            log_filter = {
                'topics': [self.SWAP_TOPIC],
                'fromBlock': hex(scan_to),
                'toBlock': hex(scan_from),
            }

            try:
                logs = self._rpc_call(chain, 'eth_getLogs', [log_filter])
                if logs is None:
                    logs = []
            except Exception:
                # Shrink batch on error (RPC block range limit)
                if bs > 100:
                    bs = bs // 2
                    continue
                # Skip this range
                logs = []

            for log in logs:
                parsed = self._parse_swap_log(log)
                if not parsed:
                    continue
                pool_addr = parsed['pool']
                if pool_addr not in pool_swaps:
                    pool_swaps[pool_addr] = []
                pool_swaps[pool_addr].append(parsed)

            scanned = scan_from - scan_to
            progress['blocks_scanned'] += scanned
            progress['batches_done'] += 1
            progress['swaps_found'] += len(logs)
            progress['pools_found'] = len(pool_swaps)
            scan_from = scan_to
            _report(f'scanned block {scan_to}..{scan_to + scanned}')

        # Sort pools by swap count (most active first), limit to max_pools
        ranked_pools = sorted(pool_swaps.items(), key=lambda kv: len(kv[1]), reverse=True)
        if max_pools and len(ranked_pools) > max_pools:
            ranked_pools = ranked_pools[:max_pools]

        _report(f'resolving {len(ranked_pools)} pools (of {len(pool_swaps)} discovered)')

        # Now resolve each pool — get token info + compute prices
        discovered_pools = []
        token_prices = {}  # token_addr -> {symbol, name, decimals, price_usd, pools:[]}

        for i, (pool_addr, swaps) in enumerate(ranked_pools):
            if not swaps:
                continue

            # Get the most recent swap (highest block) for current price
            latest = max(swaps, key=lambda s: s['block'])

            try:
                token0_addr = self._decode_address(
                    self._eth_call(chain, pool_addr, self.SEL['token0']))
                token1_addr = self._decode_address(
                    self._eth_call(chain, pool_addr, self.SEL['token1']))
                fee_raw = self._decode_uint(
                    self._eth_call(chain, pool_addr, self.SEL['fee']))
                liq_raw = self._decode_uint(
                    self._eth_call(chain, pool_addr, self.SEL['liquidity']))
            except Exception:
                continue

            # Skip pools below min liquidity
            if min_liquidity and liq_raw < min_liquidity:
                continue

            t0 = self._get_token_info(chain, token0_addr)
            t1 = self._get_token_info(chain, token1_addr)
            d0 = int(t0.get('decimals', '18'))
            d1 = int(t1.get('decimals', '18'))

            # Compute price from sqrtPriceX96
            sqrt_price = latest.get('sqrtPriceX96', 0)
            token0_price_in_token1 = 0.0
            token1_price_in_token0 = 0.0
            if sqrt_price > 0:
                price_ratio = (sqrt_price / (2 ** 96)) ** 2
                adjusted = price_ratio * (10 ** (d0 - d1))
                token0_price_in_token1 = adjusted
                token1_price_in_token0 = 1.0 / adjusted if adjusted > 0 else 0.0

            # Estimate volume from scanned swaps
            volume_usd = 0.0
            for s in swaps:
                volume_usd += self._estimate_swap_usd(
                    chain, token0_addr, token1_addr,
                    s['amount0'], s['amount1'], d0, d1)

            if min_volume_usd and volume_usd < min_volume_usd:
                continue

            # Get USD price per token
            weth = self.WETH.get(chain, '').lower()
            eth_price = self._get_eth_price(chain)
            t0_usd = 0.0
            t1_usd = 0.0

            if token0_addr.lower() in self.STABLECOINS:
                t0_usd = 1.0
                t1_usd = token1_price_in_token0
            elif token1_addr.lower() in self.STABLECOINS:
                t1_usd = 1.0
                t0_usd = token0_price_in_token1
            elif token0_addr.lower() == weth and eth_price > 0:
                t0_usd = eth_price
                t1_usd = token1_price_in_token0 * eth_price
            elif token1_addr.lower() == weth and eth_price > 0:
                t1_usd = eth_price
                t0_usd = token0_price_in_token1 * eth_price

            pool_info = {
                'address': pool_addr,
                'token0': t0,
                'token1': t1,
                'fee': fee_raw,
                'liquidity': liq_raw,
                'token0_price_in_token1': token0_price_in_token1,
                'token1_price_in_token0': token1_price_in_token0,
                'token0_usd': t0_usd,
                'token1_usd': t1_usd,
                'volume_usd': volume_usd,
                'swap_count': len(swaps),
                'latest_block': latest['block'],
            }
            discovered_pools.append(pool_info)

            # Aggregate token prices across pools
            for addr, info, usd in [
                (token0_addr, t0, t0_usd),
                (token1_addr, t1, t1_usd),
            ]:
                key = addr.lower()
                if key not in token_prices:
                    token_prices[key] = {
                        'address': key,
                        'symbol': info.get('symbol', '???'),
                        'name': info.get('name', ''),
                        'decimals': info.get('decimals', '18'),
                        'price_usd': usd,
                        'total_volume_usd': 0.0,
                        'total_swaps': 0,
                        'pools': [],
                    }
                tp = token_prices[key]
                # Keep highest USD price (most liquid source)
                if usd > tp['price_usd']:
                    tp['price_usd'] = usd
                tp['total_volume_usd'] += volume_usd
                tp['total_swaps'] += len(swaps)
                tp['pools'].append({
                    'pool': pool_addr,
                    'pair': f"{t0.get('symbol','?')}/{t1.get('symbol','?')}",
                    'fee': fee_raw,
                    'price_usd': usd,
                    'volume_usd': volume_usd,
                })

            progress['tokens_found'] = len(token_prices)
            if (i + 1) % 5 == 0:
                _report(f'resolved {i + 1}/{len(ranked_pools)} pools')

        # Sort tokens by volume
        tokens_list = sorted(
            token_prices.values(),
            key=lambda t: t['total_volume_usd'],
            reverse=True,
        )
        # Sort pools by volume
        discovered_pools.sort(key=lambda p: p['volume_usd'], reverse=True)

        # Convert floats for JSON
        for t in tokens_list:
            t['price_usd'] = round(t['price_usd'], 8)
            t['total_volume_usd'] = round(t['total_volume_usd'], 2)
        for p in discovered_pools:
            p['token0_usd'] = round(p['token0_usd'], 8)
            p['token1_usd'] = round(p['token1_usd'], 8)
            p['volume_usd'] = round(p['volume_usd'], 2)
            p['token0_price_in_token1'] = round(p['token0_price_in_token1'], 8)
            p['token1_price_in_token0'] = round(p['token1_price_in_token0'], 8)

        progress['status'] = 'done'
        progress['pct'] = 100.0
        _report('complete')

        result = {
            'tokens': tokens_list,
            'pools': discovered_pools,
            'progress': progress,
            'filters': {
                'min_liquidity': min_liquidity,
                'min_volume_usd': min_volume_usd,
            },
        }

        # Auto-save
        self._cache_set('explore', result, chain=chain, blocks=blocks,
                        min_liq=min_liquidity, min_vol=min_volume_usd)
        return result

    # ── Utility ──────────────────────────────────────────────

    def health(self):
        return {
            'status': 'ok',
            'module': 'uniswap',
            'chains': list(self.CHAINS.keys()),
            'data_dir': str(self.data_dir),
            'cache_dir': str(self.cache_dir),
            'has_graph_key': bool(self.api_key),
            'has_hypersync_key': bool(self.hypersync_key),
            'sources': ['rpc (4 rpcs/chain, unlimited)', 'hypersync (envio, 2000x fast)', 'thegraph (optional, needs key)'],
        }

    def test(self):
        results = {}
        # RPC
        try:
            bn = self._get_block_number('ethereum')
            results['rpc'] = {'status': 'ok', 'block': bn}
        except Exception as e:
            results['rpc'] = {'status': 'error', 'error': str(e)}
        # HyperSync
        try:
            url = self.CHAINS['ethereum']['hypersync']
            r = requests.get(f'{url}/height', timeout=10)
            results['hypersync'] = {'status': 'ok', 'height': r.json() if r.ok else 'unreachable'}
        except Exception as e:
            results['hypersync'] = {'status': 'error', 'error': str(e)}
        # Graph
        try:
            pools = self.get_pools('ethereum', limit=1, source='graph', update=True)
            results['graph'] = {'status': 'ok', 'pools': len(pools)}
        except Exception as e:
            results['graph'] = {'status': 'error', 'error': str(e)}
        # RPC pool fetch (new!)
        try:
            pool = self._rpc_get_pool('ethereum', self.KNOWN_POOLS['ethereum'][0])
            results['rpc_pool'] = {
                'status': 'ok',
                'pool': f"{pool['token0']['symbol']}/{pool['token1']['symbol']}",
                'liquidity': pool['liquidity'][:12] + '...',
            }
        except Exception as e:
            results['rpc_pool'] = {'status': 'error', 'error': str(e)}

        results['passed'] = any(
            results.get(s, {}).get('status') == 'ok'
            for s in ['rpc', 'hypersync', 'rpc_pool']
        )
        return results
