"use client";

import { useState } from 'react'
import { ArrowPathIcon, CreditCardIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'

type TokenType = 'USDC' | 'USDT'

interface CreditTabProps {
  show: boolean
  // Top-up
  selectedToken: TokenType
  setSelectedToken: (t: TokenType) => void
  topUpAmount: string
  setTopUpAmount: (a: string) => void
  isProcessing: boolean
  onTopUp: () => void
  // Withdraw
  withdrawTokenType: TokenType
  setWithdrawTokenType: (t: TokenType) => void
  withdrawAmount: string
  setWithdrawAmount: (a: string) => void
  isWithdrawing: boolean
  marketCredit: number
  onWithdraw: () => void
  // Shared
  topUpError: string | null
  topUpSuccess: string | null
}

export function CreditTab({
  show,
  selectedToken, setSelectedToken, topUpAmount, setTopUpAmount, isProcessing, onTopUp,
  withdrawTokenType, setWithdrawTokenType, withdrawAmount, setWithdrawAmount, isWithdrawing, marketCredit, onWithdraw,
  topUpError, topUpSuccess,
}: CreditTabProps) {
  const [mode, setMode] = useState<'add' | 'out'>('add')

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-3 pt-3 border-t overflow-hidden"
          style={{ borderColor: 'var(--border-color)' }}
        >
          {/* Mode Toggle */}
          <div className="flex gap-1.5 mb-3">
            <button
              onClick={() => setMode('add')}
              className={`flex-1 py-2 px-2 text-xs font-bold uppercase font-mono border-2 transition-all flex items-center justify-center gap-1.5 ${
                mode === 'add'
                  ? 'border-green-500 bg-green-500/20 text-green-400'
                  : 'bg-neutral-900/80 text-neutral-500 hover:text-neutral-400'
              }`}
              style={{ borderRadius: '8px', fontFamily: 'IBM Plex Mono, monospace', ...( mode !== 'add' ? { borderColor: 'var(--border-color)' } : {}) }}
            >
              <CreditCardIcon className="w-3.5 h-3.5" />
              ADD
            </button>
            <button
              onClick={() => setMode('out')}
              className={`flex-1 py-2 px-2 text-xs font-bold uppercase font-mono border-2 transition-all flex items-center justify-center gap-1.5 ${
                mode === 'out'
                  ? 'border-rose-500 bg-rose-500/20 text-rose-400'
                  : 'bg-neutral-900/80 text-neutral-500 hover:text-neutral-400'
              }`}
              style={{ borderRadius: '8px', fontFamily: 'IBM Plex Mono, monospace', ...( mode !== 'out' ? { borderColor: 'var(--border-color)' } : {}) }}
            >
              <ArrowRightOnRectangleIcon className="w-3.5 h-3.5" />
              OUT
            </button>
          </div>

          {/* ADD Mode */}
          {mode === 'add' && (
            <div className="space-y-2">
              <div>
                <label className="text-xs font-bold uppercase mb-1 block" style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-tertiary)' }}>Token</label>
                <select
                  value={selectedToken}
                  onChange={(e) => setSelectedToken(e.target.value as TokenType)}
                  className="w-full px-3 py-2.5 text-sm font-mono focus:outline-none transition-colors"
                  style={{ borderRadius: '8px', fontFamily: 'IBM Plex Mono, monospace', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                >
                  <option value="USDC">USDC</option>
                  <option value="USDT">USDT</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase mb-1 block" style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-tertiary)' }}>Amount</label>
                <input
                  type="number"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  disabled={isProcessing}
                  min="0"
                  step="0.01"
                  placeholder="10.00"
                  className="w-full px-3 py-2.5 text-sm font-mono placeholder-neutral-600 focus:outline-none disabled:opacity-50 transition-colors"
                  style={{ borderRadius: '8px', fontFamily: 'IBM Plex Mono, monospace', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                />
              </div>

              <button
                onClick={onTopUp}
                disabled={!topUpAmount || isProcessing}
                className="w-full py-3 border bg-green-500/10 border-green-500/30 font-mono uppercase font-bold text-xs disabled:opacity-50 transition-all hover:bg-green-500/20 hover:border-green-500/50 flex items-center justify-center gap-2 text-green-400"
                style={{ borderRadius: '10px', fontFamily: 'IBM Plex Mono, monospace' }}
              >
                {isProcessing ? (
                  <>
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    <span>PROCESSING</span>
                  </>
                ) : (
                  <>
                    <CreditCardIcon className="w-4 h-4" />
                    <span>ADD CREDIT</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* OUT Mode */}
          {mode === 'out' && (
            <div className="space-y-2">
              <div>
                <label className="text-xs font-bold uppercase mb-1 block" style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-tertiary)' }}>Withdraw As</label>
                <div className="flex gap-1.5">
                  {(['USDC', 'USDT'] as TokenType[]).map((token) => (
                    <button
                      key={token}
                      onClick={() => setWithdrawTokenType(token)}
                      className={`flex-1 py-2 px-2 text-xs font-bold uppercase font-mono border-2 transition-all ${
                        withdrawTokenType === token
                          ? token === 'USDC'
                            ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                            : 'border-teal-500 bg-teal-500/20 text-teal-400'
                          : 'text-neutral-500 hover:text-neutral-400'
                      }`}
                      style={{ borderRadius: '8px', fontFamily: 'IBM Plex Mono, monospace', ...(withdrawTokenType !== token ? { borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-input)' } : {}) }}
                    >
                      {token}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between px-3 py-2.5"
                style={{ borderRadius: '8px', fontFamily: 'IBM Plex Mono, monospace', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
              >
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Available</span>
                <span className="text-sm font-mono font-bold text-green-400 tabular-nums">${marketCredit.toFixed(2)}</span>
              </div>

              <div>
                <label className="text-xs font-bold uppercase mb-1 block" style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-tertiary)' }}>Amount</label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  disabled={isWithdrawing}
                  min="0"
                  step="0.01"
                  max={marketCredit}
                  placeholder="10.00"
                  className="w-full px-3 py-2.5 text-sm font-mono placeholder-neutral-600 focus:outline-none disabled:opacity-50 transition-colors"
                  style={{ borderRadius: '8px', fontFamily: 'IBM Plex Mono, monospace', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                />
              </div>

              <button
                onClick={onWithdraw}
                disabled={!withdrawAmount || isWithdrawing}
                className="w-full py-3 border bg-rose-500/10 border-rose-500/30 font-mono uppercase font-bold text-xs disabled:opacity-50 transition-all hover:bg-rose-500/20 hover:border-rose-500/50 flex items-center justify-center gap-2 text-rose-400"
                style={{ borderRadius: '10px', fontFamily: 'IBM Plex Mono, monospace' }}
              >
                {isWithdrawing ? (
                  <>
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    <span>WITHDRAWING</span>
                  </>
                ) : (
                  <>
                    <ArrowRightOnRectangleIcon className="w-4 h-4" />
                    <span>WITHDRAW</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Shared Error/Success */}
          {topUpError && (
            <div className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2.5 font-mono"
              style={{ borderRadius: '8px', fontFamily: 'IBM Plex Mono, monospace' }}
            >
              {topUpError}
            </div>
          )}

          {topUpSuccess && (
            <div className="mt-2 text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-2.5 font-mono"
              style={{ borderRadius: '8px', fontFamily: 'IBM Plex Mono, monospace' }}
            >
              {topUpSuccess}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
