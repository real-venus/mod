"use client";

import { useState, useEffect } from 'react'
import { TransactionCard } from '../../transactions/TransactionCard'
import { userContext } from '@/context'
import type { Message, Transaction } from '../../types'

interface ChatTabProps {
  messages: Message[]
  input: string
  setInput: (value: string) => void
  isLoading: boolean
  onSubmit: (e?: React.FormEvent) => void
}

/**
 * Chat tab content - simple message input with IBM ASCII terminal vibe
 */
export function ChatTab({
  messages,
  input,
  setInput,
  isLoading,
  onSubmit
}: ChatTabProps) {
  const [showRecentTx, setShowRecentTx] = useState(true)
  const [recentTransaction, setRecentTransaction] = useState<Transaction | null>(null)
  const { client } = userContext()

  // Fetch most recent transaction - only on mount, no polling
  useEffect(() => {
    const fetchRecentTx = async () => {
      if (!client) return
      try {
        const result = await client.call('txs', { df: 0, n: 1, page: 0 })
        const txs = Array.isArray(result) ? result : []
        if (txs.length > 0) {
          setRecentTransaction(txs[0])
        }
      } catch (err) {
        console.error('Failed to fetch recent transaction:', err)
      }
    }

    fetchRecentTx()
  }, [client])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit(e as any)
    }
  }

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-visible p-4">
      {/* Message input - terminal style */}
      <div
        className="flex-shrink-0 relative rounded-lg overflow-hidden"
        style={{
          fontFamily: 'IBM Plex Mono, Menlo, Monaco, Courier New, monospace',
          background: 'linear-gradient(135deg, rgba(20,20,20,0.95) 0%, rgba(10,10,10,0.98) 100%)',
        }}
      >
        {/* ASCII border */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neutral-600 to-transparent" />
        <div className="absolute top-0 left-0 w-px h-full bg-gradient-to-b from-neutral-600 via-neutral-700 to-neutral-600" />
        <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-neutral-600 via-neutral-700 to-neutral-600" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neutral-600 to-transparent" />

        <div className="border border-neutral-700/50 p-1">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="> enter message..."
            rows={4}
            className="w-full bg-transparent border-2 border-neutral-700/50 text-green-400 px-4 py-3 rounded text-sm focus:outline-none focus:border-green-600/50 placeholder-neutral-700 resize-none transition-all"
            disabled={isLoading}
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              letterSpacing: '0.02em',
              lineHeight: '1.6',
            }}
          />
        </div>
      </div>

      {/* Recent Transaction Section */}
      {recentTransaction && (
        <div className="flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowRecentTx(!showRecentTx)}
            className="w-full flex items-center gap-2 px-2 py-1 text-xs font-bold text-neutral-600 hover:text-green-400 transition-all mb-2 uppercase tracking-wider"
            style={{ fontFamily: 'IBM Plex Mono, monospace' }}
          >
            <span className="text-[10px]">{showRecentTx ? '▼' : '▶'}</span>
            <span>RECENT TX</span>
          </button>

          {showRecentTx && (
            <TransactionCard
              tx={recentTransaction}
              idx={0}
              isExpanded={true}
            />
          )}
        </div>
      )}
    </div>
  )
}
