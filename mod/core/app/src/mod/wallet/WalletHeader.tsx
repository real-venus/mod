"use client";

import { useState, useRef, useEffect } from 'react'
import { userContext } from '@/mod/context/UserContext'
import { WalletIcon, ArrowRightOnRectangleIcon, ClipboardDocumentIcon, UserCircleIcon, ClockIcon, ArrowPathIcon, CreditCardIcon, QrCodeIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { WalletAuthButton } from './WalletAuthButton'
import { CopyButton } from '@/mod/ui/CopyButton'
import { QRCode } from '@/mod/ui/QRCode'
import { text2color } from '@/mod/utils'
import { Auth } from '@/mod/client/auth'
import WalletCreditDisplay from './WalletCreditDisplay'

export function WalletHeader() {
  const { user, signOut } = userContext()
  const [isHovered, setIsHovered] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [tokenExpiry, setTokenExpiry] = useState<string | null>(null)
  const [tokenDuration] = useState<number>(3600)
  const [showBalanceDropdown, setShowBalanceDropdown] = useState(false)
  const [isAddressQrHovered, setIsAddressQrHovered] = useState(false)
  const [isTokenQrHovered, setIsTokenQrHovered] = useState(false)
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
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs font-bold text-green-400 uppercase tracking-wider">
                  {walletMode || 'Connected'}
                </span>
              </div>
              <button
                onClick={copyAddress}
                className="w-full text-left font-mono text-sm text-white/80 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg transition-all flex items-center justify-between gap-2"
                title="Click to copy address"
              >
                <span className="truncate">{shortAddress}</span>
                <ClipboardDocumentIcon className="w-4 h-4 flex-shrink-0" />
              </button>
              {copied && (
                <span className="text-xs text-green-400 mt-1 block">✓ Copied!</span>
              )}
            </div>

            {/* Auth Token */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Auth Token</div>
                  <div className="flex items-center gap-1 text-xs" style={{ color: userColor }}>
                    <ClockIcon className="w-3 h-3" />
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
                  <ArrowPathIcon className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span className="text-xs font-bold">REFRESH</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <code className="font-mono text-xs break-all text-gray-500 flex-1">
                  {typeof window !== 'undefined' ? localStorage.getItem('wallet_token')?.substring(0, 30) + '...' : ''}
                </code>
                {typeof window !== 'undefined' && (
                  <CopyButton text={localStorage.getItem('wallet_token') || ''} size="sm" showValueOnHover={true} />
                )}
                <div
                  className="relative"
                  onMouseEnter={() => setIsTokenQrHovered(true)}
                  onMouseLeave={() => setIsTokenQrHovered(false)}
                >
                  <QrCodeIcon className="h-4 w-4 cursor-pointer" style={{ color: userColor }} />
                  {isTokenQrHovered && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-black/95 rounded-lg border-2 z-50 shadow-2xl" style={{ borderColor: userColor }}>
                      <QRCode value={typeof window !== 'undefined' ? localStorage.getItem('wallet_token') || '' : ''} size={120} color={userColor} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="p-4 border-b border-white/10">
              <div className="text-xs text-gray-400 mb-1 font-bold uppercase tracking-wider">Address</div>
              <div className="flex items-center gap-2">
                <code className="font-mono text-xs break-all flex-1" style={{ color: userColor }}>
                  {user.key}
                </code>
                <CopyButton text={user.key || ''} size="sm" showValueOnHover={true} />
                <div
                  className="relative"
                  onMouseEnter={() => setIsAddressQrHovered(true)}
                  onMouseLeave={() => setIsAddressQrHovered(false)}
                >
                  <QrCodeIcon className="h-4 w-4 cursor-pointer" style={{ color: userColor }} />
                  {isAddressQrHovered && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-black/95 rounded-lg border-2 z-50 shadow-2xl" style={{ borderColor: userColor }}>
                      <QRCode value={user.key || ''} size={120} color={userColor} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Market Tokens */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Market Tokens</div>
                <button
                  onClick={handleTopUp}
                  className="flex items-center gap-1 px-2 py-1 rounded border transition-all hover:scale-105 active:scale-95"
                  style={{ borderColor: userColor, color: userColor, backgroundColor: `${userColor}20` }}
                  title="Top Up Market Tokens"
                >
                  <CreditCardIcon className="w-3 h-3" />
                  <span className="text-xs font-bold">TOP UP</span>
                </button>
              </div>
              <div className="font-mono text-lg font-bold" style={{ color: userColor }}>{user.balance?.toLocaleString() || 0}</div>
              <div className="mt-2">
                <WalletCreditDisplay />
              </div>
            </div>

            {/* Key Type */}
            <div className="p-4 border-b border-white/10">
              <div className="text-xs text-gray-400 mb-1 font-bold uppercase tracking-wider">Key Type</div>
              <div className="font-mono text-sm font-bold" style={{ color: userColor }}>{user.crypto_type || 'ecdsa'}</div>
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
