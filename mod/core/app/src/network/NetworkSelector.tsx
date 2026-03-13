"use client";

import { useState, useEffect, useRef } from 'react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'

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

const CHAINS: ChainConfig[] = [
  {
    id: 'base',
    name: 'Base',
    color: '#0052ff',
    icon: '◆',
    testnetName: 'Base Sepolia',
    mainnetName: 'Base Mainnet',
    testnetId: 'base-sepolia',
    mainnetId: 'base-mainnet',
  },
  {
    id: 'ethereum',
    name: 'Ethereum',
    color: '#627eea',
    icon: '⟠',
    testnetName: 'Eth Sepolia',
    mainnetName: 'Eth Mainnet',
    testnetId: 'eth-sepolia',
    mainnetId: 'eth-mainnet',
  },
  {
    id: 'monad',
    name: 'Monad',
    color: '#836ef9',
    icon: '⬡',
    testnetName: 'Monad Testnet',
    mainnetName: 'Monad Mainnet',
    testnetId: 'monad-testnet',
    mainnetId: 'monad-mainnet',
  },
  {
    id: 'solana',
    name: 'Solana',
    color: '#9945ff',
    icon: '◎',
    testnetName: 'Sol Devnet',
    mainnetName: 'Sol Mainnet',
    testnetId: 'solana-devnet',
    mainnetId: 'solana-mainnet',
  },
]

export function NetworkSelector() {
  const [selectedChain, setSelectedChain] = useState<ChainConfig>(CHAINS[0])
  const [networkEnv, setNetworkEnv] = useState<NetworkEnvironment>('testnet')
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const syncFromStorage = () => {
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
    syncFromStorage()
  }, [])

  // Listen for network changes from other components (e.g. WalletHeader)
  useEffect(() => {
    const handler = () => syncFromStorage()
    window.addEventListener('network-changed', handler)
    return () => window.removeEventListener('network-changed', handler)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleChainSelect = (chain: ChainConfig) => {
    setSelectedChain(chain)
    const networkId = networkEnv === 'testnet' ? chain.testnetId : chain.mainnetId
    localStorage.setItem('selected_chain', chain.id)
    localStorage.setItem('selected_network', networkId)
    window.dispatchEvent(new CustomEvent('network-changed'))
  }

  const handleEnvToggle = (env: NetworkEnvironment) => {
    setNetworkEnv(env)
    const networkId = env === 'testnet' ? selectedChain.testnetId : selectedChain.mainnetId
    localStorage.setItem('network_env', env)
    localStorage.setItem('selected_network', networkId)
    window.dispatchEvent(new CustomEvent('network-changed'))
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Compact selector button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="w-full flex items-center justify-between gap-2 px-2 py-2 border-2 transition-all"
        style={{
          fontFamily: 'var(--font-digital), monospace',
          borderColor: 'var(--border-strong)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div className="flex items-center gap-2">
          {/* Chain icon */}
          <div
            className="w-6 h-6 flex items-center justify-center text-sm font-bold border-2"
            style={{
              color: 'var(--text-primary)',
              borderColor: 'var(--border-strong)',
              backgroundColor: 'var(--bg-primary)'
            }}
          >
            {selectedChain.icon}
          </div>

          {/* Chain + env label */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-digital uppercase tracking-wider font-bold" style={{ color: 'var(--text-primary)' }}>
              {selectedChain.name}
            </span>
            <span
              className="text-[10px] font-digital uppercase tracking-wider px-1.5 py-0.5 border font-bold"
              style={{
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-secondary)',
                borderColor: 'var(--border-strong)',
              }}
            >
              {networkEnv === 'testnet' ? 'TESTNET' : 'MAINNET'}
            </span>
          </div>
        </div>

        <ChevronDownIcon
          className={`w-4 h-4 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`}
          style={{ color: 'var(--text-primary)' }}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 border-4 overflow-hidden z-50"
            style={{
              background: 'var(--bg-secondary)',
              borderColor: 'var(--border-strong)',
            }}
          >
            {/* Testnet / Mainnet Toggle */}
            <div className="p-3 border-b-4" style={{ borderColor: 'var(--border-strong)' }}>
              <div className="flex gap-2">
                {(['testnet', 'mainnet'] as NetworkEnvironment[]).map((env) => (
                  <button
                    key={env}
                    onClick={() => handleEnvToggle(env)}
                    className="flex-1 py-3 text-base font-digital uppercase tracking-widest transition-all border-4 font-bold"
                    style={{
                      fontFamily: 'var(--font-digital), monospace',
                      backgroundColor: networkEnv === env ? 'var(--text-primary)' : 'var(--bg-primary)',
                      color: networkEnv === env ? 'var(--bg-primary)' : 'var(--text-primary)',
                      borderColor: 'var(--border-strong)'
                    }}
                  >
                    {env}
                  </button>
                ))}
              </div>
            </div>

            {/* Chain Grid */}
            <div className="p-3">
              <div className="grid grid-cols-2 gap-3">
                {CHAINS.map((chain) => {
                  const isSelected = selectedChain.id === chain.id
                  return (
                    <button
                      key={chain.id}
                      onClick={() => handleChainSelect(chain)}
                      className="relative flex flex-col items-center gap-2 py-4 px-3 border-4 transition-all"
                      style={{
                        fontFamily: 'var(--font-digital), monospace',
                        borderColor: 'var(--border-strong)',
                        backgroundColor: isSelected ? 'var(--text-primary)' : 'var(--bg-primary)',
                      }}
                    >
                      {isSelected && (
                        <div
                          className="absolute top-2 right-2 w-3 h-3 border-2"
                          style={{
                            backgroundColor: 'var(--bg-primary)',
                            borderColor: 'var(--bg-primary)',
                          }}
                        />
                      )}

                      <div
                        className="w-10 h-10 flex items-center justify-center text-xl border-4 font-bold"
                        style={{
                          borderColor: 'var(--border-strong)',
                          backgroundColor: isSelected ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}
                      >
                        {chain.icon}
                      </div>

                      <span
                        className="text-base font-digital uppercase tracking-wider font-bold"
                        style={{ color: isSelected ? 'var(--bg-primary)' : 'var(--text-primary)' }}
                      >
                        {chain.name}
                      </span>

                      <span
                        className="text-xs font-digital uppercase tracking-wider"
                        style={{ color: isSelected ? 'var(--bg-primary)' : 'var(--text-tertiary)' }}
                      >
                        {networkEnv === 'testnet' ? chain.testnetName : chain.mainnetName}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
