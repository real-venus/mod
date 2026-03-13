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

  // Active tab
  const [activeTab, setActiveTab] = useState<'claim' | 'history'>('claim')

  // Auto-connect from user context and fetch unclaimed balance
  useEffect(() => {
    const initWallet = async () => {
      // Use user.key as the primary wallet address (can be sr25519 or EVM)
      if (user?.key) {
        // For sr25519, use as source address
        if (user.crypto_type === 'sr25519') {
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
  const handleSearch = async (address?: string) => {
    if (!client) {
      toast.error('Client not initialized')
      return
    }

    const searchAddr = address || searchAddress.trim() || user?.key
    if (!searchAddr) {
      toast.error('Please enter an address to search')
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

      const total = Number(totalBalances[searchAddr] || 0)
      const claimed = Number(claimedBalances[searchAddr]?.amount || 0)
      const unclaimed = total - claimed

      setSearchResult({
        address: searchAddr,
        total,
        claimed,
        unclaimed,
        claimData: claimedBalances[searchAddr]
      })

      if (unclaimed > 0) {
        setSr25519Address(searchAddr)
        setClaimAmount(unclaimed.toString())
        toast.success(`Found ${unclaimed.toLocaleString()} BT available to claim`)
      } else if (claimed > 0) {
        toast.info('This address has already claimed all tokens')
      } else {
        toast.info('No allocation found for this address')
      }
    } catch (error: any) {
      console.error('Search error:', error)
      toast.error(error?.message || 'Failed to search address')
    } finally {
      setSearching(false)
    }
  }

  // Claim from search result
  const handleSearchClaim = async () => {
    if (!searchResult || searchResult.unclaimed <= 0) {
      toast.error('No unclaimed balance')
      return
    }

    if (!searchRecipient.trim()) {
      toast.error('Please enter recipient EVM address')
      return
    }

    // Set the form values
    setSr25519Address(searchResult.address)
    setRecipientAddress(searchRecipient)
    setClaimAmount(searchResult.unclaimed.toString())

    // Execute claim
    await handleClaim()
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

        {walletConnection.address && (
          <>
            {/* Wallet Info - IBM Style */}
            <div
              className="border-4 p-4"
              style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-secondary)' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 flex items-center justify-center border-4" style={{ borderColor: 'var(--text-primary)', backgroundColor: 'var(--bg-primary)' }}>
                    <WalletIcon className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />
                  </div>
                  <div>
                    <div className="text-base uppercase tracking-wider" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital)' }}>
                      {walletConnection.type === 'sr25519' ? '▸ SR25519' : '▸ WALLET'} <span className="ml-2">
                        <button
                          onClick={() => copyToClipboard(walletConnection.address || '', 'Address')}
                          className="font-mono font-bold inline-flex items-center gap-2 transition-colors group"
                          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}
                          title="Click to copy full address"
                        >
                          {formatAddress(walletConnection.address)}
                          <ClipboardDocumentIcon className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </span>
                      {walletConnection.type === 'sr25519' && metamask.isConnected && metamask.account && (
                        <span className="ml-4">
                          <button
                            onClick={() => copyToClipboard(metamask.account || '', 'EVM Address')}
                            className="font-mono inline-flex items-center gap-1 transition-colors group"
                            style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital)' }}
                            title="Click to copy full EVM address"
                          >
                            EVM: {formatAddress(metamask.account)}
                            <ClipboardDocumentIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {walletConnection.type !== 'sr25519' && (
                    <div className="border-4 px-6 py-3 flex items-center gap-4" style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-primary)' }}>
                      <div className="text-base uppercase tracking-wider" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital)' }}>BALANCE</div>
                      <div className="font-mono text-2xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>
                        {parseFloat(tokenBalance).toLocaleString()} BT
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b-4 pb-2" style={{ borderColor: 'var(--border-strong)' }}>
              {(['claim', 'history'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="px-6 py-4 text-xl font-bold tracking-wider uppercase transition-all border-4"
                  style={{
                    fontFamily: 'var(--font-digital)',
                    borderColor: activeTab === tab ? 'var(--text-primary)' : 'var(--border-color)',
                    backgroundColor: activeTab === tab ? 'var(--text-primary)' : 'var(--bg-primary)',
                    color: activeTab === tab ? 'var(--bg-primary)' : 'var(--text-primary)'
                  }}
                >
                  ▸ {tab}
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
                  {/* SubWallet Connection Prompt for sr25519 users */}
                  {walletConnection.type === 'sr25519' && !recipientAddress && !client?.token && (
                    <div
                      className="rounded-xl p-6 border-2"
                      style={{
                        backgroundColor: 'rgba(6, 182, 212, 0.05)',
                        borderColor: 'rgba(6, 182, 212, 0.3)'
                      }}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-lg bg-cyan-500/10 border-2 border-cyan-500/30">
                          <WalletIcon className="w-6 h-6 text-cyan-400" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold mb-2 text-cyan-400 tracking-tight">
                            Connect EVM Wallet
                          </h3>
                          <p className="text-sm mb-4 font-mono" style={{ color: 'var(--text-secondary)' }}>
                            Connect MetaMask or SubWallet to receive bridged tokens on EVM
                          </p>
                          <button
                            onClick={connectSubwallet}
                            className="px-6 py-2.5 bg-cyan-500/15 border-2 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25 rounded-lg font-bold text-sm transition-all flex items-center gap-2"
                          >
                            <WalletIcon className="w-4 h-4" />
                            Connect Wallet
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Generate Auth Token Button for sr25519 users without token */}
                  {walletConnection.type === 'sr25519' && !client?.token && (
                    <div
                      className="rounded-xl p-6 border-2"
                      style={{
                        backgroundColor: 'rgba(234, 179, 8, 0.05)',
                        borderColor: 'rgba(234, 179, 8, 0.3)'
                      }}
                    >
                      <div className="text-center">
                        <h3 className="text-lg font-bold mb-2 text-yellow-400 tracking-tight">
                          Authentication Required
                        </h3>
                        <p className="text-sm mb-4 font-mono" style={{ color: 'var(--text-secondary)' }}>
                          Sign a message with SubWallet to authenticate
                        </p>
                        <button
                          onClick={generateAuthToken}
                          disabled={isProcessing}
                          className="px-6 py-2.5 bg-yellow-500/15 border-2 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-lg font-bold text-sm"
                        >
                          {isProcessing ? (
                            <span className="flex items-center justify-center gap-2">
                              <ArrowPathIcon className="w-4 h-4 animate-spin" />
                              Generating...
                            </span>
                          ) : (
                            'Generate Auth Token'
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Search for Claimable Address */}
                  <div
                    className="border-4 p-8"
                    style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-secondary)' }}
                  >
                    <h3 className="text-2xl font-bold mb-6 uppercase tracking-wider" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>
                      ▸ SEARCH CLAIMABLE ADDRESS
                    </h3>

                    <div className="space-y-6">
                      <div className="flex gap-3">
                        <input
                          type="text"
                          placeholder={user?.key ? `DEFAULT: ${formatAddress(user.key).toUpperCase()}` : "ENTER SR25519 ADDRESS"}
                          value={searchAddress}
                          onChange={e => setSearchAddress(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSearch()}
                          className="flex-1 text-xl px-6 py-4 border-4 focus:outline-none font-mono uppercase transition-all"
                          style={{
                            borderColor: 'var(--border-strong)',
                            backgroundColor: 'var(--bg-input)',
                            color: 'var(--text-primary)',
                            fontFamily: 'var(--font-digital)'
                          }}
                        />
                        <button
                          onClick={() => handleSearch()}
                          disabled={searching}
                          className="px-8 py-4 border-4 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-bold text-xl uppercase tracking-wider"
                          style={{
                            borderColor: 'var(--border-strong)',
                            backgroundColor: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            fontFamily: 'var(--font-digital)'
                          }}
                        >
                          {searching ? (
                            <ArrowPathIcon className="w-7 h-7 animate-spin" />
                          ) : (
                            '▸ SEARCH'
                          )}
                        </button>
                      </div>

                      {searchResult && (
                        <div
                          className="rounded-lg p-4 border-2"
                          style={{
                            backgroundColor: searchResult.unclaimed > 0 ? 'rgba(6, 182, 212, 0.05)' : 'var(--bg-tertiary)',
                            borderColor: searchResult.unclaimed > 0 ? 'rgba(6, 182, 212, 0.3)' : 'var(--border-color)'
                          }}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              {searchResult.claimed > 0 ? (
                                <CheckCircleIcon className="w-5 h-5 text-green-400" />
                              ) : searchResult.total > 0 ? (
                                <ClockIcon className="w-5 h-5 text-cyan-400" />
                              ) : (
                                <XCircleIcon className="w-5 h-5 text-gray-400" />
                              )}
                              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                                {searchResult.claimed > 0 ? 'Claimed' : searchResult.total > 0 ? 'Unclaimed' : 'No Allocation'}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => copyToClipboard(searchResult.address, 'Address')}
                            className="font-mono text-xs mb-3 flex items-center gap-2 group hover:text-cyan-400 transition-colors w-full"
                            style={{ color: 'var(--text-tertiary)' }}
                          >
                            <span className="truncate">{searchResult.address}</span>
                            <ClipboardDocumentIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          </button>

                          <div className="grid grid-cols-3 gap-4 mb-4">
                            <div>
                              <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Total</div>
                              <div className="font-mono text-lg font-bold text-cyan-400">
                                {searchResult.total.toLocaleString()}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Claimed</div>
                              <div className="font-mono text-lg font-bold text-green-400">
                                {searchResult.claimed.toLocaleString()}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Unclaimed</div>
                              <div className="font-mono text-lg font-bold text-orange-400">
                                {searchResult.unclaimed.toLocaleString()}
                              </div>
                            </div>
                          </div>

                          {searchResult.unclaimed > 0 && (
                            <div className="space-y-3 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                              <div>
                                <label className="text-xs mb-2 block font-bold" style={{ color: 'var(--text-secondary)' }}>
                                  Recipient EVM Address
                                </label>
                                <input
                                  type="text"
                                  value={searchRecipient}
                                  onChange={(e) => setSearchRecipient(e.target.value)}
                                  placeholder="0x..."
                                  className="w-full text-sm px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/50 font-mono transition-all"
                                  style={{
                                    backgroundColor: 'var(--bg-input)',
                                    border: '2px solid var(--border-strong)',
                                    color: 'var(--text-primary)'
                                  }}
                                />
                              </div>
                              <button
                                onClick={handleSearchClaim}
                                disabled={isProcessing || !searchRecipient.trim()}
                                className="w-full px-4 py-3 bg-cyan-500/15 border-2 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-lg font-bold text-sm"
                              >
                                {isProcessing ? (
                                  <span className="flex items-center justify-center gap-2">
                                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                    Claiming...
                                  </span>
                                ) : (
                                  'Claim'
                                )}
                              </button>
                            </div>
                          )}

                          {searchResult.claimData?.recipient && (
                            <div className="pt-3 mt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                              <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Recipient</div>
                              <button
                                onClick={() => copyToClipboard(searchResult.claimData!.recipient, 'Recipient')}
                                className="font-mono text-xs flex items-center gap-2 group hover:text-cyan-400 transition-colors"
                                style={{ color: 'var(--text-secondary)' }}
                              >
                                <span className="truncate">{searchResult.claimData.recipient}</span>
                                <ClipboardDocumentIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Claim Form */}
                  <div
                    className="border-4 p-4"
                    style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-secondary)' }}
                  >
                    <h3 className="text-2xl font-bold mb-4 uppercase tracking-wider inline-flex items-center gap-3" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>
                      ▸ SUBMIT CLAIM
                      {walletConnection.type === 'sr25519' && (
                        <span className="text-base border-4 px-4 py-2 inline-flex items-center gap-2" style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-tertiary)' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{hasClaimed ? '▸ CLAIMED' : '▸ AVAILABLE'}</span>
                          <span className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                            {loadingUnclaimed ? <ArrowPathIcon className="w-6 h-6 inline animate-spin" /> : hasClaimed ? '0' : (unclaimedAmount || '0')}
                          </span>
                          {hasClaimed ? <CheckCircleIcon className="w-6 h-6" style={{ color: 'var(--text-secondary)' }} /> : null}
                        </span>
                      )}
                    </h3>

                    <div className="space-y-3">
                      {/* Form Fields in Grid */}
                      <div className="grid grid-cols-1 gap-3">
                        {/* Sr25519 Address */}
                        <div>
                          <label className="text-base mb-1 block font-bold uppercase tracking-wider inline-flex items-center gap-2" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>
                            SR25519 <span style={{ color: 'var(--text-tertiary)' }}>*</span>
                            {walletConnection.type === 'sr25519' && <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>(▸ USING CONNECTED)</span>}
                            {checkingClaim && <ArrowPathIcon className="w-4 h-4 animate-spin" style={{ color: 'var(--text-secondary)' }} />}
                            {hasClaimed && !checkingClaim && walletConnection.type !== 'sr25519' && <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>(▸ CLAIMED)</span>}
                          </label>
                          <input
                            type="text"
                            placeholder="5GRWVAEF5ZXB26FZ9RCQPDWS57CTERHPNEHXCPCNOHGKUTQY"
                            value={sr25519Address}
                            onChange={e => setSr25519Address(e.target.value)}
                            disabled={walletConnection.type === 'sr25519'}
                            className="w-full text-base px-4 py-3 border-4 focus:outline-none font-mono uppercase transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            style={{
                              backgroundColor: 'var(--bg-input)',
                              borderColor: 'var(--border-strong)',
                              color: 'var(--text-primary)',
                              fontFamily: 'var(--font-digital)'
                            }}
                          />
                        </div>

                        {/* Recipient Address */}
                        <div>
                          <label className="text-base mb-1 block font-bold uppercase tracking-wider inline-flex items-center gap-2" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>
                            EVM RECIPIENT <span style={{ color: 'var(--text-tertiary)' }}>*</span>
                            {walletConnection.type === 'sr25519' && !recipientAddress && <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>(▸ CONNECT)</span>}
                            {walletConnection.type === 'sr25519' && recipientAddress && <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>(▸ TOKENS → HERE)</span>}
                            {recipientAddress && <CheckCircleIcon className="w-4 h-4" style={{ color: 'var(--text-primary)' }} />}
                          </label>
                          <input
                            type="text"
                            placeholder="0X..."
                            value={recipientAddress}
                            onChange={e => setRecipientAddress(e.target.value)}
                            disabled={hasClaimed}
                            className="w-full text-base px-4 py-3 border-4 focus:outline-none font-mono uppercase transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            style={{
                              backgroundColor: 'var(--bg-input)',
                              borderColor: 'var(--border-strong)',
                              color: 'var(--text-primary)',
                              fontFamily: 'var(--font-digital)'
                            }}
                          />
                        </div>
                      </div>

                      {/* Claim Amount and Submit in One Row */}
                      <div className="flex gap-3 items-end">
                        <div className="flex-1">
                          <label className="text-base mb-1 block font-bold uppercase tracking-wider inline-flex items-center gap-2" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>
                            AMOUNT <span style={{ color: 'var(--text-tertiary)' }}>*</span>
                            {walletConnection.type === 'sr25519' && claimAmount && !hasClaimed && <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>(▸ FULL)</span>}
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="0.0"
                              value={claimAmount}
                              onChange={e => setClaimAmount(e.target.value)}
                              readOnly={walletConnection.type === 'sr25519'}
                              disabled={hasClaimed}
                              className="w-full text-base px-4 py-3 border-4 focus:outline-none font-mono font-bold uppercase transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                              style={{
                                backgroundColor: 'var(--bg-input)',
                                borderColor: 'var(--border-strong)',
                                color: 'var(--text-primary)',
                                fontFamily: 'var(--font-digital)'
                              }}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold uppercase" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-digital)' }}>
                              BT
                            </div>
                          </div>
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
                          className="px-8 py-3 text-base font-bold border-4 disabled:opacity-30 disabled:cursor-not-allowed transition-all uppercase tracking-wider"
                          style={{
                            borderColor: 'var(--border-strong)',
                            backgroundColor: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            fontFamily: 'var(--font-digital)'
                          }}
                        >
                          {isProcessing ? (
                            <span className="flex items-center justify-center gap-2">
                              <ArrowPathIcon className="w-5 h-5 animate-spin" />
                              PROCESSING
                            </span>
                          ) : hasClaimed ? (
                            <span className="flex items-center justify-center gap-2">
                              <CheckCircleIcon className="w-5 h-5" />
                              CLAIMED
                            </span>
                          ) : loadingUnclaimed ? (
                            <span className="flex items-center justify-center gap-2">
                              <ArrowPathIcon className="w-5 h-5 animate-spin" />
                              LOADING
                            </span>
                          ) : (
                            '▸ SUBMIT'
                          )}
                        </button>
                      </div>
                    </div>
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
                  {/* All Claims from API */}
                  <div
                    className="border-4 p-4"
                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-strong)' }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-2xl font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>
                        ▸ CLAIM HISTORY
                      </h3>
                      <button
                        onClick={fetchAllClaims}
                        disabled={loadingAllClaims}
                        className="flex items-center gap-2 px-4 py-2 text-base border-4 uppercase tracking-wider transition-all"
                        style={{
                          borderColor: 'var(--border-strong)',
                          backgroundColor: 'var(--bg-primary)',
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--font-digital)'
                        }}
                      >
                        <ArrowPathIcon className={`w-5 h-5 ${loadingAllClaims ? 'animate-spin' : ''}`} />
                        REFRESH
                      </button>
                    </div>

                    {/* Search input for history */}
                    <div className="mb-4">
                      <input
                        type="text"
                        placeholder="SEARCH BY SR25519 OR EVM ADDRESS..."
                        value={historySearchQuery}
                        onChange={e => setHistorySearchQuery(e.target.value)}
                        className="w-full text-base px-4 py-3 border-4 focus:outline-none font-mono uppercase transition-all"
                        style={{
                          backgroundColor: 'var(--bg-input)',
                          borderColor: 'var(--border-strong)',
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--font-digital)'
                        }}
                      />
                    </div>

                    {loadingAllClaims ? (
                      <div className="py-12 text-center border-4" style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-tertiary)' }}>
                        <ArrowPathIcon className="w-12 h-12 mx-auto mb-3 animate-spin" style={{ color: 'var(--text-primary)' }} />
                        <p className="text-lg font-mono uppercase" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital)' }}>
                          ▸ LOADING CLAIMS...
                        </p>
                      </div>
                    ) : allClaims.length === 0 ? (
                      <div className="py-12 text-center border-4" style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-tertiary)' }}>
                        <ClockIcon className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-primary)' }} />
                        <p className="text-lg mb-2 font-bold uppercase" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>
                          ▸ NO CLAIMS YET
                        </p>
                        <p className="text-base font-mono uppercase" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital)' }}>
                          CLAIMS WILL APPEAR ONCE SUBMITTED
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {allClaims
                          .filter(claim => {
                            if (!historySearchQuery.trim()) return true
                            const query = historySearchQuery.toLowerCase().trim()
                            const sr25519Match = (claim.address || claim.from)?.toLowerCase().includes(query)
                            const recipientMatch = claim.recipient?.toLowerCase().includes(query)
                            return sr25519Match || recipientMatch
                          })
                          .map((claim, idx) => (
                          <div
                            key={idx}
                            className="p-4 border-4 transition-all"
                            style={{
                              backgroundColor: 'var(--bg-tertiary)',
                              borderColor: 'var(--border-strong)'
                            }}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-3">
                                  <CheckCircleIcon className="w-6 h-6 flex-shrink-0" style={{ color: 'var(--text-primary)' }} />
                                  <span className="text-base font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>
                                    ▸ CLAIMED
                                  </span>
                                </div>
                                <div className="space-y-2 text-sm font-mono">
                                  {(claim.address || claim.from) && (
                                    <div className="flex items-start gap-2">
                                      <span className="font-bold min-w-[80px] flex-shrink-0 uppercase" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital)' }}>SR25519:</span>
                                      <button
                                        onClick={() => copyToClipboard(claim.address || claim.from, 'Sr25519 Address')}
                                        className="flex items-center gap-1 transition-colors group flex-1 text-left break-all uppercase"
                                        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}
                                        title="Click to copy full address"
                                      >
                                        {claim.address || claim.from}
                                        <ClipboardDocumentIcon className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </button>
                                    </div>
                                  )}
                                  {claim.recipient && (
                                    <div className="flex items-start gap-2">
                                      <span className="font-bold min-w-[80px] flex-shrink-0 uppercase" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital)' }}>EVM:</span>
                                      <button
                                        onClick={() => copyToClipboard(claim.recipient, 'EVM Recipient Address')}
                                        className="flex items-center gap-1 transition-colors group flex-1 text-left break-all uppercase"
                                        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}
                                        title="Click to copy full address"
                                      >
                                        {claim.recipient}
                                        <ClipboardDocumentIcon className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </button>
                                    </div>
                                  )}
                                  {claim.tx_hash && (
                                    <div className="flex items-start gap-2">
                                      <span className="font-bold min-w-[80px] flex-shrink-0 uppercase" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital)' }}>TX:</span>
                                      <button
                                        onClick={() => copyToClipboard(claim.tx_hash, 'Transaction Hash')}
                                        className="flex items-center gap-1 transition-colors group flex-1 text-left break-all uppercase"
                                        style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-digital)' }}
                                        title="Click to copy full hash"
                                      >
                                        {formatAddress(claim.tx_hash)}
                                        <ClipboardDocumentIcon className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </button>
                                    </div>
                                  )}
                                  {claim.timestamp && (
                                    <div className="flex items-start gap-2">
                                      <span className="font-bold min-w-[80px] flex-shrink-0 uppercase" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital)' }}>TIME:</span>
                                      <span className="uppercase" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-digital)' }}>
                                        {new Date(claim.timestamp * 1000).toLocaleString()}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0 border-4 px-4 py-3" style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-primary)' }}>
                                <div className="text-3xl font-bold font-mono mb-1" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>
                                  {typeof claim.amount === 'number'
                                    ? claim.amount.toLocaleString()
                                    : claim.amount || '0'}
                                </div>
                                <div className="text-sm font-bold uppercase" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital)' }}>
                                  BT
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  )
}
