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
  TrashIcon,
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

interface ClaimData {
  amount: number
  recipient: string
  from: string
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
  const [tokenBalance, setTokenBalance] = useState<string>('0')
  const [claims, setClaims] = useState<BridgeClaim[]>([])
  const [allClaims, setAllClaims] = useState<any[]>([])
  const [latestClaimResult, setLatestClaimResult] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [hasClaimed, setHasClaimed] = useState(false)
  const [unclaimedAmount, setUnclaimedAmount] = useState<string>('')
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null)
  const [claimedHistory, setClaimedHistory] = useState<Record<string, ClaimData>>({})
  const [contractOwner, setContractOwner] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)

  // Loading states
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [checkingClaim, setCheckingClaim] = useState(false)
  const [loadingUnclaimed, setLoadingUnclaimed] = useState(false)
  const [loadingBalanceSheet, setLoadingBalanceSheet] = useState(false)
  const [loadingAllClaims, setLoadingAllClaims] = useState(false)

  // Search state
  const [searchAddress, setSearchAddress] = useState('')
  const [searchResult, setSearchResult] = useState<{
    address: string
    total: number
    claimed: number
    unclaimed: number
    claimData?: ClaimData
  } | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchRecipient, setSearchRecipient] = useState('')

  // History search state
  const [historySearchQuery, setHistorySearchQuery] = useState('')

  // Active tab - only claim now (history removed but keeping type for future use)
  const [activeTab, setActiveTab] = useState<'claim' | 'history'>('claim')

  // Auto-connect from user context and fetch unclaimed balance
  useEffect(() => {
    const initWallet = async () => {
      // Use user.key as the primary wallet address (can be sr25519 or EVM)
      if (user?.key) {
        // For sr25519, use as source address
        if (user.crypto_type === 'sr25519') {
          setSr25519Address(user.key)
          setSearchAddress(user.key)
          setWalletConnection({
            type: 'sr25519',
            address: user.key,
            chainId: null,
            provider: null,
          })

          // Auto-search for sr25519 user's balance
          if (client?.token) {
            handleSearch(user.key)
          }

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
        } else {
          // For EVM addresses, try to get provider from window.ethereum
          if (typeof window !== 'undefined' && (window as any).ethereum) {
            try {
              const provider = new ethers.BrowserProvider((window as any).ethereum)
              const network = await provider.getNetwork()

              setWalletConnection({
                type: 'metamask',
                address: user.key,
                chainId: Number(network.chainId),
                provider: provider,
              })
            } catch (error) {
              console.error('Error setting up provider:', error)
              // Fallback without provider
              setWalletConnection({
                type: 'metamask',
                address: user.key,
                chainId: null,
                provider: null,
              })
            }
          } else {
            setWalletConnection({
              type: 'metamask',
              address: user.key,
              chainId: null,
              provider: null,
            })
          }
        }
      }
    }

    initWallet()
  }, [user, client])

  // Sync MetaMask connection for sr25519 users (to set recipient)
  useEffect(() => {
    if (metamask.isConnected && metamask.account && walletConnection.type === 'sr25519') {
      // For sr25519 users, MetaMask is used as recipient address
      setRecipientAddress(metamask.account)
    }
  }, [metamask.isConnected, metamask.account, walletConnection.type])

  // Connect SubWallet for EVM recipient
  const connectSubwallet = async () => {
    if (typeof window === 'undefined') return

    try {
      // First try SubWallet EVM mode via window.ethereum
      if ((window as any).ethereum?.isSubWallet) {
        const provider = new ethers.BrowserProvider((window as any).ethereum)
        const accounts = await provider.send('eth_requestAccounts', [])

        if (accounts && accounts.length > 0) {
          setRecipientAddress(accounts[0])
          toast.success('SubWallet connected for token recipient')
          return
        }
      }

      // Fallback: try MetaMask
      if ((window as any).ethereum) {
        const provider = new ethers.BrowserProvider((window as any).ethereum)
        const accounts = await provider.send('eth_requestAccounts', [])

        if (accounts && accounts.length > 0) {
          setRecipientAddress(accounts[0])
          toast.success('EVM wallet connected for token recipient')
          return
        }
      }

      toast.error('Please install SubWallet or MetaMask extension')
      window.open('https://subwallet.app/download.html', '_blank')
    } catch (error: any) {
      console.error('SubWallet connection error:', error)

      if (error.code === 4001) {
        toast.error('Connection request rejected')
      } else {
        toast.error('Failed to connect wallet')
      }
    }
  }

  // Fetch token balance
  const fetchBalance = useCallback(async () => {
    if (!walletConnection.address) return

    try {
      setLoadingBalance(true)
      setTokenBalance('0') // Reset to 0 while loading

      const network = 'testnet'
      const tokenAddr = (modConfig.chain as any)?.[network]?.contracts?.BridgeToken?.address

      if (!tokenAddr) {
        console.warn('Bridge token address not configured')
        return
      }

      // Get provider - use walletConnection provider or create from window.ethereum
      let provider = walletConnection.provider
      if (!provider && typeof window !== 'undefined' && (window as any).ethereum) {
        provider = new ethers.BrowserProvider((window as any).ethereum)
      }

      if (!provider) {
        console.warn('No provider available')
        return
      }

      const tokenContract = new ethers.Contract(
        tokenAddr,
        [
          'function balanceOf(address) view returns (uint256)',
          'function decimals() view returns (uint8)',
        ],
        provider
      )

      const [balance, decimals] = await Promise.all([
        tokenContract.balanceOf(walletConnection.address),
        tokenContract.decimals(),
      ])

      const formattedBalance = ethers.formatUnits(balance, decimals)
      console.log('Bridge token balance for', walletConnection.address, ':', formattedBalance, 'BT')
      setTokenBalance(formattedBalance)
    } catch (error) {
      console.error('Error fetching balance:', error)
      setTokenBalance('0')
    } finally {
      setLoadingBalance(false)
    }
  }, [walletConnection.address, walletConnection.provider])

  useEffect(() => {
    if (walletConnection.address && walletConnection.provider) {
      fetchBalance()
    } else if (user?.key && user.crypto_type !== 'sr25519') {
      // For EVM users without explicit provider, try to get balance via MetaMask
      const tryFetchBalance = async () => {
        if (typeof window !== 'undefined' && (window as any).ethereum) {
          try {
            const provider = new ethers.BrowserProvider((window as any).ethereum)
            const network = 'testnet'
            const tokenAddr = (modConfig.chain as any)?.[network]?.contracts?.BridgeToken?.address

            if (!tokenAddr) return

            const tokenContract = new ethers.Contract(
              tokenAddr,
              [
                'function balanceOf(address) view returns (uint256)',
                'function decimals() view returns (uint8)',
              ],
              provider
            )

            const [balance, decimals] = await Promise.all([
              tokenContract.balanceOf(user.key),
              tokenContract.decimals(),
            ])

            setTokenBalance(ethers.formatUnits(balance, decimals))
          } catch (error) {
            console.error('Error fetching balance:', error)
          }
        }
      }
      tryFetchBalance()
    }
  }, [walletConnection.address, walletConnection.provider, user?.key, fetchBalance])

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
    console.log('handleClaim called', { client, sr25519Address, recipientAddress, claimAmount, hasClaimed, searchAddress })

    if (!client) {
      toast.error('Client not initialized')
      return
    }

    // Use searchAddress if sr25519Address is not set (for the new UI flow)
    const addressToUse = sr25519Address || searchAddress

    if (!addressToUse) {
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
        sr25519Address: addressToUse,
        evmAddress: recipientAddress,
        amount: claimAmount,
        timestamp: Date.now(),
        status: 'processing',
      }

      setClaims(prev => [newClaim, ...prev])

      // Call bridge claim with authenticated token
      const result = await client.call('bridge/claim', {
        auth_token: client.token,
        recipient: recipientAddress,
      })

      console.log('Claim result:', result)

      // Store the latest claim result for display
      setLatestClaimResult(result)

      // Update claim status
      setClaims(prev =>
        prev.map(c =>
          c.timestamp === newClaim.timestamp
            ? {
                ...c,
                status: 'completed',
                txHash: result?.txHash || result?.tx_hash || result?.tx || '0x' + Math.random().toString(16).slice(2, 66)
              }
            : c
        )
      )

      // Display success message with claim details
      const claimDetails = result?.claim || result
      if (claimDetails) {
        const amount = claimDetails.amount || claimAmount
        const tx = claimDetails.tx_hash || claimDetails.txHash || claimDetails.tx || 'pending'
        toast.success(`Claimed ${amount} BT! Tx: ${tx.substring(0, 10)}...`)
      } else {
        toast.success('Claim processed successfully!')
      }

      setHasClaimed(true)

      // Refresh all claims list to show the new claim
      fetchAllClaims()

      // Refresh search result to show updated status
      if (searchAddress) {
        handleSearch(searchAddress)
      }

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

  // Fetch all claims from bridge/claims
  const fetchAllClaims = useCallback(async () => {
    if (!client) return

    try {
      setLoadingAllClaims(true)
      const result = await client.call('bridge/claims_array')

      if (Array.isArray(result)) {
        setAllClaims(result)
      } else if (result?.claims && Array.isArray(result.claims)) {
        setAllClaims(result.claims)
      } else {
        setAllClaims([])
      }
    } catch (error: any) {
      console.error('Failed to fetch all claims:', error)
      toast.error(error?.message || 'Failed to load claims')
      setAllClaims([])
    } finally {
      setLoadingAllClaims(false)
    }
  }, [client])

  // Load all claims on mount and when switching to history tab
  useEffect(() => {
    if (client?.token && activeTab === 'history') {
      fetchAllClaims()
    }
  }, [client, activeTab, fetchAllClaims])

  // Fetch contract owner and check if current user is owner
  const fetchOwner = useCallback(async () => {
    if (!client) return

    try {
      const ownerResult = await client.call('bridge/owner')
      if (ownerResult) {
        const ownerAddress = ownerResult.toLowerCase()
        setContractOwner(ownerAddress)

        // Check if current wallet is the owner
        if (walletConnection.address) {
          setIsOwner(walletConnection.address.toLowerCase() === ownerAddress)
        }
      }
    } catch (error: any) {
      console.error('Failed to fetch owner:', error)
    }
  }, [client, walletConnection.address])

  useEffect(() => {
    if (client?.token && walletConnection.address) {
      fetchOwner()
    }
  }, [client, walletConnection.address, fetchOwner])

  // Delete a claim (owner only)
  const deleteClaim = async (address: string) => {
    if (!client || !isOwner) {
      toast.error('Only the contract owner can delete claims')
      return
    }

    try {
      const confirmed = window.confirm(`Are you sure you want to delete the claim for ${formatAddress(address)}?`)
      if (!confirmed) return

      const result = await client.call('bridge/delete_claim', { address })

      if (result?.success) {
        toast.success('Claim deleted successfully')
        // Refresh the balance sheet
        fetchBalanceSheet()
      } else {
        toast.error(result?.msg || 'Failed to delete claim')
      }
    } catch (error: any) {
      console.error('Delete claim error:', error)
      toast.error(error?.message || 'Failed to delete claim')
    }
  }

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

  // Search for address claimability
  const handleSearch = async (address: string) => {
    if (!client) {
      return
    }

    if (!address.trim()) {
      setSearchResult(null)
      return
    }

    setSearching(true)
    try {
      const [totalBalancesResult, claimedBalancesResult] = await Promise.all([
        client.call('bridge/get_total_balances'),
        client.call('bridge/get_claims')
      ])

      const totalBalances = totalBalancesResult || {}
      const claimedBalances = claimedBalancesResult || {}

      const total = Number(totalBalances[address] || 0)
      const claimed = Number(claimedBalances[address]?.amount || 0)
      const unclaimed = total - claimed

      setSearchResult({
        address,
        total,
        claimed,
        unclaimed,
        claimData: claimedBalances[address]
      })

      if (unclaimed > 0) {
        setSr25519Address(address)
        setClaimAmount(unclaimed.toString())
      } else {
        setSr25519Address('')
        setClaimAmount('')
      }
    } catch (error: any) {
      console.error('Search error:', error)
      setSearchResult(null)
    } finally {
      setSearching(false)
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
        fontFamily: 'var(--font-digital), monospace',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        background: `repeating-linear-gradient(0deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 1px, transparent 1px, transparent 2px), var(--bg-primary)`,
      }}
    >
      <div className="relative z-10 p-4 md:p-8 max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between border-4 p-4" style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-secondary)' }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 flex items-center justify-center border-4" style={{ borderColor: 'var(--text-primary)', backgroundColor: 'var(--bg-primary)' }}>
              <ArrowsRightLeftIcon className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />
            </div>
            <h1 className="text-3xl font-bold tracking-wider uppercase" style={{ fontFamily: 'var(--font-digital)', color: 'var(--text-primary)' }}>
              BRIDGE <span className="text-base ml-3" style={{ color: 'var(--text-secondary)' }}>SR25519 → EVM TOKEN TRANSFER</span>
            </h1>
          </div>

          {walletConnection.address && (
            <button
              onClick={fetchBalance}
              disabled={loadingBalance}
              className="flex items-center gap-2 px-5 py-3 border-4 text-lg font-bold uppercase tracking-wider transition-all"
              style={{
                borderColor: 'var(--border-strong)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-digital)'
              }}
            >
              <ArrowPathIcon className={`w-6 h-6 ${loadingBalance ? 'animate-spin' : ''}`} />
              REFRESH
            </button>
          )}
        </div>

        {/* Latest Claim Result Display - Top Banner */}
        {latestClaimResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-4 p-4"
            style={{ borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)' }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CheckCircleIcon className="w-6 h-6 flex-shrink-0" style={{ color: '#10b981' }} />
                <div className="flex items-center gap-6 text-sm font-mono flex-wrap">
                  {latestClaimResult.amount && (
                    <div className="flex items-center gap-2">
                      <span className="uppercase font-bold" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital)' }}>AMOUNT:</span>
                      <span className="font-bold" style={{ color: '#10b981', fontFamily: 'var(--font-digital)' }}>
                        {latestClaimResult.amount} BT
                      </span>
                    </div>
                  )}
                  {(latestClaimResult.tx_hash || latestClaimResult.txHash || latestClaimResult.tx) && (
                    <div className="flex items-center gap-2">
                      <span className="uppercase font-bold" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital)' }}>TX:</span>
                      <button
                        onClick={() => copyToClipboard(latestClaimResult.tx_hash || latestClaimResult.txHash || latestClaimResult.tx, 'Transaction Hash')}
                        className="font-mono hover:opacity-70 transition-opacity"
                        style={{ color: '#10b981', fontFamily: 'var(--font-digital)' }}
                        title="Click to copy"
                      >
                        {(latestClaimResult.tx_hash || latestClaimResult.txHash || latestClaimResult.tx).substring(0, 10)}...
                      </button>
                    </div>
                  )}
                  {latestClaimResult.recipient && (
                    <div className="flex items-center gap-2">
                      <span className="uppercase font-bold" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital)' }}>TO:</span>
                      <button
                        onClick={() => copyToClipboard(latestClaimResult.recipient, 'Recipient Address')}
                        className="font-mono hover:opacity-70 transition-opacity"
                        style={{ color: '#10b981', fontFamily: 'var(--font-digital)' }}
                        title="Click to copy"
                      >
                        {latestClaimResult.recipient.substring(0, 10)}...
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setLatestClaimResult(null)}
                className="text-3xl hover:opacity-70 transition-opacity leading-none px-2"
                style={{ color: '#10b981' }}
                title="Close"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}

        {walletConnection.address && (
          <>
            {/* Claim Content */}
            <div className="space-y-4">
                  {/* Simplified Bridge Form */}
                  <div
                    className="border-4 p-8"
                    style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-secondary)' }}
                  >
                    <h3 className="text-2xl font-bold mb-6 uppercase tracking-wider" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>
                      ▸ BRIDGE TOKENS
                    </h3>

                    <div className="space-y-4">
                      {/* From and To in one row */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* From Address */}
                        <div>
                          <label className="text-base mb-2 block font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>
                            FROM (SR25519)
                          </label>
                          <input
                            type="text"
                            placeholder="ENTER SR25519 ADDRESS"
                            value={searchAddress}
                            onChange={e => {
                              const value = e.target.value

                              // If user is signed in with sr25519, prevent changing the address
                              if (user?.crypto_type === 'sr25519' && user.key && value !== user.key) {
                                toast.error('Cannot change address - you are signed in with SR25519')
                                return
                              }

                              setSearchAddress(value)
                              handleSearch(value)
                            }}
                            disabled={user?.crypto_type === 'sr25519'}
                            className="w-full text-sm px-4 py-3 border-4 focus:outline-none font-mono uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                              borderColor: 'var(--border-strong)',
                              backgroundColor: 'var(--bg-input)',
                              color: 'var(--text-primary)',
                              fontFamily: 'var(--font-digital)'
                            }}
                          />
                        </div>

                        {/* To Address */}
                        <div>
                          <label className="text-base mb-2 block font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>
                            TO (EVM)
                          </label>
                          <input
                            type="text"
                            placeholder="0X..."
                            value={recipientAddress}
                            onChange={e => setRecipientAddress(e.target.value)}
                            className="w-full text-sm px-4 py-3 border-4 focus:outline-none font-mono transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                              backgroundColor: 'var(--bg-input)',
                              borderColor: 'var(--border-strong)',
                              color: 'var(--text-primary)',
                              fontFamily: 'var(--font-digital)'
                            }}
                          />
                        </div>
                      </div>

                      {/* Status Display */}
                      {searching && (
                        <div className="flex items-center gap-2 text-base" style={{ color: 'var(--text-secondary)' }}>
                          <ArrowPathIcon className="w-5 h-5 animate-spin" />
                          <span>SEARCHING...</span>
                        </div>
                      )}

                      {searchResult && (
                        <div className="border-4 p-6" style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-tertiary)' }}>
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              {searchResult.unclaimed > 0 ? (
                                <>
                                  <CheckCircleIcon className="w-6 h-6 text-cyan-400" />
                                  <span className="text-base font-bold uppercase" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>
                                    AVAILABLE: {searchResult.unclaimed.toLocaleString()} BT
                                  </span>
                                </>
                              ) : searchResult.claimed > 0 ? (
                                <>
                                  <CheckCircleIcon className="w-6 h-6 text-green-400" />
                                  <span className="text-base font-bold uppercase" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>
                                    ALREADY CLAIMED
                                  </span>
                                </>
                              ) : (
                                <>
                                  <XCircleIcon className="w-6 h-6 text-gray-400" />
                                  <span className="text-base font-bold uppercase" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>
                                    NO ALLOCATION
                                  </span>
                                </>
                              )}
                            </div>

                            {searchResult.unclaimed > 0 && (
                              <div className="flex flex-col items-end gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    if (user?.crypto_type !== 'sr25519') {
                                      toast.error('Bridge claims require SR25519 wallet. Please switch to an SR25519 account to claim.')
                                      return
                                    }
                                    console.log('Claim button clicked', { isProcessing, recipientAddress, searchResult })
                                    handleClaim()
                                  }}
                                  disabled={isProcessing || !recipientAddress.trim() || user?.crypto_type !== 'sr25519'}
                                  className="px-6 py-2 border-4 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-bold text-base uppercase tracking-wider hover:opacity-80 cursor-pointer relative z-10"
                                  style={{
                                    borderColor: 'var(--border-strong)',
                                    backgroundColor: 'var(--bg-primary)',
                                    color: 'var(--text-primary)',
                                    fontFamily: 'var(--font-digital)',
                                    pointerEvents: 'auto'
                                  }}
                                  title={user?.crypto_type !== 'sr25519' ? 'SR25519 wallet required to claim' : ''}
                                >
                                  {isProcessing ? (
                                    <span className="flex items-center justify-center gap-2">
                                      <ArrowPathIcon className="w-5 h-5 animate-spin" />
                                      PROCESSING
                                    </span>
                                  ) : (
                                    '▸ CLAIM'
                                  )}
                                </button>
                                {user?.crypto_type !== 'sr25519' && (
                                  <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital)' }}>
                                    ⚠ SR25519 WALLET REQUIRED
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Display claim JSON for already claimed addresses */}
                          {searchResult.claimed > 0 && searchResult.claimData && (
                            <div className="mt-4 border-4 p-4" style={{ borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.05)' }}>
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-xs font-bold uppercase px-2 py-1 border-2" style={{
                                  color: '#10b981',
                                  borderColor: '#10b981',
                                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                  fontFamily: 'var(--font-digital)'
                                }}>
                                  CLAIM DATA
                                </span>
                              </div>
                              <pre
                                className="text-xs font-mono overflow-x-auto p-3 border-2"
                                style={{
                                  color: '#10b981',
                                  borderColor: '#10b981',
                                  backgroundColor: 'var(--bg-primary)',
                                  fontFamily: 'var(--font-digital)',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-all'
                                }}
                              >
                                {JSON.stringify(searchResult.claimData, null, 2)}
                              </pre>
                              <button
                                onClick={() => copyToClipboard(JSON.stringify(searchResult.claimData, null, 2), 'Claim JSON')}
                                className="mt-3 px-4 py-2 border-2 text-xs font-bold uppercase tracking-wider hover:opacity-80 transition-opacity"
                                style={{
                                  borderColor: '#10b981',
                                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                  color: '#10b981',
                                  fontFamily: 'var(--font-digital)'
                                }}
                              >
                                📋 COPY JSON
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

            </div>
          </>
        )}
      </div>
    </div>
  )
}
