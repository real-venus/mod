"""Safe contract module - Gnosis Safe deployment and interaction."""

from mod.core.chain.contracts.base import ContractMod
from web3 import Web3
import mod as m


class Mod(ContractMod):
    name = 'safe'
    contracts = ['Safe', 'SafeProxyFactory']
    dependencies = []

    def deploy(self, network='testnet', key=None, **deps):
        if key:
            self.set_key(key)
        if network:
            self.network = network

        singleton = self.deploy_contract('Safe', [], contract_key='SafeSingleton')
        factory = self.deploy_contract('SafeProxyFactory', [], contract_key='SafeProxyFactory')
        return {'SafeSingleton': singleton, 'SafeProxyFactory': factory}

    def create_safe(self, owners, threshold=1):
        owners = [Web3.to_checksum_address(o) for o in owners]
        singleton_addr = self.get_contract_config('SafeSingleton')['address']

        abi = self.get_abi('Safe')
        iface = self.w3.eth.contract(abi=abi)
        init_data = iface.encodeABI(
            fn_name='setup',
            args=[
                owners, threshold,
                '0x0000000000000000000000000000000000000000',
                b'',
                '0x0000000000000000000000000000000000000000',
                '0x0000000000000000000000000000000000000000',
                0,
                '0x0000000000000000000000000000000000000000',
            ]
        )

        receipt = self.send_tx('createProxyWithNonce',
                               [Web3.to_checksum_address(singleton_addr), init_data, 0],
                               contract_key='SafeProxyFactory')

        for log in receipt.logs:
            if len(log.topics) > 0:
                try:
                    factory = self.contract('SafeProxyFactory')
                    event = factory.events.ProxyCreation().process_log(log)
                    proxy_addr = event.args.proxy
                    m.print(f'Safe created at {proxy_addr}', color='green')
                    return proxy_addr
                except Exception:
                    continue

        return receipt
