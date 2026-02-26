"use client";
import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { userContext } from '@/context'
import { cryptoWaitReady } from '@polkadot/util-crypto'
import { web3Accounts, web3Enable, web3FromAddress } from '@polkadot/extension-dapp'
import { motion, AnimatePresence } from 'framer-motion'
import { Key } from '@/key'

type AuthMode = 'local' | 'subwallet' | 'metamask' | 'phantom'

const MetamaskLogo = ({ size = "w-8 h-8" }: { size?: string }) => (
  <svg className={size} viewBox="0 0 318.6 318.6" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M274.1 35.5l-99.5 73.9 18.4-43.6z" fill="#E17726" stroke="#E17726" strokeWidth="1.5"/>
    <path d="M44.4 35.5l98.7 74.6-17.5-44.3zm193.9 171.3l-26.5 40.6 56.7 15.6 16.3-55.3zm-204.4.9L50.1 263l56.7-15.6-26.5-40.6z" fill="#E27625" stroke="#E27625" strokeWidth="1.5"/>
    <path d="M103.6 138.2l-15.8 23.9 56.3 2.5-2-60.5zm111.3 0l-39-34.8-1.3 61.2 56.2-2.5zM106.8 247.4l33.8-16.5-29.2-22.8zm71.1-16.5l33.9 16.5-4.7-39.3z" fill="#E27625" stroke="#E27625" strokeWidth="1.5"/>
    <path d="M211.8 247.4l-33.9-16.5 2.7 22.1-.3 9.3zm-105 0l31.5 14.9-.2-9.3 2.5-22.1z" fill="#D5BFB2" stroke="#D5BFB2" strokeWidth="1.5"/>
    <path d="M138.8 193.5l-28.2-8.3 19.9-9.1zm40.9 0l8.3-17.4 20 9.1z" fill="#233447" stroke="#233447" strokeWidth="1.5"/>
    <path d="M106.8 247.4l4.8-40.6-31.3.9zM207 206.8l4.8 40.6 26.5-39.7zm23.8-44.7l-56.2 2.5 5.2 28.9 8.3-17.4 20 9.1zm-120.2 23.1l20-9.1 8.2 17.4 5.3-28.9-56.3-2.5z" fill="#CC6228" stroke="#CC6228" strokeWidth="1.5"/>
    <path d="M87.8 162.1l23.6 46-.8-22.9zm120.3 23.1l-1 22.9 23.7-46zm-64-20.6l-5.3 28.9 6.6 34.1 1.5-44.9zm30.5 0l-2.7 18 1.2 45 6.7-34.1z" fill="#E27525" stroke="#E27525" strokeWidth="1.5"/>
    <path d="M179.8 193.5l-6.7 34.1 4.8 3.3 29.2-22.8 1-22.9zm-69.2-8.3l.8 22.9 29.2 22.8 4.8-3.3-6.6-34.1z" fill="#F5841F" stroke="#F5841F" strokeWidth="1.5"/>
    <path d="M180.3 262.3l.3-9.3-2.5-2.2h-37.7l-2.3 2.2.2 9.3-31.5-14.9 11 9 22.3 15.5h38.3l22.4-15.5 11-9z" fill="#C0AC9D" stroke="#C0AC9D" strokeWidth="1.5"/>
    <path d="M177.9 230.9l-4.8-3.3h-27.7l-4.8 3.3-2.5 22.1 2.3-2.2h37.7l2.5 2.2z" fill="#161616" stroke="#161616" strokeWidth="1.5"/>
    <path d="M278.3 114.2l8.5-40.8-12.7-37.9-96.2 71.4 37 31.3 52.3 15.3 11.6-13.5-5-3.6 8-7.3-6.2-4.8 8-6.1zM31.8 73.4l8.5 40.8-5.4 4 8 6.1-6.1 4.8 8 7.3-5 3.6 11.5 13.5 52.3-15.3 37-31.3-96.2-71.4z" fill="#763E1A" stroke="#763E1A" strokeWidth="1.5"/>
    <path d="M267.2 153.5l-52.3-15.3 15.8 23.9-23.7 46 31.2-.4h46.5zm-163.6-15.3l-52.3 15.3-17.4 54.2h46.4l31.1.4-23.6-46zm71 26.4l3.3-57.7 15.2-41.1h-67.5l15 41.1 3.5 57.7 1.2 18.2.1 44.8h27.7l.2-44.8z" fill="#F5841F" stroke="#F5841F" strokeWidth="1.5"/>
  </svg>
)

const PhantomLogo = ({ size = "w-8 h-8" }: { size?: string }) => (
  <svg className={size} viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="128" rx="24" fill="url(#phantom-gradient)"/>
    <path d="M96 64c0 17.673-14.327 32-32 32s-32-14.327-32-32V32h64v32z" fill="white"/>
    <circle cx="52" cy="58" r="6" fill="#AB9FF2"/>
    <circle cx="76" cy="58" r="6" fill="#AB9FF2"/>
    <defs>
      <linearGradient id="phantom-gradient" x1="0" y1="0" x2="128" y2="128">
        <stop stopColor="#AB9FF2"/>
        <stop offset="1" stopColor="#7C66DC"/>
      </linearGradient>
    </defs>
  </svg>
)

const SubwalletLogo = ({ size = "w-8 h-8" }: { size?: string }) => (
  <svg className={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="100" cy="100" r="100" fill="url(#subwallet-gradient)"/>
    <path d="M100 40L60 80L100 120L140 80L100 40Z" fill="white"/>
    <path d="M100 120L60 160L100 200L140 160L100 120Z" fill="white" opacity="0.6"/>
    <defs>
      <linearGradient id="subwallet-gradient" x1="0" y1="0" x2="200" y2="200">
        <stop stopColor="#00E5CC"/>
        <stop offset="1" stopColor="#00B8D4"/>
      </linearGradient>
    </defs>
  </svg>
)

const LocalKeyLogo = ({ size = "w-8 h-8" }: { size?: string }) => (
  <svg className={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7" cy="7" r="4" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M7 11V22M11 15H7M11 19H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M16 8L22 8M19 5L19 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)

function KeyPreview({ address, publicKey, label }: { address: string; publicKey?: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-sm overflow-hidden"
      style={{ backgroundColor: 'var(--bg-input)', border: '2px solid var(--border-strong)' }}
    >
      <div className="flex items-center justify-between px-4 py-2" style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '2px solid var(--border-strong)' }}>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#42be65]" />
          <span className="text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        </div>
        <button
          onClick={() => copyToClipboard(address)}
          className="text-[10px] font-medium hover:text-[#78a9ff] transition-colors uppercase tracking-wider"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="px-4 py-3 space-y-2">
        <div>
          <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Address</span>
          <p className="text-[13px] font-mono break-all leading-relaxed mt-0.5" style={{ color: 'var(--text-primary)' }}>
            {address.slice(0, 20)}<span style={{ color: 'var(--text-tertiary)' }}>...</span>{address.slice(-12)}
          </p>
        </div>
        {publicKey && (
          <div>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Public Key</span>
            <p className="text-[12px] font-mono break-all leading-relaxed mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {publicKey.slice(0, 20)}<span style={{ color: 'var(--text-tertiary)' }}>...</span>{publicKey.slice(-12)}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export function WalletAuthButton() {
  const { user, signIn, signOut, authLoading } = userContext()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('last_auth_mode') as AuthMode | null
      if (saved && ['local', 'subwallet', 'metamask', 'phantom'].includes(saved)) return saved
    }
    return 'metamask'
  })
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [accounts, setAccounts] = useState<any[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [isExpanded, setIsExpanded] = useState(false)
  const [metamaskAccounts, setMetamaskAccounts] = useState<string[]>([])
  const [selectedMetamaskAccount, setSelectedMetamaskAccount] = useState<string>('')

  useEffect(() => {
    const checkWallets = async () => {
      const extensions = await web3Enable('MOD')
      if (extensions.length > 0) {
        const allAccounts = await web3Accounts()
        setAccounts(allAccounts)
      }
    }
    checkWallets()
  }, [])

  // Persist auth mode selection
  useEffect(() => {
    localStorage.setItem('last_auth_mode', authMode)
  }, [authMode])

  // Auto-connect MetaMask if it's the default mode on modal open
  useEffect(() => {
    if (isExpanded && authMode === 'metamask' && metamaskAccounts.length === 0) {
      handleMetamaskConnect()
    }
  }, [isExpanded])

  const derivedKey = useMemo(() => {
    if (authMode !== 'local' || !password || password.length < 1) return null
    try {
      const key = new Key(password)
      return { address: key.address, publicKey: key.public_key }
    } catch {
      return null
    }
  }, [password, authMode])

  const handleLocalSignIn = async () => {
    if (!password) {
      setError('Password is required')
      return
    }

    setLoading(true)
    setError('')

    try {
      localStorage.setItem('wallet_mode', 'local')
      localStorage.setItem('wallet_password', password)
      const key = new Key(password)
      localStorage.setItem('wallet_address', key.address)
      await signIn()
      setShowAuthModal(false)
      setPassword('')
      setIsExpanded(false)
    } catch (err: any) {
      setError(err.message || 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  const handleSubwalletSignIn = async () => {
    if (!selectedAccount) {
      setError('Please select an account')
      return
    }

    setLoading(true)
    setError('')

    try {
      await cryptoWaitReady()

      const account = accounts.find(acc => acc.address === selectedAccount)
      if (!account) throw new Error('Account not found')

      const extensions = await web3Enable('MOD')
      if (extensions.length === 0) throw new Error('No extension found')

      localStorage.setItem('wallet_mode', 'subwallet')
      localStorage.setItem('wallet_address', selectedAccount)
      localStorage.setItem('wallet_type', account.type || 'sr25519')
      await signIn()
      setShowAuthModal(false)
      setIsExpanded(false)
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet')
    } finally {
      setLoading(false)
    }
  }

  const handleMetamaskConnect = async () => {
    setLoading(true)
    setError('')

    try {
      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask is not installed')
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      if (!accounts || accounts.length === 0) {
        throw new Error('No MetaMask accounts found')
      }
      setMetamaskAccounts(accounts)
      if (accounts.length === 1) {
        setSelectedMetamaskAccount(accounts[0])
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect MetaMask')
    } finally {
      setLoading(false)
    }
  }

  const handleMetamaskSignIn = async () => {
    if (!selectedMetamaskAccount) {
      setError('Please select a MetaMask account')
      return
    }

    setLoading(true)
    setError('')

    try {
      localStorage.setItem('wallet_mode', 'metamask')
      localStorage.setItem('wallet_address', selectedMetamaskAccount)
      localStorage.setItem('wallet_type', 'ethereum')
      await signIn()
      setShowAuthModal(false)
      setIsExpanded(false)
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with MetaMask')
    } finally {
      setLoading(false)
    }
  }

  const handlePhantomSignIn = async () => {
    setLoading(true)
    setError('')

    try {
      if (typeof window.solana === 'undefined' || !window.solana.isPhantom) {
        throw new Error('Phantom wallet is not installed')
      }

      const response = await window.solana.connect()
      if (!response.publicKey) {
        throw new Error('Failed to connect to Phantom')
      }

      localStorage.setItem('wallet_mode', 'phantom')
      localStorage.setItem('wallet_address', response.publicKey.toString())
      localStorage.setItem('wallet_type', 'solana')
      await signIn()
      setShowAuthModal(false)
      setIsExpanded(false)
    } catch (err: any) {
      setError(err.message || 'Failed to connect Phantom')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (authMode === 'local') {
      handleLocalSignIn()
    } else if (authMode === 'subwallet') {
      handleSubwalletSignIn()
    } else if (authMode === 'metamask') {
      if (metamaskAccounts.length === 0) {
        handleMetamaskConnect()
      } else {
        handleMetamaskSignIn()
      }
    } else if (authMode === 'phantom') {
      handlePhantomSignIn()
    }
  }

  const handleModalClose = () => {
    setShowAuthModal(false)
    setPassword('')
    setError('')
    setIsExpanded(false)
    setMetamaskAccounts([])
    setSelectedMetamaskAccount('')
    setSelectedAccount('')
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center px-6 h-12 font-mono" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-t-[#78a9ff] rounded-full animate-spin" style={{ borderColor: 'var(--border-input)', borderTopColor: '#78a9ff' }} />
          <span className="text-[13px] font-medium tracking-wide" style={{ color: 'var(--text-secondary)' }}>Loading...</span>
        </div>
      </div>
    )
  }

  if (user) {
    return null
  }

  const walletColors: Record<AuthMode, string> = {
    local: '#78a9ff',
    subwallet: '#00e5cc',
    metamask: '#f6851b',
    phantom: '#ab9ff2',
  }

  const wallets: { mode: AuthMode; label: string; Logo: React.FC<{ size?: string }>; tag: string; disabled: boolean; onClick: () => void }[] = [
    { mode: 'local', label: 'Local Key', Logo: LocalKeyLogo, tag: 'KEY', disabled: false, onClick: () => { setAuthMode('local'); setError(''); } },
    { mode: 'subwallet', label: 'SubWallet', Logo: SubwalletLogo, tag: 'SUB', disabled: accounts.length === 0, onClick: () => { setAuthMode('subwallet'); setError(''); } },
    { mode: 'metamask', label: 'MetaMask', Logo: MetamaskLogo, tag: 'ETH', disabled: false, onClick: () => { setAuthMode('metamask'); setError(''); if (metamaskAccounts.length === 0) handleMetamaskConnect(); } },
    { mode: 'phantom', label: 'Phantom', Logo: PhantomLogo, tag: 'SOL', disabled: false, onClick: () => { setAuthMode('phantom'); setError(''); } },
  ]

  const activeColor = walletColors[authMode]

  return (
    <div className="relative font-mono">
      {/* Trigger Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center h-12 px-5 transition-all border ${
          isExpanded
            ? 'bg-[#0f62fe] border-[#0f62fe] text-white'
            : ''
        }`}
        style={!isExpanded ? { backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-input)', color: 'var(--text-primary)' } : {}}
      >
        <div className="flex items-center gap-2.5">
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a2 2 0 0 1 2 2v3H6V3a2 2 0 0 1 2-2zm3 5V3a3 3 0 0 0-6 0v3H2v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6H11zm-1 1v6H4V7h8z"/></svg>
          <span className="text-[14px] font-semibold tracking-wide">Sign in</span>
          <svg className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="currentColor"><path d="M6 8.5L1 3.5h10L6 8.5z"/></svg>
        </div>
      </button>

      {/* Full-Page Auth Overlay - portaled to body */}
      {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed inset-0 flex items-center justify-center font-mono"
            style={{ zIndex: 99999, backgroundColor: 'var(--bg-primary)' }}
          >
            {/* Radial glow behind content */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: `radial-gradient(ellipse 800px 500px at 50% 40%, ${activeColor}0a 0%, transparent 70%)`,
              transition: 'background 0.8s ease',
            }} />

            {/* Secondary glow - top accent */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: `radial-gradient(ellipse 400px 100px at 50% 0%, ${activeColor}08 0%, transparent 100%)`,
              transition: 'background 0.8s ease',
            }} />

            {/* Close button - top right */}
            <button
              onClick={handleModalClose}
              className="absolute top-6 right-6 z-10 w-10 h-10 flex items-center justify-center transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <svg className="w-5 h-5" viewBox="0 0 16 16" fill="currentColor"><path d="M12.3 4.3L8.7 8l3.6 3.7-.7.7L8 8.7l-3.7 3.6-.7-.7L7.3 8 3.7 4.3l.7-.7L8 7.3l3.7-3.6.6.6z"/></svg>
            </button>

            {/* Main content - centered */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className="relative w-full max-w-[480px] mx-auto px-6"
            >
              {/* Title */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-1.5">
                  <motion.div
                    className="w-6 h-[2px]"
                    style={{ backgroundColor: activeColor }}
                    layoutId="auth-accent"
                    transition={{ duration: 0.3 }}
                  />
                  <span className="text-[10px] font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--text-tertiary)' }}>Mod Protocol</span>
                </div>
                <h1 className="text-[24px] font-bold tracking-tight leading-none" style={{ color: 'var(--text-primary)' }}>
                  Sign in
                </h1>
              </div>

              {/* Provider Selection */}
              <div className="mb-5">
                <span className="block text-[10px] font-medium uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--text-tertiary)' }}>Select provider</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {wallets.map(({ mode, label, Logo, tag, disabled, onClick }) => {
                    const isSelected = authMode === mode
                    const color = walletColors[mode]
                    return (
                      <button
                        key={mode}
                        onClick={onClick}
                        disabled={disabled}
                        className={`group relative flex flex-col items-center justify-center rounded-lg transition-all duration-200 py-5 ${
                          disabled ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'
                        }`}
                        style={{
                          backgroundColor: isSelected ? `${color}10` : 'var(--bg-secondary)',
                          border: isSelected ? `2px solid ${color}50` : '2px solid var(--border-strong)',
                          boxShadow: isSelected ? `0 0 20px ${color}10, inset 0 0 20px ${color}05` : 'var(--card-shadow)',
                        }}
                      >
                        {isSelected && (
                          <motion.div
                            className="absolute top-0 left-0 right-0 h-[2px] rounded-t-lg"
                            style={{ backgroundColor: color }}
                            layoutId="provider-indicator"
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                          />
                        )}
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-2.5 transition-all duration-200 ${
                          isSelected ? '' : 'opacity-40 group-hover:opacity-70'
                        }`} style={{
                          backgroundColor: isSelected ? `${color}15` : 'var(--bg-input)',
                        }}>
                          <Logo size="w-6 h-6" />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-[0.08em] transition-colors duration-200"
                          style={isSelected ? { color } : { color: 'var(--text-tertiary)' }}>{tag}</span>
                        <span className="text-[9px] mt-1 transition-colors duration-200"
                          style={{ color: 'var(--text-tertiary)' }}>{label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Form Area */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <AnimatePresence mode="wait">
                  {authMode === 'local' ? (
                    <motion.div
                      key="local"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-4"
                    >
                      <div>
                        <label className="block text-[10px] font-medium uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--text-tertiary)' }}>
                          Passphrase
                        </label>
                        <div className="relative group">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-[#78a9ff] transition-colors" style={{ color: 'var(--text-tertiary)' }}>
                            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a2 2 0 0 1 2 2v3H6V3a2 2 0 0 1 2-2zm3 5V3a3 3 0 0 0-6 0v3H2v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6H11zm-1 1v6H4V7h8z"/></svg>
                          </div>
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full h-12 pl-11 pr-4 rounded text-[14px] font-mono focus:outline-none focus:border-[#78a9ff]/40 transition-all duration-200"
                            style={{ backgroundColor: 'var(--bg-input)', border: '2px solid var(--border-strong)', color: 'var(--text-primary)', boxShadow: password ? `0 0 0 1px ${activeColor}20` : 'none' }}
                            placeholder="Enter passphrase"
                            autoFocus
                          />
                        </div>
                        <p className="text-[11px] mt-2 flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
                          <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 16 16"><path d="M8 1a7 7 0 110 14A7 7 0 018 1zm0 1a6 6 0 100 12A6 6 0 008 2zm-.5 3h1v5h-1V5zm0 6h1v1h-1v-1z"/></svg>
                          Deterministic key derived from your passphrase
                        </p>
                      </div>

                      {/* Key Preview */}
                      <AnimatePresence>
                        {derivedKey && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <KeyPreview
                              address={derivedKey.address}
                              publicKey={derivedKey.publicKey}
                              label="Derived Key"
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ) : authMode === 'subwallet' ? (
                    <motion.div
                      key="subwallet"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-4"
                    >
                      <label className="block text-[11px] font-medium uppercase tracking-[0.16em] mb-2" style={{ color: 'var(--text-tertiary)' }}>
                        Account
                      </label>
                      {accounts.length === 0 ? (
                        <div className="flex items-center gap-3 p-4 rounded-sm" style={{ backgroundColor: 'var(--bg-input)', border: '2px solid var(--border-strong)' }}>
                          <svg className="w-4 h-4 text-[#f1c21b] shrink-0" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L0 15h16L8 1zm0 3.2L13.4 14H2.6L8 4.2zM7.25 7v3.5h1.5V7h-1.5zm0 4.5v1.5h1.5v-1.5h-1.5z"/></svg>
                          <span className="text-[13px] text-[#f1c21b]">No wallet extension detected</span>
                        </div>
                      ) : (
                        <div className="rounded-sm overflow-hidden" style={{ border: '2px solid var(--border-strong)' }}>
                          {accounts.map((account) => {
                            const selected = selectedAccount === account.address
                            return (
                              <button
                                key={account.address}
                                type="button"
                                onClick={() => setSelectedAccount(account.address)}
                                className="w-full text-left px-4 py-3 text-[13px] font-mono transition-all last:border-b-0"
                                style={{
                                  backgroundColor: selected ? 'rgba(0,229,204,0.05)' : 'var(--bg-secondary)',
                                  borderBottom: '1px solid var(--border-color)',
                                }}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-2.5 h-2.5 rounded-full border-2 shrink-0 transition-all ${
                                    selected ? 'border-[#00e5cc] bg-[#00e5cc]' : ''
                                  }`} style={!selected ? { borderColor: 'var(--border-strong)' } : {}} />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-[13px] truncate transition-colors" style={{ color: selected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{account.meta.name}</div>
                                    <div className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                                      {account.address.slice(0, 14)}...{account.address.slice(-10)}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}

                    </motion.div>
                  ) : authMode === 'metamask' ? (
                    <motion.div
                      key="metamask"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-4"
                    >
                      {metamaskAccounts.length === 0 ? (
                        <div className="flex items-center gap-4 p-4 rounded-sm" style={{ backgroundColor: 'var(--bg-input)', border: '2px solid var(--border-strong)' }}>
                          <MetamaskLogo />
                          <div>
                            <p className="text-[13px] text-[#f6851b] font-semibold">MetaMask</p>
                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Click sign in to connect your wallet</p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[11px] font-medium uppercase tracking-[0.16em] mb-2" style={{ color: 'var(--text-tertiary)' }}>
                            Account
                          </label>
                          <div className="rounded-sm overflow-hidden" style={{ border: '2px solid var(--border-strong)' }}>
                            {metamaskAccounts.map((address, index) => {
                              const selected = selectedMetamaskAccount === address
                              return (
                                <button
                                  key={address}
                                  type="button"
                                  onClick={() => setSelectedMetamaskAccount(address)}
                                  className="w-full text-left px-4 py-3 text-[13px] font-mono transition-all last:border-b-0"
                                  style={{
                                    backgroundColor: selected ? 'rgba(246,133,27,0.05)' : 'var(--bg-secondary)',
                                    borderBottom: '1px solid var(--border-color)',
                                  }}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`w-2.5 h-2.5 rounded-full border-2 shrink-0 transition-all ${
                                      selected ? 'border-[#f6851b] bg-[#f6851b]' : ''
                                    }`} style={!selected ? { borderColor: 'var(--border-strong)' } : {}} />
                                    <div className="flex-1 min-w-0">
                                      <div className="font-semibold text-[13px] transition-colors" style={{ color: selected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>Account {index + 1}</div>
                                      <div className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                                        {address.slice(0, 14)}...{address.slice(-10)}
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              )
                            })}
                          </div>

                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="phantom"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className="flex items-center gap-4 p-4 rounded-sm" style={{ backgroundColor: 'var(--bg-input)', border: '2px solid var(--border-strong)' }}>
                        <PhantomLogo />
                        <div>
                          <p className="text-[13px] text-[#ab9ff2] font-semibold">Phantom</p>
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Click sign in to connect your Solana wallet</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2.5 p-3 bg-[#da1e28]/5 border border-[#da1e28]/20 rounded-sm"
                    >
                      <svg className="w-4 h-4 text-[#fa4d56] shrink-0" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.75 3.5h1.5v5h-1.5v-5zm0 6h1.5v1.5h-1.5v-1.5z"/></svg>
                      <span className="text-[13px] text-[#fa4d56]">{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={loading || (authMode === 'subwallet' && accounts.length === 0)}
                    className="flex-1 h-12 text-[14px] font-semibold tracking-wide transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed rounded relative overflow-hidden group"
                    style={{
                      backgroundColor: activeColor,
                      opacity: loading || (authMode === 'subwallet' && accounts.length === 0) ? 0.3 : 1,
                      color: authMode === 'phantom' || authMode === 'subwallet' ? '#0d0d0d' : '#fff',
                    }}
                  >
                    <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-all duration-200" />
                    {loading ? (
                      <span className="relative flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-current/20 border-t-current rounded-full animate-spin" />
                        <span>Connecting...</span>
                      </span>
                    ) : authMode === 'metamask' && metamaskAccounts.length === 0 ? (
                      <span className="relative flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"><path d="M13.5 3L8 0.5 2.5 3v5c0 3.5 2.3 6.5 5.5 7.5 3.2-1 5.5-4 5.5-7.5V3zM8 2l4 1.8v4.7c0 2.7-1.8 5-4 5.9-2.2-.9-4-3.2-4-5.9V3.8L8 2z"/></svg>
                        Connect wallet
                      </span>
                    ) : (
                      <span className="relative flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"><path d="M13 5l-1.5-1.5L7 8 4.5 5.5 3 7l4 4z"/></svg>
                        Sign in
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleModalClose}
                    className="h-12 px-8 bg-transparent text-[14px] font-semibold tracking-wide transition-all duration-200 rounded"
                    style={{ color: 'var(--text-secondary)', border: '2px solid var(--border-strong)' }}
                  >
                    Cancel
                  </button>
                </div>
              </form>

              {/* Footer */}
              <div className="mt-6 pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: activeColor, opacity: 0.6 }} />
                    <span className="text-[10px] font-mono tracking-[0.15em]" style={{ color: 'var(--text-tertiary)' }}>MOD AUTH v1.0</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#42be65]" />
                      <span className="text-[10px] font-mono tracking-[0.15em]" style={{ color: 'var(--text-tertiary)' }}>ENCRYPTED</span>
                    </div>
                    <span className="text-[10px] font-mono" style={{ color: 'var(--border-color)' }}>|</span>
                    <span className="text-[10px] font-mono tracking-[0.15em]" style={{ color: 'var(--text-tertiary)' }}>SECURE CONNECTION</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
      )}
    </div>
  )
}

export default WalletAuthButton
