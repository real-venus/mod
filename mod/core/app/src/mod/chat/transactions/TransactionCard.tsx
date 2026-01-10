'use client'

import { useState } from 'react'
import { CopyButton } from '@/mod/ui/CopyButton'
import { time2utc, shorten } from '@/mod/utils'

interface Transaction {
  fn: string
  params: any
  status: string
  time: string
  key: string
  signature: string
  result?: any
  cid?: string
  delta?: number
  client?: string
  cost?: number
}

interface TransactionCardProps {
  tx: Transaction
  idx: number
}

export function TransactionCard({ tx, idx }: TransactionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isParamsExpanded, setIsParamsExpanded] = useState(false)
  const [isResultsExpanded, setIsResultsExpanded] = useState(false)

  const getStatusColor = (status: string) => {
    if (status === 'running') return { bg: 'from-cyan-500/20 to-blue-600/10', border: 'border-cyan-400/40', text: 'text-cyan-300', shadow: 'shadow-cyan-500/10' }
    if (status === 'pending') return { bg: 'from-yellow-500/20 to-yellow-600/10', border: 'border-yellow-400/40', text: 'text-yellow-300', shadow: 'shadow-yellow-500/10' }
    if (status === 'success' || status === 'finished') return { bg: 'from-emerald-500/20 to-green-600/10', border: 'border-emerald-400/40', text: 'text-emerald-300', shadow: 'shadow-emerald-500/10' }
    return { bg: 'from-rose-500/20 to-red-600/10', border: 'border-rose-400/40', text: 'text-rose-300', shadow: 'shadow-rose-500/10' }
  }

  const renderValue = (value: any) => {
    if (value === null || value === undefined) {
      return <span className="text-gray-500 text-base">null</span>
    }
    
    if (typeof value === 'object' && !Array.isArray(value)) {
      return (
        <div className="space-y-0.5">
          {Object.entries(value).map(([k, v]) => (
            <div key={k} className="bg-slate-800/30 p-1 rounded border border-slate-700/30">
              <div className="flex items-center gap-1">
                <span className="text-cyan-400 font-semibold text-base">{k}:</span>
                <span className="text-white break-all font-mono text-base">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                <CopyButton text={typeof v === 'object' ? JSON.stringify(v) : String(v)} size="sm" />
              </div>
            </div>
          ))}
        </div>
      )
    }
    
    return (
      <div className="flex items-center gap-1">
        <span className="text-white break-all font-mono text-base">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
        <CopyButton text={typeof value === 'object' ? JSON.stringify(value) : String(value)} size="sm" />
      </div>
    )
  }

  const statusColors = getStatusColor(tx.status)
  const timestamp = parseInt(tx.time)
  const formattedTime = isNaN(timestamp) ? tx.time : time2utc(timestamp)
  const costUsd = tx.cost !== undefined ? tx.cost : 0

  return (
    <div className={`border rounded-lg bg-gradient-to-br ${statusColors.bg} ${statusColors.border} shadow ${statusColors.shadow} transition-all hover:shadow-md mb-1.5`}>
      <div className="p-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-1 py-1 bg-slate-800/60 hover:bg-slate-700/80 border border-slate-600/60 rounded transition-all flex-shrink-0"
            style={{ height: '32px', width: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <span className="text-white text-base font-bold">{isExpanded ? '▼' : '▶'}</span>
          </button>
          <span className="font-bold text-white text-base px-2 py-0.5 rounded bg-slate-800/80 border border-slate-600/50 flex-shrink-0" style={{ height: '32px', display: 'flex', alignItems: 'center' }}>
            ⚡ {tx.fn}
          </span>
          <span className="px-2 py-0.5 rounded font-bold text-white text-base bg-slate-700/60 uppercase flex-shrink-0 border border-slate-600/50" style={{ height: '32px', display: 'flex', alignItems: 'center' }}>
            {tx.status}
          </span>
          {tx.cid && (
            <span className="bg-slate-900/60 border border-blue-400/50 rounded px-2 py-0.5 flex items-center gap-1 flex-shrink-0" style={{ height: '32px' }}>
              <span className="text-blue-300 font-bold text-base">📦</span>
              <span className="font-mono text-white text-base bg-slate-950/80 px-1 py-0.5 rounded border border-slate-700/50 break-all">{shorten(tx.cid)}</span>
              <CopyButton text={tx.cid} size="sm" />
            </span>
          )}
        </div>
        {isExpanded && (
          <div className="mt-2 space-y-1.5 pt-2 border-t border-slate-600/40">
            <div className="flex items-center gap-1.5 flex-wrap">
              {tx.signature && (
                <span className="bg-slate-900/60 border border-orange-400/50 rounded px-2 py-0.5 flex items-center gap-1 flex-shrink-0" style={{ height: '32px' }}>
                  <span className="text-orange-300 font-bold text-base">✍️</span>
                  <span className="font-mono text-white text-base bg-slate-950/80 px-1 py-0.5 rounded border border-slate-700/50 break-all">{shorten(tx.signature)}</span>
                  <CopyButton text={tx.signature} size="sm" />
                </span>
              )}
              {tx.key && (
                <span className="bg-slate-900/60 border border-purple-400/50 rounded px-2 py-0.5 flex items-center gap-1 flex-shrink-0" style={{ height: '32px' }}>
                  <span className="text-purple-300 font-bold text-base">🔐</span>
                  <span className="font-mono text-white text-base bg-slate-950/80 px-1 py-0.5 rounded border border-slate-700/50 break-all">{shorten(tx.key)}</span>
                  <CopyButton text={tx.key} size="sm" />
                </span>
              )}

          <span className="bg-emerald-500/25 border border-emerald-400/60 px-2 py-0.5 rounded font-mono text-white text-base font-bold flex-shrink-0" style={{ height: '32px', display: 'flex', alignItems: 'center' }}>
            💵 ${costUsd.toFixed(4)}
          </span>
          {tx.delta !== undefined && (
            <span className="bg-cyan-500/25 border border-cyan-400/60 px-2 py-0.5 rounded font-mono text-white text-base font-bold flex-shrink-0" style={{ height: '32px', display: 'flex', alignItems: 'center' }}>
              ⚡ {tx.delta.toFixed(2)}s
            </span>
          )}

            <span className="text-white text-base px-2 py-0.5 rounded bg-slate-700/40 border border-slate-500/50 flex-shrink-0" style={{ height: '32px', display: 'flex', alignItems: 'center' }}>
            {formattedTime}
          </span>
            </div>
            {tx.params && (
              <div className="bg-slate-900/60 border border-slate-700/50 rounded overflow-hidden">
                <button
                  onClick={() => setIsParamsExpanded(!isParamsExpanded)}
                  className="w-full flex items-center justify-between p-2 hover:bg-slate-800/40 transition-all"
                >
                  <span className="text-cyan-300 font-bold text-base">📋 PARAMS</span>
                  <div className="flex items-center gap-1">
                    <CopyButton text={JSON.stringify(tx.params, null, 2)} size="sm" />
                    <span className="text-white text-base font-bold">{isParamsExpanded ? '▼' : '▶'}</span>
                  </div>
                </button>
                {isParamsExpanded && (
                  <div className="p-2 bg-slate-950/80 border-t border-slate-700/50">
                    {renderValue(tx.params)}
                  </div>
                )}
              </div>
            )}
            {tx.result !== undefined && (
              <div className="bg-slate-900/60 border border-slate-700/50 rounded overflow-hidden">
                <button
                  onClick={() => setIsResultsExpanded(!isResultsExpanded)}
                  className="w-full flex items-center justify-between p-2 hover:bg-slate-800/40 transition-all"
                >
                  <span className="text-emerald-300 font-bold text-base">✅ RESULT</span>
                  <div className="flex items-center gap-1">
                    <CopyButton text={typeof tx.result === 'object' ? JSON.stringify(tx.result, null, 2) : String(tx.result)} size="sm" />
                    <span className="text-white text-base font-bold">{isResultsExpanded ? '▼' : '▶'}</span>
                  </div>
                </button>
                {isResultsExpanded && (
                  <div className="p-2 bg-slate-950/80 border-t border-slate-700/50">
                    {renderValue(tx.result)}
                  </div>
                )}
              </div>
            )}
            {tx.client && (
              <div className="bg-slate-900/60 border border-slate-700/50 rounded p-2">
                <div className="flex items-center gap-1">
                  <span className="text-purple-300 font-bold text-base">👤</span>
                  <span className="font-mono text-white text-base bg-slate-950/80 px-1 py-0.5 rounded border border-slate-700/50 break-all">{tx.client}</span>
                  <CopyButton text={tx.client} size="sm" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
