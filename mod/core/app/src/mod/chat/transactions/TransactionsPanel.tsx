"use client";

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { userContext } from '@/mod/context'
import { TransactionCard } from './TransactionCard'
import { ArrowPathIcon, MagnifyingGlassIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { colorWithOpacity } from '@/mod/utils'

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

export const TransactionsPanel = forwardRef<{ handleSync: () => void }, TransactionsPanelProps>(function TransactionsPanel({ hideTitle = false, showStats = false }, ref) {
  const { client } = userContext()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [ownerFilter, setOwnerFilter] = useState<string>('all')
  const [page, setPage] = useState(0)
  const [pageSize] = useState(50)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [totalCount, setTotalCount] = useState(0)
  const [uniqueOwners, setUniqueOwners] = useState<string[]>([])

  const fetchTransactions = useCallback(async () => {
    if (!client) return
    setLoading(true)
    setError(null)
    try {
      const result = await client.call('txs', { df: 0, n: pageSize, page })
      const txs = Array.isArray(result) ? result : []
      setTransactions(txs)
      setTotalCount(txs.length)

      // Extract unique owners
      const owners = new Set<string>()
      txs.forEach((tx: Transaction) => {
        if (tx.owner) owners.add(tx.owner)
      })
      setUniqueOwners(Array.from(owners).sort())
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

    if (ownerFilter !== 'all') {
      filtered = filtered.filter(tx => tx.owner === ownerFilter)
    }

    filtered.sort((a, b) => {
      const timeA = parseInt(a.time) || 0
      const timeB = parseInt(b.time) || 0
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB
    })

    setFilteredTransactions(filtered)
  }, [transactions, searchQuery, statusFilter, ownerFilter, sortOrder])

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
      <div className="flex-shrink-0 p-5 border-b-2 bg-gradient-to-br from-black/90 via-gray-900/80 to-black/90 backdrop-blur-xl" style={{ borderColor: colorWithOpacity('#06b6d4', 0.4), boxShadow: `0 4px 20px ${colorWithOpacity('#06b6d4', 0.1)}` }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 blur-lg opacity-50" style={{ backgroundColor: '#06b6d4' }} />
              <div className="relative flex items-center gap-2 bg-gradient-to-br from-cyan-500/30 to-blue-500/30 border-2 rounded-xl px-5 py-2.5 shadow-xl backdrop-blur-sm" style={{ borderColor: colorWithOpacity('#06b6d4', 0.5) }}>
                <span className="text-base font-black text-cyan-300">{filteredTransactions.length}</span>
                <span className="text-xs text-cyan-400/60 font-bold">/</span>
                <span className="text-base font-bold text-cyan-400/90">{totalCount}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`relative px-5 py-2.5 text-xs font-black rounded-xl border-2 transition-all shadow-xl hover:scale-105 uppercase tracking-wider ${
                autoRefresh
                  ? 'bg-gradient-to-br from-green-500/30 to-emerald-500/30 border-green-400/60 text-green-300'
                  : 'bg-gradient-to-br from-gray-500/20 to-gray-600/20 border-gray-500/40 text-gray-400'
              }`}
              title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            >
              {autoRefresh && <div className="absolute inset-0 blur-lg opacity-40" style={{ backgroundColor: '#22c55e' }} />}
              <span className="relative">{autoRefresh ? '● LIVE' : '○ PAUSED'}</span>
            </button>
            <button
              onClick={fetchTransactions}
              disabled={loading}
              className="relative px-4 py-2.5 text-xs font-black rounded-xl border-2 bg-gradient-to-br from-cyan-500/30 to-blue-500/30 border-cyan-400/60 text-cyan-300 hover:scale-105 transition-all disabled:opacity-50 shadow-xl backdrop-blur-sm"
              title="Refresh"
            >
              <div className="absolute inset-0 blur-lg opacity-40" style={{ backgroundColor: '#06b6d4' }} />
              <ArrowPathIcon className={`relative w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
              className="relative px-4 py-2.5 text-xs font-black rounded-xl border-2 bg-gradient-to-br from-purple-500/30 to-pink-500/30 border-purple-400/60 text-purple-300 hover:scale-105 transition-all shadow-xl backdrop-blur-sm"
              title={`Sort: ${sortOrder}`}
            >
              <div className="absolute inset-0 blur-lg opacity-40" style={{ backgroundColor: '#a855f7' }} />
              {sortOrder === 'newest' ? <ChevronDownIcon className="relative w-5 h-5" /> : <ChevronUpIcon className="relative w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Search and filters */}
        <div className="flex gap-3 mb-3">
          <div className="flex-1 relative group">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400/50 group-focus-within:text-cyan-300 transition-colors z-10" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by function, key, hash, module, owner..."
              className="w-full bg-gradient-to-br from-black/70 to-black/50 border-2 rounded-xl pl-12 pr-4 py-3 text-sm text-gray-200 placeholder-gray-500 transition-all font-mono shadow-xl backdrop-blur-sm hover:shadow-2xl"
              style={{
                borderColor: colorWithOpacity('#06b6d4', 0.4),
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = colorWithOpacity('#06b6d4', 0.7)}
              onBlur={(e) => e.target.style.borderColor = colorWithOpacity('#06b6d4', 0.4)}
            />
          </div>
        </div>

        {/* Filter row */}
        <div className="flex gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 bg-gradient-to-br from-black/70 to-black/50 border-2 rounded-xl px-4 py-3 text-sm font-bold text-gray-200 transition-all font-mono cursor-pointer shadow-xl hover:scale-105 backdrop-blur-sm uppercase tracking-wider"
            style={{ borderColor: colorWithOpacity('#06b6d4', 0.4) }}
          >
            <option value="all">🔍 All Status</option>
            <option value="success">✓ Success</option>
            <option value="error">✗ Errors</option>
            <option value="pending">● Pending</option>
          </select>

          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="flex-1 bg-gradient-to-br from-black/70 to-black/50 border-2 rounded-xl px-4 py-3 text-sm font-bold text-gray-200 transition-all font-mono cursor-pointer shadow-xl hover:scale-105 backdrop-blur-sm uppercase tracking-wider"
            style={{ borderColor: colorWithOpacity('#a855f7', 0.4) }}
          >
            <option value="all">👤 All Owners</option>
            {uniqueOwners.map(owner => (
              <option key={owner} value={owner}>
                {owner.substring(0, 8)}...{owner.substring(owner.length - 6)}
              </option>
            ))}
          </select>

          {(ownerFilter !== 'all' || statusFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => { setOwnerFilter('all'); setStatusFilter('all'); setSearchQuery('') }}
              className="relative px-5 py-3 text-xs font-black rounded-xl border-2 bg-gradient-to-br from-red-500/30 to-rose-500/30 border-red-400/60 text-red-300 hover:scale-105 transition-all shadow-xl backdrop-blur-sm uppercase tracking-wider"
            >
              <div className="absolute inset-0 blur-lg opacity-40" style={{ backgroundColor: '#ef4444' }} />
              <span className="relative">CLEAR</span>
            </button>
          )}
        </div>

        {/* 24h Stats - below search bar */}
        {/* {showStats && (
          <div className="mt-4">
            <Stats24h />
          </div>
        )} */}

        {/* Quick stats bar (non-24h, always shown) - now uses filtered transactions */}
        {!showStats && (
          <div className="flex gap-3 mt-4 flex-wrap">
            <div className="relative flex items-center gap-2 bg-gradient-to-br from-green-500/30 to-emerald-500/30 border-2 rounded-xl px-5 py-2.5 shadow-xl hover:scale-105 transition-all backdrop-blur-sm" style={{ borderColor: colorWithOpacity('#22c55e', 0.5) }}>
              <div className="absolute inset-0 blur-lg opacity-40" style={{ backgroundColor: '#22c55e' }} />
              <span className="relative text-lg">✓</span>
              <span className="relative text-green-300 text-sm font-black">{successCount}</span>
            </div>
            <div className="relative flex items-center gap-2 bg-gradient-to-br from-red-500/30 to-rose-500/30 border-2 rounded-xl px-5 py-2.5 shadow-xl hover:scale-105 transition-all backdrop-blur-sm" style={{ borderColor: colorWithOpacity('#ef4444', 0.5) }}>
              <div className="absolute inset-0 blur-lg opacity-40" style={{ backgroundColor: '#ef4444' }} />
              <span className="relative text-lg">✗</span>
              <span className="relative text-red-300 text-sm font-black">{errorCount}</span>
            </div>
            <div className="relative flex items-center gap-2 bg-gradient-to-br from-yellow-500/30 to-amber-500/30 border-2 rounded-xl px-5 py-2.5 shadow-xl hover:scale-105 transition-all backdrop-blur-sm" style={{ borderColor: colorWithOpacity('#eab308', 0.5) }}>
              <div className="absolute inset-0 blur-lg opacity-40" style={{ backgroundColor: '#eab308' }} />
              <span className="relative text-lg">●</span>
              <span className="relative text-yellow-300 text-sm font-black">{pendingCount}</span>
            </div>
            <div className="relative flex items-center gap-2 bg-gradient-to-br from-purple-500/30 to-pink-500/30 border-2 rounded-xl px-5 py-2.5 shadow-xl hover:scale-105 transition-all backdrop-blur-sm" style={{ borderColor: colorWithOpacity('#a855f7', 0.5) }}>
              <div className="absolute inset-0 blur-lg opacity-40" style={{ backgroundColor: '#a855f7' }} />
              <span className="relative text-lg">💰</span>
              <span className="relative text-purple-300 text-sm font-black">${totalCost.toFixed(4)}</span>
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
