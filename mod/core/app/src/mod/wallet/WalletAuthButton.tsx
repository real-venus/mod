'use client'
import { useState, useEffect } from 'react'
import { userContext } from '@/mod/context'
import { cryptoWaitReady } from '@polkadot/util-crypto'
import { web3Accounts, web3Enable, web3FromAddress } from '@polkadot/extension-dapp'
import { KeyIcon, WalletIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'

type AuthMode = 'local' | 'subwallet' | 'metamask' | 'phantom'

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

  const handleMetamaskSignIn = async () => {
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

      localStorage.setItem('wallet_mode', 'metamask')
      localStorage.setItem('wallet_address', accounts[0])
      localStorage.setItem('wallet_type', 'ethereum')
      await signIn()
      setShowAuthModal(false)
      setIsExpanded(false)
    } catch (err: any) {
      setError(err.message || 'Failed to connect MetaMask')
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
      handleMetamaskSignIn()
    } else if (authMode === 'phantom') {
      handlePhantomSignIn()
    }
  }

  const handleModalClose = () => {
    setShowAuthModal(false)
    setPassword('')
    setError('')
    setIsExpanded(false)
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
            className="absolute top-full right-0 mt-2 p-6 border-2 border-white/40 rounded-xl shadow-2xl z-50 min-w-[450px] backdrop-blur-xl"
            style={{
              borderRadius: '12px',
              backgroundColor: 'rgba(0, 0, 0, 0.95)',
              boxShadow: '0 0 30px rgba(255, 255, 255, 0.2), 0 10px 40px rgba(0, 0, 0, 0.8)'
            }}
          >
            <h2 className="text-2xl font-bold text-white mb-4 uppercase tracking-wider text-center">AUTHENTICATE</h2>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => { setAuthMode('local'); setError(''); }}
                className={`px-4 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all border-2 ${
                  authMode === 'local'
                    ? 'bg-white/10 text-white border-white/60'
                    : 'bg-black text-white/60 border-white/30 hover:bg-white/5 hover:border-white/40'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <KeyIcon className="w-4 h-4" />
                  <span>LOCAL</span>
                </div>
              </button>
              <button
                onClick={() => { setAuthMode('subwallet'); setError(''); }}
                className={`px-4 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all border-2 ${
                  authMode === 'subwallet'
                    ? 'bg-white/10 text-white border-white/60'
                    : 'bg-black text-white/60 border-white/30 hover:bg-white/5 hover:border-white/40'
                } ${accounts.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={accounts.length === 0}
              >
                <div className="flex items-center justify-center gap-2">
                  <WalletIcon className="w-4 h-4" />
                  <span>SUBWALLET</span>
                </div>
              </button>
              <button
                onClick={() => { setAuthMode('metamask'); setError(''); }}
                className={`px-4 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all border-2 ${
                  authMode === 'metamask'
                    ? 'bg-white/10 text-white border-white/60'
                    : 'bg-black text-white/60 border-white/30 hover:bg-white/5 hover:border-white/40'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <WalletIcon className="w-4 h-4" />
                  <span>METAMASK</span>
                </div>
              </button>
              <button
                onClick={() => { setAuthMode('phantom'); setError(''); }}
                className={`px-4 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all border-2 ${
                  authMode === 'phantom'
                    ? 'bg-white/10 text-white border-white/60'
                    : 'bg-black text-white/60 border-white/30 hover:bg-white/5 hover:border-white/40'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <WalletIcon className="w-4 h-4" />
                  <span>PHANTOM</span>
                </div>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {authMode === 'local' ? (
                <div>
                  <label className="block text-white/70 mb-2 font-bold text-sm uppercase tracking-wider">PASSWORD</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-black border-2 border-white/40 text-white rounded-xl font-mono text-sm focus:outline-none focus:border-white/60 transition-all"
                    placeholder="Enter your password"
                    autoFocus
                  />
                </div>
              ) : authMode === 'subwallet' ? (
                <div>
                  <label className="block text-white/70 mb-2 font-bold text-sm uppercase tracking-wider">SELECT WALLET</label>
                  {accounts.length === 0 ? (
                    <div className="p-4 bg-yellow-900/20 border-2 border-yellow-500/40 rounded-xl">
                      <p className="text-yellow-400 font-bold text-xs">⚠️ No wallet extension detected</p>
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto bg-black border-2 border-white/40 rounded-xl">
                      {accounts.map((account) => (
                        <button
                          key={account.address}
                          type="button"
                          onClick={() => setSelectedAccount(account.address)}
                          className={`w-full text-left px-4 py-3 font-mono text-xs transition-all border-b border-white/20 last:border-b-0 hover:bg-white/5 ${
                            selectedAccount === account.address
                              ? 'bg-white/10 text-white font-bold'
                              : 'text-white/70'
                          }`}
                        >
                          <div className="font-bold truncate">{account.meta.name}</div>
                          <div className="text-xs text-white/50 truncate">
                            {account.address.slice(0, 12)}...{account.address.slice(-12)}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : authMode === 'metamask' ? (
                <div className="p-4 bg-orange-900/20 border-2 border-orange-500/40 rounded-xl">
                  <p className="text-orange-400 font-bold text-xs">🦊 Click SIGN IN to connect MetaMask</p>
                </div>
              ) : (
                <div className="p-4 bg-purple-900/20 border-2 border-purple-500/40 rounded-xl">
                  <p className="text-purple-400 font-bold text-xs">👻 Click SIGN IN to connect Phantom</p>
                </div>
              )}

              {error && (
                <div className="text-red-400 font-bold text-xs border-2 border-red-500/40 bg-red-900/20 p-3 rounded-xl">
                  ❌ {error}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={loading || (authMode === 'subwallet' && accounts.length === 0)}
                  className="flex-1 px-4 py-3 bg-white/10 text-white hover:bg-white/20 border-2 border-white/40 hover:border-white/60 rounded-xl font-bold text-sm uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? '⏳ LOADING...' : '🚀 SIGN IN'}
                </button>
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-4 py-3 bg-black text-white/70 border-2 border-white/30 hover:bg-white/5 hover:border-white/40 rounded-xl font-bold text-sm uppercase tracking-wider transition-all"
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
