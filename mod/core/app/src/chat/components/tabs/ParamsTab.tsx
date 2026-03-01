"use client";

import { useState } from 'react'
import { SchemaParamsPanel } from '../SchemaParamsPanel'
import { TransactionCard } from '../../transactions/TransactionCard'
import type { ModuleSchema, Transaction, FunctionSchema } from '../../types'

interface ParamsTabProps {
  params: Record<string, any>
  handleParamChange: (key: string, value: string) => void
  handleResetParams: () => void
  schema: Record<string, FunctionSchema> | null
  selectedFunction: string
  isLoading: boolean
  onSubmit: (e?: React.FormEvent) => void
  onCancel: () => void
  canSubmit: boolean
  recentTransaction: Transaction | null
}

/**
 * Params tab content - params editor with IBM ASCII terminal vibe
 */
export function ParamsTab({
  params,
  handleParamChange,
  handleResetParams,
  schema,
  selectedFunction,
  isLoading,
  onSubmit,
  onCancel,
  canSubmit,
  recentTransaction
}: ParamsTabProps) {
  const [showRecentTx, setShowRecentTx] = useState(true)
  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onSubmit()
  }

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-hidden p-4">
      {/* Top Section - Output Results */}
      <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0">
          <span className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border" style={{
            fontFamily: 'IBM Plex Mono, monospace',
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-secondary)'
          }}>
            ◉ OUTPUT
          </span>
        </div>

        {/* Output Content */}
        <div className="flex-1 min-h-0 overflow-hidden rounded-2xl border-2" style={{
          borderColor: 'rgba(34, 197, 94, 0.3)',
          backgroundColor: 'var(--bg-surface)'
        }}>
          {recentTransaction ? (
            <div className="h-full overflow-y-auto scrollbar-thin p-4">
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
                <div className="text-4xl mb-3 opacity-30">📭</div>
                <span className="text-xs font-mono">No output yet</span>
                <div className="text-xs font-mono mt-2 opacity-50">Results will appear here</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section - Parameter Editor */}
      <div className="flex-shrink-0 flex flex-col gap-3">
        {/* Params Panel */}
        <div className="max-h-[40vh] overflow-y-auto scrollbar-thin rounded-2xl border-2" style={{
          borderColor: 'rgba(202, 138, 4, 0.4)',
          backgroundColor: 'var(--bg-surface)'
        }}>
          <div className="p-4">
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
              <div
                className="flex items-center justify-center h-full text-xs uppercase tracking-wider py-8"
                style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-tertiary)' }}
              >
                ┌─ SELECT A FUNCTION TO EDIT PARAMETERS ─┐
              </div>
            )}
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
            onClick={handleButtonClick}
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
