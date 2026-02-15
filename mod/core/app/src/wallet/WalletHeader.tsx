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
import { toast } from 'react-toastify'

type TokenType = 'USDC' | 'USDT'
type TransferTokenType = 'MARKET' | 'USDC' | 'USDT'

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
]

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
  const [transferTokenType, setTransferTokenType] = useState<TransferTokenType>('MARKET')
  const [selectedChain, setSelectedChain] = useState<ChainConfig>(CHAINS[0]) // Default to Base
  const [networkEnv, setNetworkEnv] = useState<NetworkEnvironment>('testnet')
  const [showNetworkSelector, setShowNetworkSelector] = useState(false)
  const networkDropdownRef = useRef<HTMLDivElement>(null)
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

    // Check balance based on selected token
    if (transferTokenType === 'MARKET' && amount > marketCredit) {
      setTopUpError('Insufficient MARKET balance')
      return
    }
    if (transferTokenType === 'USDC' && amount > (tokenBalances?.USDC || 0)) {
      setTopUpError('Insufficient USDC balance')
      return
    }
    if (transferTokenType === 'USDT' && amount > (tokenBalances?.USDT || 0)) {
      setTopUpError('Insufficient USDT balance')
      return
    }

    setIsTransferring(true)
    setTopUpError(null)
    setTopUpSuccess(null)

    try {
      const walletMode = user?.wallet_mode || localStorage.getItem('wallet_mode') || 'local'

      if (transferTokenType === 'MARKET') {
        // Market credit transfer
        if (walletMode === 'local' && client) {
          const result = await client.call('transfer', {
            to: transferRecipient,
            amount: amount,
            token: 'market',
            sender: user.key
          })
          if (result.error) throw new Error(result.error)
        } else {
          if (typeof window === 'undefined' || !window.ethereum) {
            throw new Error('MetaMask is required for web3 wallet mode')
          }
          const { Market } = await import('@/network/Market')
          const network = 'testnet'
          const chainConfig = modConfig.chain?.[network]
          if (!chainConfig) throw new Error('Chain config not found')
          const market = new Market(chainConfig)
          await market.transferMarketCredit(user.key, transferRecipient, amount)
        }
      } else {
        // USDC/USDT ERC20 transfer
        if (walletMode === 'local' && client) {
          const result = await client.call('transfer', {
            to: transferRecipient,
            amount: amount,
            token: transferTokenType.toLowerCase(),
            sender: user.key
          })
          if (result.error) throw new Error(result.error)
        } else {
          if (typeof window === 'undefined' || !window.ethereum) {
            throw new Error('MetaMask is required for web3 wallet mode')
          }
          const network = 'testnet'
          const chainConfig = modConfig.chain?.[network]
          if (!chainConfig) throw new Error('Chain config not found')

          const tokenAddress = chainConfig.contracts?.[transferTokenType]?.address
          if (!tokenAddress) throw new Error(`${transferTokenType} contract not found`)

          const browserProvider = new ethers.BrowserProvider(window.ethereum)
          const signer = await browserProvider.getSigner(user.key)
          const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer)
          const amountInWei = ethers.parseUnits(amount.toString(), 6)
          const tx = await contract.transfer(transferRecipient, amountInWei)
          await tx.wait()
        }
      }

      await fetchMarketCredit()
      setTopUpSuccess(`Successfully transferred ${transferTokenType === 'MARKET' ? '$' : '$'}${amount.toFixed(2)} ${transferTokenType} to ${transferRecipient.slice(0, 8)}...${transferRecipient.slice(-6)}!`)
      setTransferAmount('')
      setTransferRecipient('')
      setTimeout(() => {
        setShowTransferForm(false)
        setTopUpSuccess(null)
      }, 3000)
    } catch (err: any) {
      let msg = err?.message || String(err)
      if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('user rejected')) msg = 'Transaction cancelled by user.'
      else if (msg.includes('insufficient funds')) msg = 'Insufficient balance for transfer and gas fees.'
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

  const syncNetworkFromStorage = () => {
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
    syncNetworkFromStorage()

    const savedWidth = localStorage.getItem('wallet_sidebar_width')
    if (savedWidth) {
      setSidebarWidth(parseInt(savedWidth))
    }
  }, [])

  // Listen for network changes from other components (e.g. NetworkSelector)
  useEffect(() => {
    const handler = () => {
      syncNetworkFromStorage()
      fetchMarketCredit()
    }
    window.addEventListener('network-changed', handler)
    return () => window.removeEventListener('network-changed', handler)
  }, [user?.key, client])

  // Close network selector on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (networkDropdownRef.current && !networkDropdownRef.current.contains(e.target as Node)) {
        setShowNetworkSelector(false)
      }
    }
    if (showNetworkSelector) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showNetworkSelector])

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

  const handleChainSelect = (chain: ChainConfig) => {
    setSelectedChain(chain)
    const networkId = networkEnv === 'testnet' ? chain.testnetId : chain.mainnetId
    localStorage.setItem('selected_chain', chain.id)
    localStorage.setItem('selected_network', networkId)
    localStorage.setItem('network_env', networkEnv)
    window.dispatchEvent(new CustomEvent('network-changed'))
  }

  const handleEnvToggle = (env: NetworkEnvironment) => {
    setNetworkEnv(env)
    const networkId = env === 'testnet' ? selectedChain.testnetId : selectedChain.mainnetId
    localStorage.setItem('network_env', env)
    localStorage.setItem('selected_network', networkId)
    window.dispatchEvent(new CustomEvent('network-changed'))
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
        className="flex items-center bg-[#0d0d0d] border-2 border-neutral-800 hover:bg-white/[0.03] hover:border-neutral-600 transition-all relative gap-2 px-3"
        style={{
          height: '48px',
          borderRadius: '0px',
          fontFamily: 'IBM Plex Mono, monospace'
        }}
      >
        <WalletIcon className="w-5 h-5 text-neutral-400 flex-shrink-0" />
        <span className="text-sm font-black font-mono tabular-nums text-green-400">
          ${marketCredit.toFixed(2)}
        </span>
        <span className={`text-[10px] font-bold font-mono tabular-nums ${isTokenExpired ? 'text-red-400' : 'text-cyan-500'}`}>
          {tokenExpiry || getTokenExpiry()}
        </span>
        <div
          className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-sm transition-colors ${
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
              className={`fixed top-0 right-0 h-screen shadow-2xl z-[90] overflow-y-auto custom-scrollbar font-mono bg-[#0a0a0a] ${isResizing ? 'select-none' : ''}`}
              style={{
                width: `${sidebarWidth}px`,
                borderLeft: `1px solid ${userColor}30`,
                boxShadow: `-40px 0 80px rgba(0, 0, 0, 0.9), 0 0 120px ${userColor}15`,
                cursor: isResizing ? 'ew-resize' : 'default'
              }}
            >
              {/* Resize Handle */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/5 transition-colors z-[100] group"
                onMouseDown={() => setIsResizing(true)}
              >
                <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-0.5 h-16 bg-neutral-800 group-hover:bg-neutral-500 transition-colors rounded-full" />
              </div>
              {isResizing && (
                <style>{`body { cursor: ew-resize !important; user-select: none; }`}</style>
              )}
              {/* Header */}
              <div className="sticky top-0 z-10 border-b border-neutral-800/80 bg-neutral-950/95 backdrop-blur-md">
                {/* Top bar: close + sign out */}
                <div className="flex items-center justify-between px-5 pt-4 pb-2">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-red-500/70 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all text-[11px] font-bold uppercase tracking-wider"
                    style={{ borderRadius: '6px', fontFamily: 'IBM Plex Mono, monospace' }}
                  >
                    <ArrowRightOnRectangleIcon className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                  <button
                    onClick={() => setIsHovered(false)}
                    className="p-2 hover:bg-neutral-800/80 transition-all rounded-lg"
                  >
                    <XMarkIcon className="w-5 h-5 text-neutral-600 hover:text-neutral-400 transition-colors" />
                  </button>
                </div>

                {/* Address + Credit row */}
                <div className="flex items-stretch gap-3 px-5 pb-3">
                  <button
                    onClick={copyAddress}
                    className={`flex-1 text-base font-bold tracking-wider font-mono transition-all cursor-pointer px-4 py-3 border-2 ${
                      copiedAddress
                        ? 'border-green-500 bg-green-500/15 text-green-400'
                        : 'border-neutral-800 hover:border-neutral-700 bg-neutral-900/80 hover:bg-neutral-800/80 text-neutral-400'
                    }`}
                    style={{ fontFamily: 'IBM Plex Mono, monospace', borderRadius: '8px' }}
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
                    className={`flex items-center gap-3 px-4 py-3 border-2 transition-all cursor-pointer ${
                      copiedCredit
                        ? 'border-green-500 bg-green-500/15'
                        : 'border-neutral-800 hover:border-neutral-700 bg-neutral-900/80 hover:bg-neutral-800/80'
                    }`}
                    style={{
                      borderRadius: '8px',
                      fontFamily: 'IBM Plex Mono, monospace'
                    }}
                    title="Click to copy credit amount"
                  >
                    <span className={`text-xs uppercase tracking-wider font-bold ${copiedCredit ? 'text-green-400' : 'text-neutral-600'}`}>
                      {copiedCredit ? 'COPIED!' : 'CREDIT'}
                    </span>
                    <span className={`text-xl font-mono font-black tabular-nums ${copiedCredit ? 'text-green-300' : 'text-green-400'}`}>
                      ${marketCredit.toFixed(2)}
                    </span>
                  </button>
                </div>

                {/* Token + Session Refresh row */}
                <div className="flex items-stretch gap-3 px-5 pb-5">
                  <button
                    onClick={() => {
                      const token = localStorage.getItem('wallet_token') || ''
                      if (token) {
                        navigator.clipboard.writeText(token)
                        setCopied(true)
                        setTimeout(() => setCopied(false), 2000)
                      }
                    }}
                    className={`flex-1 flex items-center gap-2 px-4 py-3 border-2 transition-all cursor-pointer ${
                      copied && !copiedAddress && !copiedCredit
                        ? 'border-green-500 bg-green-500/15'
                        : 'border-neutral-800 hover:border-neutral-700 bg-neutral-900/80 hover:bg-neutral-800/80'
                    }`}
                    style={{ borderRadius: '8px', fontFamily: 'IBM Plex Mono, monospace' }}
                    title="Click to copy token"
                  >
                    <ClipboardDocumentIcon className={`w-4 h-4 flex-shrink-0 ${copied && !copiedAddress && !copiedCredit ? 'text-green-400' : 'text-neutral-600'}`} />
                    <span className={`text-sm font-mono font-bold truncate ${copied && !copiedAddress && !copiedCredit ? 'text-green-400' : 'text-neutral-500'}`}>
                      {copied && !copiedAddress && !copiedCredit ? 'COPIED!' : (localStorage.getItem('wallet_token')?.slice(0, 20) + '...' || 'No token')}
                    </span>
                  </button>
                  <button
                    onClick={handleRefreshToken}
                    disabled={isRefreshing}
                    className={`flex items-center gap-2 px-4 py-3 border-2 transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50 ${
                      isTokenExpired
                        ? 'border-red-500/60 bg-red-500/10 hover:bg-red-500/20 hover:border-red-400'
                        : 'border-neutral-800 hover:border-cyan-500/50 bg-neutral-900/80 hover:bg-cyan-500/10'
                    }`}
                    style={{ borderRadius: '8px', fontFamily: 'IBM Plex Mono, monospace' }}
                    title="Refresh session token"
                  >
                    <ArrowPathIcon className={`w-4 h-4 flex-shrink-0 ${isRefreshing ? 'animate-spin' : ''} ${isTokenExpired ? 'text-red-400' : 'text-cyan-400'}`} />
                    <span className={`text-lg font-mono font-black tabular-nums ${isTokenExpired ? 'text-red-400' : 'text-cyan-400'}`}>
                      {tokenExpiry || getTokenExpiry()}
                    </span>
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
                    className="mx-5 mt-4 px-4 py-3 border-2 border-yellow-500/50 bg-yellow-500/10 overflow-hidden"
                    style={{ borderRadius: '10px' }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-yellow-500/20 flex items-center justify-center animate-pulse">
                        <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <span className="text-yellow-400 font-black text-xs uppercase tracking-wider" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                          TOKEN EXPIRED
                        </span>
                      </div>
                      <button
                        onClick={handleRefreshToken}
                        disabled={isRefreshing}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 hover:border-yellow-500 text-yellow-400 font-black text-[11px] uppercase transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                        style={{
                          borderRadius: '6px',
                          fontFamily: 'IBM Plex Mono, monospace',
                        }}
                      >
                        {isRefreshing ? (
                          <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <ArrowPathIcon className="w-3.5 h-3.5" />
                            <span>REFRESH</span>
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Network Selector */}
              <div className="px-5 pt-4 pb-2" ref={networkDropdownRef}>
                <button
                  onClick={() => setShowNetworkSelector(!showNetworkSelector)}
                  className="w-full flex items-center justify-between px-4 py-3 border-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
                  style={{
                    borderRadius: '12px',
                    fontFamily: 'IBM Plex Mono, monospace',
                    borderColor: `${selectedChain.color}40`,
                    background: `linear-gradient(135deg, ${selectedChain.color}08 0%, ${selectedChain.color}03 100%)`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 flex items-center justify-center text-lg font-bold rounded-lg"
                      style={{
                        background: `${selectedChain.color}20`,
                        color: selectedChain.color,
                        border: `1px solid ${selectedChain.color}30`,
                      }}
                    >
                      {selectedChain.icon}
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-xs font-black uppercase tracking-wider text-neutral-300">
                        {selectedChain.name}
                      </span>
                      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: `${selectedChain.color}aa` }}>
                        {networkEnv === 'testnet' ? selectedChain.testnetName : selectedChain.mainnetName}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5"
                      style={{
                        borderRadius: '4px',
                        background: networkEnv === 'mainnet' ? '#10b98120' : '#f59e0b20',
                        color: networkEnv === 'mainnet' ? '#10b981' : '#f59e0b',
                        border: `1px solid ${networkEnv === 'mainnet' ? '#10b98130' : '#f59e0b30'}`,
                      }}
                    >
                      {networkEnv}
                    </span>
                    <ChevronDownIcon
                      className={`w-4 h-4 text-neutral-500 transition-transform duration-200 ${showNetworkSelector ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>

                <AnimatePresence>
                  {showNetworkSelector && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="pt-3 space-y-3">
                        {/* Testnet / Mainnet Toggle */}
                        <div
                          className="flex p-1 border border-neutral-800/80 bg-neutral-950/80"
                          style={{ borderRadius: '10px' }}
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
                                  layoutId="envToggle"
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

                        {/* Chain Grid */}
                        <div className="grid grid-cols-2 gap-2">
                          {CHAINS.map((chain) => {
                            const isSelected = selectedChain.id === chain.id
                            return (
                              <button
                                key={chain.id}
                                onClick={() => handleChainSelect(chain)}
                                className="relative flex flex-col items-center gap-2 py-4 px-3 border-2 transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] group"
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
                                {/* Selected indicator dot */}
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

                                {/* Chain icon */}
                                <div
                                  className="w-10 h-10 flex items-center justify-center text-xl rounded-xl transition-all duration-200"
                                  style={{
                                    background: isSelected ? `${chain.color}20` : `${chain.color}0a`,
                                    color: isSelected ? chain.color : `${chain.color}60`,
                                    border: `1px solid ${isSelected ? `${chain.color}40` : `${chain.color}15`}`,
                                  }}
                                >
                                  {chain.icon}
                                </div>

                                {/* Chain name */}
                                <span
                                  className="text-[11px] font-black uppercase tracking-wider transition-colors duration-200"
                                  style={{
                                    color: isSelected ? chain.color : '#737373',
                                  }}
                                >
                                  {chain.name}
                                </span>

                                {/* Network name subtitle */}
                                <span
                                  className="text-[10px] font-bold uppercase tracking-wider transition-colors duration-200"
                                  style={{
                                    color: isSelected ? `${chain.color}80` : '#404040',
                                  }}
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

              {/* Action Tabs */}
              <div className="px-5 py-4">
              <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#404040 transparent' }}>
                {/* ADD BUTTON */}
                <button
                  onClick={() => {
                    setShowTopUpForm(!showTopUpForm)
                    setShowTransferForm(false)
                    setShowTxsTab(false)
                    setShowPortfolioTab(false)
                  }}
                  className={`flex-shrink-0 flex flex-col items-center justify-center gap-1.5 border-2 transition-all duration-300 text-[11px] font-bold uppercase shadow-lg hover:scale-105 ${
                    showTopUpForm
                      ? 'bg-gradient-to-br from-green-500/30 to-emerald-500/30 border-green-400 text-green-300 shadow-green-500/50'
                      : 'bg-gradient-to-br from-green-950/40 to-emerald-950/40 border-green-900/60 text-green-600 hover:text-green-300 hover:border-green-400/60 hover:shadow-green-500/30'
                  }`}
                  style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    borderRadius: '12px',
                    width: '72px',
                    height: '72px'
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
                  className={`flex-shrink-0 flex flex-col items-center justify-center gap-1.5 border-2 transition-all duration-300 text-[11px] font-bold uppercase shadow-lg hover:scale-105 ${
                    showTransferForm
                      ? 'bg-gradient-to-br from-blue-500/30 to-blue-600/30 border-blue-400 text-blue-300 shadow-blue-500/50'
                      : 'bg-gradient-to-br from-blue-950/40 to-cyan-950/40 border-blue-900/60 text-blue-600 hover:text-blue-300 hover:border-blue-400/60 hover:shadow-blue-500/30'
                  }`}
                  style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    borderRadius: '12px',
                    width: '72px',
                    height: '72px'
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
                  className={`flex-shrink-0 flex flex-col items-center justify-center gap-1.5 border-2 transition-all duration-300 text-[11px] font-bold uppercase shadow-lg hover:scale-105 ${
                    showPortfolioTab
                      ? 'bg-gradient-to-br from-purple-500/30 to-purple-600/30 border-purple-400 text-purple-300 shadow-purple-500/50'
                      : 'bg-gradient-to-br from-purple-950/40 to-fuchsia-950/40 border-purple-900/60 text-purple-600 hover:text-purple-300 hover:border-purple-400/60 hover:shadow-purple-500/30'
                  }`}
                  style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    borderRadius: '12px',
                    width: '72px',
                    height: '72px'
                  }}
                >
                  <WalletIcon className="w-5 h-5" />
                  <span>PORT</span>
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
                  className={`flex-shrink-0 flex flex-col items-center justify-center gap-1.5 border-2 transition-all duration-300 text-[11px] font-bold uppercase shadow-lg hover:scale-105 ${
                    showTxsTab
                      ? 'bg-gradient-to-br from-amber-500/30 to-orange-500/30 border-amber-400 text-amber-300 shadow-amber-500/50'
                      : 'bg-gradient-to-br from-amber-950/40 to-orange-950/40 border-amber-900/60 text-amber-600 hover:text-amber-300 hover:border-amber-400/60 hover:shadow-amber-500/30'
                  }`}
                  style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    borderRadius: '12px',
                    width: '72px',
                    height: '72px'
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
                    className="mt-3 pt-3 border-t border-neutral-800/50 overflow-hidden"
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
                            className="flex items-center justify-between px-3 py-2.5 bg-neutral-900/80 border border-neutral-800/60 text-xs"
                            style={{
                              borderRadius: '8px',
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
                        className="w-full bg-neutral-900/80 border border-neutral-800/60 px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-neutral-600 text-neutral-300 hover:border-neutral-700 transition-colors"
                        style={{
                          borderRadius: '8px',
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
                        className="w-full bg-neutral-900/80 border border-neutral-800/60 px-3 py-2.5 text-sm font-mono placeholder-neutral-600 focus:outline-none focus:border-neutral-600 disabled:opacity-50 text-neutral-300 hover:border-neutral-700 transition-colors"
                        style={{
                          borderRadius: '8px',
                          fontFamily: 'IBM Plex Mono, monospace'
                        }}
                      />
                    </div>

                    <button
                      onClick={handleTopUpTransaction}
                      disabled={!topUpAmount || isProcessing}
                      className="w-full py-3 border bg-green-500/10 border-green-500/30 font-mono uppercase font-bold text-xs disabled:opacity-50 transition-all hover:bg-green-500/20 hover:border-green-500/50 flex items-center justify-center gap-2 text-green-400"
                      style={{
                        borderRadius: '10px',
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
                      <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2.5 font-mono"
                        style={{
                          borderRadius: '8px',
                          fontFamily: 'IBM Plex Mono, monospace'
                        }}
                      >
                        {topUpError}
                      </div>
                    )}

                    {topUpSuccess && (
                      <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-2.5 font-mono"
                        style={{
                          borderRadius: '8px',
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
                      <label className="text-xs text-neutral-500 font-bold uppercase mb-1 block" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>Token</label>
                      <div className="flex gap-1.5">
                        {(['MARKET', 'USDC', 'USDT'] as TransferTokenType[]).map((token) => (
                          <button
                            key={token}
                            onClick={() => setTransferTokenType(token)}
                            className={`flex-1 py-2 px-2 text-xs font-bold uppercase font-mono border-2 transition-all ${
                              transferTokenType === token
                                ? token === 'MARKET'
                                  ? 'border-green-500 bg-green-500/20 text-green-400'
                                  : token === 'USDC'
                                  ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                                  : 'border-teal-500 bg-teal-500/20 text-teal-400'
                                : 'border-neutral-800 bg-neutral-900/80 text-neutral-500 hover:border-neutral-700 hover:text-neutral-400'
                            }`}
                            style={{
                              borderRadius: '8px',
                              fontFamily: 'IBM Plex Mono, monospace'
                            }}
                          >
                            <div>{token}</div>
                            <div className="text-[11px] font-normal tabular-nums mt-0.5 opacity-70">
                              {token === 'MARKET' ? `$${(tokenBalances?.MARKET || 0).toFixed(2)}` :
                               token === 'USDC' ? `$${(tokenBalances?.USDC || 0).toFixed(2)}` :
                               `$${(tokenBalances?.USDT || 0).toFixed(2)}`}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-neutral-500 font-bold uppercase mb-1 block" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>Recipient</label>
                      <input
                        type="text"
                        value={transferRecipient}
                        onChange={(e) => setTransferRecipient(e.target.value)}
                        disabled={isTransferring}
                        placeholder="0x..."
                        className="w-full bg-neutral-900/80 border border-neutral-800/60 px-3 py-2.5 text-sm font-mono placeholder-neutral-600 focus:outline-none focus:border-neutral-600 disabled:opacity-50 text-neutral-300 hover:border-neutral-700 transition-colors"
                        style={{
                          borderRadius: '8px',
                          fontFamily: 'IBM Plex Mono, monospace'
                        }}
                      />
                    </div>

                    <div>
                      <label className="text-xs text-neutral-500 font-bold uppercase mb-1 block" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>Amount ({transferTokenType})</label>
                      <input
                        type="number"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        disabled={isTransferring}
                        min="0"
                        step="0.01"
                        placeholder="10.00"
                        className="w-full bg-neutral-900/80 border border-neutral-800/60 px-3 py-2.5 text-sm font-mono placeholder-neutral-600 focus:outline-none focus:border-neutral-600 disabled:opacity-50 text-neutral-300 hover:border-neutral-700 transition-colors"
                        style={{
                          borderRadius: '8px',
                          fontFamily: 'IBM Plex Mono, monospace'
                        }}
                      />
                    </div>

                    <button
                      onClick={handleTransfer}
                      disabled={!transferAmount || !transferRecipient || isTransferring}
                      className={`w-full py-3 border font-mono uppercase font-bold text-xs disabled:opacity-50 transition-all flex items-center justify-center gap-2 ${
                        transferTokenType === 'MARKET'
                          ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20 hover:border-green-500/50'
                          : transferTokenType === 'USDC'
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/50'
                          : 'bg-teal-500/10 border-teal-500/30 text-teal-400 hover:bg-teal-500/20 hover:border-teal-500/50'
                      }`}
                      style={{
                        borderRadius: '10px',
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
                          <span>SEND {transferTokenType}</span>
                        </>
                      )}
                    </button>

                    {topUpError && (
                      <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2.5 font-mono"
                        style={{
                          borderRadius: '8px',
                          fontFamily: 'IBM Plex Mono, monospace'
                        }}
                      >
                        {topUpError}
                      </div>
                    )}

                    {topUpSuccess && (
                      <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-2.5 font-mono"
                        style={{
                          borderRadius: '8px',
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
                          className="px-2.5 py-1 bg-neutral-900/80 border border-neutral-800/60 text-xs text-neutral-400 cursor-pointer focus:outline-none font-mono rounded-md"
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

          </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default WalletHeader
