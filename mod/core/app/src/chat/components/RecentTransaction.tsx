"use client";

import { useState, useEffect } from 'react'
import { userContext } from '@/context'
import { text2color, timeAgo } from '@/utils'
import { CopyButton } from '@/ui/CopyButton'
import Link from 'next/link'

interface Transaction {
  fn: string
  params: any
  status: string
  time: string
  key: string
  signature: string
  result?: any
  cid?: string
  hash?: string
  delta?: number
  client?: string
  cost?: number
  module?: string
  owner?: string
}

export function RecentTransaction() {
  const { client } = userContext()
  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [loading, setLoading] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)

  const fetchRecentTransaction = async () => {
    if (!client) return
    setLoading(true)
    try {
      const result = await client.call('txs', { df: 0, n: 1, page: 0 })
      const txs = Array.isArray(result) ? result : []
      if (txs.length > 0) {
        setTransaction(txs[0])
      }
    } catch (err) {
      console.error('Failed to fetch recent transaction:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch once on mount - no polling
  useEffect(() => {
    fetchRecentTransaction()
    // Removed interval - only fetches once
  }, [client])

  // Update elapsed time for running transactions
  useEffect(() => {
    if (!transaction) return

    const hasCompleted = transaction.result !== undefined && transaction.result !== null
    const isInProgress = (transaction.status === 'running' || transaction.status === 'pending') && !hasCompleted

    if (!isInProgress) return

    const startTime = parseInt(transaction.time) * 1000
    const updateElapsed = () => {
      const elapsed = Date.now() - startTime
      setElapsedTime(Math.floor(elapsed / 1000))
    }

    updateElapsed()
    const interval = setInterval(updateElapsed, 1000)
    return () => clearInterval(interval)
  }, [transaction])

  if (!transaction) return null

  const hasCompleted = transaction.result !== undefined && transaction.result !== null
  const isInProgress = (transaction.status === 'running' || transaction.status === 'pending') && !hasCompleted

  const getStatusStyles = (s: string, hasResult: boolean) => {
    if (hasResult && (s === 'pending' || s === 'running')) {
      return {
        dot: 'bg-emerald-500',
        text: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        displayStatus: 'complete'
      }
    }

    if (s === 'running') return {
      dot: 'bg-blue-500',
      text: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      displayStatus: s
    }
    if (s === 'pending') return {
      dot: 'bg-amber-500',
      text: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      displayStatus: s
    }
    if (s === 'success' || s === 'finished' || s === 'complete') return {
      dot: 'bg-emerald-500',
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      displayStatus: s
    }
    return {
      dot: 'bg-red-500',
      text: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      displayStatus: s
    }
  }

  const status = getStatusStyles(transaction.status, hasCompleted)
  const fnColor = text2color(transaction.fn || transaction.key)
  const timestamp = parseInt(transaction.time)
  const time = isNaN(timestamp) ? transaction.time : timeAgo(timestamp * 1000)
  const cost = transaction.cost?.toFixed(2) || '0.00'

  const renderValue = (value: any) => {
    if (value === null || value === undefined) return <span className="text-neutral-600 text-sm font-mono">null</span>
    if (typeof value === 'object') {
      const jsonString = JSON.stringify(value, null, 2)
      return (
        <div className="relative group">
          <pre
            className="text-sm text-green-400 overflow-auto whitespace-pre-wrap leading-relaxed scrollbar-thin font-mono"
            style={{
              maxHeight: '320px'
            }}
          >
            {jsonString}
          </pre>
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-lg p-1 backdrop-blur-sm">
            <CopyButton text={jsonString} size="sm" showValueOnHover={false} />
          </div>
        </div>
      )
    }
    return <span className="text-green-400 text-sm break-all font-mono">{String(value)}</span>
  }

  return (
    <div className="flex-shrink-0">
      <div
        className={`border-2 rounded-lg backdrop-blur-sm transition-all relative overflow-hidden bg-black/80 border-purple-500/60 hover:border-purple-500/80`}
        style={{ fontFamily: 'IBM Plex Mono, monospace' }}
      >
        {/* Progress bar for running/pending transactions */}
        {isInProgress && (
          <>
            <div className="absolute top-0 left-0 right-0 h-1 bg-purple-900/30 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
                style={{
                  width: '40%',
                  animation: 'slideProgress 2s ease-in-out infinite'
                }}
              />
            </div>
            <style>
              {`
                @keyframes slideProgress {
                  0% { transform: translateX(-100%); }
                  100% { transform: translateX(350%); }
                }
              `}
            </style>
          </>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-purple-500/30">
          {/* Hash/ID with icon */}
          {(transaction.hash || transaction.cid) && (
            <div className="flex items-center gap-1">
              <div className="text-purple-500 text-lg">📄</div>
              <CopyButton text={transaction.hash || transaction.cid || ''} size="sm" showValueOnHover={true} />
            </div>
          )}

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold uppercase tracking-wider ${status.text}`}>
              {status.displayStatus}
            </span>
          </div>

          {/* Function name */}
          <Link
            href={`/mod/${transaction.fn}/${transaction.owner || transaction.module || transaction.key}`}
            className="text-sm font-bold hover:underline truncate text-cyan-400 hover:text-cyan-300"
          >
            {transaction.fn}
          </Link>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Info */}
          <div className="flex items-center gap-3 text-sm">
            {/* User Key */}
            {transaction.key && (
              <div className="flex items-center gap-1">
                <div className="text-purple-500 text-sm">👤</div>
                <CopyButton text={transaction.key} size="sm" showValueOnHover={true} />
              </div>
            )}

            {/* Owner */}
            {transaction.owner && (
              <div className="flex items-center gap-1">
                <div className="text-purple-500 text-sm">👑</div>
                <CopyButton text={transaction.owner} size="sm" showValueOnHover={true} />
              </div>
            )}

            {/* Cost */}
            <div className="flex items-center gap-1">
              <span className="text-purple-500">$</span>
              <span className="text-cyan-400 font-bold">${cost}</span>
            </div>

            {/* Duration or Elapsed Time */}
            {isInProgress ? (
              <div className="flex items-center gap-1">
                <span className="text-purple-500">⏱</span>
                <span className="text-cyan-400 font-bold tabular-nums">{elapsedTime}s</span>
              </div>
            ) : transaction.delta !== undefined && (
              <div className="flex items-center gap-1">
                <span className="text-purple-500">⏱</span>
                <span className="text-cyan-400 font-bold">{transaction.delta.toFixed(1)}s</span>
              </div>
            )}

            {/* Time */}
            {!isInProgress && (
              <span className="text-purple-400/60 text-xs font-medium">{time}</span>
            )}
          </div>
        </div>

        {/* Result section - only show when complete */}
        {hasCompleted && transaction.result && (
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between mb-2 mt-1">
              <div className="text-xs text-purple-400 font-bold uppercase tracking-wider">OUTPUT</div>
            </div>
            <div className="bg-black border border-purple-500/40 rounded-lg p-4 overflow-auto max-h-64">
              {renderValue(transaction.result)}
            </div>
          </div>
        )}

        {/* Running indicator */}
        {isInProgress && (
          <div className="px-4 pb-3 text-center">
            <span className="text-xs text-cyan-400 font-bold animate-pulse uppercase tracking-wider">Processing...</span>
          </div>
        )}
      </div>
    </div>
  )
}
