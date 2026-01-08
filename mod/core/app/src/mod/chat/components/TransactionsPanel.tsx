'use client'

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useUserContext } from '@/mod/context'
import { CopyButton } from '@/mod/ui/CopyButton'
import { BatteryLoader } from '@/mod/ui/BatteryLoader'
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
  const [searchTerm, setSearchTerm] = useState('')
  const [showOnlyMyTx, setShowOnlyMyTx] = useState(false)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [expandedTx, setExpandedTx] = useState<Set<number>>(new Set())
  const [expandedParams, setExpandedParams] = useState<Set<number>>(new Set())
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set())

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

  const getStatusColor = (status: string) => {
    if (status === 'running') return { bg: 'from-cyan-500/30 to-blue-600/20', border: 'border-cyan-400/60', text: 'text-cyan-300' }
    if (status === 'pending') return { bg: 'from-yellow-500/30 to-yellow-600/20', border: 'border-yellow-400/60', text: 'text-yellow-300' }
    if (status === 'success' || status === 'finished') return { bg: 'from-emerald-500/30 to-green-600/20', border: 'border-emerald-400/60', text: 'text-emerald-300' }
    return { bg: 'from-rose-500/30 to-red-600/20', border: 'border-rose-400/60', text: 'text-rose-300' }
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

  const toggleExpand = (idx: number) => {
    setExpandedTx(prev => {
      const newSet = new Set(prev)
      if (newSet.has(idx)) {
        newSet.delete(idx)
      } else {
        newSet.add(idx)
      }
      return newSet
    })
  }

  const toggleParams = (idx: number) => {
    setExpandedParams(prev => {
      const newSet = new Set(prev)
      if (newSet.has(idx)) {
        newSet.delete(idx)
      } else {
        newSet.add(idx)
      }
      return newSet
    })
  }

  const toggleResults = (idx: number) => {
    setExpandedResults(prev => {
      const newSet = new Set(prev)
      if (newSet.has(idx)) {
        newSet.delete(idx)
      } else {
        newSet.add(idx)
      }
      return newSet
    })
  }

  const renderValue = (value: any) => {
    if (value === null || value === undefined) {
      return <span className="text-gray-500">null</span>
    }
    
    if (typeof value === 'object' && !Array.isArray(value)) {
      return (
        <div className="space-y-2">
          {Object.entries(value).map(([k, v]) => (
            <div key={k} className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/40">
              <div className="flex items-start gap-2 mb-1">
                <span className="text-cyan-400 font-bold text-sm">{k}:</span>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <span className="text-white break-all font-mono text-sm">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                <CopyButton text={typeof v === 'object' ? JSON.stringify(v) : String(v)} size="sm" />
              </div>
            </div>
          ))}
        </div>
      )
    }
    
    return (
      <div className="flex items-center gap-2">
        <span className="text-white break-all font-mono text-sm">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
        <CopyButton text={typeof value === 'object' ? JSON.stringify(value) : String(value)} size="sm" />
      </div>
    )
  }

  return (
    <div 
      className={`border-2 rounded-xl overflow-hidden backdrop-blur-md transition-all shadow-2xl ${
        isHovered ? 'bg-gradient-to-br from-slate-900/80 to-slate-800/60 border-cyan-400/60' : 'bg-gradient-to-br from-slate-900/60 to-slate-800/40 border-slate-700/50'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="p-4 space-y-3 bg-gradient-to-r from-slate-950/90 to-slate-900/80">
        <div className="mb-4 flex gap-3 items-center">
          <input
            type="text"
            placeholder="🔍 search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 bg-slate-900/80 border-2 border-slate-600/60 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 focus:border-cyan-400/80 transition-all backdrop-blur-sm font-semibold shadow-inner"
            style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '1.0em', height: '44px' }}
          />
          <button
            onClick={() => setShowOnlyMyTx(!showOnlyMyTx)}
            className={`px-4 py-2 border-2 rounded-lg font-bold transition-all backdrop-blur-sm shadow-lg ${
              showOnlyMyTx 
                ? 'bg-gradient-to-r from-purple-500/40 to-pink-500/40 border-purple-400/80 shadow-purple-500/30' 
                : 'bg-slate-800/60 border-slate-600/60 hover:bg-slate-700/60 hover:border-slate-500/80 shadow-slate-500/20'
            } text-white`}
            title="Toggle only my transactions"
            style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '1.0em', height: '44px' }}
          >
            {showOnlyMyTx ? '✓ my tx' : 'my tx'}
          </button>
          <button
            onClick={handleSync}
            className="px-4 py-2 bg-gradient-to-r from-emerald-500/30 to-green-500/30 border-2 border-emerald-400/60 rounded-lg text-white hover:from-emerald-500/40 hover:to-green-500/40 hover:border-emerald-300/80 transition-all font-bold backdrop-blur-sm shadow-lg shadow-emerald-500/20"
            title="Sync transactions"
            style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '1.0em', height: '44px' }}
          >
            🔄 sync
          </button>
        </div>

        <div className="max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-500/60 scrollbar-track-slate-800/40 pr-2">
          {loading ? (
            <div className="flex items-center justify-center">
              <BatteryLoader />
            </div>
          ) : (
            filteredTransactions.map((tx, idx) => {
              const statusColors = getStatusColor(tx.status)
              const timestamp = parseInt(tx.time)
              const formattedTime = isNaN(timestamp) ? tx.time : time2utc(timestamp)
              const timeLines = formattedTime.split(' ')
              const costUsd = tx.cost !== undefined ? tx.cost : 0
              const isExpanded = expandedTx.has(idx)
              const isParamsExpanded = expandedParams.has(idx)
              const isResultsExpanded = expandedResults.has(idx)

              return (
                <div key={`${tx.client}-${idx}`} className={`border-2 rounded-xl bg-gradient-to-br ${statusColors.bg} ${statusColors.border} shadow-xl transition-all hover:shadow-2xl hover:scale-[1.01] mb-3`}>
                  <div className="p-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => toggleExpand(idx)}
                          className="px-2 py-2 bg-slate-800/60 hover:bg-slate-700/80 border-2 border-slate-600/60 rounded-lg transition-all flex-shrink-0"
                          style={{ height: '40px', width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <span className="text-white text-lg">{isExpanded ? '▼' : '▶'}</span>
                        </button>
                        <span className={`font-bold text-white px-3 py-2 rounded-lg bg-gradient-to-r from-slate-800/80 to-slate-700/60 shadow-lg flex-shrink-0`} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '1.0em', height: '40px', display: 'flex', alignItems: 'center' }}>
                          ⚡ {tx.fn}
                        </span>
                        <CopyButton text={tx.fn} size="sm" />
                        {tx.signature && (
                          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-400/50 shadow-md flex-shrink-0" style={{ height: '40px' }}>
                            <span className="text-white" style={{ fontSize: '0.9em' }}>✍️</span>
                            <span className="font-mono text-white font-semibold" style={{ fontSize: '0.85em' }}>{tx.signature.slice(0, 6)}...{tx.signature.slice(-4)}</span>
                            <CopyButton text={tx.signature} size="sm" />
                          </div>
                        )}
                        {tx.key && (
                          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/50 shadow-md flex-shrink-0" style={{ height: '40px' }}>
                            <span className="text-white" style={{ fontSize: '0.9em' }}>🔐</span>
                            <span className="font-mono text-white font-semibold" style={{ fontSize: '0.85em' }}>{tx.key.slice(0, 6)}...{tx.key.slice(-4)}</span>
                            <CopyButton text={tx.key} size="sm" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-3 py-2 rounded-lg font-bold text-white bg-gradient-to-r from-slate-700/60 to-slate-600/40 shadow-md uppercase tracking-wide flex-shrink-0`} style={{ fontSize: '1.0em', height: '40px', display: 'flex', alignItems: 'center' }}>
                          {tx.status}
                        </span>
                        <span className="bg-gradient-to-r from-emerald-500/30 to-green-500/30 border-2 border-emerald-400/60 px-3 py-2 rounded-lg font-mono text-white font-bold shadow-md shadow-emerald-500/20 flex-shrink-0" style={{ fontSize: '1.0em', height: '40px', display: 'flex', alignItems: 'center' }}>
                          💵 ${costUsd.toFixed(4)}
                        </span>
                        {tx.cid && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-2 border-blue-400/50 shadow-md flex-shrink-0" style={{ height: '40px' }}>
                            <span className="text-white" style={{ fontSize: '1.0em' }}>🔗</span>
                            <span className="font-mono text-white font-semibold" style={{ fontSize: '1.0em' }}>{tx.cid.slice(0, 3)}</span>
                            <CopyButton text={tx.cid} size="sm" />
                          </div>
                        )}
                        {tx.delta !== undefined && (
                          <span className="bg-gradient-to-r from-cyan-500/30 to-blue-500/30 border-2 border-cyan-400/60 px-3 py-2 rounded-lg font-mono text-white font-bold shadow-md shadow-cyan-500/20 flex-shrink-0" style={{ fontSize: '1.0em', height: '40px', display: 'flex', alignItems: 'center' }}>
                            ⚡ {tx.delta.toFixed(2)}s
                          </span>
                        )}
                        <div className="flex flex-col items-start px-3 py-2 rounded-lg bg-gradient-to-r from-slate-700/40 to-slate-600/30 border-2 border-slate-500/50 shadow-md flex-shrink-0" style={{ minHeight: '40px', justifyContent: 'center' }}>
                          {timeLines.map((line, i) => (
                            <span key={i} className="text-white font-semibold" style={{ fontSize: '0.85em', lineHeight: '1.2' }}>{line}</span>
                          ))}
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="mt-3 space-y-3">
                          {tx.params && (
                            <div className="bg-slate-900/60 border-2 border-slate-700/50 rounded-lg overflow-hidden">
                              <button
                                onClick={() => toggleParams(idx)}
                                className="w-full flex items-center justify-between p-3 hover:bg-slate-800/40 transition-all"
                              >
                                <span className="text-cyan-300 font-bold text-sm">📋 PARAMS</span>
                                <div className="flex items-center gap-2">
                                  <CopyButton text={JSON.stringify(tx.params, null, 2)} size="sm" />
                                  <span className="text-white text-lg">{isParamsExpanded ? '▼' : '▶'}</span>
                                </div>
                              </button>
                              {isParamsExpanded && (
                                <div className="p-3 bg-slate-950/80 border-t border-slate-700/50">
                                  {renderValue(tx.params)}
                                </div>
                              )}
                            </div>
                          )}
                          {tx.result !== undefined && (
                            <div className="bg-slate-900/60 border-2 border-slate-700/50 rounded-lg overflow-hidden">
                              <button
                                onClick={() => toggleResults(idx)}
                                className="w-full flex items-center justify-between p-3 hover:bg-slate-800/40 transition-all"
                              >
                                <span className="text-emerald-300 font-bold text-sm">✅ RESULT</span>
                                <div className="flex items-center gap-2">
                                  <CopyButton text={typeof tx.result === 'object' ? JSON.stringify(tx.result, null, 2) : String(tx.result)} size="sm" />
                                  <span className="text-white text-lg">{isResultsExpanded ? '▼' : '▶'}</span>
                                </div>
                              </button>
                              {isResultsExpanded && (
                                <div className="p-3 bg-slate-950/80 border-t border-slate-700/50">
                                  {renderValue(tx.result)}
                                </div>
                              )}
                            </div>
                          )}
                          {tx.client && (
                            <div className="bg-slate-900/60 border-2 border-slate-700/50 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-purple-300 font-bold text-sm flex-shrink-0">👤 CLIENT</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-white text-xs bg-slate-950/80 px-2 py-1 rounded border border-slate-700/50 break-all">{tx.client}</span>
                                <CopyButton text={tx.client} size="sm" />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {!loading && filteredTransactions.length === 0 && (
          <div className="text-white text-center py-12 border-2 border-dashed border-slate-600/50 rounded-xl bg-slate-900/40" style={{ fontSize: '1.0em' }}>
            {searchTerm ? '🔍 No transactions match your search' : showOnlyMyTx ? '📭 No transactions from you yet' : '📭 No transactions yet'}
          </div>
        )}

        <div className="flex items-center justify-between mt-4 gap-3 pb-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500/30 to-blue-500/30 border-2 border-cyan-400/60 rounded-lg text-white hover:from-cyan-500/40 hover:to-blue-500/40 hover:border-cyan-300/80 transition-all font-bold disabled:opacity-40 disabled:cursor-not-allowed backdrop-blur-sm shadow-lg shadow-cyan-500/20"
              style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '1.0em', height: '44px' }}
            >
              ← prev
            </button>
            <span className="text-white font-mono px-4 py-2 bg-slate-800/60 rounded-lg border-2 border-slate-600/50 font-bold shadow-md" style={{ fontSize: '1.0em', height: '44px', display: 'flex', alignItems: 'center' }}>
              Page {page + 1}{hasMore ? '+' : ''}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={!hasMore}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500/30 to-blue-500/30 border-2 border-cyan-400/60 rounded-lg text-white hover:from-cyan-500/40 hover:to-blue-500/40 hover:border-cyan-300/80 transition-all font-bold disabled:opacity-40 disabled:cursor-not-allowed backdrop-blur-sm shadow-lg shadow-cyan-500/20"
              style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '1.0em', height: '44px' }}
            >
              next →
            </button>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-white font-semibold" style={{ fontSize: '1.0em' }}>Per page:</label>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
              className="px-4 py-2 bg-slate-900/80 border-2 border-slate-600/60 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/60 focus:border-cyan-400/80 transition-all backdrop-blur-sm font-bold shadow-inner"
              style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '1.0em', height: '44px' }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
})

TransactionsPanel.displayName = 'TransactionsPanel'
