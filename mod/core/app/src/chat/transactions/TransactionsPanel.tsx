"use client";

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { userContext } from '@/context'
import { TransactionCard } from './TransactionCard'
import { ArrowPathIcon, MagnifyingGlassIcon, ChevronDownIcon, ChevronUpIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { text2color, colorWithOpacity } from '@/utils'

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

interface Module {
  name: string
  key: string
  cid?: string
}

interface TransactionsPanelProps {
  hideTitle?: boolean
  showStats?: boolean
  initialStatusFilter?: string
  selectedModules?: Module[]
}

export const TransactionsPanel = forwardRef<{ handleSync: () => void }, TransactionsPanelProps>(function TransactionsPanel({ hideTitle = false, showStats = false, initialStatusFilter = 'all', selectedModules = [] }, ref) {
  const { client } = userContext()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter)
  const [ownerFilter, setOwnerFilter] = useState<string>('all')
  const [page, setPage] = useState(0)
  const [pageSize] = useState(50)
  const [autoRefresh, setAutoRefresh] = useState(false)
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
    handleSync: () => fetchTransactions()
  }))

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  // Poll more frequently for pending/running transactions
  useEffect(() => {
    if (!autoRefresh) return

    const hasPending = transactions.some(tx =>
      tx.status === 'pending' || tx.status === 'running'
    )

    // Poll every 3 seconds if there are pending transactions, otherwise every 10 seconds
    const pollInterval = hasPending ? 3000 : 10000
    const interval = setInterval(fetchTransactions, pollInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchTransactions, transactions])

  useEffect(() => {
    let filtered = [...transactions]

    // Filter by selected modules
    if (selectedModules.length > 0) {
      const moduleNames = new Set(selectedModules.map(m => m.name.toLowerCase()))
      const moduleKeys = new Set(selectedModules.map(m => m.key.toLowerCase()))
      filtered = filtered.filter(tx => {
        if (tx.fn) {
          const moduleName = tx.fn.split('/')[0].toLowerCase()
          // Check function name matches
          if (!moduleNames.has(moduleName)) return false

          // Only filter by owner if we can match it
          const ownerOrKey = tx.owner || tx.key
          if (ownerOrKey) {
            return moduleKeys.has(ownerOrKey.toLowerCase())
          }

          // If no owner, just match by function name
          return true
        }
        return false
      })
    }

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
  }, [transactions, searchQuery, statusFilter, ownerFilter, sortOrder, selectedModules])

  const handleToggleExpand = (idx: number) => {
    setExpandedIdx(expandedIdx === idx ? null : idx)
  }

  const successCount = filteredTransactions.filter(tx => tx.status === 'success' || tx.status === 'finished' || tx.status === 'complete').length
  const errorCount = filteredTransactions.filter(tx => tx.status === 'error' || tx.status === 'failed' || tx.status === 'cancelled').length
  const pendingCount = filteredTransactions.filter(tx => tx.status === 'pending' || tx.status === 'running').length
  const totalCost = filteredTransactions.reduce((sum, tx) => sum + (tx.cost || 0), 0)
  const hasFilters = ownerFilter !== 'all' || statusFilter !== 'all' || searchQuery

  return (
    <div className="flex flex-col h-full bg-neutral-950 font-mono">
      {/* Compact Single-Line Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-transparent">
        <div className="flex items-center gap-3">
          {/* Transaction count */}
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-cyan-400">{filteredTransactions.length}</span>
            <span className="text-neutral-600 text-sm font-semibold uppercase tracking-wide">txs</span>
          </div>

          {/* Search - compressed */}
          <div className="relative flex-1 max-w-xs">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-lg bg-neutral-900 border border-neutral-800 pl-8 pr-3 py-1.5 text-sm text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-cyan-500/50 transition-all"
            />
          </div>

          {/* Filters - compressed */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 text-sm text-neutral-400 cursor-pointer focus:outline-none hover:bg-neutral-800 transition-all"
          >
            <option value="all">All</option>
            <option value="success">✓ OK</option>
            <option value="error">✗ Err</option>
            <option value="pending">◉ Run</option>
          </select>

          {uniqueOwners.length > 0 && (
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="rounded-lg bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 text-sm text-neutral-400 cursor-pointer focus:outline-none hover:bg-neutral-800 transition-all max-w-[120px]"
            >
              <option value="all">Owners</option>
              {uniqueOwners.map(owner => (
                <option key={owner} value={owner}>
                  {owner.substring(0, 6)}...
                </option>
              ))}
            </select>
          )}

          {hasFilters && (
            <button
              onClick={() => { setOwnerFilter('all'); setStatusFilter('all'); setSearchQuery('') }}
              className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
              title="Clear filters"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}

          {/* Stats */}
          <div className="flex gap-2.5 ml-auto text-sm font-semibold">
            <span className="flex items-center gap-1 text-green-400">
              <span className="text-base">{successCount}</span>
              <span className="text-xs">✓</span>
            </span>
            <span className="flex items-center gap-1 text-red-400">
              <span className="text-base">{errorCount}</span>
              <span className="text-xs">✗</span>
            </span>
            <span className="flex items-center gap-1 text-yellow-400">
              <span className="text-base">{pendingCount}</span>
              <span className="text-xs">◉</span>
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1.5 ml-2 border-l border-neutral-700 pl-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-2.5 py-1.5 text-sm font-semibold rounded-lg transition-all ${
                autoRefresh
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-neutral-800 text-neutral-500 hover:bg-neutral-700'
              }`}
              title="Auto-refresh"
            >
              {autoRefresh ? '● Live' : '○'}
            </button>

            <button
              onClick={fetchTransactions}
              disabled={loading}
              className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-cyan-400 transition-all disabled:opacity-50"
              title="Refresh"
            >
              <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
              className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-cyan-400 transition-all"
              title={sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}
            >
              {sortOrder === 'newest' ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronUpIcon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Transaction list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 mb-3">
            <p className="text-red-400 text-sm mb-3 font-medium">{error}</p>
            <button
              onClick={fetchTransactions}
              className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-semibold hover:bg-red-500/30 transition-all"
            >
              Retry
            </button>
          </div>
        )}

        {loading && transactions.length === 0 && (
          <div className="flex items-center justify-center py-12 gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-neutral-700 border-t-cyan-500" />
            <span className="text-neutral-400 text-base font-medium">Loading transactions...</span>
          </div>
        )}

        {!loading && filteredTransactions.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <span className="text-4xl">📭</span>
            <span className="text-neutral-400 text-base font-medium">
              {hasFilters ? 'No matching transactions' : 'No transactions yet'}
            </span>
            {hasFilters && (
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter('all'); setOwnerFilter('all') }}
                className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-300 text-sm font-semibold hover:bg-neutral-700 transition-all mt-2"
              >
                Clear all filters
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
        <div className="flex-shrink-0 p-3 border-t border-neutral-800 flex items-center justify-between bg-gradient-to-t from-neutral-900/80 to-transparent">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-400 text-sm font-semibold hover:bg-neutral-700 hover:text-cyan-400 transition-all disabled:opacity-30 disabled:hover:text-neutral-400"
          >
            ← Previous
          </button>
          <span className="text-neutral-400 text-sm font-medium">Page {page + 1}</span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={filteredTransactions.length < pageSize}
            className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-400 text-sm font-semibold hover:bg-neutral-700 hover:text-cyan-400 transition-all disabled:opacity-30 disabled:hover:text-neutral-400"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
})
