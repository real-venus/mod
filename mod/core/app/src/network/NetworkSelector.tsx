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
    <div className="relative" ref={dropdownRef}>
      {/* Compact trigger */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-2.5 border transition-all hover:brightness-110 active:scale-[0.98]"
        style={{
          height: '36px',
          borderRadius: '20px',
          fontFamily: 'IBM Plex Mono, monospace',
          borderColor: 'var(--border-strong)',
          background: `${selectedChain.color}08`,
        }}
      >
        {/* Chain icon */}
        <div
          className="w-5 h-5 flex items-center justify-center text-[13px] font-bold"
          style={{
            color: selectedChain.color,
          }}
        >
          {selectedChain.icon}
        </div>

        {/* Chain + env label */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            {selectedChain.name}
          </span>
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-1 py-px"
            style={{
              background: networkEnv === 'mainnet' ? '#10b98115' : '#f59e0b15',
              color: networkEnv === 'mainnet' ? '#10b981' : '#f59e0b',
              border: `1px solid ${networkEnv === 'mainnet' ? '#10b98120' : '#f59e0b20'}`,
            }}
          >
            {networkEnv === 'testnet' ? 'TEST' : 'MAIN'}
          </span>
        </div>

        <ChevronDownIcon
          className={`w-3 h-3 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`}
          style={{ color: 'var(--text-tertiary)' }}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-72 border-2 overflow-hidden z-50"
            style={{
              background: 'var(--bg-sidebar)',
              borderColor: `${selectedChain.color}30`,
              backdropFilter: 'blur(20px)',
              boxShadow: `0 20px 60px rgba(0,0,0,0.3), 0 0 40px ${selectedChain.color}10`,
              borderRadius: '12px',
            }}
          >
            {/* Testnet / Mainnet Toggle */}
            <div className="p-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <div
                className="flex p-1"
                style={{ borderRadius: '10px', border: '1px solid var(--border-input)', background: 'var(--bg-input)' }}
              >
                {(['testnet', 'mainnet'] as NetworkEnvironment[]).map((env) => (
                  <button
                    key={env}
                    onClick={() => handleEnvToggle(env)}
                    className="flex-1 relative py-2 text-[11px] font-black uppercase tracking-widest transition-all duration-200"
                    style={{
                      borderRadius: '8px',
                      fontFamily: 'IBM Plex Mono, monospace',
                      ...(networkEnv === env
                        ? {
                            background: env === 'mainnet'
                              ? 'linear-gradient(135deg, #10b98118 0%, #059a6918 100%)'
                              : 'linear-gradient(135deg, #f59e0b18 0%, #d9770618 100%)',
                            color: env === 'mainnet' ? '#10b981' : '#f59e0b',
                            boxShadow: env === 'mainnet'
                              ? '0 0 20px #10b98110, inset 0 1px 0 #10b98115'
                              : '0 0 20px #f59e0b10, inset 0 1px 0 #f59e0b15',
                          }
                        : { color: '#525252' }),
                    }}
                  >
                    {networkEnv === env && (
                      <motion.div
                        layoutId="envToggleTopbar"
                        className="absolute inset-0"
                        style={{
                          borderRadius: '8px',
                          border: `1px solid ${env === 'mainnet' ? '#10b98130' : '#f59e0b30'}`,
                        }}
                        transition={{ duration: 0.2 }}
                      />
                    )}
                    <span className="relative z-10">{env}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Chain Grid */}
            <div className="p-3">
              <div className="grid grid-cols-2 gap-2">
                {CHAINS.map((chain) => {
                  const isSelected = selectedChain.id === chain.id
                  return (
                    <button
                      key={chain.id}
                      onClick={() => handleChainSelect(chain)}
                      className="relative flex flex-col items-center gap-2 py-3.5 px-3 border-2 transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] group"
                      style={{
                        borderRadius: '12px',
                        fontFamily: 'IBM Plex Mono, monospace',
                        borderColor: isSelected ? `${chain.color}60` : '#262626',
                        background: isSelected
                          ? `linear-gradient(145deg, ${chain.color}12 0%, ${chain.color}06 50%, transparent 100%)`
                          : 'linear-gradient(145deg, #0a0a0a 0%, #0d0d0d 100%)',
                        boxShadow: isSelected
                          ? `0 0 24px ${chain.color}15, inset 0 1px 0 ${chain.color}10`
                          : 'none',
                      }}
                    >
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-2 right-2 w-2 h-2 rounded-full"
                          style={{
                            background: chain.color,
                            boxShadow: `0 0 8px ${chain.color}80`,
                          }}
                        />
                      )}

                      <div
                        className="w-9 h-9 flex items-center justify-center text-lg rounded-xl transition-all duration-200"
                        style={{
                          background: isSelected ? `${chain.color}20` : `${chain.color}0a`,
                          color: isSelected ? chain.color : `${chain.color}60`,
                          border: `1px solid ${isSelected ? `${chain.color}40` : `${chain.color}15`}`,
                        }}
                      >
                        {chain.icon}
                      </div>

                      <span
                        className="text-[11px] font-black uppercase tracking-wider transition-colors duration-200"
                        style={{ color: isSelected ? chain.color : '#737373' }}
                      >
                        {chain.name}
                      </span>

                      <span
                        className="text-[9px] font-bold uppercase tracking-wider transition-colors duration-200"
                        style={{ color: isSelected ? `${chain.color}80` : '#404040' }}
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
