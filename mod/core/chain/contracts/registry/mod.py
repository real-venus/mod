"""Registry contract module - mod registration on-chain."""

from mod.core.chain.contracts.base import ContractMod
from web3 import Web3


class Mod(ContractMod):
    name = 'registry'
    contracts = ['Registry']
    dependencies = []

    def deploy(self, network='testnet', key=None, **deps):
        if key:
            self.set_key(key)
        if network:
            self.network = network

        address = self.deploy_contract('Registry', [], contract_key='Registry')
        return address

    def register_mod(self, name, data):
        return self.send_tx('registerMod', [name, data], contract_key='Registry')

    def update_mod(self, mod_id, data):
        return self.send_tx('updateMod', [mod_id, data], contract_key='Registry')

    def remove_mod(self, mod_id):
        return self.send_tx('removeMod', [mod_id], contract_key='Registry')

    def get_mod(self, mod_id):
        info = self.call('getMod', [mod_id], contract_key='Registry')
        return {'owner': info[0], 'name': info[1], 'data': info[2]}

    def get_user_mods(self, address):
        address = Web3.to_checksum_address(address)
        return self.call('getUserMods', [address], contract_key='Registry')

    def is_name_taken(self, creator, name):
        creator = Web3.to_checksum_address(creator)
        return self.call('isNameTaken', [creator, name], contract_key='Registry')
