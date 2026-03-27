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
  nativeCurrency: string
  testnetChainId: number
  mainnetChainId: number
  testnetRpc: string
  mainnetRpc: string
  testnetExplorer: string
  mainnetExplorer: string
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
    nativeCurrency: 'ETH',
    testnetChainId: 84532,
    mainnetChainId: 8453,
    testnetRpc: 'https://sepolia.base.org',
    mainnetRpc: 'https://mainnet.base.org',
    testnetExplorer: 'https://sepolia.basescan.org',
    mainnetExplorer: 'https://basescan.org',
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
    nativeCurrency: 'ETH',
    testnetChainId: 11155111,
    mainnetChainId: 1,
    testnetRpc: 'https://rpc.sepolia.org',
    mainnetRpc: 'https://eth.llamarpc.com',
    testnetExplorer: 'https://sepolia.etherscan.io',
    mainnetExplorer: 'https://etherscan.io',
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
    nativeCurrency: 'MON',
    testnetChainId: 10143,
    mainnetChainId: 10143,
    testnetRpc: 'https://testnet.monad.xyz/v1',
    mainnetRpc: 'https://testnet.monad.xyz/v1',
    testnetExplorer: 'https://testnet.monadexplorer.com',
    mainnetExplorer: 'https://monadexplorer.com',
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
    nativeCurrency: 'SOL',
    testnetChainId: 0,
    mainnetChainId: 0,
    testnetRpc: 'https://api.devnet.solana.com',
    mainnetRpc: 'https://api.mainnet-beta.solana.com',
    testnetExplorer: 'https://explorer.solana.com/?cluster=devnet',
    mainnetExplorer: 'https://explorer.solana.com',
  },
]

export function NetworkSelector({ inline = false, sidebar = false, onClose }: { inline?: boolean; sidebar?: boolean; onClose?: () => void } = {}) {
  const [selectedChain, setSelectedChain] = useState<ChainConfig>(CHAINS[0])
  const [networkEnv, setNetworkEnv] = useState<NetworkEnvironment>('testnet')
  const [showDropdown, setShowDropdown] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
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
    if (sidebar && onClose) onClose()
  }

  const handleEnvToggle = (env: NetworkEnvironment) => {
    setNetworkEnv(env)
    const networkId = env === 'testnet' ? selectedChain.testnetId : selectedChain.mainnetId
    localStorage.setItem('network_env', env)
    localStorage.setItem('selected_network', networkId)
    window.dispatchEvent(new CustomEvent('network-changed'))
  }

  const envColor = networkEnv === 'mainnet' ? '#22c55e' : '#f59e0b'

  const triggerContent = (compact: boolean) => (
    <>
      {/* Chain icon */}
      <span
        className={compact ? "text-sm font-bold" : "text-lg font-bold"}
        style={{ color: selectedChain.color }}
      >
        {selectedChain.icon}
      </span>

      {/* Chain name */}
      <span
        className="font-bold uppercase tracking-wider"
        style={{
          fontFamily: 'var(--font-pixel), monospace',
          fontSize: compact ? '11px' : '16px',
          color: 'var(--text-primary)',
        }}
      >
        {selectedChain.name}
      </span>

      {/* Env badge */}
      <span
        className="font-bold uppercase"
        style={{
          fontFamily: 'var(--font-pixel), monospace',
          fontSize: compact ? '8px' : '10px',
          padding: compact ? '2px 6px' : '4px 10px',
          backgroundColor: `${envColor}15`,
          color: envColor,
          border: `1px solid ${envColor}30`,
          borderRadius: compact ? '4px' : '6px',
          letterSpacing: '0.05em',
        }}
      >
        {networkEnv === 'testnet' ? 'TEST' : 'MAIN'}
      </span>

      <ChevronDownIcon
        className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`}
        style={{ color: 'var(--text-tertiary)' }}
      />
    </>
  )

  const dropdownContent = (
    <>
      {/* Testnet / Mainnet Toggle */}
      <div className="p-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div
          className="flex p-1 gap-1"
          style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
        >
          {(['testnet', 'mainnet'] as NetworkEnvironment[]).map((env) => {
            const isActive = networkEnv === env
            return (
              <button
                key={env}
                onClick={() => handleEnvToggle(env)}
                className="flex-1 py-2 font-bold uppercase tracking-widest transition-all"
                style={{
                  fontFamily: 'var(--font-pixel), monospace',
                  fontSize: '8px',
                  backgroundColor: isActive ? 'var(--bg-secondary)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  borderRadius: '6px',
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
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
                className="relative flex items-center gap-3 py-3 px-3 transition-all"
                style={{
                  fontFamily: 'var(--font-pixel), monospace',
                  border: isSelected ? `1px solid ${chain.color}40` : '1px solid transparent',
                  backgroundColor: isSelected ? `${chain.color}10` : 'transparent',
                  borderRadius: '10px',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--hover-bg)'
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <div
                  className="w-9 h-9 flex items-center justify-center text-lg"
                  style={{
                    backgroundColor: `${chain.color}15`,
                    color: chain.color,
                    border: `1px solid ${chain.color}25`,
                    borderRadius: '8px',
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

                {isSelected && (
                  <div
                    className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: chain.color, boxShadow: `0 0 6px ${chain.color}80` }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Network Info Toggle */}
      <div style={{ borderTop: '1px solid var(--border-color)' }}>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="w-full flex items-center justify-between px-3 py-2 transition-all"
          style={{ fontFamily: 'var(--font-pixel), monospace' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <span style={{ fontSize: '8px', color: 'var(--text-tertiary)', letterSpacing: '0.1em' }} className="uppercase font-bold">
            Network Info
          </span>
          <ChevronDownIcon
            className={`w-3 h-3 transition-transform duration-200 ${showInfo ? 'rotate-180' : ''}`}
            style={{ color: 'var(--text-tertiary)' }}
          />
        </button>

        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 flex flex-col gap-2" style={{ fontFamily: 'var(--font-pixel), monospace' }}>
                {/* Chain ID */}
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: '7px', color: 'var(--text-tertiary)', letterSpacing: '0.1em' }} className="uppercase">Chain ID</span>
                  <span style={{ fontSize: '8px', color: selectedChain.color }} className="font-bold">
                    {selectedChain.id === 'solana' ? 'N/A' : (networkEnv === 'testnet' ? selectedChain.testnetChainId : selectedChain.mainnetChainId)}
                  </span>
                </div>

                {/* Currency */}
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: '7px', color: 'var(--text-tertiary)', letterSpacing: '0.1em' }} className="uppercase">Currency</span>
                  <span style={{ fontSize: '8px', color: 'var(--text-primary)' }} className="font-bold">
                    {selectedChain.nativeCurrency}
                  </span>
                </div>

                {/* Network Name */}
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: '7px', color: 'var(--text-tertiary)', letterSpacing: '0.1em' }} className="uppercase">Network</span>
                  <span style={{ fontSize: '8px', color: 'var(--text-primary)' }} className="font-bold">
                    {networkEnv === 'testnet' ? selectedChain.testnetName : selectedChain.mainnetName}
                  </span>
                </div>

                {/* RPC */}
                <div className="flex items-center justify-between gap-2">
                  <span style={{ fontSize: '7px', color: 'var(--text-tertiary)', letterSpacing: '0.1em' }} className="uppercase flex-shrink-0">RPC</span>
                  <span
                    style={{ fontSize: '7px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={networkEnv === 'testnet' ? selectedChain.testnetRpc : selectedChain.mainnetRpc}
                  >
                    {networkEnv === 'testnet' ? selectedChain.testnetRpc : selectedChain.mainnetRpc}
                  </span>
                </div>

                {/* Explorer */}
                <div className="flex items-center justify-between gap-2">
                  <span style={{ fontSize: '7px', color: 'var(--text-tertiary)', letterSpacing: '0.1em' }} className="uppercase flex-shrink-0">Explorer</span>
                  <a
                    href={networkEnv === 'testnet' ? selectedChain.testnetExplorer : selectedChain.mainnetExplorer}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '7px', color: selectedChain.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {networkEnv === 'testnet' ? selectedChain.testnetExplorer : selectedChain.mainnetExplorer}
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )

  // Sidebar mode: render dropdown content directly (no trigger button)
  if (sidebar) {
    return (
      <div
        style={{
          width: '320px',
          background: 'var(--bg-header)',
          border: '2px solid var(--border-strong)',
          borderLeft: 'none',
          boxShadow: '4px 4px 0px rgba(0,0,0,0.4)',
        }}
      >
        {dropdownContent}
      </div>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {inline ? (
        <div
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-1.5 px-3 cursor-pointer hover:opacity-70 transition-all"
          style={{ fontFamily: 'var(--font-pixel), monospace', height: '52px' }}
        >
          {triggerContent(true)}
        </div>
      ) : (
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-3 px-4 hover:bg-[var(--hover-bg)] w-full transition-all"
          style={{
            height: '44px',
            fontFamily: 'var(--font-pixel), monospace',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            backgroundColor: 'var(--bg-input)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          {triggerContent(false)}
        </button>
      )}

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-2 overflow-hidden z-[200]"
            style={{
              width: '320px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            {dropdownContent}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
