import mod as m
import bittensor as bt
from typing import List, Dict, Any, Optional
from bittensor.utils.balance import Balance
# import btwallet
print = m.print
class Bt:
    """Interface module for Subtensor network operations and wallet management"""
    fns = ['subnets', 'neurons']
    def __init__(self, network: str = "finney", archive=False):
        """Initialize the Subtensor module
        Args:
            network (str): Network to connect to (e.g. finney, test)
        """
        self.network = network
        self.subtensor = bt.Subtensor(network=network)
        print(f'Connected to bittensor network: {network}', color='green')
        if archive:
            self.subtensor = bt.Subtensor(network=network, archive=True)

    def mod2json(self, mod: Any) -> Dict:
        """Convert a neuron object to JSON dictionary
        Args:
            neuron (Any): Neuron object
        Returns:
            Dictionary representation of the neuron
        """
        mod =  mod.__dict__
        mod['axon_info'] = mod['axon_info'].__dict__ 
        mod['prometheus_info'] = mod['promzetheus_info'].__dict__ 
        mod['url'] = mod['axon_info']['ip'] + ':' + str(mod['axon_info']['port'])
        return mod

    def neurons(self, netuid: int = 2) -> List[Dict]:
        """List all neurons in a subnet
        Args:
            netuid (int): Network UID
        Returns:
            List of neuron information
        """
        return [self.mod2json(n) for n in self.subtensor.neurons(netuid=netuid)]

    def subnet2json(self, subnet: Any, neurons: bool = False) -> Dict:
        """Convert a subnet object to JSON dictionary
        Args:
            subnet (Any): Subnet object
            neurons (bool): Whether to include neuron information
        Returns:
            Dictionary representation of the subnet
        """
        subnet = subnet.__dict__
        subnet['subnet_identity'] = subnet['subnet_identity'].__dict__ if subnet.get('subnet_identity', None) != None else None
        # convert alpha_in, alpha_out, tao_in into float 
        for key in subnet.keys():
            if isinstance(subnet[key], Balance):
                subnet[key] = subnet[key].tao
        return subnet

    modules = mods = neurons
    
    def n(self, netuid: int = 1) -> int:
        """Get number of neurons in a subnet
        Args:
            netuid (int): Network UID
        Returns:
            Number of neurons
        """
        return len(self.neurons(netuid=netuid))

    
    def subnet(self, netuid: int = 2, block: Optional = None, tojson=True) -> Dict:
        """Get subnet information
        Args:
            netuid (int): Network UID
            block (Optional): Block number
        Returns:
            Subnet information dictionary
        """

        


        subnet =  self.subtensor.subnet(netuid=netuid, block=block)
        if tojson:
            return self.subnet2json(subnet)
        return subnet   






    def get_all_subnets_info(self, block: Optional = None, df=False) -> List[Dict]:
        """List all subnets
        Args:
            block (Optional): Block number
        Returns:
            List of subnet information dictionaries
        """
        return self.subtensor.get_all_subnets_info(block=block)

    def subnets(self, search=None, block: Optional = None, neurons=False, max_age=None, update=False, n=10) -> List[Dict]:
        """List all subnets
        Args:
            block (Optional): Block number
        Returns:
            List of subnet information dictionaries
        """
        path = '~/.bt/subnets.json'
        subnets = m.get(path,  None, update=update, max_age=max_age)
        if subnets is None:
            print('Fetching subnets from chain...')
            subnets_info =  self.get_all_subnets_info(block=block)
            subnets = []
            for subnet_info in subnets_info:
                netuid = subnet_info.netuid
                subnet = self.subnet(netuid=netuid, block=block)
                subnet['subnet_identity'] = subnet['subnet_identity'] if subnet.get('subnet_identity', None) != None else None
                if neurons:
                    neurons = self.neurons(netuid=netuid)
                    subnet['neurons'] = neurons
                # remove the balance objects by converting to tao float

                subnets.append(subnet)
            m.put(path, subnets)

        if len(subnets) > 0 and search:
            filtered_subnets = []
            for subnet in subnets:
                if search in subnet.get('subnet_name', '').lower() or search in str(subnet.get('netuid', '')):
                    filtered_subnets.append(subnet)
            subnets = filtered_subnets
        
        return subnets

    def mods(self, **kwargs):
        return self.subnets(**kwargs)
    
    def create_wallet(self, name: str, hotkey: Optional = None) -> Dict:
        """Create a new wallet
        Args:
            name (str): Name of the wallet
            hotkey (str): Optional hotkey name
        Returns:
            Wallet information dictionary
        """
        wallet = bt.Wallet(name=name, hotkey=hotkey)
        return wallet

    
    def get_wallet(self, name: str, hotkey: Optional = None) -> Dict:
        """Get wallet information
        Args:
            name (str): Name of the wallet
            hotkey (str): Optional hotkey name
        Returns:
            Wallet information dictionary
        """
        wallet = bt.Wallet(name=name, hotkey=hotkey)
        return dir(wallet)

    
    
    def balance(self, address: str) -> float:
        """Get balance for an address
        Args:
            address (str): Wallet address
        Returns:
            Balance in TAO
        """
        balance = self.subtensor.get_balance(address)
        return balance.tao
    
    def transfer(self, 
                wallet_name: str,
                dest_address: str,
                amount: float) -> bool:
        """Transfer TAO between wallets
        Args:
            wallet_name (str): Source wallet name
            dest_address (str): Destination address
            amount (float): Amount to transfer
        Returns:
            Success boolean
        """
        wallet = bt.Wallet(wallet_name)
        amount_bal = Balance.from_tao(amount)
        return self.subtensor.transfer(
            wallet=wallet,
            dest=dest_address,
            amount=amount_bal
        )
    
    def get_subnets(self) -> List[int]:
        """Get list of all subnets
        Returns:
            List of subnet UIDs
        """
        return self.subtensor.get_subnets()

    def gits(self) -> List[str]:
        """Get git URLs for a subnet
        Args:
            netuid (int): Network UID
        Returns:
            List of git URLs
        """
        giturls = []
        for subnet in self.subnets():
            subnet_identity = subnet.get('subnet_identity', {})
            if subnet_identity:
                github_repo = subnet_identity.get('github_repo', None)
                if github_repo:
                    giturls.append(github_repo)
        return giturls
    def regall(self, key=None, timeout=100) -> List[Any]:
        m.tree(update=1)
        gits = self.gits()
        api = m.mod('api')()
        futures = []
        for git in gits:
            name = git.split('/')[-1].replace('.git','')
            if api.exists(name, key=key):
                m.print(f'{name} already registered, skipping...')
                continue
            m.print(f'Registering {name} from {git}...')
            futures.append(m.future(api.reg_url, {'url': git, 'key': key}, timeout=timeout))

        mods = []
        for future in m.as_completed(futures, timeout=timeout):
            result = future.result(timeout=timeout)
            if isinstance(result, dict) and 'name' in result:
                mods.append(result['name'])
                print(mods[-1] + ' registered.')
        return mods
    def metagraph(self, netuid: int = 1) -> Any:
        """Get metagraph for a subnet
        Args:
            netuid (int): Network UID
        Returns:
            Metagraph object
        """
        return self.subtensor.metagraph(netuid)

    meta = metagraph


class BtTrader:
    """Simple trading interface for Bittensor subnet alpha tokens (dTAO).

    Usage:
        trader = BtTrader('my_wallet', hotkey='my_hotkey')
        trader.scan()              # see all subnets with prices
        trader.price(1)            # get TAO price per alpha for subnet 1
        trader.buy(1, 10.0)        # stake 10 TAO into subnet 1 (buy alpha)
        trader.sell(1, 5.0)        # unstake 5 TAO worth from subnet 1 (sell alpha)
        trader.portfolio()         # see all your positions
        trader.swap(1, 2, 5.0)    # swap stake from subnet 1 to subnet 2
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
        d = info.__dict__
        for k in d:
            if isinstance(d[k], Balance):
                d[k] = float(d[k].tao)
        return d

    def price(self, netuid: int) -> Dict:
        """Get current price info for a subnet's alpha token.
        Returns dict with tao_in, alpha_in, price (TAO per alpha), and market cap.
        """
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
                p = self.price(netuid)
                results.append(p)
            except Exception as e:
                continue
        results.sort(key=lambda x: x.get(sort_by, 0), reverse=True)
        if limit:
            results = results[:limit]
        for r in results:
            print(f"SN{r['netuid']:>3} | {r['name']:<20} | price: {r['price']:.6f} TAO | pool: {r['tao_in']:.2f} TAO", color='cyan')
        return results

    def balance(self) -> Dict:
        """Get TAO balance for coldkey and hotkey."""
        cold_bal = self.subtensor.get_balance(self.coldkey_ss58)
        return {
            'coldkey': float(cold_bal.tao),
        }

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
                    pos = {
                        'netuid': netuid,
                        'name': p['name'],
                        'stake': amt,
                        'price': p['price'],
                        'value_tao': value,
                    }
                    positions.append(pos)
                    print(f"SN{netuid:>3} | {p['name']:<20} | stake: {amt:.4f} | value: {value:.4f} TAO", color='green')
            except Exception:
                continue
        if not positions:
            print('No open positions.', color='yellow')
        return positions

    def buy(self, netuid: int, amount_tao: float, wait: bool = True) -> bool:
        """Buy into a subnet by staking TAO (converts TAO → alpha).
        Args:
            netuid: subnet to buy into
            amount_tao: amount of TAO to stake
            wait: wait for tx inclusion
        """
        p = self.price(netuid)
        print(f"Buying SN{netuid} ({p['name']}) | {amount_tao} TAO @ {p['price']:.6f} TAO/alpha", color='yellow')
        amount = Balance.from_tao(amount_tao)
        result = self.subtensor.add_stake(
            wallet=self.wallet,
            hotkey_ss58=self.hotkey_ss58,
            netuid=netuid,
            amount=amount,
            wait_for_inclusion=wait,
            wait_for_finalization=False,
        )
        if result:
            print(f'Buy successful.', color='green')
        else:
            print(f'Buy failed.', color='red')
        return result

    def sell(self, netuid: int, amount_tao: float, wait: bool = True) -> bool:
        """Sell out of a subnet by unstaking (converts alpha → TAO).
        Args:
            netuid: subnet to sell from
            amount_tao: amount of TAO worth to unstake
            wait: wait for tx inclusion
        """
        p = self.price(netuid)
        print(f"Selling SN{netuid} ({p['name']}) | {amount_tao} TAO @ {p['price']:.6f} TAO/alpha", color='yellow')
        amount = Balance.from_tao(amount_tao)
        result = self.subtensor.unstake(
            wallet=self.wallet,
            hotkey_ss58=self.hotkey_ss58,
            netuid=netuid,
            amount=amount,
            wait_for_inclusion=wait,
            wait_for_finalization=False,
        )
        if result:
            print(f'Sell successful.', color='green')
        else:
            print(f'Sell failed.', color='red')
        return result

    def sell_all(self, netuid: int, wait: bool = True) -> bool:
        """Sell entire position in a subnet."""
        print(f'Selling all of SN{netuid}...', color='yellow')
        result = self.subtensor.unstake(
            wallet=self.wallet,
            hotkey_ss58=self.hotkey_ss58,
            netuid=netuid,
            amount=None,
            wait_for_inclusion=wait,
            wait_for_finalization=False,
        )
        if result:
            print(f'Sold all of SN{netuid}.', color='green')
        else:
            print(f'Sell all failed.', color='red')
        return result

    def swap(self, from_netuid: int, to_netuid: int, amount_tao: float, wait: bool = True) -> bool:
        """Swap stake from one subnet to another (same hotkey).
        Args:
            from_netuid: source subnet
            to_netuid: destination subnet
            amount_tao: amount to swap
        """
        print(f'Swapping {amount_tao} TAO from SN{from_netuid} → SN{to_netuid}', color='yellow')
        amount = Balance.from_tao(amount_tao)
        result = self.subtensor.swap_stake(
            wallet=self.wallet,
            hotkey_ss58=self.hotkey_ss58,
            origin_netuid=from_netuid,
            destination_netuid=to_netuid,
            amount=amount,
            wait_for_inclusion=wait,
            wait_for_finalization=False,
        )
        if result:
            print(f'Swap successful.', color='green')
        else:
            print(f'Swap failed.', color='red')
        return result

    def move(self, from_netuid: int, to_netuid: int, to_hotkey: str, amount_tao: float, wait: bool = True) -> bool:
        """Move stake to a different hotkey and/or subnet.
        Args:
            from_netuid: source subnet
            to_netuid: destination subnet
            to_hotkey: destination hotkey ss58
            amount_tao: amount to move
        """
        print(f'Moving {amount_tao} TAO from SN{from_netuid} → SN{to_netuid} (hotkey: {to_hotkey[:8]}...)', color='yellow')
        amount = Balance.from_tao(amount_tao)
        result = self.subtensor.move_stake(
            wallet=self.wallet,
            origin_hotkey=self.hotkey_ss58,
            origin_netuid=from_netuid,
            destination_hotkey=to_hotkey,
            destination_netuid=to_netuid,
            amount=amount,
            wait_for_inclusion=wait,
            wait_for_finalization=False,
        )
        if result:
            print(f'Move successful.', color='green')
        else:
            print(f'Move failed.', color='red')
        return result

    def watch(self, netuids: List[int], interval: int = 30) -> None:
        """Watch price changes for given subnets in a loop.
        Args:
            netuids: list of subnet UIDs to watch
            interval: seconds between refreshes
        """
        import time
        prev = {}
        print(f'Watching subnets: {netuids} (Ctrl+C to stop)', color='cyan')
        try:
            while True:
                for netuid in netuids:
                    p = self.price(netuid)
                    old = prev.get(netuid, p['price'])
                    delta = p['price'] - old
                    arrow = '↑' if delta > 0 else ('↓' if delta < 0 else '→')
                    color = 'green' if delta > 0 else ('red' if delta < 0 else 'white')
                    print(f"SN{netuid:>3} | {p['name']:<20} | {p['price']:.6f} TAO {arrow} ({delta:+.6f})", color=color)
                    prev[netuid] = p['price']
                print('---', color='white')
                time.sleep(interval)
        except KeyboardInterrupt:
            print('Stopped watching.', color='yellow')