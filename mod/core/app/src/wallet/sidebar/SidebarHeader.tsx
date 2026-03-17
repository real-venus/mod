"use client";

import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { ArrowPathIcon, ArrowRightStartOnRectangleIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-toastify'
import { NetworkSelector } from '@/network/NetworkSelector'
import DebitABI from '@/contracts/market/debit/Debit.sol/Debit.json'
import modConfig from '@/config.json'
import { Auth } from '@/client/auth'

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
  const [tokenTab, setTokenTab] = useState<'token' | 'verify'>('token')
  const [showDecoded, setShowDecoded] = useState(false)
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; message: string } | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)

  // Get wallet type from localStorage (reactive)
  const [walletType, setWalletType] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('wallet_type') || 'ecdsa' : 'ecdsa'
  )

  // Key type → wallet mode mapping
  const KEY_TYPE_CYCLE: { type: string; mode: string; label: string }[] = [
    { type: 'ethereum', mode: 'metamask', label: 'ETHEREUM' },
    { type: 'solana', mode: 'phantom', label: 'SOLANA' },
    { type: 'ecdsa', mode: 'local', label: 'ECDSA' },
    { type: 'sr25519', mode: 'subwallet', label: 'SR25519' },
  ]

  // Track wallet mode locally so it updates when cycling key type
  const [localWalletMode, setLocalWalletMode] = useState(walletMode)
  useEffect(() => { setLocalWalletMode(walletMode) }, [walletMode])

  const cycleKeyType = () => {
    const currentIdx = KEY_TYPE_CYCLE.findIndex(k => k.type === walletType)
    const nextIdx = (currentIdx + 1) % KEY_TYPE_CYCLE.length
    const next = KEY_TYPE_CYCLE[nextIdx]
    localStorage.setItem('wallet_type', next.type)
    localStorage.setItem('wallet_mode', next.mode)
    setWalletType(next.type)
    setLocalWalletMode(next.mode)
    toast.success(`Switched to ${next.label} / ${next.mode.toUpperCase()}`)
  }

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
    if (type === 'ethereum') return { bg: '#627eea', text: '#fff', border: '#4c64c8' }
    if (type === 'solana') return { bg: '#ab9ff2', text: '#000', border: '#9b8fe2' }
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

  // Decode token (supports both JWT and Auth token formats)
  const decodeToken = () => {
    try {
      const token = getStoredToken()
      if (!token) return null
      // Try JWT format first
      const parts = token.split('.')
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(atob(parts[1]))
          return { format: 'jwt', payload }
        } catch {}
      }
      // Try Auth token format (base64url encoded JSON)
      try {
        const auth = new Auth()
        const authData = auth.token2data(token)
        return { format: 'auth', payload: authData }
      } catch {}
      return null
    } catch (err) {
      console.error('Failed to decode token:', err)
      return null
    }
  }

  // Verify token cryptographically
  const verifyToken = async () => {
    setIsVerifying(true)
    setVerifyResult(null)
    try {
      const token = getStoredToken()
      if (!token) {
        setVerifyResult({ valid: false, message: 'No token found' })
        return
      }
      const auth = new Auth()
      const authData = auth.token2data(token)

      // Check expiry
      const tokenTime = parseFloat(authData.time)
      const now = Date.now() / 1000
      const age = now - tokenTime

      if (age > 3600) {
        setVerifyResult({ valid: false, message: `Token expired (${Math.floor(age / 60)}m old)` })
        return
      }

      // Verify signature
      const valid = auth.verify({ token })
      if (valid) {
        setVerifyResult({ valid: true, message: `Valid signature from ${authData.key.slice(0, 8)}...${authData.key.slice(-4)}` })
      } else {
        setVerifyResult({ valid: false, message: 'Invalid signature' })
      }
    } catch (err: any) {
      setVerifyResult({ valid: false, message: err?.message || 'Verification failed' })
    } finally {
      setIsVerifying(false)
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
        {/* Compact top bar: address + token merged into one line */}
        <div className="px-4 pt-3 pb-2">
          {/* Merged address + token row */}
          <div
            className="flex items-center gap-1.5 border-2 relative overflow-hidden"
            style={{
              minHeight: '44px',
              fontFamily: 'var(--font-digital), monospace',
              backgroundColor: isTokenExpired ? 'rgba(234, 179, 8, 0.06)' : 'var(--bg-input)',
              borderColor: isTokenExpired ? '#eab30850' : 'var(--border-strong)',
              boxShadow: isTokenExpired
                ? '0 0 20px rgba(234, 179, 8, 0.08), inset 0 0 30px rgba(234, 179, 8, 0.03)'
                : 'none',
            }}
          >
            {/* Animated glow line at bottom */}
            <div
              className="absolute bottom-0 left-0 h-px"
              style={{
                width: '100%',
                background: isTokenExpired
                  ? 'linear-gradient(90deg, transparent, #eab308, transparent)'
                  : 'linear-gradient(90deg, transparent, #22c55e, transparent)',
                animation: 'pulse 2s ease-in-out infinite',
                opacity: 0.4,
              }}
            />

            {/* Address - click to copy */}
            <button
              onClick={copyAddress}
              className="flex items-center gap-2 px-3 h-full transition-all hover:opacity-80 flex-shrink-0"
              title="Copy address"
            >
              <span
                className="text-2xl font-digital tracking-wide font-bold"
                style={{ color: copiedAddress ? 'var(--accent-success, #22c55e)' : 'var(--text-primary)' }}
              >
                {copiedAddress ? 'COPIED' : shortAddress}
              </span>
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: copiedAddress ? 'var(--accent-success, #22c55e)' : 'var(--text-tertiary)' }}>
                {copiedAddress ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                )}
              </svg>
            </button>

            {/* Separator */}
            <div className="w-px h-5 flex-shrink-0" style={{ backgroundColor: 'var(--border-color)' }} />

            {/* Token expiry / refresh */}
            <button
              onClick={handleRefreshToken}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-2 py-1 font-digital text-sm uppercase font-bold tracking-wide transition-all hover:scale-105 active:scale-95 disabled:opacity-50 flex-shrink-0"
              style={{
                color: isTokenExpired ? '#eab308' : '#22c55e',
                textShadow: isTokenExpired ? '0 0 8px rgba(234, 179, 8, 0.5)' : '0 0 8px rgba(34, 197, 94, 0.5)',
              }}
              title="Refresh session token"
            >
              <ArrowPathIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="tabular-nums">{copiedToken ? 'COPIED!' : (tokenExpiry || getTokenExpiry())}</span>
            </button>

            {/* Dot separator */}
            <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-tertiary)', opacity: 0.4 }} />

            {/* Token copy */}
            <button
              onClick={copyToken}
              className="flex items-center gap-1 px-1 py-1 font-digital text-xs uppercase font-bold tracking-wider transition-all hover:opacity-80 flex-shrink-0"
              style={{ color: copiedToken ? '#4ade80' : 'var(--text-tertiary)' }}
              title="Copy token"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {copiedToken ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                )}
              </svg>
              <span>TOKEN</span>
            </button>

            {/* Dot separator */}
            <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--text-tertiary)', opacity: 0.4 }} />

            {/* Details toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowTokenCustomization(!showTokenCustomization)
              }}
              className="flex items-center gap-1 px-1 py-1 font-digital text-xs uppercase font-bold tracking-wider transition-all hover:opacity-80 flex-shrink-0"
              style={{ color: showTokenCustomization ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
              title="View token details"
            >
              <svg className={`w-3 h-3 transition-transform ${showTokenCustomization ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              <span>DETAILS</span>
            </button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Daily limit inline */}
            {dailyLimit !== null && !isEditing && (
              <button
                onClick={() => { setIsEditing(true); setNewLimit(dailyLimit.toFixed(2)) }}
                className="flex items-center gap-1 px-2 py-1 font-digital text-xs font-bold tracking-wide transition-all hover:opacity-80 flex-shrink-0"
                style={{
                  color: spentRatio > 0.9 ? '#ef4444' : spentRatio > 0.7 ? '#eab308' : '#22c55e',
                  textShadow: spentRatio > 0.9 ? '0 0 6px rgba(239, 68, 68, 0.4)' : spentRatio > 0.7 ? '0 0 6px rgba(234, 179, 8, 0.4)' : '0 0 6px rgba(34, 197, 94, 0.3)',
                  fontFamily: 'var(--font-digital), monospace',
                }}
                title="Click to edit daily limit"
              >
                <span className="tabular-nums">
                  ${dailyRemaining !== null ? dailyRemaining.toFixed(0) : '—'}<span style={{ opacity: 0.5 }}>/{dailyLimit.toFixed(0)}</span>
                </span>
              </button>
            )}

            {/* Close button */}
            <button
              onClick={onClose}
              className="flex items-center justify-center hover:bg-white/10 transition-all flex-shrink-0 border-l-2 self-stretch px-3"
              style={{
                borderColor: 'var(--border-color)',
              }}
              title="Close"
            >
              <XMarkIcon className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            </button>
          </div>

          {/* Network selector */}
          <div className="mt-2">
            <NetworkSelector />
          </div>

          {/* Token details and customization panel */}
          <AnimatePresence>
            {showTokenCustomization && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-2 border-2 overflow-hidden z-50"
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
                    onClick={() => { setTokenTab('verify'); setVerifyResult(null) }}
                    className="flex-1 px-3 py-2 font-digital text-xs uppercase font-bold transition-all"
                    style={{
                      backgroundColor: tokenTab === 'verify' ? 'var(--bg-secondary)' : 'transparent',
                      color: tokenTab === 'verify' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    }}
                  >
                    VERIFY
                  </button>
                </div>

                <div className="p-3">
                  {/* Token Tab - merged token + generate */}
                  {tokenTab === 'token' && (() => {
                    const decoded = decodeToken()
                    const currentToken = getStoredToken()
                    return (
                      <div>
                        {/* Token display - click to copy */}
                        <div
                          className="px-3 py-2 border-2 text-xs font-mono break-all cursor-pointer transition-all hover:border-opacity-100"
                          style={{
                            fontFamily: 'IBM Plex Mono, monospace',
                            backgroundColor: 'var(--bg-input)',
                            borderColor: copiedToken ? '#4ade80' : 'var(--border-color)',
                            color: copiedToken ? '#4ade80' : 'var(--text-primary)',
                            maxHeight: showDecoded ? 'none' : '120px',
                            overflowY: showDecoded ? 'visible' : 'auto',
                          }}
                          onClick={copyToken}
                          title="Click to copy token"
                        >
                          {copiedToken ? 'COPIED!' : (
                            showDecoded && decoded ? (
                              <pre className="whitespace-pre-wrap text-xs" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                                {JSON.stringify(decoded.payload, null, 2)}
                              </pre>
                            ) : (
                              currentToken || 'No token available'
                            )
                          )}
                        </div>

                        {/* Controls row */}
                        <div className="flex items-center gap-2 mt-2">
                          {/* JSON toggle */}
                          <button
                            onClick={() => setShowDecoded(!showDecoded)}
                            className="flex items-center gap-1.5 px-2 py-1.5 border-2 font-digital text-xs uppercase font-bold transition-all hover:opacity-80"
                            style={{
                              backgroundColor: showDecoded ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                              borderColor: showDecoded ? 'var(--text-primary)' : 'var(--border-color)',
                              color: showDecoded ? 'var(--text-primary)' : 'var(--text-tertiary)',
                            }}
                          >
                            {showDecoded ? '{ }' : 'RAW'}
                            <span style={{ fontSize: '9px', opacity: 0.7 }}>{showDecoded ? 'JSON' : 'BASE64'}</span>
                          </button>

                          <div className="flex-1" />

                          {/* Generate / Refresh */}
                          <button
                            onClick={handleRefreshToken}
                            disabled={isRefreshing}
                            className="flex items-center gap-1.5 px-2 py-1.5 border-2 font-digital text-xs uppercase font-bold transition-all hover:opacity-80 disabled:opacity-50"
                            style={{
                              backgroundColor: 'rgba(34, 197, 94, 0.1)',
                              borderColor: '#22c55e',
                              color: '#22c55e',
                            }}
                          >
                            <ArrowPathIcon className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                            GENERATE
                          </button>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Verify Tab - actual cryptographic verification */}
                  {tokenTab === 'verify' && (() => {
                    const decoded = decodeToken()
                    return (
                      <div>
                        {/* Verify button */}
                        <button
                          onClick={verifyToken}
                          disabled={isVerifying || !getStoredToken()}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border-2 font-digital text-sm uppercase font-bold tracking-wide transition-all hover:opacity-80 disabled:opacity-50 mb-3"
                          style={{
                            backgroundColor: verifyResult
                              ? verifyResult.valid ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'
                              : 'var(--bg-secondary)',
                            borderColor: verifyResult
                              ? verifyResult.valid ? '#22c55e' : '#ef4444'
                              : 'var(--border-strong)',
                            color: verifyResult
                              ? verifyResult.valid ? '#4ade80' : '#f87171'
                              : 'var(--text-primary)',
                          }}
                        >
                          {isVerifying ? (
                            <><ArrowPathIcon className="w-4 h-4 animate-spin" /> VERIFYING...</>
                          ) : verifyResult ? (
                            <>{verifyResult.valid ? <CheckIcon className="w-4 h-4" /> : <XMarkIcon className="w-4 h-4" />} {verifyResult.message}</>
                          ) : (
                            <>VERIFY SIGNATURE</>
                          )}
                        </button>

                        {/* Decoded payload */}
                        {decoded && (
                          <div className="space-y-2">
                            {Object.entries(decoded.payload).map(([key, value]) => (
                              <div key={key} className="flex items-start gap-2">
                                <span className="text-xs font-digital uppercase font-bold flex-shrink-0 pt-0.5" style={{ color: 'var(--text-tertiary)', minWidth: '70px' }}>
                                  {key}
                                </span>
                                <div
                                  className="flex-1 px-2 py-1 border text-xs font-mono break-all cursor-pointer hover:opacity-80 transition-opacity"
                                  style={{
                                    fontFamily: 'IBM Plex Mono, monospace',
                                    backgroundColor: 'var(--bg-input)',
                                    borderColor: 'var(--border-color)',
                                    color: key === 'key' || key === 'address' ? '#4ade80'
                                      : key === 'signature' ? '#f59e0b'
                                      : 'var(--text-primary)',
                                  }}
                                  onClick={() => {
                                    const text = typeof value === 'string' ? value : JSON.stringify(value)
                                    navigator.clipboard.writeText(text)
                                    toast.success(`${key} copied!`)
                                  }}
                                  title={`Click to copy ${key}`}
                                >
                                  {typeof value === 'string'
                                    ? (key === 'time' ? `${value} (${new Date(parseFloat(value) * 1000).toLocaleString()})` : value)
                                    : JSON.stringify(value)}
                                </div>
                              </div>
                            ))}
                            <div className="text-xs font-digital uppercase pt-1" style={{ color: 'var(--text-tertiary)', opacity: 0.6 }}>
                              Format: {decoded.format === 'jwt' ? 'JWT' : 'Auth (base64url)'}
                            </div>
                          </div>
                        )}

                        {!decoded && getStoredToken() && (
                          <div
                            className="px-3 py-4 border-2 text-center text-sm font-digital"
                            style={{
                              backgroundColor: 'var(--bg-input)',
                              borderColor: 'var(--border-color)',
                              color: 'var(--text-tertiary)',
                            }}
                          >
                            Could not decode token
                          </div>
                        )}

                        {!getStoredToken() && (
                          <div
                            className="px-3 py-4 border-2 text-center text-sm font-digital"
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
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Edit daily limit inline */}
        {isEditing && dailyLimit !== null && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: 'var(--bg-input)', border: '2px solid var(--border-color)' }}>
              <span className="text-sm font-digital uppercase tracking-wider flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>Limit</span>
              <span className="text-amber-400 text-base font-bold">$</span>
              <input
                type="number"
                value={newLimit}
                onChange={(e) => setNewLimit(e.target.value)}
                className="flex-1 border border-amber-500/30 px-2 py-1 text-sm font-mono focus:outline-none focus:border-amber-400/60"
                style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', borderRadius: '0px' }}
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
          </div>
        )}

        <div className="mx-4" style={{ borderBottom: '1px solid var(--border-color)' }} />
      </div>

    </>
  )
}
