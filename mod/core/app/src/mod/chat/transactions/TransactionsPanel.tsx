'use client'

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { userContext } from '@/mod/context'
import { TransactionCard } from './TransactionCard'
import { text2color } from '@/mod/utils'
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
    { v: txs.length.toLocaleString(), c: '#06b6d4', l: 'txs' },
    { v: success.toLocaleString(), c: '#22c55e', l: '✓' },
    { v: errors.toLocaleString(), c: '#ef4444', l: '✗' },
    { v: pending.toLocaleString(), c: '#eab308', l: '◌' },
    { v: `${avgDelta.toFixed(2)}s`, c: '#f97316', l: 'avg' },
    { v: `$${cost.toFixed(4)}`, c: '#a855f7', l: 'cost' },
    { v: uniqueModules.toLocaleString(), c: '#14b8a6', l: 'mods' },
    { v: uniqueUsers.toLocaleString(), c: '#ec4899', l: 'users' },
  ]

  return (
    <div className="flex gap-2 flex-wrap px-0 py-3 border-b border-cyan-500/20 bg-black/30 rounded-lg">
      <span className="text-[10px] text-gray-600 self-center mr-1 ml-2">24h</span>
      {items.map((item, i) => (
        <div
          key={i}
          className="bg-black/50 border rounded-lg px-3 py-1.5 flex flex-col items-center min-w-[60px]"
          style={{ borderColor: `${item.c}30` }}
        >
          <span className="text-sm font-black font-mono" style={{ color: item.c }}>{item.v}</span>
          <span className="text-[9px]" style={{ color: `${item.c}80` }}>{item.l}</span>
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

  const successCount = transactions.filter(tx => tx.status === 'success' || tx.status === 'finished' || tx.status === 'complete').length
  const errorCount = transactions.filter(tx => tx.status === 'error' || tx.status === 'failed' || tx.status === 'cancelled').length
  const pendingCount = transactions.filter(tx => tx.status === 'pending' || tx.status === 'running').length
  const totalCost = transactions.reduce((sum, tx) => sum + (tx.cost || 0), 0)

  return (
    <div className="flex flex-col h-full bg-black/40" style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b-2 border-cyan-500/30 bg-black/60">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {!hideTitle && (
              <h2 className="text-lg font-black text-cyan-400 tracking-wider uppercase">⚡ Transactions</h2>
            )}
            <span className="text-xs bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 px-2 py-1 rounded-lg font-bold">
              {filteredTransactions.length}/{totalCount}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border-2 transition-all ${
                autoRefresh
                  ? 'bg-green-500/20 border-green-500/40 text-green-400'
                  : 'bg-gray-500/20 border-gray-500/40 text-gray-400'
              }`}
              title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            >
              {autoRefresh ? '● live' : '○ paused'}
            </button>
            <button
              onClick={fetchTransactions}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border-2 bg-cyan-500/20 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/30 transition-all disabled:opacity-50"
              title="Refresh"
            >
              <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border-2 bg-purple-500/20 border-purple-500/40 text-purple-400 hover:bg-purple-500/30 transition-all"
              title={`Sort: ${sortOrder}`}
            >
              {sortOrder === 'newest' ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronUpIcon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Search and filter */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="search transactions..."
              className="w-full bg-black/40 border-2 border-gray-700/40 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:border-cyan-500/50 focus:outline-none transition-all font-mono"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-black/40 border-2 border-gray-700/40 rounded-lg px-3 py-2 text-sm text-gray-300 focus:border-cyan-500/50 focus:outline-none transition-all font-mono cursor-pointer"
          >
            <option value="all">all</option>
            <option value="success">success</option>
            <option value="error">error</option>
            <option value="pending">pending</option>
          </select>
        </div>

        {/* 24h Stats - below search bar */}
        {showStats && (
          <div className="mt-3">
            <Stats24h transactions={transactions} />
          </div>
        )}

        {/* Quick stats bar (non-24h, always shown) */}
        {!showStats && (
          <div className="flex gap-2 mt-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-black/40 border border-green-500/30 rounded-lg px-3 py-1.5">
              <span className="text-green-400 text-xs font-bold">✓ {successCount}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/40 border border-red-500/30 rounded-lg px-3 py-1.5">
              <span className="text-red-400 text-xs font-bold">✗ {errorCount}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/40 border border-yellow-500/30 rounded-lg px-3 py-1.5">
              <span className="text-yellow-400 text-xs font-bold">● {pendingCount}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/40 border border-green-900/40 rounded-lg px-3 py-1.5">
              <span className="text-green-400 text-xs font-bold">${totalCost.toFixed(4)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Transaction list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {error && (
          <div className="p-4 bg-red-500/10 border-2 border-red-500/40 rounded-xl mb-4">
            <p className="text-red-400 text-sm font-mono">{error}</p>
            <button
              onClick={fetchTransactions}
              className="mt-2 px-3 py-1 bg-red-500/20 border border-red-500/40 rounded-lg text-red-400 text-xs font-bold hover:bg-red-500/30 transition-all"
            >
              retry
            </button>
          </div>
        )}

        {loading && transactions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-400 border-t-transparent" />
            <span className="text-gray-500 text-sm font-mono">loading transactions...</span>
          </div>
        )}

        {!loading && filteredTransactions.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <span className="text-4xl">📭</span>
            <span className="text-gray-500 text-sm font-mono">
              {searchQuery || statusFilter !== 'all' ? 'no matching transactions' : 'no transactions yet'}
            </span>
            {(searchQuery || statusFilter !== 'all') && (
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter('all') }}
                className="px-3 py-1.5 bg-cyan-500/20 border border-cyan-500/40 rounded-lg text-cyan-400 text-xs font-bold hover:bg-cyan-500/30 transition-all"
              >
                clear filters
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
        <div className="flex-shrink-0 p-3 border-t-2 border-cyan-500/30 bg-black/60 flex items-center justify-between">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-4 py-2 bg-cyan-500/20 border-2 border-cyan-500/40 rounded-lg text-cyan-400 text-xs font-bold hover:bg-cyan-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← prev
          </button>
          <span className="text-gray-500 text-xs font-mono">page {page + 1}</span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={filteredTransactions.length < pageSize}
            className="px-4 py-2 bg-cyan-500/20 border-2 border-cyan-500/40 rounded-lg text-cyan-400 text-xs font-bold hover:bg-cyan-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            next →
          </button>
        </div>
      )}
    </div>
  )
})
