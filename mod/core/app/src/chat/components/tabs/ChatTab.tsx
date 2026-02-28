"use client";

import { useState } from 'react'
import { TransactionCard } from '../../transactions/TransactionCard'
import { ParameterSelector } from '../ParameterSelector'
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
  recentTransaction
}: ChatTabProps) {
  const [showRecentTx, setShowRecentTx] = useState(true)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit(e as any)
    }
  }

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto p-4 scrollbar-thin">
      {/* Message input - terminal style */}
      <div className="flex-shrink-0">
        <div
          className="relative rounded-2xl overflow-visible border-2 border-green-500/40"
          style={{
            fontFamily: 'IBM Plex Mono, Menlo, Monaco, Courier New, monospace',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <div className="relative p-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder=""
              rows={4}
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
              />
            </div>
          </div>
        </div>
      </div>

      {/* Send/Stop Button */}
      <div className="flex-shrink-0">
        {isLoading ? (
          <button
            type="button"
            onClick={onCancel}
            className="w-full px-8 py-3 text-sm font-bold uppercase tracking-widest rounded-2xl border-2 border-red-600 text-red-500 transition-all flex items-center justify-center gap-3 relative overflow-hidden group"
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
            className="w-full px-8 py-3 text-sm font-bold uppercase tracking-widest rounded-2xl border-2 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 relative overflow-hidden group"
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

      {/* Transaction Output Section */}
      <div className="flex-shrink-0">
        {recentTransaction && (
          <div>
            <button
              type="button"
              onClick={() => setShowRecentTx(!showRecentTx)}
              className="w-full flex items-center gap-2 px-2 py-1 text-xs font-bold transition-all mb-2 uppercase tracking-wider"
              style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-tertiary)' }}
            >
              <span className="text-[10px]">{showRecentTx ? '▼' : '▶'}</span>
              <span>OUTPUT</span>
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
    </div>
  )
}
