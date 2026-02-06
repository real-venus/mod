/**
 * Network configurations for different blockchains
 */

import { NetworkConfig } from '../types/wallet'

export const NETWORKS: Record<string, NetworkConfig> = {
  // Ethereum Mainnet
  ethereum: {
    chainId: '1',
    name: 'Ethereum Mainnet',
    networkType: 'ethereum',
    rpcUrl: process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    isTestnet: false,
  },

  // Base Mainnet (Ethereum L2)
  base: {
    chainId: '8453',
    name: 'Base',
    networkType: 'base',
    rpcUrl: process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    isTestnet: false,
  },

  // Base Sepolia Testnet
  baseTestnet: {
    chainId: '84532',
    name: 'Base Sepolia',
    networkType: 'base',
    rpcUrl: process.env.NEXT_PUBLIC_BASE_TESTNET_RPC_URL || 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia.basescan.org',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    isTestnet: true,
  },

  // Solana Mainnet
  solana: {
    chainId: 'mainnet-beta',
    name: 'Solana Mainnet',
    networkType: 'solana',
    rpcUrl:
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    blockExplorer: 'https://solscan.io',
    nativeCurrency: {
      name: 'Solana',
      symbol: 'SOL',
      decimals: 9,
    },
    isTestnet: false,
  },

  // Solana Devnet
  solanaDevnet: {
    chainId: 'devnet',
    name: 'Solana Devnet',
    networkType: 'solana',
    rpcUrl: 'https://api.devnet.solana.com',
    blockExplorer: 'https://solscan.io',
    nativeCurrency: {
      name: 'Solana',
      symbol: 'SOL',
      decimals: 9,
    },
    isTestnet: true,
  },
}

export const DEFAULT_NETWORK =
  process.env.NEXT_PUBLIC_DEFAULT_NETWORK === 'mainnet' ? 'base' : 'baseTestnet'

export const EVM_NETWORKS = ['ethereum', 'base', 'baseTestnet']
export const SOLANA_NETWORKS = ['solana', 'solanaDevnet']

export function getNetworkByChainId(chainId: string): NetworkConfig | undefined {
  return Object.values(NETWORKS).find((network) => network.chainId === chainId)
}

export function isEVMNetwork(chainId: string): boolean {
  const network = getNetworkByChainId(chainId)
  return network ? ['ethereum', 'base'].includes(network.networkType) : false
}

export function isSolanaNetwork(chainId: string): boolean {
  const network = getNetworkByChainId(chainId)
  return network?.networkType === 'solana'
}
