"""Simplified Chain Interface for New Contracts

Provides interaction with:
- BlocTime (Unified staking + token)
- Market (Stable token with TokenGate integration)
- Registry (Minimal mod registration)
- TokenGate (Token whitelist + oracle management)
- Treasury (Proportional withdrawals)
- Perms (Permission system)
"""

from web3 import Web3
from typing import Dict, Any, Optional, List, Union
import json
import os
import mod as m
import requests
from eth_account import Account
from eth_account.signers.local import LocalAccount

class Mod:
    """Simplified Chain Interface for New Contract Architecture."""

    network2url = {
        'testnet': 'https://sepolia.base.org',
        'ganache': 'http://localhost:8545',
        'mainnet': 'https://mainnet.base.org'
    }
    decimals = 18
    def __init__(self, network: str = 'testnet', key='test'):
        """Initialize Chain interface.
        
        Args:
            rpc_url: Ethereum RPC endpoint
        """
        self.network = network
        self.rpc_url = self.network2url.get(network, network)
        m.print(f'Connecting to {self.rpc_url} {network}', color='cyan')
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        self.contracts = {}
        self.path = m.dp('chain')
        self.set_key(key)
        self.ipfs = m.mod('ipfs')()
        self.contracts_path = self.path + '/artifacts/contracts'
        self.config = m.config('chain')
        self.load_all_contracts()
        if not os.path.exists(self.contracts_path):
            os.makedirs(self.path)
        
    def env_dict(self) -> Dict[str, str]:
        env_path = os.path.join(self.path, '.env')
        env_example_path = os.path.join(self.path, '.env.example')
        if not os.path.exists(env_path):
            m.put_text(env_path, m.get_text(env_example_path))

        from dotenv import load_dotenv
        load_dotenv(env_path)
        
        env_dict = dict()
        with open(env_path, 'r') as f:
            for line in f:
                if not line.strip() or line.startswith('#'):
                    continue
                key, value = line.strip().split('=', 1)
                env_dict[key.lower()] = value
        
        return env_dict
    def set_key(self, key = None):
        if key:
            self.key = m.key(key)
        else:
            self.key = m.mod('key')(self.env_dict().get('private_key'))
        self.connect(self.key.private_key)
        return self.account.address

    def sync_app(self):
        """Sync contract artifacts to app."""
        app_path = m.dp('app') + '/src/contracts'
        if os.path.exists(app_path):
            os.system(f'rm -rf {app_path}')
        os.system(f'mkdir -p {app_path}')
        os.system(f'cp -r {self.contracts_path}/** {app_path}')
        return m.files(app_path)

    def connect(self, private_key: str):
        """Connect wallet using private key.
        
        Args:
            private_key: Private key for signing transactions
        """
        self.account = self.w3.eth.account.from_key(private_key)
        return self.account.address

    def load_contract(self, name: str, address: str, abi: list):
        """Load a contract interface.
        
        Args:
            name: Contract identifier
            address: Contract address
            abi: Contract ABI
        """
        self.contracts[name] = self.w3.eth.contract(
            address=Web3.to_checksum_address(address),
            abi=abi
        )
        return self.contracts[name]

    def load_all_contracts(self):
        """Load all contracts at once.
        
        Args:
            addresses: Dict mapping contract names to addresses
            abis: Dict mapping contract names to ABIs
        """
        contracts = self.config['deployments'][self.network]['contracts']
        for name, info in contracts.items():
            name = name.lower()
            address = info['address']
            try:
                abi = self.ipfs.get(info.get('abi'))
                if abi == None: 
                    m.print(f'ABI not found for {name} at {info.get("abi")}', color='red')
                    continue
                self.load_contract(name, address, abi)
            except Exception as e :
                continue

    # ==================== BLOCTIME FUNCTIONS ====================

    def stake(self, amount: int, lock_blocks: int) -> Dict[str, Any]:
        """Stake tokens to earn BlocTime.
        
        Args:
            amount: Amount to stake (in wei)
            lock_blocks: Number of blocks to lock
            
        Returns:
            Transaction receipt
        """
        bloctime = self.contracts.get('bloctime')
        if not bloctime:
            raise ValueError('BlocTime contract not loaded')
        
        # Approve native token first
        native_token = self.contracts.get('native_token')
        if native_token:
            approve_tx = native_token.functions.approve(
                bloctime.address, amount
            ).build_transaction({
                'from': self.account.address,
                'nonce': self.w3.eth.get_transaction_count(self.account.address)
            })
            signed = self.w3.eth.account.sign_transaction(approve_tx, self.account.key)
            self.w3.eth.send_raw_transaction(signed.raw_transaction)
        
        # Stake
        tx = bloctime.functions.stake(amount, lock_blocks).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def unstake(self, stake_id: int) -> Dict[str, Any]:
        """Unstake specific stake position.
        
        Args:
            stake_id: Stake ID to unstake
            
        Returns:
            Transaction receipt
        """
        bloctime = self.contracts.get('bloctime')
        if not bloctime:
            raise ValueError('BlocTime contract not loaded')
        
        tx = bloctime.functions.unstake(stake_id).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def get_stake_position(self, address: Optional[str] = None, stake_id: int = 0) -> Dict[str, Any]:
        """Get stake position information.
        
        Args:
            address: Address to query
            stake_id: Stake ID
            
        Returns:
            Stake position info
        """
        bloctime = self.contracts.get('bloctime')
        if not bloctime:
            raise ValueError('BlocTime contract not loaded')
        
        addr = address or self.account.address
        info = bloctime.functions.getStakePosition(addr, stake_id).call()
        return {
            'amount': info[0],
            'start_block': info[1],
            'lock_blocks': info[2],
            'bloctime_balance': info[3],
            'blocks_remaining': info[4]
        }

    def get_user_stake_ids(self, address: Optional[str] = None) -> List[int]:
        """Get all stake IDs for a user.
        
        Args:
            address: Address to query
            
        Returns:
            List of stake IDs
        """
        bloctime = self.contracts.get('bloctime')
        if not bloctime:
            raise ValueError('BlocTime contract not loaded')
        addr = address or self.account.address
        return bloctime.functions.getUserStakeIds(addr).call()

    # ==================== MARKET FUNCTIONS ====================

    def credit(self, stable_amount: str, payment_token: int = 'usdt') -> Dict[str, Any]:
        """Buy stable tokens with whitelisted payment token.
        
        Args:
            payment_token: ERC20 token address for payment
            stable_amount: Amount of stable tokens to buy
            
        Returns:
            Transaction receipt
        """
        market = self.contracts.get('market')
        if not market:
            raise ValueError('Market contract not loaded')
        
        # Get price from TokenGate
        #
        payment_token = self.contracts_config().get(payment_token)['address']
        print('Using payment token at address:', payment_token)
        tokengate = self.contracts.get('tokengate')

        price_info = tokengate.functions.getTokenPrice(payment_token).call()
        token_price = price_info[0]
        token_decimals = price_info[1]
        # Calculate payment amount
        payment_amount = ((stable_amount * (10 ** token_decimals)) // token_price) ** token_decimals

        # Approve payment token
        token = self.w3.eth.contract(
            address=Web3.to_checksum_address(payment_token),
            abi=[{"constant":False,"inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"type":"function"}]
        )
        approve_tx = token.functions.approve(
            market.address, payment_amount
        ).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(approve_tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        # wait for approval to be mined
        print(f'Waiting for approval tx to be mined -> {tx_hash.hex()}')
        print(self.w3.eth.wait_for_transaction_receipt(tx_hash))
    
        # wait a bit for the approval to be mined
        # stable_amount = int(stable_amount * 10**self.decimals)
        # Credit stable tokens
        tx = market.functions.credit(payment_token, stable_amount).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        return tx_hash.hex()

    # ==================== REGISTRY FUNCTIONS ====================

    def reg(self, name: str, data: str=None) -> Dict[str, Any]:
        """Register a new mod.
        
        Args:
            name: Unique name for the mod
            data: JSON metadata or IPFS hash
            
        Returns:
            Transaction receipt
        """
        mod = m.fn('api/mod')(name)
        data = data or mod.get('cid', '')
        name = mod['name']
        if self.mod_exists(name):
            return self.update(name, data)
        return self.send_tx('registry', 'registerMod', [name, data])


    def send_tx(self, module, function, args: list) -> Dict[str, Any]:
        """Send a transaction to a contract function.
        
        Args:
            module: Contract name
            function: Function name
            args: List of arguments
            
        Returns:
            Transaction receipt
        """
        contract = self.contracts.get(module)
        if not contract:
            raise ValueError(f'{module} contract not loaded')
        
        tx = getattr(contract.functions, function)(*args).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def is_ecdsa(self, address: str) -> bool:
        """Check if address is an ECDSA address.
        
        Args:
            address: Address to check
        Returns:
            True if ECDSA address
        """

        if not Web3.is_address(address):
            return False
        code = self.w3.eth.get_code(Web3.to_checksum_address(address))
        return code == b''  

    def addy(self, key: str=None) -> str:
        if key == None:
            return self.account.address
        if self.is_ecdsa(key):
            return Web3.to_checksum_address(key)
        else:
            return m.key(key).address
        return acct.address

    def abi(self, name: str = 'usdc', search=None) -> list:
        """Get contract ABI by name.
        
        Args:
            name: Contract name
            
        Returns:
            Contract ABI
        """
        contract = self.ipfs.get(self.contracts_config().get(name.lower())['abi'])
        if search:
            contract = [item for item in contract if search in item.get('name', '')]
        return contract


    def contracts_config(self) -> Dict[str, Any]:
        contract_map = self.config['deployments'][self.network]['contracts']
        # lowercase all the keys 
        contract_map = {k.lower(): v for k, v in contract_map.items()}
        return contract_map
    
    def is_address(self, address: str) -> bool:
        """Check if string is a valid Ethereum address.
        
        Args:
            address: Address to check
        """
        return Web3.is_address(address)
    

    def balance(self,  address: str=None, token='market') -> int:
        """Get stable token balance.
        
        Args:
            address: Address to query
            
        Returns:
            Stable token balance
        """
        if not self.is_address(address):
            address = m.key(address).address

        address = Web3.to_checksum_address(address)

        if token == 'ETH':
            addr = address or self.account.address
            print(f'Getting ETH balance for {addr}')
            balance =  self.w3.eth.get_balance(addr)
        else:
            cfg =  self.contracts_config()[token.lower()]
            token_contract = self.w3.eth.contract(
                address=cfg['address'],
                abi=self.ipfs.get(cfg['abi'])
                )
            print(f'Getting {token} balance for {address} at {cfg["address"]}')
            balance = token_contract.functions.balanceOf(address).call()

        return self.format_balance(balance)

    def balances(self, address: str=None, tokens: list=None, token:str='market', from_block:int=0, to_block:int=None, weeks:int=2) -> dict:
        """Get balances for a single address across multiple tokens, or all holders for a single token.

        Args:
            address: Address to query (if provided, returns balances for this address across multiple tokens)
            tokens: List of token symbols (default ['ETH', 'USDC', 'USDT', 'MARKET'])
            token: Token symbol for getting all holders (used when address is None)
            from_block: Starting block to scan for holders (default: calculated from weeks)
            to_block: Ending block to scan (default: latest)
            weeks: Number of weeks to look back (default: 2)

        Returns:
            Dictionary mapping token symbols to balances (if address provided)
            OR dictionary mapping addresses to balances (if getting all holders for a token)
        """
        if address:
            # Get balances for a single address across multiple tokens
            if tokens is None:
                tokens = ['ETH', 'USDC', 'USDT', 'MARKET']

            balances = {}
            for tok in tokens:
                try:
                    balances[tok] = self.balance(address, tok)
                except Exception as e:
                    print(f'Error getting balance for {tok}: {e}')
                    balances[tok] = 0
            return balances
        else:
            # Get all holders for a single token by scanning Transfer events
            return self.scan_token_holders(token=token, from_block=from_block, to_block=to_block, weeks=weeks)

    def scan_token_holders(self, token:str='market', from_block:int=0, to_block:int=None, weeks:int=2, block_time:int=2, batch_size:int=10000) -> dict:
        """Scan blockchain for all token holders by analyzing Transfer events.

        Args:
            token: Token symbol to scan (default 'market')
            from_block: Starting block number (default: calculated from weeks)
            to_block: Ending block number (default: latest)
            weeks: Number of weeks to look back (default: 2)
            block_time: Average block time in seconds for Base chain (default: 2)
            batch_size: Number of blocks to scan per batch (default: 10000)

        Returns:
            Dictionary mapping addresses to their token balances
        """
        # Get token contract info
        token_lower = token.lower()
        cfg = self.contracts_config().get(token_lower)
        if not cfg:
            raise ValueError(f'Token {token} not found in config')

        token_address = cfg['address']
        token_abi = self.ipfs.get(cfg['abi'])
        token_contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(token_address),
            abi=token_abi
        )

        # Calculate block range
        if to_block is None:
            to_block = self.w3.eth.block_number

        if from_block == 0:
            # Calculate blocks for the time period
            # Base chain: ~2 second block time
            seconds_in_period = weeks * 7 * 24 * 60 * 60
            blocks_in_period = seconds_in_period // block_time
            from_block = max(0, to_block - blocks_in_period)

        total_blocks = to_block - from_block
        m.print(f'Scanning {token.upper()} transfers from block {from_block} to {to_block} ({total_blocks:,} blocks)', color='cyan')

        # Scan in batches to avoid RPC limits
        all_events = []
        current_block = from_block

        while current_block <= to_block:
            batch_end = min(current_block + batch_size - 1, to_block)

            try:
                m.print(f'Fetching events from block {current_block:,} to {batch_end:,}...', color='yellow')

                # Transfer event signature: Transfer(address indexed from, address indexed to, uint256 value)
                transfer_filter = token_contract.events.Transfer.create_filter(
                    fromBlock=current_block,
                    toBlock=batch_end
                )

                # Get events for this batch
                events = transfer_filter.get_all_entries()
                all_events.extend(events)
                m.print(f'  Found {len(events)} events in this batch', color='green')

            except Exception as e:
                m.print(f'Error fetching events for blocks {current_block}-{batch_end}: {e}', color='red')
                # Try with smaller batch size if failed
                if batch_size > 1000:
                    m.print(f'Retrying with smaller batch size...', color='yellow')
                    return self.scan_token_holders(token, from_block, to_block, weeks, block_time, batch_size=batch_size // 2)
                raise

            current_block = batch_end + 1

        m.print(f'Total events found: {len(all_events):,}', color='green')

        # Build balance map by tracking all transfers
        balances = {}
        zero_address = '0x0000000000000000000000000000000000000000'

        for event in all_events:
            from_addr = event['args']['from']
            to_addr = event['args']['to']
            value = event['args']['value']

            # Subtract from sender (unless it's a mint from zero address)
            if from_addr != zero_address:
                from_addr_lower = from_addr.lower()
                if from_addr_lower not in balances:
                    balances[from_addr_lower] = 0
                balances[from_addr_lower] -= value

            # Add to receiver (unless it's a burn to zero address)
            if to_addr != zero_address:
                to_addr_lower = to_addr.lower()
                if to_addr_lower not in balances:
                    balances[to_addr_lower] = 0
                balances[to_addr_lower] += value

        # Get current balances for all addresses that had transfers
        m.print(f'Fetching current balances for {len(balances):,} addresses...', color='yellow')
        final_balances = {}

        for i, addr in enumerate(balances.keys()):
            try:
                if (i + 1) % 100 == 0:
                    m.print(f'  Progress: {i + 1}/{len(balances)} addresses checked', color='cyan')

                current_balance = token_contract.functions.balanceOf(Web3.to_checksum_address(addr)).call()
                if current_balance > 0:
                    final_balances[addr] = self.format_balance(current_balance, token=token.upper())
            except Exception as e:
                m.print(f'Error getting balance for {addr}: {e}', color='red')
                continue

        m.print(f'Found {len(final_balances):,} addresses with non-zero balances', color='green')
        return final_balances

    def credits(self, address: str=None) -> int:
        """Get stable token balance.
        Args:
            address: Address to query
        Returns:
            Stable token balance
        """
        return self.balance(token='MARKET', address=address)
    
        # default
    bal = balance
    def format_balance(self, balance: int, token='ETH') -> float:
        """Format balance from wei to human-readable.
        
        Args:
            balance: Balance in wei

            token: Token symbol
        Returns:
            Formatted balance
        """
        decimals = self.decimals
        if token != 'ETH':
            chain_config = self.config['deployments'][self.network]['contracts']
            if token in chain_config:
                token_address = chain_config[token]['address']
                token_abi = self.ipfs.get(chain_config[token]['abi'])
                token_contract = self.w3.eth.contract(
                    address=Web3.to_checksum_address(token_address),
                    abi=token_abi
                    )
                decimals = token_contract.functions.decimals().call()
                print(f'Token {token} has {decimals} decimals')
        return balance / (10 ** decimals)


    def regall(self, mods: List[Dict[str, str]] = None) -> List[Dict[str, Any]]:
        if mods is None:
            mods = m.fn('api/mods')()
        receipts = []
        for mod in mods:
            try:
                receipt = self.reg(mod['name'], mod['cid'])
            except Exception as e:
                print(f'Error registering mod {mod["name"]}: {e}')
                continue
            receipts.append(receipt)

        return receipts


    def name2id(self, name: str=None) -> Union[int, Dict[str, int]]:
        """Get mod ID from name.
        
        Args:
            name: Mod name
            
        Returns:
            Mod ID
        """
        mods = self.mods()
        name2id = {mod['name']: mod['id'] for mod in mods}
        return name2id.get(name, name) if name else name2id

    def rmall(self) -> List[Dict[str, Any]]:
        """Delete all mods.
        
        Returns:
            List of transaction receipts
        """
        mods = self.mods()
        receipts = []
        for mod in mods:
            try:
                receipt = self.rm(mod['name'])
            except Exception as e:
                print(f'Error removing mod {mod["name"]}: {e}')
                continue
            receipts.append(receipt)
        return receipts

    def rm(self, name: int) -> Dict[str, Any]:
        """Delete mod by name.
        
        Args:
            name: Mod name
            
        Returns:
            Transaction receipt
        """
        registry = self.contracts.get('registry')
        if not registry:
            raise ValueError('Registry contract not loaded')
        mod_id = self.name2id(name)
        return self.send_tx('registry', 'removeMod', [mod_id])

    def update(self, name: int, data: str=None) -> Dict[str, Any]:
        """Update mod data.
        
        Args:
            mod_id: Mod ID
            data: New data
            
        Returns:
            Transaction receipt
        """
        if data is None:
            mod = m.fn('api/mod')(name)
            data = mod.get('cid', '')
        registry = self.contracts.get('registry')
        if not registry:
            raise ValueError('Registry contract not loaded')
        mod_id = self.name2id(name)
        return self.send_tx('registry', 'updateMod', [mod_id, data])

    def get_mod(self, mod_id: int) -> Dict[str, Any]:
        """Get mod information.
        
        Args:
            mod_id: Mod ID
            
        Returns:
            Mod info
        """
        registry = self.contracts.get('registry')
        if not registry:
            raise ValueError('Registry contract not loaded')
        
        info = registry.functions.getMod(mod_id).call()
        return {
            'owner': info[0],
            'name': info[1],
            'data': info[2]
        }

    # ==================== TOKENGATE FUNCTIONS ====================

    def debit(self, client, provider, amount): 
        """Debit stable tokens from client to provider.
        
        Args:
            client: Client address
            provider: Provider address
            amount: Amount to debit
        Returns:
            Transaction receipt
        """
        market = self.contracts.get('market')
        if not market:
            raise ValueError('Market contract not loaded')
        amount = int(amount * 10**self.decimals)
        client = Web3.to_checksum_address(client)
        provider = Web3.to_checksum_address(provider)
        tx = market.functions.debit(client, provider, amount).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        self.w3.eth.wait_for_transaction_receipt(tx_hash)
        # wait for finalize
        return '0x'+tx_hash.hex()
    

    def transfer(self, to: str, amount: int, token='market') -> Dict[str, Any]:
        """Transfer stable tokens to another address.
        
        Args:
            to: Recipient address
            amount: Amount to transfer
            
        Returns:
            Transaction receipt
        """
        market = self.contracts.get(token)
        if not market:
            raise ValueError('Market contract not loaded')
        amount = int(amount * 10**self.decimals)
        to = Web3.to_checksum_address(to)
        tx = market.functions.transfer(to, amount).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)
    

    def treasury(self) -> str:
        """Get treasury address.
        
        Returns:
            Treasury address
        """
        market = self.contracts.get('market')
        if not market:
            raise ValueError('Market contract not loaded')
        return market.functions.treasury().call()
    def totalTreasuryFeesAccrued(self) -> int:
        """Get total market treasury fees accrued.
        
        Returns:
            Total fees
        """
        market = self.contracts.get('market')
        if not market:
            raise ValueError('Market contract not loaded')
        value =  market.functions.totalTreasuryFeesAccrued().call()
        return self.format_balance(value, token='MARKET')

    def getUnclaimedTreasuryFeesUSD(self) -> int:
        """Get total market treasury fees.
        
        Returns:
            Total fees
        """
        market = self.contracts.get('market')
        if not market:
            raise ValueError('Market contract not loaded')
        return market.functions.getUnclaimedTreasuryFeesUSD().call()


    def tokens(self) -> List[str]:
        """Get all whitelisted tokens.
        
        Returns:
            List of token addresses
        """
        tokengate = self.contracts.get('tokengate')
        if not tokengate:
            raise ValueError('TokenGate contract not loaded')
        return tokengate.functions.getWhitelistedTokens().call()


    def whitelist_token(self, token_address: str) -> Dict[str, Any]:
        """Whitelist a token (owner only).
        
        Args:
            token_address: Token address
            
        Returns:
            Transaction receipt
        """
        tokengate = self.contracts.get('tokengate')
        if not tokengate:
            raise ValueError('TokenGate contract not loaded')
        
        tx = tokengate.functions.whitelistToken(token_address).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def is_token_whitelisted(self, token_address: str) -> bool:
        """Check if token is whitelisted.
        
        Args:
            token_address: Token address
            
        Returns:
            True if whitelisted
        """
        tokengate = self.contracts.get('tokengate')
        if not tokengate:
            raise ValueError('TokenGate contract not loaded')
        return tokengate.functions.isTokenWhitelisted(token_address).call()

    def get_token_price(self, token_address: str) -> Dict[str, Any]:
        """Get token price from oracle.
        
        Args:
            token_address: Token address
            
        Returns:
            Price info
        """
        tokengate = self.contracts.get('tokengate')
        if not tokengate:
            raise ValueError('TokenGate contract not loaded')
        
        info = tokengate.functions.getTokenPrice(token_address).call()
        return {
            'price': info[0],
            'decimals': info[1],
            'timestamp': info[2]
        }

    # ==================== TREASURY FUNCTIONS ====================

    def fund_treasury(self, token_address: str, amount: int) -> Dict[str, Any]:
        """Fund treasury with tokens.
        
        Args:
            token_address: Token address
            amount: Amount to fund
            
        Returns:
            Transaction receipt
        """
        treasury = self.contracts.get('treasury')
        if not treasury:
            raise ValueError('Treasury contract not loaded')
        
        # Approve tokens
        token = self.w3.eth.contract(
            address=Web3.to_checksum_address(token_address),
            abi=[{"constant":False,"inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"type":"function"}]
        )
        approve_tx = token.functions.approve(
            treasury.address, amount
        ).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(approve_tx, self.account.key)
        self.w3.eth.send_raw_transaction(signed.raw_transaction)
        
        # Fund treasury
        tx = treasury.functions.fundTreasury(token_address, amount).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def withdraw_from_treasury(self, token_address: str) -> Dict[str, Any]:
        """Withdraw proportional share from treasury.
        
        Args:
            token_address: Token address
            
        Returns:
            Transaction receipt
        """
        treasury = self.contracts.get('treasury')
        if not treasury:
            raise ValueError('Treasury contract not loaded')
        
        tx = treasury.functions.withdrawToken(token_address).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def get_claimable_amount(self, holder: str, token: str) -> int:
        """Get claimable amount for holder.
        
        Args:
            holder: Holder address
            token: Token address
            
        Returns:
            Claimable amount
        """
        treasury = self.contracts.get('treasury')
        if not treasury:
            raise ValueError('Treasury contract not loaded')
        return treasury.functions.getClaimableAmount(holder, token).call()


    def getMods(self):
        """Get all mods from registry."""
        registry = self.contracts.get('registry')
        if not registry:
            raise ValueError('Registry contract not loaded')
        mod_count = registry.functions.mods(1).call()
        return mod_count


    def modIds(self, address=None):
        """Get all mods for a user from registry."""
        registry = self.contracts.get('registry')
        if not registry:
            raise ValueError('Registry contract not loaded')
        addr = address or self.account.address
        mod_ids = registry.functions.getUserMods(addr).call()
        return mod_ids

    def mod_exists(self, mod: str) -> bool:
        """Check if mod exists in registry."""
        mod_id = self.name2id(mod)
        try:
            _ = self.get_mod(mod_id)
            return True
        except:
            return False
        

    def mods(self, address=None, keys=['id','data', 'name', ]):
        """Get all mods for a user from registry."""
        mod_ids = self.modIds(address=address)
        mods = []
        for mod_id in mod_ids:
            _mod = self.get_mod(mod_id)
            _mod['id'] = mod_id
            mod_info = {k: _mod[k] for k in keys}
            
            mods.append(mod_info)
            

        return mods

    def mymods(self):
        """Get all mods for the connected user from registry."""
        return self.mods(address=self.account.address)
        

    # ==================== UTILITY FUNCTIONS ====================

    def forward(self, x=1, y=2):
        """Legacy function."""
        return x + y

    def test(self):
        """Run contract tests."""
        dp = m.dp('chain')
        return os.system(f'cd {dp} && npm test')

    def compile(self, app_path='app'):
        """Compile contracts."""
        dp = m.dp('chain')
        compile_code = os.system(f'cd {dp} && npm run compile')
        artifacts_path = os.path.join(dp, 'artifacts', 'contracts')
        to_path = m.dp('app') + '/src/abi'
        return os.system('cp ' + artifacts_path + '/*.sol/*.json ' + to_path)

    def abifiles(self, search=None):
        """Get ABI files."""
        files = m.files(self.contracts_path, search=search)
        avoid_terms = ['dbg']
        results = [f for f in files if all([k not in f for k in avoid_terms])]
        return results

    def abifile2name(self, path):
        """Convert ABI file path to contract name."""
        return path.split('.sol/')[-2].split('/')[-1]

    def name2abifile(self, search=None):
        """Map contract names to ABI files."""
        abifiles = self.abifiles(search=search)
        return {self.abifile2name(f): f for f in abifiles}

    def abimap(self, search=None, expand=False):
        """Map contract names to ABIs."""
        name2abifile = self.name2abifile(search=search)
        name2abi = {}
        for name, path in name2abifile.items():
            with open(path, 'r') as f:
                data = json.load(f)
                name2abi[name] = data['abi'] if expand else self.ipfs.put(data['abi'])
        return name2abi


    def name2abicid(self, search=None):
        """Map contract names to ABI IPFS CIDs."""
        name2abicid = {}
        for name, v in self.abimap(search=search).items():
            name2abicid[name] = self.ipfs.put(v)
        return name2abicid

    def abimap_cid(self):
        """Get ABI IPFS CID for contract name."""
        return self.ipfs.put(self.name2abicid())

    def deploy(self, network: str = 'ganache'):
        """Deploy contracts."""
        self.compile()
        deployment =  os.system(f'cd {self.path} && npm run deploy:{network}')
        config = m.config('chain')
        apimap = self.abimap()
        deployment = config['deployments'][network]
        for name, info in deployment['contracts'].items():
            config['deployments'][network]['contracts'][name]['abi'] = apimap[info['contract']]
        m.save_config('chain', config)
        app_config = m.config('app')
        app_config['chain'] = config['deployments']
        m.save_config('app', app_config)
        return deployment

    def ganache(self, port: int = 8545):
        """Start Ganache."""
        return os.system(f'cd {self.path} && docker-compose up -d ganache')

    # ==================== RAW TRANSACTION FUNCTIONS ====================

    def rpc_call(self, method: str, params: list = None) -> Dict[str, Any]:
        """Make a raw JSON-RPC call to the Ethereum node.

        Args:
            method: RPC method name (e.g., 'eth_sendRawTransaction')
            params: List of parameters for the method

        Returns:
            JSON-RPC response
        """
        if params is None:
            params = []

        payload = {
            'jsonrpc': '2.0',
            'method': method,
            'params': params,
            'id': 1
        }

        response = requests.post(self.rpc_url, json=payload, headers={'Content-Type': 'application/json'})
        response.raise_for_status()
        result = response.json()

        if 'error' in result:
            raise Exception(f"RPC Error: {result['error']}")

        return result.get('result')

    def get_nonce(self, address: str) -> int:
        """Get transaction nonce for an address using raw RPC.

        Args:
            address: Ethereum address

        Returns:
            Current nonce
        """
        return int(self.rpc_call('eth_getTransactionCount', [address, 'latest']), 16)

    def get_gas_price(self) -> int:
        """Get current gas price using raw RPC.

        Returns:
            Gas price in wei
        """
        return int(self.rpc_call('eth_gasPrice'), 16)

    def estimate_gas(self, transaction: Dict[str, Any]) -> int:
        """Estimate gas for a transaction using raw RPC.

        Args:
            transaction: Transaction dictionary

        Returns:
            Estimated gas
        """
        return int(self.rpc_call('eth_estimateGas', [transaction]), 16)

    def build_transaction(self,
                         to: str,
                         data: str = '0x',
                         value: int = 0,
                         gas: int = None,
                         gas_price: int = None,
                         nonce: int = None,
                         chain_id: int = None) -> Dict[str, Any]:
        """Build a raw transaction dictionary.

        Args:
            to: Recipient address
            data: Transaction data (hex string)
            value: ETH value in wei
            gas: Gas limit (auto-estimated if None)
            gas_price: Gas price in wei (auto-fetched if None)
            nonce: Transaction nonce (auto-fetched if None)
            chain_id: Chain ID (uses network default if None)

        Returns:
            Transaction dictionary ready for signing
        """
        # Get chain ID
        if chain_id is None:
            chain_id = int(self.rpc_call('eth_chainId'), 16)

        # Build base transaction
        tx = {
            'to': Web3.to_checksum_address(to),
            'value': hex(value),
            'data': data,
            'chainId': hex(chain_id)
        }

        # Get nonce if not provided
        if nonce is None:
            nonce = self.get_nonce(self.account.address)
        tx['nonce'] = hex(nonce)

        # Get gas price if not provided
        if gas_price is None:
            gas_price = self.get_gas_price()
        tx['gasPrice'] = hex(gas_price)

        # Estimate gas if not provided
        if gas is None:
            gas = self.estimate_gas(tx)
        tx['gas'] = hex(gas)

        return tx

    def sign_transaction(self, transaction: Dict[str, Any], private_key: str = None) -> str:
        """Sign a transaction with a private key.

        Args:
            transaction: Transaction dictionary
            private_key: Private key (uses default account if None)

        Returns:
            Signed transaction as hex string
        """
        if private_key is None:
            private_key = self.account.key
        else:
            # Handle string private key
            if isinstance(private_key, str):
                if not private_key.startswith('0x'):
                    private_key = '0x' + private_key

        # Create account from private key
        account: LocalAccount = Account.from_key(private_key)

        # Sign the transaction
        signed = account.sign_transaction(transaction)

        # Return raw transaction as hex
        return signed.rawTransaction.hex()

    def send_raw_transaction(self, signed_tx: str) -> str:
        """Send a signed raw transaction using JSON-RPC.

        Args:
            signed_tx: Signed transaction hex string

        Returns:
            Transaction hash
        """
        if not signed_tx.startswith('0x'):
            signed_tx = '0x' + signed_tx

        tx_hash = self.rpc_call('eth_sendRawTransaction', [signed_tx])
        return tx_hash

    def wait_for_transaction(self, tx_hash: str, timeout: int = 120, poll_interval: int = 2) -> Dict[str, Any]:
        """Wait for a transaction to be mined using raw RPC.

        Args:
            tx_hash: Transaction hash
            timeout: Maximum wait time in seconds
            poll_interval: Polling interval in seconds

        Returns:
            Transaction receipt
        """
        import time

        if not tx_hash.startswith('0x'):
            tx_hash = '0x' + tx_hash

        start_time = time.time()

        while time.time() - start_time < timeout:
            try:
                receipt = self.rpc_call('eth_getTransactionReceipt', [tx_hash])
                if receipt is not None:
                    return receipt
            except Exception as e:
                m.print(f'Error getting receipt: {e}', color='red')

            time.sleep(poll_interval)

        raise TimeoutError(f'Transaction {tx_hash} not mined within {timeout} seconds')

    def raw_transfer(self,
                    to: str,
                    amount: float,
                    token: str = 'market',
                    private_key: str = None,
                    gas: int = None,
                    wait: bool = True) -> Dict[str, Any]:
        """Transfer tokens using raw transaction (no web3.py dependency).

        Args:
            to: Recipient address
            amount: Amount to transfer
            token: Token symbol (default 'market')
            private_key: Private key to sign with (uses default if None)
            gas: Gas limit (auto-estimated if None)
            wait: Wait for transaction to be mined

        Returns:
            Transaction hash or receipt (if wait=True)
        """
        # Get token contract info
        token_lower = token.lower()
        cfg = self.contracts_config().get(token_lower)
        if not cfg:
            raise ValueError(f'Token {token} not found in config')

        token_address = cfg['address']

        # Encode transfer function call
        # transfer(address to, uint256 amount)
        # Function selector: 0xa9059cbb
        amount_wei = int(amount * 10**self.decimals)
        to_padded = to[2:].zfill(64) if to.startswith('0x') else to.zfill(64)
        amount_hex = hex(amount_wei)[2:].zfill(64)
        data = f"0xa9059cbb{to_padded}{amount_hex}"

        # Build transaction
        tx = self.build_transaction(
            to=token_address,
            data=data,
            value=0,
            gas=gas
        )

        m.print(f'Transferring {amount} {token.upper()} to {to}...', color='cyan')

        # Sign transaction
        signed_tx = self.sign_transaction(tx, private_key)

        # Send transaction
        tx_hash = self.send_raw_transaction(signed_tx)
        m.print(f'Transaction sent: {tx_hash}', color='green')

        if wait:
            m.print('Waiting for confirmation...', color='yellow')
            receipt = self.wait_for_transaction(tx_hash)
            m.print('Transaction confirmed!', color='green')
            return {
                'hash': tx_hash,
                'receipt': receipt,
                'status': 'success' if receipt.get('status') == '0x1' else 'failed'
            }

        return {'hash': tx_hash, 'status': 'pending'}

    def raw_credit(self,
                   stable_amount: float,
                   payment_token: str = 'usdt',
                   private_key: str = None,
                   wait: bool = True) -> Dict[str, Any]:
        """Buy stable tokens using raw transactions.

        Args:
            stable_amount: Amount of stable tokens to buy
            payment_token: Payment token symbol
            private_key: Private key to sign with
            wait: Wait for transactions to be mined

        Returns:
            Transaction results
        """
        # Get market contract
        market_cfg = self.contracts_config().get('market')
        market_address = market_cfg['address']

        # Get payment token contract
        payment_cfg = self.contracts_config().get(payment_token.lower())
        payment_address = payment_cfg['address']

        # Get token price from TokenGate
        tokengate = self.contracts.get('tokengate')
        price_info = tokengate.functions.getTokenPrice(payment_address).call()
        token_price = price_info[0]
        token_decimals = price_info[1]

        # Calculate payment amount
        payment_amount = int((stable_amount * (10 ** token_decimals)) // token_price)

        m.print(f'Step 1: Approving {payment_amount / (10**token_decimals)} {payment_token.upper()}...', color='cyan')

        # Build approve transaction
        # approve(address spender, uint256 amount)
        # Function selector: 0x095ea7b3
        spender_padded = market_address[2:].zfill(64)
        amount_hex = hex(payment_amount)[2:].zfill(64)
        approve_data = f"0x095ea7b3{spender_padded}{amount_hex}"

        approve_tx = self.build_transaction(
            to=payment_address,
            data=approve_data,
            value=0
        )

        # Sign and send approve
        signed_approve = self.sign_transaction(approve_tx, private_key)
        approve_hash = self.send_raw_transaction(signed_approve)

        if wait:
            approve_receipt = self.wait_for_transaction(approve_hash)
            m.print(f'Approval confirmed: {approve_hash}', color='green')

        m.print(f'Step 2: Crediting {stable_amount} stable tokens...', color='cyan')

        # Build credit transaction
        # credit(address token, uint256 amount)
        # Function selector: 0x6bff1c3e (you'll need to check your contract ABI)
        # For now, using the web3 method - you can extract the data field from it
        market = self.contracts.get('market')
        credit_call = market.functions.credit(payment_address, int(stable_amount * 10**self.decimals))
        credit_data = credit_call._encode_transaction_data()

        credit_tx = self.build_transaction(
            to=market_address,
            data=credit_data,
            value=0
        )

        # Sign and send credit
        signed_credit = self.sign_transaction(credit_tx, private_key)
        credit_hash = self.send_raw_transaction(signed_credit)

        if wait:
            credit_receipt = self.wait_for_transaction(credit_hash)
            m.print(f'Credit confirmed: {credit_hash}', color='green')

            return {
                'approve_hash': approve_hash,
                'credit_hash': credit_hash,
                'status': 'success'
            }

        return {
            'approve_hash': approve_hash,
            'credit_hash': credit_hash,
            'status': 'pending'
        }

    def encode_function_call(self, contract_name: str, function_name: str, args: list) -> str:
        """Encode a function call for a contract.

        Args:
            contract_name: Name of contract (e.g., 'market')
            function_name: Name of function
            args: List of arguments

        Returns:
            Encoded data as hex string
        """
        contract = self.contracts.get(contract_name.lower())
        if not contract:
            raise ValueError(f'Contract {contract_name} not found')

        func = getattr(contract.functions, function_name)
        call = func(*args)
        return call._encode_transaction_data()

