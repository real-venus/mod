'use client'

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { userContext } from '@/mod/context'
import { BatteryLoader } from '@/mod/ui/BatteryLoader'
import { TransactionCard } from './TransactionCard'

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
  const { client, localKey } = userContext()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showOnlyMyTx, setShowOnlyMyTx] = useState(false)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [isOpen, setIsOpen] = useState(true)

  const fetchTransactions = async () => {
    if (!client) return
    setLoading(true)
    try {
      const result = await client.call('txs', { df: 0, n: pageSize, page: page })
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

  const myClientKey = localKey?.address || ''

  const filteredTransactions = transactions.filter(tx => {
    if (showOnlyMyTx && tx.client !== myClientKey) return false
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return tx.fn.toLowerCase().includes(search) || 
           tx.client?.toLowerCase().includes(search) ||
           tx.status.toLowerCase().includes(search) ||
           tx.signature?.toLowerCase().includes(search) ||
           tx.key?.toLowerCase().includes(search) ||
           tx.cid?.toLowerCase().includes(search)
  })

  return (
    <div className="flex flex-col h-full">
      {/* HEADER TOGGLE BUTTON - FAR RIGHT */}
      <div className="flex justify-end mb-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-2 border-cyan-400/50 rounded-lg text-white text-sm hover:from-cyan-500/30 hover:to-blue-500/30 hover:border-cyan-300/60 transition-all font-semibold backdrop-blur-sm shadow shadow-cyan-500/10"
          style={{ fontFamily: 'IBM Plex Mono, monospace' }}
        >
          {isOpen ? '▼ transactions' : '▶ transactions'}
        </button>
      </div>

      {/* COLLAPSIBLE CONTENT WITH OPAQUE BACKGROUND */}
      {isOpen && (
        <div className="flex flex-col h-full bg-black/95 backdrop-blur-md rounded-lg border-2 border-cyan-400/30 p-4">
          {/* SEARCH AND CONTROLS */}
          <div 
            className={`border rounded-lg backdrop-blur-sm transition-all mb-2 ${
              isHovered ? 'bg-gradient-to-br from-slate-900/70 to-slate-800/50 border-cyan-400/40 shadow-lg' : 'bg-gradient-to-br from-slate-900/50 to-slate-800/30 border-slate-700/40'
            }`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div className="p-3 bg-gradient-to-r from-slate-950/80 to-slate-900/70">
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="🔍 search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-slate-900/70 border border-slate-600/50 rounded text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/50 focus:border-cyan-400/60 transition-all backdrop-blur-sm font-medium shadow-inner"
                  style={{ fontFamily: 'IBM Plex Mono, monospace', height: '36px' }}
                />
                <button
                  onClick={() => setShowOnlyMyTx(!showOnlyMyTx)}
                  className={`px-3 py-1.5 border rounded font-semibold text-sm transition-all backdrop-blur-sm shadow ${
                    showOnlyMyTx 
                      ? 'bg-gradient-to-r from-purple-500/30 to-pink-500/30 border-purple-400/60 shadow-purple-500/20' 
                      : 'bg-slate-800/50 border-slate-600/50 hover:bg-slate-700/50 hover:border-slate-500/60 shadow-slate-500/10'
                  } text-white`}
                  title="Toggle only my transactions"
                  style={{ fontFamily: 'IBM Plex Mono, monospace', height: '36px' }}
                >
                  {showOnlyMyTx ? '✓ my tx' : 'my tx'}
                </button>
                <button
                  onClick={handleSync}
                  className="px-3 py-1.5 bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-400/50 rounded text-white text-sm hover:from-emerald-500/30 hover:to-green-500/30 hover:border-emerald-300/60 transition-all font-semibold backdrop-blur-sm shadow shadow-emerald-500/10"
                  title="Sync transactions"
                  style={{ fontFamily: 'IBM Plex Mono, monospace', height: '36px' }}
                >
                  🔄 sync
                </button>
              </div>
            </div>
          </div>

          {/* SCROLLABLE TRANSACTIONS LIST */}
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-500/50 scrollbar-track-slate-800/30 pr-1.5">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <BatteryLoader />
              </div>
            ) : (
              filteredTransactions.map((tx, idx) => (
                <TransactionCard key={`${tx.client}-${idx}`} tx={tx} idx={idx} />
              ))
            )}

            {!loading && filteredTransactions.length === 0 && (
              <div className="text-white text-center py-10 border border-dashed border-slate-600/40 rounded-lg bg-slate-900/30 text-sm">
                {searchTerm ? '🔍 No transactions match your search' : showOnlyMyTx ? '📭 No transactions from you yet' : '📭 No transactions yet'}
              </div>
            )}
          </div>

          {/* PAGINATION */}
          <div 
            className={`border rounded-lg backdrop-blur-sm transition-all mt-2 ${
              isHovered ? 'bg-gradient-to-br from-slate-900/70 to-slate-800/50 border-cyan-400/40 shadow-lg' : 'bg-gradient-to-br from-slate-900/50 to-slate-800/30 border-slate-700/40'
            }`}
          >
            <div className="p-3 bg-gradient-to-r from-slate-950/80 to-slate-900/70">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className="px-3 py-1.5 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-400/50 rounded text-white text-sm hover:from-cyan-500/30 hover:to-blue-500/30 hover:border-cyan-300/60 transition-all font-semibold disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm shadow shadow-cyan-500/10"
                    style={{ fontFamily: 'IBM Plex Mono, monospace', height: '36px' }}
                  >
                    ← prev
                  </button>
                  <span className="text-white font-mono text-sm px-3 py-1.5 bg-slate-800/50 rounded border border-slate-600/40 font-semibold shadow-sm" style={{ height: '36px', display: 'flex', alignItems: 'center' }}>
                    Page {page + 1}{hasMore ? '+' : ''}
                  </span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={!hasMore}
                    className="px-3 py-1.5 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-400/50 rounded text-white text-sm hover:from-cyan-500/30 hover:to-blue-500/30 hover:border-cyan-300/60 transition-all font-semibold disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm shadow shadow-cyan-500/10"
                    style={{ fontFamily: 'IBM Plex Mono, monospace', height: '36px' }}
                  >
                    next →
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-white font-medium text-sm">Per page:</label>
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
                    className="px-3 py-1.5 bg-slate-900/70 border border-slate-600/50 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400/50 focus:border-cyan-400/60 transition-all backdrop-blur-sm font-medium shadow-inner"
                    style={{ fontFamily: 'IBM Plex Mono, monospace', height: '36px' }}
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
        </div>
      )}
    </div>
  )
})

TransactionsPanel.displayName = 'TransactionsPanel'
