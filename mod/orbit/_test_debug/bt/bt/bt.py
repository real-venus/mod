import mod as m
import bittensor as bt
import json
import subprocess
import os
from typing import List, Dict, Any, Optional
from bittensor.utils.balance import Balance

print = m.print

# ── Rust engine integration ─────────────────────────────────────
_bt_engine = None


def _get_engine(config=None):
    """Lazy-load the bt_rs Rust engine for fast RPC scanning."""
    global _bt_engine
    if _bt_engine is None:
        try:
            import bt_rs
            cfg = json.dumps(config) if config else None
            _bt_engine = bt_rs.BtEngine(cfg)
            _bt_engine.start_health_checks()
            print('bt_rs engine loaded', color='green')
        except ImportError:
            print('bt_rs not built. Run: cd bt-rs && maturin develop --release', color='yellow')
            return None
    return _bt_engine


def build_engine():
    """Build the Rust engine via maturin."""
    rs_dir = os.path.join(os.path.dirname(__file__), '..', 'bt-rs')
    if not os.path.exists(rs_dir):
        print(f'bt-rs directory not found at {rs_dir}', color='red')
        return False
    print('Building bt_rs engine...', color='yellow')
    result = subprocess.run(
        ['maturin', 'develop', '--release'],
        cwd=rs_dir, capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f'Build failed: {result.stderr}', color='red')
        return False
    print('bt_rs engine built successfully', color='green')
    return True


class Bt:
    """Interface module for Subtensor network operations and wallet management."""

    fns = ['subnets', 'neurons']

    def __init__(self, network: str = "finney", archive=False):
        self.network = network
        if archive:
            self.subtensor = bt.Subtensor(network=network, archive=True)
        else:
            self.subtensor = bt.Subtensor(network=network)
        print(f'Connected to bittensor network: {network}', color='green')

    def mod2json(self, mod: Any) -> Dict:
        """Convert a neuron object to a JSON dictionary."""
        d = dict(mod.__dict__)
        d['axon_info'] = dict(d['axon_info'].__dict__) if hasattr(d.get('axon_info'), '__dict__') else d.get('axon_info', {})
        d['prometheus_info'] = dict(d['prometheus_info'].__dict__) if hasattr(d.get('prometheus_info'), '__dict__') else d.get('prometheus_info', {})
        d['url'] = str(d['axon_info'].get('ip', '')) + ':' + str(d['axon_info'].get('port', ''))
        return d

    def neurons(self, netuid: int = 2) -> List[Dict]:
        """List all neurons in a subnet."""
        return [self.mod2json(n) for n in self.subtensor.neurons(netuid=netuid)]

    modules = neurons

    def subnet2json(self, subnet: Any, neurons: bool = False) -> Dict:
        """Convert a subnet object to JSON dictionary."""
        d = dict(subnet.__dict__)
        identity = d.get('subnet_identity', None)
        d['subnet_identity'] = dict(identity.__dict__) if identity is not None and hasattr(identity, '__dict__') else identity
        for key in list(d.keys()):
            if isinstance(d[key], Balance):
                d[key] = d[key].tao
        return d

    def n(self, netuid: int = 1) -> int:
        """Get number of neurons in a subnet."""
        return len(self.neurons(netuid=netuid))

    def subnet(self, netuid: int = 2, block: Optional[int] = None, tojson=True) -> Dict:
        """Get subnet information."""
        subnet = self.subtensor.subnet(netuid=netuid, block=block)
        if tojson:
            return self.subnet2json(subnet)
        return subnet

    def get_all_subnets_info(self, block: Optional[int] = None) -> List[Dict]:
        """List all subnets."""
        return self.subtensor.get_all_subnets_info(block=block)

    def subnets(self, search=None, block: Optional[int] = None, neurons=False,
                max_age=None, update=False, n=10) -> List[Dict]:
        """List all subnets with optional search filter."""
        path = '~/.bt/subnets.json'
        subnets = m.get(path, None, update=update, max_age=max_age)
        if subnets is None:
            print('Fetching subnets from chain...')
            subnets_info = self.get_all_subnets_info(block=block)
            subnets = []
            for subnet_info in subnets_info:
                netuid = subnet_info.netuid
                subnet = self.subnet(netuid=netuid, block=block)
                subnet['subnet_identity'] = subnet.get('subnet_identity', None)
                if neurons:
                    subnet['neurons'] = self.neurons(netuid=netuid)
                subnets.append(subnet)
            m.put(path, subnets)

        if subnets and search:
            subnets = [
                s for s in subnets
                if search in s.get('subnet_name', '').lower()
                or search in str(s.get('netuid', ''))
            ]
        return subnets

    def mods(self, **kwargs):
        return self.subnets(**kwargs)

    def create_wallet(self, name: str, hotkey: Optional[str] = None) -> Any:
        """Create a new wallet."""
        return bt.Wallet(name=name, hotkey=hotkey)

    def get_wallet(self, name: str, hotkey: Optional[str] = None) -> List:
        """Get wallet information."""
        wallet = bt.Wallet(name=name, hotkey=hotkey)
        return dir(wallet)

    def balance(self, address: str) -> float:
        """Get balance for an address in TAO."""
        return self.subtensor.get_balance(address).tao

    def transfer(self, wallet_name: str, dest_address: str, amount: float) -> bool:
        """Transfer TAO between wallets."""
        wallet = bt.Wallet(wallet_name)
        return self.subtensor.transfer(
            wallet=wallet, dest=dest_address,
            amount=Balance.from_tao(amount),
        )

    def get_subnets(self) -> List[int]:
        """Get list of all subnet UIDs."""
        return self.subtensor.get_subnets()

    def gits(self) -> List[str]:
        """Get git URLs from all subnets."""
        urls = []
        for subnet in self.subnets():
            identity = subnet.get('subnet_identity', {})
            if identity:
                repo = identity.get('github_repo')
                if repo:
                    urls.append(repo)
        return urls

    def regall(self, key=None, timeout=100) -> List[Any]:
        """Register all subnet repos as modules."""
        m.tree(update=1)
        gits = self.gits()
        api = m.mod('api')()
        futures = []
        for git in gits:
            name = git.split('/')[-1].replace('.git', '')
            if api.exists(name, key=key):
                print(f'{name} already registered, skipping...')
                continue
            print(f'Registering {name} from {git}...')
            futures.append(m.future(api.reg_url, {'url': git, 'key': key}, timeout=timeout))

        mods = []
        for future in m.as_completed(futures, timeout=timeout):
            result = future.result(timeout=timeout)
            if isinstance(result, dict) and 'name' in result:
                mods.append(result['name'])
                print(mods[-1] + ' registered.')
        return mods

    def metagraph(self, netuid: int = 1) -> Any:
        """Get metagraph for a subnet."""
        return self.subtensor.metagraph(netuid)

    meta = metagraph


class BtTrader:
    """Trading interface for Bittensor subnet alpha tokens (dTAO).

    Usage:
        trader = BtTrader('my_wallet', hotkey='my_hotkey')
        trader.scan()              # see all subnets with prices
        trader.price(1)            # get TAO price per alpha for subnet 1
        trader.buy(1, 10.0)        # stake 10 TAO into subnet 1
        trader.sell(1, 5.0)        # unstake 5 TAO worth from subnet 1
        trader.portfolio()         # see all your positions
        trader.swap(1, 2, 5.0)     # swap stake from subnet 1 to subnet 2
    """

    def __init__(self, wallet_name: str = 'default', hotkey: str = 'default', network: str = 'finney'):
        self.wallet = bt.Wallet(name=wallet_name, hotkey=hotkey)
        self.subtensor = bt.Subtensor(network=network)
        self.hotkey_ss58 = self.wallet.hotkey.ss58_address
        self.coldkey_ss58 = self.wallet.coldkeypub.ss58_address
        print(f'Trader ready | wallet={wallet_name} hotkey={hotkey} network={network}', color='green')
        print(f'Coldkey: {self.coldkey_ss58}', color='cyan')
        print(f'Hotkey:  {self.hotkey_ss58}', color='cyan')

    def _subnet_info(self, netuid: int) -> Dict:
        """Get raw DynamicInfo for a subnet and convert to dict."""
        info = self.subtensor.subnet(netuid=netuid)
        d = dict(info.__dict__)
        for k in list(d.keys()):
            if isinstance(d[k], Balance):
                d[k] = float(d[k].tao)
        return d

    def price(self, netuid: int) -> Dict:
        """Get current price info for a subnet's alpha token."""
        info = self._subnet_info(netuid)
        tao_in = info.get('tao_in', 0)
        alpha_in = info.get('alpha_in', 0)
        price = tao_in / alpha_in if alpha_in > 0 else 0
        return {
            'netuid': netuid,
            'name': info.get('subnet_name', str(netuid)),
            'price': price,
            'tao_in': tao_in,
            'alpha_in': alpha_in,
            'alpha_out': info.get('alpha_out', 0),
            'emission': info.get('emission', 0),
        }

    def scan(self, sort_by: str = 'price', limit: int = 20) -> List[Dict]:
        """Scan all subnets and return sorted price info."""
        netuids = self.subtensor.get_subnets()
        results = []
        for netuid in netuids:
            try:
                results.append(self.price(netuid))
            except Exception:
                continue
        results.sort(key=lambda x: x.get(sort_by, 0), reverse=True)
        if limit:
            results = results[:limit]
        for r in results:
            print(f"SN{r['netuid']:>3} | {r['name']:<20} | price: {r['price']:.6f} TAO | pool: {r['tao_in']:.2f} TAO", color='cyan')
        return results

    def balance(self) -> Dict:
        """Get TAO balance for coldkey."""
        cold_bal = self.subtensor.get_balance(self.coldkey_ss58)
        return {'coldkey': float(cold_bal.tao)}

    def portfolio(self) -> List[Dict]:
        """Get all staked positions across subnets."""
        netuids = self.subtensor.get_subnets()
        positions = []
        for netuid in netuids:
            try:
                stake = self.subtensor.get_stake(
                    coldkey_ss58=self.coldkey_ss58,
                    hotkey_ss58=self.hotkey_ss58,
                    netuid=netuid,
                )
                amt = float(stake.tao) if hasattr(stake, 'tao') else float(stake)
                if amt > 0:
                    p = self.price(netuid)
                    value = amt * p['price'] if p['price'] > 0 else 0
                    positions.append({
                        'netuid': netuid, 'name': p['name'],
                        'stake': amt, 'price': p['price'], 'value_tao': value,
                    })
                    print(f"SN{netuid:>3} | {p['name']:<20} | stake: {amt:.4f} | value: {value:.4f} TAO", color='green')
            except Exception:
                continue
        if not positions:
            print('No open positions.', color='yellow')
        return positions

    def buy(self, netuid: int, amount_tao: float, wait: bool = True) -> bool:
        """Buy into a subnet by staking TAO (converts TAO -> alpha)."""
        p = self.price(netuid)
        print(f"Buying SN{netuid} ({p['name']}) | {amount_tao} TAO @ {p['price']:.6f} TAO/alpha", color='yellow')
        result = self.subtensor.add_stake(
            wallet=self.wallet, hotkey_ss58=self.hotkey_ss58,
            netuid=netuid, amount=Balance.from_tao(amount_tao),
            wait_for_inclusion=wait, wait_for_finalization=False,
        )
        print('Buy successful.' if result else 'Buy failed.', color='green' if result else 'red')
        return result

    def sell(self, netuid: int, amount_tao: float, wait: bool = True) -> bool:
        """Sell out of a subnet by unstaking (converts alpha -> TAO)."""
        p = self.price(netuid)
        print(f"Selling SN{netuid} ({p['name']}) | {amount_tao} TAO @ {p['price']:.6f} TAO/alpha", color='yellow')
        result = self.subtensor.unstake(
            wallet=self.wallet, hotkey_ss58=self.hotkey_ss58,
            netuid=netuid, amount=Balance.from_tao(amount_tao),
            wait_for_inclusion=wait, wait_for_finalization=False,
        )
        print('Sell successful.' if result else 'Sell failed.', color='green' if result else 'red')
        return result

    def sell_all(self, netuid: int, wait: bool = True) -> bool:
        """Sell entire position in a subnet."""
        print(f'Selling all of SN{netuid}...', color='yellow')
        result = self.subtensor.unstake(
            wallet=self.wallet, hotkey_ss58=self.hotkey_ss58,
            netuid=netuid, amount=None,
            wait_for_inclusion=wait, wait_for_finalization=False,
        )
        print(f'Sold all of SN{netuid}.' if result else 'Sell all failed.', color='green' if result else 'red')
        return result

    def swap(self, from_netuid: int, to_netuid: int, amount_tao: float, wait: bool = True) -> bool:
        """Swap stake from one subnet to another (same hotkey)."""
        print(f'Swapping {amount_tao} TAO from SN{from_netuid} -> SN{to_netuid}', color='yellow')
        result = self.subtensor.swap_stake(
            wallet=self.wallet, hotkey_ss58=self.hotkey_ss58,
            origin_netuid=from_netuid, destination_netuid=to_netuid,
            amount=Balance.from_tao(amount_tao),
            wait_for_inclusion=wait, wait_for_finalization=False,
        )
        print('Swap successful.' if result else 'Swap failed.', color='green' if result else 'red')
        return result

    def move(self, from_netuid: int, to_netuid: int, to_hotkey: str, amount_tao: float, wait: bool = True) -> bool:
        """Move stake to a different hotkey and/or subnet."""
        print(f'Moving {amount_tao} TAO from SN{from_netuid} -> SN{to_netuid} (hotkey: {to_hotkey[:8]}...)', color='yellow')
        result = self.subtensor.move_stake(
            wallet=self.wallet, origin_hotkey=self.hotkey_ss58,
            origin_netuid=from_netuid, destination_hotkey=to_hotkey,
            destination_netuid=to_netuid, amount=Balance.from_tao(amount_tao),
            wait_for_inclusion=wait, wait_for_finalization=False,
        )
        print('Move successful.' if result else 'Move failed.', color='green' if result else 'red')
        return result

    # ── Rust-accelerated methods ──────────────────────────────────

    def fast_scan(self, sort_by: str = 'price', limit: int = 20) -> List[Dict]:
        """Scan all subnets using the Rust engine (much faster, round-robin RPC)."""
        engine = _get_engine()
        if engine is None:
            print('Falling back to Python scan...', color='yellow')
            return self.scan(sort_by=sort_by, limit=limit)
        result = json.loads(engine.scan_subnets())
        result.sort(key=lambda x: x.get(sort_by, 0), reverse=True)
        if limit:
            result = result[:limit]
        for r in result:
            print(f"SN{r['netuid']:>3} | {r['name']:<20} | price: {r['price']:.6f} TAO | pool: {r['tao_in']:.2f} TAO", color='cyan')
        return result

    def fast_trades(self, days: int = 30, limit: int = 1000) -> List[Dict]:
        """Fetch recent staking events using Rust engine."""
        engine = _get_engine()
        if engine is None:
            print('Rust engine not available', color='red')
            return []
        result = json.loads(engine.fetch_trades(days * 7200, limit))
        print(f'Fetched {len(result)} trades from last {days} days', color='green')
        return result

    def fast_leaderboard(self, top_n: int = 20) -> List[Dict]:
        """Build leaderboard using Rust engine."""
        engine = _get_engine()
        if engine is None:
            print('Rust engine not available', color='red')
            return []
        result = json.loads(engine.leaderboard(top_n))
        for i, entry in enumerate(result):
            roi = entry.get('roi_30d', 0) * 100
            color = 'green' if roi > 0 else 'red'
            print(f"#{i+1:>2} {entry['coldkey'][:16]}... | {entry['total_value_tao']:.2f} TAO | ROI: {roi:+.2f}%", color=color)
        return result

    def rpc_health(self) -> List[Dict]:
        """Get RPC pool health stats from Rust engine."""
        engine = _get_engine()
        if engine is None:
            return []
        return json.loads(engine.rpc_health())

    def best_rpc(self) -> str:
        """Get the lowest-latency RPC endpoint."""
        engine = _get_engine()
        if engine is None:
            return 'wss://entrypoint-finney.opentensor.ai:443'
        return engine.best_rpc()

    def watch(self, netuids: List[int], interval: int = 30) -> None:
        """Watch price changes for given subnets in a loop."""
        import time
        prev = {}
        print(f'Watching subnets: {netuids} (Ctrl+C to stop)', color='cyan')
        try:
            while True:
                for netuid in netuids:
                    p = self.price(netuid)
                    old = prev.get(netuid, p['price'])
                    delta = p['price'] - old
                    arrow = '+' if delta > 0 else ('-' if delta < 0 else '=')
                    color = 'green' if delta > 0 else ('red' if delta < 0 else 'white')
                    print(f"SN{netuid:>3} | {p['name']:<20} | {p['price']:.6f} TAO {arrow} ({delta:+.6f})", color=color)
                    prev[netuid] = p['price']
                print('---', color='white')
                time.sleep(interval)
        except KeyboardInterrupt:
            print('Stopped watching.', color='yellow')
