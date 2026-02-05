'use client'

import { useState, useEffect } from 'react'
import { userContext } from '@/mod/context'
import { motion } from 'framer-motion'

interface TransactionStats {
  total24h: number
  totalAllTime: number
  successRate: number
  avgDelta: number
  totalCost24h: number
  totalRevenue24h: number
}

export function TransactionStats() {
  const { client } = userContext()
  const [stats, setStats] = useState<TransactionStats>({
    total24h: 0,
    totalAllTime: 0,
    successRate: 0,
    avgDelta: 0,
    totalCost24h: 0,
    totalRevenue24h: 0
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
        
        const totalCost24h = txs24h.reduce((sum, tx) => sum + (tx.cost || 0), 0)
        const totalRevenue24h = txs24h.reduce((sum, tx) => sum + (tx.cost || 0), 0)
        
        setStats({
          total24h: txs24h.length,
          totalAllTime: transactions.length,
          successRate: transactions.length > 0 ? (successTxs.length / transactions.length) * 100 : 0,
          avgDelta: txsWithDelta.length > 0 ? txsWithDelta.reduce((sum, tx) => sum + tx.delta, 0) / txsWithDelta.length : 0,
          totalCost24h,
          totalRevenue24h
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

  const metrics = [
    { label: 'LAST 24H', value: stats.total24h.toLocaleString(), color: '#06b6d4', subtext: 'transactions' },
    { label: 'ALL TIME', value: stats.totalAllTime.toLocaleString(), color: '#a855f7', subtext: 'total transactions' },
    { label: 'SUCCESS RATE', value: `${stats.successRate.toFixed(1)}%`, color: '#22c55e', subtext: 'completion rate' },
    { label: 'AVG DURATION', value: `${stats.avgDelta.toFixed(2)}s`, color: '#f97316', subtext: 'average time' },
    { label: 'COST 24H', value: `$${stats.totalCost24h.toFixed(4)}`, color: '#ef4444', subtext: 'last 24 hours' },
    { label: 'REVENUE 24H', value: `$${stats.totalRevenue24h.toFixed(4)}`, color: '#14b8a6', subtext: 'last 24 hours' },
  ]

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {metrics.map((metric, idx) => (
          <div key={idx} className="bg-black/60 border-2 rounded-xl p-4 animate-pulse" style={{ borderColor: `${metric.color}40` }}>
            <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
            <div className="h-8 bg-gray-700 rounded w-full mb-1"></div>
            <div className="h-3 bg-gray-700 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {metrics.map((metric, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
          className="bg-black/60 border-2 rounded-xl p-4 hover:scale-105 transition-all"
          style={{ 
            borderColor: `${metric.color}40`,
            boxShadow: `0 0 20px ${metric.color}20`
          }}
        >
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: `${metric.color}80` }}>
            {metric.label}
          </div>
          <div 
            className="text-2xl font-black mb-1"
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
      ))}
    </div>
  )
}
