'use client'

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useUserContext } from '@/mod/context'
import { CopyButton } from '@/mod/ui/CopyButton'
import { time2utc } from '@/mod/utils'

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

export const TransactionsPanel = forwardRef((props, ref) => {
  const { client, localKey } = useUserContext()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTx, setExpandedTx] = useState<Set<number>>(new Set())
  const [expandedParams, setExpandedParams] = useState<Set<number>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [showOnlyMyTx, setShowOnlyMyTx] = useState(false)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [isCollapsed, setIsCollapsed] = useState(false)

  const fetchTransactions = async () => {
    if (!client) return
    setLoading(true)
    try {
      const result = await client.call('history', { df: 0, n: pageSize, page: page })
      setTransactions(Array.isArray(result) ? result : [])
      if (result && result.length === pageSize) {
        setHasMore(true)
      } else {
        setHasMore(false)
        setTotalPages(page + 1)
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err)
      setTransactions([])
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTransactions()
  }, [client, page, pageSize])

  const handleSync = () => {
    setPage(0)
    fetchTransactions()
  }

  useImperativeHandle(ref, () => ({
    handleSync
  }))

  const toggleTx = (idx: number) => {
    const newExpanded = new Set(expandedTx)
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx)
    } else {
      newExpanded.add(idx)
    }
    setExpandedTx(newExpanded)
  }

  const toggleParams = (idx: number) => {
    const newExpanded = new Set(expandedParams)
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx)
    } else {
      newExpanded.add(idx)
    }
    setExpandedParams(newExpanded)
  }

  const getStatusColor = (status: string) => {
    if (status === 'running') return { bg: 'from-yellow-500/20 to-yellow-600/10', border: 'border-yellow-500/40', text: 'text-yellow-400' }
    if (status === 'pending') return { bg: 'from-yellow-500/20 to-yellow-600/10', border: 'border-yellow-500/40', text: 'text-yellow-400' }
    if (status === 'success' || status === 'finished') return { bg: 'from-green-500/20 to-green-600/10', border: 'border-green-500/40', text: 'text-green-400' }
    return { bg: 'from-red-500/20 to-red-600/10', border: 'border-red-500/40', text: 'text-red-400' }
  }

  const myClientKey = localKey?.address || ''

  const filteredTransactions = transactions.filter(tx => {
    if (showOnlyMyTx && tx.client !== myClientKey) return false
    if (!showOnlyMyTx && tx.client === myClientKey) return false
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return tx.fn.toLowerCase().includes(search) || 
           tx.client?.toLowerCase().includes(search) ||
           tx.status.toLowerCase().includes(search) ||
           tx.signature?.toLowerCase().includes(search) ||
           tx.key?.toLowerCase().includes(search) ||
           tx.cid?.toLowerCase().includes(search)
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent border-green-400" />
      </div>
    )
  }

  return (
    <div 
      className={`border-0 rounded-md overflow-hidden backdrop-blur-sm transition-all ${
        isHovered ? 'bg-white/15' : 'bg-white/10'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="p-3 space-y-2 bg-black/40">
        <div className="mb-3 flex gap-2 items-center">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="px-6 py-3 bg-white/30 border-2 border-white/60 rounded-md text-white hover:bg-white/40 hover:border-white/80 transition-all font-bold backdrop-blur-sm"
            style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase', fontSize: '1.2em' }}
          >
            {isCollapsed ? '▼' : '▲'}
          </button>
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-6 py-4 bg-black/60 border-2 border-white/60 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/80 focus:border-white/80 transition-colors backdrop-blur-sm font-bold"
            style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace', fontSize: '1.4em' }}
          />
          <button
            onClick={() => setShowOnlyMyTx(!showOnlyMyTx)}
            className={`px-6 py-3 border-2 rounded-md font-bold transition-all backdrop-blur-sm text-white ${
              showOnlyMyTx 
                ? 'bg-white/40 border-white/80' 
                : 'bg-black/60 border-white/60 hover:bg-white/30 hover:border-white/80'
            }`}
            title="Toggle only my transactions"
            style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase', fontSize: '1.2em' }}
          >
            {showOnlyMyTx ? '✓ my tx' : 'my tx'}
          </button>
          <button
            onClick={handleSync}
            className="px-6 py-3 bg-white/30 border-2 border-white/60 rounded-md text-white hover:bg-white/40 hover:border-white/80 transition-all font-bold backdrop-blur-sm"
            title="Sync transactions"
            style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase', fontSize: '1.2em' }}
          >
            🔄 sync
          </button>
        </div>

        {!isCollapsed && (
          <>
            <div className="max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/60 scrollbar-track-black/20">
              {filteredTransactions.map((tx, idx) => {
                const isExpanded = expandedTx.has(idx)
                const isParamsExpanded = expandedParams.has(idx)
                const statusColors = getStatusColor(tx.status)
                const timestamp = parseInt(tx.time)
                const formattedTime = isNaN(timestamp) ? tx.time : time2utc(timestamp)
                const timeLines = formattedTime.split(' ')
                const costUsd = tx.cost !== undefined ? tx.cost : 0

                return (
                  <div key={`${tx.client}-${idx}`} className={`border-2 rounded-md overflow-hidden bg-gradient-to-br ${statusColors.bg} ${statusColors.border} shadow-xl transition-all hover:shadow-2xl mb-2`}>
                    <div
                      className="p-3 cursor-pointer hover:bg-black/20 transition-colors"
                      onClick={() => toggleTx(idx)}
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-bold text-white px-3 py-1 rounded-md bg-black/30`} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '1.0em' }}>
                            {tx.fn}
                          </span>
                          <CopyButton text={tx.fn} size="sm" />
                          {tx.signature && (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-orange-500/10 border-2 border-orange-500/40">
                              <span className="text-white" style={{ fontSize: '1.0em' }}>✍️</span>
                              <span className="font-mono text-white" style={{ fontSize: '1.0em' }}>{tx.signature.slice(0, 8)}...{tx.signature.slice(-6)}</span>
                              <CopyButton text={tx.signature} size="sm" />
                            </div>
                          )}
                          {tx.key && (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-purple-500/10 border-2 border-purple-500/40">
                              <span className="text-white" style={{ fontSize: '1.0em' }}>🔐</span>
                              <span className="font-mono text-white" style={{ fontSize: '1.0em' }}>{tx.key.slice(0, 8)}...{tx.key.slice(-6)}</span>
                              <CopyButton text={tx.key} size="sm" />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-1 rounded-md font-bold text-white bg-black/40`} style={{ fontSize: '1.0em' }}>
                            {tx.status}
                          </span>
                          <span className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-2 border-green-500/50 px-2 py-1 rounded-md font-mono text-white" style={{ fontSize: '1.0em' }}>
                            💵 ${costUsd.toFixed(4)}
                          </span>
                          {tx.cid && (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500/10 border-2 border-blue-500/40">
                              <span className="text-white" style={{ fontSize: '1.0em' }}>🔗</span>
                              <span className="font-mono text-white" style={{ fontSize: '1.0em' }}>{tx.cid.slice(0, 3)}</span>
                              <CopyButton text={tx.cid} size="sm" />
                            </div>
                          )}
                          {tx.delta !== undefined && (
                            <span className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-2 border-cyan-500/50 px-2 py-1 rounded-md font-mono text-white" style={{ fontSize: '1.0em' }}>
                              ⚡ {tx.delta.toFixed(2)}s
                            </span>
                          )}
                          <div className="flex flex-col items-start px-2 py-1 rounded-md bg-gray-500/10 border-2 border-gray-500/40">
                            {timeLines.map((line, i) => (
                              <span key={i} className="text-white" style={{ fontSize: '1.0em', lineHeight: '1.2' }}>{line}</span>
                            ))}
                          </div>
                          <span className="text-white ml-auto" style={{ fontSize: '1.0em' }}>{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-2 border-t-2 border-white/20">
                        <div className="flex flex-wrap gap-2">
                          {tx.client && (
                            <div className="flex items-center gap-1">
                              <span className="text-white" style={{ fontSize: '1.0em' }}>🔑 client:</span>
                              <span className="font-mono text-white" style={{ fontSize: '1.0em' }}>{tx.client.slice(0, 10)}...</span>
                              <CopyButton text={tx.client} size="sm" />
                            </div>
                          )}
                        </div>
                        {tx.params && Object.keys(tx.params).length > 0 && (
                          <div className="mt-2">
                            <div 
                              className="flex items-center justify-between mb-1 p-2 rounded-md bg-yellow-500/10 border-2 border-yellow-500/40 cursor-pointer hover:bg-yellow-500/20 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleParams(idx)
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <div className="font-bold text-white" style={{ fontSize: '1.0em' }}>📥 params</div>
                                <span className="text-white" style={{ fontSize: '1.0em' }}>{isParamsExpanded ? '▼' : '▶'}</span>
                              </div>
                              <CopyButton text={JSON.stringify(tx.params, null, 2)} size="sm" />
                            </div>
                            {isParamsExpanded && (
                              <div className="space-y-1">
                                {Object.entries(tx.params).map(([key, value]) => (
                                  <div key={key} className="flex items-center gap-2 bg-black/50 p-2 rounded-md border-2 border-gray-700/40">
                                    <span className="text-white font-bold" style={{ fontSize: '1.0em' }}>{key}:</span>
                                    <span className="text-white font-mono flex-1" style={{ fontSize: '1.0em' }}>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                                    <CopyButton text={typeof value === 'object' ? JSON.stringify(value) : String(value)} size="sm" />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {tx.result && (
                          <div>
                            <div className="flex items-center justify-between mb-1 p-2 rounded-md bg-blue-500/10 border-2 border-blue-500/40">
                              <div className="flex items-center gap-2">
                                <div className="font-bold text-white" style={{ fontSize: '1.0em' }}>📤 result</div>
                              </div>
                              <CopyButton text={typeof tx.result === 'string' ? tx.result : JSON.stringify(tx.result, null, 2)} size="sm" />
                            </div>
                            <pre className="bg-black/50 p-2 rounded-md border-2 border-gray-700/40 overflow-x-auto max-h-64 max-w-full" style={{ fontSize: '1.0em' }}>
                              <code className="text-white break-all whitespace-pre-wrap">{typeof tx.result === 'string' ? tx.result : JSON.stringify(tx.result, null, 2)}</code>
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {filteredTransactions.length === 0 && (
              <div className="text-white text-center py-8 border-2 border-dashed border-gray-700/50 rounded-md" style={{ fontSize: '1.0em' }}>
                {searchTerm ? 'No transactions match your search' : showOnlyMyTx ? 'No transactions from you yet' : 'No transactions yet'}
              </div>
            )}

            <div className="flex items-center justify-between mt-3 gap-2 pb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="px-4 py-2 bg-white/30 border-2 border-white/60 rounded-md text-white hover:bg-white/40 hover:border-white/80 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                  style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase', fontSize: '1.0em' }}
                >
                  ← prev
                </button>
                <span className="text-white font-mono px-3" style={{ fontSize: '1.0em' }}>
                  Page {page + 1}{hasMore ? '+' : ''}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={!hasMore}
                  className="px-4 py-2 bg-white/30 border-2 border-white/60 rounded-md text-white hover:bg-white/40 hover:border-white/80 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                  style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase', fontSize: '1.0em' }}
                >
                  next →
                </button>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-white" style={{ fontSize: '1.0em' }}>Per page:</label>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
                  className="px-3 py-2 bg-black/60 border-2 border-white/60 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-white/80 focus:border-white/80 transition-colors backdrop-blur-sm font-bold"
                  style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace', fontSize: '1.0em' }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
})

TransactionsPanel.displayName = 'TransactionsPanel'
