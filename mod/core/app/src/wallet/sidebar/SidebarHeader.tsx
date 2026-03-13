"use client";

import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { ArrowPathIcon, ArrowRightStartOnRectangleIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-toastify'
import DebitABI from '@/contracts/market/debit/Debit.sol/Debit.json'
import modConfig from '@/config.json'
import { NetworkSelector } from '@/network/NetworkSelector'

function getDebitAddress(): string {
  const chainConfig = (modConfig.chain as any)?.testnet
  return chainConfig?.contracts?.Debit?.address || ''
}

interface SidebarHeaderProps {
  shortAddress: string
  walletMode: string
  copiedAddress: boolean
  copyAddress: () => void
  tokenExpiry: string | null
  getTokenExpiry: () => string
  isTokenExpired: boolean
  isRefreshing: boolean
  handleRefreshToken: () => void
  handleSignOut: () => void
  onClose: () => void
  marketCredit: number
  address: string
  walletHistory: { address: string; mode: string; type: string; lastUsed: number }[]
  isSwitchingWallet: boolean
  onSwitchWallet: (wallet: { address: string; mode: string; type: string }) => void
  onRemoveFromHistory: (addr: string) => void
}

export function SidebarHeader({
  shortAddress, walletMode, copiedAddress, copyAddress,
  tokenExpiry, getTokenExpiry, isTokenExpired, isRefreshing,
  handleRefreshToken, handleSignOut, onClose, marketCredit, address,
  walletHistory, isSwitchingWallet, onSwitchWallet, onRemoveFromHistory,
}: SidebarHeaderProps) {
  const [dailyLimit, setDailyLimit] = useState<number | null>(null)
  const [dailySpent, setDailySpent] = useState<number | null>(null)
  const [dailyRemaining, setDailyRemaining] = useState<number | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [newLimit, setNewLimit] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const fetchDailyLimits = useCallback(async () => {
    if (!address || typeof window === 'undefined' || !window.ethereum) return
    try {
      const debitAddr = getDebitAddress()
      if (!debitAddr) return
      const provider = new ethers.BrowserProvider(window.ethereum)
      const debit = new ethers.Contract(debitAddr, DebitABI.abi, provider)
      const [limit, spent, remaining] = await Promise.all([
        debit.getEffectiveDailyLimit(address),
        debit.getDailySpent(address),
        debit.getDailyRemaining(address),
      ])
      setDailyLimit(parseFloat(ethers.formatUnits(limit, 8)))
      setDailySpent(parseFloat(ethers.formatUnits(spent, 8)))
      setDailyRemaining(parseFloat(ethers.formatUnits(remaining, 8)))
    } catch (err) {
      console.error('Failed to fetch daily limits:', err)
    }
  }, [address])

  useEffect(() => { fetchDailyLimits() }, [fetchDailyLimits])

  const handleSaveLimit = async () => {
    const val = parseFloat(newLimit)
    if (!val || val <= 0) { toast.error('Enter a valid limit'); return }
    setIsSaving(true)
    try {
      const debitAddr = getDebitAddress()
      if (!debitAddr || !window.ethereum) throw new Error('No Debit contract or wallet')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const debit = new ethers.Contract(debitAddr, DebitABI.abi, signer)
      const limitWei = ethers.parseUnits(val.toString(), 8)
      const tx = await debit.setDailyLimit(limitWei)
      toast.success(`TX sent: ${tx.hash.slice(0, 12)}...`)
      await tx.wait()
      toast.success('Daily limit updated')
      setIsEditing(false)
      setNewLimit('')
      fetchDailyLimits()
    } catch (err: any) {
      console.error(err)
      toast.error(err?.reason || err?.message || 'Failed to update limit')
    } finally {
      setIsSaving(false)
    }
  }

  const [addressHovered, setAddressHovered] = useState(false)
  const [showAccountsDropdown, setShowAccountsDropdown] = useState(false)
  const [showTokenCustomization, setShowTokenCustomization] = useState(false)
  const [tokenTab, setTokenTab] = useState<'token' | 'verify' | 'custom'>('token')
  const [customTokenData, setCustomTokenData] = useState('')
  const [copiedToken, setCopiedToken] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)

  // Get wallet type from localStorage
  const walletType = typeof window !== 'undefined' ? localStorage.getItem('wallet_type') || 'ecdsa' : 'ecdsa'

  // Copy full address/key
  const copyFullAddress = () => {
    navigator.clipboard.writeText(address)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
    toast.success('Full address copied!')
  }

  // Get key type badge color
  const getKeyTypeColor = (type: string) => {
    if (type === 'sr25519') return { bg: '#06b6d4', text: '#000', border: '#0891b2' }
    if (type === 'ecdsa') return { bg: '#f59e0b', text: '#000', border: '#d97706' }
    return { bg: '#10b981', text: '#000', border: '#059669' }
  }

  const spentRatio = dailyLimit && dailyLimit > 0 ? (dailySpent ?? 0) / dailyLimit : 0

  // Get token from localStorage
  const getStoredToken = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('wallet_token') || ''
    }
    return ''
  }

  const copyToken = () => {
    const token = getStoredToken()
    if (token) {
      navigator.clipboard.writeText(token)
      setCopiedToken(true)
      setTimeout(() => setCopiedToken(false), 2000)
      toast.success('Token copied!')
    } else {
      toast.error('No token available')
    }
  }

  // Decode JWT token
  const decodeToken = () => {
    try {
      const token = getStoredToken()
      if (!token) return null
      const parts = token.split('.')
      if (parts.length !== 3) return null
      const payload = JSON.parse(atob(parts[1]))
      return payload
    } catch (err) {
      console.error('Failed to decode token:', err)
      return null
    }
  }

  // Wallet mode colors
  const getWalletModeColor = (mode: string) => {
    const m = mode.toLowerCase()
    if (m.includes('metamask')) return { bg: '#f6851b', text: '#000', border: '#e2761b' }
    if (m.includes('subwallet')) return { bg: '#004bff', text: '#fff', border: '#0040d9' }
    if (m.includes('coinbase')) return { bg: '#0052ff', text: '#fff', border: '#0042cc' }
    if (m.includes('walletconnect')) return { bg: '#3b99fc', text: '#fff', border: '#2b89ec' }
    if (m.includes('phantom')) return { bg: '#ab9ff2', text: '#000', border: '#9b8fe2' }
    if (m.includes('rainbow')) return { bg: '#ff6b6b', text: '#fff', border: '#ff5b5b' }
    return { bg: '#10b981', text: '#000', border: '#059669' } // default green for web3
  }

  return (
    <>
      <div className="sticky top-0 z-10 backdrop-blur-md" style={{ backgroundColor: 'var(--bg-sidebar)' }}>
        {/* Compact top bar: status + close button */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-3 h-3 rounded-full flex-shrink-0 ${isTokenExpired ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}
                style={{ boxShadow: isTokenExpired ? '0 0 8px rgba(234,179,8,0.6)' : '0 0 8px rgba(34,197,94,0.5)' }}
              />
            </div>
            <button
              onClick={onClose}
              className="transition-colors p-1.5 rounded hover:bg-white/5"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Address section with wallet selector */}
          <div className="flex items-stretch gap-2">
            {/* Address box with wallet badge */}
            <div className="relative flex-1">
              <button
                onClick={copyAddress}
                onMouseEnter={() => setAddressHovered(true)}
                onMouseLeave={() => setAddressHovered(false)}
                className="w-full h-full flex items-center justify-between gap-3 px-4 border-2 transition-all"
                style={{
                  fontFamily: 'var(--font-digital), monospace',
                  backgroundColor: 'var(--bg-input)',
                  borderColor: copiedAddress ? 'var(--accent-success)' : 'var(--border-strong)',
                  minHeight: '52px',
                  borderRadius: '0px',
                  boxShadow: copiedAddress ? 'var(--card-shadow)' : 'none',
                }}
                title="Click to copy address"
              >
                <span
                  className={`text-lg font-digital tracking-wide font-bold`}
                  style={{
                    color: copiedAddress ? 'var(--accent-success)' : 'var(--text-primary)',
                  }}
                >
                  {copiedAddress ? 'COPIED' : shortAddress}
                </span>

                <div className="flex items-center gap-2">
                  <span
                    className="text-sm font-digital uppercase tracking-wider py-1.5 border-2 font-bold text-center"
                    style={{
                      backgroundColor: getKeyTypeColor(walletType).bg,
                      color: getKeyTypeColor(walletType).text,
                      borderColor: getKeyTypeColor(walletType).border,
                      minWidth: '90px',
                    }}
                  >
                    {walletType.toUpperCase()}
                  </span>
                  <span
                    className="text-sm font-digital uppercase tracking-wider py-1.5 border-2 font-bold text-center"
                    style={{
                      backgroundColor: getWalletModeColor(walletMode || 'web3').bg,
                      color: getWalletModeColor(walletMode || 'web3').text,
                      borderColor: getWalletModeColor(walletMode || 'web3').border,
                      minWidth: '110px',
                    }}
                  >
                    {walletMode || 'web3'}
                  </span>
                </div>
              </button>

              {/* Accounts dropdown */}
              <AnimatePresence>
                {showAccountsDropdown && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full left-0 right-0 mt-2 border-4 overflow-hidden z-50"
                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-strong)' }}
                  >
                    <div className="p-3 max-h-60 overflow-y-auto">
                      {/* Previous wallets */}
                      {walletHistory
                        .filter(w => w.address.toLowerCase() !== address.toLowerCase())
                        .sort((a, b) => b.lastUsed - a.lastUsed)
                        .map((wallet) => (
                          <button
                            key={wallet.address}
                            onClick={() => {
                              onSwitchWallet(wallet)
                              setShowAccountsDropdown(false)
                            }}
                            disabled={isSwitchingWallet}
                            className="w-full flex items-center justify-between gap-3 px-4 border-4 transition-all hover:opacity-80 mb-3 last:mb-0"
                            style={{
                              fontFamily: 'var(--font-digital), monospace',
                              backgroundColor: 'var(--bg-primary)',
                              borderColor: 'var(--border-strong)',
                              minHeight: '52px',
                            }}
                            title="Click to switch to this wallet"
                          >
                            <span className="text-lg font-digital font-bold tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                              {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                            </span>

                            <div className="flex items-center gap-2">
                              <span
                                className="text-sm font-digital uppercase tracking-wider py-1.5 border-2 font-bold text-center"
                                style={{
                                  backgroundColor: getKeyTypeColor(wallet.type || 'ecdsa').bg,
                                  color: getKeyTypeColor(wallet.type || 'ecdsa').text,
                                  borderColor: getKeyTypeColor(wallet.type || 'ecdsa').border,
                                  minWidth: '90px',
                                }}
                              >
                                {(wallet.type || 'ecdsa').toUpperCase()}
                              </span>
                              <span
                                className="text-sm font-digital uppercase tracking-wider py-1.5 border-2 font-bold text-center"
                                style={{
                                  backgroundColor: getWalletModeColor(wallet.mode).bg,
                                  color: getWalletModeColor(wallet.mode).text,
                                  borderColor: getWalletModeColor(wallet.mode).border,
                                  minWidth: '110px',
                                }}
                              >
                                {wallet.mode}
                              </span>
                            </div>
                          </button>
                        ))}
                      {walletHistory.filter(w => w.address.toLowerCase() !== address.toLowerCase()).length === 0 && (
                        <div className="text-center py-4 text-sm font-digital" style={{ color: 'var(--text-tertiary)' }}>
                          No previous wallets
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Dropdown toggle button */}
            <button
              onClick={() => setShowAccountsDropdown(!showAccountsDropdown)}
              className="flex items-center justify-center border-4 hover:opacity-80 transition-all flex-shrink-0"
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border-strong)',
                width: '52px',
                minHeight: '52px',
              }}
              title="Switch wallet"
            >
              <svg className={`w-5 h-5 transition-transform ${showAccountsDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text-tertiary)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Combined row: Session + Network + Credit + Signout */}
          <div className="flex items-center gap-2 mt-2">
            {/* Session token */}
            <div className="flex-1">
              <div
                className="flex items-center justify-between gap-2 px-3 py-2 border-2 transition-all cursor-pointer hover:border-opacity-100"
                style={{
                  fontFamily: 'var(--font-digital), monospace',
                  backgroundColor: 'var(--bg-input)',
                  borderColor: showTokenCustomization ? 'var(--border-strong)' : 'var(--border-color)',
                }}
                onClick={copyToken}
                title="Click to copy token"
              >
                <div className={`flex items-center gap-2 flex-1 transition-all text-sm font-digital tabular-nums ${
                  isTokenExpired ? 'text-red-400' : ''
                }`}
                  style={{ fontFamily: 'var(--font-digital), monospace', ...(!isTokenExpired ? { color: 'var(--text-tertiary)' } : {}) }}
                >
                  <ArrowPathIcon
                    className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRefreshToken()
                    }}
                    style={{ cursor: 'pointer' }}
                    title="Refresh token"
                  />
                  <span>{copiedToken ? 'TOKEN COPIED!' : `SESSION: ${tokenExpiry || getTokenExpiry()}`}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowTokenCustomization(!showTokenCustomization)
                  }}
                  className="p-1 hover:opacity-70 transition-opacity"
                  title="View token details"
                >
                  <svg className={`w-4 h-4 transition-transform ${showTokenCustomization ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text-tertiary)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Token details and customization panel */}
              <AnimatePresence>
                {showTokenCustomization && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full left-0 right-0 mt-2 border-2 overflow-hidden z-50"
                    style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-strong)' }}
                  >
                    {/* Tab buttons */}
                    <div className="flex border-b-2" style={{ borderColor: 'var(--border-color)' }}>
                      <button
                        onClick={() => setTokenTab('token')}
                        className="flex-1 px-3 py-2 font-digital text-xs uppercase font-bold transition-all"
                        style={{
                          backgroundColor: tokenTab === 'token' ? 'var(--bg-secondary)' : 'transparent',
                          borderRight: '2px solid var(--border-color)',
                          color: tokenTab === 'token' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        }}
                      >
                        TOKEN
                      </button>
                      <button
                        onClick={() => setTokenTab('verify')}
                        className="flex-1 px-3 py-2 font-digital text-xs uppercase font-bold transition-all"
                        style={{
                          backgroundColor: tokenTab === 'verify' ? 'var(--bg-secondary)' : 'transparent',
                          borderRight: '2px solid var(--border-color)',
                          color: tokenTab === 'verify' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        }}
                      >
                        VERIFY
                      </button>
                      <button
                        onClick={() => setTokenTab('custom')}
                        className="flex-1 px-3 py-2 font-digital text-xs uppercase font-bold transition-all"
                        style={{
                          backgroundColor: tokenTab === 'custom' ? 'var(--bg-secondary)' : 'transparent',
                          color: tokenTab === 'custom' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        }}
                      >
                        CUSTOM
                      </button>
                    </div>

                    <div className="p-3">
                      {/* Token Tab */}
                      {tokenTab === 'token' && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-xs font-digital uppercase tracking-wider font-bold" style={{ color: 'var(--text-tertiary)' }}>
                              Current Token
                            </div>
                            <button
                              onClick={copyToken}
                              className="px-2 py-1 border-2 font-digital text-xs uppercase font-bold transition-all hover:opacity-80"
                              style={{
                                backgroundColor: copiedToken ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                                borderColor: 'var(--border-strong)',
                                color: copiedToken ? '#4ade80' : 'var(--text-primary)',
                              }}
                            >
                              {copiedToken ? 'COPIED!' : 'COPY'}
                            </button>
                          </div>
                          <div
                            className="px-3 py-2 border-2 text-xs font-mono break-all"
                            style={{
                              fontFamily: 'IBM Plex Mono, monospace',
                              backgroundColor: 'var(--bg-input)',
                              borderColor: 'var(--border-color)',
                              color: 'var(--text-primary)',
                              maxHeight: '150px',
                              overflowY: 'auto',
                            }}
                          >
                            {getStoredToken() || 'No token available'}
                          </div>
                        </div>
                      )}

                      {/* Verify Tab */}
                      {tokenTab === 'verify' && (() => {
                        const decoded = decodeToken()
                        const currentToken = getStoredToken()
                        return (
                          <div>
                            <div className="text-xs font-digital uppercase tracking-wider mb-3 font-bold" style={{ color: 'var(--text-tertiary)' }}>
                              Token Verification
                            </div>
                            {decoded ? (
                              <div className="space-y-3">
                                {/* Address */}
                                {decoded.address && (
                                  <div>
                                    <div className="text-xs font-digital uppercase mb-1 font-bold" style={{ color: 'var(--text-tertiary)' }}>
                                      Address
                                    </div>
                                    <div
                                      className="px-3 py-2 border-2 text-sm font-mono break-all"
                                      style={{
                                        fontFamily: 'IBM Plex Mono, monospace',
                                        backgroundColor: 'var(--bg-input)',
                                        borderColor: 'var(--border-color)',
                                        color: '#4ade80',
                                      }}
                                    >
                                      {decoded.address}
                                    </div>
                                  </div>
                                )}

                                {/* Expiry */}
                                {decoded.exp && (
                                  <div>
                                    <div className="text-xs font-digital uppercase mb-1 font-bold" style={{ color: 'var(--text-tertiary)' }}>
                                      Expiry
                                    </div>
                                    <div
                                      className="px-3 py-2 border-2 text-sm font-mono"
                                      style={{
                                        fontFamily: 'IBM Plex Mono, monospace',
                                        backgroundColor: 'var(--bg-input)',
                                        borderColor: 'var(--border-color)',
                                        color: isTokenExpired ? '#ef4444' : '#4ade80',
                                      }}
                                    >
                                      {new Date(decoded.exp * 1000).toLocaleString()}
                                    </div>
                                  </div>
                                )}

                                {/* Issued At */}
                                {decoded.iat && (
                                  <div>
                                    <div className="text-xs font-digital uppercase mb-1 font-bold" style={{ color: 'var(--text-tertiary)' }}>
                                      Issued At
                                    </div>
                                    <div
                                      className="px-3 py-2 border-2 text-sm font-mono"
                                      style={{
                                        fontFamily: 'IBM Plex Mono, monospace',
                                        backgroundColor: 'var(--bg-input)',
                                        borderColor: 'var(--border-color)',
                                        color: 'var(--text-primary)',
                                      }}
                                    >
                                      {new Date(decoded.iat * 1000).toLocaleString()}
                                    </div>
                                  </div>
                                )}

                                {/* Full Payload */}
                                <div>
                                  <div className="text-xs font-digital uppercase mb-1 font-bold" style={{ color: 'var(--text-tertiary)' }}>
                                    Full Payload
                                  </div>
                                  <div
                                    className="px-3 py-2 border-2 text-xs font-mono break-all"
                                    style={{
                                      fontFamily: 'IBM Plex Mono, monospace',
                                      backgroundColor: 'var(--bg-input)',
                                      borderColor: 'var(--border-color)',
                                      color: 'var(--text-primary)',
                                      maxHeight: '150px',
                                      overflowY: 'auto',
                                    }}
                                  >
                                    {JSON.stringify(decoded, null, 2)}
                                  </div>
                                </div>
                              </div>
                            ) : currentToken ? (
                              <div>
                                <div className="text-xs font-digital uppercase tracking-wider mb-2 font-bold" style={{ color: 'var(--text-tertiary)' }}>
                                  Current Token (Not JWT Format)
                                </div>
                                <div
                                  className="px-3 py-2 border-2 text-xs font-mono break-all"
                                  style={{
                                    fontFamily: 'IBM Plex Mono, monospace',
                                    backgroundColor: 'var(--bg-input)',
                                    borderColor: 'var(--border-color)',
                                    color: 'var(--text-primary)',
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                  }}
                                >
                                  {currentToken}
                                </div>
                                <button
                                  onClick={copyToken}
                                  className="mt-3 w-full px-3 py-2 border-2 font-digital text-xs uppercase font-bold transition-all hover:opacity-80"
                                  style={{
                                    backgroundColor: copiedToken ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                                    borderColor: 'var(--border-strong)',
                                    color: copiedToken ? '#4ade80' : 'var(--text-primary)',
                                  }}
                                >
                                  {copiedToken ? 'COPIED!' : 'COPY TOKEN'}
                                </button>
                              </div>
                            ) : (
                              <div
                                className="px-3 py-6 border-2 text-center text-sm"
                                style={{
                                  backgroundColor: 'var(--bg-input)',
                                  borderColor: 'var(--border-color)',
                                  color: 'var(--text-tertiary)',
                                }}
                              >
                                No token available
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {/* Custom Tab */}
                      {tokenTab === 'custom' && (
                        <div>
                          <div className="text-xs font-digital uppercase tracking-wider mb-2 font-bold" style={{ color: 'var(--text-tertiary)' }}>
                            Custom Token Data
                          </div>
                          <textarea
                            value={customTokenData}
                            onChange={(e) => setCustomTokenData(e.target.value)}
                            placeholder='{"custom_field": "value", "api_key": "..."}'
                            className="w-full px-3 py-2 border-2 text-xs font-mono focus:outline-none min-h-[80px] resize-y"
                            style={{
                              fontFamily: 'IBM Plex Mono, monospace',
                              backgroundColor: 'var(--bg-input)',
                              borderColor: 'var(--border-color)',
                              color: 'var(--text-primary)',
                            }}
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => {
                                // TODO: Implement custom token generation with customTokenData
                                toast.info('Custom token generation with additional data')
                                handleRefreshToken()
                              }}
                              className="flex-1 px-3 py-2 border-2 font-digital text-xs uppercase font-bold transition-all hover:opacity-80"
                              style={{
                                backgroundColor: 'var(--bg-secondary)',
                                borderColor: 'var(--border-strong)',
                                color: 'var(--text-primary)',
                              }}
                            >
                              Generate with Data
                            </button>
                            <button
                              onClick={() => {
                                setCustomTokenData('')
                                setShowTokenCustomization(false)
                              }}
                              className="px-3 py-2 border-2 font-digital text-xs uppercase font-bold transition-all hover:opacity-80"
                              style={{
                                backgroundColor: 'var(--bg-primary)',
                                borderColor: 'var(--border-color)',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Network selector inline */}
            <div className="flex-shrink-0" style={{ minWidth: '180px' }}>
              <NetworkSelector />
            </div>

            {/* Credit display */}
            <div
              className="flex items-center justify-center px-4 border-2 font-digital font-bold tabular-nums tracking-tight text-lg flex-shrink-0"
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: marketCredit > 0 ? 'var(--accent-success)' : 'var(--accent-error)',
                minHeight: '40px',
                borderRadius: '0px',
                color: marketCredit > 0 ? 'var(--accent-success)' : 'var(--accent-error)',
              }}
              title="Market Credit"
            >
              ${marketCredit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>

            {/* Signout button */}
            <button
              onClick={handleSignOut}
              className="flex items-center justify-center border-4 text-red-500 hover:text-red-400 transition-colors hover:bg-red-500/10 flex-shrink-0"
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border-strong)',
                width: '40px',
                minHeight: '40px',
              }}
              title="Sign out"
            >
              <ArrowRightStartOnRectangleIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Hero section: daily limit bar only */}
        <div className="px-4 pb-3 relative">

          {/* Daily limit bar - sleek inline */}
          {dailyLimit !== null && (
            <div>
              {isEditing ? (
                <div className="flex items-center gap-2 rounded-md px-3 py-2" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                  <span className="text-sm font-digital uppercase tracking-wider flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>Limit</span>
                  <span className="text-amber-400 text-base font-bold">$</span>
                  <input
                    type="number"
                    value={newLimit}
                    onChange={(e) => setNewLimit(e.target.value)}
                    className="flex-1 border border-amber-500/30 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:border-amber-400/60"
                    style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                    placeholder="1000"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLimit(); if (e.key === 'Escape') setIsEditing(false) }}
                  />
                  <button
                    onClick={handleSaveLimit}
                    disabled={isSaving}
                    className="p-1 text-amber-400 hover:text-amber-300 transition-all disabled:opacity-40"
                  >
                    {isSaving ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="p-1 transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  className="group flex items-center gap-3 cursor-pointer"
                  onClick={() => { setIsEditing(true); setNewLimit(dailyLimit.toFixed(2)) }}
                  title="Click to edit daily limit"
                >
                  <div className="flex-1 h-3 overflow-hidden border" style={{
                    backgroundColor: 'var(--bg-primary)',
                    borderColor: 'var(--border-color)',
                    borderRadius: '0px',
                  }}>
                    <div
                      className="h-full transition-all duration-700 ease-out"
                      style={{
                        width: `${Math.min(100, spentRatio * 100)}%`,
                        backgroundColor: spentRatio > 0.9
                          ? 'var(--accent-error)'
                          : spentRatio > 0.7
                          ? 'var(--accent-warning)'
                          : 'var(--accent-success)',
                      }}
                    />
                  </div>
                  <span className="text-sm font-digital tabular-nums flex-shrink-0 transition-opacity" style={{
                    color: spentRatio > 0.9 ? 'var(--accent-error)' : spentRatio > 0.7 ? 'var(--accent-warning)' : 'var(--accent-success)',
                    fontFamily: 'var(--font-digital), monospace',
                  }}>
                    ${dailyRemaining !== null ? dailyRemaining.toFixed(0) : '—'}<span style={{ opacity: 0.6 }}>/{dailyLimit.toFixed(0)}</span>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mx-4" style={{ borderBottom: '1px solid var(--border-color)' }} />
      </div>

      <AnimatePresence>
        {isTokenExpired && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mx-4 mt-3 px-4 py-3 border border-yellow-500/40 bg-yellow-500/5 rounded-lg overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-yellow-400 text-base font-digital uppercase tracking-wider">
                TOKEN EXPIRED
              </span>
              <button
                onClick={handleRefreshToken}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-2 bg-yellow-500/15 hover:bg-yellow-500/25 border border-yellow-500/30 text-yellow-400 text-sm font-digital uppercase transition-all rounded-md disabled:opacity-50"
              >
                <ArrowPathIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                REFRESH
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
