"use client";

import { useState, useEffect } from 'react'
import { CopyButton } from '@/ui/CopyButton'
import { QRCode } from '@/ui/QRCode'
import { text2color } from '@/utils'
import {
  ArrowPathIcon,
  ClockIcon,
  QrCodeIcon,
  KeyIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline'
import { Auth, AuthData } from '@/client/auth'

interface TokenManagementProps {
  userKey: string
  onBack: () => void
}

type TabType = 'token' | 'verify'

export default function TokenManagement({ userKey, onBack }: TokenManagementProps) {
  const [activeTab, setActiveTab] = useState<TabType>('token')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [tokenExpiry, setTokenExpiry] = useState<string | null>(null)
  const [tokenDuration, setTokenDuration] = useState<number>(3600)
  const [isTokenQrHovered, setIsTokenQrHovered] = useState(false)
  const [customData, setCustomData] = useState<string>('')
  const [currentToken, setCurrentToken] = useState<string>('')
  const [tokenAge, setTokenAge] = useState<number>(0)
  const [isExpired, setIsExpired] = useState(false)
  const [tokenData, setTokenData] = useState<AuthData | null>(null)

  const userColor = text2color(userKey || '')

  const getTokenExpiry = () => {
    const token = localStorage.getItem('wallet_token')
    if (!token) {
      setIsExpired(true)
      setTokenData(null)
      return 'No token'
    }

    try {
      const auth = new Auth()
      const authData = auth.token2data(token)
      setTokenData(authData) // Store the full token data
      const tokenTime = parseFloat(authData.time)
      const expiryTime = tokenTime + tokenDuration
      const now = Date.now() / 1000
      const timeLeft = expiryTime - now
      const age = now - tokenTime

      setTokenAge(age)

      if (timeLeft <= 0) {
        setIsExpired(true)
        return 'Expired'
      }

      setIsExpired(false)

      const minutes = Math.floor(timeLeft / 60)
      const seconds = Math.floor(timeLeft % 60)
      return `${minutes}m ${seconds}s`
    } catch (error) {
      setIsExpired(true)
      setTokenData(null)
      return 'Invalid token'
    }
  }

  const formatTokenAge = () => {
    const minutes = Math.floor(tokenAge / 60)
    const hours = Math.floor(tokenAge / 3600)
    const days = Math.floor(tokenAge / 86400)

    if (days > 0) return `${days}d ${hours % 24}h old`
    if (hours > 0) return `${hours}h ${minutes % 60}m old`
    return `${minutes}m old`
  }

  const handleRefreshToken = async () => {
    setIsRefreshing(true)
    try {
      const wallet_mode = localStorage.getItem('wallet_mode') || 'local'
      const wallet_address = localStorage.getItem('wallet_address')
      const auth = new Auth()

      // If custom data is provided, include it in the token generation
      const newToken = await auth.token(customData, wallet_address, wallet_mode)
      localStorage.setItem('wallet_token', newToken)
      setCurrentToken(newToken)
      setTokenExpiry(getTokenExpiry())

      // Update user data with new token
      const storedUser = localStorage.getItem('user_data')
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser)
          parsedUser.token = newToken
          localStorage.setItem('user_data', JSON.stringify(parsedUser))
        } catch (e) {
          console.error('Failed to update user data:', e)
        }
      }

      // Clear any expired flags
      if (typeof window !== 'undefined') {
        (window as any).__tokenExpired = false
      }
    } catch (error) {
      console.error('Failed to refresh token:', error)
    } finally {
      setIsRefreshing(false)
      setCustomData('') // Clear custom data after use
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('wallet_token')
    setCurrentToken(token || '')

    const interval = setInterval(() => {
      setTokenExpiry(getTokenExpiry())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const formatDate = (timestamp: string) => {
    try {
      const date = new Date(parseFloat(timestamp) * 1000)
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
    } catch {
      return 'Invalid date'
    }
  }

  return (
    <div className="space-y-3">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-all"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        <span>Back to Overview</span>
      </button>

      {/* Tabs */}
      <div className="flex gap-0 border-4" style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-secondary)' }}>
        <button
          onClick={() => setActiveTab('token')}
          className="flex-1 py-3 text-sm font-bold uppercase tracking-widest transition-all font-digital"
          style={{
            backgroundColor: activeTab === 'token' ? 'var(--text-primary)' : 'transparent',
            color: activeTab === 'token' ? 'var(--bg-primary)' : 'var(--text-secondary)',
            borderRight: '4px solid var(--border-strong)'
          }}
        >
          TOKEN
        </button>
        <button
          onClick={() => setActiveTab('verify')}
          className="flex-1 py-3 text-sm font-bold uppercase tracking-widest transition-all font-digital"
          style={{
            backgroundColor: activeTab === 'verify' ? 'var(--text-primary)' : 'transparent',
            color: activeTab === 'verify' ? 'var(--bg-primary)' : 'var(--text-secondary)'
          }}
        >
          VERIFY
        </button>
      </div>

      {activeTab === 'token' ? (
        <>
          {/* Token Status Header */}
          <div className="p-3 border-4"
            style={{
              backgroundColor: isExpired ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
              borderColor: isExpired ? '#ef4444' : '#22c65e'
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {isExpired ? (
                  <ExclamationCircleIcon className="w-5 h-5 text-red-500" />
                ) : (
                  <CheckCircleIcon className="w-5 h-5 text-green-500" />
                )}
                <span className="text-sm font-bold uppercase font-digital tracking-wide" style={{ color: isExpired ? '#ef4444' : '#22c65e' }}>
                  {isExpired ? 'Token Expired' : 'Token Active'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-sm" style={{ color: userColor }}>
                <ClockIcon className="w-4 h-4" />
                <span className="font-mono font-bold">{tokenExpiry || getTokenExpiry()}</span>
              </div>
            </div>
            <div className="text-xs text-gray-400 font-digital uppercase tracking-wide">
              Created: <span className="font-mono">{formatTokenAge()}</span>
            </div>
          </div>

          {/* Token Metadata */}
          {tokenData && (
            <div className="p-3 border-4" style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-strong)' }}>
              <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: '2px solid var(--border-color)' }}>
                <KeyIcon className="w-4 h-4" style={{ color: userColor }} />
                <span className="text-xs text-gray-400 font-bold uppercase font-digital tracking-wide">Token Metadata</span>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-xs uppercase tracking-wider font-digital font-bold" style={{ color: 'var(--text-tertiary)' }}>Created</span>
                  <p className="text-sm font-mono mt-0.5" style={{ color: 'var(--text-primary)' }}>
                    {formatDate(tokenData.time)}
                  </p>
                </div>
                <div>
                  <span className="text-xs uppercase tracking-wider font-digital font-bold" style={{ color: 'var(--text-tertiary)' }}>Generated By Key</span>
                  <p className="text-sm font-mono break-all mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {tokenData.key.slice(0, 20)}...{tokenData.key.slice(-12)}
                  </p>
                </div>
                {tokenData.data && (
                  <div>
                    <span className="text-xs uppercase tracking-wider font-digital font-bold" style={{ color: 'var(--text-tertiary)' }}>Custom Data</span>
                    <p className="text-sm font-mono break-all mt-0.5 p-2" style={{
                      color: 'var(--text-secondary)',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '2px solid var(--border-color)'
                    }}>
                      {tokenData.data}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Current Token Display */}
          <div className="p-3 border-4 transition-all"
            style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-strong)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <KeyIcon className="w-4 h-4" style={{ color: userColor }} />
              <span className="text-xs text-gray-400 font-bold uppercase font-digital tracking-wide">Current Token</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <code className="font-mono text-xs break-all text-gray-300 flex-1 p-2" style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '2px solid var(--border-color)'
              }}>
                {currentToken || 'No token available'}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <CopyButton text={currentToken || ''} size="md" />
              <div
                className="relative"
                onMouseEnter={() => setIsTokenQrHovered(true)}
                onMouseLeave={() => setIsTokenQrHovered(false)}
              >
                <button className="flex items-center gap-1 px-3 py-1.5 text-xs border-2 transition-all hover:scale-105 uppercase font-digital tracking-wide font-bold"
                  style={{ borderColor: userColor, color: userColor, backgroundColor: `${userColor}15` }}
                >
                  <QrCodeIcon className="w-4 h-4" />
                  <span>Show QR</span>
                </button>
                {isTokenQrHovered && currentToken && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-black/95 border-2 z-50 shadow-2xl"
                    style={{ borderColor: userColor }}
                  >
                    <QRCode value={currentToken} size={150} color={userColor} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Create New Token with Custom Data */}
          <div className="p-3 border-4 transition-all"
            style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-strong)' }}
          >
            <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: '2px solid var(--border-color)' }}>
              <ArrowPathIcon className="w-4 h-4" style={{ color: userColor }} />
              <span className="text-xs text-gray-400 font-bold uppercase font-digital tracking-wide">Generate New Token</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-2 block font-digital uppercase tracking-wider font-bold">
                  Custom Token Data
                </label>
                <textarea
                  value={customData}
                  onChange={(e) => setCustomData(e.target.value)}
                  placeholder="rgresergre"
                  className="w-full px-3 py-3 text-xs font-mono border-2 text-gray-300 placeholder-gray-600 focus:outline-none focus:border-[#78a9ff] transition-all font-digital uppercase tracking-wide"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-strong)',
                    color: 'var(--text-primary)'
                  }}
                  rows={4}
                />
                <p className="text-xs text-gray-500 mt-2 font-digital uppercase tracking-wide">
                  Add metadata like session info, permissions, or tracking data
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleRefreshToken}
                  disabled={isRefreshing}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold uppercase border-4 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed font-digital tracking-widest"
                  style={{
                    borderColor: userColor,
                    color: 'var(--bg-primary)',
                    backgroundColor: userColor,
                    boxShadow: `0 0 20px ${userColor}40`
                  }}
                >
                  <ArrowPathIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>{isRefreshing ? 'Generating...' : 'Generate With Data'}</span>
                </button>
                <button
                  onClick={() => setCustomData('')}
                  className="px-6 py-3 text-sm font-bold uppercase border-4 transition-all hover:scale-[1.02] active:scale-[0.98] font-digital tracking-widest"
                  style={{
                    borderColor: 'var(--border-strong)',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--bg-secondary)'
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          {/* Token Info */}
          <div className="p-3 border-4"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
          >
            <h3 className="text-xs font-bold uppercase text-gray-400 mb-2 font-digital tracking-wider">About Tokens</h3>
            <ul className="text-xs text-gray-500 space-y-1 font-digital">
              <li>• Tokens expire after 60 minutes by default</li>
              <li>• Use custom data to embed context or permissions</li>
              <li>• Tokens are auto-refreshed when expired</li>
              <li>• Keep your token secure - it grants access to your account</li>
            </ul>
          </div>
        </>
      ) : (
        <div className="p-6 border-4 text-center" style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-strong)' }}>
          <KeyIcon className="w-12 h-12 mx-auto mb-3 text-gray-600" />
          <h3 className="text-base font-bold uppercase text-gray-400 mb-2 font-digital tracking-wider">Token Verification</h3>
          <p className="text-sm text-gray-500 font-digital">
            Verification features coming soon
          </p>
        </div>
      )}
    </div>
  )
}
