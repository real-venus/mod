'use client'

import { useRef } from 'react'
import { TransactionsPanel } from '@/mod/chat/transactions/TransactionsPanel'
import { TransactionStats } from './stats'

export default function TransactionsPage() {
  const transactionsPanelRef = useRef<{ handleSync: () => void } | null>(null)

  return (
    <div className="bg-black h-full p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
          Transactions
        </h1>
        <TransactionStats />
        <TransactionsPanel ref={transactionsPanelRef} />
      </div>
    </div>
  )
}
