"use client";

import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { ArrowPathIcon, ArrowRightOnRectangleIcon, XMarkIcon, PencilIcon, CheckIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-toastify'
import DebitABI from '@/contracts/market/debit/Debit.sol/Debit.json'
import modConfig from '@/config.json'

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
}

export function SidebarHeader({
  shortAddress, walletMode, copiedAddress, copyAddress,
  tokenExpiry, getTokenExpiry, isTokenExpired, isRefreshing,
  handleRefreshToken, handleSignOut, onClose, marketCredit, address
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

  return (
    <>
      <div className="sticky top-0 z-10 backdrop-blur-md" style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-sidebar)' }}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={copyAddress}
              className={`text-xs font-bold font-mono tracking-wider transition-all cursor-pointer ${
                copiedAddress ? 'text-green-400' : ''
              }`}
              style={{ fontFamily: 'IBM Plex Mono, monospace', ...(!copiedAddress ? { color: 'var(--text-secondary)' } : {}) }}
              title="Click to copy full address"
            >
              {copiedAddress ? 'COPIED!' : shortAddress}
            </button>
            <span
              className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)', fontFamily: 'IBM Plex Mono, monospace' }}
            >
              {walletMode || 'web3'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshToken}
              disabled={isRefreshing}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all text-xs font-bold font-mono tabular-nums ${
                isTokenExpired
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-cyan-500 hover:bg-cyan-500/10'
              }`}
              style={{ fontFamily: 'IBM Plex Mono, monospace' }}
              title="Refresh session"
            >
              <ArrowPathIcon className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              {tokenExpiry || getTokenExpiry()}
            </button>
            <button
              onClick={handleSignOut}
              className="hover:text-red-400 transition-colors p-1"
              style={{ color: 'var(--text-tertiary)' }}
              title="Sign out"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="transition-colors p-1"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 pb-3">
          <span className="text-lg font-black font-mono tabular-nums text-green-400" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
            ${marketCredit.toFixed(2)}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>credit</span>
          <div className="flex-1" />
          <div
            className={`w-2 h-2 rounded-full ${isTokenExpired ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}
          />
        </div>

        {/* Daily Spending Limit */}
        {dailyLimit !== null && (
          <div className="px-4 pb-3">
            <div className="rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Daily Limit</span>
                {!isEditing && (
                  <button
                    onClick={() => { setIsEditing(true); setNewLimit(dailyLimit.toFixed(2)) }}
                    className="hover:text-amber-400 transition-colors p-0.5"
                    style={{ color: 'var(--text-tertiary)' }}
                    title="Change daily limit"
                  >
                    <PencilIcon className="w-3 h-3" />
                  </button>
                )}
              </div>
              {isEditing ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-400 text-xs font-bold">$</span>
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
                    className="px-2 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded hover:bg-amber-500/25 transition-all disabled:opacity-40"
                  >
                    {isSaving ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : <CheckIcon className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-1 py-1 transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <XMarkIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-sm font-bold font-mono tabular-nums text-amber-400" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                      ${dailyRemaining !== null ? dailyRemaining.toFixed(2) : '—'}
                    </span>
                    <span className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>remaining of ${dailyLimit.toFixed(2)}</span>
                  </div>
                  {dailyLimit > 0 && (
                    <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-input)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, ((dailySpent ?? 0) / dailyLimit) * 100)}%`,
                          background: ((dailySpent ?? 0) / dailyLimit) > 0.9 ? '#ef4444' : ((dailySpent ?? 0) / dailyLimit) > 0.7 ? '#f59e0b' : '#22c55e',
                        }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isTokenExpired && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mx-4 mt-3 px-3 py-2 border border-yellow-500/40 bg-yellow-500/5 rounded-lg overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-yellow-400 font-bold text-[11px] uppercase tracking-wider" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                TOKEN EXPIRED
              </span>
              <button
                onClick={handleRefreshToken}
                disabled={isRefreshing}
                className="flex items-center gap-1 px-2 py-1 bg-yellow-500/15 hover:bg-yellow-500/25 border border-yellow-500/30 text-yellow-400 font-bold text-[10px] uppercase transition-all rounded-md disabled:opacity-50"
                style={{ fontFamily: 'IBM Plex Mono, monospace' }}
              >
                <ArrowPathIcon className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                REFRESH
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
