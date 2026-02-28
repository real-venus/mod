"use client";

import { useState, useEffect, useRef } from 'react'
import { FunctionControlBar } from '../FunctionControlBar'
import { SchemaParamsPanel } from '../SchemaParamsPanel'
import { RecentTransaction } from '../RecentTransaction'
import { TransactionCard } from '../../transactions/TransactionCard'
import { CopyButton } from '@/ui/CopyButton'
import { userContext } from '@/context'
import type { Module, ModuleSchema, Transaction } from '../../types'

interface InputsTabProps {
  selectedModules: Module[]
  selectedFunction: string
  setSelectedFunction: (fn: string) => void
  input: string
  setInput: (value: string) => void
  selectedInputParam: string
  setSelectedInputParam: (param: string) => void
  inputParamOptions: string[]
  schema: ModuleSchema | null
  params: Record<string, any>
  handleParamChange: (key: string, value: string) => void
  handleResetParams: () => void
  isLoading: boolean
  onSubmit: (e?: React.FormEvent) => void
  onCancel: () => void
  canSubmit: boolean
  fetchedSchemas?: Map<string, ModuleSchema>
}

type InputViewMode = 'chat' | 'params' | 'code'

/**
 * Inputs tab - combines chat, params, and code views with toggle
 */
export function InputsTab({
  selectedModules,
  selectedFunction,
  setSelectedFunction,
  input,
  setInput,
  selectedInputParam,
  setSelectedInputParam,
  inputParamOptions,
  schema,
  params,
  handleParamChange,
  handleResetParams,
  isLoading,
  onSubmit,
  onCancel,
  canSubmit,
  fetchedSchemas
}: InputsTabProps) {
  const [viewMode, setViewMode] = useState<InputViewMode>('chat')
  const [showParamDropdown, setShowParamDropdown] = useState(false)
  const [showRecentTx, setShowRecentTx] = useState(true)
  const [recentTransaction, setRecentTransaction] = useState<Transaction | null>(null)
  const prevFunctionRef = useRef<string>('')
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

  // Only reset to first input param when the function changes
  useEffect(() => {
    if (selectedFunction !== prevFunctionRef.current) {
      prevFunctionRef.current = selectedFunction
      if (inputParamOptions.length > 0) {
        setSelectedInputParam(inputParamOptions[0])
      }
    }
  }, [selectedFunction, inputParamOptions, setSelectedInputParam])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (viewMode === 'chat' && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit(e as any)
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      onSubmit()
    }
  }

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    if (canSubmit && !isLoading) {
      onSubmit(e)
    }
  }

  const functionCode = schema?.[selectedFunction]?.content || ''
  const hasCode = functionCode.length > 0

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="flex-1 flex flex-col gap-3 min-h-0 overflow-visible p-4">
      {/* Message input area - FIRST & PROMINENT */}
      <div className="flex-shrink-0 flex gap-3 items-stretch" style={{ minHeight: '80px' }}>
        {/* Param selector */}
        {inputParamOptions.length > 0 && (
          <div className="w-32 relative">
            <button
              type="button"
              onClick={() => setShowParamDropdown(!showParamDropdown)}
              className="h-full w-full px-3 text-base font-bold rounded-2xl border-2 transition-all flex items-center justify-between backdrop-blur-sm group"
              disabled={isLoading}
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-input)',
                color: 'var(--text-primary)',
              }}
            >
              <span className="truncate text-sm">{selectedInputParam || inputParamOptions[0] || 'param'}</span>
              <span className={`text-xs transition-transform ${showParamDropdown ? 'rotate-180' : ''}`} style={{ color: 'var(--text-tertiary)' }}>▼</span>
            </button>
            {showParamDropdown && (
              <div className="absolute top-full mt-2 left-0 right-0 border-2 border-purple-500/40 rounded-xl shadow-2xl overflow-hidden z-[9999] backdrop-blur-xl" style={{ backgroundColor: 'var(--bg-surface)' }}>
                {inputParamOptions.map(param => (
                  <button
                    key={param}
                    type="button"
                    onClick={() => {
                      setSelectedInputParam(param)
                      setShowParamDropdown(false)
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-purple-500/20 transition-all"
                    style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)' }}
                  >
                    {param}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Message input - PROMINENT */}
        <div className="flex-1">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="enter message..."
            className="w-full h-full border-2 px-5 py-3 rounded-2xl text-base focus:outline-none focus:border-purple-500/50 resize-none transition-all backdrop-blur-sm"
            disabled={isLoading}
            style={{
              fontFamily: 'SF Pro Display, -apple-system, sans-serif',
              letterSpacing: '-0.01em',
              lineHeight: '1.5',
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-input)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      {/* Function selector and SEND button - BELOW INPUT */}
      <div className="flex-shrink-0">
        <FunctionControlBar
          selectedModules={selectedModules}
          selectedFunction={selectedFunction}
          setSelectedFunction={setSelectedFunction}
          isLoading={isLoading}
          onSubmit={onSubmit}
          onCancel={onCancel}
          canSubmit={canSubmit}
          fetchedSchemas={fetchedSchemas}
          variant="large"
        />
      </div>

      {/* CHAT/PARAMS/CODE tabs - BELOW FUNCTION SELECTOR */}
      <div className="flex-shrink-0">
        <div className="flex gap-0 rounded-2xl backdrop-blur-sm border p-1 overflow-hidden" style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)' }}>
          <button
            type="button"
            onClick={() => setViewMode('chat')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all border-2 ${
              viewMode === 'chat'
                ? 'bg-transparent shadow-lg'
                : 'border-transparent'
            }`}
            style={{
              fontFamily: 'SF Pro Display, -apple-system, sans-serif',
              letterSpacing: '-0.01em',
              color: viewMode === 'chat' ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderColor: viewMode === 'chat' ? 'var(--border-strong)' : 'transparent',
            }}
          >
            💬 CHAT
          </button>
          <button
            type="button"
            onClick={() => setViewMode('params')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all border-2 ${
              viewMode === 'params'
                ? 'bg-transparent shadow-lg'
                : 'border-transparent'
            }`}
            style={{
              fontFamily: 'SF Pro Display, -apple-system, sans-serif',
              letterSpacing: '-0.01em',
              color: viewMode === 'params' ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderColor: viewMode === 'params' ? 'var(--border-strong)' : 'transparent',
            }}
          >
            📝 PARAMS
          </button>
          <button
            type="button"
            onClick={() => setViewMode('code')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all border-2 ${
              viewMode === 'code'
                ? 'bg-transparent shadow-lg'
                : 'border-transparent'
            }`}
            style={{
              fontFamily: 'SF Pro Display, -apple-system, sans-serif',
              letterSpacing: '-0.01em',
              color: viewMode === 'code' ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderColor: viewMode === 'code' ? 'var(--border-strong)' : 'transparent',
            }}
          >
            💻 CODE
          </button>
        </div>
      </div>

      {/* Content area - BELOW TABS */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {viewMode === 'chat' ? (
          <div className="space-y-3">
            {/* Recent Transaction Section */}
            {recentTransaction && (
              <div>
                {/* Compact toggle */}
                <button
                  type="button"
                  onClick={() => setShowRecentTx(!showRecentTx)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold transition-all mb-2"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <span className="text-[10px]">{showRecentTx ? '▼' : '▶'}</span>
                  <span>Recent Transaction</span>
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
          </div>
        ) : viewMode === 'params' ? (
          <div className="space-y-3">
            {/* Params Panel */}
            {selectedFunction && schema?.[selectedFunction] ? (
              <SchemaParamsPanel
                selectedFunction={selectedFunction}
                schema={schema}
                params={params}
                handleParamChange={handleParamChange}
                handleResetParams={handleResetParams}
                numColumns={2}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-tertiary)' }}>
                Select a function to edit parameters
              </div>
            )}

            {/* Recent Transaction Output */}
            <RecentTransaction />
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden flex flex-col backdrop-blur-sm h-full" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <div className="flex items-center gap-3">
                <span className="text-lg">💻</span>
                <div className="flex flex-col">
                  <h3 className="text-sm font-semibold" style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
                    Function Code
                  </h3>
                  {selectedFunction && (
                    <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                      {selectedFunction}
                    </span>
                  )}
                </div>
              </div>
              {hasCode && (
                <CopyButton text={functionCode} size="sm" showValueOnHover={false} />
              )}
            </div>

            {/* Code display */}
            <div className="flex-1 overflow-auto p-5 scrollbar-thin">
              {hasCode ? (
                <pre
                  className="text-sm leading-relaxed select-text"
                  style={{
                    fontFamily: 'SF Mono, Monaco, Consolas, monospace',
                    userSelect: 'text',
                    WebkitUserSelect: 'text',
                    MozUserSelect: 'text',
                    msUserSelect: 'text',
                    color: 'var(--text-primary)',
                  }}
                >
                  <code className="select-text" style={{ userSelect: 'text' }}>{functionCode}</code>
                </pre>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="text-4xl mb-3 opacity-30">📄</div>
                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No code available for this function</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </form>
  )
}
