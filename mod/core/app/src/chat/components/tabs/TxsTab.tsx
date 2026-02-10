"use client";

import { forwardRef } from 'react'
import { TransactionsPanel } from '../../transactions/TransactionsPanel'
import type { TransactionsPanelRef } from '../../types'

interface TxsTabProps {
  // Transactions panel doesn't need props, it fetches its own data
}

/**
 * Transactions tab content - displays transaction history
 */
export const TxsTab = forwardRef<TransactionsPanelRef, TxsTabProps>((props, ref) => {
  return (
    <div className="flex-1 overflow-hidden min-h-0">
      <TransactionsPanel ref={ref} hideTitle={true} />
    </div>
  )
})

TxsTab.displayName = 'TxsTab'
