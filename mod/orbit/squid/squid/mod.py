"""
Subsquid / SQD Network connector.

Query on-chain data (logs, transactions, traces) via Subsquid archives.
Free, no API key required. Supports all major EVM chains.

Data sources:
  1. Subsquid Archives — bulk historical data (logs, txs, traces)
  2. Subsquid Network Gateway — decentralized query layer

Supports: Ethereum, Arbitrum, Base, Polygon, Optimism, BSC
"""

import json
import os
import time
import hashlib
import requests
from pathlib import Path
from datetime import datetime, timedelta


class Mod:
    """Subsquid archive connector — logs, transactions, traces across EVM chains."""

    name = 'squid'
    description = 'Subsquid multi-chain connector — query logs, txs, traces from free archives'

    # ── Archive endpoints (v2 worker URLs) ─────────────────────
    ARCHIVES = {
        'ethereum': {
            'name': 'Ethereum',
            'chain_id': 1,
            'archive': 'https://v2.archive.subsquid.io/network/ethereum-mainnet',
            'gateway': 'https://portal.sqd.dev/datasets/ethereum-mainnet',
        },
        'arbitrum': {
            'name': 'Arbitrum',
            'chain_id': 42161,
            'archive': 'https://v2.archive.subsquid.io/network/arbitrum-one',
            'gateway': 'https://portal.sqd.dev/datasets/arbitrum',
        },
        'base': {
            'name': 'Base',
            'chain_id': 8453,
            'archive': 'https://v2.archive.subsquid.io/network/base-mainnet',
            'gateway': 'https://portal.sqd.dev/datasets/base-mainnet',
        },
        'polygon': {
            'name': 'Polygon',
            'chain_id': 137,
            'archive': 'https://v2.archive.subsquid.io/network/polygon-mainnet',
            'gateway': 'https://portal.sqd.dev/datasets/polygon-mainnet',
        },
        'optimism': {
            'name': 'Optimism',
            'chain_id': 10,
            'archive': 'https://v2.archive.subsquid.io/network/optimism-mainnet',
            'gateway': 'https://portal.sqd.dev/datasets/optimism-mainnet',
        },
        'bsc': {
            'name': 'BSC',
            'chain_id': 56,
            'archive': 'https://v2.archive.subsquid.io/network/binance-mainnet',
            'gateway': 'https://portal.sqd.dev/datasets/bsc-mainnet',
        },
    }

    # Common event topics
    TOPICS = {
        'transfer': '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
        'approval': '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
        'swap':     '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67',
        'sync':     '0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1',
    }

    CACHE_TTL = {
        'logs': 60,
        'txs': 60,
        'height': 30,
        'traces': 120,
    }

    def __init__(self, cache_dir=None):
        self.cache_dir = Path(cache_dir or Path.home() / '.squid' / 'cache')
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json', 'Accept': 'application/json'})

    # ── Public API ─────────────────────────────────────────────

    def forward(self, chain='ethereum', address=None, topic=None, from_block=0, to_block=None, limit=100, **kwargs):
        """Query event logs from Subsquid archives.

        Args:
            chain: Chain name (ethereum, arbitrum, base, polygon, optimism, bsc)
            address: Contract address to filter (optional)
            topic: Event topic0 to filter — name or hex (optional)
            from_block: Start block (default 0)
            to_block: End block (default latest)
            limit: Max results (default 100)
        """
        return self.logs(chain=chain, address=address, topic=topic,
                         from_block=from_block, to_block=to_block, limit=limit, **kwargs)

    def logs(self, chain='ethereum', address=None, topic=None, from_block=0, to_block=None, limit=100, update=False):
        """Fetch event logs from archive.

        Returns list of log dicts with: address, topics, data, blockNumber, transactionHash, logIndex.
        """
        chain_cfg = self._chain(chain)
        if to_block is None:
            to_block = self.height(chain)

        # Resolve named topics
        if topic and not topic.startswith('0x'):
            topic = self.TOPICS.get(topic, topic)

        query = {
            'fromBlock': from_block,
            'toBlock': to_block,
            'logs': [{}],
            'fields': {
                'log': {
                    'address': True,
                    'topics': True,
                    'data': True,
                    'transactionHash': True,
                    'logIndex': True,
                }
            }
        }

        log_filter = query['logs'][0]
        if address:
            log_filter['address'] = [address.lower()]
        if topic:
            log_filter['topic0'] = [topic]

        cache_key = self._cache_key('logs', chain, address, topic, from_block, to_block, limit)
        cached = self._cache_get(cache_key, 'logs')
        if cached and not update:
            return cached

        results = self._query_archive(chain_cfg, query, limit)
        logs = []
        for block in results:
            bn = block.get('header', {}).get('number', 0)
            for log in block.get('logs', []):
                log['blockNumber'] = bn
                logs.append(log)
                if len(logs) >= limit:
                    break
            if len(logs) >= limit:
                break

        self._cache_set(cache_key, logs)
        return logs

    def txs(self, chain='ethereum', address=None, from_block=0, to_block=None, limit=100, update=False):
        """Fetch transactions involving an address.

        Args:
            address: Address to filter by (from or to)
            from_block/to_block: Block range
            limit: Max results

        Returns list of tx dicts with: hash, from, to, value, input, blockNumber, gasUsed.
        """
        chain_cfg = self._chain(chain)
        if to_block is None:
            to_block = self.height(chain)

        query = {
            'fromBlock': from_block,
            'toBlock': to_block,
            'transactions': [{}],
            'fields': {
                'transaction': {
                    'hash': True,
                    'from': True,
                    'to': True,
                    'value': True,
                    'input': True,
                    'gasUsed': True,
                    'status': True,
                }
            }
        }

        if address:
            query['transactions'] = [
                {'to': [address.lower()]},
                {'from': [address.lower()]},
            ]

        cache_key = self._cache_key('txs', chain, address, from_block, to_block, limit)
        cached = self._cache_get(cache_key, 'txs')
        if cached and not update:
            return cached

        results = self._query_archive(chain_cfg, query, limit)
        txs = []
        for block in results:
            bn = block.get('header', {}).get('number', 0)
            for tx in block.get('transactions', []):
                tx['blockNumber'] = bn
                txs.append(tx)
                if len(txs) >= limit:
                    break
            if len(txs) >= limit:
                break

        self._cache_set(cache_key, txs)
        return txs

    def traces(self, chain='ethereum', address=None, from_block=0, to_block=None, limit=100, update=False):
        """Fetch internal call traces for an address.

        Returns list of trace dicts with: type, from, to, value, input, output, blockNumber.
        """
        chain_cfg = self._chain(chain)
        if to_block is None:
            to_block = self.height(chain)

        query = {
            'fromBlock': from_block,
            'toBlock': to_block,
            'traces': [{}],
            'fields': {
                'trace': {
                    'type': True,
                    'callFrom': True,
                    'callTo': True,
                    'callValue': True,
                    'callInput': True,
                    'callOutput': True,
                    'callGas': True,
                }
            }
        }

        if address:
            query['traces'] = [
                {'callTo': [address.lower()]},
                {'callFrom': [address.lower()]},
            ]

        cache_key = self._cache_key('traces', chain, address, from_block, to_block, limit)
        cached = self._cache_get(cache_key, 'traces')
        if cached and not update:
            return cached

        results = self._query_archive(chain_cfg, query, limit)
        traces = []
        for block in results:
            bn = block.get('header', {}).get('number', 0)
            for trace in block.get('traces', []):
                trace['blockNumber'] = bn
                traces.append(trace)
                if len(traces) >= limit:
                    break
            if len(traces) >= limit:
                break

        self._cache_set(cache_key, traces)
        return traces

    def height(self, chain='ethereum', update=False):
        """Get the latest indexed block height for a chain."""
        chain_cfg = self._chain(chain)
        cache_key = f'height_{chain}'
        cached = self._cache_get(cache_key, 'height')
        if cached and not update:
            return cached

        url = f"{chain_cfg['archive']}/height"
        resp = self.session.get(url, timeout=10)
        resp.raise_for_status()
        h = int(resp.text.strip())
        self._cache_set(cache_key, h)
        return h

    def transfers(self, chain='ethereum', token=None, from_block=0, to_block=None, limit=100, update=False):
        """Fetch ERC-20 Transfer events. Convenience wrapper around logs().

        Args:
            token: Token contract address (optional — all transfers if omitted)
        """
        return self.logs(
            chain=chain,
            address=token,
            topic=self.TOPICS['transfer'],
            from_block=from_block,
            to_block=to_block,
            limit=limit,
            update=update,
        )

    def chains(self):
        """List all supported chains and their archive status."""
        out = {}
        for name, cfg in self.ARCHIVES.items():
            try:
                h = self.height(name)
                out[name] = {'chain_id': cfg['chain_id'], 'height': h, 'status': 'ok'}
            except Exception as e:
                out[name] = {'chain_id': cfg['chain_id'], 'height': None, 'status': str(e)}
        return out

    def health(self):
        """Check archive health across all chains."""
        return self.chains()

    # ── Internal ───────────────────────────────────────────────

    def _chain(self, chain):
        chain = chain.lower()
        if chain not in self.ARCHIVES:
            raise ValueError(f"Unknown chain '{chain}'. Supported: {list(self.ARCHIVES.keys())}")
        return self.ARCHIVES[chain]

    def _query_archive(self, chain_cfg, query, limit):
        """Stream blocks from Subsquid archive using the worker API."""
        url = chain_cfg['archive']
        all_blocks = []
        count = 0

        # Get worker URL
        worker_url = self._get_worker(url, query['fromBlock'])
        resp = self.session.post(worker_url, json=query, timeout=30)
        resp.raise_for_status()
        blocks = resp.json()

        for block in blocks:
            all_blocks.append(block)
            n_items = (len(block.get('logs', [])) +
                       len(block.get('transactions', [])) +
                       len(block.get('traces', [])))
            count += n_items
            if count >= limit:
                break

        return all_blocks

    def _get_worker(self, archive_url, from_block):
        """Resolve a worker URL from the archive router."""
        resp = self.session.get(f"{archive_url}/{from_block}/worker", timeout=10)
        resp.raise_for_status()
        return resp.text.strip()

    def _cache_key(self, *parts):
        raw = json.dumps(parts, sort_keys=True, default=str)
        return hashlib.md5(raw.encode()).hexdigest()

    def _cache_get(self, key, kind='logs'):
        path = self.cache_dir / f'{key}.json'
        if not path.exists():
            return None
        age = time.time() - path.stat().st_mtime
        ttl = self.CACHE_TTL.get(kind, 60)
        if age > ttl:
            return None
        return json.loads(path.read_text())

    def _cache_set(self, key, data):
        path = self.cache_dir / f'{key}.json'
        path.write_text(json.dumps(data, default=str))
