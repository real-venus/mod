"""Base class for contract-level modules.

Extends ContractModule but uses a local config.json per contract
to track deployments independently across chains.
"""

import os
import mod as m


class ContractMod:
    """Contract-level module base.

    Uses config.json in the contract directory (next to mod.py)
    instead of the chain-level config.json.

    Shared hardhat.config.js lives in contracts/ parent dir,
    so compile/test run from there with test path overrides.
    """

    @property
    def contracts_dir(self):
        """The contracts/ parent directory (contains shared hardhat.config.js)."""
        return os.path.dirname(os.path.abspath(__file__))

    def config(self):
        """Load local contract config.json."""
        config_path = os.path.join(self.module_path, 'config.json')
        if os.path.exists(config_path):
            return m.get_json(config_path)
        return {'deployments': {}}

    def save_config(self, config):
        """Save local contract config.json."""
        config_path = os.path.join(self.module_path, 'config.json')
        m.put_json(config_path, config)

    def compile(self):
        """Compile all contracts from contracts/ dir using shared hardhat config."""
        contracts_dir = self.contracts_dir
        chain_node_modules = os.path.join(self.chain_path, 'node_modules')
        local_node_modules = os.path.join(contracts_dir, 'node_modules')

        if not os.path.exists(local_node_modules) and os.path.exists(chain_node_modules):
            os.symlink(chain_node_modules, local_node_modules)

        m.print(f'Compiling contracts...', color='yellow')
        os.system(f'cd {contracts_dir} && npx hardhat compile')

    def test(self):
        """Run this contract's hardhat tests using shared config."""
        self.compile()
        test_dir = os.path.join(self.module_path, 'test')
        if not os.path.isdir(test_dir):
            m.print(f'{self.name}: no test/ directory found', color='yellow')
            return 1
        m.print(f'Running {self.name} tests...', color='cyan')
        contracts_dir = self.contracts_dir
        rel_test = os.path.relpath(test_dir, contracts_dir)
        return os.system(f'cd {contracts_dir} && npx hardhat test {rel_test}/*.test.js')
