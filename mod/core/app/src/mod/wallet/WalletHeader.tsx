"use client";

import { useState, useRef, useEffect } from 'react'
import { userContext } from '@/mod/context/UserContext'
import { WalletIcon, ArrowRightOnRectangleIcon, ClipboardDocumentIcon, UserCircleIcon, ClockIcon, ArrowPathIcon, CreditCardIcon, QrCodeIcon, ChevronDownIcon, ChevronUpIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { WalletAuthButton } from './WalletAuthButton'
import { CopyButton } from '@/mod/ui/CopyButton'
import { QRCode } from '@/mod/ui/QRCode'
import { text2color } from '@/mod/utils'
import { Auth } from '@/mod/client/auth'
import WalletCreditDisplay from './WalletCreditDisplay'
import modConfig from '@/app/mod.json'
import { ethers } from 'ethers'

type TokenType = 'USDC' | 'USDT'

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

      // Use API to get all balances - works on all browsers without MetaMask
      const balances = await client.call('get_balances', {
        address: user.key,
        tokens: ['ETH', 'USDC', 'USDT', 'MARKET']
      })

      setTokenBalances(balances || {})
      setMarketCredit(balances?.MARKET || 0)
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

        const { MarketAllowanceManager } = await import('@/mod/network/marketAllowance')
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

        const { Market } = await import('@/mod/network/Market')
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

  useEffect(() => {
    if (user?.key) {
      fetchMarketCredit()
    }
  }, [user?.key])

  // Not signed in - show the auth button
  if (!user) {
    return <WalletAuthButton />
  }

  // Signed in - show wallet icon with hover dropdown
  return (
    <div
      className="relative"
      ref={dropdownRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className="flex items-center justify-center rounded-xl p-3 border-2 border-green-500/40 hover:border-green-500/60 hover:bg-green-500/10 transition-all backdrop-blur-sm"
        style={{ height: '60px', width: '60px', boxShadow: '0 0 15px rgba(16, 185, 129, 0.2)' }}
        title={address}
      >
        <div className="relative">
          <WalletIcon className="w-8 h-8" style={{ color: '#10b981' }} />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-black" />
        </div>
      </button>

      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute top-full right-0 mt-2 border-2 rounded-xl shadow-2xl z-50 min-w-[340px] backdrop-blur-xl overflow-hidden"
            style={{
              borderColor: `${userColor}60`,
              backgroundColor: 'rgba(0, 0, 0, 0.95)',
              boxShadow: `0 0 30px ${userColor}25, 0 10px 40px rgba(0, 0, 0, 0.8)`
            }}
          >
            {/* Connection Status */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest opacity-60">
                    {walletMode || 'Live'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ClockIcon className="w-3 h-3 text-gray-500" />
                  <span className="text-[10px] font-mono font-bold text-gray-500">{tokenExpiry || getTokenExpiry()}</span>
                </div>
              </div>
              <button
                onClick={copyAddress}
                className="w-full text-left font-mono text-xl font-black tracking-tight hover:text-white px-2 py-1.5 rounded-lg transition-all flex items-center justify-center gap-2 group"
                style={{ color: userColor }}
                title="Click to copy address"
              >
                <span className="tracking-wider">{shortAddress}</span>
                <ClipboardDocumentIcon className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-50 transition-opacity" />
              </button>
              {copied && (
                <div className="text-[10px] text-green-400 mt-1 text-center font-mono">✓ COPIED</div>
              )}
            </div>

            {/* Auth Token */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Token</div>
                <div className="flex items-center gap-2">
                  {typeof window !== 'undefined' && (
                    <CopyButton text={localStorage.getItem('wallet_token') || ''} size="sm" showValueOnHover={false} />
                  )}
                  <div
                    className="relative"
                    onMouseEnter={() => setIsTokenQrHovered(true)}
                    onMouseLeave={() => setIsTokenQrHovered(false)}
                  >
                    <QrCodeIcon className="h-3.5 w-3.5 cursor-pointer opacity-40 hover:opacity-100 transition-opacity" style={{ color: userColor }} />
                    {isTokenQrHovered && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-black/95 rounded-lg border-2 z-50 shadow-2xl" style={{ borderColor: userColor }}>
                        <QRCode value={typeof window !== 'undefined' ? localStorage.getItem('wallet_token') || '' : ''} size={120} color={userColor} />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleRefreshToken}
                    disabled={isRefreshing}
                    className="p-1 rounded transition-all hover:scale-110 active:scale-95 disabled:opacity-50 opacity-40 hover:opacity-100"
                    style={{ color: userColor }}
                    title="Refresh Token"
                  >
                    <ArrowPathIcon className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
              <code className="font-mono text-[10px] text-gray-600 block truncate">
                {typeof window !== 'undefined' ? localStorage.getItem('wallet_token')?.substring(0, 12) + '...' + localStorage.getItem('wallet_token')?.slice(-8) : ''}
              </code>
            </div>

            {/* Address */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Address</div>
                <div className="flex items-center gap-2">
                  <CopyButton text={user.key || ''} size="sm" showValueOnHover={false} />
                  <div
                    className="relative"
                    onMouseEnter={() => setIsAddressQrHovered(true)}
                    onMouseLeave={() => setIsAddressQrHovered(false)}
                  >
                    <QrCodeIcon className="h-3.5 w-3.5 cursor-pointer opacity-40 hover:opacity-100 transition-opacity" style={{ color: userColor }} />
                    {isAddressQrHovered && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-black/95 rounded-lg border-2 z-50 shadow-2xl" style={{ borderColor: userColor }}>
                        <QRCode value={user.key || ''} size={120} color={userColor} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <code className="font-mono text-[10px] text-gray-600 block truncate" title={user.key}>
                {user.key?.substring(0, 10)}...{user.key?.slice(-10)}
              </code>
            </div>

            {/* Market Credit Balance */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Balance</div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={fetchMarketCredit}
                    disabled={isRefreshing}
                    className="p-1 rounded transition-all hover:scale-110 active:scale-95 disabled:opacity-50 opacity-40 hover:opacity-100"
                    style={{ color: userColor }}
                    title="Refresh Balance"
                  >
                    <ArrowPathIcon className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => {
                      setShowTopUpForm(!showTopUpForm)
                      setShowTransferForm(false)
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded transition-all hover:scale-105 active:scale-95 opacity-60 hover:opacity-100"
                    style={{ color: userColor, backgroundColor: `${userColor}15` }}
                    title="Top Up"
                  >
                    <CreditCardIcon className="w-3 h-3" />
                    <span className="text-[10px] font-bold tracking-wider">ADD</span>
                    {showTopUpForm ? (
                      <ChevronUpIcon className="w-3 h-3" />
                    ) : (
                      <ChevronDownIcon className="w-3 h-3" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowTransferForm(!showTransferForm)
                      setShowTopUpForm(false)
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded transition-all hover:scale-105 active:scale-95 opacity-60 hover:opacity-100"
                    style={{ color: '#3b82f6', backgroundColor: '#3b82f615' }}
                    title="Transfer"
                  >
                    <ArrowsRightLeftIcon className="w-3 h-3" />
                    <span className="text-[10px] font-bold tracking-wider">SEND</span>
                    {showTransferForm ? (
                      <ChevronUpIcon className="w-3 h-3" />
                    ) : (
                      <ChevronDownIcon className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-baseline justify-between mb-1">
                <div
                  className="font-mono text-4xl font-black tracking-tighter bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-500 bg-clip-text text-transparent"
                  style={{
                    textShadow: `0 0 20px ${userColor}40`
                  }}
                >
                  ${marketCredit.toFixed(2)}
                </div>
                <button
                  onClick={() => setShowAllBalances(!showAllBalances)}
                  className="text-[10px] text-gray-500 hover:text-gray-300 font-mono transition-colors flex items-center gap-1"
                >
                  {showAllBalances ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
                  All
                </button>
              </div>

              <div className="text-[10px] text-gray-500/70 bg-gray-500/5 border border-gray-500/20 rounded px-2 py-1 mb-2 font-mono">
                Mode: {user?.wallet_mode === 'local' ? '🔑 Local Key' : '🦊 MetaMask'}
              </div>

              {/* All Token Balances */}
              <AnimatePresence>
                {showAllBalances && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mb-2 overflow-hidden"
                  >
                    <div className="space-y-1 pt-2 border-t border-white/10">
                      {Object.entries(tokenBalances).map(([token, balance]) => (
                        <div
                          key={token}
                          className="flex items-center justify-between px-2 py-1 bg-black/40 rounded text-[10px]"
                        >
                          <span className="font-bold text-gray-400">{token}</span>
                          <span className="font-mono text-gray-300">
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
                    className="mt-3 pt-3 border-t border-white/10 space-y-3 overflow-hidden"
                  >
                    <div>
                      <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block tracking-wider">Token</label>
                      <select
                        value={selectedToken}
                        onChange={(e) => setSelectedToken(e.target.value as TokenType)}
                        className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-green-500 transition-all"
                        style={{ color: userColor }}
                      >
                        <option value="USDC">USDC</option>
                        <option value="USDT">USDT</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block tracking-wider">Amount</label>
                      <input
                        type="number"
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(e.target.value)}
                        disabled={isProcessing}
                        min="0"
                        step="0.01"
                        placeholder="10.00"
                        className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-2 text-xs font-mono placeholder-gray-700 focus:outline-none focus:border-green-500 disabled:opacity-50 transition-all"
                        style={{ color: userColor }}
                      />
                    </div>

                    <button
                      onClick={handleTopUpTransaction}
                      disabled={!topUpAmount || isProcessing}
                      className="w-full py-2.5 border rounded-lg font-mono uppercase font-bold text-[10px] disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 tracking-wider"
                      style={{
                        borderColor: userColor,
                        color: userColor,
                        backgroundColor: `${userColor}15`
                      }}
                    >
                      {isProcessing ? (
                        <>
                          <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                          <span>PROCESSING</span>
                        </>
                      ) : (
                        <>
                          <CreditCardIcon className="w-3.5 h-3.5" />
                          <span>ADD CREDIT</span>
                        </>
                      )}
                    </button>

                    {topUpError && (
                      <div className="text-[10px] text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2 font-mono">
                        {topUpError}
                      </div>
                    )}

                    {topUpSuccess && (
                      <div className="text-[10px] text-green-400 bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2 font-mono">
                        {topUpSuccess}
                      </div>
                    )}

                    <div className="text-[9px] text-gray-600 leading-relaxed opacity-50">
                      2 MetaMask prompts: approve {selectedToken}, then add credit
                    </div>
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
                    className="mt-3 pt-3 border-t border-white/10 space-y-3 overflow-hidden"
                  >
                    <div>
                      <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block tracking-wider">Recipient</label>
                      <input
                        type="text"
                        value={transferRecipient}
                        onChange={(e) => setTransferRecipient(e.target.value)}
                        disabled={isTransferring}
                        placeholder="0x..."
                        className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-2 text-xs font-mono placeholder-gray-700 focus:outline-none focus:border-blue-500 disabled:opacity-50 transition-all text-blue-400"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block tracking-wider">Amount</label>
                      <input
                        type="number"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        disabled={isTransferring}
                        min="0"
                        step="0.01"
                        placeholder="10.00"
                        className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-2 text-xs font-mono placeholder-gray-700 focus:outline-none focus:border-blue-500 disabled:opacity-50 transition-all text-blue-400"
                      />
                    </div>

                    <button
                      onClick={handleTransfer}
                      disabled={!transferAmount || !transferRecipient || isTransferring}
                      className="w-full py-2.5 border rounded-lg font-mono uppercase font-bold text-[10px] disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 tracking-wider"
                      style={{
                        borderColor: '#3b82f6',
                        color: '#3b82f6',
                        backgroundColor: '#3b82f615'
                      }}
                    >
                      {isTransferring ? (
                        <>
                          <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                          <span>SENDING</span>
                        </>
                      ) : (
                        <>
                          <ArrowsRightLeftIcon className="w-3.5 h-3.5" />
                          <span>SEND CREDIT</span>
                        </>
                      )}
                    </button>

                    {topUpError && (
                      <div className="text-[10px] text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2 font-mono">
                        {topUpError}
                      </div>
                    )}

                    {topUpSuccess && (
                      <div className="text-[10px] text-green-400 bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2 font-mono">
                        {topUpSuccess}
                      </div>
                    )}

                    <div className="text-[9px] text-gray-600 leading-relaxed opacity-50">
                      Instant transfer to recipient address
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Key Type */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Crypto</div>
              <div className="font-mono text-[10px] font-bold text-gray-600">{user.crypto_type || 'ecdsa'}</div>
            </div>

            {/* Actions */}
            <div className="p-2">
              <button
                onClick={handleGoToProfile}
                className="w-full flex items-center gap-3 px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all text-sm font-medium"
              >
                <UserCircleIcon className="w-5 h-5" />
                <span>My Profile</span>
              </button>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all text-sm font-medium"
              >
                <ArrowRightOnRectangleIcon className="w-5 h-5" />
                <span>Sign Out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default WalletHeader
