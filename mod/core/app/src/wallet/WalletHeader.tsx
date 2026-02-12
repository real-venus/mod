"use client";

import { useState, useRef, useEffect } from 'react'
import { userContext } from '@/context/UserContext'
import { WalletIcon, ArrowRightOnRectangleIcon, ClipboardDocumentIcon, ClockIcon, ArrowPathIcon, CreditCardIcon, QrCodeIcon, ChevronDownIcon, ChevronUpIcon, ArrowsRightLeftIcon, XMarkIcon, FunnelIcon } from '@heroicons/react/24/outline'
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
import { TransactionCard } from '@/chat/transactions/TransactionCard'

type TokenType = 'USDC' | 'USDT'

interface NetworkConfig {
  id: string
  name: string
  color: string
  logo?: string
  comingSoon?: boolean
}

const NETWORKS: NetworkConfig[] = [
  { id: 'local', name: 'Local Ganache', color: '#10b981' },
  {
    id: 'base-sepolia',
    name: 'Base Sepolia',
    color: '#0052ff',
    logo: 'https://avatars.githubusercontent.com/u/108554348?s=280&v=4'
  },
  {
    id: 'base-mainnet',
    name: 'Base Mainnet',
    color: '#0052ff',
    logo: 'https://avatars.githubusercontent.com/u/108554348?s=280&v=4'
  },
  {
    id: 'solana',
    name: 'Solana',
    color: '#9945ff',
    comingSoon: true
  }
]

export function WalletHeader() {
  const { user, signOut, client } = userContext()
  const [isHovered, setIsHovered] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [copiedCredit, setCopiedCredit] = useState(false)
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
  const [showTxsTab, setShowTxsTab] = useState(true)  // Default to true - show txs by default
  const [showPortfolioTab, setShowPortfolioTab] = useState(false)
  const [userTransactions, setUserTransactions] = useState<any[]>([])
  const [totalCost24h, setTotalCost24h] = useState(0)
  const [isLoadingTxs, setIsLoadingTxs] = useState(false)
  const [txsStatusFilter, setTxsStatusFilter] = useState<'all' | 'pending' | 'complete'>('all')
  const [expandedTxIdx, setExpandedTxIdx] = useState<number | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(400)
  const [isResizing, setIsResizing] = useState(false)
  const [isTokenExpired, setIsTokenExpired] = useState(false)
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
      const expiry = getTokenExpiry()
      setTokenExpiry(expiry)

      // Check if token is expired
      if (expiry === 'Expired' || expiry === 'Invalid token') {
        setIsTokenExpired(true)
      } else {
        setIsTokenExpired(false)
        // Clear global expired flag when token is valid
        if (typeof window !== 'undefined') {
          (window as any).__tokenExpired = false
        }
      }
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
      setCopiedAddress(true)
      setTimeout(() => {
        setCopied(false)
        setCopiedAddress(false)
      }, 2000)
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
      setIsTokenExpired(false)
      // Clear global expired flag
      if (typeof window !== 'undefined') {
        (window as any).__tokenExpired = false
      }
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

    const savedWidth = localStorage.getItem('wallet_sidebar_width')
    if (savedWidth) {
      setSidebarWidth(parseInt(savedWidth))
    }
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX
      setSidebarWidth(Math.max(300, Math.min(800, newWidth)))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      localStorage.setItem('wallet_sidebar_width', sidebarWidth.toString())
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, sidebarWidth])

  const handleNetworkChange = (network: NetworkConfig) => {
    if (network.comingSoon) {
      alert('Solana support coming soon!')
      return
    }
    setSelectedNetwork(network)
    localStorage.setItem('selected_network', network.id)
  }

  const fetchUserTransactions = async () => {
    if (!client || !user?.key) return

    setIsLoadingTxs(true)
    try {
      const result = await client.call('txs', { df: 0, n: 1000, page: 0, key: user.key })
      const txs = Array.isArray(result) ? result : []

      // Filter transactions by user (check owner, client, or key fields - case insensitive)
      const userKey = user.key.toLowerCase()
      const userTxs = txs.filter((tx: any) => {
        const owner = tx.owner?.toLowerCase()
        const client = tx.client?.toLowerCase()
        const key = tx.key?.toLowerCase()

        return owner === userKey || client === userKey || key === userKey
      })

      setUserTransactions(userTxs)

      // Calculate total cost for last 24 hours
      const now = Date.now() / 1000
      const twentyFourHoursAgo = now - (24 * 60 * 60)
      const recentCost = userTxs
        .filter((tx: any) => {
          const txTime = parseInt(tx.time)
          return !isNaN(txTime) && txTime >= twentyFourHoursAgo
        })
        .reduce((sum: number, tx: any) => sum + (tx.cost || 0), 0)

      setTotalCost24h(recentCost)
    } catch (err) {
      console.error('Failed to fetch user transactions:', err)
      setUserTransactions([])
      setTotalCost24h(0)
    } finally {
      setIsLoadingTxs(false)
    }
  }

  // Fetch transactions on mount since TXS tab is default
  useEffect(() => {
    if (user?.key) {
      fetchUserTransactions()
    }
  }, [user?.key])

  // Also fetch when TXS tab is manually opened
  useEffect(() => {
    if (showTxsTab && user?.key) {
      fetchUserTransactions()
    }
  }, [showTxsTab])

  // Not signed in - show the auth button
  if (!user) {
    return <WalletAuthButton />
  }

  // Signed in - show wallet icon only
  return (
    <div className="flex items-center gap-0">
      {/* Wallet Icon - Click to open sidebar */}
      <button
        onClick={() => setIsHovered(!isHovered)}
        className="flex items-center justify-center bg-neutral-900 border-2 border-neutral-800 hover:bg-neutral-800 hover:border-neutral-700 transition-all relative"
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '8px',
          fontFamily: 'IBM Plex Mono, monospace'
        }}
      >
        <WalletIcon className="w-6 h-6 text-neutral-400" />
        <div
          className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-sm transition-colors ${
            isTokenExpired ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'
          }`}
          title={isTokenExpired ? 'Token Expired - Click to Refresh' : 'Connected'}
        />
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
              className={`fixed top-0 right-0 h-screen shadow-2xl z-[90] overflow-y-auto custom-scrollbar font-mono bg-neutral-950 ${isResizing ? 'select-none' : ''}`}
              style={{
                width: `${sidebarWidth}px`,
                borderLeft: `2px solid ${userColor}40`,
                boxShadow: `-30px 0 60px rgba(0, 0, 0, 0.8), 0 0 100px ${userColor}20`,
                cursor: isResizing ? 'ew-resize' : 'default'
              }}
            >
              {/* Resize Handle */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-neutral-700 transition-colors z-[100] group"
                onMouseDown={() => setIsResizing(true)}
              >
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-12 bg-neutral-800 group-hover:bg-neutral-600 transition-colors" />
              </div>
              {isResizing && (
                <style>{`body { cursor: ew-resize !important; user-select: none; }`}</style>
              )}
              {/* Header */}
              <div className="sticky top-0 z-10 px-6 py-6 border-b border-neutral-800 bg-neutral-950">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <button
                      onClick={copyAddress}
                      className={`text-lg font-bold tracking-wider font-mono hover:text-neutral-300 hover:bg-neutral-900 transition-all cursor-pointer px-4 py-3 border-2 ${
                        copiedAddress
                          ? 'border-green-500 bg-green-500/20 text-green-400'
                          : 'border-neutral-800 hover:border-neutral-700 text-neutral-500'
                      }`}
                      style={{ fontFamily: 'IBM Plex Mono, monospace', borderRadius: 0 }}
                      title="Click to copy full address"
                    >
                      {copiedAddress ? 'COPIED!' : shortAddress}
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(marketCredit.toFixed(2))
                        setCopied(true)
                        setCopiedCredit(true)
                        setTimeout(() => {
                          setCopied(false)
                          setCopiedCredit(false)
                        }, 2000)
                      }}
                      className={`flex items-center gap-3 px-4 py-3 bg-neutral-900 border-2 transition-all cursor-pointer ${
                        copiedCredit
                          ? 'border-green-500 bg-green-500/20'
                          : 'border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800'
                      }`}
                      style={{
                        borderRadius: 0,
                        fontFamily: 'IBM Plex Mono, monospace'
                      }}
                      title="Click to copy credit amount"
                    >
                      <span className={`text-sm uppercase tracking-wider font-bold ${copiedCredit ? 'text-green-400' : 'text-neutral-600'}`}>
                        {copiedCredit ? 'COPIED!' : 'CREDIT'}
                      </span>
                      <span className={`text-xl font-mono font-black tabular-nums ${copiedCredit ? 'text-green-300' : 'text-green-400'}`}>
                        ${marketCredit.toFixed(2)}
                      </span>
                    </button>
                  </div>
                  <button
                    onClick={() => setIsHovered(false)}
                    className="p-2 hover:bg-neutral-800 transition-all"
                    style={{ borderRadius: 0 }}
                  >
                    <XMarkIcon className="w-5 h-5 text-neutral-500" />
                  </button>
                </div>
              </div>

              {/* Token Expired Warning Banner */}
              <AnimatePresence>
                {isTokenExpired && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="px-6 py-4 border-b-4 border-yellow-500 bg-gradient-to-br from-yellow-900/40 to-orange-900/40 overflow-hidden"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center animate-pulse">
                          <svg className="w-7 h-7 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-yellow-400 font-black text-lg uppercase tracking-wider mb-2" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                          TOKEN EXPIRED
                        </h3>
                        <p className="text-yellow-200/80 text-sm font-mono mb-3">
                          Your session token has expired. Click the <strong className="text-yellow-300">TOKEN</strong> button below to refresh and continue.
                        </p>
                        <button
                          onClick={handleRefreshToken}
                          disabled={isRefreshing}
                          className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border-2 border-yellow-500/60 hover:border-yellow-500 text-yellow-400 font-black text-sm uppercase transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                          style={{
                            borderRadius: '6px',
                            fontFamily: 'IBM Plex Mono, monospace',
                            boxShadow: '0 0 20px rgba(234, 179, 8, 0.3)'
                          }}
                        >
                          {isRefreshing ? (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
                              <span>REFRESHING...</span>
                            </div>
                          ) : (
                            <span>🔐 REFRESH TOKEN NOW</span>
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

{/* Action Tabs */}
            <div className="px-4 py-3 border-b border-neutral-800">
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#404040 transparent' }}>
                {/* ADD BUTTON */}
                <button
                  onClick={() => {
                    setShowTopUpForm(!showTopUpForm)
                    setShowTransferForm(false)
                    setShowTxsTab(false)
                    setShowPortfolioTab(false)
                  }}
                  className={`flex-shrink-0 flex flex-col items-center justify-center gap-1.5 border-2 transition-all duration-300 text-[10px] font-bold uppercase shadow-lg hover:scale-105 ${
                    showTopUpForm
                      ? 'bg-gradient-to-br from-green-500/30 to-emerald-500/30 border-green-400 text-green-300 shadow-green-500/50'
                      : 'bg-gradient-to-br from-green-950/40 to-emerald-950/40 border-green-900/60 text-green-600 hover:text-green-300 hover:border-green-400/60 hover:shadow-green-500/30'
                  }`}
                  style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    borderRadius: '8px',
                    width: '70px',
                    height: '70px'
                  }}
                >
                  <CreditCardIcon className="w-5 h-5" />
                  <span>ADD</span>
                </button>

                {/* SEND BUTTON */}
                <button
                  onClick={() => {
                    setShowTransferForm(!showTransferForm)
                    setShowTopUpForm(false)
                    setShowTxsTab(false)
                    setShowPortfolioTab(false)
                  }}
                  className={`flex-shrink-0 flex flex-col items-center justify-center gap-1.5 border-2 transition-all duration-300 text-[10px] font-bold uppercase shadow-lg hover:scale-105 ${
                    showTransferForm
                      ? 'bg-gradient-to-br from-blue-500/30 to-blue-600/30 border-blue-400 text-blue-300 shadow-blue-500/50'
                      : 'bg-gradient-to-br from-blue-950/40 to-cyan-950/40 border-blue-900/60 text-blue-600 hover:text-blue-300 hover:border-blue-400/60 hover:shadow-blue-500/30'
                  }`}
                  style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    borderRadius: '8px',
                    width: '70px',
                    height: '70px'
                  }}
                >
                  <ArrowsRightLeftIcon className="w-5 h-5" />
                  <span>SEND</span>
                </button>

                {/* PORTFOLIO BUTTON */}
                <button
                  onClick={() => {
                    setShowPortfolioTab(!showPortfolioTab)
                    setShowTopUpForm(false)
                    setShowTransferForm(false)
                    setShowTxsTab(false)
                  }}
                  className={`flex-shrink-0 flex flex-col items-center justify-center gap-1.5 border-2 transition-all duration-300 text-[10px] font-bold uppercase shadow-lg hover:scale-105 ${
                    showPortfolioTab
                      ? 'bg-gradient-to-br from-purple-500/30 to-purple-600/30 border-purple-400 text-purple-300 shadow-purple-500/50'
                      : 'bg-gradient-to-br from-purple-950/40 to-fuchsia-950/40 border-purple-900/60 text-purple-600 hover:text-purple-300 hover:border-purple-400/60 hover:shadow-purple-500/30'
                  }`}
                  style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    borderRadius: '8px',
                    width: '70px',
                    height: '70px'
                  }}
                >
                  <WalletIcon className="w-5 h-5" />
                  <span>PORT</span>
                </button>

                {/* TOKEN BUTTON */}
                <button
                  onClick={handleRefreshToken}
                  disabled={isRefreshing}
                  className={`flex-shrink-0 flex flex-col items-center justify-center gap-1.5 border-2 transition-all duration-300 text-[10px] font-bold uppercase shadow-lg hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 ${
                    'bg-gradient-to-br from-cyan-950/40 to-teal-950/40 border-cyan-900/60 text-cyan-600 hover:text-cyan-300 hover:border-cyan-400/60 hover:shadow-cyan-500/30'
                  }`}
                  style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    borderRadius: '8px',
                    width: '70px',
                    height: '70px'
                  }}
                >
                  <ArrowPathIcon className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>TOKEN</span>
                </button>

                {/* TXS BUTTON */}
                <button
                  onClick={() => {
                    setShowTxsTab(!showTxsTab)
                    setShowTopUpForm(false)
                    setShowTransferForm(false)
                    setShowPortfolioTab(false)
                    if (!showTxsTab) fetchUserTransactions()
                  }}
                  className={`flex-shrink-0 flex flex-col items-center justify-center gap-1.5 border-2 transition-all duration-300 text-[10px] font-bold uppercase shadow-lg hover:scale-105 ${
                    showTxsTab
                      ? 'bg-gradient-to-br from-amber-500/30 to-orange-500/30 border-amber-400 text-amber-300 shadow-amber-500/50'
                      : 'bg-gradient-to-br from-amber-950/40 to-orange-950/40 border-amber-900/60 text-amber-600 hover:text-amber-300 hover:border-amber-400/60 hover:shadow-amber-500/30'
                  }`}
                  style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    borderRadius: '8px',
                    width: '70px',
                    height: '70px'
                  }}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>TXS</span>
                </button>
              </div>

              {/* Portfolio Tab Content */}
              <AnimatePresence>
                {showPortfolioTab && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-3 pt-3 border-t border-neutral-800 overflow-hidden"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between px-1 mb-2">
                        <span className="text-xs text-neutral-600 uppercase tracking-wider font-bold" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>TOKEN BALANCES</span>
                        <button
                          onClick={fetchMarketCredit}
                          disabled={isRefreshing}
                          className="p-1 hover:bg-neutral-800 transition-all disabled:opacity-50"
                          title="Refresh balances"
                          style={{ borderRadius: 0 }}
                        >
                          <ArrowPathIcon className={`w-3.5 h-3.5 text-neutral-500 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </button>
                      </div>

                      {Object.entries(tokenBalances).length > 0 ? (
                        Object.entries(tokenBalances).map(([token, balance]) => (
                          <div
                            key={token}
                            className="flex items-center justify-between px-3 py-2.5 bg-neutral-900 border-2 border-neutral-800 text-xs"
                            style={{
                              borderRadius: 0,
                              fontFamily: 'IBM Plex Mono, monospace'
                            }}
                          >
                            <span className="font-bold text-neutral-500 uppercase tracking-wider">{token}</span>
                            <span className="font-mono font-bold text-neutral-300 tabular-nums">
                              {token === 'MARKET' || token === 'USDC' || token === 'USDT'
                                ? `$${balance.toFixed(2)}`
                                : balance.toFixed(6)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 text-neutral-600 text-xs">
                          {isRefreshing ? (
                            <div className="flex items-center justify-center gap-2">
                              <ArrowPathIcon className="w-4 h-4 animate-spin" />
                              <span>Loading balances...</span>
                            </div>
                          ) : (
                            'No token balances available'
                          )}
                        </div>
                      )}
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
                    className="mt-3 pt-3 border-t border-neutral-800 space-y-2 overflow-hidden"
                  >
                    <div>
                      <label className="text-xs text-neutral-500 font-bold uppercase mb-1 block" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>Token</label>
                      <select
                        value={selectedToken}
                        onChange={(e) => setSelectedToken(e.target.value as TokenType)}
                        className="w-full bg-neutral-900 border-2 border-neutral-800 px-3 py-2 text-sm font-mono focus:outline-none text-neutral-300 hover:border-neutral-700 transition-colors"
                        style={{
                          borderRadius: 0,
                          fontFamily: 'IBM Plex Mono, monospace'
                        }}
                      >
                        <option value="USDC">USDC</option>
                        <option value="USDT">USDT</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-neutral-500 font-bold uppercase mb-1 block" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>Amount</label>
                      <input
                        type="number"
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(e.target.value)}
                        disabled={isProcessing}
                        min="0"
                        step="0.01"
                        placeholder="10.00"
                        className="w-full bg-neutral-900 border-2 border-neutral-800 px-3 py-2 text-sm font-mono placeholder-neutral-600 focus:outline-none disabled:opacity-50 text-neutral-300 hover:border-neutral-700 transition-colors"
                        style={{
                          borderRadius: 0,
                          fontFamily: 'IBM Plex Mono, monospace'
                        }}
                      />
                    </div>

                    <button
                      onClick={handleTopUpTransaction}
                      disabled={!topUpAmount || isProcessing}
                      className="w-full py-3 border-2 bg-neutral-900 border-neutral-800 font-mono uppercase font-bold text-xs disabled:opacity-50 transition-all hover:bg-neutral-800 hover:border-neutral-700 flex items-center justify-center gap-2 text-green-400"
                      style={{
                        borderRadius: 0,
                        fontFamily: 'IBM Plex Mono, monospace'
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
                      <div className="text-xs text-red-400 bg-neutral-900 border-2 border-neutral-800 px-3 py-2 font-mono"
                        style={{
                          borderRadius: 0,
                          fontFamily: 'IBM Plex Mono, monospace'
                        }}
                      >
                        {topUpError}
                      </div>
                    )}

                    {topUpSuccess && (
                      <div className="text-xs text-green-400 bg-neutral-900 border-2 border-neutral-800 px-3 py-2 font-mono"
                        style={{
                          borderRadius: 0,
                          fontFamily: 'IBM Plex Mono, monospace'
                        }}
                      >
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
                    className="mt-3 pt-3 border-t border-neutral-800 space-y-2 overflow-hidden"
                  >
                    <div>
                      <label className="text-xs text-neutral-500 font-bold uppercase mb-1 block" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>Recipient</label>
                      <input
                        type="text"
                        value={transferRecipient}
                        onChange={(e) => setTransferRecipient(e.target.value)}
                        disabled={isTransferring}
                        placeholder="0x..."
                        className="w-full bg-neutral-900 border-2 border-neutral-800 px-3 py-2 text-sm font-mono placeholder-neutral-600 focus:outline-none disabled:opacity-50 text-neutral-300 hover:border-neutral-700 transition-colors"
                        style={{
                          borderRadius: 0,
                          fontFamily: 'IBM Plex Mono, monospace'
                        }}
                      />
                    </div>

                    <div>
                      <label className="text-xs text-neutral-500 font-bold uppercase mb-1 block" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>Amount</label>
                      <input
                        type="number"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        disabled={isTransferring}
                        min="0"
                        step="0.01"
                        placeholder="10.00"
                        className="w-full bg-neutral-900 border-2 border-neutral-800 px-3 py-2 text-sm font-mono placeholder-neutral-600 focus:outline-none disabled:opacity-50 text-neutral-300 hover:border-neutral-700 transition-colors"
                        style={{
                          borderRadius: 0,
                          fontFamily: 'IBM Plex Mono, monospace'
                        }}
                      />
                    </div>

                    <button
                      onClick={handleTransfer}
                      disabled={!transferAmount || !transferRecipient || isTransferring}
                      className="w-full py-3 border-2 bg-neutral-900 border-neutral-800 font-mono uppercase font-bold text-xs disabled:opacity-50 transition-all hover:bg-neutral-800 hover:border-neutral-700 flex items-center justify-center gap-2 text-blue-400"
                      style={{
                        borderRadius: 0,
                        fontFamily: 'IBM Plex Mono, monospace'
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
                      <div className="text-xs text-red-400 bg-neutral-900 border-2 border-neutral-800 px-3 py-2 font-mono"
                        style={{
                          borderRadius: 0,
                          fontFamily: 'IBM Plex Mono, monospace'
                        }}
                      >
                        {topUpError}
                      </div>
                    )}

                    {topUpSuccess && (
                      <div className="text-xs text-green-400 bg-neutral-900 border-2 border-neutral-800 px-3 py-2 font-mono"
                        style={{
                          borderRadius: 0,
                          fontFamily: 'IBM Plex Mono, monospace'
                        }}
                      >
                        {topUpSuccess}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* TXS Tab Content */}
              <AnimatePresence>
                {showTxsTab && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-3 pt-3 border-t border-neutral-800 overflow-hidden"
                  >
                    <div className="space-y-2">
                      {/* Header with filter */}
                      <div className="flex items-center justify-between gap-2 px-1 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-neutral-600 uppercase tracking-wider font-bold">24H</span>
                          <span className="text-sm font-mono font-bold text-amber-400 tabular-nums">${totalCost24h.toFixed(2)}</span>
                          <span className="text-xs text-neutral-700">({userTransactions.filter(tx => {
                            const now = Date.now() / 1000
                            const twentyFourHoursAgo = now - (24 * 60 * 60)
                            return parseInt(tx.time) >= twentyFourHoursAgo
                          }).length})</span>
                        </div>

                        {/* Filter dropdown */}
                        <select
                          value={txsStatusFilter}
                          onChange={(e) => setTxsStatusFilter(e.target.value as 'all' | 'pending' | 'complete')}
                          className="px-2 py-1 bg-neutral-900 border border-neutral-800 text-xs text-neutral-400 cursor-pointer focus:outline-none font-mono"
                        >
                          <option value="all">All</option>
                          <option value="pending">Pending</option>
                          <option value="complete">Complete</option>
                        </select>
                      </div>

                      {/* Transactions List */}
                      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#404040 transparent' }}>
                        {isLoadingTxs ? (
                          <div className="flex items-center justify-center py-8">
                            <ArrowPathIcon className="w-5 h-5 animate-spin text-amber-500" />
                          </div>
                        ) : userTransactions.length === 0 ? (
                          <div className="text-center py-8 text-gray-600 text-xs">
                            No transactions yet
                          </div>
                        ) : (
                          (() => {
                            // Filter transactions based on status
                            const filteredTxs = userTransactions.filter(tx => {
                              if (txsStatusFilter === 'all') return true
                              if (txsStatusFilter === 'pending') {
                                return tx.status === 'pending' || tx.status === 'running'
                              }
                              if (txsStatusFilter === 'complete') {
                                return tx.status === 'success' || tx.status === 'finished' || tx.status === 'complete' || tx.status === 'error' || tx.status === 'failed'
                              }
                              return true
                            })

                            return filteredTxs.length === 0 ? (
                              <div className="text-center py-8 text-gray-600 text-xs">
                                No {txsStatusFilter} transactions
                              </div>
                            ) : (
                              filteredTxs.slice(0, 20).map((tx, idx) => (
                                <div
                                  key={tx.cid || tx.hash || idx}
                                  onClick={() => setExpandedTxIdx(expandedTxIdx === idx ? null : idx)}
                                >
                                  <TransactionCard
                                    tx={tx}
                                    idx={idx}
                                    isExpanded={expandedTxIdx === idx}
                                    compact={true}
                                  />
                                </div>
                              ))
                            )
                          })()
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Actions */}
            <div className="px-4 py-2 space-y-1 border-t border-neutral-800">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-neutral-900 transition-all text-xs font-bold uppercase"
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default WalletHeader
