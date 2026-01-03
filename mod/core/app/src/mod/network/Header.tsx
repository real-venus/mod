'use client'

import { useState, useEffect } from 'react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'

type NetworkType = 'local' | 'ethereum' | 'solana' | 'bittensor' | 'modchain'

interface Network {
  id: NetworkType
  name: string
  color: string
  gradient: string
}

const networks: Network[] = [


  { 
    id: 'local', 
    name: 'local', 
    color: '#10b981',
    gradient: 'from-emerald-500/20 to-green-500/20'
  },
  { 
    id: 'ethereum', 
    name: 'Ethereum', 
    color: '#627eea',
    gradient: 'from-blue-500/20 to-indigo-500/20'
  },
  { 
    id: 'solana', 
    name: 'Solana', 
    color: '#14f195',
    gradient: 'from-purple-500/20 to-cyan-500/20'
  },
  { 
    id: 'bittensor', 
    name: 'Bittensor', 
    color: '#ff6b6b',
    gradient: 'from-red-500/20 to-pink-500/20'
  },
  { 
    id: 'modc2', 
    name: 'modc2', 
    color: '#00ff00',
    gradient: 'from-green-500/20 to-lime-500/20'
  },

  
  { 
    id: 'torus', 
    name: 'torus', 
    color: '#10b981',
    gradient: 'from-emerald-500/20 to-green-500/20'
  },
]

export function NetworkSelector() {
  const [selectedNetwork, setSelectedNetwork] = useState<Network>(networks[4])
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('selected_network')
    if (saved) {
      const network = networks.find(n => n.id === saved)
      if (network) setSelectedNetwork(network)
    }
  }, [])

  const handleNetworkChange = (network: Network) => {
    setSelectedNetwork(network)
    localStorage.setItem('selected_network', network.id)
    setIsOpen(false)
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
        <ChevronDownIcon 
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: selectedNetwork.color }}
        />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-56 bg-black/95 backdrop-blur-xl border-2 border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
            {networks.map((network) => (
              <button
                key={network.id}
                onClick={() => handleNetworkChange(network)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-all hover:bg-white/5 ${
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
                <span 
                  className="font-bold text-sm uppercase tracking-wide"
                  style={{ color: network.color }}
                >
                  {network.name}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
