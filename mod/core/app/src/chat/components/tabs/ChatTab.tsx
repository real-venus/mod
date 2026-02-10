"use client";

import { useState, useEffect } from 'react'
import { FunctionSelector } from '../FunctionSelector'
import type { Module, ModuleSchema } from '../../types'

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
 * Chat tab content - function selector + message input
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

  // Auto-select first input param if none selected
  useEffect(() => {
    if (inputParamOptions.length > 0 && !selectedInputParam) {
      setSelectedInputParam(inputParamOptions[0])
    }
  }, [inputParamOptions, selectedInputParam, setSelectedInputParam])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit(e as any)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden">
      {/* Function selector */}
      <div className="flex-shrink-0">
        <FunctionSelector
          selectedModules={selectedModules}
          selectedFunction={selectedFunction}
          setSelectedFunction={setSelectedFunction}
          fetchedSchemas={fetchedSchemas}
        />
      </div>

      {/* Param selector row */}
      {inputParamOptions.length > 0 && (
        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg bg-black/60 border border-neutral-800">
          <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
            Input:
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowParamDropdown(!showParamDropdown)}
              className="px-3 py-1 text-xs font-mono font-bold rounded-lg bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30 transition-all flex items-center gap-2 uppercase"
              disabled={isLoading}
            >
              <span>{selectedInputParam || inputParamOptions[0] || 'param'}</span>
              <span className="text-xs">▼</span>
            </button>
            {showParamDropdown && (
              <div className="absolute top-full mt-1 left-0 min-w-[160px] bg-black/95 border border-cyan-500/50 rounded-lg shadow-xl overflow-hidden z-50">
                {inputParamOptions.map(param => (
                  <button
                    key={param}
                    type="button"
                    onClick={() => {
                      setSelectedInputParam(param)
                      setShowParamDropdown(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm font-mono font-bold hover:bg-cyan-500/20 text-cyan-400 border-b border-neutral-800 last:border-b-0 transition-all uppercase"
                  >
                    {param}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Textarea */}
      <div className="flex-1" style={{ minHeight: '200px' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="enter message..."
          className="w-full h-full bg-black/60 border border-neutral-800 text-neutral-200 px-4 py-3 rounded-xl text-sm font-mono focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 placeholder-neutral-600 resize-none transition-all"
          disabled={isLoading}
        />
      </div>
    </form>
  )
}
