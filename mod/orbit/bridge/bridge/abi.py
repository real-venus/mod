"""ABI Management for Bridge Contracts

Provides utilities to load contract ABIs from IPFS
following the same pattern as the chain module.
"""

import mod as m
import os


class ABI:
    """ABI loader for bridge contracts."""

    def __init__(self):
        """Initialize ABI loader with IPFS."""
        self.ipfs = m.mod('ipfs')()
        # Load config from bridge module directory
        bridge_dir = m.dp('bridge')
        config_path = os.path.join(bridge_dir, 'bridge_config.json')
        self.config = m.get_json(config_path, default={})

    def get(self, contract_name: str) -> list:
        """Get ABI for a contract from IPFS.

        Args:
            contract_name: Name of the contract (e.g., 'BridgeToken', 'Bridge')

        Returns:
            Contract ABI as a list

        Raises:
            ValueError: If contract ABI not found
        """
        abis = self.config.get('abis', {})
        cid = abis.get(contract_name)

        if not cid:
            raise ValueError(f'ABI for {contract_name} not found in bridge_config.json')

        abi = self.ipfs.get(cid)

        if not abi:
            raise ValueError(f'Failed to fetch ABI from IPFS: {cid}')

        return abi

    def all(self) -> dict:
        """Get all contract ABIs.

        Returns:
            Dictionary mapping contract names to ABIs
        """
        abis = self.config.get('abis', {})
        result = {}

        for name, cid in abis.items():
            try:
                result[name] = self.ipfs.get(cid)
            except Exception as e:
                m.print(f'Error loading ABI for {name}: {e}', color='red')
                continue

        return result

    def cids(self) -> dict:
        """Get all ABI CIDs.

        Returns:
            Dictionary mapping contract names to IPFS CIDs
        """
        return self.config.get('abis', {})

    def upload(self, contract_name: str, abi: list) -> str:
        """Upload an ABI to IPFS and update config.

        Args:
            contract_name: Name of the contract
            abi: Contract ABI as a list

        Returns:
            IPFS CID of uploaded ABI
        """
        cid = self.ipfs.put(abi)

        # Update config
        if 'abis' not in self.config:
            self.config['abis'] = {}

        self.config['abis'][contract_name] = cid

        # Save config
        m.save_json(self.config, 'bridge_config.json')

        return cid
