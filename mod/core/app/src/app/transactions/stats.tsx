'use client'

import { useState, useEffect } from 'react'
import { userContext } from '@/mod/context'

interface TransactionStats {
  total24h: number
  totalAllTime: number
  successRate: number
  avgDelta: number
}

export function TransactionStats() {
  const { client } = userContext()
  const [stats, setStats] = useState<TransactionStats>({
    total24h: 0,
    totalAllTime: 0,
    successRate: 0,
    avgDelta: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      if (!client) return
      setLoading(true)
      try {
        const result = await client.call('txs', { df: 0, n: 10000, page: 0 })
        const transactions = Array.isArray(result) ? result : []
        
        const now = Date.now() / 1000
        const last24h = now - (24 * 60 * 60)
        
        const txs24h = transactions.filter(tx => tx.time >= last24h)
        const successTxs = transactions.filter(tx => tx.status === 'success' || tx.status === 'finished' || tx.status === 'complete')
        const txsWithDelta = transactions.filter(tx => tx.delta !== undefined)
        
        setStats({
          total24h: txs24h.length,
          totalAllTime: transactions.length,
          successRate: transactions.length > 0 ? (successTxs.length / transactions.length) * 100 : 0,
          avgDelta: txsWithDelta.length > 0 ? txsWithDelta.reduce((sum, tx) => sum + tx.delta, 0) / txsWithDelta.length : 0
        })
      } catch (err) {
        console.error('Failed to fetch transaction stats:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [client])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-black/60 border-2 border-cyan-400/30 rounded-xl p-6 animate-pulse">
            <div className="h-4 bg-cyan-400/20 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-cyan-400/20 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-2 border-cyan-400/60 rounded-xl p-6 backdrop-blur-sm shadow-lg hover:shadow-cyan-500/50 transition-all">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-cyan-400 text-sm font-bold uppercase tracking-wide">Last 24 Hours</span>
        </div>
        <div className="text-4xl font-black text-white" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
          {stats.total24h.toLocaleString()}
        </div>
        <div className="text-cyan-300 text-xs mt-2">transactions</div>
      </div>

      <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-2 border-purple-400/60 rounded-xl p-6 backdrop-blur-sm shadow-lg hover:shadow-purple-500/50 transition-all">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-purple-400 text-sm font-bold uppercase tracking-wide">All Time</span>
        </div>
        <div className="text-4xl font-black text-white" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
          {stats.totalAllTime.toLocaleString()}
        </div>
        <div className="text-purple-300 text-xs mt-2">total transactions</div>
      </div>

      <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-2 border-green-400/60 rounded-xl p-6 backdrop-blur-sm shadow-lg hover:shadow-green-500/50 transition-all">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-green-400 text-sm font-bold uppercase tracking-wide">Success Rate</span>
        </div>
        <div className="text-4xl font-black text-white" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
          {stats.successRate.toFixed(1)}%
        </div>
        <div className="text-green-300 text-xs mt-2">completion rate</div>
      </div>

      <div className="bg-gradient-to-br from-orange-500/20 to-yellow-500/20 border-2 border-orange-400/60 rounded-xl p-6 backdrop-blur-sm shadow-lg hover:shadow-orange-500/50 transition-all">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-orange-400 text-sm font-bold uppercase tracking-wide">Avg Duration</span>
        </div>
        <div className="text-4xl font-black text-white" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
          {stats.avgDelta.toFixed(2)}s
        </div>
        <div className="text-orange-300 text-xs mt-2">average time</div>
      </div>
    </div>
  )
}
