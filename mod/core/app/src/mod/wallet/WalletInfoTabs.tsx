'use client'

import { userContext } from '@/mod/context/UserContext'
import { useState } from 'react'
import { CopyButton } from '@/mod/ui/CopyButton'
import { QRCode } from '@/mod/ui/QRCode'
import { text2color } from '@/mod/utils'
import { ArrowPathIcon, ChevronDownIcon, ClockIcon, QrCodeIcon, CreditCardIcon } from '@heroicons/react/24/outline'
import { Auth } from '@/mod/client/auth'
import WalletCreditDisplay from './WalletCreditDisplay'
import { useRouter } from 'next/navigation'

export default function WalletInfoTabs() {
  const { user } = userContext()
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showBalanceDropdown, setShowBalanceDropdown] = useState(false)
  const [tokenExpiry, setTokenExpiry] = useState<string | null>(null)
  const [tokenDuration, setTokenDuration] = useState<number>(3600)
  const [isAddressQrHovered, setIsAddressQrHovered] = useState(false)
  const [isTokenQrHovered, setIsTokenQrHovered] = useState(false)
  
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
      console.log('Token refreshed successfully:', newToken)
    } catch (error) {
      console.error('Failed to refresh token:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleTopUp = () => {
    router.push(`/user/${user.key}?tab=billing`)
  }

  useState(() => {
    const interval = setInterval(() => {
      setTokenExpiry(getTokenExpiry())
    }, 1000)
    return () => clearInterval(interval)
  })

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="p-3 rounded-lg border-2 transition-all hover:bg-white/5" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', borderColor: `${userColor}60` }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="text-sm text-gray-400 font-bold uppercase tracking-wider">Auth Token</div>
              <div className="flex items-center gap-1 text-xs" style={{ color: userColor }}>
                <ClockIcon className="w-4 h-4" />
                <span className="font-mono font-bold">{tokenExpiry || getTokenExpiry()}</span>
              </div>
            </div>
            <button
              onClick={handleRefreshToken}
              disabled={isRefreshing}
              className="flex items-center gap-1 px-2 py-1 rounded border transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              style={{ borderColor: userColor, color: userColor }}
              title="Refresh Token"
            >
              <ArrowPathIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="text-xs font-bold">REFRESH</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <code className="font-mono text-xs break-all text-gray-500">
              {localStorage.getItem('wallet_token')?.substring(0, 40)}...
            </code>
            <CopyButton text={localStorage.getItem('wallet_token') || ''} size="sm" showValueOnHover={true} />
            <div 
              className="relative"
              onMouseEnter={() => setIsTokenQrHovered(true)}
              onMouseLeave={() => setIsTokenQrHovered(false)}
            >
              <QrCodeIcon className="h-5 w-5 cursor-pointer" style={{ color: userColor }} />
              {isTokenQrHovered && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-black/95 rounded-lg border-2 z-50 shadow-2xl" style={{ borderColor: userColor }}>
                  <QRCode value={localStorage.getItem('wallet_token') || ''} size={120} color={userColor} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-3 rounded-lg border-2 transition-all hover:bg-white/5" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', borderColor: `${userColor}60` }}>
          <div className="text-sm text-gray-400 mb-1 font-bold uppercase tracking-wider">Address</div>
          <div className="flex items-center gap-2">
            <code className="font-mono text-sm break-all" style={{ color: userColor }}>
              {user.key}
            </code>
            <CopyButton text={user.key || ''} size="sm" showValueOnHover={true} />
            <div 
              className="relative"
              onMouseEnter={() => setIsAddressQrHovered(true)}
              onMouseLeave={() => setIsAddressQrHovered(false)}
            >
              <QrCodeIcon className="h-5 w-5 cursor-pointer" style={{ color: userColor }} />
              {isAddressQrHovered && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-black/95 rounded-lg border-2 z-50 shadow-2xl" style={{ borderColor: userColor }}>
                  <QRCode value={user.key || ''} size={120} color={userColor} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-3 rounded-lg border-2 transition-all hover:bg-white/5" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', borderColor: `${userColor}60` }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-400 font-bold uppercase tracking-wider">Credits</div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleTopUp}
                className="flex items-center gap-1 px-3 py-1 rounded border transition-all hover:scale-105 active:scale-95"
                style={{ borderColor: userColor, color: userColor, backgroundColor: `${userColor}20` }}
                title="Top Up Credits"
              >
                <CreditCardIcon className="w-4 h-4" />
                <span className="text-xs font-bold">TOP UP</span>
              </button>
              <button
                onClick={() => setShowBalanceDropdown(!showBalanceDropdown)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-all"
              >
                <ChevronDownIcon className={`w-4 h-4 transition-transform ${showBalanceDropdown ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
          {showBalanceDropdown && (
            <div className="space-y-2 mb-2">
              <div className="flex items-center justify-between p-2 rounded bg-black/30">
                <span className="text-xs text-gray-400 font-bold uppercase">Native Token</span>
                <span className="font-mono text-sm font-bold" style={{ color: userColor }}>{user.balance?.toLocaleString() || 0}</span>
              </div>
              <div className="border-t border-white/10 pt-2">
                <WalletCreditDisplay />
              </div>
            </div>
          )}
          {!showBalanceDropdown && (
            <div className="font-mono text-lg font-bold" style={{ color: userColor }}>{user.balance?.toLocaleString() || 0}</div>
          )}
        </div>

        <div className="p-3 rounded-lg border-2 transition-all hover:bg-white/5" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', borderColor: `${userColor}60` }}>
          <div className="text-sm text-gray-400 mb-1 font-bold uppercase tracking-wider">Key Type</div>
          <div className="font-mono text-sm font-bold" style={{ color: userColor }}>{user.crypto_type || 'ecdsa'}</div>
        </div>
      </div>
    </div>
  )
}