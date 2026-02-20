"use client";

import { useState, useEffect, useRef } from 'react'

type NetworkEnvironment = 'testnet' | 'mainnet'

interface ChainConfig {
  id: string
  name: string
  color: string
  icon: string
  testnetName: string
  mainnetName: string
  testnetId: string
  mainnetId: string
}

export const CHAINS: ChainConfig[] = [
  {
    id: 'base', name: 'Base', color: '#0052ff', icon: '◆',
    testnetName: 'Base Sepolia', mainnetName: 'Base Mainnet',
    testnetId: 'base-sepolia', mainnetId: 'base-mainnet',
  },
  {
    id: 'ethereum', name: 'Ethereum', color: '#627eea', icon: '⟠',
    testnetName: 'Eth Sepolia', mainnetName: 'Eth Mainnet',
    testnetId: 'eth-sepolia', mainnetId: 'eth-mainnet',
  },
  {
    id: 'monad', name: 'Monad', color: '#836ef9', icon: '⬡',
    testnetName: 'Monad Testnet', mainnetName: 'Monad Mainnet',
    testnetId: 'monad-testnet', mainnetId: 'monad-mainnet',
  },
  {
    id: 'solana', name: 'Solana', color: '#9945ff', icon: '◎',
    testnetName: 'Sol Devnet', mainnetName: 'Sol Mainnet',
    testnetId: 'solana-devnet', mainnetId: 'solana-mainnet',
  },
]

export function useNetwork(userKey: string | undefined, client: any, fetchMarketCredit: () => void) {
  const [selectedChain, setSelectedChain] = useState<ChainConfig>(CHAINS[0])
  const [networkEnv, setNetworkEnv] = useState<NetworkEnvironment>('testnet')
  const [showNetworkSelector, setShowNetworkSelector] = useState(false)
  const networkDropdownRef = useRef<HTMLDivElement>(null)

  const syncNetworkFromStorage = () => {
    const savedChainId = localStorage.getItem('selected_chain')
    if (savedChainId) {
      const chain = CHAINS.find(c => c.id === savedChainId)
      if (chain) setSelectedChain(chain)
    }
    const savedEnv = localStorage.getItem('network_env') as NetworkEnvironment
    if (savedEnv === 'testnet' || savedEnv === 'mainnet') {
      setNetworkEnv(savedEnv)
    }
  }

  useEffect(() => {
    syncNetworkFromStorage()
  }, [])

  useEffect(() => {
    const handler = () => {
      syncNetworkFromStorage()
      fetchMarketCredit()
    }
    window.addEventListener('network-changed', handler)
    return () => window.removeEventListener('network-changed', handler)
  }, [userKey, client])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (networkDropdownRef.current && !networkDropdownRef.current.contains(e.target as Node)) {
        setShowNetworkSelector(false)
      }
    }
    if (showNetworkSelector) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showNetworkSelector])

  return {
    selectedChain, networkEnv,
    showNetworkSelector, setShowNetworkSelector,
    networkDropdownRef,
  }
}
