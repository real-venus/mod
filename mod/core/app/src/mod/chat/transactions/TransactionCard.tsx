'use client'

import { useState } from 'react'
import { CopyButton } from '@/mod/ui/CopyButton'
import { timeAgo, shorten, text2color } from '@/mod/utils'
import { CubeIcon, HashtagIcon, KeyIcon } from '@heroicons/react/24/outline'
import { userContext } from '@/mod/context'
import { Key } from '@/mod/key'

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
  const { client } = userContext()
  const hasCollapsibleContent = tx.params || tx.result !== undefined
  const [isExpanded, setIsExpanded] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  
  const hasResults = tx.result !== undefined
  const hasParams = tx.params !== null && tx.params !== undefined
  const [activeTab, setActiveTab] = useState<'params' | 'results'>(hasResults ? 'results' : 'params')

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
    if (status === 'pending' || status === 'running') return 'rgba(234, 179, 8, 0.12)'
    if (status === 'success' || status === 'finished' || status === 'complete') return 'rgba(34, 197, 94, 0.08)'
    if (status === 'error' || status === 'cancelled' || status === 'failed') return 'rgba(239, 68, 68, 0.08)'
    return 'rgba(59, 130, 246, 0.08)'
  }

  const getCardBorderColor = (status: string) => {
    if (status === 'pending' || status === 'running') return '#eab308'
    if (status === 'success' || status === 'finished' || status === 'complete') return '#22c55e'
    if (status === 'error' || status === 'cancelled' || status === 'failed') return '#ef4444'
    return text2color(tx.fn || tx.key)
  }

  const handleCancelTask = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!client || !tx.cid) return
    
    setIsCancelling(true)
    try {
      await client.call('kill_task', { cid: tx.cid })
    } catch (error) {
      console.error('Failed to cancel task:', error)
    } finally {
      setIsCancelling(false)
    }
  }

  const copyFieldValue = (value: any) => {
    const textValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
    navigator.clipboard.writeText(textValue)
  }

  const renderValue = (value: any, isNested = false) => {
    if (value === null || value === undefined) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-gray-600 font-mono text-sm">null</span>
          <CopyButton text="null" size="sm" />
        </div>
      )
    }
    
    if (typeof value === 'object' && !Array.isArray(value)) {
      return (
        <div className="space-y-1">
          {Object.entries(value).map(([key, val]) => (
            <div key={key} className="flex items-start gap-2 bg-black/30 p-2 rounded border border-gray-700/20">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-cyan-400 font-mono text-sm font-semibold">{key}:</span>
                  <CopyButton text={typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val)} size="sm" />
                </div>
                <div className="ml-2">
                  {typeof val === 'object' ? (
                    <pre className="text-xs bg-black/40 p-2 rounded border border-gray-700/30 overflow-x-auto max-w-full">
                      <code className="text-gray-300">{JSON.stringify(val, null, 2)}</code>
                    </pre>
                  ) : (
                    <span className="text-gray-300 break-all font-mono text-sm">{String(val)}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )
    }
    
    return (
      <div className="flex items-center gap-2">
        <span className="text-gray-300 break-all font-mono text-sm">{typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}</span>
        <CopyButton text={typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)} size="sm" />
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
  const showCancelButton = (tx.status === 'running' || tx.status === 'pending') && tx.cid

  return (
    <div 
      className={`border-2 rounded-xl font-mono transition-all backdrop-blur-sm hover:border-opacity-80 shadow-lg mb-2 ${hasCollapsibleContent ? 'cursor-pointer' : ''}`}
      style={{ 
        fontFamily: 'IBM Plex Mono, Courier New, monospace',
        backgroundColor: cardBgColor,
        borderColor: cardBorderColor,
        minHeight: '120px',
        height: 'auto'
      }}
      onClick={() => hasCollapsibleContent && setIsExpanded(!isExpanded)}
    >
      <div className="p-4 h-full flex flex-col">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-1 bg-black/40 border-2 rounded-lg px-3 py-1.5" style={{ borderColor: `${txColor}40`, height: '36px' }}>
            <CubeIcon className="w-5 h-5" style={{ color: txColor }} />
            <code className="text-sm font-mono" style={{ color: txColor }}>{tx.fn}</code>
            <CopyButton text={tx.fn} size="sm" />
          </div>

          <span className={`${statusColors.text} font-bold text-sm px-3 py-1.5 bg-black/40 rounded-lg border-2 ${statusColors.border} flex items-center justify-center`} style={{ height: '36px' }}>
            {getStatusEmoji(tx.status)}
          </span>

          <span className="bg-black/40 border-2 border-green-900/50 px-3 py-1.5 rounded-lg font-mono text-green-400 text-sm font-bold flex items-center" style={{ height: '36px' }}>
            ${costUsd.toFixed(4)}
          </span>

          {tx.cid && (
            <span className="bg-black/40 border-2 border-purple-900/50 rounded-lg px-3 py-1.5 flex items-center gap-1 text-xs" style={{ height: '36px' }}>
              <span className="text-purple-400 font-semibold">CID</span>
              <span className="font-mono text-gray-400">{shorten(tx.cid)}</span>
              <CopyButton text={tx.cid} size="sm" />
            </span>
          )}

          {tx.key && (
            <div className="flex items-center gap-1 bg-black/40 border-2 border-purple-500/30 rounded-lg px-3 py-1.5" style={{ height: '36px' }}>
              <KeyIcon className="w-4 h-4 text-purple-400" />
              <code className="text-xs font-mono" style={{ color: '#a855f7' }}>{tx.key.slice(0, 6)}...</code>
              <CopyButton text={tx.key} size="sm" />
            </div>
          )}

          {tx.delta !== undefined && (
            <div className="flex items-center gap-1 bg-black/40 border-2 border-cyan-900/50 rounded-lg px-3 py-1.5" style={{ height: '36px' }}>
              <span className="text-cyan-400 text-xs font-mono font-semibold">{tx.delta.toFixed(2)}s</span>
            </div>
          )}

          <div className="flex items-center gap-1 bg-black/40 border-2 border-blue-500/30 rounded-lg px-3 py-1.5" style={{ height: '36px' }}>
            <span className="text-blue-400 text-xs font-mono">{formattedTime}</span>
            <CopyButton text={formattedTime} size="sm" />
          </div>

          {showCancelButton && (
            <button
              onClick={handleCancelTask}
              disabled={isCancelling}
              className="px-3 py-1.5 bg-red-500/20 border-2 border-red-500/50 rounded-lg text-red-400 text-xs font-bold hover:bg-red-500/30 hover:border-red-500/70 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: 'IBM Plex Mono, monospace', height: '36px' }}
            >
              {isCancelling ? '⏳ cancelling...' : '✗ cancel'}
            </button>
          )}
        </div>
        
        {isExpanded && (
          <div className="mt-3 space-y-2 pt-3 border-t-2 border-gray-800 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {tx.signature && (
                <span className="bg-black/40 border-2 border-orange-900/50 rounded-lg px-3 py-1.5 flex items-center gap-1 text-xs" style={{ height: '36px' }}>
                  <span className="text-orange-400 font-semibold">SIG</span>
                  <span className="font-mono text-gray-400">{shorten(tx.signature)}</span>
                  <CopyButton text={tx.signature} size="sm" />
                </span>
              )}
            </div>
            
            {hasParams && hasResults && (
              <div className="flex gap-2 border-b-2 border-gray-800">
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveTab('params'); }}
                  className={`flex-1 px-4 py-2 font-semibold text-sm transition-all ${
                    activeTab === 'params' 
                      ? 'text-cyan-400 border-b-2 border-cyan-400' 
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                  style={{ height: '36px' }}
                >
                  PARAMS
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveTab('results'); }}
                  className={`flex-1 px-4 py-2 font-semibold text-sm transition-all ${
                    activeTab === 'results' 
                      ? 'text-green-400 border-b-2 border-green-400' 
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                  style={{ height: '36px' }}
                >
                  RESULTS
                </button>
              </div>
            )}
            
            {hasParams && (!hasResults || activeTab === 'params') && (
              <div className="bg-black/40 border-2 border-gray-800 rounded-lg overflow-hidden">
                <div className="w-full flex items-center justify-between p-2 bg-gray-900/50" style={{ height: '36px' }}>
                  <span className="text-cyan-400 font-semibold text-sm">PARAMS</span>
                  <CopyButton text={JSON.stringify(tx.params, null, 2)} size="sm" />
                </div>
                <div className="p-2 bg-black/60 border-t-2 border-gray-800 max-h-96 overflow-y-auto overflow-x-auto">
                  {renderValue(tx.params)}
                </div>
              </div>
            )}
            
            {hasResults && (!hasParams || activeTab === 'results') && (
              <div className="bg-black/40 border-2 border-gray-800 rounded-lg overflow-hidden">
                <div className="w-full flex items-center justify-between p-2 bg-gray-900/50" style={{ height: '36px' }}>
                  <span className="text-green-400 font-semibold text-sm">RESULT</span>
                  <CopyButton text={typeof tx.result === 'object' ? JSON.stringify(tx.result, null, 2) : String(tx.result)} size="sm" />
                </div>
                <div className="p-2 bg-black/60 border-t-2 border-gray-800 max-h-96 overflow-y-auto overflow-x-auto">
                  {renderValue(tx.result)}
                </div>
              </div>
            )}
            
            {tx.client && (
              <div className="bg-black/40 border-2 border-gray-800 rounded-lg p-2" style={{ minHeight: '36px' }}>
                <div className="flex items-center gap-2">
                  <span className="text-purple-400 font-semibold text-sm">CLIENT</span>
                  <span className="font-mono text-gray-400 text-sm">{shorten(tx.client)}</span>
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