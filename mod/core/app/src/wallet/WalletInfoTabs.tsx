"use client";

import { userContext } from '@/context/UserContext'
import { useState, useEffect } from 'react'
import { CopyButton } from '@/ui/CopyButton'
import { QRCode } from '@/ui/QRCode'
import { text2color } from '@/utils'
import { ArrowPathIcon, ChevronDownIcon, ClockIcon, QrCodeIcon, CreditCardIcon, ArrowsRightLeftIcon, DocumentTextIcon, WalletIcon, KeyIcon, BanknotesIcon } from '@heroicons/react/24/outline'
import { Auth } from '@/client/auth'
import WalletCreditDisplay from './WalletCreditDisplay'
import { useRouter } from 'next/navigation'
import Client from '@/client'

type TabType = 'overview' | 'transactions'

interface Transaction {
  hash: string
  type: string
  status: string
  timestamp: number
  amount?: string
  to?: string
  from?: string
}

export default function WalletInfoTabs() {
  const { user } = userContext()
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showBalanceDropdown, setShowBalanceDropdown] = useState(false)
  const [tokenExpiry, setTokenExpiry] = useState<string | null>(null)
  const [tokenDuration, setTokenDuration] = useState<number>(3600)
  const [isAddressQrHovered, setIsAddressQrHovered] = useState(false)
  const [isTokenQrHovered, setIsTokenQrHovered] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoadingTxs, setIsLoadingTxs] = useState(false)
  
  if (!user) return null
  
  const userColor = text2color(user.key || '')

  const getTokenExpiry = () => {
    const token = localStorage.getItem('wallet_token')
    if (!token) return 'No token'
    
    try {
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

  const handleTopUp = () => {
    router.push(`/user/${user.key}?tab=billing`)
  }

  const fetchUserTransactions = async () => {
    if (!user?.key) return
    setIsLoadingTxs(true)
    try {
      const client = new Client()
      const result = await client.call('api/txs', { address: user.key, limit: 10 })
      if (result?.data) {
        setTransactions(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
    } finally {
      setIsLoadingTxs(false)
    }
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setTokenExpiry(getTokenExpiry())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (activeTab === 'transactions') {
      fetchUserTransactions()
    }
  }, [activeTab, user?.key])

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: WalletIcon },
    { id: 'transactions' as TabType, label: 'Txs', icon: ArrowsRightLeftIcon },
  ]

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor(Date.now() / 1000 - timestamp)
    if (seconds < 60) return `${seconds}s ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  const truncateHash = (hash: string) => {
    if (!hash) return ''
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`
  }

  return (
    <div className="space-y-2">
      {/* Token Display - Above Tabs - 8-bit style */}
      <div className="p-3 border-4 transition-all" style={{
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderColor: `${userColor}`,
        imageRendering: 'pixelated',
        clipPath: 'polygon(0 4px, 4px 4px, 4px 0, calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px), 0 calc(100% - 4px))',
        boxShadow: `0 0 8px ${userColor}40`
      }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <KeyIcon className="w-4 h-4" style={{ color: userColor }} />
            <span className="text-xs text-gray-400 font-bold uppercase">Token</span>
            <div className="flex items-center gap-1 text-xs" style={{ color: userColor }}>
              <ClockIcon className="w-3.5 h-3.5" />
              <span className="font-mono font-bold">{tokenExpiry || getTokenExpiry()}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleRefreshToken}
              disabled={isRefreshing}
              className="flex items-center gap-1 px-2 py-1 text-xs border-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              style={{
                borderColor: userColor,
                color: userColor,
                clipPath: 'polygon(0 2px, 2px 2px, 2px 0, calc(100% - 2px) 0, calc(100% - 2px) 2px, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 2px calc(100% - 2px), 0 calc(100% - 2px))',
              }}
            >
              <ArrowPathIcon className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="font-bold">Refresh</span>
            </button>
          </div>
        </div>
        <div
          className="flex items-center gap-2 p-2 bg-black/50 border-2 cursor-pointer hover:bg-black/70 transition-all group"
          onClick={() => {
            const token = localStorage.getItem('wallet_token') || ''
            if (token) navigator.clipboard.writeText(token)
          }}
          title="Click to copy token"
          style={{
            borderColor: `${userColor}40`,
            clipPath: 'polygon(0 2px, 2px 2px, 2px 0, calc(100% - 2px) 0, calc(100% - 2px) 2px, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 2px calc(100% - 2px), 0 calc(100% - 2px))',
          }}
        >
          <code className="font-mono text-sm break-all flex-1" style={{ color: userColor }}>
            {localStorage.getItem('wallet_token') || 'No token'}
          </code>
          <CopyButton text={localStorage.getItem('wallet_token') || ''} size="sm" />
          <div
            className="relative"
            onMouseEnter={() => setIsTokenQrHovered(true)}
            onMouseLeave={() => setIsTokenQrHovered(false)}
          >
            <QrCodeIcon className="h-4 w-4 cursor-pointer" style={{ color: userColor }} />
            {isTokenQrHovered && (
              <div className="absolute bottom-full right-0 mb-2 p-2 bg-black/95 border-4 z-50 shadow-2xl" style={{
                borderColor: userColor,
                clipPath: 'polygon(0 4px, 4px 4px, 4px 0, calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px), 0 calc(100% - 4px))',
              }}>
                <QRCode value={localStorage.getItem('wallet_token') || ''} size={120} color={userColor} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compact Tab Navigation - 8-bit style */}
      <div className="flex gap-1 p-1 bg-black/40 border-4 border-white/10" style={{
        clipPath: 'polygon(0 4px, 4px 4px, 4px 0, calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px), 0 calc(100% - 4px))',
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-bold uppercase tracking-wide transition-all ${
              activeTab === tab.id
                ? 'text-white shadow-lg'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
            style={{
              backgroundColor: activeTab === tab.id ? `${userColor}30` : undefined,
              borderColor: activeTab === tab.id ? userColor : undefined,
              border: activeTab === tab.id ? `2px solid ${userColor}` : '2px solid transparent',
              clipPath: 'polygon(0 2px, 2px 2px, 2px 0, calc(100% - 2px) 0, calc(100% - 2px) 2px, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 2px calc(100% - 2px), 0 calc(100% - 2px))',
            }}
          >
            <tab.icon className="w-3.5 h-3.5" style={{ color: activeTab === tab.id ? userColor : undefined }} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content - 8-bit style */}
      {activeTab === 'overview' && (
        <div className="space-y-2">
          {/* Address - Compact - 8-bit */}
          <div className="p-2 border-4 transition-all hover:bg-white/5" style={{
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            borderColor: `${userColor}`,
            clipPath: 'polygon(0 4px, 4px 4px, 4px 0, calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px), 0 calc(100% - 4px))',
            boxShadow: `0 0 4px ${userColor}40`
          }}>
            <div className="flex items-center gap-1.5 mb-1">
              <WalletIcon className="w-3.5 h-3.5" style={{ color: userColor }} />
              <span className="text-xs text-gray-400 font-bold uppercase">Address</span>
            </div>
            <div className="flex items-center gap-1.5">
              <code className="font-mono text-xs break-all flex-1" style={{ color: userColor }}>
                {user.key}
              </code>
              <CopyButton text={user.key || ''} size="sm" />
              <div
                className="relative"
                onMouseEnter={() => setIsAddressQrHovered(true)}
                onMouseLeave={() => setIsAddressQrHovered(false)}
              >
                <QrCodeIcon className="h-4 w-4 cursor-pointer" style={{ color: userColor }} />
                {isAddressQrHovered && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-black/95 border-4 z-50 shadow-2xl" style={{
                    borderColor: userColor,
                    clipPath: 'polygon(0 4px, 4px 4px, 4px 0, calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px), 0 calc(100% - 4px))',
                  }}>
                    <QRCode value={user.key || ''} size={100} color={userColor} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Balance - Compact - 8-bit */}
          <div className="p-2 border-4 transition-all hover:bg-white/5" style={{
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            borderColor: `${userColor}`,
            clipPath: 'polygon(0 4px, 4px 4px, 4px 0, calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px), 0 calc(100% - 4px))',
            boxShadow: `0 0 4px ${userColor}40`
          }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <BanknotesIcon className="w-3.5 h-3.5" style={{ color: userColor }} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-sm font-bold" style={{ color: userColor }} suppressHydrationWarning>
                  {user.balance?.toLocaleString('en-US') || 0}
                </span>
                <button
                  onClick={handleTopUp}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 text-xs border-2 transition-all hover:scale-105"
                  style={{
                    borderColor: userColor,
                    color: userColor,
                    backgroundColor: `${userColor}15`,
                    clipPath: 'polygon(0 2px, 2px 2px, 2px 0, calc(100% - 2px) 0, calc(100% - 2px) 2px, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 2px calc(100% - 2px), 0 calc(100% - 2px))',
                  }}
                >
                  <CreditCardIcon className="w-3 h-3" />
                  <span className="font-bold">+</span>
                </button>
                <button
                  onClick={() => setShowBalanceDropdown(!showBalanceDropdown)}
                  className="text-gray-400 hover:text-white transition-all"
                >
                  <ChevronDownIcon className={`w-4 h-4 transition-transform ${showBalanceDropdown ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
            {showBalanceDropdown && (
              <div className="mt-2 pt-2 border-t border-white/10">
                <WalletCreditDisplay />
              </div>
            )}
          </div>

          {/* Key Type - Compact - 8-bit */}
          <div className="p-2 border-4 transition-all hover:bg-white/5" style={{
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            borderColor: `${userColor}`,
            clipPath: 'polygon(0 4px, 4px 4px, 4px 0, calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px), 0 calc(100% - 4px))',
            boxShadow: `0 0 4px ${userColor}40`
          }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <KeyIcon className="w-3.5 h-3.5" style={{ color: userColor }} />
                <span className="text-xs text-gray-400 font-bold uppercase">Key Type</span>
              </div>
              <span className="font-mono text-xs font-bold" style={{ color: userColor }}>
                {user.crypto_type || 'ecdsa'}
              </span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-gray-400 font-bold uppercase">Your Transactions</span>
            <button
              onClick={fetchUserTransactions}
              disabled={isLoadingTxs}
              className="flex items-center gap-1 px-2 py-1 text-xs border-2 transition-all hover:scale-105"
              style={{
                borderColor: userColor,
                color: userColor,
                clipPath: 'polygon(0 2px, 2px 2px, 2px 0, calc(100% - 2px) 0, calc(100% - 2px) 2px, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 2px calc(100% - 2px), 0 calc(100% - 2px))',
              }}
            >
              <ArrowPathIcon className={`w-3 h-3 ${isLoadingTxs ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {isLoadingTxs ? (
            <div className="flex items-center justify-center py-8">
              <ArrowPathIcon className="w-6 h-6 animate-spin" style={{ color: userColor }} />
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-4 border-4 text-center" style={{
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              borderColor: `${userColor}`,
              clipPath: 'polygon(0 4px, 4px 4px, 4px 0, calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px), 0 calc(100% - 4px))',
            }}>
              <DocumentTextIcon className="w-8 h-8 mx-auto mb-2 text-gray-500" />
              <p className="text-xs text-gray-400">No transactions found</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {transactions.map((tx, index) => (
                <div
                  key={tx.hash || index}
                  className="p-2 border-4 transition-all hover:bg-white/5 cursor-pointer"
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    borderColor: `${userColor}`,
                    clipPath: 'polygon(0 4px, 4px 4px, 4px 0, calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px), 0 calc(100% - 4px))',
                    boxShadow: `0 0 4px ${userColor}40`
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <ArrowsRightLeftIcon className="w-3.5 h-3.5" style={{ color: userColor }} />
                      <span className="text-xs font-bold uppercase" style={{ color: userColor }}>
                        {tx.type || 'call'}
                      </span>
                    </div>
                    <span className={`text-xs font-bold px-1.5 py-0.5 border-2 ${
                      tx.status === 'confirmed' || tx.status === 'success'
                        ? 'bg-green-500/20 text-green-400 border-green-500'
                        : tx.status === 'pending'
                        ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500'
                        : 'bg-red-500/20 text-red-400 border-red-500'
                    }`} style={{
                      clipPath: 'polygon(0 2px, 2px 2px, 2px 0, calc(100% - 2px) 0, calc(100% - 2px) 2px, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 2px calc(100% - 2px), 0 calc(100% - 2px))',
                    }}>
                      {tx.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <code className="font-mono text-xs text-gray-400">
                      {truncateHash(tx.hash)}
                    </code>
                    <span className="text-xs text-gray-500">
                      {tx.timestamp ? formatTimeAgo(tx.timestamp) : ''}
                    </span>
                  </div>
                  {tx.amount && (
                    <div className="mt-1 text-xs text-gray-400">
                      Amount: <span style={{ color: userColor }}>{tx.amount}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => router.push(`/user/${user.key}?tab=txs`)}
            className="w-full p-2 border-4 text-xs font-bold uppercase transition-all hover:bg-white/5"
            style={{
              borderColor: `${userColor}`,
              color: userColor,
              clipPath: 'polygon(0 4px, 4px 4px, 4px 0, calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px), 0 calc(100% - 4px))',
            }}
          >
            View All Transactions
          </button>
        </div>
      )}

    </div>
  )
}