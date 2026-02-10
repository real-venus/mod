"use client";

import { useState, useEffect } from 'react'
import type { Client, Transaction, Module } from '../types'

interface UseCurrentTransactionProps {
  client: Client | null
  isLoading: boolean
  selectedModules: Module[]
  selectedFunction: string
  params: Record<string, any>
}

/**
 * Hook to manage current transaction display
 * Polls for transaction updates and shows current/latest transaction
 */
export function useCurrentTransaction({
  client,
  isLoading,
  selectedModules,
  selectedFunction,
  params
}: UseCurrentTransactionProps) {
  const [currentTransaction, setCurrentTransaction] = useState<Transaction | null>(null)
  const [pendingCount, setPendingCount] = useState(0)

  // Fetch transaction status
  useEffect(() => {
    if (!client) return

    const fetchTransactions = async () => {
      try {
        const result = await client.call('txs', { df: 0, n: 50, page: 0 })
        const txs = Array.isArray(result) ? result : []

        // Count pending transactions
        const pending = txs.filter((tx: any) => tx.status === 'pending').length
        setPendingCount(pending)

        // Find running or pending transaction
        const runningTx = txs.find((tx: any) =>
          tx.status === 'running' || tx.status === 'pending'
        )

        if (runningTx) {
          setCurrentTransaction(runningTx)
        } else if (currentTransaction) {
          // Check if current transaction finished
          const finishedTx = txs.find((tx: any) =>
            (tx.cid && tx.cid === currentTransaction.cid) ||
            (tx.hash && tx.hash === currentTransaction.hash)
          )

          if (
            finishedTx &&
            (finishedTx.status === 'success' ||
              finishedTx.status === 'finished' ||
              finishedTx.status === 'complete' ||
              finishedTx.status === 'error' ||
              finishedTx.status === 'failed')
          ) {
            setCurrentTransaction(finishedTx)
            // Clear after 5 seconds
            setTimeout(() => setCurrentTransaction(null), 5000)
          }
        }
      } catch (err) {
        console.error('Failed to fetch transactions:', err)
      }
    }

    fetchTransactions()
    const interval = setInterval(fetchTransactions, 1000)
    return () => clearInterval(interval)
  }, [client, currentTransaction])

  // Set pending transaction when loading starts
  useEffect(() => {
    if (isLoading && selectedFunction) {
      const moduleName = selectedModules[0]?.name || ''
      setCurrentTransaction({
        fn: `${moduleName}/${selectedFunction}`,
        params: params,
        status: 'pending',
        time: String(Math.floor(Date.now() / 1000)),
        key: '',
        signature: '',
        module: moduleName
      })
    }
  }, [isLoading, selectedModules, selectedFunction, params])

  return {
    currentTransaction,
    pendingCount
  }
}
