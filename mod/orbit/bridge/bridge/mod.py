"""Bridge Module - Sr25519 to EVM Token Bridge

Provides interaction with:
- BridgeToken (ERC20 token for bridged assets)
- Bridge (Claim processing for sr25519 addresses)
"""

from time import time

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


class Bridge:
    """Bridge interface for Sr25519 to EVM token claims."""

    network2url = {
        'testnet': 'https://sepolia.base.org',
        'ganache': 'http://localhost:8545',
        'mainnet': 'https://mainnet.base.org'
    }
    conns = {}

    # Transaction configuration
    GAS_PRICE_MULTIPLIER = 1.2  # 20% increase for replacements
    GAS_LIMIT_BUFFER = 1.3  # 30% buffer on estimated gas
    MAX_RETRIES = 3
    NONCE_RETRY_DELAY = 1  # seconds

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

        # Load contracts

        self.set_config()
        self.contracts = {}
        self.load_contracts()
        # Load balances
        self.total_balances = self.get_total_balances()
        self.claims = self.get_claims()

        # Transaction management
        self._nonce_lock = {}  # Track pending nonces per address
        self._last_nonce = {}  # Cache last known nonce

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

    # ==================== TRANSACTION MANAGEMENT ====================

    def get_nonce(self, address: str = None, use_pending: bool = True) -> int:
        """Get next nonce for address with proper lock handling.

        Args:
            address: Address to get nonce for (defaults to account address)
            use_pending: If True, includes pending transactions

        Returns:
            Next available nonce
        """
        import time

        addr = address or self.account.address

        # Get nonce from chain (with pending if specified)
        nonce_param = 'pending' if use_pending else 'latest'
        chain_nonce = self.w3.eth.get_transaction_count(addr, nonce_param)

        # Check if we have a cached nonce that's higher
        cached_nonce = self._last_nonce.get(addr, -1)

        # Use the higher of chain nonce or cached nonce + 1
        nonce = max(chain_nonce, cached_nonce + 1)

        # Update cache
        self._last_nonce[addr] = nonce

        return nonce

    def reset_nonce(self, address: str = None):
        """Reset nonce cache for address.

        Args:
            address: Address to reset (defaults to account address)
        """
        addr = address or self.account.address
        if addr in self._last_nonce:
            del self._last_nonce[addr]
        if addr in self._nonce_lock:
            del self._nonce_lock[addr]


    def get_gas_price(self, multiplier: float = None) -> int:
        """Get gas price with optional multiplier.

        Args:
            multiplier: Multiplier for gas price (default: GAS_PRICE_MULTIPLIER)

        Returns:
            Gas price in wei
        """
        multiplier = multiplier or self.GAS_PRICE_MULTIPLIER
        base_price = self.w3.eth.gas_price
        return int(base_price * multiplier)

    def estimate_gas(self, tx_params: dict, buffer: float = None) -> int:
        """Estimate gas for transaction with buffer.

        Args:
            tx_params: Transaction parameters
            buffer: Gas limit buffer multiplier (default: GAS_LIMIT_BUFFER)

        Returns:
            Estimated gas with buffer
        """
        buffer = buffer or self.GAS_LIMIT_BUFFER
        try:
            estimated = self.w3.eth.estimate_gas(tx_params)
            return int(estimated * buffer)
        except Exception as e:
            m.print(f'Gas estimation failed: {e}, using default', color='yellow')
            return 500000  # Default fallback

    def build_transaction(self, contract_function, gas_limit: int = None) -> dict:
        """Build transaction with proper nonce and gas settings.

        Args:
            contract_function: Contract function to call
            gas_limit: Optional gas limit override

        Returns:
            Transaction parameters
        """
        # Build base transaction
        tx = contract_function.build_transaction({
            'from': self.account.address,
            'nonce': self.get_nonce(),
            'gasPrice': self.get_gas_price()
        })

        # Set gas limit
        if gas_limit:
            tx['gas'] = gas_limit
        else:
            # Estimate with buffer
            tx['gas'] = self.estimate_gas({
                'from': tx['from'],
                'to': tx['to'],
                'data': tx['data']
            })

        return tx

    def send_transaction(self, tx: dict, max_retries: int = None) -> Dict[str, Any]:
        """Send transaction with retry logic for nonce issues.

        Args:
            tx: Transaction parameters
            max_retries: Maximum retry attempts (default: MAX_RETRIES)

        Returns:
            Transaction receipt

        Raises:
            Exception: If transaction fails after retries
        """
        import time

        max_retries = max_retries or self.MAX_RETRIES
        last_error = None

        for attempt in range(max_retries):
            try:
                # Sign and send
                signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
                tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)

                m.print(f'Transaction sent: {tx_hash.hex()}', color='green')

                # Wait for receipt
                receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)

                if receipt['status'] == 1:
                    m.print(f'Transaction successful: {tx_hash.hex()}', color='green')
                    return receipt
                else:
                    raise Exception(f'Transaction failed: {receipt}')

            except Exception as e:
                error_msg = str(e).lower()
                last_error = e

                # Check if it's a nonce-related error
                if 'nonce' in error_msg or 'replacement' in error_msg or 'underpriced' in error_msg:
                    m.print(f'Attempt {attempt + 1}/{max_retries}: Nonce/gas issue - {e}', color='yellow')

                    if attempt < max_retries - 1:
                        # Reset nonce and increase gas price
                        self.reset_nonce()
                        time.sleep(self.NONCE_RETRY_DELAY)

                        # Update transaction with fresh nonce and higher gas price
                        tx['nonce'] = self.get_nonce()
                        tx['gasPrice'] = int(tx.get('gasPrice', self.get_gas_price()) * 1.1)

                        m.print(f'Retrying with nonce {tx["nonce"]} and gasPrice {tx["gasPrice"]}', color='cyan')
                        continue
                else:
                    # Non-recoverable error
                    m.print(f'Transaction failed: {e}', color='red')
                    raise

        # All retries exhausted
        raise Exception(f'Transaction failed after {max_retries} attempts: {last_error}')


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
        """Get claims balances.

        Returns:
            Dictionary mapping addresses to claims amounts
        """
        return self.store.get('claims.json', default={})

    def save_claims(self, claim = None):
        """Save claims balances."""
        if claim:
            self.claims[claim['address']] = claim
        return self.set_claims()
    

    def set_claims(self, claims: Dict[str, int] = None):
        """Set claims balances."""
        claims = claims if claims is not None else self.claims
        self.claims = claims
        self.store.put('claims.json', claims)
        return self.claims
    

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

        # Build and send transaction with retry logic
        tx = self.build_transaction(
            bridge.functions.processClaim(
                sr25519_hash,
                self.checksum(recipient),
                amount
            )
        )

        return self.send_transaction(tx)

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

        # Build and send transaction with retry logic
        tx = self.build_transaction(
            token.functions.burnFrom(
                self.checksum(address),
                amount
            )
        )

        return self.send_transaction(tx)

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

        # Build and send transaction with retry logic
        tx = self.build_transaction(
            bridge.functions.batchProcessClaims(
                addresses,
                recipients,
                amounts
            )
        )

        return self.send_transaction(tx)

    def has_claimed(self, address: str) -> bool:

        return address in self.claims
    

    def unclaimed(self, address:str):
        return self.total_balances.get(address, 0) - self.claims.get(address,{}).get('amount', 0)
    

    def reset_claims(self):
        """Reset all claims (for testing)."""
        self.claims = {}
        return self.set_claims()

    def reset_claim(self, address:str):
        if address in self.claims:
            del self.claims[address]
        
        # burn tokens if balance exists
        claim = self.claims.get(address)
        if claim:
            recipient = claim['recipient']
            balance = self.balance(recipient)
            if balance > 0:
                self.burn(recipient, balance)
            print(f'Reset claim for {address}, burned {balance} tokens from {recipient}', color='yellow')
        return self.set_claims({})

    def delete_claim(self, address: str):
        """Delete a claim (owner only).

        Args:
            address: Sr25519 address to delete claim for

        Returns:
            Success status
        """
        if address in self.claims:
            del self.claims[address]
            self.set_claims()
            return {'success': True, 'msg': f'Deleted claim for {address}'}
        return {'success': False, 'msg': f'No claim found for {address}'}

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

    def total_claims(self) -> int:
        """Get total amount claims across all addresses.

        Returns:
            Total claims amount
        """
        bridge = self.contracts.get('bridge')
        if not bridge:
            raise ValueError('Bridge contract not loaded')

        return bridge.functions.totalclaims().call()

    def owner(self) -> str:
        """Get the owner address of the bridge contract.

        Returns:
            Owner address
        """
        bridge = self.contracts.get('bridge')
        if not bridge:
            raise ValueError('Bridge contract not loaded')

        return bridge.functions.owner().call()

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

        # Build and send transaction with retry logic
        tx = self.build_transaction(
            token.functions.mint(
                self.checksum(to),
                amount
            )
        )

        return self.send_transaction(tx)

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

        # Build and send transaction with retry logic
        tx = self.build_transaction(
            token.functions.transfer(
                self.checksum(to),
                amount
            )
        )

        return self.send_transaction(tx)

    # ==================== AUTH VERIFICATION ====================

    def clear_claims(self):
        """Clear claims balances (for testing)."""
        self.set_claims({})
        return {'success': True, 'msg': 'Cleared claims balances'}
    



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
        # Mark as claims locally
        if amount == 0:
            return  f"No tokens to claim for address {address}"
        self.claims[address] = {"address": address, 'recipient': recipient, 'amount':  amount}
        self.set_claims(self.claims)
        self._ensure_balance(address)
        return f"Claim processed for address {address}, recipient {recipient}, amount {amount}"
        return self.claims[address]
        
    def _ensure_balance(self, address:str):

        claim = self.claims[address]
        recipient = claim['recipient']
        balance = self.balance(recipient)
        expected_amount = self.total_balances.get(address, 0)

        if balance > expected_amount:
            self.burn(recipient, balance - expected_amount)
        else:
            self.mint(recipient, expected_amount)

        amount = self.balance(recipient)
        while abs(amount - expected_amount) > 0.01:  # wait until balance is updated (with some tolerance for async processing)
            amount = self.balance(recipient)
            m.print(f'Waiting for balance to update... Current: {amount}, Expected: {expected_amount}', color='yellow')
        return amount


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

        # Build and send transaction with retry logic
        tx = self.build_transaction(
            getattr(contract.functions, function)(*args)
        )

        return self.send_transaction(tx)

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
