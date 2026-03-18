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
            className="text-[11px] overflow-x-auto leading-relaxed font-mono p-3"
            style={{
              backgroundColor: 'rgba(0,0,0,0.4)',
              border: '2px solid rgba(168,85,247,0.15)',
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

  const statusIcon = hasCompleted
    ? (tx.status === 'error' || tx.status === 'failed') ? '✗' : '✓'
    : isInProgress ? '▶' : '●'

  return (
    <div
      className={`group transition-all ${isCurrentMode ? '' : 'cursor-pointer'} relative overflow-hidden`}
      style={{
        fontFamily: 'var(--font-digital), monospace',
        backgroundColor: 'var(--bg-surface)',
        border: `3px solid ${isInProgress ? 'rgba(59,130,246,0.6)' : hasCompleted ? 'rgba(16,185,129,0.4)' : 'rgba(168,85,247,0.4)'}`,
        boxShadow: isInProgress
          ? '0 0 12px rgba(59,130,246,0.15), inset 0 0 20px rgba(59,130,246,0.03)'
          : hasCompleted
            ? '0 0 8px rgba(16,185,129,0.1)'
            : '0 0 8px rgba(168,85,247,0.1)',
        imageRendering: 'pixelated' as any,
      }}
    >
      {/* 8-bit pixel progress bar for running transactions */}
      {isInProgress && (
        <>
          <div className="absolute top-0 left-0 right-0 h-[3px] overflow-hidden" style={{ backgroundColor: 'rgba(59,130,246,0.15)' }}>
            <div
              className="h-full"
              style={{
                width: '30%',
                background: 'repeating-linear-gradient(90deg, #3b82f6 0px, #3b82f6 4px, transparent 4px, transparent 8px)',
                animation: 'pixelSlide 1.5s steps(20) infinite',
              }}
            />
          </div>
          <style>
            {`
              @keyframes pixelSlide {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(400%); }
              }
            `}
          </style>
        </>
      )}

      {/* Header */}
      <div className={`flex items-center gap-2.5 ${compact ? 'px-3 py-2' : 'px-4 py-3'}`} style={{ borderBottom: '2px solid var(--border-color)' }}>
        {/* Pixel status indicator */}
        <div className="flex items-center gap-2">
          <span className={`text-base font-bold ${status.text}`} style={{ textShadow: isInProgress ? '0 0 6px currentColor' : 'none' }}>
            {statusIcon}
          </span>
          <span className={`text-xs font-bold uppercase tracking-[0.15em] ${status.text}`}>
            {compact ? status.displayStatus.slice(0, 3).toUpperCase() : status.displayStatus.toUpperCase()}
          </span>
        </div>

        {/* Function name - pixel style */}
        <div className={`${compact ? 'text-sm' : 'text-base'} font-bold truncate flex-1 min-w-0`} style={{ color: fnColor, textShadow: `0 0 8px ${fnColor}40` }}>
          {tx.fn}
        </div>

        {/* Hash/ID */}
        {(tx.hash || tx.cid) && (
          <div className="flex items-center gap-1">
            <span className="text-purple-400 text-[10px]">▪</span>
            <CopyButton text={tx.hash || tx.cid || ''} size="sm" showValueOnHover={true} />
          </div>
        )}

        {/* Tabs when expanded */}
        {isExpanded && (hasParams || hasResults || tx.module) && (
          <div className="flex gap-0" style={{ border: '2px solid rgba(168,85,247,0.3)', backgroundColor: 'var(--bg-input)' }}>
            {hasResults && (
              <button
                onClick={(e) => { e.stopPropagation(); setActiveTab('results'); }}
                className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${
                  activeTab === 'results'
                    ? 'text-cyan-400'
                    : ''
                }`}
                style={{
                  color: activeTab === 'results' ? undefined : 'var(--text-tertiary)',
                  backgroundColor: activeTab === 'results' ? 'rgba(168,85,247,0.2)' : 'transparent',
                  borderRight: '1px solid rgba(168,85,247,0.2)',
                }}
              >
                RESULT
              </button>
            )}
            {hasParams && (
              <button
                onClick={(e) => { e.stopPropagation(); setActiveTab('params'); }}
                className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${
                  activeTab === 'params'
                    ? 'text-cyan-400'
                    : ''
                }`}
                style={{
                  color: activeTab === 'params' ? undefined : 'var(--text-tertiary)',
                  backgroundColor: activeTab === 'params' ? 'rgba(168,85,247,0.2)' : 'transparent',
                  borderRight: '1px solid rgba(168,85,247,0.2)',
                }}
              >
                PARAMS
              </button>
            )}
            {tx.module && (
              <button
                onClick={(e) => { e.stopPropagation(); setActiveTab('code'); }}
                className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${
                  activeTab === 'code'
                    ? 'text-cyan-400'
                    : ''
                }`}
                style={{
                  color: activeTab === 'code' ? undefined : 'var(--text-tertiary)',
                  backgroundColor: activeTab === 'code' ? 'rgba(168,85,247,0.2)' : 'transparent',
                }}
              >
                CODE
              </button>
            )}
          </div>
        )}

        {/* Right side info */}
        <div className={`flex items-center gap-2.5 ${compact ? 'text-xs' : 'text-sm'}`}>
          {!compact && (
            <>
              {tx.key && (
                <div className="flex items-center gap-1">
                  <span className="text-purple-400 text-xs">◆</span>
                  <CopyButton text={tx.key} size="sm" showValueOnHover={true} />
                </div>
              )}
              {tx.owner && (
                <div className="flex items-center gap-1">
                  <span className="text-amber-400 text-xs">★</span>
                  <CopyButton text={tx.owner} size="sm" showValueOnHover={true} />
                </div>
              )}
            </>
          )}

          {/* Cost */}
          <div className="flex items-center gap-1 px-2 py-1" style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(168,85,247,0.2)' }}>
            <span className="text-amber-400 text-xs font-bold">$</span>
            <span className="text-amber-300 font-bold text-sm">{cost}</span>
          </div>

          {/* Duration */}
          {isInProgress ? (
            <div className="flex items-center gap-1 px-2 py-1" style={{ backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }}>
              <span className="text-blue-400 font-bold text-sm tabular-nums">{elapsedTime}s</span>
              <span className="text-blue-400 text-[10px] animate-pulse">■</span>
            </div>
          ) : tx.delta !== undefined && (
            <div className="flex items-center gap-1 px-2 py-1" style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(168,85,247,0.2)' }}>
              <span className="text-cyan-400 font-bold text-sm">{tx.delta.toFixed(1)}s</span>
            </div>
          )}

          {/* Timestamp */}
          {!compact && (
            <span className="text-xs font-bold tabular-nums tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{time}</span>
          )}
        </div>
      </div>

      {/* Input preview when collapsed */}
      {!isExpanded && hasParams && (
        <div className="px-4 py-2.5" style={{ borderBottom: '2px solid var(--border-color)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
          <div className="flex items-start gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-purple-400 flex-shrink-0 mt-0.5">IN»</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
                {typeof tx.params === 'object' && tx.params !== null ? (
                  <div className="space-y-0.5">
                    {Object.entries(tx.params).slice(0, 1).map(([key, value]) => (
                      <div key={key} className="font-bold">
                        <span className="text-cyan-400">{key}</span>
                        <span className="text-purple-500">:</span>{' '}
                        <span className="text-green-400">{renderPreview(value)}</span>
                      </div>
                    ))}
                    {Object.keys(tx.params).length > 1 && (
                      <div className="text-purple-500/60 text-xs font-bold">
                        +{Object.keys(tx.params).length - 1} more
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

      {/* Waiting state for in-progress */}
      {!isExpanded && isInProgress && (
        <div className="px-4 py-2.5 flex items-center gap-2" style={{ backgroundColor: 'rgba(59,130,246,0.05)', borderBottom: '2px solid var(--border-color)' }}>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-blue-400 text-xs font-bold animate-pulse">▸▸▸</span>
            <span className="text-xs font-bold text-blue-400 tracking-wider">PROCESSING</span>
            <span className="text-xs text-blue-500 tabular-nums font-bold">{elapsedTime}s</span>
          </div>
        </div>
      )}

      {/* Expanded Content */}
      {isExpanded && (hasParams || hasResults || tx.module) && (
        <div className="px-3 pb-3 pt-2">
          <div className="p-3 max-h-96 overflow-auto" style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: '2px solid rgba(168,85,247,0.25)' }}>
            {activeTab === 'results' && hasResults && renderValue(tx.result)}
            {activeTab === 'params' && hasParams && renderValue(tx.params)}
            {activeTab === 'code' && (
              loadingCode ? (
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  <span className="animate-pulse font-bold">▓▓▒▒░░</span>
                  <span className="text-[11px] font-bold tracking-wider">LOADING...</span>
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
                <span className="text-[11px] font-bold tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                  NO CODE AVAILABLE
                </span>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}
