"use client";

import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { ArrowPathIcon, ArrowRightStartOnRectangleIcon, XMarkIcon, CheckIcon, PlusCircleIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-toastify'
import { CopyButton } from '@/ui/CopyButton'
import DebitABI from '@/contracts/market/debit/Debit.sol/Debit.json'
import modConfig from '@/config.json'

function getDebitAddress(): string {
  const chainConfig = (modConfig.chain as any)?.testnet
  return chainConfig?.contracts?.Debit?.address || ''
}

type TransferTokenType = 'MARKET' | 'USDC' | 'USDT'

interface CustomToken {
  address: string
  symbol: string
  decimals: number
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
  // Portfolio props
  tokenBalances: Record<string, number>
  customTokens: CustomToken[]
  customTokenBalances: Record<string, number>
  sendFromPortfolio: string | null
  setSendFromPortfolio: (v: string | null) => void
  transferRecipient: string
  setTransferRecipient: (v: string) => void
  transferAmount: string
  setTransferAmount: (v: string) => void
  isTransferring: boolean
  setTransferTokenType: (v: TransferTokenType) => void
  topUpError: string | null
  setTopUpError: (v: string | null) => void
  topUpSuccess: string | null
  setTopUpSuccess: (v: string | null) => void
  showAddToken: boolean
  setShowAddToken: (v: boolean) => void
  newTokenAddress: string
  setNewTokenAddress: (v: string) => void
  isAddingToken: boolean
  isRefreshingBalances: boolean
  onRefreshBalances: () => void
  onTransfer: () => void
  onSendETH: () => void
  onSendCustomToken: (addr: string, symbol: string, decimals: number) => void
  onRemoveCustomToken: (addr: string) => void
  onAddCustomToken: () => void
}

export function SidebarHeader({
  shortAddress, walletMode, copiedAddress, copyAddress,
  tokenExpiry, getTokenExpiry, isTokenExpired, isRefreshing,
  handleRefreshToken, handleSignOut, onClose, marketCredit, address,
  tokenBalances, customTokens, customTokenBalances,
  sendFromPortfolio, setSendFromPortfolio,
  transferRecipient, setTransferRecipient,
  transferAmount, setTransferAmount,
  isTransferring, setTransferTokenType,
  topUpError, setTopUpError, topUpSuccess, setTopUpSuccess,
  showAddToken, setShowAddToken, newTokenAddress, setNewTokenAddress,
  isAddingToken, isRefreshingBalances,
  onRefreshBalances, onTransfer, onSendETH, onSendCustomToken,
  onRemoveCustomToken, onAddCustomToken,
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

  const spentRatio = dailyLimit && dailyLimit > 0 ? (dailySpent ?? 0) / dailyLimit : 0

  // Portfolio token list
  const tokenAddressMap: Record<string, string | undefined> = {
    USDC: (modConfig.chain as any)?.testnet?.contracts?.USDC?.address,
    USDT: (modConfig.chain as any)?.testnet?.contracts?.USDT?.address,
    MARKET: (modConfig.chain as any)?.testnet?.contracts?.Market?.address,
    NativeToken: (modConfig.chain as any)?.testnet?.contracts?.NativeToken?.address,
  }

  const allTokens: { key: string; symbol: string; balance: number; address?: string; decimals?: number; isCustom?: boolean; isETH?: boolean }[] = []

  for (const [token, balance] of Object.entries(tokenBalances)) {
    allTokens.push({
      key: token,
      symbol: token,
      balance: Number(balance) || 0,
      address: tokenAddressMap[token],
      isETH: token === 'ETH',
    })
  }

  for (const ct of customTokens) {
    if (!allTokens.some(t => t.address?.toLowerCase() === ct.address.toLowerCase())) {
      allTokens.push({
        key: `custom-${ct.address}`,
        symbol: ct.symbol,
        balance: customTokenBalances[ct.symbol] || 0,
        address: ct.address,
        decimals: ct.decimals,
        isCustom: true,
      })
    }
  }

  return (
    <>
      <div className="sticky top-0 z-10 backdrop-blur-md" style={{ backgroundColor: 'var(--bg-sidebar)' }}>
        {/* Compact top bar: close + sign out */}
        <div className="flex items-center justify-between px-3 pt-2 pb-0">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ${isTokenExpired ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}
              style={{ boxShadow: isTokenExpired ? '0 0 6px rgba(234,179,8,0.5)' : '0 0 6px rgba(34,197,94,0.4)' }}
            />
            <span
              className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm"
              style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-tertiary)', fontFamily: 'IBM Plex Mono, monospace' }}
            >
              {walletMode || 'web3'}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleRefreshToken}
              disabled={isRefreshing}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all text-[10px] font-bold font-mono tabular-nums ${
                isTokenExpired ? 'text-red-400 hover:bg-red-500/10' : 'hover:bg-white/5'
              }`}
              style={{ fontFamily: 'IBM Plex Mono, monospace', ...(!isTokenExpired ? { color: 'var(--text-tertiary)' } : {}) }}
              title="Refresh session"
            >
              <ArrowPathIcon className={`w-2.5 h-2.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {tokenExpiry || getTokenExpiry()}
            </button>
            <button
              onClick={handleSignOut}
              className="hover:text-red-400 transition-colors p-1 rounded hover:bg-white/5"
              style={{ color: 'var(--text-tertiary)' }}
              title="Sign out"
            >
              <ArrowRightStartOnRectangleIcon className="w-3 h-3" />
            </button>
            <button
              onClick={onClose}
              className="transition-colors p-1 rounded hover:bg-white/5"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <XMarkIcon className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Hero section: address + credit */}
        <div className="px-3 pt-2 pb-3 relative">
          <button
            onClick={copyAddress}
            onMouseEnter={() => setAddressHovered(true)}
            onMouseLeave={() => setAddressHovered(false)}
            className="block cursor-pointer group relative"
            title={address}
          >
            <span
              className={`text-sm font-bold font-mono tracking-wide transition-all ${copiedAddress ? 'text-green-400' : 'group-hover:opacity-70'}`}
              style={{ fontFamily: 'IBM Plex Mono, monospace', ...(!copiedAddress ? { color: 'var(--text-secondary)' } : {}) }}
            >
              {copiedAddress ? 'COPIED' : shortAddress}
            </span>
            {addressHovered && !copiedAddress && (
              <div
                className="absolute left-0 top-full mt-1 z-50 px-2 py-1 rounded text-[10px] font-mono whitespace-nowrap shadow-lg"
                style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono, monospace' }}
              >
                {address}
              </div>
            )}
          </button>

          <div className="flex items-baseline gap-2 mt-1">
            <span
              className="text-2xl font-black font-mono tabular-nums tracking-tight"
              style={{ fontFamily: 'IBM Plex Mono, monospace', color: marketCredit > 0 ? '#4ade80' : 'var(--text-primary)' }}
            >
              ${marketCredit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Daily limit bar - sleek inline */}
          {dailyLimit !== null && (
            <div className="mt-2.5">
              {isEditing ? (
                <div className="flex items-center gap-1.5 rounded-md px-2 py-1.5" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                  <span className="text-[9px] font-bold uppercase tracking-wider flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>Limit</span>
                  <span className="text-amber-400 text-xs font-bold">$</span>
                  <input
                    type="number"
                    value={newLimit}
                    onChange={(e) => setNewLimit(e.target.value)}
                    className="flex-1 border border-amber-500/30 rounded px-1.5 py-0.5 text-xs font-mono focus:outline-none focus:border-amber-400/60"
                    style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                    placeholder="1000"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLimit(); if (e.key === 'Escape') setIsEditing(false) }}
                  />
                  <button
                    onClick={handleSaveLimit}
                    disabled={isSaving}
                    className="p-0.5 text-amber-400 hover:text-amber-300 transition-all disabled:opacity-40"
                  >
                    {isSaving ? <ArrowPathIcon className="w-3 h-3 animate-spin" /> : <CheckIcon className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="p-0.5 transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div
                  className="group flex items-center gap-2 cursor-pointer"
                  onClick={() => { setIsEditing(true); setNewLimit(dailyLimit.toFixed(2)) }}
                  title="Click to edit daily limit"
                >
                  <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-color)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${Math.min(100, spentRatio * 100)}%`,
                        background: spentRatio > 0.9 ? '#ef4444' : spentRatio > 0.7 ? '#f59e0b' : '#4ade80',
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-mono tabular-nums flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-tertiary)', fontFamily: 'IBM Plex Mono, monospace' }}>
                    ${dailyRemaining !== null ? dailyRemaining.toFixed(0) : '—'}<span className="opacity-50">/{dailyLimit.toFixed(0)}</span>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Portfolio / Send Section */}
        <div className="px-3 pb-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1 mb-1.5">
              <span className="text-[10px] uppercase tracking-wider font-bold" style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-tertiary)' }}>PORTFOLIO</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setShowAddToken(!showAddToken); setSendFromPortfolio(null) }}
                  className="p-1 transition-all rounded"
                  title="Add custom token"
                  style={{ borderRadius: 0 }}
                >
                  <PlusCircleIcon className={`w-3.5 h-3.5 ${showAddToken ? 'text-purple-400' : ''}`} style={!showAddToken ? { color: 'var(--text-tertiary)' } : {}} />
                </button>
                <button
                  onClick={onRefreshBalances}
                  disabled={isRefreshingBalances}
                  className="p-1 transition-all disabled:opacity-50 rounded"
                  title="Refresh balances"
                  style={{ borderRadius: 0 }}
                >
                  <ArrowPathIcon className={`w-3.5 h-3.5 ${isRefreshingBalances ? 'animate-spin' : ''}`} style={{ color: 'var(--text-tertiary)' }} />
                </button>
              </div>
            </div>

            {/* Add Custom Token Form */}
            <AnimatePresence>
              {showAddToken && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="flex gap-1.5 mb-2">
                    <input
                      type="text"
                      value={newTokenAddress}
                      onChange={(e) => setNewTokenAddress(e.target.value)}
                      placeholder="Token address 0x..."
                      className="flex-1 px-3 py-2 text-xs font-mono placeholder-neutral-600 focus:outline-none focus:border-purple-500/50 transition-colors"
                      style={{ borderRadius: '8px', fontFamily: 'IBM Plex Mono, monospace', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                    />
                    <button
                      onClick={onAddCustomToken}
                      disabled={isAddingToken}
                      className="px-3 py-2 bg-purple-500/15 border border-purple-500/30 text-purple-400 text-xs font-bold hover:bg-purple-500/25 transition-all disabled:opacity-50"
                      style={{ borderRadius: '8px', fontFamily: 'IBM Plex Mono, monospace' }}
                    >
                      {isAddingToken ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : 'ADD'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {allTokens.length === 0 ? (
              <div className="text-center py-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {isRefreshingBalances ? (
                  <div className="flex items-center justify-center gap-2">
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    <span>Loading balances...</span>
                  </div>
                ) : (
                  'No token balances available'
                )}
              </div>
            ) : (
              allTokens.map((token) => {
                const isSelected = sendFromPortfolio === token.key
                return (
                  <div key={token.key}>
                    <button
                      onClick={() => {
                        setSendFromPortfolio(isSelected ? null : token.key)
                        setTransferRecipient('')
                        setTransferAmount('')
                        setTopUpError(null)
                        setTopUpSuccess(null)
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-all ${
                        isSelected
                          ? 'bg-blue-500/10 border border-blue-500/30'
                          : 'hover:border-opacity-60'
                      }`}
                      style={{
                        borderRadius: isSelected ? '8px 8px 0 0' : '8px',
                        fontFamily: 'IBM Plex Mono, monospace',
                        ...(!isSelected ? { backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' } : {}),
                      }}
                    >
                      <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                        {token.symbol}
                        {token.address && (
                          <span onClick={(e) => e.stopPropagation()}>
                            <CopyButton text={token.address} size="sm" />
                          </span>
                        )}
                        {token.isCustom && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onRemoveCustomToken(token.address!) }}
                            className="text-red-500/40 hover:text-red-400 transition-colors"
                            title="Remove token"
                          >
                            <XMarkIcon className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                      <span className="font-mono font-bold tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        {token.isETH
                          ? `${token.balance.toFixed(4)} ETH`
                          : token.isCustom
                          ? `${token.balance.toFixed(4)} ${token.symbol}`
                          : `$${token.balance.toFixed(2)}`}
                      </span>
                    </button>

                    {/* Inline Send Form */}
                    <AnimatePresence>
                      {isSelected && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden border border-t-0 border-blue-500/20 px-3 py-3 space-y-2"
                          style={{ borderRadius: '0 0 8px 8px', fontFamily: 'IBM Plex Mono, monospace', backgroundColor: 'var(--bg-input)' }}
                        >
                          <input
                            type="text"
                            value={transferRecipient}
                            onChange={(e) => setTransferRecipient(e.target.value)}
                            disabled={isTransferring}
                            placeholder="Recipient 0x..."
                            className="w-full px-3 py-2 text-xs font-mono placeholder-neutral-600 focus:outline-none focus:border-blue-500/40 transition-colors"
                            style={{ borderRadius: '6px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                          />
                          <input
                            type="number"
                            value={transferAmount}
                            onChange={(e) => setTransferAmount(e.target.value)}
                            disabled={isTransferring}
                            min="0"
                            step="0.01"
                            placeholder="Amount"
                            className="w-full px-3 py-2 text-xs font-mono placeholder-neutral-600 focus:outline-none focus:border-blue-500/40 transition-colors"
                            style={{ borderRadius: '6px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                          />
                          <button
                            onClick={() => {
                              if (token.isETH) {
                                onSendETH()
                              } else if (token.isCustom && token.address && token.decimals != null) {
                                onSendCustomToken(token.address, token.symbol, token.decimals)
                              } else if (token.symbol === 'MARKET') {
                                setTransferTokenType('MARKET')
                                onTransfer()
                              } else if (token.symbol === 'USDC') {
                                setTransferTokenType('USDC')
                                onTransfer()
                              } else if (token.symbol === 'USDT') {
                                setTransferTokenType('USDT')
                                onTransfer()
                              }
                            }}
                            disabled={!transferAmount || !transferRecipient || isTransferring}
                            className="w-full py-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold uppercase hover:bg-blue-500/20 hover:border-blue-500/50 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                            style={{ borderRadius: '6px' }}
                          >
                            {isTransferring ? (
                              <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <ArrowsRightLeftIcon className="w-3.5 h-3.5" />
                                SEND {token.symbol}
                              </>
                            )}
                          </button>

                          {topUpError && (
                            <div className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1.5 font-mono" style={{ borderRadius: '6px' }}>
                              {topUpError}
                            </div>
                          )}
                          {topUpSuccess && (
                            <div className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1.5 font-mono" style={{ borderRadius: '6px' }}>
                              {topUpSuccess}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="mx-3 mb-0" style={{ borderBottom: '1px solid var(--border-color)' }} />
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
