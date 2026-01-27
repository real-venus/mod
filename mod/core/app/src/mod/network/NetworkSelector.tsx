'use client'

import { useState, useEffect } from 'react'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { CopyButton } from '@/mod/ui/CopyButton'

interface NetworkConfig {
  id: string
  name: string
  url: string
  color: string
  gradient: string
  isCustom?: boolean
  chainId?: string
  status?: 'online' | 'offline' | 'checking'
}

const DEFAULT_NETWORKS: NetworkConfig[] = [
  {
    id: 'local',
    name: 'Local Ganache',
    url: 'http://localhost:8545',
    color: '#10b981',
    gradient: 'from-emerald-500/20 to-green-500/20',
    chainId: '1337'
  },
  {
    id: 'base-sepolia',
    name: 'Base (Sepolia)',
    url: 'https://sepolia.base.org',
    color: '#0052ff',
    gradient: 'from-blue-500/20 to-indigo-500/20',
    chainId: '84532'
  },
  {
    id: 'base-mainnet',
    name: 'Base (Mainnet)',
    url: 'https://mainnet.base.org',
    color: '#0052ff',
    gradient: 'from-blue-600/20 to-indigo-600/20',
    chainId: '8453'
  }
]

export function NetworkSelector() {
  const [networks, setNetworks] = useState<NetworkConfig[]>(DEFAULT_NETWORKS)
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkConfig>(DEFAULT_NETWORKS[0])
  const [showDetails, setShowDetails] = useState(false)
  const [networkStatuses, setNetworkStatuses] = useState<Record<string, 'online' | 'offline' | 'checking'>>({})

  useEffect(() => {
    const savedNetworks = localStorage.getItem('custom_networks')
    const savedSelectedId = localStorage.getItem('selected_network')
    
    if (savedNetworks) {
      const customNetworks = JSON.parse(savedNetworks)
      setNetworks([...DEFAULT_NETWORKS, ...customNetworks])
    }
    
    if (savedSelectedId) {
      const allNetworks = savedNetworks ? [...DEFAULT_NETWORKS, ...JSON.parse(savedNetworks)] : DEFAULT_NETWORKS
      const network = allNetworks.find(n => n.id === savedSelectedId)
      if (network) setSelectedNetwork(network)
    }

    checkNetworkStatuses()
  }, [])

  const checkNetworkStatuses = async () => {
    const statuses: Record<string, 'online' | 'offline' | 'checking'> = {}
    
    for (const network of networks) {
      statuses[network.id] = 'checking'
      setNetworkStatuses({...statuses})
      
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000)
        
        const response = await fetch(network.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        statuses[network.id] = response.ok ? 'online' : 'offline'
      } catch (error) {
        statuses[network.id] = 'offline'
      }
      
      setNetworkStatuses({...statuses})
    }
  }

  const handleNetworkChange = (network: NetworkConfig) => {
    setSelectedNetwork(network)
    localStorage.setItem('selected_network', network.id)
    setShowDetails(false)
  }

  const getStatusIcon = (networkId: string) => {
    const status = networkStatuses[networkId]
    if (status === 'online') return <CheckCircleIcon className="w-4 h-4 text-green-400" />
    if (status === 'offline') return <XCircleIcon className="w-4 h-4 text-red-400" />
    return <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
  }

  return (
    <div className="relative">
      <div
        onMouseEnter={() => setShowDetails(true)}
        onMouseLeave={() => setShowDetails(false)}
        className="cursor-pointer"
      >
        <div
          className="flex items-center justify-center rounded-xl border-2 transition-all backdrop-blur-xl hover:scale-105 active:scale-95"
          style={{
            height: '60px',
            width: '60px',
            backgroundColor: `${selectedNetwork.color}15`,
            borderColor: `${selectedNetwork.color}60`,
            boxShadow: `0 0 20px ${selectedNetwork.color}30`
          }}
        >
          <div 
            className="w-4 h-4 rounded-full animate-pulse"
            style={{ backgroundColor: selectedNetwork.color }}
          />
        </div>

        {showDetails && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={(e) => {
                e.stopPropagation()
                setShowDetails(false)
              }}
            />
            <div className="absolute right-0 mt-2 w-96 bg-black/95 backdrop-blur-xl border-2 border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
              <div className="p-4 border-b-2 border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full animate-pulse"
                      style={{ backgroundColor: selectedNetwork.color }}
                    />
                    <span 
                      className="font-bold text-lg uppercase tracking-wider"
                      style={{ color: selectedNetwork.color }}
                    >
                      {selectedNetwork.name}
                    </span>
                  </div>
                  {getStatusIcon(selectedNetwork.id)}
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                    <div>
                      <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">RPC URL</div>
                      <div className="text-sm text-white font-mono break-all">{selectedNetwork.url}</div>
                    </div>
                    <CopyButton text={selectedNetwork.url} size="sm" />
                  </div>
                  
                  {selectedNetwork.chainId && (
                    <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                      <div>
                        <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Chain ID</div>
                        <div className="text-sm text-white font-mono">{selectedNetwork.chainId}</div>
                      </div>
                      <CopyButton text={selectedNetwork.chainId} size="sm" />
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                    <div>
                      <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Network ID</div>
                      <div className="text-sm text-white font-mono">{selectedNetwork.id}</div>
                    </div>
                    <CopyButton text={selectedNetwork.id} size="sm" />
                  </div>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto">
                {networks.map((network) => (
                  <button
                    key={network.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleNetworkChange(network)
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 transition-all hover:bg-white/5 ${
                      selectedNetwork.id === network.id ? 'bg-white/10' : ''
                    }`}
                    style={{
                      borderLeft: selectedNetwork.id === network.id ? `4px solid ${network.color}` : '4px solid transparent'
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: network.color }}
                      />
                      <span 
                        className="font-bold text-sm uppercase tracking-wide"
                        style={{ color: network.color }}
                      >
                        {network.name}
                      </span>
                    </div>
                    {getStatusIcon(network.id)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
