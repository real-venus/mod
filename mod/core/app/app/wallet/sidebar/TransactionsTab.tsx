"use client";

import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import { TransactionCard } from '@/chat/transactions/TransactionCard'

interface TransactionsTabProps {
  show: boolean
  userTransactions: any[]
  isLoadingTxs: boolean
  txsStatusFilter: 'all' | 'pending' | 'complete'
  setTxsStatusFilter: (f: 'all' | 'pending' | 'complete') => void
  expandedTxIdx: number | null
  setExpandedTxIdx: (i: number | null) => void
  totalCost24h: number
}

export function TransactionsTab({
  show, userTransactions, isLoadingTxs,
  txsStatusFilter, setTxsStatusFilter,
  expandedTxIdx, setExpandedTxIdx, totalCost24h
}: TransactionsTabProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          className="mt-3 pt-3 border-t border-neutral-800 overflow-hidden"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 px-1 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-600 uppercase tracking-wider font-bold">24H</span>
                <span className="text-base font-mono font-bold text-amber-400 tabular-nums">${totalCost24h.toFixed(2)}</span>
                <span className="text-sm text-neutral-700">({userTransactions.filter(tx => {
                  const now = Date.now() / 1000
                  const twentyFourHoursAgo = now - (24 * 60 * 60)
                  return parseInt(tx.time) >= twentyFourHoursAgo
                }).length})</span>
              </div>

              <select
                value={txsStatusFilter}
                onChange={(e) => setTxsStatusFilter(e.target.value as 'all' | 'pending' | 'complete')}
                className="px-3 py-1.5 bg-neutral-900/80 border border-neutral-800/60 text-sm text-neutral-400 cursor-pointer focus:outline-none font-mono rounded-md"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="complete">Complete</option>
              </select>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#404040 transparent' }}>
              {isLoadingTxs ? (
                <div className="flex items-center justify-center py-8">
                  <ArrowPathIcon className="w-5 h-5 animate-spin text-amber-500" />
                </div>
              ) : userTransactions.length === 0 ? (
                <div className="text-center py-8 text-gray-600 text-xs">
                  No transactions yet
                </div>
              ) : (
                (() => {
                  const filteredTxs = userTransactions.filter(tx => {
                    if (txsStatusFilter === 'all') return true

                    // Check if transaction has actually completed (has result)
                    const hasCompleted = tx.result !== undefined && tx.result !== null

                    if (txsStatusFilter === 'pending') {
                      // Only show as pending if it doesn't have a result yet
                      return !hasCompleted && (tx.status === 'pending' || tx.status === 'running')
                    }
                    if (txsStatusFilter === 'complete') {
                      // Show as complete if it has a result OR if status indicates completion
                      return hasCompleted || tx.status === 'success' || tx.status === 'finished' || tx.status === 'complete' || tx.status === 'error' || tx.status === 'failed'
                    }
                    return true
                  })

                  return filteredTxs.length === 0 ? (
                    <div className="text-center py-8 text-gray-600 text-xs">
                      No {txsStatusFilter} transactions
                    </div>
                  ) : (
                    filteredTxs.slice(0, 20).map((tx, idx) => (
                      <div
                        key={tx.cid || tx.hash || idx}
                        onClick={() => setExpandedTxIdx(expandedTxIdx === idx ? null : idx)}
                      >
                        <TransactionCard
                          tx={tx}
                          idx={idx}
                          isExpanded={expandedTxIdx === idx}
                          compact={false}
                        />
                      </div>
                    ))
                  )
                })()
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
