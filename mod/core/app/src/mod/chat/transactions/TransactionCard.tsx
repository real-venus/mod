'use client'

import { useState } from 'react'
import { CopyButton } from '@/mod/ui/CopyButton'
import { timeAgo, shorten, text2color } from '@/mod/utils'
import { CubeIcon, HashtagIcon, KeyIcon, QrCodeIcon } from '@heroicons/react/24/outline'
import { userContext } from '@/mod/context'
import { Key } from '@/mod/key'
import { QRCode } from '@/mod/ui/QRCode'

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
  isExpanded?: boolean
}

export function TransactionCard({ tx, idx, isExpanded = false }: TransactionCardProps) {
  const { client } = userContext()
  const hasCollapsibleContent = tx.params || tx.result !== undefined
  const [isCancelling, setIsCancelling] = useState(false)
  const [isKeyHovered, setIsKeyHovered] = useState(false)
  const [isCidHovered, setIsCidHovered] = useState(false)
  const [isSignatureHovered, setIsSignatureHovered] = useState(false)
  const [isCidQrHovered, setIsCidQrHovered] = useState(false)
  const [isKeyQrHovered, setIsKeyQrHovered] = useState(false)
  const [isSignatureQrHovered, setIsSignatureQrHovered] = useState(false)
  const [isKeyCopyHovered, setIsKeyCopyHovered] = useState(false)
  const [isCidCopyHovered, setIsCidCopyHovered] = useState(false)
  const [isSignatureCopyHovered, setIsSignatureCopyHovered] = useState(false)
  const [isParamsQrHovered, setIsParamsQrHovered] = useState(false)
  const [isResultsQrHovered, setIsResultsQrHovered] = useState(false)
  
  const hasResults = tx.result !== undefined
  const hasParams = tx.params !== null && tx.params !== undefined
  const [activeTab, setActiveTab] = useState<'params' | 'results'>('results')

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
    if (status === 'pending' || status === 'running') return 'rgba(234, 179, 8, 0.05)'
    if (status === 'success' || status === 'finished' || status === 'complete') return 'rgba(34, 197, 94, 0.05)'
    if (status === 'error' || status === 'cancelled' || status === 'failed') return 'rgba(239, 68, 68, 0.05)'
    return 'rgba(59, 130, 246, 0.05)'
  }

  const getCardBorderColor = (status: string) => {
    if (status === 'pending' || status === 'running') return '#eab30880'
    if (status === 'success' || status === 'finished' || status === 'complete') return '#22c55e80'
    if (status === 'error' || status === 'cancelled' || status === 'failed') return '#ef444480'
    return text2color(tx.fn || tx.key) + '80'
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

  const renderValue = (value: any) => {
    if (value === null || value === undefined) {
      return (
        <div className="flex items-center gap-2 bg-black/20 p-3 rounded-lg border border-gray-700/30">
          <span className="text-gray-500 font-mono text-sm">null</span>
          <CopyButton text="null" size="sm" />
        </div>
      )
    }
    
    if (typeof value === 'object' && !Array.isArray(value)) {
      return (
        <div className="space-y-2">
          {Object.entries(value).map(([key, val]) => (
            <div key={key} className="bg-black/20 p-3 rounded-lg border border-gray-700/30 hover:border-gray-600/40 transition-all">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-cyan-400 font-mono text-sm font-semibold">{key}:</span>
                <CopyButton text={typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val)} size="sm" />
              </div>
              <div className="ml-2">
                {typeof val === 'object' ? (
                  <pre className="text-xs bg-black/30 p-2.5 rounded-md border border-gray-700/40 overflow-x-auto">
                    <code className="text-gray-300">{JSON.stringify(val, null, 2)}</code>
                  </pre>
                ) : (
                  <span className="text-gray-300 break-all font-mono text-sm">{String(val)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )
    }
    
    return (
      <div className="flex items-center gap-2 bg-black/20 p-3 rounded-lg border border-gray-700/30">
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
  const keyColor = text2color(tx.key)
  const cidColor = text2color(tx.cid || '')
  const signatureColor = text2color(tx.signature || '')
  const paramsColor = text2color('params')
  const resultsColor = text2color('results')

  return (
    <div 
      className={`border-2 rounded-2xl font-mono transition-all backdrop-blur-sm hover:shadow-xl hover:scale-[1.01] mb-3 ${hasCollapsibleContent ? 'cursor-pointer' : ''}`}
      style={{ 
        fontFamily: 'IBM Plex Mono, Courier New, monospace',
        backgroundColor: cardBgColor,
        borderColor: cardBorderColor,
        minHeight: '100px',
        height: 'auto',
        boxShadow: `0 4px 20px ${cardBorderColor}40`
      }}
    >
      <div className="p-5 h-full flex flex-col">
        <div className="flex flex-wrap gap-2.5 items-center">
          <div className="flex items-center gap-2 bg-black/30 border-2 rounded-xl px-4 py-2 shadow-sm hover:shadow-md transition-all" style={{ borderColor: `${txColor}60`, height: '42px' }}>
            <CubeIcon className="w-5 h-5" style={{ color: txColor }} />
            <code className="text-sm font-mono font-semibold" style={{ color: txColor }}>{tx.fn}</code>
            <CopyButton text={tx.fn} size="sm" />
          </div>

          <span className={`${statusColors.text} font-bold text-sm px-4 py-2 bg-black/30 rounded-xl border-2 ${statusColors.border} flex items-center justify-center shadow-sm`} style={{ height: '42px' }}>
            {getStatusEmoji(tx.status)}
          </span>

          <span className="bg-black/30 border-2 border-green-900/60 px-4 py-2 rounded-xl font-mono text-green-400 text-sm font-bold flex items-center shadow-sm" style={{ height: '42px' }}>
            ${costUsd.toFixed(4)}
          </span>

          {tx.cid && (
            <div 
              className="flex items-center gap-1.5 bg-black/30 border-2 rounded-xl px-2 py-1.5 transition-all relative group/cid shadow-md hover:scale-105"
              style={{
                borderColor: `${cidColor}40`,
                backgroundColor: (isCidHovered || isCidCopyHovered) ? `${cidColor}25` : 'rgba(0, 0, 0, 0.3)',
                height: '42px'
              }}
              onMouseEnter={() => setIsCidHovered(true)}
              onMouseLeave={() => setIsCidHovered(false)}
              title={tx.cid}
            >
              <code className="text-sm font-mono font-bold" style={{ color: cidColor }}>
                ●●●●●●
              </code>
              <div
                onMouseEnter={() => setIsCidCopyHovered(true)}
                onMouseLeave={() => setIsCidCopyHovered(false)}
              >
                <CopyButton text={tx.cid} size="sm" showValueOnHover={true} />
              </div>
              <div 
                className="relative ml-1"
                onMouseEnter={() => setIsCidQrHovered(true)}
                onMouseLeave={() => setIsCidQrHovered(false)}
              >
                <QrCodeIcon className="h-4 w-4 cursor-pointer" style={{ color: cidColor }} />
                {isCidQrHovered && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-black/95 rounded-lg border-2 z-50 shadow-2xl" style={{ borderColor: cidColor }}>
                    <QRCode value={tx.cid} size={100} color={cidColor} />
                  </div>
                )}
              </div>
            </div>
          )}

          {tx.key && (
            <div 
              className="flex items-center gap-1.5 bg-black/30 border-2 rounded-xl px-2 py-1.5 transition-all relative group/key shadow-md hover:scale-105"
              style={{
                borderColor: `${keyColor}40`,
                backgroundColor: (isKeyHovered || isKeyCopyHovered) ? `${keyColor}25` : 'rgba(0, 0, 0, 0.3)',
                height: '42px'
              }}
              onMouseEnter={() => setIsKeyHovered(true)}
              onMouseLeave={() => setIsKeyHovered(false)}
              title={tx.key}
            >
              <KeyIcon className="w-4 h-4" style={{ color: keyColor }} />
              <div
                onMouseEnter={() => setIsKeyCopyHovered(true)}
                onMouseLeave={() => setIsKeyCopyHovered(false)}
              >
                <CopyButton text={tx.key} size="sm" showValueOnHover={true} />
              </div>
              <div 
                className="relative ml-1"
                onMouseEnter={() => setIsKeyQrHovered(true)}
                onMouseLeave={() => setIsKeyQrHovered(false)}
              >
                <QrCodeIcon className="h-4 w-4 cursor-pointer" style={{ color: keyColor }} />
                {isKeyQrHovered && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-black/95 rounded-lg border-2 z-50 shadow-2xl" style={{ borderColor: keyColor }}>
                    <QRCode value={tx.key} size={100} color={keyColor} />
                  </div>
                )}
              </div>
            </div>
          )}

          {tx.delta !== undefined && (
            <div className="flex items-center gap-2 bg-black/30 border-2 border-cyan-900/60 rounded-xl px-4 py-2 shadow-sm" style={{ height: '42px' }}>
              <span className="text-cyan-400 text-xs font-mono font-semibold">{tx.delta.toFixed(2)}s</span>
            </div>
          )}

          <div className="flex items-center gap-2 bg-black/30 border-2 border-blue-500/40 rounded-xl px-4 py-2 shadow-sm" style={{ height: '42px' }}>
            <span className="text-blue-400 text-xs font-mono">{formattedTime}</span>
            <CopyButton text={formattedTime} size="sm" />
          </div>

          {showCancelButton && (
            <button
              onClick={handleCancelTask}
              disabled={isCancelling}
              className="px-4 py-2 bg-red-500/20 border-2 border-red-500/60 rounded-xl text-red-400 text-xs font-bold hover:bg-red-500/30 hover:border-red-500/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              style={{ fontFamily: 'IBM Plex Mono, monospace', height: '42px' }}
            >
              {isCancelling ? '⏳ cancelling...' : '✗ cancel'}
            </button>
          )}
        </div>
        
        {isExpanded && (
          <div className="mt-4 space-y-3 pt-4 border-t-2 border-gray-800/50 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {tx.signature && (
                <div 
                  className="flex items-center gap-1.5 bg-black/30 border-2 rounded-xl px-2 py-1.5 transition-all relative group/signature shadow-md hover:scale-105"
                  style={{
                    borderColor: `${signatureColor}40`,
                    backgroundColor: (isSignatureHovered || isSignatureCopyHovered) ? `${signatureColor}25` : 'rgba(0, 0, 0, 0.3)',
                    height: '42px'
                  }}
                  onMouseEnter={() => setIsSignatureHovered(true)}
                  onMouseLeave={() => setIsSignatureHovered(false)}
                  title={tx.signature}
                >
                  <span className="text-orange-400 font-semibold text-xs">SIG</span>
                  <code className="text-sm font-mono font-bold" style={{ color: signatureColor }}>
                    ●●●●●●
                  </code>
                  <div
                    onMouseEnter={() => setIsSignatureCopyHovered(true)}
                    onMouseLeave={() => setIsSignatureCopyHovered(false)}
                  >
                    <CopyButton text={tx.signature} size="sm" showValueOnHover={true} />
                  </div>
                  <div 
                    className="relative ml-1"
                    onMouseEnter={() => setIsSignatureQrHovered(true)}
                    onMouseLeave={() => setIsSignatureQrHovered(false)}
                  >
                    <QrCodeIcon className="h-4 w-4 cursor-pointer" style={{ color: signatureColor }} />
                    {isSignatureQrHovered && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-black/95 rounded-lg border-2 z-50 shadow-2xl" style={{ borderColor: signatureColor }}>
                        <QRCode value={tx.signature} size={100} color={signatureColor} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {hasParams && hasResults && (
              <div className="flex gap-2 border-b-2 border-gray-800/50">
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveTab('params'); }}
                  className={`flex-1 px-4 py-2.5 font-semibold text-sm transition-all rounded-t-lg flex items-center justify-center gap-2 ${
                    activeTab === 'params' 
                      ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/10' 
                      : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
                  }`}
                  style={{ height: '42px' }}
                >
                  <span>PARAMS</span>
                  <CopyButton text={JSON.stringify(tx.params, null, 2)} size="sm" />
                  <div 
                    className="relative"
                    onMouseEnter={() => setIsParamsQrHovered(true)}
                    onMouseLeave={() => setIsParamsQrHovered(false)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <QrCodeIcon className="h-4 w-4 cursor-pointer" style={{ color: paramsColor }} />
                    {isParamsQrHovered && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-black/95 rounded-lg border-2 z-50 shadow-2xl" style={{ borderColor: paramsColor }}>
                        <QRCode value={JSON.stringify(tx.params, null, 2)} size={100} color={paramsColor} />
                      </div>
                    )}
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveTab('results'); }}
                  className={`flex-1 px-4 py-2.5 font-semibold text-sm transition-all rounded-t-lg flex items-center justify-center gap-2 ${
                    activeTab === 'results' 
                      ? 'text-green-400 border-b-2 border-green-400 bg-green-500/10' 
                      : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
                  }`}
                  style={{ height: '42px' }}
                >
                  <span>RESULTS</span>
                  <CopyButton text={typeof tx.result === 'object' ? JSON.stringify(tx.result, null, 2) : String(tx.result)} size="sm" />
                  <div 
                    className="relative"
                    onMouseEnter={() => setIsResultsQrHovered(true)}
                    onMouseLeave={() => setIsResultsQrHovered(false)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <QrCodeIcon className="h-4 w-4 cursor-pointer" style={{ color: resultsColor }} />
                    {isResultsQrHovered && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-black/95 rounded-lg border-2 z-50 shadow-2xl" style={{ borderColor: resultsColor }}>
                        <QRCode value={typeof tx.result === 'object' ? JSON.stringify(tx.result, null, 2) : String(tx.result)} size={100} color={resultsColor} />
                      </div>
                    )}
                  </div>
                </button>
              </div>
            )}
            
            {hasParams && (!hasResults || activeTab === 'params') && (
              <div className="bg-black/30 border-2 border-gray-800/60 rounded-xl overflow-hidden shadow-lg">
                <div className="p-4 bg-black/40 border-t-2 border-gray-800/50 max-h-96 overflow-y-auto overflow-x-auto">
                  {renderValue(tx.params)}
                </div>
              </div>
            )}
            
            {hasResults && (!hasParams || activeTab === 'results') && (
              <div className="bg-black/30 border-2 border-gray-800/60 rounded-xl overflow-hidden shadow-lg">
                <div className="p-4 bg-black/40 border-t-2 border-gray-800/50 max-h-96 overflow-y-auto overflow-x-auto">
                  {renderValue(tx.result)}
                </div>
              </div>
            )}
            
            {tx.client && (
              <div className="bg-black/30 border-2 border-gray-800/60 rounded-xl p-3 shadow-sm" style={{ minHeight: '42px' }}>
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