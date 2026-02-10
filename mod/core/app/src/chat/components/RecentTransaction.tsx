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

  // Poll every 2 seconds
  useEffect(() => {
    fetchRecentTransaction()
    const interval = setInterval(fetchRecentTransaction, 2000)
    return () => clearInterval(interval)
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
  const cost = transaction.cost?.toFixed(4) || '0.0000'

  const renderValue = (value: any) => {
    if (value === null || value === undefined) return <span className="text-neutral-600 text-sm">null</span>
    if (typeof value === 'object') {
      const jsonString = JSON.stringify(value, null, 2)
      return (
        <div className="relative group">
          <pre
            className="text-sm text-neutral-200 overflow-auto whitespace-pre leading-relaxed scrollbar-thin"
            style={{
              fontFamily: 'SF Mono, Monaco, Consolas, monospace',
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
    return <span className="text-neutral-200 text-sm break-all">{String(value)}</span>
  }

  return (
    <div className="flex-shrink-0">
      <div
        className={`border rounded-2xl backdrop-blur-sm transition-all relative overflow-hidden bg-neutral-950/40 border-neutral-800/50`}
        style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif', letterSpacing: '-0.01em' }}
      >
        {/* Progress bar for running/pending transactions */}
        {isInProgress && (
          <>
            <div className="absolute top-0 left-0 right-0 h-1 bg-neutral-900/50 overflow-hidden rounded-t-2xl">
              <div
                className="h-full bg-gradient-to-r from-transparent via-white/40 to-transparent"
                style={{
                  width: '30%',
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
        <div className="flex items-center gap-3 px-4 py-3.5">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${status.dot} ${isInProgress ? 'animate-pulse' : ''}`} />
            <span className={`text-[11px] font-medium uppercase tracking-wide ${status.text}`}>
              {status.displayStatus}
            </span>
          </div>

          {/* Function name */}
          <Link
            href={`/mod/${transaction.fn}/${transaction.owner || transaction.module || transaction.key}`}
            className="text-sm font-semibold hover:underline truncate"
            style={{ color: fnColor }}
          >
            {transaction.fn}
          </Link>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Info */}
          <div className="flex items-center gap-3 text-xs">
            {/* Cost */}
            <div className="flex items-center gap-1">
              <span className="text-neutral-500">$</span>
              <span className="text-green-400 font-semibold tabular-nums">{cost}</span>
            </div>

            {/* Duration or Elapsed Time */}
            {isInProgress ? (
              <div className="flex items-center gap-1">
                <span className="text-neutral-500">⏱</span>
                <span className="text-white font-semibold tabular-nums">{elapsedTime}s</span>
              </div>
            ) : transaction.delta !== undefined && (
              <div className="flex items-center gap-1">
                <span className="text-neutral-500">⏱</span>
                <span className="text-white/70 font-medium tabular-nums">{transaction.delta.toFixed(1)}s</span>
              </div>
            )}

            {/* Time */}
            {!isInProgress && (
              <span className="text-neutral-600 text-[11px] font-medium">{time}</span>
            )}

            {/* Copy hash */}
            {(transaction.hash || transaction.cid) && (
              <CopyButton text={transaction.hash || transaction.cid || ''} size="sm" />
            )}
          </div>
        </div>

        {/* Result section - only show when complete */}
        {hasCompleted && transaction.result && (
          <div className="px-4 pb-4 border-t border-neutral-800/50">
            <div className="flex items-center justify-between mb-2 mt-3">
              <div className="text-[11px] text-neutral-500 font-semibold uppercase tracking-wide">Result</div>
              <div className="text-[10px] text-neutral-600 font-medium">Scroll to view more</div>
            </div>
            <div className="bg-black/40 border border-neutral-800/50 rounded-xl p-4 overflow-hidden">
              {renderValue(transaction.result)}
            </div>
          </div>
        )}

        {/* Running indicator */}
        {isInProgress && (
          <div className="px-4 pb-3 text-center">
            <span className="text-xs text-white/70 font-medium animate-pulse">Processing...</span>
          </div>
        )}
      </div>
    </div>
  )
}
