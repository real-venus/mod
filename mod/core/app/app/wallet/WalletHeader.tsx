"use client";

import { useState, useEffect, useRef } from 'react'
import { userContext } from '@/context/UserContext'
import { ClipboardDocumentIcon, ClipboardDocumentCheckIcon, ChevronDownIcon, ArrowRightStartOnRectangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { AnimatePresence, motion } from 'framer-motion'
import { WalletAuthButton } from './WalletAuthButton'
import { text2color } from '@/utils'
import { toast } from 'react-toastify'

import { Auth } from '@/client/auth'
import { useTokenExpiry } from './hooks/useTokenExpiry'
import { useBalances } from './hooks/useBalances'
import { useTransactions } from './hooks/useTransactions'
import { useTransfers } from './hooks/useTransfers'
import { useWalletAccounts } from './hooks/useWalletAccounts'
import { useNetwork } from './hooks/useNetwork'
import { useSidebarResize } from './hooks/useSidebarResize'
import { WalletSidebar } from './sidebar/WalletSidebar'
import { NetworkSelector } from '@/network/NetworkSelector'

const WalletModeLogo = ({ mode, size = 16 }: { mode: string; size?: number }) => {
  const m = mode.toLowerCase()
  if (m.includes('metamask')) return (
    <svg width={size} height={size} viewBox="0 0 318.6 318.6" fill="none">
      <path d="M274.1 35.5l-99.5 73.9 18.4-43.6z" fill="#E17726" stroke="#E17726" strokeWidth="1.5"/>
      <path d="M44.4 35.5l98.7 74.6-17.5-44.3zm193.9 171.3l-26.5 40.6 56.7 15.6 16.3-55.3zm-204.4.9L50.1 263l56.7-15.6-26.5-40.6z" fill="#E27625" stroke="#E27625" strokeWidth="1.5"/>
      <path d="M103.6 138.2l-15.8 23.9 56.3 2.5-2-60.5zm111.3 0l-39-34.8-1.3 61.2 56.2-2.5z" fill="#E27625" stroke="#E27625" strokeWidth="1.5"/>
      <path d="M267.2 153.5l-52.3-15.3 15.8 23.9-23.7 46 31.2-.4h46.5zm-163.6-15.3l-52.3 15.3-17.4 54.2h46.4l31.1.4-23.6-46zm71 26.4l3.3-57.7 15.2-41.1h-67.5l15 41.1 3.5 57.7 1.2 18.2.1 44.8h27.7l.2-44.8z" fill="#F5841F" stroke="#F5841F" strokeWidth="1.5"/>
    </svg>
  )
  if (m.includes('phantom')) return (
    <svg width={size} height={size} viewBox="0 0 128 128" fill="none">
      <rect width="128" height="128" rx="24" fill="url(#pg)"/>
      <path d="M96 64c0 17.673-14.327 32-32 32s-32-14.327-32-32V32h64v32z" fill="white"/>
      <circle cx="52" cy="58" r="6" fill="#AB9FF2"/><circle cx="76" cy="58" r="6" fill="#AB9FF2"/>
      <defs><linearGradient id="pg" x1="0" y1="0" x2="128" y2="128"><stop stopColor="#AB9FF2"/><stop offset="1" stopColor="#7C66DC"/></linearGradient></defs>
    </svg>
  )
  if (m.includes('subwallet')) return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <circle cx="100" cy="100" r="100" fill="url(#sg)"/>
      <path d="M100 40L60 80L100 120L140 80L100 40Z" fill="white"/>
      <path d="M100 120L60 160L100 200L140 160L100 120Z" fill="white" opacity="0.6"/>
      <defs><linearGradient id="sg" x1="0" y1="0" x2="200" y2="200"><stop stopColor="#00E5CC"/><stop offset="1" stopColor="#00B8D4"/></linearGradient></defs>
    </svg>
  )
  // local/default - key icon
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="7" cy="7" r="4" fill="none"/><path d="M7 11V22M11 15H7M11 19H7"/>
    </svg>
  )
}

export function WalletHeader() {
  const { user, signOut, switchWallet, client } = userContext()
  const [isOpen, setIsOpen] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [activeTab, setActiveTab] = useState<string | null>('portfolio')
  const [showAccountsDropdown, setShowAccountsDropdown] = useState(false)
  const [showTokenDropdown, setShowTokenDropdown] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)
  const [tokenView, setTokenView] = useState<'raw' | 'json' | 'create'>('raw')
  const [createTokenData, setCreateTokenData] = useState('')
  const [showAuthSidebar, setShowAuthSidebar] = useState(false)
  const [showKeyTypeDropdown, setShowKeyTypeDropdown] = useState(false)
  const walletRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const tokenDropdownRef = useRef<HTMLDivElement>(null)
  const keyTypeDropdownRef = useRef<HTMLDivElement>(null)

  const address = user?.key || ''
  const walletMode = user?.wallet_mode || ''
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''
  const userColor = user ? text2color(user.key || '') : '#10b981'

  // Hooks
  const tokenExpiry = useTokenExpiry(!!user)
  const balances = useBalances(user?.key, client)
  const transactions = useTransactions(user?.key, client)
  const transfers = useTransfers({
    userKey: user?.key,
    marketCredit: balances.marketCredit,
    tokenBalances: balances.tokenBalances,
    fetchMarketCredit: balances.fetchMarketCredit,
    fetchCustomTokenBalances: balances.fetchCustomTokenBalances,
  })
  const accounts = useWalletAccounts(user?.key, address, switchWallet)
  useNetwork(user?.key, client, balances.fetchMarketCredit)
  const sidebar = useSidebarResize()

  const [walletTypeState, setWalletTypeState] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('wallet_type') || 'ecdsa' : 'ecdsa'
  )
  const [localWalletMode, setLocalWalletMode] = useState(walletMode)
  useEffect(() => { setLocalWalletMode(walletMode) }, [walletMode])

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      setCopiedAddress(true)
      setTimeout(() => setCopiedAddress(false), 2000)
    }
  }

  const handleSignOut = () => {
    signOut()
    setIsOpen(false)
    setShowTokenDropdown(false)
  }

  const copyToken = () => {
    const token = localStorage.getItem('wallet_token')
    if (token) {
      navigator.clipboard.writeText(token)
      setCopiedToken(true)
      setTimeout(() => setCopiedToken(false), 2000)
    }
  }

  const openTab = (tab: string) => {
    setActiveTab(activeTab === tab ? null : tab)
    transfers.setSendFromPortfolio(null)
    if (tab === 'txs' && activeTab !== 'txs') transactions.fetchUserTransactions()
    if (tab === 'wallets') accounts.refreshHistory()
  }

  // Fetch txs when txs tab opens
  useEffect(() => {
    if (activeTab === 'txs' && user?.key) transactions.fetchUserTransactions()
  }, [activeTab])

  // Close wallet sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (walletRef.current && !walletRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAccountsDropdown(false)
      }
      if (tokenDropdownRef.current && !tokenDropdownRef.current.contains(event.target as Node)) {
        setShowTokenDropdown(false)
      }
      if (keyTypeDropdownRef.current && !keyTypeDropdownRef.current.contains(event.target as Node)) {
        setShowKeyTypeDropdown(false)
      }
    }

    if (isOpen || showAccountsDropdown || showTokenDropdown || showKeyTypeDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, showAccountsDropdown, showTokenDropdown, showKeyTypeDropdown])

  const getWalletModeColor = (mode: string) => {
    const m = mode.toLowerCase()
    if (m.includes('metamask')) return '#f6851b'
    if (m.includes('phantom')) return '#ab9ff2'
    if (m.includes('subwallet')) return '#004bff'
    if (m.includes('coinbase')) return '#0052ff'
    return '#10b981'
  }

  if (!user) {
    return (
      <div className="flex items-center gap-3">
        <WalletAuthButton
          showAuthSidebar={showAuthSidebar}
          setShowAuthSidebar={setShowAuthSidebar}
        />
      </div>
    )
  }

  const KEY_TYPE_CYCLE: { type: string; mode: string; label: string }[] = [
    { type: 'ethereum', mode: 'metamask', label: 'ETH' },
    { type: 'solana', mode: 'phantom', label: 'SOL' },
    { type: 'ecdsa', mode: 'local', label: 'ECDSA' },
    { type: 'sr25519', mode: 'subwallet', label: 'SR25' },
  ]
  const getKeyTypeColor = (type: string) => {
    if (type === 'sr25519') return '#06b6d4'
    if (type === 'ecdsa') return '#f59e0b'
    if (type === 'ethereum') return '#627eea'
    if (type === 'solana') return '#9945ff'
    return '#10b981'
  }
  const selectKeyType = (keyType: typeof KEY_TYPE_CYCLE[number]) => {
    localStorage.setItem('wallet_type', keyType.type)
    localStorage.setItem('wallet_mode', keyType.mode)
    setWalletTypeState(keyType.type)
    setLocalWalletMode(keyType.mode)
    setShowKeyTypeDropdown(false)
    toast.success(`Switched to ${keyType.label}`)
  }
  const keyColor = getKeyTypeColor(walletTypeState)
  const keyLabel = KEY_TYPE_CYCLE.find(k => k.type === walletTypeState)?.label || walletTypeState.toUpperCase()
  const keyMode = KEY_TYPE_CYCLE.find(k => k.type === walletTypeState)?.mode || localWalletMode

  return (
    <div ref={walletRef} className="flex items-center gap-0">
      {/* Unified bar */}
      <div
        ref={dropdownRef}
        className="relative flex items-center gap-0"
        style={{
          height: '52px',
          fontFamily: 'var(--font-digital), monospace',
          backgroundColor: 'var(--bg-input)',
          border: '2px solid var(--border-strong)',
          overflow: 'visible',
          position: 'relative',
        }}
      >
        {/* Key type + wallet logo - clickable dropdown */}
        <div className="relative flex-shrink-0" ref={keyTypeDropdownRef}>
          <button
            onClick={() => setShowKeyTypeDropdown(!showKeyTypeDropdown)}
            className="flex items-center gap-1.5 h-[52px] px-3 transition-all hover:opacity-80 active:scale-[0.98]"
            style={{ color: keyColor }}
            title="Select key type"
          >
            <div className="flex-shrink-0 opacity-80" style={{ color: keyColor }}>
              <WalletModeLogo mode={keyMode} size={18} />
            </div>
            <span className="text-sm font-bold tracking-wider">{keyLabel}</span>
            <svg className={`w-2.5 h-2.5 opacity-40 transition-transform ${showKeyTypeDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <AnimatePresence>
            {showKeyTypeDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.96 }}
                transition={{ duration: 0.12 }}
                className="absolute left-0 top-full mt-1.5 z-[200] overflow-hidden"
                style={{
                  minWidth: '180px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                }}
              >
                <div className="py-1">
                  {KEY_TYPE_CYCLE.map((kt) => {
                    const c = getKeyTypeColor(kt.type)
                    const isActive = kt.type === walletTypeState
                    return (
                      <button
                        key={kt.type}
                        onClick={() => selectKeyType(kt)}
                        className="flex items-center gap-2.5 w-full px-3 py-2.5 transition-all text-left"
                        style={{
                          backgroundColor: isActive ? `${c}12` : 'transparent',
                          fontFamily: 'var(--font-digital), monospace',
                        }}
                        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--hover-bg)' }}
                        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = isActive ? `${c}12` : 'transparent' }}
                      >
                        <div className="flex-shrink-0" style={{ color: c, opacity: isActive ? 1 : 0.5 }}>
                          <WalletModeLogo mode={kt.mode} size={16} />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: isActive ? c : 'var(--text-secondary)' }}>
                          {kt.label}
                        </span>
                        <span className="flex-1" />
                        {isActive && (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Separator */}
        <div className="w-px h-6 flex-shrink-0" style={{ backgroundColor: 'var(--border-strong)' }} />

        {/* Address - click to open sidebar */}
        <div
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen) }}
          className="flex items-center gap-2 px-3 h-[52px] transition-all hover:opacity-70 cursor-pointer"
          title={address}
          role="button"
        >
          <span className="tabular-nums font-bold uppercase" style={{ fontSize: '20px', fontFamily: 'var(--font-digital)', color: 'var(--text-tertiary)' }}>
            {shortAddress}
          </span>
        </div>

        {/* Copy address */}
        <button
          onClick={copyAddress}
          className="flex items-center justify-center h-[52px] px-2 transition-all hover:opacity-70 flex-shrink-0"
          style={{ color: copiedAddress ? '#4ade80' : 'var(--text-tertiary)' }}
          title={`Copy: ${address}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {copiedAddress ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            )}
          </svg>
        </button>

        {/* Separator */}
        <div className="w-px h-6 flex-shrink-0" style={{ backgroundColor: 'var(--border-strong)' }} />

        {/* Inline Network Selector */}
        <div className="flex items-center h-[52px] flex-shrink-0">
          <NetworkSelector inline />
        </div>

        {/* Separator */}
        <div className="w-px h-6 flex-shrink-0" style={{ backgroundColor: 'var(--border-strong)' }} />

        {/* Wallet switcher dropdown */}
        {accounts.walletHistory.filter(w => w.address.toLowerCase() !== address.toLowerCase()).length > 0 && (
          <button
            onClick={() => {
              setShowAccountsDropdown(!showAccountsDropdown)
              if (!showAccountsDropdown) accounts.refreshHistory()
            }}
            className="flex items-center justify-center w-[28px] h-[52px] transition-all hover:opacity-70 flex-shrink-0"
            style={{ color: 'var(--text-tertiary)' }}
            title="Switch wallet"
          >
            <svg className={`w-3 h-3 transition-transform ${showAccountsDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}

        {/* Accounts dropdown */}
        <AnimatePresence>
          {showAccountsDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ duration: 0.12 }}
              className="absolute top-full right-0 mt-1.5 overflow-hidden z-[200]"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                minWidth: '420px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              }}
            >
              {/* Header */}
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '2px solid var(--border-strong)', backgroundColor: 'var(--bg-input)' }}>
                <div className="w-2 h-2" style={{ backgroundColor: userColor }} />
                <span className="text-sm font-digital uppercase font-bold tracking-wider" style={{ color: 'var(--text-tertiary)' }}>WALLETS</span>
                <div className="flex-1" />
                <span className="text-xs font-digital uppercase tabular-nums font-bold" style={{ color: 'var(--text-tertiary)' }}>
                  {accounts.walletHistory.length}
                </span>
              </div>

              <div className="p-3 max-h-80 overflow-y-auto">
                {/* Current wallet */}
                <div
                  className="flex items-center gap-3 px-4 py-4 mb-2"
                  style={{
                    backgroundColor: `${userColor}15`,
                    border: `3px solid ${userColor}`,
                    fontFamily: 'var(--font-digital), monospace',
                  }}
                >
                  <div className="flex-shrink-0"><WalletModeLogo mode={walletMode} size={22} /></div>
                  <div className="flex-1 min-w-0">
                    <span className="text-base font-digital font-bold tracking-wide" style={{ color: 'var(--text-primary)' }}>
                      {shortAddress}
                    </span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="w-2 h-2" style={{ backgroundColor: tokenExpiry.isTokenExpired ? '#eab308' : '#22c55e' }} />
                      <span className="text-xs font-digital uppercase font-bold tabular-nums" style={{ color: tokenExpiry.isTokenExpired ? '#eab308' : '#22c55e' }}>
                        {tokenExpiry.isTokenExpired ? 'EXPIRED' : tokenExpiry.tokenExpiry || tokenExpiry.getTokenExpiry()}
                      </span>
                    </div>
                  </div>
                  <span
                    className="text-xs font-digital uppercase px-3 py-1.5 font-bold"
                    style={{ color: userColor, backgroundColor: `${userColor}20`, border: `2px solid ${userColor}` }}
                  >
                    ACTIVE
                  </span>
                </div>

                {/* Previous wallets */}
                {accounts.walletHistory
                  .filter(w => w.address.toLowerCase() !== address.toLowerCase())
                  .sort((a, b) => b.lastUsed - a.lastUsed)
                  .map((wallet, i, arr) => (
                    <button
                      key={wallet.address}
                      onClick={() => {
                        accounts.handleSwitchWallet(wallet)
                        setShowAccountsDropdown(false)
                      }}
                      disabled={accounts.isSwitchingWallet}
                      className="w-full flex items-center gap-3 px-4 py-4 transition-all hover:bg-[var(--hover-bg)]"
                      style={{
                        fontFamily: 'var(--font-digital), monospace',
                        borderBottom: i < arr.length - 1 ? '2px solid var(--border-strong)' : 'none',
                      }}
                    >
                      <div className="flex-shrink-0"><WalletModeLogo mode={wallet.mode} size={22} /></div>
                      <div className="flex-1 min-w-0 text-left">
                        <span className="text-base font-digital font-bold tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                          {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                        </span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-xs font-digital uppercase font-bold tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                            {wallet.lastUsed ? (() => {
                              const ago = Math.floor(Date.now() / 1000 - wallet.lastUsed / 1000)
                              if (ago < 60) return `${ago}s ago`
                              if (ago < 3600) return `${Math.floor(ago / 60)}m ago`
                              if (ago < 86400) return `${Math.floor(ago / 3600)}h ago`
                              return `${Math.floor(ago / 86400)}d ago`
                            })() : 'NO SESSION'}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                {accounts.walletHistory.filter(w => w.address.toLowerCase() !== address.toLowerCase()).length === 0 && (
                  <div className="text-center py-3 text-[10px] font-digital uppercase" style={{ color: 'var(--text-tertiary)' }}>
                    No previous wallets
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right actions - inside the unified bar */}
        <div className="flex items-center gap-0 flex-shrink-0">
          {/* Token refresh + timer */}
          <div ref={tokenDropdownRef} className="relative">
            <button
              onClick={() => setShowTokenDropdown(!showTokenDropdown)}
              className="flex items-center gap-1.5 px-3 h-[52px] font-bold tracking-wide transition-all hover:bg-[var(--hover-bg)]"
              style={{
                fontSize: '18px',
                color: tokenExpiry.isTokenExpired ? '#eab308' : 'var(--text-tertiary)',
                fontFamily: 'var(--font-digital), monospace',
                borderLeft: '2px solid var(--border-strong)',
              }}
              title="Token details"
            >
              <ArrowPathIcon className={`w-4 h-4 ${tokenExpiry.isRefreshing ? 'animate-spin' : ''}`} />
              <span className="tabular-nums">{tokenExpiry.tokenExpiry || tokenExpiry.getTokenExpiry()}</span>
            </button>

            {/* Token dropdown */}
            <AnimatePresence>
              {showTokenDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full right-0 mt-1.5 overflow-hidden z-[200]"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '2px solid var(--accent-primary)',
                    borderRadius: '12px',
                    minWidth: '520px',
                    boxShadow: '0 0 30px rgba(34,197,94,0.15), 0 8px 32px rgba(0,0,0,0.4)',
                  }}
                >
                  {/* Header - compact with wallet icon */}
                  <div className="px-4 py-2.5 flex items-center gap-2.5" style={{ borderBottom: '2px solid var(--border-strong)', background: 'linear-gradient(135deg, var(--bg-input) 0%, rgba(34,197,94,0.05) 100%)' }}>
                    {/* Wallet icon */}
                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke={tokenExpiry.isTokenExpired ? '#ef4444' : '#22c55e'} strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-5zm-4 1a1 1 0 100-2 1 1 0 000 2z" />
                    </svg>
                    <span className="font-digital uppercase font-bold tracking-wider" style={{ fontSize: '16px', color: 'var(--text-tertiary)' }}>SESSION TOKEN</span>
                    <div className="flex-1" />
                    <button
                      onClick={(e) => { e.stopPropagation(); tokenExpiry.handleRefreshToken() }}
                      disabled={tokenExpiry.isRefreshing}
                      className="flex items-center justify-center gap-1.5 px-2.5 py-1 transition-all hover:bg-[var(--hover-bg)]"
                      style={{
                        fontFamily: 'var(--font-digital), monospace',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: 'var(--accent-primary)',
                        border: '1px solid var(--accent-primary)',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                      }}
                    >
                      <ArrowPathIcon className={`w-3.5 h-3.5 ${tokenExpiry.isRefreshing ? 'animate-spin' : ''}`} />
                      REFRESH
                    </button>
                    <span className="font-digital uppercase tabular-nums font-bold" style={{ fontSize: '14px', color: tokenExpiry.isTokenExpired ? '#ef4444' : '#22c55e' }}>
                      {tokenExpiry.tokenExpiry || tokenExpiry.getTokenExpiry()}
                    </span>
                  </div>

                  {/* View tabs - compact */}
                  <div className="flex" style={{ borderBottom: '2px solid var(--border-strong)' }}>
                    {(['raw', 'json', 'create'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setTokenView(tab)}
                        className="flex-1 py-2 font-bold uppercase tracking-wider transition-all"
                        style={{
                          fontFamily: 'var(--font-digital), monospace',
                          fontSize: '16px',
                          color: tokenView === tab ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                          backgroundColor: tokenView === tab ? 'var(--bg-input)' : 'transparent',
                          borderBottom: tokenView === tab ? '2px solid var(--accent-primary)' : '2px solid transparent',
                        }}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  <div className="p-3">
                    {/* Encoding badges - inline compact */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="px-2 py-0.5 font-bold uppercase" style={{ fontFamily: 'var(--font-digital), monospace', fontSize: '11px', color: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '3px' }}>
                        BASE64URL
                      </span>
                      <span className="px-2 py-0.5 font-bold uppercase" style={{ fontFamily: 'var(--font-digital), monospace', fontSize: '11px', color: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '3px' }}>
                        JSON PAYLOAD
                      </span>
                      <span className="px-2 py-0.5 font-bold uppercase" style={{ fontFamily: 'var(--font-digital), monospace', fontSize: '11px', color: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: '3px' }}>
                        HMAC-SHA256
                      </span>
                    </div>

                    {/* RAW view */}
                    {tokenView === 'raw' && (() => {
                      const token = typeof window !== 'undefined' ? localStorage.getItem('wallet_token') : null
                      return token ? (
                        <div
                          onClick={() => copyToken()}
                          className="px-3 py-3 mb-2 break-all cursor-pointer transition-all"
                          style={{
                            backgroundColor: 'var(--bg-input)',
                            border: '2px solid var(--border-strong)',
                            borderRadius: '6px',
                            fontFamily: 'var(--font-digital), monospace',
                            fontSize: '14px',
                            color: copiedToken ? '#22c55e' : 'var(--text-tertiary)',
                            maxHeight: '160px',
                            overflowY: 'auto',
                            lineHeight: 1.5,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(34,197,94,0.15)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.boxShadow = 'none' }}
                          title="Click to copy"
                        >
                          {token}
                        </div>
                      ) : (
                        <div className="px-3 py-3 mb-2" style={{ fontFamily: 'var(--font-digital)', fontSize: '14px', color: 'var(--text-tertiary)' }}>
                          No token
                        </div>
                      )
                    })()}

                    {/* JSON view */}
                    {tokenView === 'json' && (() => {
                      try {
                        const token = typeof window !== 'undefined' ? localStorage.getItem('wallet_token') : null
                        if (!token) return <div className="px-3 py-3 mb-2" style={{ fontFamily: 'var(--font-digital)', fontSize: '14px', color: 'var(--text-tertiary)' }}>No token</div>
                        const auth = new Auth()
                        const decoded = auth.token2data(token)
                        return (
                          <div
                            className="px-3 py-2 mb-2 overflow-auto"
                            style={{
                              backgroundColor: 'var(--bg-input)',
                              border: '2px solid var(--border-strong)',
                              borderRadius: '6px',
                              maxHeight: '240px',
                            }}
                          >
                            {Object.entries(decoded).map(([key, value]) => (
                              <div key={key} className="flex gap-3 py-1.5" style={{ borderBottom: '1px solid var(--border-strong)' }}>
                                <span style={{ fontFamily: 'var(--font-digital)', fontSize: '14px', color: '#8b5cf6', fontWeight: 'bold', textTransform: 'uppercase', minWidth: '90px', flexShrink: 0 }}>
                                  {key}
                                </span>
                                <span
                                  className="break-all"
                                  style={{
                                    fontFamily: 'var(--font-digital), monospace',
                                    fontSize: '14px',
                                    color: key === 'time' ? '#f59e0b' : key === 'key' ? '#22c55e' : 'var(--text-tertiary)',
                                    lineHeight: 1.4,
                                  }}
                                >
                                  {typeof value === 'string' ? value || '""' : JSON.stringify(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )
                      } catch {
                        return <div className="px-3 py-3 mb-2" style={{ fontFamily: 'var(--font-digital)', fontSize: '14px', color: '#ef4444' }}>Failed to decode token</div>
                      }
                    })()}

                    {/* CREATE view */}
                    {tokenView === 'create' && (
                      <div className="mb-2">
                        <label className="block mb-1.5" style={{ fontFamily: 'var(--font-digital)', fontSize: '13px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 'bold' }}>
                          Token Data (payload)
                        </label>
                        <textarea
                          value={createTokenData}
                          onChange={(e) => setCreateTokenData(e.target.value)}
                          placeholder='e.g. {"role":"admin"} or any string'
                          rows={3}
                          className="w-full px-3 py-2.5 focus:outline-none resize-none"
                          style={{
                            backgroundColor: 'var(--bg-input)',
                            border: '2px solid var(--border-strong)',
                            borderRadius: '6px',
                            fontFamily: 'var(--font-digital), monospace',
                            fontSize: '14px',
                            color: 'var(--text-primary)',
                            caretColor: 'var(--accent-primary)',
                          }}
                          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)' }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                        />
                        <button
                          onClick={async () => {
                            try {
                              const walletMode = localStorage.getItem('wallet_mode') || 'local'
                              const walletAddress = localStorage.getItem('wallet_address') || address
                              const auth = new Auth()
                              const newToken = await auth.token(createTokenData || '', walletAddress, walletMode)
                              localStorage.setItem('wallet_token', newToken)
                              setTokenView('json')
                              setCreateTokenData('')
                            } catch (err: any) {
                              console.error('Failed to create token:', err)
                            }
                          }}
                          className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 transition-all hover:bg-[var(--hover-bg)]"
                          style={{
                            fontFamily: 'var(--font-digital), monospace',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            color: 'var(--accent-primary)',
                            border: '2px solid var(--accent-primary)',
                            borderRadius: '6px',
                            backgroundColor: 'var(--bg-input)',
                            textTransform: 'uppercase',
                          }}
                        >
                          SIGN &amp; SET TOKEN
                        </button>
                      </div>
                    )}

                    {/* Copy action */}
                    <button
                      onClick={copyToken}
                      className="w-full flex items-center justify-center gap-2 py-2.5 transition-all"
                      style={{
                        fontFamily: 'var(--font-digital), monospace',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        color: copiedToken ? '#22c55e' : 'var(--text-tertiary)',
                        border: `2px solid ${copiedToken ? '#22c55e' : 'var(--border-strong)'}`,
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-input)',
                        textTransform: 'uppercase',
                        boxShadow: copiedToken ? '0 0 12px rgba(34,197,94,0.2)' : 'none',
                      }}
                      onMouseEnter={(e) => { if (!copiedToken) { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--accent-primary)' } }}
                      onMouseLeave={(e) => { if (!copiedToken) { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-tertiary)' } }}
                    >
                      {copiedToken ? <ClipboardDocumentCheckIcon className="w-5 h-5" /> : <ClipboardDocumentIcon className="w-5 h-5" />}
                      {copiedToken ? 'COPIED' : 'COPY TOKEN'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="flex items-center justify-center w-[42px] h-[52px] transition-all hover:bg-[var(--hover-bg)]"
            style={{
              color: 'var(--text-tertiary)',
              borderLeft: '2px solid var(--border-strong)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef4444' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
            title="Sign out"
          >
            <ArrowRightStartOnRectangleIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <WalletSidebar
            // Header
            shortAddress={shortAddress}
            walletMode={walletMode}
            copiedAddress={copiedAddress}
            copyAddress={copyAddress}
            tokenExpiry={tokenExpiry.tokenExpiry}
            getTokenExpiry={tokenExpiry.getTokenExpiry}
            isTokenExpired={tokenExpiry.isTokenExpired}
            isRefreshingToken={tokenExpiry.isRefreshing}
            handleRefreshToken={tokenExpiry.handleRefreshToken}
            handleSignOut={handleSignOut}
            onClose={() => setIsOpen(false)}
            marketCredit={balances.marketCredit}
            userColor={userColor}
            // Resize
            sidebarWidth={sidebar.sidebarWidth}
            isResizing={sidebar.isResizing}
            setIsResizing={sidebar.setIsResizing}
            // Tabs
            activeTab={activeTab}
            openTab={openTab}
            // Portfolio
            tokenBalances={balances.tokenBalances}
            customTokens={balances.customTokens}
            customTokenBalances={balances.customTokenBalances}
            sendFromPortfolio={transfers.sendFromPortfolio}
            setSendFromPortfolio={transfers.setSendFromPortfolio}
            transferRecipient={transfers.transferRecipient}
            setTransferRecipient={transfers.setTransferRecipient}
            transferAmount={transfers.transferAmount}
            setTransferAmount={transfers.setTransferAmount}
            isTransferring={transfers.isTransferring}
            setTransferTokenType={transfers.setTransferTokenType}
            topUpError={transfers.topUpError}
            setTopUpError={transfers.setTopUpError}
            topUpSuccess={transfers.topUpSuccess}
            setTopUpSuccess={transfers.setTopUpSuccess}
            showAddToken={balances.showAddToken}
            setShowAddToken={balances.setShowAddToken}
            newTokenAddress={balances.newTokenAddress}
            setNewTokenAddress={balances.setNewTokenAddress}
            isAddingToken={balances.isAddingToken}
            isRefreshingBalances={balances.isRefreshing}
            onRefreshBalances={balances.refreshAll}
            onTransfer={transfers.handleTransfer}
            onSendETH={transfers.handleSendETH}
            onSendCustomToken={transfers.handleSendCustomToken}
            onRemoveCustomToken={balances.handleRemoveCustomToken}
            onAddCustomToken={balances.handleAddCustomToken}
            // Top-up
            selectedToken={transfers.selectedToken}
            setSelectedToken={transfers.setSelectedToken}
            topUpAmount={transfers.topUpAmount}
            setTopUpAmount={transfers.setTopUpAmount}
            isProcessing={transfers.isProcessing}
            onTopUp={transfers.handleTopUpTransaction}
            // Withdraw
            withdrawTokenType={transfers.withdrawTokenType}
            setWithdrawTokenType={transfers.setWithdrawTokenType}
            withdrawAmount={transfers.withdrawAmount}
            setWithdrawAmount={transfers.setWithdrawAmount}
            isWithdrawing={transfers.isWithdrawing}
            onWithdraw={transfers.handleWithdraw}
            // Accounts
            address={address}
            walletHistory={accounts.walletHistory}
            isSwitchingWallet={accounts.isSwitchingWallet}
            onSwitchWallet={accounts.handleSwitchWallet}
            onRemoveFromHistory={accounts.handleRemoveFromHistory}
            // Transactions
            userTransactions={transactions.userTransactions}
            isLoadingTxs={transactions.isLoadingTxs}
            txsStatusFilter={transactions.txsStatusFilter}
            setTxsStatusFilter={transactions.setTxsStatusFilter}
            expandedTxIdx={transactions.expandedTxIdx}
            setExpandedTxIdx={transactions.setExpandedTxIdx}
            totalCost24h={transactions.totalCost24h}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default WalletHeader
