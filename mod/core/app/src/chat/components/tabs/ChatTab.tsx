"use client";

import { useState, useEffect, useRef } from 'react'
import { FunctionSelector } from '../FunctionSelector'
import { TransactionCard } from '../../transactions/TransactionCard'
import { userContext } from '@/context'
import type { Module, ModuleSchema, Transaction } from '../../types'

interface ChatTabProps {
  selectedModules: Module[]
  selectedFunction: string
  setSelectedFunction: (fn: string) => void
  input: string
  setInput: (value: string) => void
  selectedInputParam: string
  setSelectedInputParam: (param: string) => void
  inputParamOptions: string[]
  isLoading: boolean
  onSubmit: (e?: React.FormEvent) => void
  onCancel: () => void
  canSubmit: boolean
  fetchedSchemas?: Map<string, ModuleSchema>
}

/**
 * Chat tab content - function selector + message input + send button + recent transaction
 */
export function ChatTab({
  selectedModules,
  selectedFunction,
  setSelectedFunction,
  input,
  setInput,
  selectedInputParam,
  setSelectedInputParam,
  inputParamOptions,
  isLoading,
  onSubmit,
  onCancel,
  canSubmit,
  fetchedSchemas
}: ChatTabProps) {
  const [showParamDropdown, setShowParamDropdown] = useState(false)
  const [showRecentTx, setShowRecentTx] = useState(true)
  const [recentTransaction, setRecentTransaction] = useState<Transaction | null>(null)
  const prevFunctionRef = useRef<string>('')
  const { client } = userContext()

  // Fetch most recent transaction
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
    const interval = setInterval(fetchRecentTx, 2000)
    return () => clearInterval(interval)
  }, [client])

  // Only reset to first input param when the function changes
  useEffect(() => {
    if (selectedFunction !== prevFunctionRef.current) {
      prevFunctionRef.current = selectedFunction
      if (inputParamOptions.length > 0) {
        setSelectedInputParam(inputParamOptions[0])
      }
    }
  }, [selectedFunction, inputParamOptions, setSelectedInputParam])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit(e as any)
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(e); }} className="flex-1 flex flex-col gap-2 min-h-0 overflow-auto">
      {/* All inputs in one row with send button */}
      <div className="flex-shrink-0 flex gap-2 items-start">
        {/* Function selector */}
        <div className="w-56">
          <FunctionSelector
            selectedModules={selectedModules}
            selectedFunction={selectedFunction}
            setSelectedFunction={setSelectedFunction}
            fetchedSchemas={fetchedSchemas}
          />
        </div>

        {/* Param selector */}
        {inputParamOptions.length > 0 && (
          <div className="w-32 relative">
            <button
              type="button"
              onClick={() => setShowParamDropdown(!showParamDropdown)}
              className="w-full px-3 py-4 text-sm font-semibold rounded-2xl bg-neutral-950/60 border border-neutral-800/50 hover:border-neutral-700/50 text-white transition-all flex items-center justify-between backdrop-blur-sm"
              disabled={isLoading}
              style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif', letterSpacing: '-0.01em' }}
            >
              <span className="truncate">{selectedInputParam || inputParamOptions[0] || 'param'}</span>
              <span className="text-xs text-neutral-500 ml-1">▼</span>
            </button>
            {showParamDropdown && (
              <div className="absolute top-full mt-2 left-0 right-0 bg-neutral-950/98 border border-neutral-800/60 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.6)] overflow-hidden z-50 backdrop-blur-xl">
                {inputParamOptions.map(param => (
                  <button
                    key={param}
                    type="button"
                    onClick={() => {
                      setSelectedInputParam(param)
                      setShowParamDropdown(false)
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-white/10 text-white border-b border-neutral-800/40 last:border-b-0 transition-all"
                    style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif', letterSpacing: '-0.01em' }}
                  >
                    {param}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Message input - takes remaining space */}
        <div className="flex-1">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="enter message..."
            rows={1}
            className="w-full bg-neutral-950/60 border border-neutral-800/50 text-white px-4 py-4 rounded-2xl text-sm focus:outline-none focus:border-neutral-700/50 placeholder-gray-600 resize-none transition-all backdrop-blur-sm"
            disabled={isLoading}
            style={{
              fontFamily: 'SF Pro Display, -apple-system, sans-serif',
              letterSpacing: '-0.01em',
              lineHeight: '1.4',
              minHeight: '56px'
            }}
          />
        </div>

        {/* Send/Cancel button - Large with gradient */}
        <div className="flex-shrink-0">
          {isLoading ? (
            <button
              type="button"
              onClick={onCancel}
              className="px-10 py-4 text-base font-bold rounded-2xl bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 transition-all shadow-[0_8px_24px_rgba(239,68,68,0.4)] flex items-center gap-3"
              style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif', letterSpacing: '-0.01em', minHeight: '56px' }}
            >
              <span className="text-2xl">⏹</span>
              <span>CANCEL</span>
            </button>
          ) : (
            <button
              type="submit"
              className="px-10 py-4 text-base font-bold rounded-2xl bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 text-white hover:from-purple-700 hover:via-violet-700 hover:to-fuchsia-700 transition-all shadow-[0_8px_24px_rgba(147,51,234,0.5)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-3"
              disabled={!canSubmit}
              style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif', letterSpacing: '-0.01em', minHeight: '56px' }}
            >
              <span className="text-2xl">⚡</span>
              <span>SEND</span>
            </button>
          )}
        </div>
      </div>

      {/* Recent Transaction Section - no dead space */}
      {recentTransaction && (
        <div className="flex-shrink-0">
          {/* Compact toggle */}
          <button
            type="button"
            onClick={() => setShowRecentTx(!showRecentTx)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-300 transition-all"
            style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif', letterSpacing: '-0.01em' }}
          >
            <span className="text-[10px]">{showRecentTx ? '▼' : '▶'}</span>
            <span>Recent</span>
          </button>

          {/* Transaction card */}
          {showRecentTx && (
            <TransactionCard
              tx={recentTransaction}
              idx={0}
              isExpanded={true}
            />
          )}
        </div>
      )}
    </form>
  )
}
