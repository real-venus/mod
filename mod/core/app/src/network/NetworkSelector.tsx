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
    setShowDropdown(false)
  }

  const handleEnvToggle = (env: NetworkEnvironment) => {
    setNetworkEnv(env)
    const networkId = env === 'testnet' ? selectedChain.testnetId : selectedChain.mainnetId
    localStorage.setItem('network_env', env)
    localStorage.setItem('selected_network', networkId)
    window.dispatchEvent(new CustomEvent('network-changed'))
  }

  const envColor = networkEnv === 'mainnet' ? '#22c55e' : '#f59e0b'

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Compact pill button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-3 hover:bg-[var(--hover-bg)]"
        style={{
          height: '36px',
          fontFamily: 'var(--font-pixel), monospace',
          border: '2px solid var(--border-color)',
          borderRadius: '0px',
          backgroundColor: 'var(--bg-input)',
        }}
      >
        {/* Chain icon with color dot */}
        <div className="relative flex items-center justify-center">
          <span
            className="text-sm font-bold"
            style={{ color: selectedChain.color }}
          >
            {selectedChain.icon}
          </span>
        </div>

        {/* Chain name */}
        <span
          className="font-bold uppercase tracking-wider"
          style={{
            fontFamily: 'var(--font-pixel), monospace',
            fontSize: '8px',
            color: 'var(--text-primary)',
          }}
        >
          {selectedChain.name}
        </span>

        {/* Env badge */}
        <span
          className="font-bold uppercase px-1.5 py-0.5"
          style={{
            fontFamily: 'var(--font-pixel), monospace',
            fontSize: '7px',
            backgroundColor: `${envColor}18`,
            color: envColor,
            border: `2px solid ${envColor}40`,
          }}
        >
          {networkEnv === 'testnet' ? 'TEST' : 'MAIN'}
        </span>

        <ChevronDownIcon
          className={`w-3 h-3 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`}
          style={{ color: 'var(--text-tertiary)' }}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 overflow-hidden z-50"
            style={{
              width: '320px',
              background: 'var(--bg-secondary)',
              border: '2px solid var(--border-color)',
              borderRadius: '0px',
              boxShadow: '4px 4px 0px rgba(0,0,0,0.3)',
            }}
          >
            {/* Testnet / Mainnet Toggle */}
            <div className="p-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <div
                className="flex p-1 gap-1"
                style={{ backgroundColor: 'var(--bg-input)', border: '2px solid var(--border-color)' }}
              >
                {(['testnet', 'mainnet'] as NetworkEnvironment[]).map((env) => {
                  const isActive = networkEnv === env
                  return (
                    <button
                      key={env}
                      onClick={() => handleEnvToggle(env)}
                      className="flex-1 py-2 font-bold uppercase tracking-widest"
                      style={{
                        fontFamily: 'var(--font-pixel), monospace',
                        fontSize: '8px',
                        backgroundColor: isActive ? 'var(--bg-secondary)' : 'transparent',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        boxShadow: isActive ? '2px 2px 0px rgba(0,0,0,0.2)' : 'none',
                      }}
                    >
                      {env}
                    </button>
                  )
                })}
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
                      className="relative flex items-center gap-3 py-3 px-3"
                      style={{
                        fontFamily: 'var(--font-pixel), monospace',
                        border: isSelected ? `2px solid ${chain.color}60` : '2px solid transparent',
                        backgroundColor: isSelected ? `${chain.color}12` : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--hover-bg)'
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                    >
                      {/* Chain icon */}
                      <div
                        className="w-9 h-9 flex items-center justify-center text-lg"
                        style={{
                          backgroundColor: `${chain.color}18`,
                          color: chain.color,
                          border: `2px solid ${chain.color}30`,
                        }}
                      >
                        {chain.icon}
                      </div>

                      <div className="text-left">
                        <span
                          className="block font-bold uppercase tracking-wider"
                          style={{ fontSize: '8px', fontFamily: 'var(--font-pixel)', color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                        >
                          {chain.name}
                        </span>
                        <span
                          className="block uppercase tracking-wide mt-0.5"
                          style={{ fontSize: '7px', fontFamily: 'var(--font-pixel)', color: 'var(--text-tertiary)' }}
                        >
                          {networkEnv === 'testnet' ? chain.testnetName : chain.mainnetName}
                        </span>
                      </div>

                      {/* Selected indicator */}
                      {isSelected && (
                        <div
                          className="absolute top-2 right-2 w-2 h-2"
                          style={{ backgroundColor: chain.color }}
                        />
                      )}
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
