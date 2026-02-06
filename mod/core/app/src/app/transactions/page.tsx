"use client";

import { useRef } from 'react'
import { TransactionsPanel } from '@/mod/chat/transactions/TransactionsPanel'

export const dynamic = 'force-dynamic'

export default function TransactionsPage() {
  const panelRef = useRef<{ handleSync: () => void } | null>(null)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900" style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>
      <div className="max-w-7xl mx-auto">
        <div className="border-2 border-cyan-500/30 rounded-2xl overflow-hidden bg-black/40 backdrop-blur-sm" style={{ height: 'calc(100vh - 40px)', minHeight: '500px' }}>
          <TransactionsPanel ref={panelRef} hideTitle showStats />
        </div>
      </div>
    </div>
  )
}
