"""BlocTime Protocol Python Interface

Provides comprehensive interaction with all BlocTime smart contracts including:
- Staking (BlocTimeStaking)
- Registry (Module registration and blocktime purchases)
- Marketplace (Buying bloctime with whitelisted tokens)
- PayMod (Payment token whitelist and pricing)
- Treasury (Multi-token treasury with proportional withdrawals)
- Integration (System health checks and validation)
"""

from web3 import Web3
from typing import Dict, Any, Optional, List, Tuple
import json
import os


class Mod:
    """BlocTime Protocol Interface for Python."""

    def __init__(self, rpc_url: str = 'http://localhost:8545'):
        """Initialize BlocTime interface.
        
        Args:
            rpc_url: Ethereum RPC endpoint
        """
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        self.contracts = {}
        self.account = None

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
            name: Contract identifier (e.g., 'staking', 'marketplace', 'registry', 'paymod', 'treasury', 'integration')
            address: Contract address
            abi: Contract ABI
        """
        self.contracts[name] = self.w3.eth.contract(
            address=Web3.to_checksum_address(address),
            abi=abi
        )
        return self.contracts[name]

    def load_all_contracts(self, addresses: Dict[str, str], abis: Dict[str, list]):
        """Load all BlocTime contracts at once.
        
        Args:
            addresses: Dict mapping contract names to addresses
            abis: Dict mapping contract names to ABIs
        """
        for name in ['staking', 'marketplace', 'registry', 'paymod', 'treasury', 'integration', 'bloctime_token', 'native_token']:
            if name in addresses and name in abis:
                self.load_contract(name, addresses[name], abis[name])

    # ==================== STAKING FUNCTIONS ====================

    def stake(self, amount: int, lock_blocks: int) -> Dict[str, Any]:
        """Stake tokens to earn BlocTime.
        
        Args:
            amount: Amount to stake (in wei)
            lock_blocks: Number of blocks to lock
            
        Returns:
            Transaction receipt
        """
        staking = self.contracts.get('staking')
        if not staking:
            raise ValueError('Staking contract not loaded')
        
        # Approve tokens first
        native_token = self.contracts.get('native_token')
        if native_token:
            approve_tx = native_token.functions.approve(
                staking.address, amount
            ).build_transaction({
                'from': self.account.address,
                'nonce': self.w3.eth.get_transaction_count(self.account.address)
            })
            signed = self.w3.eth.account.sign_transaction(approve_tx, self.account.key)
            self.w3.eth.send_raw_transaction(signed.rawTransaction)
        
        # Stake
        tx = staking.functions.stake(amount, lock_blocks).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def unstake(self, stake_id: int) -> Dict[str, Any]:
        """Unstake specific stake position after lock period.
        
        Args:
            stake_id: Stake ID to unstake
            
        Returns:
            Transaction receipt
        """
        staking = self.contracts.get('staking')
        if not staking:
            raise ValueError('Staking contract not loaded')
        
        tx = staking.functions.unstake(stake_id).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def get_stake_position(self, address: Optional[str] = None, stake_id: int = 0) -> Dict[str, Any]:
        """Get specific stake position information.
        
        Args:
            address: Address to query (defaults to connected account)
            stake_id: Stake ID to query
            
        Returns:
            Stake position information dictionary
        """
        staking = self.contracts.get('staking')
        if not staking:
            raise ValueError('Staking contract not loaded')
        
        addr = address or self.account.address
        info = staking.functions.getStakePosition(addr, stake_id).call()
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
            address: Address to query (defaults to connected account)
            
        Returns:
            List of stake IDs
        """
        staking = self.contracts.get('staking')
        if not staking:
            raise ValueError('Staking contract not loaded')
        addr = address or self.account.address
        return staking.functions.getUserStakeIds(addr).call()

    def get_multiplier(self, block_count: int) -> int:
        """Get staking multiplier for block count.
        
        Args:
            block_count: Number of blocks to check
            
        Returns:
            Multiplier in basis points (10000 = 1x)
        """
        staking = self.contracts.get('staking')
        if not staking:
            raise ValueError('Staking contract not loaded')
        return staking.functions.getMultiplier(block_count).call()

    def set_staking_points(self, points: List[Tuple[int, int]]) -> Dict[str, Any]:
        """Set staking multiplier points (owner only).
        
        Args:
            points: List of (blocks, multiplier) tuples
            
        Returns:
            Transaction receipt
        """
        staking = self.contracts.get('staking')
        if not staking:
            raise ValueError('Staking contract not loaded')
        
        tx = staking.functions.setPoints(points).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    # ==================== REGISTRY FUNCTIONS ====================

    def register_module(self, data_hash: str, price_per_block: int) -> Dict[str, Any]:
        """Register a new module.
        
        Args:
            data_hash: IPFS hash of module metadata
            price_per_block: Price per block in wei
            
        Returns:
            Transaction receipt
        """
        registry = self.contracts.get('registry')
        if not registry:
            raise ValueError('Registry contract not loaded')
        
        tx = registry.functions.registerModule(
            data_hash, price_per_block
        ).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def update_module(self, module_id: int, price_per_block: int) -> Dict[str, Any]:
        """Update module price.
        
        Args:
            module_id: Module ID to update
            price_per_block: New price per block
            
        Returns:
            Transaction receipt
        """
        registry = self.contracts.get('registry')
        if not registry:
            raise ValueError('Registry contract not loaded')
        
        tx = registry.functions.updateModule(
            module_id, price_per_block
        ).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def deactivate_module(self, module_id: int) -> Dict[str, Any]:
        """Deactivate a module.
        
        Args:
            module_id: Module ID to deactivate
            
        Returns:
            Transaction receipt
        """
        registry = self.contracts.get('registry')
        if not registry:
            raise ValueError('Registry contract not loaded')
        
        tx = registry.functions.deactivateModule(module_id).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def buy_blocktime(self, module_id: int, blocks: int, value: int) -> Dict[str, Any]:
        """Buy blocktime for a module (pays in native currency).
        
        Args:
            module_id: Module ID
            blocks: Number of blocks to purchase
            value: Payment amount in wei
            
        Returns:
            Transaction receipt
        """
        registry = self.contracts.get('registry')
        if not registry:
            raise ValueError('Registry contract not loaded')
        
        tx = registry.functions.buyBlocktime(module_id, blocks).build_transaction({
            'from': self.account.address,
            'value': value,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def start_usage(self, purchase_id: int, expiry_block: int = 0) -> Dict[str, Any]:
        """Start consuming blocktime.
        
        Args:
            purchase_id: Purchase ID
            expiry_block: Optional expiry block (0 for no expiry)
            
        Returns:
            Transaction receipt
        """
        registry = self.contracts.get('registry')
        if not registry:
            raise ValueError('Registry contract not loaded')
        
        tx = registry.functions.startUsage(purchase_id, expiry_block).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def stop_usage(self, purchase_id: int) -> Dict[str, Any]:
        """Stop consuming blocktime.
        
        Args:
            purchase_id: Purchase ID
            
        Returns:
            Transaction receipt
        """
        registry = self.contracts.get('registry')
        if not registry:
            raise ValueError('Registry contract not loaded')
        
        tx = registry.functions.stopUsage(purchase_id).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def get_module(self, module_id: int) -> Dict[str, Any]:
        """Get module information.
        
        Args:
            module_id: Module ID to query
            
        Returns:
            Module information dictionary
        """
        registry = self.contracts.get('registry')
        if not registry:
            raise ValueError('Registry contract not loaded')
        
        info = registry.functions.getModule(module_id).call()
        return {
            'owner': info[0],
            'price_per_block': info[1],
            'data_hash': info[2],
            'active': info[3]
        }

    def get_purchase(self, purchase_id: int) -> Dict[str, Any]:
        """Get blocktime purchase information.
        
        Args:
            purchase_id: Purchase ID to query
            
        Returns:
            Purchase information dictionary
        """
        registry = self.contracts.get('registry')
        if not registry:
            raise ValueError('Registry contract not loaded')
        
        info = registry.functions.getPurchase(purchase_id).call()
        return {
            'user': info[0],
            'module_id': info[1],
            'blocks_purchased': info[2],
            'blocks_consumed': info[3],
            'start_block': info[4],
            'expiry_block': info[5],
            'is_active': info[6]
        }

    def get_remaining_blocks(self, purchase_id: int) -> int:
        """Get remaining blocks for a purchase.
        
        Args:
            purchase_id: Purchase ID
            
        Returns:
            Remaining blocks
        """
        registry = self.contracts.get('registry')
        if not registry:
            raise ValueError('Registry contract not loaded')
        return registry.functions.getRemainingBlocks(purchase_id).call()

    # ==================== MARKETPLACE FUNCTIONS ====================

    def buy_bloctime(self, payment_token: str, bloctime_amount: int) -> Dict[str, Any]:
        """Buy bloctime tokens with whitelisted payment token.
        
        Args:
            payment_token: ERC20 token address for payment
            bloctime_amount: Amount of bloctime to buy
            
        Returns:
            Transaction receipt
        """
        marketplace = self.contracts.get('marketplace')
        if not marketplace:
            raise ValueError('Marketplace contract not loaded')
        
        # Calculate payment amount
        paymod = self.contracts.get('paymod')
        if paymod:
            bloctime_price = marketplace.functions.blocTimePriceUSD().call()
            payment_amount = paymod.functions.calculatePayment(
                payment_token, bloctime_amount, bloctime_price
            ).call()
            
            # Approve payment token
            token = self.w3.eth.contract(
                address=Web3.to_checksum_address(payment_token),
                abi=[{"constant":False,"inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"type":"function"}]
            )
            approve_tx = token.functions.approve(
                marketplace.address, payment_amount
            ).build_transaction({
                'from': self.account.address,
                'nonce': self.w3.eth.get_transaction_count(self.account.address)
            })
            signed = self.w3.eth.account.sign_transaction(approve_tx, self.account.key)
            self.w3.eth.send_raw_transaction(signed.rawTransaction)
        
        # Buy bloctime
        tx = marketplace.functions.buy(payment_token, bloctime_amount).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def start_bloctime(self) -> Dict[str, Any]:
        """Start bloctime consumption session.
        
        Returns:
            Transaction receipt
        """
        marketplace = self.contracts.get('marketplace')
        if not marketplace:
            raise ValueError('Marketplace contract not loaded')
        
        tx = marketplace.functions.startBlocTime().build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def stop_bloctime(self) -> Dict[str, Any]:
        """Stop bloctime consumption session.
        
        Returns:
            Transaction receipt
        """
        marketplace = self.contracts.get('marketplace')
        if not marketplace:
            raise ValueError('Marketplace contract not loaded')
        
        tx = marketplace.functions.stopBlocTime().build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def transfer_bloctime(self, to: str, amount: int) -> Dict[str, Any]:
        """Transfer bloctime to another address.
        
        Args:
            to: Recipient address
            amount: Amount to transfer
            
        Returns:
            Transaction receipt
        """
        marketplace = self.contracts.get('marketplace')
        if not marketplace:
            raise ValueError('Marketplace contract not loaded')
        
        tx = marketplace.functions.transfer(to, amount).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def get_user_bloctime(self, address: Optional[str] = None) -> Dict[str, Any]:
        """Get user bloctime information.
        
        Args:
            address: Address to query (defaults to connected account)
            
        Returns:
            User bloctime information
        """
        marketplace = self.contracts.get('marketplace')
        if not marketplace:
            raise ValueError('Marketplace contract not loaded')
        
        addr = address or self.account.address
        info = marketplace.functions.getUserBlocTime(addr).call()
        return {
            'start_block': info[0],
            'stop_block': info[1],
            'total_bloctime': info[2],
            'remaining_bloctime': info[3]
        }

    # ==================== PAYMOD FUNCTIONS ====================

    def set_token_prices(self, tokens: List[str], prices: List[int], decimals: List[int]) -> Dict[str, Any]:
        """Set payment token prices (owner only).
        
        Args:
            tokens: List of token addresses
            prices: List of prices in USD (8 decimals)
            decimals: List of token decimals
            
        Returns:
            Transaction receipt
        """
        paymod = self.contracts.get('paymod')
        if not paymod:
            raise ValueError('PayMod contract not loaded')
        
        tx = paymod.functions.setPrices(tokens, prices, decimals).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def is_token_whitelisted(self, token_address: str) -> bool:
        """Check if token is whitelisted.
        
        Args:
            token_address: Token address to check
            
        Returns:
            True if whitelisted
        """
        paymod = self.contracts.get('paymod')
        if not paymod:
            raise ValueError('PayMod contract not loaded')
        return paymod.functions.isTokenModed(token_address).call()

    def get_token_price(self, token_address: str) -> Dict[str, Any]:
        """Get token price information.
        
        Args:
            token_address: Token address
            
        Returns:
            Price information dictionary
        """
        paymod = self.contracts.get('paymod')
        if not paymod:
            raise ValueError('PayMod contract not loaded')
        
        info = paymod.functions.getTokenPrice(token_address).call()
        return {
            'price': info[0],
            'decimals': info[1],
            'timestamp': info[2]
        }

    def get_whitelisted_tokens(self) -> List[Dict[str, Any]]:
        """Get all whitelisted tokens.
        
        Returns:
            List of token information dictionaries
        """
        paymod = self.contracts.get('paymod')
        if not paymod:
            raise ValueError('PayMod contract not loaded')
        return paymod.functions.getTokenList().call()

    # ==================== TREASURY FUNCTIONS ====================

    def set_governance_token(self, token_address: str) -> Dict[str, Any]:
        """Set governance token for treasury (owner only).
        
        Args:
            token_address: Governance token address
            
        Returns:
            Transaction receipt
        """
        treasury = self.contracts.get('treasury')
        if not treasury:
            raise ValueError('Treasury contract not loaded')
        
        tx = treasury.functions.setGovernanceToken(token_address).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def add_treasury_token(self, token_address: str) -> Dict[str, Any]:
        """Add token to treasury (owner only).
        
        Args:
            token_address: Token address to add
            
        Returns:
            Transaction receipt
        """
        treasury = self.contracts.get('treasury')
        if not treasury:
            raise ValueError('Treasury contract not loaded')
        
        tx = treasury.functions.addTreasuryToken(token_address).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

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
            token_address: Token address to withdraw
            
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

    def withdraw_all_from_treasury(self) -> Dict[str, Any]:
        """Withdraw all proportional shares from treasury.
        
        Returns:
            Transaction receipt
        """
        treasury = self.contracts.get('treasury')
        if not treasury:
            raise ValueError('Treasury contract not loaded')
        
        tx = treasury.functions.withdrawAll().build_transaction({
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

    def get_all_claimable_amounts(self, holder: str) -> Dict[str, Any]:
        """Get all claimable amounts for holder.
        
        Args:
            holder: Holder address
            
        Returns:
            Dictionary with tokens and amounts
        """
        treasury = self.contracts.get('treasury')
        if not treasury:
            raise ValueError('Treasury contract not loaded')
        
        info = treasury.functions.getAllClaimableAmounts(holder).call()
        return {
            'tokens': info[0],
            'amounts': info[1]
        }

    def get_treasury_info(self) -> Dict[str, Any]:
        """Get treasury information.
        
        Returns:
            Treasury information dictionary
        """
        treasury = self.contracts.get('treasury')
        if not treasury:
            raise ValueError('Treasury contract not loaded')
        
        info = treasury.functions.getTreasuryInfo().call()
        return {
            'governance_token': info[0],
            'tokens': info[1],
            'balances': info[2],
            'total_claimed': info[3],
            'owner_percentage': info[4]
        }

    # ==================== INTEGRATION & SYSTEM FUNCTIONS ====================

    def get_system_stats(self) -> Dict[str, Any]:
        """Get comprehensive system statistics.
        
        Returns:
            System statistics dictionary
        """
        integration = self.contracts.get('integration')
        if not integration:
            raise ValueError('Integration contract not loaded')
        
        stats = integration.functions.getSystemStats().call()
        return {
            'total_modules': stats[0],
            'total_rentals': stats[1],
            'total_staked': stats[2],
            'total_bloctime': stats[3],
            'treasury_balance': stats[4]
        }

    def health_check(self) -> Dict[str, Any]:
        """Check system health.
        
        Returns:
            Health check results
        """
        integration = self.contracts.get('integration')
        if not integration:
            raise ValueError('Integration contract not loaded')
        
        health = integration.functions.healthCheck().call()
        return {
            'marketplace_healthy': health[0],
            'registry_healthy': health[1],
            'staking_healthy': health[2],
            'status': health[3]
        }

    def validate_module_registration(self, module_id: int) -> Dict[str, Any]:
        """Validate module registration.
        
        Args:
            module_id: Module ID to validate
            
        Returns:
            Validation result
        """
        integration = self.contracts.get('integration')
        if not integration:
            raise ValueError('Integration contract not loaded')
        
        result = integration.functions.validateModuleRegistration(module_id).call()
        return {
            'valid': result[0],
            'reason': result[1]
        }

    def validate_rental_flow(self, rental_id: int) -> Dict[str, Any]:
        """Validate rental flow.
        
        Args:
            rental_id: Rental ID to validate
            
        Returns:
            Validation result
        """
        integration = self.contracts.get('integration')
        if not integration:
            raise ValueError('Integration contract not loaded')
        
        result = integration.functions.validateRentalFlow(rental_id).call()
        return {
            'valid': result[0],
            'reason': result[1]
        }

    # ==================== DEPLOYMENT & TEST FUNCTIONS ====================

    def test_deploy_ganache(self):
        """Test deployment on Ganache network."""
        print("🚀 Testing deployment on Ganache...")
        result = os.system('cd /root/mod/mod/_mods/bloctime && npm run deploy:ganache')
        if result == 0:
            print("✅ Ganache deployment successful!")
        else:
            print("❌ Ganache deployment failed!")
        return result

    def test_deploy_base(self):
        """Test deployment on Base network."""
        print("🚀 Testing deployment on Base...")
        result = os.system('cd /root/mod/mod/_mods/bloctime && npm run deploy:base')
        if result == 0:
            print("✅ Base deployment successful!")
        else:
            print("❌ Base deployment failed!")
        return result

    def test_all_deployments(self):
        """Test deployments on both Ganache and Base."""
        print("🎯 Running all deployment tests...\n")
        ganache_result = self.test_deploy_ganache()
        print("\n" + "="*50 + "\n")
        base_result = self.test_deploy_base()
        print("\n" + "="*50)
        print("\n📊 Deployment Test Summary:")
        print(f"Ganache: {'✅ PASSED' if ganache_result == 0 else '❌ FAILED'}")
        print(f"Base: {'✅ PASSED' if base_result == 0 else '❌ FAILED'}")
        return ganache_result == 0 and base_result == 0

    def forward(self, x=1, y=2):
        """Legacy function for backward compatibility."""
        return x + y
