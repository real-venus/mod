"use client"

import { ethers } from 'ethers'
import {
  CheckCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { GlowCard } from './GlowCard'
import { ACCENT, btnClass, getContracts } from './shared'
import { shorten } from '@/utils'
import {
  removeStalePendingTxs,
  type SafeInfo,
  type PendingTransaction,
  type ExecutedTransaction,
} from '@/network/safe'
import { toast } from 'react-toastify'

export function TransactionsTab({
  safeInfo, walletAddress, isOwner,
  pendingTxs, txLoading, actionLoading,
  executedTxs, historyLoading,
  onConfirm, onExecute, onRefresh,
}: {
  safeInfo: SafeInfo | null
  walletAddress: string
  isOwner: boolean
  pendingTxs: PendingTransaction[]
  txLoading: boolean
  actionLoading: string | null
  executedTxs: ExecutedTransaction[]
  historyLoading: boolean
  onConfirm: (tx: PendingTransaction) => void
  onExecute: (tx: PendingTransaction) => void
  onRefresh: () => void
}) {
  const contracts = getContracts()

  if (!safeInfo) {
    return (
      <GlowCard color={ACCENT}>
        <p className="text-white/40 text-center py-4">Load a Safe first</p>
      </GlowCard>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-amber-500/70">Pending Transactions</h2>
        <div className="flex gap-2">
          {pendingTxs.some((tx) => tx.nonce < safeInfo.nonce) && (
            <button
              onClick={() => {
                const removed = removeStalePendingTxs(safeInfo.address, safeInfo.nonce)
                toast.success(`Removed ${removed} stale transaction(s)`)
                onRefresh()
              }}
              className={`${btnClass} bg-red-500/10 text-red-400/70 border border-red-500/20 hover:bg-red-500/20 text-xs`}
            >
              Clear Stale
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={txLoading}
            className={`${btnClass} bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 text-xs`}
          >
            {txLoading ? <ArrowPathIcon className="w-3 h-3 animate-spin" /> : 'Refresh'}
          </button>
        </div>
      </div>

      {pendingTxs.length === 0 && !txLoading && (
        <GlowCard color={ACCENT}>
          <p className="text-white/40 text-center py-4">No pending transactions</p>
        </GlowCard>
      )}

      {pendingTxs.map((tx, i) => {
        const confirmCount = tx.confirmations?.length || 0
        const needed = tx.confirmationsRequired
        const isStale = tx.nonce < safeInfo.nonce
        const canExecute = confirmCount >= needed && !isStale
        const alreadyConfirmed = tx.confirmations?.some(
          (c) => c.owner.toLowerCase() === walletAddress.toLowerCase()
        )
        const isActionLoading = actionLoading === tx.safeTxHash

        return (
          <GlowCard key={tx.safeTxHash} color={canExecute ? '#10b981' : ACCENT} delay={i * 0.05}>
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500/70">Nonce {tx.nonce}</span>
                    {isStale ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/30">
                        expired (nonce used)
                      </span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        canExecute
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {confirmCount}/{needed} {canExecute ? 'ready' : 'pending'}
                      </span>
                    )}
                  </div>
                  <TxDetails tx={tx} contracts={contracts} />
                </div>

                <div className="flex gap-2 shrink-0">
                  {isOwner && !alreadyConfirmed && !canExecute && (
                    <button
                      onClick={() => onConfirm(tx)}
                      disabled={isActionLoading}
                      className={`${btnClass} bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 text-xs`}
                    >
                      {isActionLoading ? <ArrowPathIcon className="w-3 h-3 animate-spin" /> : 'Confirm'}
                    </button>
                  )}
                  {alreadyConfirmed && !canExecute && (
                    <span className="flex items-center gap-1 text-xs text-emerald-400/60">
                      <CheckCircleIcon className="w-4 h-4" /> Signed
                    </span>
                  )}
                  {canExecute && (
                    <button
                      onClick={() => onExecute(tx)}
                      disabled={isActionLoading}
                      className={`${btnClass} bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 text-xs`}
                    >
                      {isActionLoading ? <ArrowPathIcon className="w-3 h-3 animate-spin" /> : 'Execute'}
                    </button>
                  )}
                </div>
              </div>

              {tx.confirmations && tx.confirmations.length > 0 && (
                <div className="border-t border-white/[0.06] pt-2">
                  <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Confirmations</div>
                  <div className="flex flex-wrap gap-2">
                    {tx.confirmations.map((c, ci) => (
                      <span key={ci} className="flex items-center gap-1 px-2 py-1 rounded bg-white/[0.04] text-[10px] font-mono text-white/50">
                        <CheckCircleIcon className="w-3 h-3 text-emerald-400/60" />
                        {shorten(c.owner, 4, 4)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </GlowCard>
        )
      })}

      {/* Executed History */}
      <div className="border-t border-white/[0.06] mt-6 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/40">Executed History</h2>
          {historyLoading && <ArrowPathIcon className="w-3 h-3 animate-spin text-white/20" />}
        </div>
      {historyLoading && executedTxs.length === 0 && (
        <GlowCard color={ACCENT}>
          <p className="text-white/40 text-center py-4">Loading history...</p>
        </GlowCard>
      )}
      {!historyLoading && executedTxs.length === 0 && (
        <GlowCard color={ACCENT}>
          <p className="text-white/40 text-center py-4">No executed transactions found</p>
        </GlowCard>
      )}
      {executedTxs.length > 0 && (
        <>
          {executedTxs.map((tx, i) => (
            <GlowCard key={tx.txHash} color={tx.success ? '#6b7280' : '#ef4444'} delay={i * 0.03}>
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        tx.success
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {tx.success ? 'success' : 'failed'}
                      </span>
                      <span className="text-[10px] text-white/20 font-mono">#{tx.blockNumber}</span>
                    </div>
                    <div className="text-xs text-white/50 mb-1">
                      <span className="text-white/30">To:</span>{' '}
                      <span className="font-mono">{shorten(tx.to)}</span>
                      {contracts.find((c) => c.address.toLowerCase() === tx.to.toLowerCase()) && (
                        <span className="ml-2 text-amber-500/60">
                          ({contracts.find((c) => c.address.toLowerCase() === tx.to.toLowerCase())!.name})
                        </span>
                      )}
                    </div>
                    {tx.data && tx.data !== '0x' && (
                      <div className="text-xs text-white/30 font-mono truncate max-w-md">
                        {tx.data.slice(0, 66)}...
                      </div>
                    )}
                    {tx.value !== '0' && (
                      <div className="text-xs text-white/50 mt-1">
                        Value: <span className="font-mono text-white/70">{ethers.formatEther(tx.value)} ETH</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-white/20 mt-1">
                      {tx.timestamp > 0 && (
                        <span>{new Date(tx.timestamp * 1000).toLocaleString()}</span>
                      )}
                      <span className="font-mono">by {shorten(tx.executor, 4, 4)}</span>
                    </div>
                  </div>
                  <a
                    href={`https://sepolia.basescan.org/tx/${tx.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-amber-500/50 hover:text-amber-400 font-mono shrink-0"
                  >
                    {shorten(tx.txHash, 6, 4)}
                  </a>
                </div>
              </div>
            </GlowCard>
          ))}
        </>
      )}
      </div>
    </div>
  )
}

// Shared tx detail display
function TxDetails({ tx, contracts }: {
  tx: { to: string; data: string; value: string; submissionDate: string }
  contracts: { name: string; address: string }[]
}) {
  return (
    <>
      <div className="text-xs text-white/50 mb-1">
        <span className="text-white/30">To:</span>{' '}
        <span className="font-mono">{shorten(tx.to)}</span>
        {contracts.find((c) => c.address.toLowerCase() === tx.to.toLowerCase()) && (
          <span className="ml-2 text-amber-500/60">
            ({contracts.find((c) => c.address.toLowerCase() === tx.to.toLowerCase())!.name})
          </span>
        )}
      </div>
      {tx.data && tx.data !== '0x' && (
        <div className="text-xs text-white/30 font-mono truncate max-w-md">
          {tx.data.slice(0, 66)}...
        </div>
      )}
      {tx.value !== '0' && (
        <div className="text-xs text-white/50 mt-1">
          Value: <span className="font-mono text-white/70">{ethers.formatEther(tx.value)} ETH</span>
        </div>
      )}
      <div className="text-[10px] text-white/20 mt-1">
        {new Date(tx.submissionDate).toLocaleString()}
      </div>
    </>
  )
}
