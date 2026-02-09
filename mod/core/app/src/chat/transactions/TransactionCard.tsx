"use client";

import { useState } from 'react'
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

  const getStatus = (s: string) => {
    if (s === 'running') return { dot: 'bg-blue-500', text: 'text-blue-400' }
    if (s === 'pending') return { dot: 'bg-amber-500', text: 'text-amber-400' }
    if (s === 'success' || s === 'finished' || s === 'complete') return { dot: 'bg-emerald-500', text: 'text-emerald-400' }
    return { dot: 'bg-red-500', text: 'text-red-400' }
  }

  const status = getStatus(tx.status)
  const fnColor = text2color(tx.fn || tx.key)
  const timestamp = parseInt(tx.time)
  const time = isNaN(timestamp) ? tx.time : timeAgo(timestamp * 1000)
  const cost = tx.cost?.toFixed(4) || '0.0000'
  const hasParams = tx.params !== null && tx.params !== undefined
  const hasResults = tx.result !== undefined

  const renderValue = (value: any) => {
    if (value === null || value === undefined) return <span className="text-gray-600">null</span>
    if (typeof value === 'object') {
      return (
        <pre className="text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(value, null, 2)}
        </pre>
      )
    }
    return <span className="text-gray-300 break-all">{String(value)}</span>
  }

  return (
    <div 
      className="group border border-white/5 hover:border-white/10 rounded-lg bg-black/30 backdrop-blur-sm transition-all"
      style={{ fontFamily: 'JetBrains Mono, monospace' }}
    >
      {/* Compact Header - 1 line */}
      <div className="flex items-center gap-2 px-3 py-2 text-xs">
        {/* Status dot */}
        <span className={`w-1.5 h-1.5 rounded-full ${status.dot} flex-shrink-0`} />
        
        {/* Function name */}
        <Link 
          href={`/mod/${tx.fn}/${tx.owner || tx.module || tx.key}`}
          onClick={(e) => e.stopPropagation()}
          className="font-medium hover:underline truncate max-w-[140px]"
          style={{ color: fnColor }}
        >
          {tx.fn}
        </Link>
        
        {/* Owner/Key - compact */}
        {(tx.owner || tx.key) && (
          <Link 
            href={`/user/${tx.owner || tx.key}`}
            onClick={(e) => e.stopPropagation()}
            className="text-gray-500 hover:text-gray-300 truncate max-w-[80px]"
          >
            {(tx.owner || tx.key).slice(0, 6)}...
          </Link>
        )}
        
        {/* Spacer */}
        <div className="flex-1" />
        
        {/* Cost */}
        <span className="text-emerald-500/80">${cost}</span>
        
        {/* Duration */}
        {tx.delta !== undefined && (
          <span className="text-cyan-500/60">{tx.delta.toFixed(1)}s</span>
        )}
        
        {/* Time */}
        <span className="text-gray-600">{time}</span>
        
        {/* Copy hash */}
        {(tx.hash || tx.cid) && (
          <CopyButton text={tx.hash || tx.cid || ''} size="sm" />
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (hasParams || hasResults) && (
        <div className="px-3 pb-3 pt-1 border-t border-white/5">
          {/* Tabs */}
          {hasParams && hasResults && (
            <div className="flex gap-1 mb-2">
              <button
                onClick={(e) => { e.stopPropagation(); setActiveTab('results'); }}
                className={`px-2 py-0.5 text-xs rounded ${activeTab === 'results' ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-600 hover:text-gray-400'}`}
              >
                Result
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveTab('params'); }}
                className={`px-2 py-0.5 text-xs rounded ${activeTab === 'params' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-600 hover:text-gray-400'}`}
              >
                Params
              </button>
            </div>
          )}
          
          {/* Content */}
          <div className="bg-black/40 rounded p-2 max-h-48 overflow-auto text-xs">
            {activeTab === 'results' && hasResults ? renderValue(tx.result) : hasParams ? renderValue(tx.params) : null}
          </div>
        </div>
      )}
    </div>
  )
}