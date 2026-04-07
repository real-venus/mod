"""Oracle contract module - price oracle deployment and interaction."""

from mod.core.chain.contracts.base import ContractMod
import mod as m


class Mod(ContractMod):
    name = 'oracle'
    contracts = ['ManualPriceOracle', 'ChainlinkAdapter', 'PythAdapter']
    dependencies = []

    ETH_SENTINEL = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

    CHAINLINK_ETH_USD = {
        'ethereum': '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
        'base': '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70',
        'arbitrum': '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612',
        'polygon': '0xF9680D99D6C9589e2a93a78A04A279e509205945',
    }
    MAINNET_NETWORKS = ['ethereum', 'base', 'arbitrum', 'polygon']

    def deploy(self, network='testnet', key=None, **deps):
        if key:
            self.set_key(key)
        if network:
            self.network = network

        is_mainnet = network in self.MAINNET_NETWORKS

        if is_mainnet and self.CHAINLINK_ETH_USD.get(network):
            address = self.deploy_contract('ChainlinkAdapter', [],
                                           contract_key='Oracle')
            eth_feed = self.CHAINLINK_ETH_USD[network]
            self.send_tx('setPriceFeed', [self.ETH_SENTINEL, eth_feed],
                         contract_key='Oracle')
            return address
        else:
            address = self.deploy_contract('ManualPriceOracle', [],
                                           contract_key='ManualPriceOracle')
            return address

    def setup(self, network='testnet', **deps):
        is_mainnet = network in self.MAINNET_NETWORKS
        if is_mainnet:
            return

        usd_price = 100_000_000
        eth_price = 300_000_000_000
        decimals = 8

        deployment = self.get_deployment()
        contracts = deployment.get('contracts', {})

        for token_key in ['USDC', 'USDT', 'DAI']:
            token_info = contracts.get(token_key)
            if token_info:
                self.send_tx('setPrice',
                             [token_info['address'], usd_price, decimals],
                             contract_key='ManualPriceOracle')

        self.send_tx('setPrice',
                     [self.ETH_SENTINEL, eth_price, decimals],
                     contract_key='ManualPriceOracle')
        m.print('Oracle prices set: stables=$1, ETH=$3000', color='green')

    def set_price(self, token_address, price, decimals=8):
        return self.send_tx('setPrice', [token_address, price, decimals],
                            contract_key='ManualPriceOracle')

    def get_price(self, token_address):
        oracle_key = 'Oracle' if self.contract('Oracle') else 'ManualPriceOracle'
        return self.call('getPrice', [token_address], contract_key=oracle_key)

    def transfer_ownership(self, new_owner):
        oracle_key = 'Oracle' if self.contract('Oracle') else 'ManualPriceOracle'
        return super().transfer_ownership(new_owner, contract_key=oracle_key)

    def owner(self, contract_key=None):
        oracle_key = contract_key or ('Oracle' if self.contract('Oracle') else 'ManualPriceOracle')
        return super().owner(contract_key=oracle_key)
