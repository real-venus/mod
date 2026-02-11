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
    <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-hidden p-4">
      {/* Message input - terminal style */}
      <div className="flex-shrink-0">
        <div
          className="relative rounded-2xl overflow-visible border-2 border-green-500/40 p-3"
          style={{
            fontFamily: 'IBM Plex Mono, Menlo, Monaco, Courier New, monospace',
            background: 'linear-gradient(135deg, rgba(20,20,20,0.95) 0%, rgba(10,10,10,0.98) 100%)',
          }}
        >
          <div className="relative">
            {/* Parameter Selector - Top Left Inside */}
            <div className="absolute top-1 left-2 z-10">
              <ParameterSelector
                parameters={inputParamOptions}
                selectedParameter={selectedInputParam}
                setSelectedParameter={setSelectedInputParam}
              />
            </div>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder=""
              rows={4}
              className="w-full bg-transparent text-green-400 pl-24 pr-4 py-3 rounded-xl text-sm focus:outline-none placeholder-neutral-700 resize-none transition-all border-0"
              disabled={isLoading}
              style={{
                fontFamily: 'IBM Plex Mono, monospace',
                letterSpacing: '0.02em',
                lineHeight: '1.6',
              }}
            />
          </div>
        </div>
      </div>

      {/* Send/Stop Button */}
      <div className="flex-shrink-0">
        {isLoading ? (
          <button
            type="button"
            onClick={onCancel}
            className="w-full px-8 py-3 text-sm font-bold uppercase tracking-widest rounded-2xl border-2 border-red-600 bg-red-950/40 text-red-400 hover:bg-red-900/60 hover:text-red-300 transition-all flex items-center justify-center gap-3 relative overflow-hidden group"
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              letterSpacing: '0.15em'
            }}
          >
            <span className="absolute inset-0 bg-red-600/10 group-hover:bg-red-600/20 transition-all" />
            <span className="text-xl relative z-10">■</span>
            <span className="relative z-10">STOP</span>
            {/* ASCII corner brackets */}
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
            className="w-full px-8 py-3 text-sm font-bold uppercase tracking-widest rounded-2xl border-2 border-yellow-600 bg-yellow-950/40 text-yellow-400 hover:bg-yellow-900/60 hover:text-yellow-300 disabled:border-neutral-700 disabled:bg-neutral-900/40 disabled:text-neutral-600 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 relative overflow-hidden group"
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              letterSpacing: '0.15em'
            }}
          >
            <span className="absolute inset-0 bg-yellow-600/10 group-hover:bg-yellow-600/20 disabled:group-hover:bg-transparent transition-all" />
            <span className="text-xl relative z-10">⚡</span>
            <span className="relative z-10">SEND</span>
            {/* ASCII corner brackets */}
            <span className="absolute top-0 left-0 text-yellow-600/60 text-xs leading-none p-0.5 group-disabled:text-neutral-700/60">┌</span>
            <span className="absolute top-0 right-0 text-yellow-600/60 text-xs leading-none p-0.5 group-disabled:text-neutral-700/60">┐</span>
            <span className="absolute bottom-0 left-0 text-yellow-600/60 text-xs leading-none p-0.5 group-disabled:text-neutral-700/60">└</span>
            <span className="absolute bottom-0 right-0 text-yellow-600/60 text-xs leading-none p-0.5 group-disabled:text-neutral-700/60">┘</span>
          </button>
        )}
      </div>

      {/* Transaction Output Section */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-700/50 scrollbar-track-transparent">
        {recentTransaction && (
          <div>
            <button
              type="button"
              onClick={() => setShowRecentTx(!showRecentTx)}
              className="w-full flex items-center gap-2 px-2 py-1 text-xs font-bold text-neutral-600 hover:text-green-400 transition-all mb-2 uppercase tracking-wider"
              style={{ fontFamily: 'IBM Plex Mono, monospace' }}
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
