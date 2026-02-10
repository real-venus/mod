"use client";

import { forwardRef } from 'react'
import { TransactionsPanel } from '../../transactions/TransactionsPanel'
import type { TransactionsPanelRef, Module } from '../../types'

interface TxsTabProps {
  selectedModules?: Module[]
}

/**
 * Transactions tab content - displays only deployed/completed transactions for selected modules
 */
export const TxsTab = forwardRef<TransactionsPanelRef, TxsTabProps>(({ selectedModules = [] }, ref) => {
  return (
    <div className="flex-1 overflow-hidden min-h-0">
      <TransactionsPanel
        ref={ref}
        hideTitle={true}
        initialStatusFilter="success"
        selectedModules={selectedModules}
      />
    </div>
  )
})

TxsTab.displayName = 'TxsTab'
