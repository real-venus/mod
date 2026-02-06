"use client";

import { useRef } from 'react'
import { TransactionsPanel } from '@/mod/chat/transactions/TransactionsPanel'

export const dynamic = 'force-dynamic'

export default function TransactionsPage() {
  const panelRef = useRef<{ handleSync: () => void } | null>(null)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900 p-6" style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>
      <div className="max-w-[1800px] mx-auto">
        <div className="border-2 rounded-3xl overflow-hidden bg-gradient-to-br from-black/60 via-black/50 to-black/40 backdrop-blur-xl shadow-2xl" style={{
          height: 'calc(100vh - 48px)',
          minHeight: '600px',
          borderColor: 'rgba(6, 182, 212, 0.3)',
          boxShadow: '0 0 60px rgba(6, 182, 212, 0.15), 0 20px 80px rgba(0, 0, 0, 0.5)'
        }}>
          <TransactionsPanel ref={panelRef} hideTitle showStats />
        </div>
      </div>
    </div>
  )
}
