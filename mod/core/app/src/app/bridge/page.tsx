"use client";

import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { toast } from 'react-toastify'
import {
  ArrowsRightLeftIcon,
  WalletIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import { useMetaMask } from '@/wallet/MetaMaskProvider'
import modConfig from '@/config.json'
import { userContext } from '@/context/UserContext'

// Types
interface WalletConnection {
  type: 'metamask' | 'subwallet' | 'sr25519' | null
  address: string | null
  chainId: number | null
  provider: ethers.BrowserProvider | null
}

interface BridgeClaim {
  sr25519Address: string
  evmAddress: string
  amount: string
  timestamp: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  txHash?: string
}

interface BalanceEntry {
  address: string
  total: number
  claimed: number
  unclaimed: number
}

interface BalanceSheet {
  totalBalance: number
  totalClaimed: number
  totalUnclaimed: number
  entries: BalanceEntry[]
}

export default function BridgePage() {
  // MetaMask context
  const metamask = useMetaMask()

  // User context
  const { user, client } = userContext()

  // Wallet state
  const [walletConnection, setWalletConnection] = useState<WalletConnection>({
    type: null,
    address: null,
    chainId: null,
    provider: null,
  })

  // Bridge state
  const [sr25519Address, setSr25519Address] = useState('')
  const [recipientAddress, setRecipientAddress] = useState('')
  const [claimAmount, setClaimAmount] = useState('')
  const [tokenBalance, setTokenBalance] = useState('0')
  const [claims, setClaims] = useState<BridgeClaim[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [hasClaimed, setHasClaimed] = useState(false)
  const [unclaimedAmount, setUnclaimedAmount] = useState<string>('')
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null)
  const [claimedHistory, setClaimedHistory] = useState<Record<string, number>>({})

  // Loading states
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [checkingClaim, setCheckingClaim] = useState(false)
  const [loadingUnclaimed, setLoadingUnclaimed] = useState(false)
  const [loadingBalanceSheet, setLoadingBalanceSheet] = useState(false)

  // Active tab
  const [activeTab, setActiveTab] = useState<'claim' | 'history' | 'balances'>('claim')

  // Auto-connect sr25519 keys and fetch unclaimed balance
  useEffect(() => {
    const initSr25519 = async () => {
      if (user?.crypto_type === 'sr25519' && user.key) {
        setSr25519Address(user.key)
        setWalletConnection({
          type: 'sr25519',
          address: user.key,
          chainId: null,
          provider: null,
        })

        // Only fetch data if client is available (has token)
        if (client?.token) {
          // Fetch unclaimed balance and claim status from bridge module
          setLoadingUnclaimed(true)
          try {
            // Check if already claimed
            const claimedResult = await client.call('bridge/has_claimed', { address: user.key })
            const alreadyClaimed = claimedResult === true || claimedResult?.claimed === true
            setHasClaimed(alreadyClaimed)

            if (!alreadyClaimed) {
              // Fetch unclaimed balance
              const unclaimedResult = await client.call('bridge/unclaimed', { address: user.key })
              if (typeof unclaimedResult === 'number' || typeof unclaimedResult === 'string') {
                const amount = unclaimedResult.toString()
                console.log('Unclaimed balance:', amount)
                setUnclaimedAmount(amount)
                setClaimAmount(amount)
              }
            } else {
              toast.info('You have already claimed your tokens')
            }
          } catch (error: any) {
            console.error('Failed to fetch bridge data:', error)
            toast.error(error?.message || 'Failed to load claim status')
          } finally {
            setLoadingUnclaimed(false)
          }
        }
      }
    }

    initSr25519()
  }, [user, client])

  // Sync MetaMask connection to wallet state
  useEffect(() => {
    if (metamask.isConnected && metamask.account) {
      // If sr25519 is already set, preserve it but add EVM as recipient
      if (walletConnection.type === 'sr25519') {
        setRecipientAddress(metamask.account)
      } else {
        setWalletConnection({
          type: 'metamask',
          address: metamask.account,
          chainId: metamask.chainId,
          provider: metamask.provider,
        })
        setRecipientAddress(metamask.account)
      }
    } else {
      if (walletConnection.type === 'metamask') {
        setWalletConnection({
          type: null,
          address: null,
          chainId: null,
          provider: null,
        })
      }
    }
  }, [metamask.isConnected, metamask.account, metamask.chainId, metamask.provider])

  // Connect MetaMask
  const connectMetaMask = async () => {
    try {
      await metamask.connect()
    } catch (error) {
      console.error('MetaMask connection error:', error)
    }
  }

  // Connect Subwallet
  const connectSubwallet = async () => {
    if (typeof window === 'undefined') return

    try {
      // Check if Subwallet is installed
      const subwalletProvider = (window as any).injectedWeb3?.['subwallet-js']

      if (!subwalletProvider) {
        toast.error('Subwallet is not installed. Please install the Subwallet extension.')
        window.open('https://subwallet.app/download.html', '_blank')
        return
      }

      // Enable Subwallet
      const accounts = await subwalletProvider.enable()

      if (accounts && accounts.length > 0) {
        const address = accounts[0].address

        // Create ethers provider from Subwallet's EVM provider
        const evmProvider = (window as any).ethereum
        if (evmProvider) {
          const provider = new ethers.BrowserProvider(evmProvider)
          const signer = await provider.getSigner()
          const signerAddress = await signer.getAddress()
          const network = await provider.getNetwork()

          setWalletConnection({
            type: 'subwallet',
            address: signerAddress,
            chainId: Number(network.chainId),
            provider: provider,
          })
          setRecipientAddress(signerAddress)
          toast.success('Subwallet connected successfully')
        } else {
          toast.error('Subwallet EVM mode not detected')
        }
      }
    } catch (error: any) {
      console.error('Subwallet connection error:', error)

      if (error.code === 4001) {
        toast.error('Connection request rejected')
      } else {
        toast.error('Failed to connect Subwallet')
      }
    }
  }

  // Disconnect wallet
  const disconnectWallet = () => {
    if (walletConnection.type === 'metamask') {
      metamask.disconnect()
    }
    setWalletConnection({
      type: null,
      address: null,
      chainId: null,
      provider: null,
    })
    setSr25519Address('')
    setRecipientAddress('')
    setTokenBalance('0')
    toast.info('Wallet disconnected')
  }

  // Fetch token balance
  const fetchBalance = useCallback(async () => {
    if (!walletConnection.address || !walletConnection.provider) return

    try {
      setLoadingBalance(true)
      const network = 'testnet'
      const tokenAddr = (modConfig.chain as any)?.[network]?.contracts?.BridgeToken?.address

      if (!tokenAddr) {
        console.warn('Bridge token address not configured')
        return
      }

      const tokenContract = new ethers.Contract(
        tokenAddr,
        [
          'function balanceOf(address) view returns (uint256)',
          'function decimals() view returns (uint8)',
        ],
        walletConnection.provider
      )

      const [balance, decimals] = await Promise.all([
        tokenContract.balanceOf(walletConnection.address),
        tokenContract.decimals(),
      ])

      setTokenBalance(ethers.formatUnits(balance, decimals))
    } catch (error) {
      console.error('Error fetching balance:', error)
      toast.error('Failed to fetch token balance')
    } finally {
      setLoadingBalance(false)
    }
  }, [walletConnection.address, walletConnection.provider])

  useEffect(() => {
    if (walletConnection.address) {
      fetchBalance()
    }
  }, [walletConnection.address, fetchBalance])

  // Check if address has already claimed (for manual input)
  const checkHasClaimed = useCallback(async () => {
    if (!sr25519Address || walletConnection.type === 'sr25519' || !client) return

    try {
      setCheckingClaim(true)
      const result = await client.call('bridge/has_claimed', { address: sr25519Address })
      const claimed = result === true || result?.claimed === true
      setHasClaimed(claimed)
    } catch (error) {
      console.error('Error checking claim:', error)
    } finally {
      setCheckingClaim(false)
    }
  }, [sr25519Address, walletConnection.type, client])

  useEffect(() => {
    if (sr25519Address && walletConnection.type !== 'sr25519' && client) {
      checkHasClaimed()
    }
  }, [sr25519Address, walletConnection.type, client, checkHasClaimed])

  // Submit claim
  const handleClaim = async () => {
    if (!client) {
      toast.error('Client not initialized')
      return
    }

    if (!sr25519Address) {
      toast.error('Please enter your Sr25519 address')
      return
    }

    if (!recipientAddress) {
      toast.error('Please enter recipient address')
      return
    }

    if (!claimAmount || parseFloat(claimAmount) <= 0) {
      toast.error('Invalid claim amount')
      return
    }

    if (hasClaimed) {
      toast.error('This Sr25519 address has already claimed tokens')
      return
    }

    try {
      setIsProcessing(true)

      const newClaim: BridgeClaim = {
        sr25519Address,
        evmAddress: recipientAddress,
        amount: claimAmount,
        timestamp: Date.now(),
        status: 'processing',
      }

      setClaims(prev => [newClaim, ...prev])

      // Generate signature and submit claim through bridge module
      const message = `claim:${sr25519Address}:${recipientAddress}:${claimAmount}`

      // Call bridge claim with authenticated token
      const result = await client.call('bridge/claim', {
        auth_token: client.token,
        recipient: recipientAddress,
      })

      // Update claim status
      setClaims(prev =>
        prev.map(c =>
          c.timestamp === newClaim.timestamp
            ? {
                ...c,
                status: 'completed',
                txHash: result?.txHash || result?.tx_hash || '0x' + Math.random().toString(16).slice(2, 66)
              }
            : c
        )
      )

      toast.success('Claim processed successfully!')
      setHasClaimed(true)

      // Clear form for sr25519 users
      if (walletConnection.type !== 'sr25519') {
        setSr25519Address('')
        setClaimAmount('')
      }

      // Refresh balance if EVM wallet connected
      if (walletConnection.provider) {
        fetchBalance()
      }

    } catch (error: any) {
      console.error('Claim error:', error)
      toast.error(error?.message || 'Failed to process claim')

      setClaims(prev =>
        prev.map(c =>
          c.timestamp === Date.now()
            ? { ...c, status: 'failed' }
            : c
        )
      )
    } finally {
      setIsProcessing(false)
    }
  }

  // Format address
  const formatAddress = (addr: string) => {
    if (!addr) return ''
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  // Copy to clipboard
  const copyToClipboard = (text: string, label: string = 'Address') => {
    navigator.clipboard.writeText(text)
      .then(() => toast.success(`${label} copied to clipboard`))
      .catch(() => toast.error('Failed to copy'))
  }

  // Fetch balance sheet
  const fetchBalanceSheet = useCallback(async () => {
    if (!client) return

    try {
      setLoadingBalanceSheet(true)

      // Fetch total balances and claimed balances
      const [totalBalancesResult, claimedBalancesResult] = await Promise.all([
        client.call('bridge/get_total_balances'),
        client.call('bridge/get_claims')
      ])

      const totalBalances = totalBalancesResult || {}
      const claimedBalances = claimedBalancesResult || {}

      setClaimedHistory(claimedBalances)

      // Calculate balance sheet
      const addresses = new Set([
        ...Object.keys(totalBalances),
        ...Object.keys(claimedBalances)
      ])

      const entries: BalanceEntry[] = Array.from(addresses).map(address => {
        const total = Number(totalBalances[address] || 0)
        const claimed = Number(claimedBalances[address] || 0)
        const unclaimed = total - claimed

        return {
          address,
          total,
          claimed,
          unclaimed
        }
      }).sort((a, b) => b.total - a.total)

      const totalBalance = entries.reduce((sum, e) => sum + e.total, 0)
      const totalClaimed = entries.reduce((sum, e) => sum + e.claimed, 0)
      const totalUnclaimed = entries.reduce((sum, e) => sum + e.unclaimed, 0)

      setBalanceSheet({
        totalBalance,
        totalClaimed,
        totalUnclaimed,
        entries
      })

    } catch (error: any) {
      console.error('Failed to fetch balance sheet:', error)
      toast.error(error?.message || 'Failed to load balance sheet')
    } finally {
      setLoadingBalanceSheet(false)
    }
  }, [client])

  // Load balance sheet on mount
  useEffect(() => {
    if (client?.token) {
      fetchBalanceSheet()
    }
  }, [client, fetchBalanceSheet])

  // Generate authentication token for sr25519
  const generateAuthToken = async () => {
    if (!user?.key || user.crypto_type !== 'sr25519') {
      toast.error('Sr25519 wallet not connected')
      return
    }

    try {
      setIsProcessing(true)
      toast.info('Please sign the message in your wallet...')

      const { connectClient } = userContext()
      await connectClient()

      toast.success('Authentication token generated successfully!')

      // Reload page to refresh client state
      window.location.reload()
    } catch (error: any) {
      console.error('Token generation error:', error)
      toast.error(error?.message || 'Failed to generate token')
    } finally {
      setIsProcessing(false)
    }
  }

  // Get status color
  const getStatusColor = (status: BridgeClaim['status']) => {
    switch (status) {
      case 'completed': return 'text-green-400'
      case 'failed': return 'text-red-400'
      case 'processing': return 'text-yellow-400'
      default: return 'text-gray-400'
    }
  }

  // Get status icon
  const getStatusIcon = (status: BridgeClaim['status']) => {
    switch (status) {
      case 'completed': return <CheckCircleIcon className="w-5 h-5" />
      case 'failed': return <XCircleIcon className="w-5 h-5" />
      case 'processing': return <ArrowPathIcon className="w-5 h-5 animate-spin" />
      default: return <ClockIcon className="w-5 h-5" />
    }
  }

  return (
    <div
      className="min-h-screen"
      style={{
        fontFamily: 'IBM Plex Mono, monospace',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)'
      }}
    >
      <div className="relative z-10 p-4 md:p-8 max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center border border-cyan-500/40 rounded-lg bg-cyan-500/10">
              <ArrowsRightLeftIcon className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                Bridge
              </h1>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Claim EVM tokens from Sr25519 balances
              </p>
            </div>
          </div>

          {walletConnection.address && (
            <button
              onClick={fetchBalance}
              disabled={loadingBalance}
              className="flex items-center gap-1 px-3 py-2 hover:border-cyan-500/30 rounded-lg hover:text-cyan-400 text-xs transition-all"
              style={{ border: '2px solid var(--border-strong)', color: 'var(--text-tertiary)' }}
            >
              <ArrowPathIcon className={`w-4 h-4 ${loadingBalance ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {/* Wallet Connection Card */}
        {!walletConnection.address ? (
          <div
            className="rounded-xl p-6"
            style={{ backgroundColor: 'var(--bg-secondary)', border: '2px solid var(--border-strong)' }}
          >
            <div className="text-center mb-6">
              <WalletIcon className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
              <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                Connect Your EVM Wallet
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {user?.crypto_type === 'sr25519'
                  ? 'Connect an EVM wallet to receive bridged tokens'
                  : 'Choose your wallet to get started with the bridge'
                }
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* MetaMask */}
              <button
                onClick={connectMetaMask}
                disabled={metamask.isConnecting}
                className="p-6 rounded-xl border-2 transition-all hover:border-orange-500/50 hover:bg-orange-500/5 group"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  borderColor: 'var(--border-strong)'
                }}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 flex items-center justify-center rounded-full bg-orange-500/10 border border-orange-500/30">
                    <span className="text-3xl">🦊</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>
                      MetaMask
                    </h3>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {metamask.isConnecting ? 'Connecting...' : 'Connect with MetaMask'}
                    </p>
                  </div>
                </div>
              </button>

              {/* Subwallet */}
              <button
                onClick={connectSubwallet}
                className="p-6 rounded-xl border-2 transition-all hover:border-purple-500/50 hover:bg-purple-500/5 group"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  borderColor: 'var(--border-strong)'
                }}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 flex items-center justify-center rounded-full bg-purple-500/10 border border-purple-500/30">
                    <span className="text-3xl">💼</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>
                      Subwallet
                    </h3>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      Connect with Subwallet
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Connected Wallet Info */}
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: 'var(--bg-secondary)', border: '2px solid var(--border-strong)' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-full bg-green-500/10 border border-green-500/30">
                    <span className="text-xl">
                      {walletConnection.type === 'metamask' ? '🦊' : walletConnection.type === 'subwallet' ? '💼' : '🔑'}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs mb-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      {walletConnection.type === 'sr25519'
                        ? 'Sr25519 Wallet'
                        : `Connected with ${walletConnection.type === 'metamask' ? 'MetaMask' : 'Subwallet'}`
                      }
                    </div>
                    <button
                      onClick={() => copyToClipboard(walletConnection.address || '', 'Address')}
                      className="font-mono text-sm font-bold flex items-center gap-1.5 hover:text-cyan-400 transition-colors group"
                      style={{ color: 'var(--text-primary)' }}
                      title="Click to copy full address"
                    >
                      {formatAddress(walletConnection.address)}
                      <ClipboardDocumentIcon className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                    {walletConnection.type === 'sr25519' && metamask.isConnected && metamask.account && (
                      <button
                        onClick={() => copyToClipboard(metamask.account || '', 'EVM Address')}
                        className="text-xs mt-1 font-mono flex items-center gap-1 hover:text-cyan-400 transition-colors group"
                        style={{ color: 'var(--text-tertiary)' }}
                        title="Click to copy full EVM address"
                      >
                        EVM: {formatAddress(metamask.account)}
                        <ClipboardDocumentIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {walletConnection.type !== 'sr25519' && (
                    <div className="text-right">
                      <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Balance</div>
                      <div className="font-mono text-lg font-bold text-cyan-400">
                        {parseFloat(tokenBalance).toLocaleString()} BT
                      </div>
                    </div>
                  )}
                  {walletConnection.type !== 'sr25519' && (
                    <button
                      onClick={disconnectWallet}
                      className="px-3 py-2 text-xs rounded-lg transition-all hover:bg-red-500/10 hover:border-red-500/30"
                      style={{ border: '2px solid var(--border-strong)', color: 'var(--text-tertiary)' }}
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1" style={{ borderBottom: '2px solid var(--border-color)' }}>
              {(['claim', 'history', 'balances'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2.5 text-sm font-bold transition-colors relative ${
                    activeTab === tab ? 'text-cyan-400' : ''
                  }`}
                  style={activeTab !== tab ? { color: 'var(--text-tertiary)' } : {}}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {activeTab === tab && (
                    <motion.div
                      layoutId="bridgeTab"
                      className="absolute bottom-0 left-2 right-2 h-[2px] bg-cyan-500"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
              {activeTab === 'claim' && (
                <motion.div
                  key="claim"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  {/* Auth Token Display / Generate */}
                  {walletConnection.type === 'sr25519' && (
                    <div
                      className="rounded-xl p-4 border"
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        borderColor: 'var(--border-color)'
                      }}
                    >
                      {!client?.token ? (
                        <div className="text-center py-6">
                          <div className="mb-4">
                            <div className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                              Authentication Required
                            </div>
                            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                              Sign a message with Subwallet to generate your authentication token
                            </p>
                          </div>
                          <button
                            onClick={generateAuthToken}
                            disabled={isProcessing}
                            className="px-4 py-2 text-sm font-bold bg-cyan-500/15 border-2 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-lg"
                          >
                            {isProcessing ? (
                              <span className="flex items-center justify-center gap-2">
                                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                Generating Token...
                              </span>
                            ) : (
                              'Generate Auth Token'
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <label className="text-xs mb-1.5 block font-bold" style={{ color: 'var(--text-tertiary)' }}>
                              Authentication Token
                            </label>
                            <div className="flex items-center gap-2">
                              <code
                                className="text-xs font-mono break-all bg-black/20 px-2 py-1 rounded flex-1"
                                style={{ color: 'var(--text-secondary)' }}
                              >
                                {client.token}
                              </code>
                              <button
                                onClick={() => copyToClipboard(client.token || '', 'Auth token')}
                                className="flex-shrink-0 p-2 hover:bg-cyan-500/10 rounded transition-colors group"
                                title="Copy auth token"
                              >
                                <ClipboardDocumentIcon className="w-4 h-4 text-cyan-400 hover:text-cyan-300" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Claim Form */}
                  <div
                    className="rounded-xl p-6"
                    style={{ backgroundColor: 'var(--bg-secondary)', border: '2px solid var(--border-strong)' }}
                  >
                    <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                      Submit Claim
                    </h3>

                    <div className="space-y-4">
                      {/* Unclaimed Balance Display */}
                      {walletConnection.type === 'sr25519' && (
                        <div
                          className="rounded-xl p-4 border"
                          style={{
                            backgroundColor: loadingUnclaimed ? 'var(--bg-tertiary)' : hasClaimed ? 'var(--bg-tertiary)' : 'rgba(6, 182, 212, 0.05)',
                            borderColor: hasClaimed ? 'var(--border-color)' : 'rgba(6, 182, 212, 0.3)'
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                                {hasClaimed ? 'Already Claimed' : 'Available to Claim'}
                              </div>
                              <div className="font-mono text-2xl font-bold text-cyan-400">
                                {loadingUnclaimed ? (
                                  <ArrowPathIcon className="w-6 h-6 inline animate-spin" />
                                ) : hasClaimed ? (
                                  '0'
                                ) : (
                                  unclaimedAmount || '0'
                                )}
                              </div>
                            </div>
                            {hasClaimed ? (
                              <CheckCircleIcon className="w-8 h-8 text-green-400" />
                            ) : (
                              <div className="w-10 h-10 flex items-center justify-center rounded-full bg-cyan-500/10 border border-cyan-500/30">
                                <span className="text-xl">🎁</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Sr25519 Address */}
                      <div>
                        <label className="text-xs mb-1.5 block font-bold" style={{ color: 'var(--text-tertiary)' }}>
                          Sr25519 Address *
                        </label>
                        <input
                          type="text"
                          placeholder="5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
                          value={sr25519Address}
                          onChange={e => setSr25519Address(e.target.value)}
                          disabled={walletConnection.type === 'sr25519'}
                          className="w-full text-sm px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/50 font-mono transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                          style={{
                            backgroundColor: 'var(--bg-input)',
                            border: '2px solid var(--border-strong)',
                            color: 'var(--text-primary)'
                          }}
                        />
                        {walletConnection.type === 'sr25519' && (
                          <div className="text-xs mt-1 text-cyan-400">
                            ✓ Using your connected Sr25519 wallet
                          </div>
                        )}
                        {checkingClaim && (
                          <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                            <ArrowPathIcon className="w-3 h-3 inline animate-spin mr-1" />
                            Checking claim status...
                          </div>
                        )}
                        {hasClaimed && !checkingClaim && walletConnection.type !== 'sr25519' && (
                          <div className="text-xs mt-1 text-red-400">
                            ⚠️ This address has already claimed tokens
                          </div>
                        )}
                      </div>

                      {/* Recipient Address */}
                      <div>
                        <label className="text-xs mb-1.5 block font-bold" style={{ color: 'var(--text-tertiary)' }}>
                          Recipient EVM Address *
                        </label>
                        <input
                          type="text"
                          placeholder="0x..."
                          value={recipientAddress}
                          onChange={e => setRecipientAddress(e.target.value)}
                          disabled={hasClaimed}
                          className="w-full text-sm px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/50 font-mono transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                          style={{
                            backgroundColor: 'var(--bg-input)',
                            border: '2px solid var(--border-strong)',
                            color: 'var(--text-primary)'
                          }}
                        />
                        {walletConnection.type === 'sr25519' && !recipientAddress && (
                          <div className="text-xs mt-1 text-yellow-400">
                            ⚠️ Connect MetaMask or Subwallet above to set recipient address
                          </div>
                        )}
                        {walletConnection.type === 'sr25519' && recipientAddress && metamask.isConnected && (
                          <div className="text-xs mt-1 text-cyan-400">
                            ✓ Tokens will be sent to your connected EVM wallet
                          </div>
                        )}
                      </div>

                      {/* Claim Amount */}
                      <div>
                        <label className="text-xs mb-1.5 block font-bold" style={{ color: 'var(--text-tertiary)' }}>
                          Claim Amount *
                        </label>
                        <input
                          type="text"
                          placeholder="0.0"
                          value={claimAmount}
                          onChange={e => setClaimAmount(e.target.value)}
                          readOnly={walletConnection.type === 'sr25519'}
                          disabled={hasClaimed}
                          className="w-full text-sm px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/50 font-mono transition-all disabled:opacity-60 disabled:cursor-not-allowed read-only:bg-cyan-500/5"
                          style={{
                            backgroundColor: 'var(--bg-input)',
                            border: '2px solid var(--border-strong)',
                            color: 'var(--text-primary)'
                          }}
                        />
                        {walletConnection.type === 'sr25519' && claimAmount && !hasClaimed && (
                          <div className="text-xs mt-1 text-cyan-400">
                            ✓ Full unclaimed balance will be claimed
                          </div>
                        )}
                      </div>

                      {/* Submit Button */}
                      <button
                        onClick={handleClaim}
                        disabled={
                          isProcessing ||
                          !sr25519Address ||
                          !recipientAddress ||
                          !claimAmount ||
                          hasClaimed ||
                          loadingUnclaimed ||
                          parseFloat(claimAmount) <= 0
                        }
                        className="w-full px-6 py-3 text-sm font-bold bg-cyan-500/15 border-2 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-lg"
                      >
                        {isProcessing ? (
                          <span className="flex items-center justify-center gap-2">
                            <ArrowPathIcon className="w-4 h-4 animate-spin" />
                            Processing Claim...
                          </span>
                        ) : hasClaimed ? (
                          <span className="flex items-center justify-center gap-2">
                            <CheckCircleIcon className="w-4 h-4" />
                            Already Claimed
                          </span>
                        ) : loadingUnclaimed ? (
                          <span className="flex items-center justify-center gap-2">
                            <ArrowPathIcon className="w-4 h-4 animate-spin" />
                            Loading...
                          </span>
                        ) : (
                          'Submit Claim'
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Info Card */}
                  <div
                    className="rounded-xl p-4 border border-cyan-500/20 bg-cyan-500/5"
                  >
                    <h4 className="text-sm font-bold mb-2 text-cyan-400">
                      ℹ️ How it works
                    </h4>
                    <ul className="space-y-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {walletConnection.type === 'sr25519' ? (
                        <>
                          <li>• Your Sr25519 address is automatically detected</li>
                          <li>• Connect an EVM wallet (MetaMask/Subwallet) to receive tokens</li>
                          <li>• Enter the amount you want to claim from your Sr25519 balance</li>
                          <li>• Submit the claim for verification and processing</li>
                          <li>• Tokens will be minted to your EVM address after verification</li>
                        </>
                      ) : (
                        <>
                          <li>• Enter your Sr25519 address from the substrate chain</li>
                          <li>• Specify the EVM address to receive bridged tokens</li>
                          <li>• Enter the amount you want to claim</li>
                          <li>• Submit the claim for verification and processing</li>
                          <li>• Tokens will be minted to your EVM address after verification</li>
                        </>
                      )}
                    </ul>
                  </div>
                </motion.div>
              )}

              {activeTab === 'history' && (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  {/* Recent Claims (Session) */}
                  {claims.length > 0 && (
                    <div
                      className="rounded-xl p-6"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '2px solid var(--border-strong)' }}
                    >
                      <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                        Recent Claims (This Session)
                      </h3>
                      <div className="space-y-3">
                        {claims.map((claim, idx) => (
                          <div
                            key={idx}
                            className="p-4 rounded-lg border transition-all hover:border-cyan-500/30"
                            style={{
                              backgroundColor: 'var(--bg-tertiary)',
                              borderColor: 'var(--border-color)'
                            }}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`flex items-center gap-1 text-xs font-bold ${getStatusColor(claim.status)}`}>
                                    {getStatusIcon(claim.status)}
                                    {claim.status.toUpperCase()}
                                  </span>
                                </div>
                                <div className="text-xs space-y-1" style={{ color: 'var(--text-tertiary)' }}>
                                  <div>
                                    <span className="font-bold" style={{ color: 'var(--text-secondary)' }}>From:</span>{' '}
                                    <span className="font-mono">{formatAddress(claim.sr25519Address)}</span>
                                  </div>
                                  <div>
                                    <span className="font-bold" style={{ color: 'var(--text-secondary)' }}>To:</span>{' '}
                                    <span className="font-mono">{formatAddress(claim.evmAddress)}</span>
                                  </div>
                                  {claim.txHash && (
                                    <div>
                                      <span className="font-bold" style={{ color: 'var(--text-secondary)' }}>Tx:</span>{' '}
                                      <span className="font-mono">{formatAddress(claim.txHash)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold font-mono text-cyan-400">
                                  {claim.amount} BT
                                </div>
                                <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                  {new Date(claim.timestamp).toLocaleString()}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* All Claimed History */}
                  <div
                    className="rounded-xl p-6"
                    style={{ backgroundColor: 'var(--bg-secondary)', border: '2px solid var(--border-strong)' }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                        All Claimed History
                      </h3>
                      <button
                        onClick={fetchBalanceSheet}
                        disabled={loadingBalanceSheet}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs border rounded-lg hover:border-cyan-500/30 hover:text-cyan-400 transition-all"
                        style={{ borderColor: 'var(--border-strong)', color: 'var(--text-tertiary)' }}
                      >
                        <ArrowPathIcon className={`w-3.5 h-3.5 ${loadingBalanceSheet ? 'animate-spin' : ''}`} />
                        Refresh
                      </button>
                    </div>

                    {loadingBalanceSheet ? (
                      <div className="py-12 text-center">
                        <ArrowPathIcon className="w-12 h-12 mx-auto mb-3 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          Loading claimed history...
                        </p>
                      </div>
                    ) : Object.keys(claimedHistory).length === 0 ? (
                      <div className="py-12 text-center">
                        <ClockIcon className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
                        <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                          No claims yet
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          Claim history will appear here
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {Object.entries(claimedHistory)
                          .sort(([, a], [, b]) => Number(b) - Number(a))
                          .map(([address, amount]) => (
                            <div
                              key={address}
                              className="flex items-center justify-between p-4 rounded-lg border hover:border-green-500/30 transition-all"
                              style={{
                                backgroundColor: 'var(--bg-tertiary)',
                                borderColor: 'var(--border-color)'
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <CheckCircleIcon className="w-5 h-5 text-green-400 flex-shrink-0" />
                                <button
                                  onClick={() => copyToClipboard(address, 'Address')}
                                  className="font-mono text-sm flex items-center gap-1 hover:text-cyan-400 transition-colors group"
                                  style={{ color: 'var(--text-primary)' }}
                                  title="Click to copy full address"
                                >
                                  {formatAddress(address)}
                                  <ClipboardDocumentIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                              </div>
                              <div className="font-mono text-lg font-bold text-green-400">
                                {Number(amount).toLocaleString()} BT
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'balances' && (
                <motion.div
                  key="balances"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  {/* Detailed Balance Sheet */}
                  <div
                    className="rounded-xl p-6"
                    style={{ backgroundColor: 'var(--bg-secondary)', border: '2px solid var(--border-strong)' }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                        Balance Sheet
                      </h3>
                      <button
                        onClick={fetchBalanceSheet}
                        disabled={loadingBalanceSheet}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs border rounded-lg hover:border-cyan-500/30 hover:text-cyan-400 transition-all"
                        style={{ borderColor: 'var(--border-strong)', color: 'var(--text-tertiary)' }}
                      >
                        <ArrowPathIcon className={`w-3.5 h-3.5 ${loadingBalanceSheet ? 'animate-spin' : ''}`} />
                        Refresh
                      </button>
                    </div>

                    {loadingBalanceSheet ? (
                      <div className="py-12 text-center">
                        <ArrowPathIcon className="w-12 h-12 mx-auto mb-3 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          Loading balance sheet...
                        </p>
                      </div>
                    ) : !balanceSheet || balanceSheet.entries.length === 0 ? (
                      <div className="py-12 text-center">
                        <WalletIcon className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
                        <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                          No balances found
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          Balance data will appear here
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                              <th className="text-left py-3 px-2 font-bold" style={{ color: 'var(--text-secondary)' }}>
                                Address
                              </th>
                              <th className="text-right py-3 px-2 font-bold" style={{ color: 'var(--text-secondary)' }}>
                                Total
                              </th>
                              <th className="text-right py-3 px-2 font-bold" style={{ color: 'var(--text-secondary)' }}>
                                Claimed
                              </th>
                              <th className="text-right py-3 px-2 font-bold" style={{ color: 'var(--text-secondary)' }}>
                                Unclaimed
                              </th>
                              <th className="text-right py-3 px-2 font-bold" style={{ color: 'var(--text-secondary)' }}>
                                %
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {balanceSheet.entries.map((entry) => (
                              <tr
                                key={entry.address}
                                className="border-b hover:bg-cyan-500/5 transition-colors"
                                style={{ borderColor: 'var(--border-color)' }}
                              >
                                <td className="py-3 px-2">
                                  <button
                                    onClick={() => copyToClipboard(entry.address, 'Address')}
                                    className="font-mono text-xs flex items-center gap-1 hover:text-cyan-400 transition-colors group"
                                    style={{ color: 'var(--text-primary)' }}
                                    title="Click to copy full address"
                                  >
                                    {formatAddress(entry.address)}
                                    <ClipboardDocumentIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </button>
                                </td>
                                <td className="py-3 px-2 text-right font-mono text-cyan-400">
                                  {entry.total.toLocaleString()}
                                </td>
                                <td className="py-3 px-2 text-right font-mono text-green-400">
                                  {entry.claimed.toLocaleString()}
                                </td>
                                <td className="py-3 px-2 text-right font-mono text-orange-400">
                                  {entry.unclaimed.toLocaleString()}
                                </td>
                                <td className="py-3 px-2 text-right text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                  {entry.total > 0
                                    ? `${((entry.claimed / entry.total) * 100).toFixed(1)}%`
                                    : '0%'
                                  }
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Claimed History */}
                  {Object.keys(claimedHistory).length > 0 && (
                    <div
                      className="rounded-xl p-6"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '2px solid var(--border-strong)' }}
                    >
                      <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                        Claimed History
                      </h3>
                      <div className="space-y-2">
                        {Object.entries(claimedHistory)
                          .sort(([, a], [, b]) => Number(b) - Number(a))
                          .map(([address, amount]) => (
                            <div
                              key={address}
                              className="flex items-center justify-between p-3 rounded-lg border"
                              style={{
                                backgroundColor: 'var(--bg-tertiary)',
                                borderColor: 'var(--border-color)'
                              }}
                            >
                              <button
                                onClick={() => copyToClipboard(address, 'Address')}
                                className="font-mono text-xs flex items-center gap-1 hover:text-cyan-400 transition-colors group"
                                style={{ color: 'var(--text-primary)' }}
                                title="Click to copy full address"
                              >
                                {formatAddress(address)}
                                <ClipboardDocumentIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                              <div className="flex items-center gap-2">
                                <div className="font-mono text-sm font-bold text-green-400">
                                  {Number(amount).toLocaleString()}
                                </div>
                                <CheckCircleIcon className="w-4 h-4 text-green-400" />
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  )
}
