"""Chain API - HTTP endpoints for contract deployment and interaction."""

import mod as m
import threading
import time
import uuid


class Mod:
    """Chain API module.

    Exposes chain operations as API endpoints. Serve with:
        m serve chain.api
    """

    _deploys = {}  # deploy_id -> {status, result, error, started, finished}

    def __init__(self, network='testnet', key='test'):
        self.default_network = network
        self.default_key = key

    def _chain(self, network=None, key=None):
        """Get a chain instance."""
        return m.mod('chain')(
            network=network or self.default_network,
            key=key or self.default_key,
        )

    # ==================== DEPLOY ====================

    def deploy(self, network=None, mods=None, key=None, setup=True):
        """Deploy contracts asynchronously.

        Args:
            network: Target network (testnet/ganache/mainnet)
            mods: List of mod names to deploy, or None for all
            key: Signing key name
            setup: Run post-deploy setup

        Returns:
            deploy_id for polling status
        """
        deploy_id = str(uuid.uuid4())[:8]
        self._deploys[deploy_id] = {
            'status': 'running',
            'result': None,
            'error': None,
            'started': time.time(),
            'finished': None,
            'network': network or self.default_network,
            'mods': mods,
        }

        def _run():
            try:
                chain = self._chain(network, key)
                result = chain.deploy(
                    network=network,
                    mods=mods,
                    setup=setup,
                )
                self._deploys[deploy_id]['status'] = 'complete'
                self._deploys[deploy_id]['result'] = result
            except Exception as e:
                self._deploys[deploy_id]['status'] = 'failed'
                self._deploys[deploy_id]['error'] = str(e)
            finally:
                self._deploys[deploy_id]['finished'] = time.time()

        thread = threading.Thread(target=_run, daemon=True)
        thread.start()

        return {'deploy_id': deploy_id, 'status': 'running'}

    def deploy_sync(self, network=None, mods=None, key=None, setup=True):
        """Deploy contracts synchronously (blocking).

        Returns:
            Dict of module_name -> deployed addresses
        """
        chain = self._chain(network, key)
        return chain.deploy(network=network, mods=mods, setup=setup)

    def status(self, deploy_id=None, network=None):
        """Get deployment status or current chain config.

        Args:
            deploy_id: If provided, get status of async deploy
            network: If no deploy_id, get current config for network
        """
        if deploy_id:
            info = self._deploys.get(deploy_id)
            if not info:
                return {'error': f'Unknown deploy_id: {deploy_id}'}
            result = {
                'deploy_id': deploy_id,
                'status': info['status'],
                'network': info['network'],
                'mods': info['mods'],
                'started': info['started'],
                'finished': info['finished'],
            }
            if info['status'] == 'complete':
                result['result'] = info['result']
            elif info['status'] == 'failed':
                result['error'] = info['error']
            if info['finished'] and info['started']:
                result['duration'] = round(info['finished'] - info['started'], 2)
            return result

        return self.config(network)

    # ==================== READ ====================

    def call(self, contract, method, args=None, network=None):
        """Call a read-only contract method.

        Args:
            contract: Contract name (e.g. 'market', 'treasury')
            method: Method name (e.g. 'balanceOf', 'owner')
            args: List of arguments
            network: Target network
        """
        chain = self._chain(network)
        mod_instance = chain.mod(contract)
        result = mod_instance.call(method, args or [])
        return {'contract': contract, 'method': method, 'result': str(result)}

    def send(self, contract, method, args=None, network=None, key=None, value=0):
        """Send a transaction to a contract method.

        Args:
            contract: Contract name
            method: Method name
            args: List of arguments
            network: Target network
            key: Signing key name
            value: ETH value in wei
        """
        chain = self._chain(network, key)
        mod_instance = chain.mod(contract)
        receipt = mod_instance.send_tx(method, args or [], value=value)
        return {
            'contract': contract,
            'method': method,
            'tx_hash': receipt.transactionHash.hex(),
            'block': receipt.blockNumber,
            'status': 'success' if receipt.status == 1 else 'failed',
        }

    # ==================== CONFIG ====================

    def config(self, network=None):
        """Get chain deployment config.

        Args:
            network: Target network (returns all if None)
        """
        chain_config = m.config('chain')
        deployments = chain_config.get('deployments', {})
        if network:
            return deployments.get(network, {})
        return deployments

    def contracts(self, network=None):
        """Get deployed contract addresses.

        Args:
            network: Target network
        """
        network = network or self.default_network
        deployment = self.config(network)
        return deployment.get('contracts', {})

    # ==================== ABI ====================

    def methods(self, contract, network=None):
        """List available methods for a contract.

        Args:
            contract: Contract name (e.g. 'market', 'treasury')
            network: Target network
        """
        chain = self._chain(network)
        mod_instance = chain.mod(contract)
        contract_key = contract.capitalize()
        abi = mod_instance.get_abi(contract_key)
        if not abi:
            # Try the contracts list
            for name in mod_instance.contracts:
                abi = mod_instance.get_abi(name)
                if abi:
                    break
        if not abi:
            return {'error': f'No ABI found for {contract}'}

        methods = []
        for item in abi:
            if item.get('type') == 'function':
                inputs = [{'name': i['name'], 'type': i['type']}
                          for i in item.get('inputs', [])]
                outputs = [{'name': o.get('name', ''), 'type': o['type']}
                           for o in item.get('outputs', [])]
                methods.append({
                    'name': item['name'],
                    'inputs': inputs,
                    'outputs': outputs,
                    'stateMutability': item.get('stateMutability', ''),
                })
        return methods

    def abi(self, contract, network=None):
        """Get full ABI for a contract.

        Args:
            contract: Contract name
            network: Target network
        """
        chain = self._chain(network)
        mod_instance = chain.mod(contract)
        for name in mod_instance.contracts:
            abi = mod_instance.get_abi(name)
            if abi:
                return abi
        return []

    # ==================== INFO ====================

    def mods(self):
        """List available contract mods."""
        chain = self._chain()
        return chain.list_mods()

    def groups(self):
        """Get deploy group ordering."""
        chain = self._chain()
        return chain.DEPLOY_GROUPS

    def balance(self, address, token='market', network=None):
        """Get token balance."""
        chain = self._chain(network)
        return chain.balance(address, token=token)

    def forward(self):
        """Default endpoint - return API info."""
        return {
            'name': 'chain.api',
            'endpoints': [
                'deploy', 'deploy_sync', 'status',
                'call', 'send',
                'config', 'contracts',
                'methods', 'abi',
                'mods', 'groups', 'balance',
            ],
            'default_network': self.default_network,
        }
