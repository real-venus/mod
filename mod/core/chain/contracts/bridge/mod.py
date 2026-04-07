"""Bridge contract module - cross-chain bridgeable token."""

from mod.core.chain.contracts.base import ContractMod
from web3 import Web3


class Mod(ContractMod):
    name = 'bridge'
    contracts = ['BridgeableToken']
    dependencies = []

    def deploy(self, network='testnet', key=None, name='Bridge Token',
               symbol='BRG', initial_supply=0, **deps):
        if key:
            self.set_key(key)
        if network:
            self.network = network

        address = self.deploy_contract('BridgeableToken',
                                       [name, symbol, initial_supply],
                                       contract_key='Bridge')
        return address

    def bridge_mint(self, to, amount, bridge_id=''):
        to = Web3.to_checksum_address(to)
        return self.send_tx('bridgeMint', [to, amount, bridge_id],
                            contract_key='Bridge')

    def bridge_burn(self, from_addr, amount, bridge_id=''):
        from_addr = Web3.to_checksum_address(from_addr)
        return self.send_tx('bridgeBurn', [from_addr, amount, bridge_id],
                            contract_key='Bridge')

    def transfer_ownership(self, new_owner):
        return super().transfer_ownership(new_owner, contract_key='Bridge')

    def owner(self, contract_key=None):
        return super().owner(contract_key=contract_key or 'Bridge')
