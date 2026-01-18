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

class Mod:
    """Simplified Chain Interface for New Contract Architecture."""

    network2url = {
        'testnet': 'https://sepolia.base.org',
        'local': 'http://localhost:8545',
        'mainnet': 'https://mainnet.base.org'
    }
    decimals = 18
    def __init__(self, network: str = 'testnet', key=None):
        """Initialize Chain interface.
        
        Args:
            rpc_url: Ethereum RPC endpoint
        """
        self.network = network
        self.rpc_url = self.network2url.get(network, network)
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
        if os.path.exists(env_path):
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
            abi = self.ipfs.get(info.get('abi'))
            self.load_contract(name, address, abi)

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
            self.w3.eth.send_raw_transaction(signed.rawTransaction)
        
        # Stake
        tx = bloctime.functions.stake(amount, lock_blocks).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
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
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
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

    def credit(self, payment_token: str, stable_amount: int) -> Dict[str, Any]:
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
        tokengate = self.contracts.get('tokengate')
        if tokengate:
            price_info = tokengate.functions.getTokenPrice(payment_token).call()
            token_price = price_info[0]
            token_decimals = price_info[1]
            
            # Calculate payment amount
            payment_amount = (stable_amount * (10 ** token_decimals)) // token_price
            
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
            self.w3.eth.send_raw_transaction(signed.rawTransaction)
        
        # Credit stable tokens
        tx = market.functions.credit(payment_token, stable_amount).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def debit(self, user:str, stable_amount: int) -> Dict[str, Any]:
        """Burn stable tokens.
        
        Args:
            stable_amount: Amount to burn
            
        Returns:
            Transaction receipt
        """
        market = self.contracts.get('market')
        if not market:
            raise ValueError('Market contract not loaded')
        stable_amount = int(stable_amount * 10**self.decimals)
        # assert the user 
        user = Web3.to_checksum_address(user)
        # 
        tx = market.functions.debit(user, stable_amount).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

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
        registry = self.contracts.get('registry')
        if not registry:
            raise ValueError('Registry contract not loaded')
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

    def balance(self, token='ETH',  address: str=None,) -> int:
        """Get stable token balance.
        
        Args:
            address: Address to query
            
        Returns:
            Stable token balance
        """
        address = self.addy(address)
        chain_config = self.config['deployments'][self.network]['contracts']
        if token == 'ETH':
            addr = address or self.account.address
            print(f'Getting ETH balance for {addr}')
            balance =  self.w3.eth.get_balance(addr)
        else:
            cfg =  self.contracts_config()[token.lower()]
            token_contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(cfg['address']),
                abi=self.ipfs.get(cfg['abi'])
                )
            balance = token_contract.functions.balanceOf(address).call()

        return self.format_balance(balance, token=token)

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
        return name2id.get(name, 0) if name else name2id

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
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
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
        self.w3.eth.send_raw_transaction(signed.rawTransaction)
        
        # Fund treasury
        tx = treasury.functions.fundTreasury(token_address, amount).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
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
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
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

