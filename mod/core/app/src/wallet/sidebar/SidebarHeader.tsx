"use client";

import { useState, useEffect, useCallback, useRef } from 'react'
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

  const [showKeyTypeDropdown, setShowKeyTypeDropdown] = useState(false)
  const keyTypeDropdownRef = useRef<HTMLDivElement>(null)
  const [showTokenCustomization, setShowTokenCustomization] = useState(false)
  const [tokenTab, setTokenTab] = useState<'token' | 'verify'>('token')
  const [showDecoded, setShowDecoded] = useState(false)
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; message: string } | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)

  const [walletType, setWalletType] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('wallet_type') || 'ecdsa' : 'ecdsa'
  )

  const KEY_TYPE_CYCLE: { type: string; mode: string; label: string }[] = [
    { type: 'ethereum', mode: 'metamask', label: 'ETH' },
    { type: 'solana', mode: 'phantom', label: 'SOL' },
    { type: 'ecdsa', mode: 'local', label: 'ECDSA' },
    { type: 'sr25519', mode: 'subwallet', label: 'SR25' },
  ]

  const [localWalletMode, setLocalWalletMode] = useState(walletMode)
  useEffect(() => { setLocalWalletMode(walletMode) }, [walletMode])

  const selectKeyType = (keyType: typeof KEY_TYPE_CYCLE[number]) => {
    localStorage.setItem('wallet_type', keyType.type)
    localStorage.setItem('wallet_mode', keyType.mode)
    setWalletType(keyType.type)
    setLocalWalletMode(keyType.mode)
    setShowKeyTypeDropdown(false)
    toast.success(`Switched to ${keyType.label}`)
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (keyTypeDropdownRef.current && !keyTypeDropdownRef.current.contains(e.target as Node)) {
        setShowKeyTypeDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getKeyTypeColor = (type: string) => {
    if (type === 'sr25519') return '#06b6d4'
    if (type === 'ecdsa') return '#f59e0b'
    if (type === 'ethereum') return '#627eea'
    if (type === 'solana') return '#9945ff'
    return '#10b981'
  }

  const spentRatio = dailyLimit && dailyLimit > 0 ? (dailySpent ?? 0) / dailyLimit : 0

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

  const decodeToken = () => {
    try {
      const token = getStoredToken()
      if (!token) return null
      const parts = token.split('.')
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(atob(parts[1]))
          return { format: 'jwt', payload }
        } catch {}
      }
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
      const tokenTime = parseFloat(authData.time)
      const now = Date.now() / 1000
      const age = now - tokenTime
      if (age > 3600) {
        setVerifyResult({ valid: false, message: `Token expired (${Math.floor(age / 60)}m old)` })
        return
      }
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

  const keyColor = getKeyTypeColor(walletType)
  const keyLabel = KEY_TYPE_CYCLE.find(k => k.type === walletType)?.label || walletType.toUpperCase()

  return (
    <>
      <div className="sticky top-0 z-10 backdrop-blur-md" style={{ backgroundColor: 'var(--bg-sidebar)' }}>
        <div className="px-3 pt-3 pb-2">
          {/* Single unified bar */}
          <div
            className="flex items-center gap-0"
            style={{
              height: '42px',
              fontFamily: 'var(--font-digital), monospace',
              backgroundColor: 'var(--bg-input)',
              border: `1px solid ${isTokenExpired ? 'rgba(234, 179, 8, 0.25)' : 'var(--border-color)'}`,
              borderRadius: '12px',
              overflow: 'visible',
              position: 'relative',
            }}
          >
            {/* Key type pill */}
            <div className="relative flex-shrink-0" ref={keyTypeDropdownRef}>
              <button
                onClick={() => setShowKeyTypeDropdown(!showKeyTypeDropdown)}
                className="flex items-center gap-1.5 h-[42px] px-3 transition-all hover:opacity-80 active:scale-[0.98]"
                style={{ color: keyColor }}
                title="Select key type"
              >
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  backgroundColor: keyColor,
                  boxShadow: `0 0 8px ${keyColor}60`,
                }} />
                <span className="text-[11px] font-bold tracking-wider">{keyLabel}</span>
                <svg className={`w-2.5 h-2.5 opacity-40 transition-transform ${showKeyTypeDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <AnimatePresence>
                {showKeyTypeDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.96 }}
                    transition={{ duration: 0.12 }}
                    className="absolute left-0 top-full mt-1.5 z-[200] overflow-hidden"
                    style={{
                      minWidth: '160px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    }}
                  >
                    <div className="py-1">
                      {KEY_TYPE_CYCLE.map((kt) => {
                        const c = getKeyTypeColor(kt.type)
                        const isActive = kt.type === walletType
                        return (
                          <button
                            key={kt.type}
                            onClick={() => selectKeyType(kt)}
                            className="flex items-center gap-2 w-full px-3 py-2 transition-all text-left"
                            style={{
                              backgroundColor: isActive ? `${c}12` : 'transparent',
                              fontFamily: 'var(--font-digital), monospace',
                            }}
                            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--hover-bg)' }}
                            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = isActive ? `${c}12` : 'transparent' }}
                          >
                            <span style={{
                              width: '6px', height: '6px', borderRadius: '50%',
                              backgroundColor: c,
                              boxShadow: isActive ? `0 0 6px ${c}80` : 'none',
                            }} />
                            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: isActive ? c : 'var(--text-secondary)' }}>
                              {kt.label}
                            </span>
                            <span className="flex-1" />
                            {isActive && (
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Separator */}
            <div className="w-px h-5 flex-shrink-0" style={{ backgroundColor: 'var(--border-color)' }} />

            {/* Address */}
            <button
              onClick={copyAddress}
              className="flex items-center gap-1.5 px-2.5 h-full transition-all hover:opacity-70 flex-shrink-0"
              title="Copy address"
            >
              <span
                className="text-sm font-bold tracking-wider"
                style={{ color: copiedAddress ? '#4ade80' : 'var(--text-primary)', fontFamily: 'var(--font-digital), monospace' }}
              >
                {copiedAddress ? 'COPIED' : shortAddress}
              </span>
              <svg className="w-3 h-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {copiedAddress ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                )}
              </svg>
            </button>

            {/* Spacer */}
            <div className="flex-1 min-w-0" />

            {/* Right actions */}
            <div className="flex items-center gap-0.5 pr-1 flex-shrink-0">
              {/* Token refresh + timer */}
              <button
                onClick={handleRefreshToken}
                disabled={isRefreshing}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold tracking-wide transition-all hover:opacity-70 active:scale-95 disabled:opacity-40"
                style={{
                  color: isTokenExpired ? '#eab308' : '#4ade80',
                  borderRadius: '6px',
                  fontFamily: 'var(--font-digital), monospace',
                }}
                title="Refresh token"
              >
                <ArrowPathIcon className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="tabular-nums">{tokenExpiry || getTokenExpiry()}</span>
              </button>

              {/* Separator */}
              <div className="w-px h-4 flex-shrink-0" style={{ backgroundColor: 'var(--border-color)' }} />

              {/* Token copy */}
              <button
                onClick={copyToken}
                className="flex items-center gap-1 px-1.5 py-1 text-[10px] font-bold tracking-wider transition-all hover:opacity-70"
                style={{
                  color: copiedToken ? '#4ade80' : 'var(--text-tertiary)',
                  borderRadius: '6px',
                  fontFamily: 'var(--font-digital), monospace',
                }}
                title="Copy token"
              >
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {copiedToken ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  )}
                </svg>
                <span>TKN</span>
              </button>

              {/* Details toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); setShowTokenCustomization(!showTokenCustomization) }}
                className="flex items-center justify-center w-6 h-6 transition-all hover:opacity-70"
                style={{
                  color: showTokenCustomization ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  borderRadius: '5px',
                }}
                title="Details"
              >
                <svg className={`w-3 h-3 transition-transform ${showTokenCustomization ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Sign out */}
              <button
                onClick={handleSignOut}
                className="flex items-center justify-center w-6 h-6 transition-all hover:opacity-70"
                style={{ color: 'var(--text-tertiary)', borderRadius: '5px' }}
                title="Sign out"
              >
                <ArrowRightStartOnRectangleIcon className="w-3.5 h-3.5" />
              </button>

              {/* Close */}
              <button
                onClick={onClose}
                className="flex items-center justify-center w-6 h-6 transition-all hover:opacity-70"
                style={{ color: 'var(--text-tertiary)', borderRadius: '5px' }}
                title="Close"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Second row: Network + daily limit — compressed into one line */}
          <div className="flex items-center gap-2 mt-1.5 px-1">
            <NetworkSelector inline />

            <div className="flex-1" />

            {/* Daily limit inline */}
            {dailyLimit !== null && !isEditing && (
              <button
                onClick={() => { setIsEditing(true); setNewLimit(dailyLimit.toFixed(2)) }}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold tracking-wide transition-all hover:opacity-70"
                style={{
                  color: spentRatio > 0.9 ? '#ef4444' : spentRatio > 0.7 ? '#eab308' : '#4ade80',
                  backgroundColor: spentRatio > 0.9 ? 'rgba(239, 68, 68, 0.06)' : spentRatio > 0.7 ? 'rgba(234, 179, 8, 0.06)' : 'rgba(74, 222, 128, 0.06)',
                  borderRadius: '6px',
                  fontFamily: 'var(--font-digital), monospace',
                }}
                title="Click to edit daily limit"
              >
                <span className="tabular-nums">
                  ${dailyRemaining !== null ? dailyRemaining.toFixed(0) : '—'}<span style={{ opacity: 0.35 }}>/{dailyLimit.toFixed(0)}</span>
                </span>
              </button>
            )}
          </div>

          {/* Token details panel */}
          <AnimatePresence>
            {showTokenCustomization && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-1.5 overflow-hidden z-50"
                style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '10px' }}
              >
                <div className="flex border-b" style={{ borderColor: 'var(--border-color)' }}>
                  <button
                    onClick={() => setTokenTab('token')}
                    className="flex-1 px-3 py-2 font-digital text-[10px] uppercase font-bold transition-all"
                    style={{
                      backgroundColor: tokenTab === 'token' ? 'var(--bg-secondary)' : 'transparent',
                      borderRight: '1px solid var(--border-color)',
                      color: tokenTab === 'token' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    }}
                  >
                    TOKEN
                  </button>
                  <button
                    onClick={() => { setTokenTab('verify'); setVerifyResult(null) }}
                    className="flex-1 px-3 py-2 font-digital text-[10px] uppercase font-bold transition-all"
                    style={{
                      backgroundColor: tokenTab === 'verify' ? 'var(--bg-secondary)' : 'transparent',
                      color: tokenTab === 'verify' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    }}
                  >
                    VERIFY
                  </button>
                </div>

                <div className="p-3">
                  {tokenTab === 'token' && (() => {
                    const decoded = decodeToken()
                    const currentToken = getStoredToken()
                    return (
                      <div>
                        <div
                          className="px-3 py-2 text-xs font-mono break-all cursor-pointer transition-all hover:border-opacity-100"
                          style={{
                            fontFamily: 'IBM Plex Mono, monospace',
                            backgroundColor: 'var(--bg-input)',
                            border: `1px solid ${copiedToken ? '#4ade80' : 'var(--border-color)'}`,
                            borderRadius: '8px',
                            color: copiedToken ? '#4ade80' : 'var(--text-primary)',
                            maxHeight: showDecoded ? 'none' : '100px',
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

                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => setShowDecoded(!showDecoded)}
                            className="flex items-center gap-1.5 px-2 py-1 font-digital text-[10px] uppercase font-bold transition-all hover:opacity-80"
                            style={{
                              backgroundColor: showDecoded ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                              border: `1px solid ${showDecoded ? 'var(--text-primary)' : 'var(--border-color)'}`,
                              borderRadius: '6px',
                              color: showDecoded ? 'var(--text-primary)' : 'var(--text-tertiary)',
                            }}
                          >
                            {showDecoded ? '{ }' : 'RAW'}
                            <span style={{ fontSize: '8px', opacity: 0.7 }}>{showDecoded ? 'JSON' : 'BASE64'}</span>
                          </button>

                          <div className="flex-1" />

                          <button
                            onClick={handleRefreshToken}
                            disabled={isRefreshing}
                            className="flex items-center gap-1.5 px-2 py-1 font-digital text-[10px] uppercase font-bold transition-all hover:opacity-80 disabled:opacity-50"
                            style={{
                              backgroundColor: 'rgba(34, 197, 94, 0.1)',
                              border: '1px solid rgba(34, 197, 94, 0.3)',
                              borderRadius: '6px',
                              color: '#4ade80',
                            }}
                          >
                            <ArrowPathIcon className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                            GENERATE
                          </button>
                        </div>
                      </div>
                    )
                  })()}

                  {tokenTab === 'verify' && (() => {
                    const decoded = decodeToken()
                    return (
                      <div>
                        <button
                          onClick={verifyToken}
                          disabled={isVerifying || !getStoredToken()}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 font-digital text-xs uppercase font-bold tracking-wide transition-all hover:opacity-80 disabled:opacity-50 mb-3"
                          style={{
                            backgroundColor: verifyResult
                              ? verifyResult.valid ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)'
                              : 'var(--bg-secondary)',
                            border: `1px solid ${verifyResult
                              ? verifyResult.valid ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                              : 'var(--border-color)'}`,
                            borderRadius: '8px',
                            color: verifyResult
                              ? verifyResult.valid ? '#4ade80' : '#f87171'
                              : 'var(--text-primary)',
                          }}
                        >
                          {isVerifying ? (
                            <><ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> VERIFYING...</>
                          ) : verifyResult ? (
                            <>{verifyResult.valid ? <CheckIcon className="w-3.5 h-3.5" /> : <XMarkIcon className="w-3.5 h-3.5" />} {verifyResult.message}</>
                          ) : (
                            <>VERIFY SIGNATURE</>
                          )}
                        </button>

                        {decoded && (
                          <div className="space-y-1.5">
                            {Object.entries(decoded.payload).map(([key, value]) => (
                              <div key={key} className="flex items-start gap-2">
                                <span className="text-[10px] font-digital uppercase font-bold flex-shrink-0 pt-0.5" style={{ color: 'var(--text-tertiary)', minWidth: '60px' }}>
                                  {key}
                                </span>
                                <div
                                  className="flex-1 px-2 py-0.5 text-[11px] font-mono break-all cursor-pointer hover:opacity-80 transition-opacity"
                                  style={{
                                    fontFamily: 'IBM Plex Mono, monospace',
                                    backgroundColor: 'var(--bg-input)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '5px',
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
                            <div className="text-[9px] font-digital uppercase pt-1" style={{ color: 'var(--text-tertiary)', opacity: 0.5 }}>
                              Format: {decoded.format === 'jwt' ? 'JWT' : 'Auth (base64url)'}
                            </div>
                          </div>
                        )}

                        {!decoded && getStoredToken() && (
                          <div className="px-3 py-3 text-center text-xs font-digital" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-tertiary)' }}>
                            Could not decode token
                          </div>
                        )}

                        {!getStoredToken() && (
                          <div className="px-3 py-3 text-center text-xs font-digital" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-tertiary)' }}>
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
          <div className="px-3 pb-2">
            <div className="flex items-center gap-2 px-3 py-1.5" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <span className="text-[10px] font-digital uppercase tracking-wider flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>Limit</span>
              <span className="text-amber-400 text-sm font-bold">$</span>
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
              <button onClick={handleSaveLimit} disabled={isSaving} className="p-1 text-amber-400 hover:text-amber-300 transition-all disabled:opacity-40">
                {isSaving ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : <CheckIcon className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => setIsEditing(false)} className="p-1 transition-colors" style={{ color: 'var(--text-secondary)' }}>
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="mx-3" style={{ borderBottom: '1px solid var(--border-color)' }} />
      </div>
    </>
  )
}
