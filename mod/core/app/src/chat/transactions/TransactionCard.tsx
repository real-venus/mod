"use client";

import { useState, useEffect } from 'react'
import { CopyButton } from '@/ui/CopyButton'
import { timeAgo, text2color } from '@/utils'
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

interface TransactionCardProps {
  tx: Transaction
  idx: number
  isExpanded?: boolean
}

export function TransactionCard({ tx, idx, isExpanded = false }: TransactionCardProps) {
  const [activeTab, setActiveTab] = useState<'params' | 'results'>('results')
  const [elapsedTime, setElapsedTime] = useState(0)

  // Check if transaction is truly complete - has result means it's done
  const hasCompleted = tx.result !== undefined && tx.result !== null
  const isInProgress = (tx.status === 'running' || tx.status === 'pending') && !hasCompleted

  // Update elapsed time for running transactions
  useEffect(() => {
    if (!isInProgress) return

    const startTime = parseInt(tx.time) * 1000
    const updateElapsed = () => {
      const elapsed = Date.now() - startTime
      setElapsedTime(Math.floor(elapsed / 1000))
    }

    updateElapsed()
    const interval = setInterval(updateElapsed, 1000)
    return () => clearInterval(interval)
  }, [isInProgress, tx.time])

  const getStatusStyles = (s: string, hasResult: boolean) => {
    // If transaction has a result, it's complete regardless of status field
    if (hasResult && (s === 'pending' || s === 'running')) {
      return {
        dot: 'bg-emerald-500',
        text: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        glow: 'shadow-[0_0_15px_rgba(16,185,129,0.3)]',
        displayStatus: 'complete'
      }
    }

    if (s === 'running') return {
      dot: 'bg-blue-500',
      text: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      glow: 'shadow-[0_0_15px_rgba(59,130,246,0.3)]',
      displayStatus: s
    }
    if (s === 'pending') return {
      dot: 'bg-amber-500',
      text: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      glow: 'shadow-[0_0_15px_rgba(245,158,11,0.3)]',
      displayStatus: s
    }
    if (s === 'success' || s === 'finished' || s === 'complete') return {
      dot: 'bg-emerald-500',
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.3)]',
      displayStatus: s
    }
    return {
      dot: 'bg-red-500',
      text: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      glow: 'shadow-[0_0_15px_rgba(239,68,68,0.3)]',
      displayStatus: s
    }
  }

  const status = getStatusStyles(tx.status, hasCompleted)
  const fnColor = text2color(tx.fn || tx.key)
  const timestamp = parseInt(tx.time)
  const time = isNaN(timestamp) ? tx.time : timeAgo(timestamp * 1000)
  const cost = tx.cost?.toFixed(4) || '0.0000'
  const hasParams = tx.params !== null && tx.params !== undefined
  const hasResults = tx.result !== undefined

  const renderValue = (value: any) => {
    if (value === null || value === undefined) return <span className="text-gray-500 text-sm font-medium">null</span>
    if (typeof value === 'object') {
      return (
        <pre className="text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
          {JSON.stringify(value, null, 2)}
        </pre>
      )
    }
    return <span className="text-gray-200 text-sm break-all font-medium">{String(value)}</span>
  }

  return (
    <div
      className={`group border rounded-xl backdrop-blur-sm transition-all hover:scale-[1.005] cursor-pointer relative overflow-hidden ${status.bg} ${status.border} ${status.glow}`}
      style={{ fontFamily: 'JetBrains Mono, monospace' }}
    >
      {/* Progress bar for running/pending transactions */}
      {isInProgress && (
        <>
          <div className="absolute top-0 left-0 right-0 h-1 bg-neutral-800/50 overflow-hidden">
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

      {/* Enhanced Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Client (from) and Owner (to) - moved to left */}
        <div className="flex flex-col gap-0.5 min-w-[110px]">
          {tx.client && (
            <span className="text-xs text-gray-500 font-medium">
              {tx.client.slice(0, 6)}...{tx.client.slice(-4)}
            </span>
          )}
          {(tx.owner || tx.key) && (
            <Link
              href={`/user/${tx.owner || tx.key}`}
              onClick={(e) => e.stopPropagation()}
              className="text-base text-gray-300 hover:text-gray-100 font-semibold transition-colors"
            >
              {(tx.owner || tx.key).slice(0, 6)}...{(tx.owner || tx.key).slice(-4)}
            </Link>
          )}
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 min-w-[100px]">
          <span className={`w-2.5 h-2.5 rounded-full ${status.dot} flex-shrink-0 ${isInProgress ? 'animate-pulse' : ''}`} />
          <span className={`text-xs font-bold uppercase tracking-wider ${status.text}`}>
            {status.displayStatus}
          </span>
        </div>

        {/* Function name - larger and more prominent */}
        <Link
          href={`/mod/${tx.fn}/${tx.owner || tx.module || tx.key}`}
          onClick={(e) => e.stopPropagation()}
          className="text-base font-bold hover:underline truncate flex-shrink-0"
          style={{ color: fnColor }}
        >
          {tx.fn}
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side info - larger fonts */}
        <div className="flex items-center gap-4">
          {/* Cost */}
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400/60 text-sm">💰</span>
            <span className="text-base text-emerald-400 font-bold">${cost}</span>
          </div>

          {/* Duration or Elapsed Time */}
          {isInProgress ? (
            <div className="flex items-center gap-1.5">
              <span className="text-yellow-400/60 text-sm animate-pulse">⏱</span>
              <span className="text-base text-yellow-400 font-semibold tabular-nums">{elapsedTime}s</span>
            </div>
          ) : tx.delta !== undefined && (
            <div className="flex items-center gap-1.5">
              <span className="text-cyan-400/60 text-sm">⏱</span>
              <span className="text-base text-cyan-400 font-semibold">{tx.delta.toFixed(1)}s</span>
            </div>
          )}

          {/* Time */}
          {!isInProgress && (
            <span className="text-sm text-gray-500 font-medium min-w-[80px] text-right">{time}</span>
          )}

          {/* Running indicator */}
          {isInProgress && (
            <span className="text-sm text-yellow-400 font-semibold animate-pulse">Running...</span>
          )}

          {/* Copy hash */}
          {(tx.hash || tx.cid) && (
            <CopyButton text={tx.hash || tx.cid || ''} size="sm" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (hasParams || hasResults) && (
        <div className="px-4 pb-4 pt-2 border-t border-white/10">
          {/* Tabs - larger and more prominent */}
          {hasParams && hasResults && (
            <div className="flex gap-2 mb-3">
              <button
                onClick={(e) => { e.stopPropagation(); setActiveTab('results'); }}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                  activeTab === 'results'
                    ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
              >
                Result
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveTab('params'); }}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                  activeTab === 'params'
                    ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
              >
                Params
              </button>
            </div>
          )}

          {/* Content - larger font */}
          <div className="bg-black/60 border border-white/10 rounded-lg p-4 max-h-64 overflow-auto text-sm">
            {activeTab === 'results' && hasResults ? renderValue(tx.result) : hasParams ? renderValue(tx.params) : null}
          </div>
        </div>
      )}
    </div>
  )
}