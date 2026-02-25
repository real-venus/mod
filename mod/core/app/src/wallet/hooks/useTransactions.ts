"use client";

import { useState, useEffect } from 'react'

export function useTransactions(userKey: string | undefined, client: any) {
  const [userTransactions, setUserTransactions] = useState<any[]>([])
  const [totalCost24h, setTotalCost24h] = useState(0)
  const [isLoadingTxs, setIsLoadingTxs] = useState(false)
  const [txsStatusFilter, setTxsStatusFilter] = useState<'all' | 'pending' | 'complete'>('all')
  const [expandedTxIdx, setExpandedTxIdx] = useState<number | null>(null)

  const fetchUserTransactions = async () => {
    if (!client || !userKey) return
    setIsLoadingTxs(true)
    try {
      const result = await client.call('txs', { df: 0, n: 1000, page: 0, key: userKey })
      const txs = Array.isArray(result) ? result : []
      const key = userKey.toLowerCase()
      const userTxs = txs.filter((tx: any) => {
        const owner = tx.owner?.toLowerCase()
        const c = tx.client?.toLowerCase()
        const k = tx.key?.toLowerCase()
        return owner === key || c === key || k === key
      })
      setUserTransactions(userTxs)
      const now = Date.now() / 1000
      const cutoff = now - 86400
      const recentCost = userTxs
        .filter((tx: any) => {
          const t = parseInt(tx.time)
          return !isNaN(t) && t >= cutoff
        })
        .reduce((sum: number, tx: any) => sum + (tx.cost || 0), 0)
      setTotalCost24h(recentCost)
    } catch (err) {
      console.error('Failed to fetch user transactions:', err)
      setUserTransactions([])
      setTotalCost24h(0)
    } finally {
      setIsLoadingTxs(false)
    }
  }

  // Fetch on mount
  useEffect(() => {
    if (userKey) fetchUserTransactions()
  }, [userKey])

  // Auto-refresh when a path-based client.call completes
  useEffect(() => {
    const handler = () => {
      if (userKey) fetchUserTransactions()
    }
    window.addEventListener('mod:tx', handler)
    return () => window.removeEventListener('mod:tx', handler)
  }, [userKey, client])

  return {
    userTransactions, totalCost24h, isLoadingTxs,
    txsStatusFilter, setTxsStatusFilter,
    expandedTxIdx, setExpandedTxIdx,
    fetchUserTransactions,
  }
}
