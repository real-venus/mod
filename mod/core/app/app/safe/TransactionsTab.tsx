"use client"

import { ethers } from 'ethers'
import { TerminalCard } from './GlowCard'
import { getContracts } from './shared'
import { shorten } from '@/utils'
import {
  removeStalePendingTxs,
  type SafeInfo,
  type PendingTransaction,
  type ExecutedTransaction,
} from '@/network/safe'
import { toast } from 'react-toastify'

const TERM_FONT = "var(--font-digital), 'JetBrains Mono', 'Courier New', monospace"

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
      <div className="py-12 text-center" style={{ fontFamily: TERM_FONT, fontSize: '14px', color: 'var(--text-tertiary)' }}>
        load a safe first
      </div>
    )
  }

  const makeBtnStyle = (color: string): React.CSSProperties => ({
    fontFamily: TERM_FONT,
    fontSize: '12px',
    padding: '4px 12px',
    border: `2px solid ${color}`,
    color: color,
    background: 'transparent',
    boxShadow: `2px 2px 0px 0px ${color}`,
    cursor: 'pointer',
  })

  return (
    <div className="space-y-6">
      {/* Pending header */}
      <div className="flex items-center justify-between">
        <span style={{ fontFamily: TERM_FONT, fontSize: '13px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--accent-primary, #10b981)', opacity: 0.6 }}>PENDING</span>
        <div className="flex gap-3">
          {pendingTxs.some((tx) => tx.nonce < safeInfo.nonce) && (
            <button
              onClick={() => {
                const removed = removeStalePendingTxs(safeInfo.address, safeInfo.nonce)
                toast.success(`Removed ${removed} stale transaction(s)`)
                onRefresh()
              }}
              style={{ fontFamily: TERM_FONT, fontSize: '12px', color: 'var(--accent-error, #ef4444)', opacity: 0.6, cursor: 'pointer', border: 'none', background: 'none' }}
            >
              clear-stale
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={txLoading}
            style={{ fontFamily: TERM_FONT, fontSize: '12px', color: 'var(--text-tertiary)', cursor: txLoading ? 'not-allowed' : 'pointer', border: 'none', background: 'none', opacity: txLoading ? 0.4 : 1 }}
          >
            {txLoading ? '...' : 'refresh'}
          </button>
        </div>
      </div>

      {pendingTxs.length === 0 && !txLoading && (
        <div className="py-6 text-center" style={{
          fontFamily: TERM_FONT,
          fontSize: '13px',
          color: 'var(--text-tertiary)',
          border: '2px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          boxShadow: '3px 3px 0px 0px rgba(255,255,255,0.06)',
        }}>
          no pending transactions
        </div>
      )}

      {pendingTxs.map((tx) => {
        const confirmCount = tx.confirmations?.length || 0
        const needed = tx.confirmationsRequired
        const isStale = tx.nonce < safeInfo.nonce
        const canExecute = confirmCount >= needed && !isStale
        const alreadyConfirmed = tx.confirmations?.some(
          (c) => c.owner.toLowerCase() === walletAddress.toLowerCase()
        )
        const isActionLoading = actionLoading === tx.safeTxHash

        return (
          <TerminalCard key={tx.safeTxHash}>
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3" style={{ fontFamily: TERM_FONT, fontSize: '14px' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>nonce:{tx.nonce}</span>
                  {isStale ? (
                    <span style={{ color: 'var(--accent-error, #ef4444)', opacity: 0.7 }}>[expired]</span>
                  ) : canExecute ? (
                    <span style={{ color: 'var(--accent-primary, #10b981)', textShadow: '0 0 6px var(--accent-primary, #10b981)' }}>[ready {confirmCount}/{needed}]</span>
                  ) : (
                    <span style={{ color: 'var(--accent-warning, #eab308)', opacity: 0.7 }}>[pending {confirmCount}/{needed}]</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {isOwner && !alreadyConfirmed && !canExecute && !isStale && (
                    <button
                      onClick={() => onConfirm(tx)}
                      disabled={isActionLoading}
                      style={{ ...makeBtnStyle('var(--accent-warning, #eab308)'), opacity: isActionLoading ? 0.4 : 1 }}
                    >
                      {isActionLoading ? '...' : 'confirm'}
                    </button>
                  )}
                  {alreadyConfirmed && !canExecute && (
                    <span style={{ fontFamily: TERM_FONT, fontSize: '12px', color: 'var(--accent-primary, #10b981)', opacity: 0.6 }}>signed</span>
                  )}
                  {canExecute && (
                    <button
                      onClick={() => onExecute(tx)}
                      disabled={isActionLoading}
                      style={{ ...makeBtnStyle('var(--accent-primary, #10b981)'), opacity: isActionLoading ? 0.4 : 1 }}
                    >
                      {isActionLoading ? '...' : 'execute'}
                    </button>
                  )}
                </div>
              </div>

              {/* Details */}
              <TxDetails tx={tx} contracts={contracts} />

              {/* Confirmations */}
              {tx.confirmations && tx.confirmations.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '8px' }}>
                  <div style={{ fontFamily: TERM_FONT, fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>sigs:</div>
                  <div className="flex flex-wrap gap-3">
                    {tx.confirmations.map((c, ci) => (
                      <span key={ci} style={{ fontFamily: TERM_FONT, fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {shorten(c.owner, 4, 4)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TerminalCard>
        )
      })}

      {/* Executed History */}
      <div className="mt-8 pt-6" style={{ borderTop: '2px solid var(--border-color)' }}>
        <div className="flex items-center justify-between mb-4">
          <span style={{ fontFamily: TERM_FONT, fontSize: '13px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-tertiary)', opacity: 0.6 }}>HISTORY</span>
          {historyLoading && <span style={{ fontFamily: TERM_FONT, fontSize: '12px', color: 'var(--text-tertiary)' }}>loading...</span>}
        </div>

        {historyLoading && executedTxs.length === 0 && (
          <div className="py-6 text-center" style={{ fontFamily: TERM_FONT, fontSize: '13px', color: 'var(--text-tertiary)' }}>scanning blocks...</div>
        )}
        {!historyLoading && executedTxs.length === 0 && (
          <div className="py-6 text-center" style={{ fontFamily: TERM_FONT, fontSize: '13px', color: 'var(--text-tertiary)', opacity: 0.5 }}>no executed transactions</div>
        )}

        <div className="space-y-3">
          {executedTxs.map((tx) => (
            <TerminalCard key={tx.txHash}>
              <div className="space-y-2" style={{ fontSize: '14px' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span style={{ fontFamily: TERM_FONT, color: tx.success ? 'var(--accent-primary, #10b981)' : 'var(--accent-error, #ef4444)', textShadow: tx.success ? '0 0 6px var(--accent-primary, #10b981)' : 'none' }}>
                      {tx.success ? 'ok' : 'fail'}
                    </span>
                    <span style={{ fontFamily: TERM_FONT, color: 'var(--text-tertiary)' }}>#{tx.blockNumber}</span>
                  </div>
                  <a
                    href={`https://sepolia.basescan.org/tx/${tx.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontFamily: TERM_FONT, fontSize: '13px', color: 'var(--text-tertiary)' }}
                  >
                    {shorten(tx.txHash, 6, 4)}
                  </a>
                </div>
                <div style={{ fontFamily: TERM_FONT, color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>to:</span> {shorten(tx.to)}
                  {contracts.find((c) => c.address.toLowerCase() === tx.to.toLowerCase()) && (
                    <span style={{ color: 'var(--text-tertiary)', marginLeft: '6px' }}>
                      ({contracts.find((c) => c.address.toLowerCase() === tx.to.toLowerCase())!.name})
                    </span>
                  )}
                </div>
                {tx.data && tx.data !== '0x' && (
                  <div className="truncate max-w-md" style={{ fontFamily: TERM_FONT, color: 'var(--text-tertiary)', opacity: 0.5 }}>{tx.data.slice(0, 66)}...</div>
                )}
                {tx.value !== '0' && (
                  <div style={{ fontFamily: TERM_FONT, color: 'var(--text-secondary)' }}>
                    value: <span style={{ color: 'var(--accent-primary, #10b981)' }}>{ethers.formatEther(tx.value)} ETH</span>
                  </div>
                )}
                <div className="flex items-center gap-4" style={{ fontFamily: TERM_FONT, fontSize: '12px', color: 'var(--text-tertiary)', opacity: 0.5 }}>
                  {tx.timestamp > 0 && <span>{new Date(tx.timestamp * 1000).toLocaleString()}</span>}
                  <span>by {shorten(tx.executor, 4, 4)}</span>
                </div>
              </div>
            </TerminalCard>
          ))}
        </div>
      </div>
    </div>
  )
}

function TxDetails({ tx, contracts }: {
  tx: { to: string; data: string; value: string; submissionDate: string }
  contracts: { name: string; address: string }[]
}) {
  return (
    <div className="space-y-1" style={{ fontSize: '14px' }}>
      <div style={{ fontFamily: TERM_FONT, color: 'var(--text-secondary)' }}>
        <span style={{ color: 'var(--text-tertiary)' }}>to:</span> <span>{shorten(tx.to)}</span>
        {contracts.find((c) => c.address.toLowerCase() === tx.to.toLowerCase()) && (
          <span style={{ color: 'var(--text-tertiary)', marginLeft: '6px' }}>
            ({contracts.find((c) => c.address.toLowerCase() === tx.to.toLowerCase())!.name})
          </span>
        )}
      </div>
      {tx.data && tx.data !== '0x' && (
        <div className="truncate max-w-md" style={{ fontFamily: TERM_FONT, color: 'var(--text-tertiary)', opacity: 0.5 }}>{tx.data.slice(0, 66)}...</div>
      )}
      {tx.value !== '0' && (
        <div style={{ fontFamily: TERM_FONT, color: 'var(--text-secondary)' }}>
          value: <span style={{ color: 'var(--accent-primary, #10b981)' }}>{ethers.formatEther(tx.value)} ETH</span>
        </div>
      )}
      <div style={{ fontFamily: TERM_FONT, fontSize: '12px', color: 'var(--text-tertiary)', opacity: 0.5 }}>{new Date(tx.submissionDate).toLocaleString()}</div>
    </div>
  )
}
