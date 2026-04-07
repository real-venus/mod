"""Contracts CLI hub - list, create, and manage contract modules."""

import os
import json
import mod as m

CONTRACTS_DIR = os.path.dirname(os.path.abspath(__file__))

# Directories to skip when scanning for contract modules
SKIP = {'__pycache__', 'cache', 'artifacts', 'node_modules'}

SOL_TEMPLATE = '''// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract {Name} is Ownable, ReentrancyGuard {{
    constructor() {{}}
}}
'''

MOD_TEMPLATE = '''"""{Name} contract module."""

from mod.core.chain.contracts.base import ContractMod


class Mod(ContractMod):
    name = '{name}'
    contracts = ['{Name}']
    dependencies = []

    def deploy(self, network='testnet', key=None, **deps):
        if key:
            self.set_key(key)
        if network:
            self.network = network
        return self.deploy_contract('{Name}', [], contract_key='{Name}')
'''

TEST_TEMPLATE = '''const {{ expect }} = require("chai");
const {{ ethers }} = require("hardhat");

describe("{Name}", function () {{
  let contract, owner;

  beforeEach(async function () {{
    [owner] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("{Name}");
    contract = await Factory.deploy();
    await contract.waitForDeployment();
  }});

  it("should deploy successfully", async function () {{
    expect(await contract.getAddress()).to.be.properAddress;
  }});

  it("should set deployer as owner", async function () {{
    expect(await contract.owner()).to.equal(owner.address);
  }});
}});
'''


def _scan_contracts():
    """Scan for contract module subdirectories."""
    contracts = []
    for entry in sorted(os.listdir(CONTRACTS_DIR)):
        path = os.path.join(CONTRACTS_DIR, entry)
        if not os.path.isdir(path) or entry in SKIP or entry.startswith('.'):
            continue
        mod_file = os.path.join(path, 'mod.py')
        if os.path.isfile(mod_file):
            contracts.append(entry)
    return contracts


class Mod:
    name = 'contracts'

    def forward(self):
        """List all contract modules."""
        contracts = _scan_contracts()
        m.print(f'\n  contracts ({len(contracts)}):\n', color='cyan')
        for name in contracts:
            sol_files = [f for f in os.listdir(os.path.join(CONTRACTS_DIR, name))
                         if f.endswith('.sol')]
            sol_names = ', '.join(f.replace('.sol', '') for f in sol_files)
            m.print(f'    {name:<16} {sol_names}', color='white')
        m.print('')
        return contracts

    def create(self, name):
        """Scaffold a new contract module.

        Creates: {name}/mod.py, {Name}.sol, config.json, test/{Name}.test.js
        """
        if not name or not name.isidentifier():
            m.print(f'Invalid contract name: {name}', color='red')
            return None

        contract_dir = os.path.join(CONTRACTS_DIR, name)
        if os.path.exists(contract_dir):
            m.print(f'Contract "{name}" already exists', color='red')
            return None

        # PascalCase for Solidity
        cap_name = ''.join(w.capitalize() for w in name.split('_'))

        os.makedirs(contract_dir)
        os.makedirs(os.path.join(contract_dir, 'test'))

        # mod.py
        mod_content = MOD_TEMPLATE.format(name=name, Name=cap_name)
        with open(os.path.join(contract_dir, 'mod.py'), 'w') as f:
            f.write(mod_content)

        # Solidity contract
        sol_content = SOL_TEMPLATE.format(Name=cap_name)
        with open(os.path.join(contract_dir, f'{cap_name}.sol'), 'w') as f:
            f.write(sol_content)

        # config.json
        with open(os.path.join(contract_dir, 'config.json'), 'w') as f:
            json.dump({'deployments': {}}, f, indent=2)

        # test file
        test_content = TEST_TEMPLATE.format(Name=cap_name)
        with open(os.path.join(contract_dir, 'test', f'{cap_name}.test.js'), 'w') as f:
            f.write(test_content)

        m.print(f'\n  Created contract: {name}', color='green')
        m.print(f'    {name}/{cap_name}.sol', color='white')
        m.print(f'    {name}/mod.py', color='white')
        m.print(f'    {name}/config.json', color='white')
        m.print(f'    {name}/test/{cap_name}.test.js\n', color='white')

        return contract_dir

    def ls(self):
        """Alias for forward."""
        return self.forward()
