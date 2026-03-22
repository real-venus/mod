"""
Filecoin - Simple interface to the Filecoin network.

Uses public Glif RPC (no API key needed).
"""

import os
import json
import requests

RPC = os.environ.get('FILECOIN_RPC', 'https://api.node.glif.io/rpc/v1')


class Mod:
    description = """
    Filecoin network interface - balances, transfers, chain info, gas, deals.
    Uses Glif public RPC by default.
    """

    def __init__(self, rpc=None):
        self.rpc = rpc or RPC
        self._id = 0

    # ── RPC ──────────────────────────────────────────────

    def call(self, method, params=None):
        """Raw JSON-RPC call to Filecoin/Lotus API."""
        self._id += 1
        body = {
            'jsonrpc': '2.0',
            'id': self._id,
            'method': method,
            'params': params or [],
        }
        r = requests.post(self.rpc, json=body, timeout=30)
        r.raise_for_status()
        data = r.json()
        if 'error' in data:
            raise Exception(f"RPC error: {data['error']}")
        return data.get('result')

    # ── Chain ────────────────────────────────────────────

    def head(self):
        """Get current chain head (tipset)."""
        ts = self.call('Filecoin.ChainHead')
        return {
            'height': ts['Height'],
            'blocks': len(ts['Cids']),
            'cids': [c['/'] for c in ts['Cids']],
        }

    def height(self):
        """Current block height."""
        return self.head()['height']

    def block(self, cid):
        """Get a block header by CID."""
        return self.call('Filecoin.ChainGetBlock', [{'/': cid}])

    def tipset(self, height):
        """Get tipset at a specific height."""
        return self.call('Filecoin.ChainGetTipSetByHeight', [height, None])

    def message(self, cid):
        """Get a message (transaction) by CID."""
        return self.call('Filecoin.ChainGetMessage', [{'/': cid}])

    # ── Wallet / Balance ─────────────────────────────────

    def balance(self, address):
        """Get FIL balance in attoFIL. Returns dict with raw and human-readable."""
        raw = self.call('Filecoin.WalletBalance', [address])
        fil = int(raw) / 1e18
        return {'attoFIL': raw, 'FIL': round(fil, 6)}

    def nonce(self, address):
        """Get next nonce for an address."""
        return self.call('Filecoin.MpoolGetNonce', [address])

    def actor(self, address):
        """Get actor (account) info for an address."""
        return self.call('Filecoin.StateGetActor', [address, None])

    def lookup(self, address):
        """Resolve address to its ID address."""
        return self.call('Filecoin.StateLookupID', [address, None])

    def account_key(self, address):
        """Resolve ID address to its public key address."""
        return self.call('Filecoin.StateAccountKey', [address, None])

    # ── Gas ──────────────────────────────────────────────

    def gas_estimate(self, to, value='0', method=0):
        """Estimate gas for a message. Value in attoFIL."""
        msg = {
            'To': to,
            'From': to,
            'Value': str(value),
            'Method': method,
            'Params': '',
        }
        return self.call('Filecoin.GasEstimateMessageGas', [msg, {'MaxFee': '0'}, None])

    def base_fee(self):
        """Get current base fee from chain head."""
        ts = self.call('Filecoin.ChainHead')
        if ts and ts.get('Blocks'):
            raw = ts['Blocks'][0].get('ParentBaseFee', '0')
            return {'attoFIL': raw, 'nanoFIL': round(int(raw) / 1e9, 4)}
        return None

    # ── Deals / Storage ──────────────────────────────────

    def deal(self, deal_id):
        """Get storage deal info by deal ID."""
        return self.call('Filecoin.StateMarketStorageDeal', [deal_id, None])

    def miner_info(self, miner_address):
        """Get storage provider (miner) info."""
        return self.call('Filecoin.StateMinerInfo', [miner_address, None])

    def miner_power(self, miner_address):
        """Get storage provider power (raw + quality-adjusted)."""
        return self.call('Filecoin.StateMinerPower', [miner_address, None])

    def verified_deal_status(self, deal_id):
        """Check if a deal is verified."""
        d = self.deal(deal_id)
        if d and d.get('Proposal'):
            return d['Proposal'].get('VerifiedDeal', False)
        return None

    # ── Network ──────────────────────────────────────────

    def network(self):
        """Get network name (mainnet, calibrationnet, etc)."""
        return self.call('Filecoin.StateNetworkName')

    def version(self):
        """Get node version info."""
        return self.call('Filecoin.Version')

    def supply(self):
        """Get circulating FIL supply."""
        raw = self.call('Filecoin.StateCirculatingSupply', [None])
        return {'attoFIL': raw, 'FIL': round(int(raw) / 1e18, 2)}

    def network_power(self):
        """Total network storage power."""
        p = self.call('Filecoin.StateMinerPower', ['', None])
        if p and p.get('TotalPower'):
            raw = int(p['TotalPower']['RawBytePower'])
            return {
                'bytes': raw,
                'PiB': round(raw / (1024**5), 2),
                'raw': p['TotalPower']['RawBytePower'],
            }
        return None

    # ── Search / Transactions ────────────────────────────

    def search_msg(self, cid):
        """Search for a message by CID and get its receipt."""
        return self.call('Filecoin.StateSearchMsg', [{'/': cid}])

    def receipt(self, cid):
        """Get message receipt (exit code, return, gas used)."""
        r = self.search_msg(cid)
        if r and r.get('Receipt'):
            return r['Receipt']
        return None

    # ── Convenience ──────────────────────────────────────

    def status(self):
        """Quick network status overview."""
        h = self.head()
        v = self.version()
        net = self.network()
        bf = self.base_fee()
        return {
            'network': net,
            'height': h['height'],
            'blocks_in_tipset': h['blocks'],
            'base_fee_nanoFIL': bf['nanoFIL'] if bf else None,
            'node_version': v.get('Version') if v else None,
        }

    def forward(self, address=None, **kwargs):
        """Default entry point. If address given, show balance. Otherwise show status."""
        if address:
            return self.balance(address)
        return self.status()

    def test(self):
        """Quick connectivity test."""
        try:
            s = self.status()
            return {'ok': True, **s}
        except Exception as e:
            return {'ok': False, 'error': str(e)}
