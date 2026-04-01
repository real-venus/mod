"""TX — transaction logging for CLI calls."""

import os
import json
import time
import hashlib


class Tx:
    """Save and retrieve transaction records for CLI calls."""

    def __init__(self, storage_path=None):
        self.storage_path = storage_path or os.path.expanduser('~/.mod/txs')
        os.makedirs(self.storage_path, exist_ok=True)

    def _tx_path(self, tx_hash):
        return os.path.join(self.storage_path, f'{tx_hash}.json')

    def _hash(self, data):
        raw = json.dumps(data, sort_keys=True, separators=(',', ':'))
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    def save(self, fn, params, result, client, token):
        """Save a transaction record.

        Args:
            fn: function name that was called
            params: dict of args/kwargs passed
            result: the return value (must be JSON-serializable or will be str'd)
            client: address of the key used to generate the token
            token: the auth token string
        """
        timestamp = time.time()
        tx = {
            'fn': fn,
            'params': params,
            'result': self._safe_serialize(result),
            'client': client,
            'token': token,
            'timestamp': timestamp,
        }
        tx_hash = self._hash({'fn': fn, 'client': client, 'timestamp': timestamp})
        path = self._tx_path(tx_hash)
        with open(path, 'w') as f:
            json.dump(tx, f, separators=(',', ':'))
        return {'hash': tx_hash, 'path': path}

    def get(self, tx_hash):
        """Retrieve a single tx by hash."""
        path = self._tx_path(tx_hash)
        if not os.path.exists(path):
            return None
        with open(path) as f:
            return json.load(f)

    def list(self, search=None, limit=100):
        """List recent transactions, optionally filtered by fn name."""
        txs = []
        files = sorted(os.listdir(self.storage_path), reverse=True)
        for fname in files:
            if not fname.endswith('.json'):
                continue
            path = os.path.join(self.storage_path, fname)
            try:
                with open(path) as f:
                    tx = json.load(f)
                if search and search not in tx.get('fn', ''):
                    continue
                tx['hash'] = fname[:-5]
                txs.append(tx)
                if len(txs) >= limit:
                    break
            except Exception:
                continue
        return sorted(txs, key=lambda t: t.get('timestamp', 0), reverse=True)

    @staticmethod
    def _safe_serialize(obj):
        """Best-effort JSON-safe conversion."""
        try:
            json.dumps(obj)
            return obj
        except (TypeError, ValueError):
            return str(obj)
