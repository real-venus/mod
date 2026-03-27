"""BlocTime - Blockchain time-weighted staking module

Inherits full chain functionality (Web3, contracts, tokens, registry,
treasury, raw transactions, etc.) and adds BlocTime-specific helpers.
"""

import mod as m

# Import the chain core module
Chain = m.mod('chain')


class Mod(Chain):
    """BlocTime module - full chain interface with staking focus.

    Inherits all chain functionality:
    - Web3 connection & contract loading
    - BlocTime staking (stake, unstake, get_stake_position, etc.)
    - Market (credit, debit)
    - Registry (reg, rm, update, mods, etc.)
    - TokenGate (tokens, whitelist, prices)
    - Treasury (fund, withdraw, claimable)
    - Balances (balance, balances, scan_token_holders)
    - Raw transactions (rpc_call, raw_transfer, raw_credit, etc.)
    - Utilities (abi, abimap, deploy, compile, etc.)
    """

    description = "BlocTime - time-weighted staking with full chain interface"

    def __init__(self, network='testnet', key='test', **kwargs):
        super().__init__(network=network, key=key)

    def forward(self, a=None, b=None, **kwargs):
        """Default entry point - show staking overview for connected account."""
        if a is not None and b is not None:
            # legacy behavior
            return a + b
        return self.overview()

    def overview(self, address=None):
        """Get BlocTime staking overview for an address.

        Args:
            address: Address to query (defaults to connected account)

        Returns:
            Dict with stake positions and balances
        """
        addr = address or self.account.address
        stake_ids = self.get_user_stake_ids(addr)
        positions = []
        for sid in stake_ids:
            try:
                pos = self.get_stake_position(addr, sid)
                pos['stake_id'] = sid
                positions.append(pos)
            except Exception as e:
                m.print(f'Error getting stake {sid}: {e}', color='red')

        total_staked = sum(p.get('amount', 0) for p in positions)
        total_bloctime = sum(p.get('bloctime_balance', 0) for p in positions)

        return {
            'address': addr,
            'stake_count': len(positions),
            'total_staked': total_staked,
            'total_bloctime': total_bloctime,
            'positions': positions,
        }
