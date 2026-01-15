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
from typing import Dict, Any, Optional, List
import json
import os
import mod as m

class Mod:
    """Simplified Chain Interface for New Contract Architecture."""

    def __init__(self, rpc_url: str = 'http://localhost:8545'):
        """Initialize Chain interface.
        
        Args:
            rpc_url: Ethereum RPC endpoint
        """
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        self.contracts = {}
        self.path = m.dp('chain')
        self.ipfs = m.mod('ipfs')()
        self.contracts_path = os.path.join(self.path, 'artifacts', 'contracts')
        self.dotenv_path = os.path.join(self.path, '.env')
        
        if not os.path.exists(self.contracts_path):
            os.makedirs(self.path)

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

    def load_all_contracts(self, addresses: Dict[str, str], abis: Dict[str, list]):
        """Load all contracts at once.
        
        Args:
            addresses: Dict mapping contract names to addresses
            abis: Dict mapping contract names to ABIs
        """
        for name in ['bloctime', 'market', 'registry', 'tokengate', 'treasury', 'perms', 'native_token']:
            if name in addresses and name in abis:
                self.load_contract(name, addresses[name], abis[name])

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

    def debit(self, stable_amount: int) -> Dict[str, Any]:
        """Burn stable tokens.
        
        Args:
            stable_amount: Amount to burn
            
        Returns:
            Transaction receipt
        """
        market = self.contracts.get('market')
        if not market:
            raise ValueError('Market contract not loaded')
        
        tx = market.functions.debit(stable_amount).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    # ==================== REGISTRY FUNCTIONS ====================

    def register_mod(self, name: str, data: str) -> Dict[str, Any]:
        """Register a new mod.
        
        Args:
            name: Unique name for the mod
            data: JSON metadata or IPFS hash
            
        Returns:
            Transaction receipt
        """
        registry = self.contracts.get('registry')
        if not registry:
            raise ValueError('Registry contract not loaded')
        
        tx = registry.functions.registerMod(name, data).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def update_mod(self, mod_id: int, data: str) -> Dict[str, Any]:
        """Update mod data.
        
        Args:
            mod_id: Mod ID
            data: New data
            
        Returns:
            Transaction receipt
        """
        registry = self.contracts.get('registry')
        if not registry:
            raise ValueError('Registry contract not loaded')
        
        tx = registry.functions.updateMod(mod_id, data).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

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

