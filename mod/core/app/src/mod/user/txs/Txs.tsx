'use client'

import { useState, useEffect } from 'react'
import { userContext } from '@/mod/context'
import { BatteryLoader } from '@/mod/ui/BatteryLoader'
import { TransactionCard } from '@/mod/chat/transactions/TransactionCard'
import { UserType } from '@/mod/types'
import { motion } from 'framer-motion'

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
  module?: string
  owner?: string
}

interface TransactionStats {
  clientTotal: number
  ownerTotal: number
  clientSuccess: number
  ownerSuccess: number
  clientCost: number
  ownerRevenue: number
}

interface TxsProps {
  userData: UserType
}

export default function Txs({ userData }: TxsProps) {
  const { client } = userContext()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'client' | 'owner'>('client')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [hasMore, setHasMore] = useState(true)
  const [expandedTxKey, setExpandedTxKey] = useState<string | null>(null)
  const [stats, setStats] = useState<TransactionStats>({
    clientTotal: 0,
    ownerTotal: 0,
    clientSuccess: 0,
    ownerSuccess: 0,
    clientCost: 0,
    ownerRevenue: 0
  })

  const fetchTransactions = async () => {
    if (!client) return
    setLoading(true)
    try {
      const result = await client.call('txs', { df: 0, n: 10000, page: 0 })
      const allTransactions = Array.isArray(result) ? result : []
      setTransactions(allTransactions)
      setHasMore(result && result.length === pageSize)
      
      const clientTxs = allTransactions.filter(tx => tx.key?.toLowerCase() === userData.key.toLowerCase())
      const ownerTxs = allTransactions.filter(tx => tx.owner?.toLowerCase() === userData.key.toLowerCase())
      
      const clientSuccessTxs = clientTxs.filter(tx => tx.status === 'success' || tx.status === 'finished' || tx.status === 'complete')
      const ownerSuccessTxs = ownerTxs.filter(tx => tx.status === 'success' || tx.status === 'finished' || tx.status === 'complete')
      
      const clientCost = clientTxs.reduce((sum, tx) => sum + (tx.cost || 0), 0)
      const ownerRevenue = ownerTxs.reduce((sum, tx) => sum + (tx.cost || 0), 0)
      
      setStats({
        clientTotal: clientTxs.length,
        ownerTotal: ownerTxs.length,
        clientSuccess: clientSuccessTxs.length,
        ownerSuccess: ownerSuccessTxs.length,
        clientCost,
        ownerRevenue
      })
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

  const filteredTransactions = transactions.filter(tx => {
    if (filterType === 'client' && tx.key?.toLowerCase() === userData.key.toLowerCase()) return true
    if (filterType === 'owner' && tx.owner?.toLowerCase() === userData.key.toLowerCase()) return true
    return false
  })

  const handleCardClick = (txKey: string) => {
    setExpandedTxKey(txKey === expandedTxKey ? null : txKey)
  }

  const currentMetrics = filterType === 'client' ? [
    { label: 'CLIENT TXS', value: stats.clientTotal.toLocaleString(), color: '#06b6d4', subtext: 'total as client' },
    { label: 'CLIENT SUCCESS', value: stats.clientSuccess.toLocaleString(), color: '#22c55e', subtext: 'successful txs' },
    { label: 'CLIENT COST', value: `$${stats.clientCost.toFixed(4)}`, color: '#ef4444', subtext: 'total spent' },
  ] : [
    { label: 'OWNER TXS', value: stats.ownerTotal.toLocaleString(), color: '#a855f7', subtext: 'total as owner' },
    { label: 'OWNER SUCCESS', value: stats.ownerSuccess.toLocaleString(), color: '#14b8a6', subtext: 'successful txs' },
    { label: 'OWNER REVENUE', value: `$${stats.ownerRevenue.toFixed(4)}`, color: '#f97316', subtext: 'total earned' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Stats Grid */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-white mb-3">{filterType === 'client' ? 'CLIENT STATISTICS' : 'OWNER STATISTICS'}</h3>
        <div className="grid grid-cols-3 gap-4">
          {loading ? (
            currentMetrics.map((metric, idx) => (
              <div key={idx} className="bg-black/60 border-2 rounded-xl p-4 animate-pulse" style={{ borderColor: `${metric.color}40` }}>
                <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-700 rounded w-full mb-1"></div>
                <div className="h-3 bg-gray-700 rounded w-1/2"></div>
              </div>
            ))
          ) : (
            currentMetrics.map((metric, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-black/60 border-2 rounded-xl p-6 hover:scale-105 transition-all"
                style={{ 
                  borderColor: `${metric.color}40`,
                  boxShadow: `0 0 20px ${metric.color}20`
                }}
              >
                <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: `${metric.color}80` }}>
                  {metric.label}
                </div>
                <div 
                  className="text-3xl font-black mb-1"
                  style={{ 
                    color: metric.color,
                    fontFamily: 'IBM Plex Mono, monospace',
                    textShadow: `0 0 10px ${metric.color}40`
                  }}
                >
                  {metric.value}
                </div>
                <div className="text-xs" style={{ color: `${metric.color}60` }}>
                  {metric.subtext}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Transactions Panel */}
      <div className="flex flex-col h-full bg-black/95 backdrop-blur-md rounded-lg border-2 border-white/30">
        <div className="border-b rounded-t-lg backdrop-blur-sm bg-gradient-to-br from-slate-900/50 to-slate-800/30 border-slate-700/40">
          <div className="p-3 bg-gradient-to-r from-slate-950/80 to-slate-900/70">
            <div className="flex gap-2 items-center mb-3">
              <input
                type="text"
                placeholder="🔍 search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-slate-900/70 border border-slate-600/50 rounded text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/50 focus:border-cyan-400/60 transition-all backdrop-blur-sm font-medium shadow-inner"
                style={{ fontFamily: 'IBM Plex Mono, monospace', height: '36px' }}
              />
              <button
                onClick={fetchTransactions}
                className="px-3 py-1.5 bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-400/50 rounded text-white text-sm hover:from-emerald-500/30 hover:to-green-500/30 hover:border-emerald-300/60 transition-all font-semibold backdrop-blur-sm shadow shadow-emerald-500/10"
                title="Sync transactions"
                style={{ fontFamily: 'IBM Plex Mono, monospace', height: '36px' }}
              >
                🔄 sync
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterType('client')}
                className={`flex-1 px-4 py-2 border rounded font-semibold text-sm transition-all backdrop-blur-sm shadow ${
                  filterType === 'client' 
                    ? 'bg-gradient-to-r from-purple-500/30 to-pink-500/30 border-purple-400/60 shadow-purple-500/20' 
                    : 'bg-slate-800/50 border-slate-600/50 hover:bg-slate-700/50 hover:border-slate-500/60 shadow-slate-500/10'
                } text-white`}
                style={{ fontFamily: 'IBM Plex Mono, monospace', height: '40px' }}
              >
                as client
              </button>
              <button
                onClick={() => setFilterType('owner')}
                className={`flex-1 px-4 py-2 border rounded font-semibold text-sm transition-all backdrop-blur-sm shadow ${
                  filterType === 'owner' 
                    ? 'bg-gradient-to-r from-orange-500/30 to-red-500/30 border-orange-400/60 shadow-orange-500/20' 
                    : 'bg-slate-800/50 border-slate-600/50 hover:bg-slate-700/50 hover:border-slate-500/60 shadow-slate-500/10'
                } text-white`}
                style={{ fontFamily: 'IBM Plex Mono, monospace', height: '40px' }}
              >
                as owner
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-500/50 scrollbar-track-slate-800/30 p-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <BatteryLoader />
            </div>
          ) : (
            filteredTransactions.map((tx, idx) => (
              <div key={`${tx.client}-${idx}`} onClick={() => handleCardClick(tx.key)}>
                <TransactionCard 
                  tx={tx} 
                  idx={idx} 
                  isExpanded={tx.key === expandedTxKey}
                />
              </div>
            ))
          )}

          {!loading && filteredTransactions.length === 0 && (
            <div className="text-white text-center py-10 border border-dashed border-slate-600/40 rounded-lg bg-slate-900/30 text-sm">
              {searchTerm ? '🔍 No transactions match your search' : '📭 No transactions yet'}
            </div>
          )}
        </div>

        <div className="border-t rounded-b-lg backdrop-blur-sm bg-gradient-to-br from-slate-900/50 to-slate-800/30 border-slate-700/40">
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
    </div>
  )
}
