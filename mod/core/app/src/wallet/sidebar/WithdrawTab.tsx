"use client";

import { ArrowPathIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'

type TokenType = 'USDC' | 'USDT'

interface WithdrawTabProps {
  show: boolean
  withdrawTokenType: TokenType
  setWithdrawTokenType: (t: TokenType) => void
  withdrawAmount: string
  setWithdrawAmount: (a: string) => void
  isWithdrawing: boolean
  marketCredit: number
  topUpError: string | null
  topUpSuccess: string | null
  onWithdraw: () => void
}

export function WithdrawTab({
  show, withdrawTokenType, setWithdrawTokenType,
  withdrawAmount, setWithdrawAmount, isWithdrawing,
  marketCredit, topUpError, topUpSuccess, onWithdraw
}: WithdrawTabProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-3 pt-3 border-t border-neutral-800 space-y-2 overflow-hidden"
        >
          <div>
            <label className="text-xs text-neutral-500 font-bold uppercase mb-1 block" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>Withdraw As</label>
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
                      : 'border-neutral-800 bg-neutral-900/80 text-neutral-500 hover:border-neutral-700 hover:text-neutral-400'
                  }`}
                  style={{ borderRadius: '8px', fontFamily: 'IBM Plex Mono, monospace' }}
                >
                  {token}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between px-3 py-2.5 bg-neutral-900/80 border border-neutral-800/60"
            style={{ borderRadius: '8px', fontFamily: 'IBM Plex Mono, monospace' }}
          >
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Available</span>
            <span className="text-sm font-mono font-bold text-green-400 tabular-nums">${marketCredit.toFixed(2)}</span>
          </div>

          <div>
            <label className="text-xs text-neutral-500 font-bold uppercase mb-1 block" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>Amount</label>
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              disabled={isWithdrawing}
              min="0"
              step="0.01"
              max={marketCredit}
              placeholder="10.00"
              className="w-full bg-neutral-900/80 border border-neutral-800/60 px-3 py-2.5 text-sm font-mono placeholder-neutral-600 focus:outline-none focus:border-neutral-600 disabled:opacity-50 text-neutral-300 hover:border-neutral-700 transition-colors"
              style={{ borderRadius: '8px', fontFamily: 'IBM Plex Mono, monospace' }}
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

          {topUpError && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2.5 font-mono"
              style={{ borderRadius: '8px', fontFamily: 'IBM Plex Mono, monospace' }}
            >
              {topUpError}
            </div>
          )}

          {topUpSuccess && (
            <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-2.5 font-mono"
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
