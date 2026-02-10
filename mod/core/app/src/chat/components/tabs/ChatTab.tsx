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
  onSubmit: (e: React.FormEvent) => void
  fetchedSchemas?: Map<string, ModuleSchema>
}

/**
 * Chat tab content - function selector + message input + recent transaction
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
    <form onSubmit={onSubmit} className="flex-1 flex flex-col gap-2 min-h-0 overflow-auto">
      {/* All inputs in one row */}
      <div className="flex-shrink-0 flex gap-2 items-start">
        {/* Function selector */}
        <div className="w-64">
          <FunctionSelector
            selectedModules={selectedModules}
            selectedFunction={selectedFunction}
            setSelectedFunction={setSelectedFunction}
            fetchedSchemas={fetchedSchemas}
          />
        </div>

        {/* Param selector */}
        {inputParamOptions.length > 0 && (
          <div className="w-40 relative">
            <button
              type="button"
              onClick={() => setShowParamDropdown(!showParamDropdown)}
              className="w-full px-4 py-4 text-base font-semibold rounded-2xl bg-neutral-950/60 border border-neutral-800/50 hover:border-neutral-700/50 text-white transition-all flex items-center justify-between backdrop-blur-sm"
              disabled={isLoading}
              style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif', letterSpacing: '-0.01em' }}
            >
              <span className="truncate">{selectedInputParam || inputParamOptions[0] || 'param'}</span>
              <span className="text-sm text-neutral-500 ml-1">▼</span>
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
                    className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-white/10 text-white border-b border-neutral-800/40 last:border-b-0 transition-all"
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
            className="w-full bg-neutral-950/60 border border-neutral-800/50 text-white px-5 py-4 rounded-2xl text-sm focus:outline-none focus:border-neutral-700/50 placeholder-gray-600 resize-none transition-all backdrop-blur-sm"
            disabled={isLoading}
            style={{
              fontFamily: 'SF Pro Display, -apple-system, sans-serif',
              letterSpacing: '-0.01em',
              lineHeight: '1.4',
              minHeight: '56px'
            }}
          />
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
