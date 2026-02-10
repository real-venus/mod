"use client";

import { FunctionSelector } from '../FunctionSelector'
import { SchemaParamsPanel } from '../SchemaParamsPanel'
import type { Module, ModuleSchema } from '../../types'

interface ParamsTabProps {
  selectedModules: Module[]
  selectedFunction: string
  setSelectedFunction: (fn: string) => void
  schema: ModuleSchema | null
  params: Record<string, any>
  handleParamChange: (key: string, value: string) => void
  handleResetParams: () => void
  isLoading: boolean
  onSubmit: () => void
  onCancel: () => void
  canSubmit: boolean
  fetchedSchemas?: Map<string, ModuleSchema>
}

/**
 * Params tab content - function selector + params editor + send button
 */
export function ParamsTab({
  selectedModules,
  selectedFunction,
  setSelectedFunction,
  schema,
  params,
  handleParamChange,
  handleResetParams,
  isLoading,
  onSubmit,
  onCancel,
  canSubmit,
  fetchedSchemas
}: ParamsTabProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (canSubmit && !isLoading) {
      onSubmit()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">
      {/* Function selector and send button */}
      <div className="flex-shrink-0 flex gap-2 items-start">
        <div className="flex-1">
          <FunctionSelector
            selectedModules={selectedModules}
            selectedFunction={selectedFunction}
            setSelectedFunction={setSelectedFunction}
            fetchedSchemas={fetchedSchemas}
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

      {/* Params editor */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-700/50 scrollbar-track-transparent">
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
          <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
            Select a function to edit parameters
          </div>
        )}
      </div>
    </form>
  )
}
