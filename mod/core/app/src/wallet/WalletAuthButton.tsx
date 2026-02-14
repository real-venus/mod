"use client";
import { useState, useEffect } from 'react'
import { userContext } from '@/context'
import { cryptoWaitReady } from '@polkadot/util-crypto'
import { web3Accounts, web3Enable, web3FromAddress } from '@polkadot/extension-dapp'
import { KeyIcon, WalletIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import { Key } from '@/key'

type AuthMode = 'local' | 'subwallet' | 'metamask' | 'phantom'

// Wallet Logos as SVG components
const MetamaskLogo = () => (
  <svg className="w-6 h-6" viewBox="0 0 318.6 318.6" fill="none" xmlns="http://www.w3.org/2000/svg">
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

const PhantomLogo = () => (
  <svg className="w-6 h-6" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
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

const SubwalletLogo = () => (
  <svg className="w-6 h-6" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
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

const LocalKeyLogo = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7" cy="7" r="4" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M7 11V22M11 15H7M11 19H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M16 8L22 8M19 5L19 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)

export function WalletAuthButton() {
  const { user, signIn, signOut, authLoading } = userContext()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('local')
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
      <div className="flex items-center justify-center px-6 py-4 bg-black border-2 border-white/30 text-white rounded-xl backdrop-blur-md" style={{height: '60px'}}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span className="font-bold text-lg">Loading...</span>
        </div>
      </div>
    )
  }

  if (user) {
    return null
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-center px-8 py-4 bg-black hover:bg-white/5 border-2 border-white/40 hover:border-white/60 text-white rounded-xl font-bold text-xl uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
        style={{height: '60px'}}
      >
        <div className="flex items-center gap-3">
          <KeyIcon className="w-6 h-6" />
          <span>SIGN IN</span>
          <ChevronDownIcon className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute top-full right-0 mt-2 p-6 border-2 border-white/40 rounded-2xl shadow-2xl z-50 min-w-[460px] backdrop-blur-xl"
            style={{
              borderRadius: '16px',
              backgroundColor: 'rgba(0, 0, 0, 0.98)',
              boxShadow: '0 0 40px rgba(255, 255, 255, 0.3), 0 20px 60px rgba(0, 0, 0, 0.9), inset 0 0 20px rgba(255, 255, 255, 0.05)'
            }}
          >
            <div className="flex items-center justify-center gap-2 mb-5">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/20" />
              <p className="text-xs text-white/50 font-mono uppercase tracking-widest">Select wallet</p>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/20" />
            </div>

            <div className="flex gap-2 mb-6">
              {([
                { mode: 'local' as AuthMode, label: 'LOCAL', Logo: LocalKeyLogo, color: 'blue', onClick: () => { setAuthMode('local'); setError(''); } },
                { mode: 'subwallet' as AuthMode, label: 'SUBWALLET', Logo: SubwalletLogo, color: 'cyan', disabled: accounts.length === 0, onClick: () => { setAuthMode('subwallet'); setError(''); } },
                { mode: 'metamask' as AuthMode, label: 'METAMASK', Logo: MetamaskLogo, color: 'orange', onClick: () => { setAuthMode('metamask'); setError(''); if (metamaskAccounts.length === 0) handleMetamaskConnect(); } },
                { mode: 'phantom' as AuthMode, label: 'PHANTOM', Logo: PhantomLogo, color: 'purple', onClick: () => { setAuthMode('phantom'); setError(''); } },
              ] as const).map(({ mode, label, Logo, color, disabled, onClick }) => {
                const isSelected = authMode === mode
                const colorMap: Record<string, { border: string, bg: string, text: string, glow: string, check: string }> = {
                  blue: { border: 'border-blue-400', bg: 'from-blue-500/25 to-blue-600/15', text: 'text-blue-300', glow: 'shadow-blue-500/40', check: 'bg-blue-400' },
                  cyan: { border: 'border-cyan-400', bg: 'from-cyan-500/25 to-cyan-600/15', text: 'text-cyan-300', glow: 'shadow-cyan-500/40', check: 'bg-cyan-400' },
                  orange: { border: 'border-orange-400', bg: 'from-orange-500/25 to-orange-600/15', text: 'text-orange-300', glow: 'shadow-orange-500/40', check: 'bg-orange-400' },
                  purple: { border: 'border-purple-400', bg: 'from-purple-500/25 to-purple-600/15', text: 'text-purple-300', glow: 'shadow-purple-500/40', check: 'bg-purple-400' },
                }
                const c = colorMap[color]
                return (
                  <button
                    key={mode}
                    onClick={onClick}
                    disabled={disabled}
                    className={`group relative flex-1 flex items-center gap-2.5 px-3 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 border-2 ${
                      isSelected
                        ? `bg-gradient-to-r ${c.bg} ${c.text} ${c.border} shadow-lg ${c.glow}`
                        : 'bg-black/60 text-white/50 border-white/15 hover:border-white/30 hover:text-white/70'
                    } ${disabled ? 'opacity-35 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'}`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      isSelected ? `${c.border}` : 'border-white/30'
                    }`}>
                      {isSelected && (
                        <div className={`w-2.5 h-2.5 rounded-full ${c.check}`} />
                      )}
                    </div>
                    <Logo />
                    <span className="font-black tracking-wide hidden sm:inline">{label}</span>
                  </button>
                )
              })}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {authMode === 'local' ? (
                <div>
                  <label className="block text-white/80 mb-3 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1 h-4 bg-blue-400 rounded-full" />
                    PASSWORD
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-5 py-4 bg-black/60 border-2 border-white/30 text-white rounded-xl font-mono text-sm focus:outline-none focus:border-blue-400 focus:shadow-lg focus:shadow-blue-500/20 transition-all placeholder:text-white/30"
                    placeholder="Enter your password"
                    autoFocus
                  />
                </div>
              ) : authMode === 'subwallet' ? (
                <div>
                  <label className="block text-white/80 mb-3 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1 h-4 bg-cyan-400 rounded-full" />
                    SELECT ACCOUNT
                  </label>
                  {accounts.length === 0 ? (
                    <div className="p-5 bg-gradient-to-br from-yellow-900/30 to-yellow-800/20 border-2 border-yellow-500/50 rounded-xl backdrop-blur-sm">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">⚠️</div>
                        <p className="text-yellow-300 font-bold text-sm">No wallet extension detected</p>
                      </div>
                    </div>
                  ) : (
                    <div className="max-h-56 overflow-y-auto bg-black/60 border-2 border-cyan-500/30 rounded-xl space-y-1 p-2">
                      {accounts.map((account) => {
                        const selected = selectedAccount === account.address
                        return (
                          <button
                            key={account.address}
                            type="button"
                            onClick={() => setSelectedAccount(account.address)}
                            className={`w-full text-left px-4 py-3 font-mono text-sm transition-all duration-200 rounded-lg ${
                              selected
                                ? 'bg-gradient-to-r from-cyan-500/20 to-cyan-600/15 text-cyan-300'
                                : 'text-white/60 hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                selected ? 'border-cyan-400' : 'border-white/30'
                              }`}>
                                {selected && <div className="w-2 h-2 rounded-full bg-cyan-400" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm truncate">{account.meta.name}</div>
                                <div className="text-xs text-white/40 truncate mt-0.5">
                                  {account.address.slice(0, 14)}...{account.address.slice(-14)}
                                </div>
                              </div>
                              {selected && <span className="text-cyan-400 text-xs font-bold">&#10003;</span>}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : authMode === 'metamask' ? (
                <div>
                  {metamaskAccounts.length === 0 ? (
                    <div className="p-5 bg-gradient-to-br from-orange-900/30 to-orange-800/20 border-2 border-orange-500/50 rounded-xl backdrop-blur-sm">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">🦊</div>
                        <div>
                          <p className="text-orange-300 font-bold text-sm mb-1">Connect MetaMask</p>
                          <p className="text-orange-200/60 text-xs">Click SIGN IN to connect your wallet</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-white/80 mb-3 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1 h-4 bg-orange-400 rounded-full" />
                        SELECT ACCOUNT
                      </label>
                      <div className="max-h-56 overflow-y-auto bg-black/60 border-2 border-orange-500/30 rounded-xl space-y-1 p-2">
                        {metamaskAccounts.map((address, index) => {
                          const selected = selectedMetamaskAccount === address
                          return (
                            <button
                              key={address}
                              type="button"
                              onClick={() => setSelectedMetamaskAccount(address)}
                              className={`w-full text-left px-4 py-3 font-mono text-sm transition-all duration-200 rounded-lg ${
                                selected
                                  ? 'bg-gradient-to-r from-orange-500/20 to-orange-600/15 text-orange-300'
                                  : 'text-white/60 hover:bg-white/5'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                  selected ? 'border-orange-400' : 'border-white/30'
                                }`}>
                                  {selected && <div className="w-2 h-2 rounded-full bg-orange-400" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-bold text-sm">Account {index + 1}</div>
                                  <div className="text-xs text-white/40 truncate mt-0.5">
                                    {address.slice(0, 14)}...{address.slice(-14)}
                                  </div>
                                </div>
                                {selected && <span className="text-orange-400 text-xs font-bold">&#10003;</span>}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-5 bg-gradient-to-br from-purple-900/30 to-purple-800/20 border-2 border-purple-500/50 rounded-xl backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">👻</div>
                    <div>
                      <p className="text-purple-300 font-bold text-sm mb-1">Connect Phantom</p>
                      <p className="text-purple-200/60 text-xs">Click SIGN IN to connect your wallet</p>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-300 font-bold text-sm border-2 border-red-500/50 bg-gradient-to-br from-red-900/30 to-red-800/20 p-4 rounded-xl backdrop-blur-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-xl">❌</div>
                    <div className="flex-1">{error}</div>
                  </div>
                </motion.div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading || (authMode === 'subwallet' && accounts.length === 0)}
                  className="flex-1 px-5 py-3.5 bg-gradient-to-r from-green-500/30 to-emerald-500/30 text-green-300 hover:from-green-500/40 hover:to-emerald-500/40 border-2 border-green-500/60 hover:border-green-400 rounded-xl font-black text-sm uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-green-500/20 relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-green-400/0 via-green-400/20 to-green-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                  {loading ? (
                    <span className="flex items-center justify-center gap-2 relative z-10">
                      <div className="w-4 h-4 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
                      <span>LOADING...</span>
                    </span>
                  ) : authMode === 'metamask' && metamaskAccounts.length === 0 ? (
                    <span className="relative z-10">CONNECT METAMASK</span>
                  ) : (
                    <span className="relative z-10">SIGN IN</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-5 py-3.5 bg-black/60 text-white/50 border-2 border-white/15 hover:border-red-500/40 hover:text-red-300 hover:bg-red-500/10 rounded-xl font-black text-sm uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-95"
                >
                  CANCEL
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default WalletAuthButton
