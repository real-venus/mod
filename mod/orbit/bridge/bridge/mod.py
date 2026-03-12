"""Bridge Module - Sr25519 to EVM Token Bridge

Provides interaction with:
- BridgeToken (ERC20 token for bridged assets)
- Bridge (Claim processing for sr25519 addresses)
"""

import mod as m
import os
from web3 import Web3
from typing import Dict, Any, Optional, List
from eth_account import Account
from eth_account.signers.local import LocalAccount
import json

# Import ABI loader directly from same directory
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from abi import ABI


class Bridge:
    """Bridge interface for Sr25519 to EVM token claims."""

    network2url = {
        'testnet': 'https://sepolia.base.org',
        'ganache': 'http://localhost:8545',
        'mainnet': 'https://mainnet.base.org'
    }
    conns = {}

    def __init__(self, network: str = 'testnet', key='test', auth='auth'):
        """Initialize Bridge interface.

        Args:
            network: Network name or RPC URL
            key: Private key or key name
            auth: Auth module for sr25519 verification
        """
        # Network connection
        self.network = network
        self.rpc_url = self.network2url.get(network, network)

        if self.rpc_url in self.conns:
            self.w3 = self.conns[self.rpc_url]
        else:
            m.print(f'Connecting to {self.rpc_url} {network}', color='cyan')
            self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
            self.conns[self.rpc_url] = self.w3

        self.chain_id = self.w3.eth.chain_id

        # Module setup
        self.path = m.dp('bridge')
        self.set_key(key)

        # Auth module for sr25519 signatures
        self.crypto_type = 'sr25519'
        self.auth = m.mod(auth)(crypto_type=self.crypto_type)

        # Storage
        self.store = m.mod('store')('~/.mod/bridge')


        # Load ABIs from IPFS
        self.abi_loader = ABI()

        # Load contracts

        self.set_config()
        self.contracts = {}
        self.load_contracts()
        # Load balances
        self.total_balances = self.get_total_balances()
        self.claimed_balances = self.get_claims()


    def set_config(self, update=False):
        # Load config and ABIs
        self.config_path = os.path.join(self.path, 'deployment.json')
        self.config = m.get_json(self.config_path, default={})
        # check contracts and add ABIs if not present
        for contract in self.config.get(self.network, {}).get('contracts', {}):
            if 'abi' not in self.config[self.network]['contracts'][contract] or update:
                abi_map = self.abi_map()
                self.config[self.network]['contracts']['bridge']['abi'] = abi_map['Bridge']  # default to Bridge ABI if specific one not found
                self.config[self.network]['contracts']['token']['abi'] = abi_map['BridgeToken']  # default to BridgeToken ABI if specific one not found
                m.put_json(self.config_path, self.config)
        return self.config


    def add_abis(self):
        """Add ABIs to IPFS and update config."""
        # Compile contracts
        self.compile()

        # Upload ABIs to IPFS
        self.upload_abis()

        # Load new ABIs from IPFS
        self.load_contracts()

    def set_key(self, key='test'):
        self.key = m.key('test')
        self.connect(self.key.private_key)
        return self.account.address

    def connect(self, private_key: str):
        """Connect wallet using private key.

        Args:
            private_key: Private key for signing transactions

        Returns:
            Wallet address
        """
        self.account = self.w3.eth.account.from_key(private_key)
        return self.account.address

    def checksum(self, address: str) -> str:
        """Convert address to checksum format.

        Args:
            address: Ethereum address

        Returns:
            Checksum address
        """
        return Web3.to_checksum_address(address)
    

    def load_contracts(self) -> Dict[str, Any]:
        """Load bridge contracts with ABIs from IPFS.

        Returns:
            Dictionary of loaded contracts
        """
        try:


           for name, info in self.config.get(self.network, {}).get('contracts', {}).items():
                abi_cid = info.get('abi')
                address = info.get('address')
                abi = self.ipfs.get(abi_cid) if abi_cid else None
                if 'abi' in abi:
                    abi = abi['abi']  # handle case where IPFS content is wrapped in { abi: [...] }
                if abi and address:
                    contract = self.w3.eth.contract(address=self.checksum(address), abi=abi)
                    self.contracts[name] = contract

        except Exception as e:
            m.print(f'Error loading contracts: {e}', color='red')

        return self.contracts

    @property
    def ipfs(self):
        """IPFS client."""
        if not hasattr(self, '_ipfs'):
            self._ipfs = m.mod('ipfs')()
        return self._ipfs

    # ==================== BALANCE MANAGEMENT ====================

    @property
    def total_balances_path(self):
        """Path to total balances snapshot."""
        return os.path.join(self.path, 'total_balances.json')

    def get_total_balances(self) -> Dict[str, int]:
        """Get total balances snapshot.

        Returns:
            Dictionary mapping addresses to balances
        """
        path = self.total_balances_path
        if not os.path.exists(path):
            m.save_json({}, path)
        return m.get_json(path, default={})

    def save_total_balances(self):
        """Save total balances snapshot."""
        m.save_json(self.total_balances, self.total_balances_path)

    def get_claims(self) -> Dict[str, int]:
        """Get claimed balances.

        Returns:
            Dictionary mapping addresses to claimed amounts
        """
        return self.store.get('claimed_balances.json', default={})

    def save_claims(self):
        """Save claimed balances."""
        return self.store.put('claimed_balances.json', self.claimed_balances)

    def unclaimed(self, address: str) -> int:
        """Get unclaimed balance for address.

        Args:
            address: Address to query

        Returns:
            Unclaimed balance
        """
        claimed = self.claimed_balances.get(address, 0)
        total = self.total_balances.get(address, 0)
        return total - claimed

    # ==================== BRIDGE FUNCTIONS ====================

    def process_claim(self, address: str, recipient: str, amount: int) -> Dict[str, Any]:
        """Process a claim after off-chain verification.

        Args:
            address: Sr25519 address hash (bytes32)
            recipient: EVM address to receive tokens
            amount: Amount of tokens to distribute

        Returns:
            Transaction receipt
        """
        bridge = self.contracts.get('bridge')
        if not bridge:
            raise ValueError('Bridge contract not loaded')

        # Convert sr25519 address to bytes32
        if not address.startswith('0x'):
            sr25519_hash = Web3.solidity_keccak(['string'], [address])
        else:
            sr25519_hash = address

        tx = bridge.functions.processClaim(
            sr25519_hash,
            self.checksum(recipient),
            amount
        ).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })

        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def burn(self,address:str,  amount: int) -> Dict[str, Any]:
        """Burn tokens to initiate transfer back to original chain.

        Args:
            amount: Amount of tokens to burn

        Returns:
            Transaction receipt
        """
        token = self.contracts.get('token')
        if not token:
            raise ValueError('Token contract not loaded')
        
        amount = int(amount * (10 ** self.decimals()))  # convert to wei

        tx = token.functions.burn(
            amount
        ).build_transaction({
            'from': address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })

        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def batch_process_claims(self, claims: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Batch process multiple claims.

        Args:
            claims: List of claim dicts with keys: address, recipient, amount

        Returns:
            Transaction receipt
        """
        bridge = self.contracts.get('bridge')
        if not bridge:
            raise ValueError('Bridge contract not loaded')

        addresses = []
        recipients = []
        amounts = []

        for claim in claims:
            # Convert sr25519 address to bytes32
            sr25519_addr = claim['address']
            if not sr25519_addr.startswith('0x'):
                sr25519_hash = Web3.solidity_keccak(['string'], [sr25519_addr])
            else:
                sr25519_hash = sr25519_addr

            addresses.append(sr25519_hash)
            recipients.append(self.checksum(claim['recipient']))
            amounts.append(claim['amount'])

        tx = bridge.functions.batchProcessClaims(
            addresses,
            recipients,
            amounts
        ).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })

        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def has_claimed(self, address: str) -> bool:
        """Check if sr25519 address has claimed.

        Args:
            address: Sr25519 address or hash

        Returns:
            True if claimed
        """
        bridge = self.contracts.get('bridge')
        if not bridge:
            raise ValueError('Bridge contract not loaded')

        # Convert to bytes32
        if not address.startswith('0x'):
            sr25519_hash = Web3.solidity_keccak(['string'], [address])
        else:
            sr25519_hash = address

        return bridge.functions.hasClaimed(sr25519_hash).call()

    def claim_recipient(self, address: str) -> str:
        """Get EVM recipient for sr25519 address.

        Args:
            address: Sr25519 address or hash

        Returns:
            EVM address that received the claim
        """
        bridge = self.contracts.get('bridge')
        if not bridge:
            raise ValueError('Bridge contract not loaded')

        # Convert to bytes32
        if not address.startswith('0x'):
            sr25519_hash = Web3.solidity_keccak(['string'], [address])
        else:
            sr25519_hash = address

        return bridge.functions.claimRecipient(sr25519_hash).call()

    def total_claimed(self) -> int:
        """Get total amount claimed across all addresses.

        Returns:
            Total claimed amount
        """
        bridge = self.contracts.get('bridge')
        if not bridge:
            raise ValueError('Bridge contract not loaded')

        return bridge.functions.totalClaimed().call()

    # ==================== TOKEN FUNCTIONS ====================

    def balance(self, address: str = None) -> int:
        """Get token balance.

        Args:
            address: Address to query (defaults to operator)

        Returns:
            Token balance
        """
        token = self.contracts.get('token')
        if not token:
            raise ValueError('Token contract not loaded')

        addr = address or self.account.address
        balance = token.functions.balanceOf(self.checksum(addr)).call()
        return self.format_balance(balance)

    def format_balance(self, balance: int) -> float:
        """Format balance from wei to human-readable.

        Args:
            balance: Balance in wei

        Returns:
            Formatted balance
        """
        decimals = self.decimals()
        return balance / (10 ** decimals)

    def decimals(self) -> int:
        """Get token decimals.

        Returns:
            Number of decimals
        """
        token = self.contracts.get('token')
        if not token:
            return 18

        return token.functions.decimals().call()

    def mint(self, to: str, amount: int) -> Dict[str, Any]:
        """Mint tokens (owner only).

        Args:
            to: Recipient address
            amount: Amount to mint

        Returns:
            Transaction receipt
        """
        token = self.contracts.get('token')
        if not token:
            raise ValueError('Token contract not loaded')

        amount = int(amount * (10 ** self.decimals()))  # convert to wei
        tx = token.functions.mint(
            self.checksum(to),
            amount
        ).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })

        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def transfer(self, to: str, amount: int) -> Dict[str, Any]:
        """Transfer tokens.

        Args:
            to: Recipient address
            amount: Amount to transfer

        Returns:
            Transaction receipt
        """
        token = self.contracts.get('token')
        if not token:
            raise ValueError('Token contract not loaded')

        tx = token.functions.transfer(
            self.checksum(to),
            amount
        ).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })

        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    # ==================== AUTH VERIFICATION ====================

    def clear_claims(self):
        """Clear claimed balances (for testing)."""
        self.claimed_balances = {}
        self.save_claims()
        return {'success': True, 'msg': 'Cleared claimed balances'}

    def claim(self, auth_token: str, recipient: str) -> str:
        """Claim tokens with sr25519 signature verification.

        Args:
            token: Signed token from auth module

        Returns:
            Result message
        """
        # Verify sr25519 signature
        verified = self.auth.verify(auth_token)
        address = verified['key']

        # Check balances
        amount = self.total_balances.get(address, 0)
        assert self.claimed_balances.get(address, 0) == 0, "Tokens already claimed for this address"

        if amount > 0:
            # Mark as claimed locally
            self.claimed_balances[address] = amount
            self.save_claims()
            return f"Claimed {amount} tokens for address {address}"


        # tranfer tokens on-chain to recipient
        self.transfer(recipient, amount)

        return f"No tokens to claim for address {address}"

    def test(self):
        """Test claim flow."""
        token = self.auth.token('claim my tokens')
        result = self.claim(token)
        return result

    # ==================== UTILITY FUNCTIONS ====================

    def send_tx(self, contract_name: str, function: str, args: list) -> Dict[str, Any]:
        """Send a transaction to a contract function.

        Args:
            contract_name: Contract name ('bridge' or 'token')
            function: Function name
            args: List of arguments

        Returns:
            Transaction receipt
        """
        contract = self.contracts.get(contract_name)
        if not contract:
            raise ValueError(f'{contract_name} contract not loaded')

        tx = getattr(contract.functions, function)(*args).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })

        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def deploy(self, network=None):
        """Deploy bridge contracts."""
        if network:
            self.network = network
        os.system(f'cd {self.path} && npm run deploy:{self.network}')
        self.set_config(update=True)
        return self.config

    def compile(self):
        """Compile bridge contracts."""
        return os.system(f'cd {self.path} && npm run compile')

    def abi_map(self):
        """Upload ABIs to IPFS."""
        abi_map = {}
        # get all of the ABIs from the build directory
        build_path = os.path.join(self.path, 'artifacts/contracts')
        for filename in m.files(build_path):
            if filename.endswith('.json') and not filename.endswith('.dbg.json'):
                with open(os.path.join(build_path, filename)) as f:
                    abi = json.load(f)
                    abi_cid = self.ipfs.put(abi)
                    abi_map[filename.split('/')[-1].replace('.json', '')] = abi_cid
                    
        # now upload to IPFS
        # self.abi_loader.upload_all()
        # now get a map of contract name to IPFS hash and save to config
        return abi_map
