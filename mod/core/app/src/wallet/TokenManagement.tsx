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
import { Auth } from '@/client/auth'

interface TokenManagementProps {
  userKey: string
  onBack: () => void
}

export default function TokenManagement({ userKey, onBack }: TokenManagementProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [tokenExpiry, setTokenExpiry] = useState<string | null>(null)
  const [tokenDuration, setTokenDuration] = useState<number>(3600)
  const [isTokenQrHovered, setIsTokenQrHovered] = useState(false)
  const [customData, setCustomData] = useState<string>('')
  const [currentToken, setCurrentToken] = useState<string>('')
  const [tokenAge, setTokenAge] = useState<number>(0)
  const [isExpired, setIsExpired] = useState(false)

  const userColor = text2color(userKey || '')

  const getTokenExpiry = () => {
    const token = localStorage.getItem('wallet_token')
    if (!token) {
      setIsExpired(true)
      return 'No token'
    }

    try {
      const auth = new Auth()
      const authData = auth.token2data(token)
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

      {/* Token Status Header */}
      <div className="p-3 rounded-lg border"
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
            <span className="text-sm font-bold uppercase" style={{ color: isExpired ? '#ef4444' : '#22c65e' }}>
              {isExpired ? 'Token Expired' : 'Token Active'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-sm" style={{ color: userColor }}>
            <ClockIcon className="w-4 h-4" />
            <span className="font-mono font-bold">{tokenExpiry || getTokenExpiry()}</span>
          </div>
        </div>
        <div className="text-xs text-gray-400">
          Created: <span className="font-mono">{formatTokenAge()}</span>
        </div>
      </div>

      {/* Current Token Display */}
      <div className="p-3 rounded-lg border transition-all"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', borderColor: `${userColor}40` }}
      >
        <div className="flex items-center gap-2 mb-2">
          <KeyIcon className="w-4 h-4" style={{ color: userColor }} />
          <span className="text-xs text-gray-400 font-bold uppercase">Current Token</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <code className="font-mono text-xs break-all text-gray-300 flex-1 bg-black/50 p-2 rounded">
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
            <button className="flex items-center gap-1 px-3 py-1.5 rounded text-xs border transition-all hover:scale-105"
              style={{ borderColor: userColor, color: userColor }}
            >
              <QrCodeIcon className="w-4 h-4" />
              <span>Show QR</span>
            </button>
            {isTokenQrHovered && currentToken && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-black/95 rounded-lg border-2 z-50 shadow-2xl"
                style={{ borderColor: userColor }}
              >
                <QRCode value={currentToken} size={150} color={userColor} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create New Token */}
      <div className="p-3 rounded-lg border transition-all"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', borderColor: `${userColor}40` }}
      >
        <div className="flex items-center gap-2 mb-2">
          <ArrowPathIcon className="w-4 h-4" style={{ color: userColor }} />
          <span className="text-xs text-gray-400 font-bold uppercase">Generate New Token</span>
        </div>

        <div className="space-y-2">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">
              Custom Data (Optional)
            </label>
            <textarea
              value={customData}
              onChange={(e) => setCustomData(e.target.value)}
              placeholder="Enter custom data to embed in token..."
              className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-black/50 border text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-1"
              style={{ borderColor: `${userColor}40`, '--tw-ring-color': userColor } as any}
              rows={3}
            />
            <p className="text-xs text-gray-500 mt-1">
              Add metadata like session info, permissions, or tracking data
            </p>
          </div>

          <button
            onClick={handleRefreshToken}
            disabled={isRefreshing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold uppercase border transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              borderColor: userColor,
              color: userColor,
              backgroundColor: `${userColor}15`,
              boxShadow: `0 0 20px ${userColor}20`
            }}
          >
            <ArrowPathIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Generating...' : 'Generate New Token'}</span>
          </button>
        </div>
      </div>

      {/* Token Info */}
      <div className="p-3 rounded-lg border"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)', borderColor: `${userColor}20` }}
      >
        <h3 className="text-xs font-bold uppercase text-gray-400 mb-2">About Tokens</h3>
        <ul className="text-xs text-gray-500 space-y-1">
          <li>• Tokens expire after 60 minutes by default</li>
          <li>• Use custom data to embed context or permissions</li>
          <li>• Tokens are auto-refreshed when expired</li>
          <li>• Keep your token secure - it grants access to your account</li>
        </ul>
      </div>
    </div>
  )
}
