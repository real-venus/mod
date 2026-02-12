"use client";

import { useState, useEffect } from 'react'
import { CopyButton } from '@/ui/CopyButton'
import { timeAgo, text2color } from '@/utils'

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
  compact?: boolean
}

export function TransactionCard({ tx, idx, isExpanded = false, compact = false }: TransactionCardProps) {
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
  const cost = tx.cost?.toFixed(2) || '0.00'
  const hasParams = tx.params !== null && tx.params !== undefined
  const hasResults = tx.result !== undefined

  const renderValue = (value: any) => {
    if (value === null || value === undefined) return <span className="text-neutral-600 text-sm font-mono">null</span>
    if (typeof value === 'object') {
      return (
        <pre className="text-sm text-green-400 overflow-x-auto whitespace-pre-wrap leading-relaxed font-mono">
          {JSON.stringify(value, null, 2)}
        </pre>
      )
    }
    return <span className="text-green-400 text-sm break-all font-mono">{String(value)}</span>
  }

  return (
    <div
      className={`group border-2 rounded-lg backdrop-blur-sm transition-all cursor-pointer relative overflow-hidden bg-black/80 border-purple-500/60 hover:border-purple-500/80`}
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

      {/* Header - Terminal Style */}
      <div className={`flex items-center gap-2 border-b border-purple-500/30 ${compact ? 'px-2 py-2' : 'px-4 py-3'}`}>
        {/* Hash/ID with icon */}
        {(tx.hash || tx.cid) && (
          <div className="flex items-center gap-1">
            <div className={`text-purple-500 ${compact ? 'text-sm' : 'text-lg'}`}>📄</div>
            <CopyButton text={tx.hash || tx.cid || ''} size="sm" showValueOnHover={true} />
          </div>
        )}

        {/* Status indicator */}
        <div className="flex items-center gap-1">
          <span className={`${compact ? 'text-[10px]' : 'text-xs'} font-bold uppercase tracking-wider ${status.text}`}>
            {compact ? status.displayStatus.slice(0, 3) : status.displayStatus}
          </span>
        </div>

        {/* Function name */}
        <div className={`${compact ? 'text-xs' : 'text-sm'} font-bold truncate text-cyan-400 flex-1 min-w-0`}>
          {tx.fn}
        </div>

        {/* Right side info */}
        <div className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
          {!compact && (
            <>
              {/* User Key */}
              {tx.key && (
                <div className="flex items-center gap-1">
                  <div className="text-purple-500 text-sm">👤</div>
                  <CopyButton text={tx.key} size="sm" showValueOnHover={true} />
                </div>
              )}

              {/* Owner */}
              {tx.owner && (
                <div className="flex items-center gap-1">
                  <div className="text-purple-500 text-sm">👑</div>
                  <CopyButton text={tx.owner} size="sm" showValueOnHover={true} />
                </div>
              )}
            </>
          )}

          {/* Cost */}
          <div className="flex items-center gap-0.5">
            <span className="text-purple-500 text-xs">$</span>
            <span className="text-cyan-400 font-bold">{cost}</span>
          </div>

          {/* Duration */}
          {isInProgress ? (
            <div className="flex items-center gap-0.5">
              <span className="text-purple-500 text-xs">⏱</span>
              <span className="text-cyan-400 font-bold tabular-nums">{elapsedTime}s</span>
            </div>
          ) : tx.delta !== undefined && (
            <div className="flex items-center gap-0.5">
              <span className="text-purple-500 text-xs">⏱</span>
              <span className="text-cyan-400 font-bold">{tx.delta.toFixed(1)}s</span>
            </div>
          )}

          {!compact && !isInProgress && (
            <span className="text-purple-400/60 text-xs font-medium">{time}</span>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (hasParams || hasResults) && (
        <div className="px-4 pb-4 pt-3">
          {/* Tabs - Terminal style */}
          {hasParams && hasResults && (
            <div className="flex gap-0 mb-3 border border-purple-500/40 rounded-lg p-1 bg-black/50">
              <button
                onClick={(e) => { e.stopPropagation(); setActiveTab('results'); }}
                className={`flex-1 px-3 py-1.5 text-xs font-bold uppercase rounded transition-all ${
                  activeTab === 'results'
                    ? 'bg-purple-500/20 text-cyan-400 border border-purple-500'
                    : 'text-neutral-500 hover:text-purple-300'
                }`}
              >
                Result
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveTab('params'); }}
                className={`flex-1 px-3 py-1.5 text-xs font-bold uppercase rounded transition-all ${
                  activeTab === 'params'
                    ? 'bg-purple-500/20 text-cyan-400 border border-purple-500'
                    : 'text-neutral-500 hover:text-purple-300'
                }`}
              >
                Params
              </button>
            </div>
          )}

          {/* Content */}
          <div className="bg-black border border-purple-500/40 rounded-lg p-4 max-h-64 overflow-auto">
            {activeTab === 'results' && hasResults ? renderValue(tx.result) : hasParams ? renderValue(tx.params) : null}
          </div>
        </div>
      )}
    </div>
  )
}