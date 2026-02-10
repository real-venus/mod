"use client";

import { useState, useRef, useEffect } from 'react'
import { userContext } from '@/context/UserContext'
import { WalletIcon, ArrowRightOnRectangleIcon, ClipboardDocumentIcon, UserCircleIcon, ClockIcon, ArrowPathIcon, CreditCardIcon, QrCodeIcon, ChevronDownIcon, ChevronUpIcon, ArrowsRightLeftIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { WalletAuthButton } from './WalletAuthButton'
import { CopyButton } from '@/ui/CopyButton'
import { QRCode } from '@/ui/QRCode'
import { text2color } from '@/utils'
import { Auth } from '@/client/auth'
import WalletCreditDisplay from './WalletCreditDisplay'
import modConfig from '@/app/mod.json'
import { ethers } from 'ethers'

type TokenType = 'USDC' | 'USDT'

interface NetworkConfig {
  id: string
  name: string
  color: string
}

const NETWORKS: NetworkConfig[] = [
  { id: 'local', name: 'Local Ganache', color: '#10b981' },
  { id: 'base-sepolia', name: 'Base Sepolia', color: '#0052ff' },
  { id: 'base-mainnet', name: 'Base Mainnet', color: '#0052ff' }
]

export function WalletHeader() {
  const { user, signOut, client } = userContext()
  const [isHovered, setIsHovered] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [tokenExpiry, setTokenExpiry] = useState<string | null>(null)
  const [tokenDuration] = useState<number>(3600)
  const [showBalanceDropdown, setShowBalanceDropdown] = useState(false)
  const [isAddressQrHovered, setIsAddressQrHovered] = useState(false)
  const [isTokenQrHovered, setIsTokenQrHovered] = useState(false)
  const [showTopUpForm, setShowTopUpForm] = useState(false)
  const [marketCredit, setMarketCredit] = useState<number>(0)
  const [tokenBalances, setTokenBalances] = useState<Record<string, number>>({})
  const [showAllBalances, setShowAllBalances] = useState(false)
  const [selectedToken, setSelectedToken] = useState<TokenType>('USDC')
  const [topUpAmount, setTopUpAmount] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [topUpError, setTopUpError] = useState<string | null>(null)
  const [topUpSuccess, setTopUpSuccess] = useState<string | null>(null)
  const [showTransferForm, setShowTransferForm] = useState(false)
  const [transferRecipient, setTransferRecipient] = useState<string>('')
  const [transferAmount, setTransferAmount] = useState<string>('')
  const [isTransferring, setIsTransferring] = useState(false)
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkConfig>(NETWORKS[0])
  const [balanceRefreshSuccess, setBalanceRefreshSuccess] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()

  const address = user?.key || ''
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''
  const walletMode = user?.wallet_mode || ''
  const userColor = user ? text2color(user.key || '') : '#10b981'

  const getTokenExpiry = () => {
    try {
      const token = localStorage.getItem('wallet_token')
      if (!token) return 'No token'
      const auth = new Auth()
      const authData = auth.token2data(token)
      const tokenTime = parseFloat(authData.time)
      const expiryTime = tokenTime + tokenDuration
      const now = Date.now() / 1000
      const timeLeft = expiryTime - now
      if (timeLeft <= 0) return 'Expired'
      const minutes = Math.floor(timeLeft / 60)
      const seconds = Math.floor(timeLeft % 60)
      return `${minutes}m ${seconds}s`
    } catch (error) {
      return 'Invalid token'
    }
  }

  useEffect(() => {
    if (!user) return
    const interval = setInterval(() => {
      setTokenExpiry(getTokenExpiry())
    }, 1000)
    return () => clearInterval(interval)
  }, [user])

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false)
    }, 300)
  }

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleRefreshToken = async () => {
    setIsRefreshing(true)
    try {
      const wallet_mode = localStorage.getItem('wallet_mode') || 'local'
      const wallet_address = localStorage.getItem('wallet_address')
      const auth = new Auth()
      const newToken = await auth.token('', wallet_address, wallet_mode)
      localStorage.setItem('wallet_token', newToken)
      setTokenExpiry(getTokenExpiry())
    } catch (error) {
      console.error('Failed to refresh token:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleSignOut = () => {
    signOut()
    setIsHovered(false)
  }

  const handleGoToProfile = () => {
    if (address) {
      router.push(`/user/${address}`)
    }
    setIsHovered(false)
  }

  const handleTopUp = () => {
    if (user) {
      router.push(`/user/${user.key}?tab=billing`)
    }
    setIsHovered(false)
  }

  const fetchMarketCredit = async () => {
    if (!user?.key || !client) return

    try {
      setIsRefreshing(true)
      setBalanceRefreshSuccess(false)

      // Use chain/balance API endpoint to get credit balance
      const result = await client.call('api/get_balances', {
        address: user.key,
      })
      console.log('Balance API result:', result)

      // Parse the balance response
      const balances = result
      setTokenBalances(balances)
      setMarketCredit(balances?.MARKET || 0)

      // Show success state
      setBalanceRefreshSuccess(true)
      setTimeout(() => setBalanceRefreshSuccess(false), 3000)
    } catch (err) {
      console.error('Error fetching balances:', err)
      setMarketCredit(0)
      setTokenBalances({})
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleTopUpTransaction = async () => {
    if (!topUpAmount || !user?.key) {
      setTopUpError('Please enter an amount')
      return
    }

    const amount = parseFloat(topUpAmount)
    if (amount <= 0) {
      setTopUpError('Amount must be greater than 0')
      return
    }

    setIsProcessing(true)
    setTopUpError(null)
    setTopUpSuccess(null)

    try {
      const walletMode = user?.wallet_mode || localStorage.getItem('wallet_mode') || 'local'

      if (walletMode === 'local' && client) {
        // Use API for local key transactions - works on all browsers
        const result = await client.call('credit', {
          stable_amount: amount,
          payment_token: selectedToken.toLowerCase()
        })

        if (result.error) {
          throw new Error(result.error)
        }

        await fetchMarketCredit()
        setTopUpSuccess(`Successfully added $${amount.toFixed(2)} using ${selectedToken}!`)
      } else {
        // Use MetaMask for web3 wallet transactions
        if (typeof window === 'undefined' || !window.ethereum) {
          throw new Error('MetaMask is required for web3 wallet mode')
        }

        const { MarketAllowanceManager } = await import('@/network/marketAllowance')
        const network = 'testnet'
        const chainConfig = modConfig.chain?.[network]
        if (!chainConfig) {
          throw new Error('Chain config not found')
        }

        const allowanceManager = new MarketAllowanceManager(chainConfig)
        await allowanceManager.increaseMarketAllowance(user.key, amount, selectedToken)
        await allowanceManager.addMarketCredit(user.key, amount, selectedToken)
        await fetchMarketCredit()
        setTopUpSuccess(`Successfully added $${amount.toFixed(2)} using ${selectedToken}!`)
      }

      setTopUpAmount('')
      setTimeout(() => {
        setShowTopUpForm(false)
        setTopUpSuccess(null)
      }, 3000)
    } catch (err: any) {
      let msg = err?.message || String(err)
      if (msg.includes('1010')) msg = 'Insufficient balance for transaction.'
      else if (msg.toLowerCase().includes('cancel')) msg = 'Transaction cancelled by user.'
      setTopUpError(msg)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleTransfer = async () => {
    if (!transferAmount || !transferRecipient || !user?.key) {
      setTopUpError('Please enter recipient address and amount')
      return
    }

    if (!ethers.isAddress(transferRecipient)) {
      setTopUpError('Invalid recipient address')
      return
    }

    const amount = parseFloat(transferAmount)
    if (amount <= 0) {
      setTopUpError('Amount must be greater than 0')
      return
    }

    if (amount > marketCredit) {
      setTopUpError('Insufficient balance')
      return
    }

    setIsTransferring(true)
    setTopUpError(null)
    setTopUpSuccess(null)

    try {
      const walletMode = user?.wallet_mode || localStorage.getItem('wallet_mode') || 'local'

      if (walletMode === 'local' && client) {
        // Use API for local key transactions - works on all browsers
        const result = await client.call('transfer', {
          to: transferRecipient,
          amount: amount,
          token: 'market'
        })

        if (result.error) {
          throw new Error(result.error)
        }

        await fetchMarketCredit()
        setTopUpSuccess(`Successfully transferred $${amount.toFixed(2)} to ${transferRecipient.slice(0, 8)}...${transferRecipient.slice(-6)}!`)
      } else {
        // Use MetaMask for web3 wallet transactions
        if (typeof window === 'undefined' || !window.ethereum) {
          throw new Error('MetaMask is required for web3 wallet mode')
        }

        const { Market } = await import('@/network/Market')
        const network = 'testnet'
        const chainConfig = modConfig.chain?.[network]
        if (!chainConfig) {
          throw new Error('Chain config not found')
        }

        const market = new Market(chainConfig)
        await market.transferMarketCredit(transferRecipient, amount)
        await fetchMarketCredit()
        setTopUpSuccess(`Successfully transferred $${amount.toFixed(2)} to ${transferRecipient.slice(0, 8)}...${transferRecipient.slice(-6)}!`)
      }

      setTransferAmount('')
      setTransferRecipient('')
      setTimeout(() => {
        setShowTransferForm(false)
        setTopUpSuccess(null)
      }, 3000)
    } catch (err: any) {
      let msg = err?.message || String(err)
      if (msg.toLowerCase().includes('cancel')) msg = 'Transaction cancelled by user.'
      setTopUpError(msg)
    } finally {
      setIsTransferring(false)
    }
  }

  // Fetch on mount and set up 10-minute polling
  useEffect(() => {
    if (!user?.key) return

    // Initial fetch
    fetchMarketCredit()

    // Set up 10-minute interval
    const interval = setInterval(() => {
      fetchMarketCredit()
    }, 10 * 60 * 1000) // 10 minutes

    return () => clearInterval(interval)
  }, [user?.key])

  useEffect(() => {
    const savedNetworkId = localStorage.getItem('selected_network')
    if (savedNetworkId) {
      const network = NETWORKS.find(n => n.id === savedNetworkId)
      if (network) setSelectedNetwork(network)
    }
  }, [])

  const handleNetworkChange = (network: NetworkConfig) => {
    setSelectedNetwork(network)
    localStorage.setItem('selected_network', network.id)
  }

  // Not signed in - show the auth button
  if (!user) {
    return <WalletAuthButton />
  }

  // Signed in - show simplified wallet icon with copy button
  return (
    <div className="flex items-center gap-3">
        <button
          onClick={() => setIsHovered(!isHovered)}
          className="relative flex items-center justify-center p-3 rounded-xl border-2 hover:scale-[1.05] transition-all backdrop-blur-sm group active:scale-95"
          style={{
            width: '60px',
            height: '60px',
            borderColor: `${userColor}60`,
            backgroundColor: `${userColor}10`,
            boxShadow: `0 0 20px ${userColor}30`
          }}
          title={`Wallet: ${shortAddress}`}
        >
          <div className="relative">
            <WalletIcon className="w-8 h-8" style={{ color: userColor, filter: `drop-shadow(0 0 6px ${userColor})` }} />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-black animate-pulse" title="Connected" />
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              copyAddress()
            }}
            className="absolute top-1 right-1 p-1 rounded-lg transition-all opacity-0 group-hover:opacity-100 active:scale-90"
            style={{
              backgroundColor: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.1)'
            }}
            title="Copy address"
          >
            {copied ? (
              <ClipboardDocumentIcon className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <ClipboardDocumentIcon className="w-3.5 h-3.5" style={{ color: userColor }} />
            )}
          </button>
        </button>

      <AnimatePresence>
        {isHovered && (
          <div>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80]"
              onClick={() => setIsHovered(false)}
            />

            {/* Side Panel */}
            <motion.div
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="fixed top-0 right-0 h-screen w-[400px] shadow-2xl z-[90] overflow-y-auto custom-scrollbar"
              style={{
                borderLeft: `2px solid ${userColor}40`,
                backgroundColor: 'rgba(0, 0, 0, 0.98)',
                boxShadow: `-30px 0 60px rgba(0, 0, 0, 0.8), 0 0 100px ${userColor}20`
              }}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 flex justify-between items-center px-5 py-4 border-b backdrop-blur-xl" style={{ borderColor: `${userColor}30`, backgroundColor: 'rgba(0, 0, 0, 0.95)' }}>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <code className="text-xl font-black font-mono tracking-wider" style={{ color: userColor }}>
                      {shortAddress}
                    </code>
                    <button
                      onClick={copyAddress}
                      className="p-1.5 rounded-lg transition-all hover:bg-white/10 active:scale-95"
                      style={{ color: userColor }}
                      title="Copy address"
                    >
                      <ClipboardDocumentIcon className="w-4 h-4" />
                    </button>
                    <div
                      className="relative"
                      onMouseEnter={() => setIsAddressQrHovered(true)}
                      onMouseLeave={() => setIsAddressQrHovered(false)}
                    >
                      <button className="p-1.5 rounded-lg transition-all hover:bg-white/10" style={{ color: userColor }} title="Show QR Code">
                        <QrCodeIcon className="w-4 h-4" />
                      </button>
                      {isAddressQrHovered && (
                        <div className="absolute top-full right-0 mt-2 p-3 bg-black/95 rounded-lg border-2 z-50 shadow-2xl" style={{ borderColor: userColor }}>
                          <QRCode value={user.key || ''} size={150} color={userColor} />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1 rounded-lg" style={{ backgroundColor: `${userColor}10` }}>
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Credit</span>
                    <span className="text-base font-mono font-black text-yellow-400">
                      ${marketCredit.toFixed(2)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsHovered(false)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-all active:scale-95"
                  style={{ color: userColor }}
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

            {/* Wallet Mode */}
            <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between">
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Mode</div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <div className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg" style={{ color: userColor, backgroundColor: `${userColor}15` }}>
                  {walletMode || 'local'}
                </div>
              </div>
            </div>

{/* Action Tabs */}
            <div className="px-5 py-4 border-b border-white/10">
              <div className="flex gap-2 mb-4">
                {/* ADD BUTTON */}
                <button
                  onClick={() => {
                    setShowTopUpForm(!showTopUpForm)
                    setShowTransferForm(false)
                  }}
                  className={`flex-1 flex flex-col items-center justify-center gap-2 py-4 px-4 rounded-xl font-black text-sm uppercase transition-all duration-300 backdrop-blur-sm border-2 ${
                    showTopUpForm
                      ? 'scale-[1.02] shadow-2xl'
                      : 'bg-black/40 text-white/60 border-white/20 hover:border-white/40 hover:text-white/90 hover:scale-[1.02] hover:shadow-lg'
                  }`}
                  style={
                    showTopUpForm
                      ? {
                          background: 'linear-gradient(135deg, #10b98120 0%, #10b98140 100%)',
                          borderColor: '#10b981',
                          color: '#10b981',
                          boxShadow: '0 0 30px #10b98140, 0 0 60px #10b98120'
                        }
                      : undefined
                  }
                >
                  <CreditCardIcon className="w-6 h-6" />
                  <span>ADD</span>
                </button>

                {/* SEND BUTTON */}
                <button
                  onClick={() => {
                    setShowTransferForm(!showTransferForm)
                    setShowTopUpForm(false)
                  }}
                  className={`flex-1 flex flex-col items-center justify-center gap-2 py-4 px-4 rounded-xl font-black text-sm uppercase transition-all duration-300 backdrop-blur-sm border-2 ${
                    showTransferForm
                      ? 'scale-[1.02] shadow-2xl'
                      : 'bg-black/40 text-white/60 border-white/20 hover:border-white/40 hover:text-white/90 hover:scale-[1.02] hover:shadow-lg'
                  }`}
                  style={
                    showTransferForm
                      ? {
                          background: 'linear-gradient(135deg, #3b82f620 0%, #3b82f640 100%)',
                          borderColor: '#3b82f6',
                          color: '#3b82f6',
                          boxShadow: '0 0 30px #3b82f640, 0 0 60px #3b82f620'
                        }
                      : undefined
                  }
                >
                  <ArrowsRightLeftIcon className="w-6 h-6" />
                  <span>SEND</span>
                </button>

                {/* TOKEN BUTTON */}
                <div className="flex-1 relative">
                  <button
                    onClick={handleRefreshToken}
                    disabled={isRefreshing}
                    className="w-full h-full flex flex-col items-center justify-center gap-1 py-4 px-4 rounded-xl font-black text-sm uppercase transition-all duration-300 backdrop-blur-sm border-2 bg-black/40 text-white/60 border-white/20 hover:border-white/40 hover:text-white/90 hover:scale-[1.02] hover:shadow-lg active:scale-95 disabled:opacity-50"
                    style={{
                      background: 'linear-gradient(135deg, #a855f720 0%, #a855f740 100%)',
                      borderColor: '#a855f7',
                      color: '#a855f7',
                    }}
                  >
                    <ArrowPathIcon className={`w-6 h-6 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span className="text-xs">TOKEN</span>
                    <div className="flex items-center gap-1">
                      <ClockIcon className="w-3 h-3" />
                      <span className="text-[10px] font-mono">{tokenExpiry || getTokenExpiry()}</span>
                    </div>
                  </button>
                  {/* Copy Button Overlay */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      const token = typeof window !== 'undefined' ? localStorage.getItem('wallet_token') || '' : ''
                      navigator.clipboard.writeText(token)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }}
                    className="absolute top-2 right-2 p-1 rounded-md transition-all hover:bg-white/20 active:scale-95"
                    style={{ color: '#a855f7' }}
                    title="Copy Token"
                  >
                    <ClipboardDocumentIcon className="w-4 h-4" />
                  </button>
                  {copied && (
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-green-400 font-mono font-bold whitespace-nowrap">
                      ✓ COPIED
                    </div>
                  )}
                </div>
              </div>

              {/* Balance Display */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchMarketCredit}
                    disabled={isRefreshing}
                    className="p-1.5 rounded-lg transition-all hover:bg-white/10 active:scale-95 disabled:opacity-50"
                    style={{ color: balanceRefreshSuccess ? '#10b981' : userColor }}
                    title="Refresh Balance"
                  >
                    <ArrowPathIcon className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                  {balanceRefreshSuccess && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="text-[10px] text-green-400 font-mono font-bold flex items-center gap-1"
                    >
                      <span>✓</span>
                      <span>UPDATED</span>
                    </motion.div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mb-3">
                <motion.div
                  key={marketCredit}
                  initial={balanceRefreshSuccess ? { scale: 1.05 } : { scale: 1 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="font-mono text-5xl font-black tracking-tighter bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-500 bg-clip-text text-transparent"
                  style={{
                    textShadow: balanceRefreshSuccess
                      ? `0 0 40px #10b98160, 0 0 20px ${userColor}40`
                      : `0 0 30px ${userColor}40`
                  }}
                >
                  ${marketCredit.toFixed(2)}
                </motion.div>

              </div>

              {/* All Token Balances */}
              <AnimatePresence>
                {showAllBalances && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1.5 pt-3 mt-3 border-t border-white/20">
                      {Object.entries(tokenBalances).map(([token, balance]) => (
                        <div
                          key={token}
                          className="flex items-center justify-between px-3 py-2 bg-black/60 rounded-lg border border-white/10 hover:bg-black/80 transition-all"
                        >
                          <span className="font-bold text-xs text-gray-400 uppercase tracking-wider">{token}</span>
                          <span className="font-mono text-sm font-bold text-gray-200">
                            {token === 'MARKET' || token === 'USDC' || token === 'USDT'
                              ? `$${balance.toFixed(2)}`
                              : balance.toFixed(6)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Top Up Form */}
              <AnimatePresence>
                {showTopUpForm && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-4 pt-4 border-t border-white/20 space-y-3 overflow-hidden"
                  >
                    <div>
                      <label className="text-[10px] text-gray-500 font-bold uppercase mb-2 block tracking-wider">Payment Token</label>
                      <select
                        value={selectedToken}
                        onChange={(e) => setSelectedToken(e.target.value as TokenType)}
                        className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-2.5 text-sm font-bold font-mono focus:outline-none focus:border-opacity-50 transition-all"
                        style={{ color: userColor, borderColor: `${userColor}40` }}
                      >
                        <option value="USDC">USDC</option>
                        <option value="USDT">USDT</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-500 font-bold uppercase mb-2 block tracking-wider">Amount (USD)</label>
                      <input
                        type="number"
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(e.target.value)}
                        disabled={isProcessing}
                        min="0"
                        step="0.01"
                        placeholder="10.00"
                        className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-2.5 text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-opacity-50 disabled:opacity-50 transition-all"
                        style={{ color: userColor, borderColor: `${userColor}40` }}
                      />
                    </div>

                    <button
                      onClick={handleTopUpTransaction}
                      disabled={!topUpAmount || isProcessing}
                      className="w-full py-3 border-2 rounded-lg font-mono uppercase font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 tracking-wider"
                      style={{
                        borderColor: userColor,
                        color: userColor,
                        backgroundColor: `${userColor}15`
                      }}
                    >
                      {isProcessing ? (
                        <>
                          <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          <span>PROCESSING</span>
                        </>
                      ) : (
                        <>
                          <CreditCardIcon className="w-4 h-4" />
                          <span>ADD CREDIT</span>
                        </>
                      )}
                    </button>

                    {topUpError && (
                      <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5 font-mono">
                        {topUpError}
                      </div>
                    )}

                    {topUpSuccess && (
                      <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2.5 font-mono">
                        {topUpSuccess}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Transfer Form */}
              <AnimatePresence>
                {showTransferForm && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-4 pt-4 border-t border-white/20 space-y-3 overflow-hidden"
                  >
                    <div>
                      <label className="text-[10px] text-gray-500 font-bold uppercase mb-2 block tracking-wider">Recipient Address</label>
                      <input
                        type="text"
                        value={transferRecipient}
                        onChange={(e) => setTransferRecipient(e.target.value)}
                        disabled={isTransferring}
                        placeholder="0x..."
                        className="w-full bg-black/60 border border-blue-500/40 rounded-lg px-3 py-2.5 text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-blue-500/60 disabled:opacity-50 transition-all text-blue-400"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-500 font-bold uppercase mb-2 block tracking-wider">Amount (USD)</label>
                      <input
                        type="number"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        disabled={isTransferring}
                        min="0"
                        step="0.01"
                        placeholder="10.00"
                        className="w-full bg-black/60 border border-blue-500/40 rounded-lg px-3 py-2.5 text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-blue-500/60 disabled:opacity-50 transition-all text-blue-400"
                      />
                    </div>

                    <button
                      onClick={handleTransfer}
                      disabled={!transferAmount || !transferRecipient || isTransferring}
                      className="w-full py-3 border-2 rounded-lg font-mono uppercase font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 tracking-wider"
                      style={{
                        borderColor: '#3b82f6',
                        color: '#3b82f6',
                        backgroundColor: '#3b82f615'
                      }}
                    >
                      {isTransferring ? (
                        <>
                          <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          <span>SENDING</span>
                        </>
                      ) : (
                        <>
                          <ArrowsRightLeftIcon className="w-4 h-4" />
                          <span>SEND CREDIT</span>
                        </>
                      )}
                    </button>

                    {topUpError && (
                      <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5 font-mono">
                        {topUpError}
                      </div>
                    )}

                    {topUpSuccess && (
                      <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2.5 font-mono">
                        {topUpSuccess}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Key Type */}
            <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between">
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Crypto Type</div>
              <div className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-gray-400">
                {user.crypto_type || 'ecdsa'}
              </div>
            </div>

            {/* Actions */}
            <div className="px-4 py-3 border-b border-white/10 space-y-2">
              <button
                onClick={handleGoToProfile}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all text-sm font-medium active:scale-95"
              >
                <UserCircleIcon className="w-5 h-5" />
                <span>My Profile</span>
              </button>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all text-sm font-medium active:scale-95"
              >
                <ArrowRightOnRectangleIcon className="w-5 h-5" />
                <span>Sign Out</span>
              </button>
            </div>

            {/* Network Selector - Bottom */}
            <div className="px-4 py-3 bg-black/40">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: selectedNetwork.color }} />
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Network</span>
                </div>
                <select
                  value={selectedNetwork.id}
                  onChange={(e) => {
                    const network = NETWORKS.find(n => n.id === e.target.value)
                    if (network) handleNetworkChange(network)
                  }}
                  className="flex-1 bg-black/60 border border-white/20 rounded-lg px-2.5 py-1.5 text-xs font-bold font-mono focus:outline-none focus:border-opacity-50 transition-all cursor-pointer"
                  style={{ color: selectedNetwork.color, borderColor: `${selectedNetwork.color}40` }}
                >
                  {NETWORKS.map((network) => (
                    <option key={network.id} value={network.id} style={{ backgroundColor: '#000' }}>
                      {network.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default WalletHeader
