"use client";

import { TransactionCard } from '../../transactions/TransactionCard'
import type { Transaction } from '../../types'

interface CurrentTransactionProps {
  transaction: Transaction
}

/**
 * Displays the current/latest transaction result
 */
export function CurrentTransaction({ transaction }: CurrentTransactionProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-2 py-1">
        <span className="text-xl">📊</span>
        <h3 className="text-white text-sm font-black uppercase tracking-widest">
          Current Results
        </h3>
      </div>
      <div className="animate-slideIn">
        <TransactionCard tx={transaction} idx={0} isExpanded={false} />
      </div>
    </div>
  )
}
