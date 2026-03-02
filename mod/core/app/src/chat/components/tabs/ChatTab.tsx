"use client";

import { useState, useEffect } from 'react'
import { TransactionCard } from '../../transactions/TransactionCard'
import { ParameterSelector } from '../ParameterSelector'
import { userContext } from '@/context'
import type { Message, Transaction } from '../../types'

interface ChatTabProps {
  messages: Message[]
  input: string
  setInput: (value: string) => void
  isLoading: boolean
  onSubmit: (e?: React.FormEvent) => void
  onCancel: () => void
  canSubmit: boolean
  inputParamOptions: string[]
  selectedInputParam: string
  setSelectedInputParam: (param: string) => void
  recentTransaction: Transaction | null
  paramSchema?: Record<string, { type: string; value: any }>
}

/**
 * Chat tab content - simple message input with IBM ASCII terminal vibe
 */
export function ChatTab({
  messages,
  input,
  setInput,
  isLoading,
  onSubmit,
  onCancel,
  canSubmit,
  inputParamOptions,
  selectedInputParam,
  setSelectedInputParam,
  recentTransaction,
  paramSchema
}: ChatTabProps) {
  const { client } = userContext()
  const [showRecentTx, setShowRecentTx] = useState(true)
  const [viewMode, setViewMode] = useState<'present' | 'history'>('present')
  const [historyTransactions, setHistoryTransactions] = useState<Transaction[]>([])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit(e as any)
    }
  }

  // Fetch transaction history
  useEffect(() => {
    const fetchHistory = async () => {
      if (!client) return
      try {
        const result = await client.call('txs', { df: 0, n: 10, page: 0 })
        const txs = Array.isArray(result) ? result : []
        setHistoryTransactions(txs)
      } catch (err) {
        console.error('Failed to fetch transaction history:', err)
      }
    }
    fetchHistory()
  }, [client, recentTransaction]) // Refetch when new transaction comes in

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-hidden p-4">
      {/* Top Section - Results with Present/History Toggle */}
      <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden">
        {/* Header with Mode Toggle */}
        <div className="flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border" style={{
              fontFamily: 'IBM Plex Mono, monospace',
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-secondary)'
            }}>
              ◉ RESULTS
            </span>
          </div>

          {/* Chat/Tasks Toggle */}
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border-color)' }}>
            <button
              onClick={() => setViewMode('present')}
              className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all border-r ${
                viewMode === 'present'
                  ? 'text-green-400'
                  : 'text-gray-500 hover:text-gray-400'
              }`}
              style={{
                fontFamily: 'IBM Plex Mono, monospace',
                backgroundColor: viewMode === 'present' ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-input)',
                borderRightColor: 'var(--border-color)'
              }}
            >
              <span className="inline-flex items-center gap-2">
                <span className="text-sm">💬</span>
                CHAT
              </span>
            </button>
            <button
              onClick={() => setViewMode(viewMode === 'history' ? 'present' : 'history')}
              className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
                viewMode === 'history'
                  ? 'text-purple-400'
                  : 'text-gray-500 hover:text-gray-400'
              }`}
              style={{
                fontFamily: 'IBM Plex Mono, monospace',
                backgroundColor: viewMode === 'history' ? 'rgba(168, 85, 247, 0.15)' : 'var(--bg-input)',
              }}
            >
              <span className="inline-flex items-center gap-2">
                <span className="text-sm">✓</span>
                TASKS ({historyTransactions.length})
              </span>
            </button>
          </div>
        </div>

        {/* Results Content */}
        <div className="flex-1 min-h-0 overflow-hidden rounded-2xl border-2" style={{
          borderColor: viewMode === 'present' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(168, 85, 247, 0.3)',
          backgroundColor: 'var(--bg-surface)'
        }}>
          {/* Chat View */}
          {viewMode === 'present' && (
            <div className="h-full flex flex-col overflow-hidden">
              {recentTransaction ? (
                <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
                  <TransactionCard
                    tx={recentTransaction}
                    idx={0}
                    isExpanded={true}
                  />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="border-2 border-dashed rounded-xl p-8 text-center" style={{
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-tertiary)'
                  }}>
                    <div className="text-4xl mb-3 opacity-30">💬</div>
                    <span className="text-xs font-mono">No messages yet</span>
                    <div className="text-xs font-mono mt-2 opacity-50">Send a message to start chatting</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tasks View */}
          {viewMode === 'history' && (
            <div className="h-full overflow-y-auto scrollbar-thin p-4">
              {historyTransactions.length > 0 ? (
                <div className="space-y-3">
                  {historyTransactions.map((tx, idx) => (
                    <TransactionCard
                      key={tx.cid || tx.hash || idx}
                      tx={tx}
                      idx={idx}
                      isExpanded={false}
                      compact={true}
                    />
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="border-2 border-dashed rounded-xl p-8 text-center" style={{
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-tertiary)'
                  }}>
                    <div className="text-4xl mb-3 opacity-30">✓</div>
                    <span className="text-xs font-mono">No tasks yet</span>
                    <div className="text-xs font-mono mt-2 opacity-50">Completed tasks will appear here</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section - Input */}
      <div className="flex-shrink-0 flex flex-col gap-3">
        {/* Input Area - terminal style */}
        <div
          className="relative rounded-2xl overflow-visible border-2"
          style={{
            fontFamily: 'IBM Plex Mono, Menlo, Monaco, Courier New, monospace',
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'rgba(202, 138, 4, 0.4)'
          }}
        >
          <div className="relative p-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter input..."
              rows={3}
              className="w-full bg-transparent px-4 py-3 pb-12 text-sm focus:outline-none resize-none transition-all border-0 outline-none ring-0"
              disabled={isLoading}
              style={{
                fontFamily: 'IBM Plex Mono, monospace',
                letterSpacing: '0.02em',
                lineHeight: '1.6',
                boxShadow: 'none',
                color: 'var(--text-primary)',
              }}
            />

            {/* Parameter Selector - Bottom Left Inside the bubble */}
            <div className="absolute bottom-8 left-8 z-10">
              <ParameterSelector
                parameters={inputParamOptions}
                selectedParameter={selectedInputParam}
                setSelectedParameter={setSelectedInputParam}
                schema={paramSchema}
              />
            </div>
          </div>
        </div>

        {/* Send/Stop Button */}
        {isLoading ? (
          <button
            type="button"
            onClick={onCancel}
            className="w-full px-8 py-3 text-sm font-bold uppercase tracking-widest rounded-2xl border-2 border-red-600 text-red-500 transition-all flex items-center justify-center gap-3 relative overflow-hidden group hover:bg-red-900/20"
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              letterSpacing: '0.15em',
              backgroundColor: 'var(--bg-input)',
            }}
          >
            <span className="text-xl relative z-10">■</span>
            <span className="relative z-10">STOP</span>
            <span className="absolute top-0 left-0 text-red-600/60 text-xs leading-none p-0.5">┌</span>
            <span className="absolute top-0 right-0 text-red-600/60 text-xs leading-none p-0.5">┐</span>
            <span className="absolute bottom-0 left-0 text-red-600/60 text-xs leading-none p-0.5">└</span>
            <span className="absolute bottom-0 right-0 text-red-600/60 text-xs leading-none p-0.5">┘</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onSubmit(e as any)
            }}
            disabled={!canSubmit}
            className="w-full px-8 py-3 text-sm font-bold uppercase tracking-widest rounded-2xl border-2 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 relative overflow-hidden group hover:bg-yellow-900/20 disabled:hover:bg-transparent"
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              letterSpacing: '0.15em',
              backgroundColor: 'var(--bg-input)',
              borderColor: canSubmit ? '#CA8A04' : 'var(--border-color)',
              color: canSubmit ? '#CA8A04' : 'var(--text-tertiary)',
            }}
          >
            <span className="text-xl relative z-10">⚡</span>
            <span className="relative z-10">SEND</span>
            <span className="absolute top-0 left-0 text-xs leading-none p-0.5" style={{ color: canSubmit ? 'rgba(202, 138, 4, 0.6)' : 'var(--text-tertiary)' }}>┌</span>
            <span className="absolute top-0 right-0 text-xs leading-none p-0.5" style={{ color: canSubmit ? 'rgba(202, 138, 4, 0.6)' : 'var(--text-tertiary)' }}>┐</span>
            <span className="absolute bottom-0 left-0 text-xs leading-none p-0.5" style={{ color: canSubmit ? 'rgba(202, 138, 4, 0.6)' : 'var(--text-tertiary)' }}>└</span>
            <span className="absolute bottom-0 right-0 text-xs leading-none p-0.5" style={{ color: canSubmit ? 'rgba(202, 138, 4, 0.6)' : 'var(--text-tertiary)' }}>┘</span>
          </button>
        )}
      </div>
    </div>
  )
}
