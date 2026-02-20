"use client";

import { ArrowPathIcon, CreditCardIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'

type TokenType = 'USDC' | 'USDT'

interface TopUpTabProps {
  show: boolean
  selectedToken: TokenType
  setSelectedToken: (t: TokenType) => void
  topUpAmount: string
  setTopUpAmount: (a: string) => void
  isProcessing: boolean
  topUpError: string | null
  topUpSuccess: string | null
  onTopUp: () => void
}

export function TopUpTab({
  show, selectedToken, setSelectedToken,
  topUpAmount, setTopUpAmount, isProcessing,
  topUpError, topUpSuccess, onTopUp
}: TopUpTabProps) {
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
            <label className="text-xs text-neutral-500 font-bold uppercase mb-1 block" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>Token</label>
            <select
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value as TokenType)}
              className="w-full bg-neutral-900/80 border border-neutral-800/60 px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-neutral-600 text-neutral-300 hover:border-neutral-700 transition-colors"
              style={{ borderRadius: '8px', fontFamily: 'IBM Plex Mono, monospace' }}
            >
              <option value="USDC">USDC</option>
              <option value="USDT">USDT</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-neutral-500 font-bold uppercase mb-1 block" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>Amount</label>
            <input
              type="number"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              disabled={isProcessing}
              min="0"
              step="0.01"
              placeholder="10.00"
              className="w-full bg-neutral-900/80 border border-neutral-800/60 px-3 py-2.5 text-sm font-mono placeholder-neutral-600 focus:outline-none focus:border-neutral-600 disabled:opacity-50 text-neutral-300 hover:border-neutral-700 transition-colors"
              style={{ borderRadius: '8px', fontFamily: 'IBM Plex Mono, monospace' }}
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
