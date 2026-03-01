"use client";

import { useState, useEffect } from 'react'
import { CopyButton } from '@/ui/CopyButton'
import { timeAgo, text2color } from '@/utils'
import { userContext } from '@/context'

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
  isCurrentMode?: boolean
}

export function TransactionCard({ tx, idx, isExpanded = false, compact = false, isCurrentMode = false }: TransactionCardProps) {
  const { client } = userContext()
  const [activeTab, setActiveTab] = useState<'params' | 'results' | 'code'>('results')
  const [elapsedTime, setElapsedTime] = useState(0)
  const [moduleCode, setModuleCode] = useState<string | null>(null)
  const [loadingCode, setLoadingCode] = useState(false)

  // Check if transaction is truly complete - has result means it's done
  const hasCompleted = tx.result !== undefined && tx.result !== null
  const isInProgress = (tx.status === 'running' || tx.status === 'pending') && !hasCompleted

  // Fetch module code when CODE tab is selected
  useEffect(() => {
    if (activeTab === 'code' && !moduleCode && !loadingCode && client && tx.module) {
      setLoadingCode(true)
      client.call('get', { k: tx.module })
        .then((result: any) => {
          if (result?.content) {
            setModuleCode(result.content)
          }
        })
        .catch((err: any) => {
          console.error('Failed to load module code:', err)
          setModuleCode('// Failed to load code')
        })
        .finally(() => {
          setLoadingCode(false)
        })
    }
  }, [activeTab, moduleCode, loadingCode, client, tx.module])

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
        text: 'text-emerald-500',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        glow: 'shadow-[0_0_15px_rgba(16,185,129,0.3)]',
        displayStatus: 'complete'
      }
    }

    if (s === 'running') return {
      dot: 'bg-blue-500',
      text: 'text-blue-500',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      glow: 'shadow-[0_0_15px_rgba(59,130,246,0.3)]',
      displayStatus: s
    }
    if (s === 'pending') return {
      dot: 'bg-amber-500',
      text: 'text-amber-500',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      glow: 'shadow-[0_0_15px_rgba(245,158,11,0.3)]',
      displayStatus: s
    }
    if (s === 'success' || s === 'finished' || s === 'complete') return {
      dot: 'bg-emerald-500',
      text: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.3)]',
      displayStatus: s
    }
    return {
      dot: 'bg-red-500',
      text: 'text-red-500',
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
    if (value === null || value === undefined) return <span className="text-sm font-mono text-gray-500">null</span>
    if (typeof value === 'object') {
      const jsonString = JSON.stringify(value, null, 2)

      // Syntax highlighted JSON
      const highlightedJson = jsonString
        .split('\n')
        .map((line, i) => {
          // Color property names (keys)
          line = line.replace(/"([^"]+)":/g, '<span class="text-cyan-400">"$1"</span>:')
          // Color string values
          line = line.replace(/: "([^"]+)"/g, ': <span class="text-green-400">"$1"</span>')
          // Color numbers
          line = line.replace(/: (\d+\.?\d*)/g, ': <span class="text-purple-400">$1</span>')
          // Color booleans
          line = line.replace(/: (true|false)/g, ': <span class="text-yellow-400">$1</span>')
          // Color null
          line = line.replace(/: null/g, ': <span class="text-gray-500">null</span>')
          return line
        })
        .join('\n')

      return (
        <div className="relative group">
          <pre
            className="text-sm overflow-x-auto leading-relaxed font-mono p-3 rounded-lg border"
            style={{
              backgroundColor: 'rgba(0,0,0,0.3)',
              borderColor: 'rgba(100,100,100,0.2)'
            }}
            dangerouslySetInnerHTML={{ __html: highlightedJson }}
          />
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <CopyButton text={jsonString} size="sm" />
          </div>
        </div>
      )
    }
    return <span className="text-green-400 text-sm break-all font-mono">{String(value)}</span>
  }

  const renderPreview = (value: any) => {
    if (value === null || value === undefined) return 'null'
    if (typeof value === 'object') {
      const jsonString = JSON.stringify(value)
      return jsonString.length > 60 ? jsonString.slice(0, 60) + '...' : jsonString
    }
    const strValue = String(value)
    return strValue.length > 60 ? strValue.slice(0, 60) + '...' : strValue
  }

  return (
    <div
      className={`group border-2 rounded-lg backdrop-blur-sm transition-all ${isCurrentMode ? '' : 'cursor-pointer'} relative overflow-hidden border-purple-500/60 hover:border-purple-500/80`}
      style={{ fontFamily: 'IBM Plex Mono, monospace', backgroundColor: 'var(--bg-surface)' }}
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
      <div className={`flex items-center gap-2 ${compact ? 'px-2 py-2' : 'px-4 py-3'}`} style={{ borderBottom: '1px solid var(--border-color)' }}>
        {/* Status indicator with animation for in-progress */}
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${status.dot} ${isInProgress ? 'animate-pulse' : ''}`} />
          <span className={`${compact ? 'text-[10px]' : 'text-xs'} font-bold uppercase tracking-wider ${status.text}`}>
            {compact ? status.displayStatus.slice(0, 3) : status.displayStatus}
          </span>
        </div>

        {/* Function name */}
        <div className={`${compact ? 'text-xs' : 'text-sm'} font-bold truncate text-cyan-500 flex-1 min-w-0`}>
          {tx.fn}
        </div>

        {/* Hash/ID with icon */}
        {(tx.hash || tx.cid) && (
          <div className="flex items-center gap-1">
            <div className={`text-purple-500 ${compact ? 'text-sm' : 'text-base'}`}>📄</div>
            <CopyButton text={tx.hash || tx.cid || ''} size="sm" showValueOnHover={true} />
          </div>
        )}

        {/* Tabs - inline on header when expanded */}
        {isExpanded && (hasParams || hasResults || tx.module) && (
          <div className="flex gap-0 border border-purple-500/40 rounded-lg p-0.5" style={{ backgroundColor: 'var(--bg-input)' }}>
            {hasResults && (
              <button
                onClick={(e) => { e.stopPropagation(); setActiveTab('results'); }}
                className={`px-2 py-1 text-xs font-bold uppercase rounded transition-all ${
                  activeTab === 'results'
                    ? 'bg-purple-500/20 text-cyan-500 border border-purple-500'
                    : 'hover:text-purple-400'
                }`}
                style={{ color: activeTab === 'results' ? undefined : 'var(--text-tertiary)' }}
              >
                Result
              </button>
            )}
            {hasParams && (
              <button
                onClick={(e) => { e.stopPropagation(); setActiveTab('params'); }}
                className={`px-2 py-1 text-xs font-bold uppercase rounded transition-all ${
                  activeTab === 'params'
                    ? 'bg-purple-500/20 text-cyan-500 border border-purple-500'
                    : 'hover:text-purple-400'
                }`}
                style={{ color: activeTab === 'params' ? undefined : 'var(--text-tertiary)' }}
              >
                Params
              </button>
            )}
            {tx.module && (
              <button
                onClick={(e) => { e.stopPropagation(); setActiveTab('code'); }}
                className={`px-2 py-1 text-xs font-bold uppercase rounded transition-all ${
                  activeTab === 'code'
                    ? 'bg-purple-500/20 text-cyan-500 border border-purple-500'
                    : 'hover:text-purple-400'
                }`}
                style={{ color: activeTab === 'code' ? undefined : 'var(--text-tertiary)' }}
              >
                Code
              </button>
            )}
          </div>
        )}

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
            <span className="text-cyan-500 font-bold">{cost}</span>
          </div>

          {/* Duration - Enhanced with live timer */}
          {isInProgress ? (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-blue-500/10 border border-blue-500/30">
              <span className="text-blue-500 text-xs">⏱</span>
              <span className="text-blue-400 font-bold tabular-nums">{elapsedTime}s</span>
              <span className="text-blue-400 text-xs animate-pulse">●</span>
            </div>
          ) : tx.delta !== undefined && (
            <div className="flex items-center gap-0.5">
              <span className="text-purple-500 text-xs">⏱</span>
              <span className="text-cyan-500 font-bold">{tx.delta.toFixed(1)}s</span>
            </div>
          )}

          {/* Timestamp */}
          {!compact && (
            <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--text-tertiary)' }}>{time}</span>
          )}
        </div>
      </div>

      {/* Input preview when collapsed - Enhanced to show first positional param */}
      {!isExpanded && hasParams && (
        <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)' }}>
          <div className="flex items-start gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-500 flex-shrink-0">Input:</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                {typeof tx.params === 'object' && tx.params !== null ? (
                  <div className="space-y-0.5">
                    {/* Show first positional param prominently */}
                    {Object.entries(tx.params).slice(0, 1).map(([key, value]) => (
                      <div key={key} className="font-semibold">
                        <span className="text-cyan-400">{key}</span>
                        <span className="text-purple-500">:</span>{' '}
                        <span className="text-green-400">{renderPreview(value)}</span>
                      </div>
                    ))}
                    {/* Show count of remaining params */}
                    {Object.keys(tx.params).length > 1 && (
                      <div className="text-purple-400 text-[10px] mt-1">
                        +{Object.keys(tx.params).length - 1} more param{Object.keys(tx.params).length > 2 ? 's' : ''}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-green-400">{renderPreview(tx.params)}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Waiting state indicator when collapsed */}
      {!isExpanded && isInProgress && (
        <div className="px-4 py-2 flex items-center gap-2" style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)' }}>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-medium text-blue-400">Waiting for result...</span>
            <span className="text-xs text-blue-500 tabular-nums font-mono">{elapsedTime}s</span>
          </div>
        </div>
      )}

      {/* Expanded Content */}
      {isExpanded && (hasParams || hasResults || tx.module) && (
        <div className="px-4 pb-4 pt-3">
          {/* Content */}
          <div className="border border-purple-500/40 rounded-lg p-4 max-h-96 overflow-auto scrollbar-thin scrollbar-thumb-purple-900/50" style={{ backgroundColor: 'var(--bg-input)' }}>
            {activeTab === 'results' && hasResults && renderValue(tx.result)}
            {activeTab === 'params' && hasParams && renderValue(tx.params)}
            {activeTab === 'code' && (
              loadingCode ? (
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-500/30 border-t-purple-500" />
                  <span>Loading code...</span>
                </div>
              ) : moduleCode ? (
                <div className="relative group">
                  <pre className="text-sm text-green-500 overflow-x-auto whitespace-pre-wrap leading-relaxed font-mono">
                    {moduleCode}
                  </pre>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <CopyButton text={moduleCode} size="sm" />
                  </div>
                </div>
              ) : (
                <span className="text-sm font-mono" style={{ color: 'var(--text-tertiary)' }}>
                  No code available
                </span>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}
