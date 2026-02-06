"use client";

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { userContext } from '@/mod/context'
import { TransactionCard } from './TransactionCard'
import { text2color, colorWithOpacity } from '@/mod/utils'
import { ArrowPathIcon, FunnelIcon, MagnifyingGlassIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'

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

interface TransactionsPanelProps {
  hideTitle?: boolean
  showStats?: boolean
}

function Stats24h({ transactions }: { transactions: Transaction[] }) {
  const now = Date.now() / 1000
  const last24h = now - (24 * 60 * 60)
  const txs = transactions.filter((tx: any) => {
    const t = typeof tx.time === 'string' ? parseInt(tx.time) : tx.time
    return t >= last24h
  })

  const success = txs.filter((tx: any) => tx.status === 'success' || tx.status === 'finished' || tx.status === 'complete').length
  const errors = txs.filter((tx: any) => tx.status === 'error' || tx.status === 'failed' || tx.status === 'cancelled').length
  const pending = txs.filter((tx: any) => tx.status === 'pending' || tx.status === 'running').length
  const cost = txs.reduce((sum: number, tx: any) => sum + (tx.cost || 0), 0)
  const withDelta = txs.filter((tx: any) => tx.delta !== undefined)
  const avgDelta = withDelta.length > 0 ? withDelta.reduce((sum: number, tx: any) => sum + tx.delta, 0) / withDelta.length : 0
  const uniqueModules = new Set(txs.map((tx: any) => tx.module).filter(Boolean)).size
  const uniqueUsers = new Set(txs.map((tx: any) => tx.client || tx.key).filter(Boolean)).size

  const items = [
    { v: txs.length.toLocaleString(), c: '#06b6d4', l: 'txs', icon: '⚡' },
    { v: success.toLocaleString(), c: '#22c55e', l: 'success', icon: '✓' },
    { v: errors.toLocaleString(), c: '#ef4444', l: 'errors', icon: '✗' },
    { v: pending.toLocaleString(), c: '#eab308', l: 'pending', icon: '●' },
    { v: `${avgDelta.toFixed(2)}s`, c: '#f97316', l: 'avg time', icon: '⏱' },
    { v: `$${cost.toFixed(4)}`, c: '#a855f7', l: 'total cost', icon: '💰' },
    { v: uniqueModules.toLocaleString(), c: '#14b8a6', l: 'modules', icon: '📦' },
    { v: uniqueUsers.toLocaleString(), c: '#ec4899', l: 'users', icon: '👥' },
  ]

  return (
    <div className="flex gap-3 flex-wrap px-0 py-4 border-b-2 bg-gradient-to-br from-black/40 via-black/30 to-transparent rounded-xl backdrop-blur-sm" style={{ borderColor: colorWithOpacity('#06b6d4', 0.2) }}>
      <span className="text-xs font-bold text-cyan-500/60 self-center mr-2 ml-3 uppercase tracking-wider">24h Stats</span>
      {items.map((item, i) => (
        <div
          key={i}
          className="bg-gradient-to-br from-black/70 to-black/50 border-2 rounded-xl px-4 py-2.5 flex flex-col items-center min-w-[80px] hover:scale-105 transition-all shadow-lg hover:shadow-xl"
          style={{
            borderColor: colorWithOpacity(item.c, 0.3),
            boxShadow: `0 2px 10px ${colorWithOpacity(item.c, 0.1)}`
          }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-base">{item.icon}</span>
            <span className="text-base font-black font-mono" style={{ color: item.c }}>{item.v}</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: colorWithOpacity(item.c, 0.7) }}>{item.l}</span>
        </div>
      ))}
    </div>
  )
}

export const TransactionsPanel = forwardRef<{ handleSync: () => void }, TransactionsPanelProps>(function TransactionsPanel({ hideTitle = false, showStats = false }, ref) {
  const { client } = userContext()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(0)
  const [pageSize] = useState(50)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [totalCount, setTotalCount] = useState(0)

  const fetchTransactions = useCallback(async () => {
    if (!client) return
    setLoading(true)
    setError(null)
    try {
      const result = await client.call('txs', { df: 0, n: pageSize, page })
      const txs = Array.isArray(result) ? result : []
      setTransactions(txs)
      setTotalCount(txs.length)
    } catch (err: any) {
      console.error('Failed to fetch transactions:', err)
      setError(err?.message || 'Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }, [client, page, pageSize])

  useImperativeHandle(ref, () => ({
    handleSync: () => {
      fetchTransactions()
    }
  }))

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  // Auto-refresh every 10s
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchTransactions, 10000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchTransactions])

  // Filter and sort
  useEffect(() => {
    let filtered = [...transactions]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(tx =>
        (tx.fn && tx.fn.toLowerCase().includes(q)) ||
        (tx.key && tx.key.toLowerCase().includes(q)) ||
        (tx.cid && tx.cid.toLowerCase().includes(q)) ||
        (tx.hash && tx.hash.toLowerCase().includes(q)) ||
        (tx.module && tx.module.toLowerCase().includes(q)) ||
        (tx.owner && tx.owner.toLowerCase().includes(q)) ||
        (tx.status && tx.status.toLowerCase().includes(q))
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(tx => {
        if (statusFilter === 'success') return tx.status === 'success' || tx.status === 'finished' || tx.status === 'complete'
        if (statusFilter === 'error') return tx.status === 'error' || tx.status === 'failed' || tx.status === 'cancelled'
        if (statusFilter === 'pending') return tx.status === 'pending' || tx.status === 'running'
        return true
      })
    }

    filtered.sort((a, b) => {
      const timeA = parseInt(a.time) || 0
      const timeB = parseInt(b.time) || 0
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB
    })

    setFilteredTransactions(filtered)
  }, [transactions, searchQuery, statusFilter, sortOrder])

  const handleToggleExpand = (idx: number) => {
    setExpandedIdx(expandedIdx === idx ? null : idx)
  }

  // Calculate stats from FILTERED transactions
  const successCount = filteredTransactions.filter(tx => tx.status === 'success' || tx.status === 'finished' || tx.status === 'complete').length
  const errorCount = filteredTransactions.filter(tx => tx.status === 'error' || tx.status === 'failed' || tx.status === 'cancelled').length
  const pendingCount = filteredTransactions.filter(tx => tx.status === 'pending' || tx.status === 'running').length
  const totalCost = filteredTransactions.reduce((sum, tx) => sum + (tx.cost || 0), 0)

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-950 via-black to-gray-900" style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>
      {/* Header */}
      <div className="flex-shrink-0 p-5 border-b-2 bg-gradient-to-r from-black/80 via-black/70 to-black/80 backdrop-blur-lg" style={{ borderColor: colorWithOpacity('#06b6d4', 0.3) }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {!hideTitle && (
              <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 tracking-wider uppercase">⚡ Transactions</h2>
            )}
            <div className="flex items-center gap-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-2 rounded-xl px-4 py-2 shadow-lg" style={{ borderColor: colorWithOpacity('#06b6d4', 0.4) }}>
              <span className="text-sm font-black text-cyan-400">{filteredTransactions.length}</span>
              <span className="text-xs text-cyan-500/60">/</span>
              <span className="text-sm font-bold text-cyan-500/80">{totalCount}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 text-xs font-bold rounded-xl border-2 transition-all shadow-lg hover:scale-105 ${
                autoRefresh
                  ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/50 text-green-400 shadow-green-500/20'
                  : 'bg-gradient-to-r from-gray-500/20 to-gray-600/20 border-gray-500/40 text-gray-400'
              }`}
              title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            >
              {autoRefresh ? '● LIVE' : '○ PAUSED'}
            </button>
            <button
              onClick={fetchTransactions}
              disabled={loading}
              className="px-4 py-2 text-xs font-bold rounded-xl border-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-cyan-500/50 text-cyan-400 hover:scale-105 transition-all disabled:opacity-50 shadow-lg shadow-cyan-500/10"
              title="Refresh"
            >
              <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
              className="px-4 py-2 text-xs font-bold rounded-xl border-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/50 text-purple-400 hover:scale-105 transition-all shadow-lg shadow-purple-500/10"
              title={`Sort: ${sortOrder}`}
            >
              {sortOrder === 'newest' ? <ChevronDownIcon className="w-5 h-5" /> : <ChevronUpIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Search and filter */}
        <div className="flex gap-3">
          <div className="flex-1 relative group">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500/50 group-focus-within:text-cyan-400 transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by function, key, hash, module..."
              className="w-full bg-gradient-to-r from-black/60 to-black/40 border-2 rounded-xl pl-12 pr-4 py-3 text-sm text-gray-200 placeholder-gray-600 transition-all font-mono shadow-lg backdrop-blur-sm hover:shadow-xl"
              style={{
                borderColor: colorWithOpacity('#06b6d4', 0.3),
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = colorWithOpacity('#06b6d4', 0.6)}
              onBlur={(e) => e.target.style.borderColor = colorWithOpacity('#06b6d4', 0.3)}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gradient-to-r from-black/60 to-black/40 border-2 rounded-xl px-5 py-3 text-sm font-bold text-gray-200 transition-all font-mono cursor-pointer shadow-lg hover:scale-105 backdrop-blur-sm uppercase tracking-wider"
            style={{ borderColor: colorWithOpacity('#06b6d4', 0.3) }}
          >
            <option value="all">🔍 All</option>
            <option value="success">✓ Success</option>
            <option value="error">✗ Errors</option>
            <option value="pending">● Pending</option>
          </select>
        </div>

        {/* 24h Stats - below search bar */}
        {showStats && (
          <div className="mt-4">
            <Stats24h transactions={filteredTransactions} />
          </div>
        )}

        {/* Quick stats bar (non-24h, always shown) - now uses filtered transactions */}
        {!showStats && (
          <div className="flex gap-3 mt-4 flex-wrap">
            <div className="flex items-center gap-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-2 rounded-xl px-4 py-2 shadow-lg hover:scale-105 transition-all" style={{ borderColor: colorWithOpacity('#22c55e', 0.4) }}>
              <span className="text-lg">✓</span>
              <span className="text-green-400 text-sm font-black">{successCount}</span>
            </div>
            <div className="flex items-center gap-2 bg-gradient-to-r from-red-500/20 to-rose-500/20 border-2 rounded-xl px-4 py-2 shadow-lg hover:scale-105 transition-all" style={{ borderColor: colorWithOpacity('#ef4444', 0.4) }}>
              <span className="text-lg">✗</span>
              <span className="text-red-400 text-sm font-black">{errorCount}</span>
            </div>
            <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-2 rounded-xl px-4 py-2 shadow-lg hover:scale-105 transition-all" style={{ borderColor: colorWithOpacity('#eab308', 0.4) }}>
              <span className="text-lg">●</span>
              <span className="text-yellow-400 text-sm font-black">{pendingCount}</span>
            </div>
            <div className="flex items-center gap-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-2 rounded-xl px-4 py-2 shadow-lg hover:scale-105 transition-all" style={{ borderColor: colorWithOpacity('#a855f7', 0.4) }}>
              <span className="text-lg">💰</span>
              <span className="text-purple-400 text-sm font-black">${totalCost.toFixed(4)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Transaction list */}
      <div className="flex-1 overflow-y-auto p-5 space-y-2">
        {error && (
          <div className="p-6 bg-gradient-to-br from-red-500/10 to-rose-500/10 border-2 rounded-2xl mb-4 shadow-xl backdrop-blur-sm" style={{ borderColor: colorWithOpacity('#ef4444', 0.4) }}>
            <p className="text-red-400 text-sm font-mono mb-3">{error}</p>
            <button
              onClick={fetchTransactions}
              className="px-5 py-2.5 bg-gradient-to-r from-red-500/20 to-rose-500/20 border-2 rounded-xl text-red-400 text-xs font-bold hover:scale-105 transition-all shadow-lg"
              style={{ borderColor: colorWithOpacity('#ef4444', 0.5) }}
            >
              RETRY
            </button>
          </div>
        )}

        {loading && transactions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-t-transparent" style={{ borderColor: colorWithOpacity('#06b6d4', 0.3), borderTopColor: 'transparent' }} />
              <div className="absolute inset-0 animate-ping rounded-full" style={{ backgroundColor: colorWithOpacity('#06b6d4', 0.2) }} />
            </div>
            <span className="text-gray-400 text-base font-mono font-bold tracking-wider">LOADING TRANSACTIONS...</span>
          </div>
        )}

        {!loading && filteredTransactions.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <span className="text-6xl">📭</span>
            <span className="text-gray-400 text-lg font-mono font-bold tracking-wider">
              {searchQuery || statusFilter !== 'all' ? 'NO MATCHING TRANSACTIONS' : 'NO TRANSACTIONS YET'}
            </span>
            {(searchQuery || statusFilter !== 'all') && (
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter('all') }}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-2 rounded-xl text-cyan-400 text-sm font-bold hover:scale-105 transition-all shadow-lg"
                style={{ borderColor: colorWithOpacity('#06b6d4', 0.5) }}
              >
                CLEAR FILTERS
              </button>
            )}
          </div>
        )}

        {filteredTransactions.map((tx, idx) => (
          <div key={tx.cid || tx.hash || idx} onClick={() => handleToggleExpand(idx)}>
            <TransactionCard
              tx={tx}
              idx={idx}
              isExpanded={expandedIdx === idx}
            />
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalCount >= pageSize && (
        <div className="flex-shrink-0 p-5 border-t-2 bg-gradient-to-r from-black/80 via-black/70 to-black/80 backdrop-blur-lg flex items-center justify-between" style={{ borderColor: colorWithOpacity('#06b6d4', 0.3) }}>
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-2 rounded-xl text-cyan-400 text-sm font-bold hover:scale-105 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
            style={{ borderColor: colorWithOpacity('#06b6d4', 0.5) }}
          >
            ← PREV
          </button>
          <span className="text-gray-400 text-sm font-mono font-bold tracking-wider">PAGE {page + 1}</span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={filteredTransactions.length < pageSize}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-2 rounded-xl text-cyan-400 text-sm font-bold hover:scale-105 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
            style={{ borderColor: colorWithOpacity('#06b6d4', 0.5) }}
          >
            NEXT →
          </button>
        </div>
      )}
    </div>
  )
})
