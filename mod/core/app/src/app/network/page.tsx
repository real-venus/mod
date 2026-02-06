"use client";

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline'
import { CopyButton } from '@/mod/ui/CopyButton'

export const dynamic = 'force-dynamic'

interface NetworkConfig {
  id: string
  name: string
  type: 'evm' | 'non-evm'
  url: string
  chainId?: string
  color: string
  gradient: string
  status?: 'online' | 'offline' | 'checking'
  comingSoon?: boolean
}

const EVM_NETWORKS: NetworkConfig[] = [
  {
    id: 'ethereum-mainnet',
    name: 'Ethereum Mainnet',
    type: 'evm',
    url: 'https://mainnet.infura.io/v3/YOUR-PROJECT-ID',
    chainId: '1',
    color: '#627eea',
    gradient: 'from-blue-500/20 to-indigo-500/20'
  },
  {
    id: 'ethereum-sepolia',
    name: 'Ethereum Sepolia',
    type: 'evm',
    url: 'https://sepolia.infura.io/v3/YOUR-PROJECT-ID',
    chainId: '11155111',
    color: '#627eea',
    gradient: 'from-blue-400/20 to-indigo-400/20'
  },
  {
    id: 'base-mainnet',
    name: 'Base Mainnet',
    type: 'evm',
    url: 'https://mainnet.base.org',
    chainId: '8453',
    color: '#0052ff',
    gradient: 'from-blue-600/20 to-indigo-600/20'
  },
  {
    id: 'base-sepolia',
    name: 'Base Sepolia',
    type: 'evm',
    url: 'https://sepolia.base.org',
    chainId: '84532',
    color: '#0052ff',
    gradient: 'from-blue-500/20 to-indigo-500/20'
  },
  {
    id: 'polygon-mainnet',
    name: 'Polygon Mainnet',
    type: 'evm',
    url: 'https://polygon-rpc.com',
    chainId: '137',
    color: '#8247e5',
    gradient: 'from-purple-500/20 to-violet-500/20'
  },
  {
    id: 'arbitrum-one',
    name: 'Arbitrum One',
    type: 'evm',
    url: 'https://arb1.arbitrum.io/rpc',
    chainId: '42161',
    color: '#28a0f0',
    gradient: 'from-cyan-500/20 to-blue-500/20'
  },
  {
    id: 'optimism-mainnet',
    name: 'Optimism Mainnet',
    type: 'evm',
    url: 'https://mainnet.optimism.io',
    chainId: '10',
    color: '#ff0420',
    gradient: 'from-red-500/20 to-pink-500/20'
  },
  {
    id: 'avalanche-c-chain',
    name: 'Avalanche C-Chain',
    type: 'evm',
    url: 'https://api.avax.network/ext/bc/C/rpc',
    chainId: '43114',
    color: '#e84142',
    gradient: 'from-red-400/20 to-orange-500/20'
  },
  {
    id: 'local-ganache',
    name: 'Local Ganache',
    type: 'evm',
    url: 'http://localhost:8545',
    chainId: '1337',
    color: '#10b981',
    gradient: 'from-emerald-500/20 to-green-500/20'
  }
]

const NON_EVM_NETWORKS: NetworkConfig[] = [
  {
    id: 'solana-mainnet',
    name: 'Solana Mainnet',
    type: 'non-evm',
    url: 'https://api.mainnet-beta.solana.com',
    color: '#14f195',
    gradient: 'from-green-400/20 to-emerald-500/20',
    comingSoon: true
  },
  {
    id: 'solana-devnet',
    name: 'Solana Devnet',
    type: 'non-evm',
    url: 'https://api.devnet.solana.com',
    color: '#14f195',
    gradient: 'from-green-300/20 to-emerald-400/20',
    comingSoon: true
  },
  {
    id: 'sui-mainnet',
    name: 'Sui Mainnet',
    type: 'non-evm',
    url: 'https://fullnode.mainnet.sui.io',
    color: '#4da2ff',
    gradient: 'from-blue-400/20 to-cyan-500/20',
    comingSoon: true
  },
  {
    id: 'sui-testnet',
    name: 'Sui Testnet',
    type: 'non-evm',
    url: 'https://fullnode.testnet.sui.io',
    color: '#4da2ff',
    gradient: 'from-blue-300/20 to-cyan-400/20',
    comingSoon: true
  }
]

export default function NetworkPage() {
  const [evmNetworks, setEvmNetworks] = useState<NetworkConfig[]>(EVM_NETWORKS)
  const [nonEvmNetworks, setNonEvmNetworks] = useState<NetworkConfig[]>(NON_EVM_NETWORKS)
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkConfig | null>(null)

  useEffect(() => {
    checkNetworkStatuses()
  }, [])

  const checkNetworkStatuses = async () => {
    const checkNetwork = async (network: NetworkConfig): Promise<NetworkConfig> => {
      if (network.comingSoon) {
        return { ...network, status: 'offline' }
      }

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000)

        console.log(`[Safari Debug] Checking network: ${network.name} at ${network.url}`)

        const response = await fetch(network.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
          signal: controller.signal,
          mode: 'cors',
          cache: 'no-cache',
        })

        clearTimeout(timeoutId)
        console.log(`[Safari Debug] Network ${network.name} status: ${response.status}`)
        return { ...network, status: response.ok ? 'online' : 'offline' }
      } catch (error: any) {
        console.error(`[Safari Debug] Network ${network.name} error:`, error.name, error.message)
        return { ...network, status: 'offline' }
      }
    }

    const updatedEvmNetworks = await Promise.all(evmNetworks.map(checkNetwork))
    setEvmNetworks(updatedEvmNetworks)
  }

  const getStatusIcon = (network: NetworkConfig) => {
    if (network.comingSoon) {
      return <ClockIcon className="w-5 h-5 text-yellow-400" />
    }
    if (network.status === 'online') return <CheckCircleIcon className="w-5 h-5 text-green-400" />
    if (network.status === 'offline') return <XCircleIcon className="w-5 h-5 text-red-400" />
    return <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
  }

  const NetworkCard = ({ network }: { network: NetworkConfig }) => (
    <motion.div
      whileHover={{ scale: 1.02 }}
      onClick={() => !network.comingSoon && setSelectedNetwork(network)}
      className={`relative p-6 rounded-xl border-2 transition-all backdrop-blur-xl ${
        network.comingSoon ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:shadow-2xl'
      } ${selectedNetwork?.id === network.id ? 'ring-2 ring-offset-2 ring-offset-black' : ''}`}
      style={{
        backgroundColor: `${network.color}08`,
        borderColor: `${network.color}60`,
        boxShadow: `0 0 20px ${network.color}30`,
      }}
    >
      {network.comingSoon && (
        <div className="absolute top-3 right-3 px-3 py-1 bg-yellow-500/20 border border-yellow-500/40 rounded-full text-yellow-400 text-xs font-bold uppercase tracking-wide">
          Coming Soon
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: network.color }}
          />
          <h3 className="text-xl font-black uppercase tracking-wider" style={{ color: network.color }}>
            {network.name}
          </h3>
        </div>
        {getStatusIcon(network)}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between bg-white/5 rounded-lg p-3 border border-white/10">
          <div className="flex-1">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1 font-bold">RPC URL</div>
            <div className="text-sm text-white font-mono break-all">{network.url}</div>
          </div>
          {!network.comingSoon && <CopyButton text={network.url} size="sm" />}
        </div>

        {network.chainId && (
          <div className="flex items-center justify-between bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="flex-1">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1 font-bold">Chain ID</div>
              <div className="text-sm text-white font-mono">{network.chainId}</div>
            </div>
            <CopyButton text={network.chainId} size="sm" />
          </div>
        )}

        <div className="flex items-center justify-between bg-white/5 rounded-lg p-3 border border-white/10">
          <div className="flex-1">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1 font-bold">Type</div>
            <div className="text-sm text-white font-mono uppercase">{network.type}</div>
          </div>
        </div>
      </div>
    </motion.div>
  )

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-black uppercase tracking-wider mb-2 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            Network Selection
          </h1>
          <p className="text-gray-400 font-mono">Choose your blockchain network</p>
        </div>

        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full" />
            <h2 className="text-2xl font-black uppercase tracking-wider text-blue-400">EVM Networks</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-blue-500/50 to-transparent" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {evmNetworks.map((network) => (
              <NetworkCard key={network.id} network={network} />
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-8 bg-gradient-to-b from-green-500 to-emerald-500 rounded-full" />
            <h2 className="text-2xl font-black uppercase tracking-wider text-green-400">Non-EVM Networks</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-green-500/50 to-transparent" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {nonEvmNetworks.map((network) => (
              <NetworkCard key={network.id} network={network} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}