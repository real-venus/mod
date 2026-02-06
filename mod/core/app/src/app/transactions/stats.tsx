"use client";

import { useState, useEffect } from 'react'
import { userContext } from '@/mod/context'

interface Stats {
  total: number
  success: number
  errors: number
  pending: number
  cost: number
  avgDelta: number
  uniqueModules: number
  uniqueUsers: number
}

export function TransactionStats() {
  const { client } = userContext()
  const [stats, setStats] = useState<Stats>({
    total: 0, success: 0, errors: 0, pending: 0,
    cost: 0, avgDelta: 0, uniqueModules: 0, uniqueUsers: 0
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
        const txs = transactions.filter((tx: any) => tx.time >= last24h)
        
        const success = txs.filter((tx: any) => tx.status === 'success' || tx.status === 'finished' || tx.status === 'complete').length
        const errors = txs.filter((tx: any) => tx.status === 'error' || tx.status === 'failed' || tx.status === 'cancelled').length
        const pending = txs.filter((tx: any) => tx.status === 'pending' || tx.status === 'running').length
        const cost = txs.reduce((sum: number, tx: any) => sum + (tx.cost || 0), 0)
        const withDelta = txs.filter((tx: any) => tx.delta !== undefined)
        const avgDelta = withDelta.length > 0 ? withDelta.reduce((sum: number, tx: any) => sum + tx.delta, 0) / withDelta.length : 0
        const uniqueModules = new Set(txs.map((tx: any) => tx.module).filter(Boolean)).size
        const uniqueUsers = new Set(txs.map((tx: any) => tx.client || tx.key).filter(Boolean)).size

        setStats({ total: txs.length, success, errors, pending, cost, avgDelta, uniqueModules, uniqueUsers })
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [client])

  const items = [
    { v: stats.total.toLocaleString(), c: '#06b6d4', l: 'txs' },
    { v: stats.success.toLocaleString(), c: '#22c55e', l: '✓' },
    { v: stats.errors.toLocaleString(), c: '#ef4444', l: '✗' },
    { v: stats.pending.toLocaleString(), c: '#eab308', l: '◌' },
    { v: `${stats.avgDelta.toFixed(2)}s`, c: '#f97316', l: 'avg' },
    { v: `$${stats.cost.toFixed(4)}`, c: '#a855f7', l: 'cost' },
    { v: stats.uniqueModules.toLocaleString(), c: '#14b8a6', l: 'mods' },
    { v: stats.uniqueUsers.toLocaleString(), c: '#ec4899', l: 'users' },
  ]

  if (loading) {
    return (
      <div className="flex gap-2 flex-wrap px-4 py-3">
        {items.map((_, i) => (
          <div key={i} className="bg-black/60 border rounded-lg px-3 py-2 animate-pulse" style={{ borderColor: '#333', minWidth: 70 }}>
            <div className="h-5 bg-gray-800 rounded w-10 mb-1" />
            <div className="h-3 bg-gray-800 rounded w-6" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex gap-2 flex-wrap px-4 py-3 border-b border-cyan-500/20 bg-black/30">
      <span className="text-[10px] text-gray-600 self-center mr-1">24h</span>
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
