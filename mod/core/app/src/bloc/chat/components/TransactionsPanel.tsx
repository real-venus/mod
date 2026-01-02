'use client'

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useUserContext } from '@/bloc/context'
import { CopyButton } from '@/bloc/ui/CopyButton'
import { time2utc } from '@/bloc/utils'

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
}

export const TransactionsPanel = forwardRef((props, ref) => {
  const { client, localKey } = useUserContext()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTx, setExpandedTx] = useState<Set<number>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(0)

  const fetchTransactions = async () => {
    if (!client) return
    setLoading(true)
    try {
      const result = await client.call('history', { df: 0, n: pageSize, page: page })
      console.log('Fetched transactions:', result)
      setTransactions(Array.isArray(result) ? result : [])
      if (result && result.length === pageSize) {
        setTotalPages(page + 2)
      } else {
        setTotalPages(page + 1)
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err)
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTransactions()
  }, [client, page, pageSize])

  const handleSearch = (term: string) => {
    setSearchTerm(term)
    setPage(0)
    fetchTransactions()
  }

  const handleSync = () => {
    setPage(0)
    fetchTransactions()
  }

  // Expose handleSync to parent via ref
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

  const getStatusColor = (status: string) => {
    if (status === 'running') return { bg: 'from-yellow-500/20 to-yellow-600/10', border: 'border-yellow-500/40', text: 'text-yellow-400' }
    if (status === 'pending') return { bg: 'from-yellow-500/20 to-yellow-600/10', border: 'border-yellow-500/40', text: 'text-yellow-400' }
    if (status === 'success' || status === 'finished') return { bg: 'from-green-500/20 to-green-600/10', border: 'border-green-500/40', text: 'text-green-400' }
    return { bg: 'from-red-500/20 to-red-600/10', border: 'border-red-500/40', text: 'text-red-400' }
  }

  const myClientKey = localKey?.address || ''

  const filteredTransactions = transactions.filter(tx => {
    if (tx.client === myClientKey) return false
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return tx.fn.toLowerCase().includes(search) || 
           tx.client?.toLowerCase().includes(search) ||
           tx.status.toLowerCase().includes(search) ||
           tx.signature?.toLowerCase().includes(search) ||
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
    <div className="space-y-3">
      <div className="mb-4 flex gap-2">
        <input
          type="text"
          placeholder="Search transactions (fn, client, status, sig, cid)..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          className="flex-1 px-4 py-2 bg-black/50 border-2 border-green-500/40 rounded-xl text-green-300 placeholder-gray-500 focus:outline-none focus:border-green-400 transition-colors"
        />
        <button
          onClick={handleSync}
          className="px-4 py-2 bg-green-500/20 border-2 border-green-500/40 rounded-xl text-green-300 hover:bg-green-500/30 hover:border-green-400 transition-all font-bold"
          title="Sync transactions"
        >
          🔄 Sync
        </button>
      </div>

      {filteredTransactions.map((tx, idx) => {
        const isExpanded = expandedTx.has(idx)
        const statusColors = getStatusColor(tx.status)
        const timestamp = parseInt(tx.time)
        const formattedTime = isNaN(timestamp) ? tx.time : time2utc(timestamp)

        return (
          <div key={`${tx.client}-${idx}`} className={`border-2 rounded-2xl overflow-hidden bg-gradient-to-br ${statusColors.bg} ${statusColors.border} shadow-xl transition-all hover:shadow-2xl`}>
            <div
              className="p-4 cursor-pointer hover:bg-black/20 transition-colors"
              onClick={() => toggleTx(idx)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-wrap">
                  {(tx.status === 'running' || tx.status === 'pending') ? (
                    <div className="text-2xl text-yellow-400">⏳</div>
                  ) : (
                    <div className={`text-2xl ${statusColors.text}`}>
                      {tx.status === 'success' || tx.status === 'finished' ? '✅' : '❌'}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 items-center">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${statusColors.text} px-3 py-1 rounded-full bg-black/30`} style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                        {tx.fn}
                      </span>
                      <CopyButton text={tx.fn} size="sm" />
                    </div>
                    {tx.key && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/40 px-3 py-1 rounded-full font-mono text-purple-300">
                          🔐 {tx.key.slice(0, 8)}...{tx.key.slice(-6)}
                        </span>
                        <CopyButton text={tx.key} size="sm" />
                      </div>
                    )}
                    {tx.client && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/40 px-3 py-1 rounded-full font-mono text-green-300">
                          🔑 {tx.client.slice(0, 8)}...{tx.client.slice(-6)}
                        </span>
                        <CopyButton text={tx.client} size="sm" />
                      </div>
                    )}
                    <span className={`text-xs font-bold ${statusColors.text} px-2 py-1 rounded-full bg-black/40`}>
                      {tx.status.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`${statusColors.text} text-lg`}>{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
                <span>⏱️ {formattedTime}</span>
                <CopyButton text={formattedTime} size="sm" />
              </div>
            </div>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-3 border-t border-white/10">
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {tx.key && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400">🔐 key:</span>
                      <span className="text-xs font-mono text-purple-300 break-all">{tx.key}</span>
                      <CopyButton text={tx.key} size="sm" />
                    </div>
                  )}
                  {tx.client && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400">🔑 client:</span>
                      <span className="text-xs font-mono text-green-300 break-all">{tx.client}</span>
                      <CopyButton text={tx.client} size="sm" />
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">status:</span>
                    <span className={`text-xs font-bold ${statusColors.text}`}>{tx.status}</span>
                  </div>
                </div>
                {tx.params && Object.keys(tx.params).length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-bold text-yellow-400">📥 params</div>
                      <CopyButton text={JSON.stringify(tx.params, null, 2)} size="sm" />
                    </div>
                    <pre className="text-xs bg-black/50 p-3 rounded-lg border border-gray-700/30 overflow-x-auto max-w-full">
                      <code className="text-yellow-300 break-all whitespace-pre-wrap">{JSON.stringify(tx.params, null, 2)}</code>
                    </pre>
                  </div>
                )}

                {tx.result && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-bold text-blue-400">📤 result</div>
                      <CopyButton text={typeof tx.result === 'string' ? tx.result : JSON.stringify(tx.result, null, 2)} size="sm" />
                    </div>
                    <pre className="text-xs bg-black/50 p-3 rounded-lg border border-gray-700/30 overflow-x-auto max-h-64 max-w-full">
                      <code className="text-gray-300 break-all whitespace-pre-wrap">{typeof tx.result === 'string' ? tx.result : JSON.stringify(tx.result, null, 2)}</code>
                    </pre>
                  </div>
                )}

                <div className="text-xs text-gray-500 pt-2 border-t border-white/10 flex flex-wrap gap-3">
                  <div className="flex items-center gap-1">
                    <span>⏱️ {formattedTime}</span>
                    <CopyButton text={formattedTime} size="sm" />
                  </div>
                  {tx.delta && (
                    <div className="flex items-center gap-1">
                      <span>⚡ {tx.delta.toFixed(2)}s</span>
                      <CopyButton text={tx.delta.toFixed(2)} size="sm" />
                    </div>
                  )}
                  {tx.cid && (
                    <div className="flex items-center gap-1">
                      <span className="font-mono break-all">🔗 {tx.cid}</span>
                      <CopyButton text={tx.cid} size="sm" />
                    </div>
                  )}
                  {tx.signature && (
                    <div className="flex items-center gap-1">
                      <span className="font-mono break-all">✍️ {tx.signature}</span>
                      <CopyButton text={tx.signature} size="sm" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
      {filteredTransactions.length === 0 && (
        <div className="text-gray-500 text-sm text-center py-8 border-2 border-dashed border-gray-700/40 rounded-2xl">
          {searchTerm ? 'No transactions match your search' : 'No transactions yet'}
        </div>
      )}

      <div className="flex items-center justify-between mt-4 gap-2 pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-4 py-2 bg-green-500/20 border-2 border-green-500/40 rounded-xl text-green-300 hover:bg-green-500/30 hover:border-green-400 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>
          <span className="text-green-300 font-mono px-3">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= totalPages - 1}
            className="px-4 py-2 bg-green-500/20 border-2 border-green-500/40 rounded-xl text-green-300 hover:bg-green-500/30 hover:border-green-400 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-green-300 text-sm">Per page:</label>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
            className="px-3 py-2 bg-black/50 border-2 border-green-500/40 rounded-xl text-green-300 focus:outline-none focus:border-green-400 transition-colors"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
    </div>
  )
})

TransactionsPanel.displayName = 'TransactionsPanel'
