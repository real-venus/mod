"""Treasury contract module - proportional withdrawal treasury."""

from mod.core.chain.contracts.base import ContractMod  # noqa: E402
from web3 import Web3
import mod as m


class Mod(ContractMod):
    name = 'treasury'
    contracts = ['Treasury']
    dependencies = ['tokengate', 'bloctime']

    def deploy(self, network='testnet', key=None, **deps):
        if key:
            self.set_key(key)
        if network:
            self.network = network

        tokengate_address = deps.get('tokengate')
        if not tokengate_address:
            deployment = self.get_deployment()
            tokengate_address = deployment.get('contracts', {}).get('TokenGate', {}).get('address')
        if not tokengate_address:
            raise ValueError('TokenGate address required to deploy Treasury')

        owner_percentage = 2000
        address = self.deploy_contract('Treasury',
                                       [owner_percentage, Web3.to_checksum_address(tokengate_address)],
                                       contract_key='Treasury')
        return address

    def setup(self, network='testnet', **deps):
        bloctime_address = deps.get('bloctime')
        if not bloctime_address:
            deployment = self.get_deployment()
            bloctime_address = deployment.get('contracts', {}).get('BlocTime', {}).get('address')
        if bloctime_address:
            self.send_tx('setGovernanceToken',
                         [Web3.to_checksum_address(bloctime_address)],
                         contract_key='Treasury')
            m.print('Treasury governance token set to BlocTime', color='green')

    def fund(self, token_address, amount):
        token_address = Web3.to_checksum_address(token_address)
        return self.send_tx('fundTreasury', [token_address, amount],
                            contract_key='Treasury')

    def withdraw(self, token_address):
        token_address = Web3.to_checksum_address(token_address)
        return self.send_tx('withdrawToken', [token_address],
                            contract_key='Treasury')

    def get_claimable(self, holder, token_address):
        holder = Web3.to_checksum_address(holder)
        token_address = Web3.to_checksum_address(token_address)
        return self.call('getClaimableAmount', [holder, token_address],
                         contract_key='Treasury')

    def transfer_ownership(self, new_owner):
        return super().transfer_ownership(new_owner, contract_key='Treasury')

    def owner(self, contract_key=None):
        return super().owner(contract_key=contract_key or 'Treasury')
