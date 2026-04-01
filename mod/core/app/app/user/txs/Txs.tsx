"use client";

import { useRef } from 'react'
import { TransactionsPanel } from '@/chat/transactions/TransactionsPanel'

export default function Txs() {
  const panelRef = useRef<{ handleSync: () => void } | null>(null)

  return (
    <div className="w-full h-full min-h-[400px]">
      <TransactionsPanel ref={panelRef} />
    </div>
  )
}

export { default as UserTxs } from './Txs'
