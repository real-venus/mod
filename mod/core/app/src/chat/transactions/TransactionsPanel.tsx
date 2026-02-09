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
  const [isHovered, setIsHovered] = useState(false)

  const panelColor = '#06b6d4' // cyan as primary color

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

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchTransactions, 10000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchTransactions])

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

  const successCount = filteredTransactions.filter(tx => tx.status === 'success' || tx.status === 'finished' || tx.status === 'complete').length
  const errorCount = filteredTransactions.filter(tx => tx.status === 'error' || tx.status === 'failed' || tx.status === 'cancelled').length
  const pendingCount = filteredTransactions.filter(tx => tx.status === 'pending' || tx.status === 'running').length
  const totalCost = filteredTransactions.reduce((sum, tx) => sum + (tx.cost || 0), 0)
  const hasFilters = ownerFilter !== 'all' || statusFilter !== 'all' || searchQuery

  const StatBadge = ({ value, label, color }: { value: number | string, label: string, color: string }) => (
    <div 
      className="flex items-center gap-2 rounded-xl px-4 py-2.5 border-2 transition-all hover:scale-105 shadow-lg"
      style={{
        backgroundColor: colorWithOpacity(color, 0.1),
        borderColor: colorWithOpacity(color, 0.4),
      }}
    >
      <span className="text-lg font-bold" style={{ color }}>{value}</span>
      <span className="text-xs uppercase tracking-wider" style={{ color: colorWithOpacity(color, 0.7) }}>{label}</span>
    </div>
  )

  return (
    <div 
      className="flex flex-col h-full relative border-2 rounded-2xl font-mono transition-all backdrop-blur-sm overflow-hidden"
      style={{
        fontFamily: 'IBM Plex Mono, Courier New, monospace',
        backgroundColor: colorWithOpacity(panelColor, 0.05),
        borderColor: panelColor,
        boxShadow: isHovered
          ? `0 0 50px ${colorWithOpacity(panelColor, 0.35)}, 0 0 100px ${colorWithOpacity(panelColor, 0.15)}`
          : `0 0 25px ${colorWithOpacity(panelColor, 0.2)}`
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Glow effect */}
      <div
        className="absolute inset-0 opacity-0 hover:opacity-15 transition-opacity duration-500 rounded-2xl pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${colorWithOpacity(panelColor, 0.3)}, transparent 70%)`
        }}
      />

      {/* Header */}
      <div 
        className="flex-shrink-0 p-5 border-b-2 backdrop-blur-xl relative"
        style={{ 
          borderColor: colorWithOpacity(panelColor, 0.3),
          background: `linear-gradient(to right, ${colorWithOpacity(panelColor, 0.1)}, ${colorWithOpacity('#3b82f6', 0.1)})`
        }}
      >
        {/* Top row - count and controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div 
              className="flex items-center gap-2 rounded-xl px-5 py-3 border-2 shadow-xl"
              style={{
                backgroundColor: colorWithOpacity(panelColor, 0.15),
                borderColor: colorWithOpacity(panelColor, 0.5),
              }}
            >
              <span className="text-2xl font-bold" style={{ color: panelColor }}>{filteredTransactions.length}</span>
              <span style={{ color: colorWithOpacity(panelColor, 0.5) }}>/</span>
              <span className="text-lg" style={{ color: colorWithOpacity(panelColor, 0.7) }}>{totalCount}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="px-4 py-2.5 text-sm font-bold rounded-xl border-2 transition-all hover:scale-105"
              style={{
                backgroundColor: autoRefresh ? colorWithOpacity('#22c55e', 0.15) : colorWithOpacity('#6b7280', 0.1),
                borderColor: autoRefresh ? colorWithOpacity('#22c55e', 0.5) : colorWithOpacity('#6b7280', 0.3),
                color: autoRefresh ? '#4ade80' : '#9ca3af'
              }}
            >
              {autoRefresh ? '● Live' : '○ Paused'}
            </button>
            
            <button
              onClick={fetchTransactions}
              disabled={loading}
              className="p-2.5 rounded-xl border-2 transition-all hover:scale-105 disabled:opacity-50"
              style={{
                backgroundColor: colorWithOpacity(panelColor, 0.1),
                borderColor: colorWithOpacity(panelColor, 0.4),
                color: panelColor
              }}
            >
              <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
              className="p-2.5 rounded-xl border-2 transition-all hover:scale-105"
              style={{
                backgroundColor: colorWithOpacity('#a855f7', 0.1),
                borderColor: colorWithOpacity('#a855f7', 0.4),
                color: '#a855f7'
              }}
            >
              {sortOrder === 'newest' ? <ChevronDownIcon className="w-5 h-5" /> : <ChevronUpIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2" style={{ color: colorWithOpacity(panelColor, 0.5) }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transactions..."
            className="w-full rounded-xl pl-12 pr-4 py-3 text-sm font-medium border-2 focus:outline-none transition-all"
            style={{
              backgroundColor: colorWithOpacity(panelColor, 0.05),
              borderColor: colorWithOpacity(panelColor, 0.3),
              color: '#e5e7eb'
            }}
          />
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl px-4 py-2.5 text-sm font-bold border-2 cursor-pointer focus:outline-none transition-all hover:scale-105"
            style={{
              backgroundColor: colorWithOpacity('#22c55e', 0.1),
              borderColor: colorWithOpacity('#22c55e', 0.4),
              color: '#4ade80'
            }}
          >
            <option value="all">All Status</option>
            <option value="success">✓ Success</option>
            <option value="error">✗ Errors</option>
            <option value="pending">◉ Pending</option>
          </select>

          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="rounded-xl px-4 py-2.5 text-sm font-bold border-2 cursor-pointer focus:outline-none transition-all hover:scale-105"
            style={{
              backgroundColor: colorWithOpacity('#a855f7', 0.1),
              borderColor: colorWithOpacity('#a855f7', 0.4),
              color: '#c084fc'
            }}
          >
            <option value="all">All Owners</option>
            {uniqueOwners.map(owner => (
              <option key={owner} value={owner}>
                {owner.substring(0, 8)}...{owner.substring(owner.length - 6)}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button
              onClick={() => { setOwnerFilter('all'); setStatusFilter('all'); setSearchQuery('') }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-bold transition-all hover:scale-105"
              style={{
                backgroundColor: colorWithOpacity('#ef4444', 0.1),
                borderColor: colorWithOpacity('#ef4444', 0.4),
                color: '#f87171'
              }}
            >
              <XMarkIcon className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>

        {/* Stats */}
        {!showStats && (
          <div className="flex gap-3 mt-4 flex-wrap">
            <StatBadge value={successCount} label="success" color="#22c55e" />
            <StatBadge value={errorCount} label="errors" color="#ef4444" />
            <StatBadge value={pendingCount} label="pending" color="#f59e0b" />
            <StatBadge value={`$${totalCost.toFixed(4)}`} label="cost" color="#a855f7" />
          </div>
        )}
      </div>

      {/* Transaction list */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {error && (
          <div 
            className="p-5 rounded-xl mb-4 border-2"
            style={{
              backgroundColor: colorWithOpacity('#ef4444', 0.1),
              borderColor: colorWithOpacity('#ef4444', 0.4)
            }}
          >
            <p className="text-red-400 text-sm font-mono mb-3">{error}</p>
            <button
              onClick={fetchTransactions}
              className="px-5 py-2.5 rounded-xl border-2 text-sm font-bold transition-all hover:scale-105"
              style={{
                backgroundColor: colorWithOpacity('#ef4444', 0.2),
                borderColor: colorWithOpacity('#ef4444', 0.5),
                color: '#f87171'
              }}
            >
              Retry
            </button>
          </div>
        )}

        {loading && transactions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div 
              className="animate-spin rounded-full h-12 w-12 border-4"
              style={{ 
                borderColor: colorWithOpacity(panelColor, 0.3),
                borderTopColor: panelColor
              }}
            />
            <span className="text-gray-400 text-sm font-medium">Loading transactions...</span>
          </div>
        )}

        {!loading && filteredTransactions.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <span className="text-5xl">📭</span>
            <span className="text-gray-400 text-sm font-medium">
              {hasFilters ? 'No matching transactions' : 'No transactions yet'}
            </span>
            {hasFilters && (
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter('all'); setOwnerFilter('all') }}
                className="px-5 py-2.5 rounded-xl border-2 text-sm font-bold transition-all hover:scale-105"
                style={{
                  backgroundColor: colorWithOpacity(panelColor, 0.1),
                  borderColor: colorWithOpacity(panelColor, 0.4),
                  color: panelColor
                }}
              >
                Clear filters
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
        <div 
          className="flex-shrink-0 p-5 border-t-2 flex items-center justify-between"
          style={{ 
            borderColor: colorWithOpacity(panelColor, 0.3),
            background: `linear-gradient(to right, ${colorWithOpacity(panelColor, 0.05)}, ${colorWithOpacity('#3b82f6', 0.05)})`
          }}
        >
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-5 py-2.5 rounded-xl border-2 text-sm font-bold transition-all hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              backgroundColor: colorWithOpacity(panelColor, 0.1),
              borderColor: colorWithOpacity(panelColor, 0.4),
              color: panelColor
            }}
          >
            ← Prev
          </button>
          <span className="text-gray-400 text-sm font-bold">Page {page + 1}</span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={filteredTransactions.length < pageSize}
            className="px-5 py-2.5 rounded-xl border-2 text-sm font-bold transition-all hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              backgroundColor: colorWithOpacity(panelColor, 0.1),
              borderColor: colorWithOpacity(panelColor, 0.4),
              color: panelColor
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
})
