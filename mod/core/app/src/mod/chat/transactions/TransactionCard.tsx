'use client'

import { useState } from 'react'
import { CopyButton } from '@/mod/ui/CopyButton'
import { timeAgo, shorten, text2color } from '@/mod/utils'
import { CubeIcon } from '@heroicons/react/24/outline'

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

  const getStatusEmoji = (status: string) => {
    if (status === 'running') return '▶'
    if (status === 'pending') return '●'
    if (status === 'success' || status === 'finished' || status === 'complete') return '✓'
    return '✗'
  }

  const getStatusColor = (status: string) => {
    if (status === 'running') return { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' }
    if (status === 'pending') return { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400' }
    if (status === 'success' || status === 'finished' || status === 'complete') return { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400' }
    return { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' }
  }

  const getCardBackgroundColor = (status: string) => {
    if (status === 'success' || status === 'finished' || status === 'complete') return 'rgba(34, 197, 94, 0.08)'
    if (status === 'pending') return 'rgba(234, 179, 8, 0.08)'
    if (status === 'error' || status === 'cancelled' || status === 'failed') return 'rgba(239, 68, 68, 0.08)'
    return 'rgba(59, 130, 246, 0.08)'
  }

  const getCardBorderColor = (status: string) => {
    if (status === 'success' || status === 'finished' || status === 'complete') return '#22c55e'
    if (status === 'pending') return '#eab308'
    if (status === 'error' || status === 'cancelled' || status === 'failed') return '#ef4444'
    return text2color(tx.fn || tx.key)
  }

  const renderValue = (value: any) => {
    if (value === null || value === undefined) {
      return <span className="text-gray-600 font-mono text-base">null</span>
    }
    
    if (typeof value === 'object' && !Array.isArray(value)) {
      return (
        <div className="space-y-1">
          {Object.entries(value).map(([k, v]) => (
            <div key={k} className="bg-black/40 p-2 rounded-lg border-2 border-gray-800">
              <div className="flex items-center gap-2">
                <span className="text-cyan-400 font-mono text-base font-semibold">{k}:</span>
                <span className="text-gray-300 break-all font-mono text-base">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                <CopyButton text={typeof v === 'object' ? JSON.stringify(v) : String(v)} size="sm" />
              </div>
            </div>
          ))}
        </div>
      )
    }
    
    return (
      <div className="flex items-center gap-2">
        <span className="text-gray-300 break-all font-mono text-base">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
        <CopyButton text={typeof value === 'object' ? JSON.stringify(value) : String(value)} size="sm" />
      </div>
    )
  }

  const statusColors = getStatusColor(tx.status)
  const timestamp = parseInt(tx.time)
  const formattedTime = isNaN(timestamp) ? tx.time : timeAgo(timestamp * 1000)
  const costUsd = tx.cost !== undefined ? tx.cost : 0
  const txColor = text2color(tx.fn || tx.key)
  const cardBgColor = getCardBackgroundColor(tx.status)
  const cardBorderColor = getCardBorderColor(tx.status)

  return (
    <div 
      className="border-2 rounded-xl font-mono transition-all cursor-pointer backdrop-blur-sm hover:border-opacity-80 shadow-lg mb-2"
      style={{ 
        fontFamily: 'IBM Plex Mono, Courier New, monospace',
        backgroundColor: cardBgColor,
        borderColor: cardBorderColor
      }}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <CubeIcon className="w-8 h-8" style={{ color: txColor }} />
          <div className="flex items-center gap-1 bg-black/40 border-2 rounded-lg px-3 py-1.5" style={{ borderColor: `${txColor}40` }}>
            <code className="text-base font-mono" style={{ color: txColor }}>{tx.fn}</code>
            <CopyButton text={tx.fn} size="sm" />
          </div>
          <span className={`${statusColors.text} font-bold text-base px-3 py-1.5 bg-black/40 rounded-lg border-2 ${statusColors.border}`}>
            {getStatusEmoji(tx.status)}
          </span>
          <span className="bg-black/40 border-2 border-green-900/50 px-3 py-1.5 rounded-lg font-mono text-green-400 text-base font-bold">
            ${costUsd.toFixed(4)}
          </span>
          {tx.cid && (
            <div className="flex items-center gap-1 bg-black/40 border-2 border-green-500/30 rounded-lg px-3 py-1.5">
              <code className="text-sm font-mono" style={{ color: '#10b981' }}>{shorten(tx.cid)}</code>
              <CopyButton text={tx.cid} size="sm" />
            </div>
          )}
          <div className="flex items-center gap-1 bg-black/40 border-2 border-blue-500/30 rounded-lg px-3 py-1.5">
            <span className="text-blue-400 text-xs font-mono">{formattedTime}</span>
            <CopyButton text={formattedTime} size="sm" />
          </div>
        </div>
        
        {isExpanded && (
          <div className="mt-3 space-y-2 pt-3 border-t-2 border-gray-800">
            <div className="flex items-center gap-2 flex-wrap">
              {tx.signature && (
                <span className="bg-black/40 border-2 border-orange-900/50 rounded-lg px-3 py-1.5 flex items-center gap-1 text-sm">
                  <span className="text-orange-400 font-semibold">SIG</span>
                  <span className="font-mono text-gray-400">{shorten(tx.signature)}</span>
                  <CopyButton text={tx.signature} size="sm" />
                </span>
              )}
              {tx.key && (
                <span className="bg-black/40 border-2 border-purple-900/50 rounded-lg px-3 py-1.5 flex items-center gap-1 text-sm">
                  <span className="text-purple-400 font-semibold">KEY</span>
                  <span className="font-mono text-gray-400">{shorten(tx.key)}</span>
                  <CopyButton text={tx.key} size="sm" />
                </span>
              )}
              {tx.delta !== undefined && (
                <span className="bg-black/40 border-2 border-cyan-900/50 px-3 py-1.5 rounded-lg font-mono text-cyan-400 text-sm font-semibold">
                  {tx.delta.toFixed(2)}s
                </span>
              )}
            </div>
            
            {tx.params && (
              <div className="bg-black/40 border-2 border-gray-800 rounded-lg overflow-hidden">
                <button
                  onClick={(e) => { e.stopPropagation(); setIsParamsExpanded(!isParamsExpanded); }}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-900/50 transition-all"
                >
                  <span className="text-cyan-400 font-semibold text-base">PARAMS</span>
                  <div className="flex items-center gap-1">
                    <CopyButton text={JSON.stringify(tx.params, null, 2)} size="sm" />
                    <span className="text-gray-500 text-sm">{isParamsExpanded ? '▼' : '▶'}</span>
                  </div>
                </button>
                {isParamsExpanded && (
                  <div className="p-3 bg-black/60 border-t-2 border-gray-800">
                    {renderValue(tx.params)}
                  </div>
                )}
              </div>
            )}
            
            {tx.result !== undefined && (
              <div className="bg-black/40 border-2 border-gray-800 rounded-lg overflow-hidden">
                <button
                  onClick={(e) => { e.stopPropagation(); setIsResultsExpanded(!isResultsExpanded); }}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-900/50 transition-all"
                >
                  <span className="text-green-400 font-semibold text-base">RESULT</span>
                  <div className="flex items-center gap-1">
                    <CopyButton text={typeof tx.result === 'object' ? JSON.stringify(tx.result, null, 2) : String(tx.result)} size="sm" />
                    <span className="text-gray-500 text-sm">{isResultsExpanded ? '▼' : '▶'}</span>
                  </div>
                </button>
                {isResultsExpanded && (
                  <div className="p-3 bg-black/60 border-t-2 border-gray-800">
                    {renderValue(tx.result)}
                  </div>
                )}
              </div>
            )}
            
            {tx.client && (
              <div className="bg-black/40 border-2 border-gray-800 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <span className="text-purple-400 font-semibold text-base">CLIENT</span>
                  <span className="font-mono text-gray-400 text-base">{shorten(tx.client)}</span>
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
