/**
 * Shared hardhat config for chain contract mods.
 * Each mod symlinks or copies this to its own directory.
 *
 * Sources: local ./contracts first, then all sibling mod contracts
 * for cross-mod test dependencies.
 */
const fs = require('fs');
const path = require('path');

require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// Collect all contract source dirs from sibling mods
const modsDir = path.resolve(__dirname, '..');
const contractSources = ['./contracts'];

// If running from inside a mod dir, also include sibling mod contracts
if (fs.existsSync(path.join(modsDir, 'base.py'))) {
  const siblings = fs.readdirSync(modsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && fs.existsSync(path.join(modsDir, d.name, 'contracts')))
    .map(d => path.join(modsDir, d.name, 'contracts'));
  // Will be handled via remappings below
}

module.exports = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    ganache: {
      url: process.env.GANACHE_URL || 'http://localhost:8545',
      accounts: {
        mnemonic: process.env.MNEMONIC || 'test test test test test test test test test test test junk',
      },
      chainId: 1337,
    },
    base_sepolia: {
      url: process.env.BASE_TESTNET_RPC_URL || 'https://sepolia.base.org',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 84532,
    },
    ethereum: {
      url: process.env.ETH_RPC_URL || 'https://eth.llamarpc.com',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 1,
    },
    base: {
      url: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 8453,
    },
    arbitrum: {
      url: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 42161,
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 137,
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
};
