'use client'

import { useState, useEffect } from 'react'
import { ChevronDownIcon, PlusIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

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
  const [isOpen, setIsOpen] = useState(false)
  const [showAddCustom, setShowAddCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customUrl, setCustomUrl] = useState('')
  const [customChainId, setCustomChainId] = useState('')
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

    // Check network statuses
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
    localStorage.setItem('network_url', network.url)
    
    // Update transfer tab URL by triggering storage event
    window.dispatchEvent(new Event('storage'))
    
    setIsOpen(false)
  }

  const handleAddCustomNetwork = () => {
    if (!customName.trim() || !customUrl.trim()) return
    
    const customNetwork: NetworkConfig = {
      id: `custom-${Date.now()}`,
      name: customName,
      url: customUrl,
      color: '#ff6b6b',
      gradient: 'from-red-500/20 to-pink-500/20',
      isCustom: true,
      chainId: customChainId || 'unknown'
    }
    
    const customNetworks = networks.filter(n => n.isCustom)
    customNetworks.push(customNetwork)
    
    const updatedNetworks = [...DEFAULT_NETWORKS, ...customNetworks]
    setNetworks(updatedNetworks)
    localStorage.setItem('custom_networks', JSON.stringify(customNetworks))
    
    setCustomName('')
    setCustomUrl('')
    setCustomChainId('')
    setShowAddCustom(false)
    handleNetworkChange(customNetwork)
    checkNetworkStatuses()
  }

  const handleRemoveCustomNetwork = (networkId: string) => {
    const updatedNetworks = networks.filter(n => n.id !== networkId)
    const customNetworks = updatedNetworks.filter(n => n.isCustom)
    
    setNetworks(updatedNetworks)
    localStorage.setItem('custom_networks', JSON.stringify(customNetworks))
    
    if (selectedNetwork.id === networkId) {
      handleNetworkChange(DEFAULT_NETWORKS[0])
    }
  }

  const getStatusIcon = (networkId: string) => {
    const status = networkStatuses[networkId]
    if (status === 'online') return <CheckCircleIcon className="w-4 h-4 text-green-400" />
    if (status === 'offline') return <XCircleIcon className="w-4 h-4 text-red-400" />
    return <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-5 py-2.5 rounded-xl border-2 transition-all backdrop-blur-xl hover:scale-105 active:scale-95"
        style={{
          backgroundColor: `${selectedNetwork.color}15`,
          borderColor: `${selectedNetwork.color}60`,
          boxShadow: `0 0 20px ${selectedNetwork.color}30`
        }}
      >
        <div 
          className="w-3 h-3 rounded-full animate-pulse"
          style={{ backgroundColor: selectedNetwork.color }}
        />
        <span 
          className="font-bold text-sm uppercase tracking-wider"
          style={{ color: selectedNetwork.color }}
        >
          {selectedNetwork.name}
        </span>
        {selectedNetwork.chainId && (
          <span className="text-xs text-gray-400 font-mono">#{selectedNetwork.chainId}</span>
        )}
        <ChevronDownIcon 
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: selectedNetwork.color }}
        />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => {
              setIsOpen(false)
              setShowAddCustom(false)
            }}
          />
          <div className="absolute right-0 mt-2 w-80 bg-black/95 backdrop-blur-xl border-2 border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
            <div className="max-h-96 overflow-y-auto">
              {networks.map((network) => (
                <div key={network.id} className="flex items-center group hover:bg-white/5">
                  <button
                    onClick={() => handleNetworkChange(network)}
                    className={`flex-1 flex items-center gap-3 px-4 py-3 transition-all ${
                      selectedNetwork.id === network.id ? 'bg-white/10' : ''
                    }`}
                    style={{
                      borderLeft: selectedNetwork.id === network.id ? `4px solid ${network.color}` : '4px solid transparent'
                    }}
                  >
                    <div 
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: network.color }}
                    />
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <div 
                          className="font-bold text-sm uppercase tracking-wide"
                          style={{ color: network.color }}
                        >
                          {network.name}
                        </div>
                        {getStatusIcon(network.id)}
                      </div>
                      <div className="text-xs text-gray-400 font-mono truncate">
                        {network.url}
                      </div>
                      {network.chainId && (
                        <div className="text-xs text-gray-500 font-mono">
                          Chain ID: {network.chainId}
                        </div>
                      )}
                    </div>
                  </button>
                  {network.isCustom && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveCustomNetwork(network.id)
                      }}
                      className="px-3 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
                      title="Remove custom network"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            <div className="border-t-2 border-white/10">
              {!showAddCustom ? (
                <button
                  onClick={() => setShowAddCustom(true)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-green-400 hover:bg-green-500/10 transition-all"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span className="font-bold text-sm uppercase">Add Custom Network</span>
                </button>
              ) : (
                <div className="p-4 space-y-3">
                  <input
                    type="text"
                    placeholder="Network Name"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-400"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <input
                    type="text"
                    placeholder="RPC URL (e.g., http://localhost:8545)"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-400"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <input
                    type="text"
                    placeholder="Chain ID (optional)"
                    value={customChainId}
                    onChange={(e) => setCustomChainId(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-400"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddCustomNetwork}
                      className="flex-1 px-3 py-2 bg-green-500/20 border border-green-500/50 text-green-400 rounded-lg hover:bg-green-500/30 font-bold text-sm"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setShowAddCustom(false)
                        setCustomName('')
                        setCustomUrl('')
                        setCustomChainId('')
                      }}
                      className="flex-1 px-3 py-2 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-500/30 font-bold text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}