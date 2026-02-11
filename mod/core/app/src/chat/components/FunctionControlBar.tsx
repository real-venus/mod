"use client";

import { FunctionSelector } from './FunctionSelector'
import type { Module, ModuleSchema } from '../types'

interface FunctionControlBarProps {
  selectedModules: Module[]
  selectedFunction: string
  setSelectedFunction: (fn: string) => void
  isLoading: boolean
  onSubmit: () => void
  onCancel: () => void
  canSubmit: boolean
  fetchedSchemas?: Map<string, ModuleSchema>
  variant?: 'compact' | 'large'
}

/**
 * Shared function selector and send/cancel button component
 * Used in both Chat and Params tabs for consistency
 */
export function FunctionControlBar({
  selectedModules,
  selectedFunction,
  setSelectedFunction,
  isLoading,
  onSubmit,
  onCancel,
  canSubmit,
  fetchedSchemas,
  variant = 'large'
}: FunctionControlBarProps) {
  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onSubmit()
  }

  if (variant === 'compact') {
    // Compact version for chat tab
    return (
      <div className="flex gap-3 items-stretch">
        <div className="w-64">
          <FunctionSelector
            selectedModules={selectedModules}
            selectedFunction={selectedFunction}
            setSelectedFunction={setSelectedFunction}
            fetchedSchemas={fetchedSchemas}
          />
        </div>

        <div className="flex-shrink-0">
          {isLoading ? (
            <button
              type="button"
              onClick={onCancel}
              className="h-full px-12 text-lg font-black rounded-2xl bg-gradient-to-br from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 hover:scale-[1.02] active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2"
            >
              <span className="text-xl">⏹</span>
              <span>STOP</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleButtonClick}
              className="h-full px-12 text-lg font-black rounded-2xl bg-gradient-to-br from-purple-600 to-purple-700 text-white hover:from-purple-500 hover:to-purple-600 hover:scale-[1.02] active:scale-95 transition-all shadow-xl disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 border border-white/10"
              disabled={!canSubmit}
            >
              <span className="text-xl">⚡</span>
              <span>SEND</span>
            </button>
          )}
        </div>
      </div>
    )
  }

  // Large version for params tab - matches TabBar styling
  return (
    <div className="flex gap-2 items-stretch rounded-2xl bg-neutral-900/40 backdrop-blur-sm border border-neutral-800/50 p-3 overflow-visible">
      <div className="flex-1" style={{ minHeight: '64px' }}>
        <FunctionSelector
          selectedModules={selectedModules}
          selectedFunction={selectedFunction}
          setSelectedFunction={setSelectedFunction}
          fetchedSchemas={fetchedSchemas}
        />
      </div>

      <div className="flex-shrink-0">
        {isLoading ? (
          <button
            type="button"
            onClick={onCancel}
            className="px-10 py-4 text-base font-black rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 hover:scale-[1.02] active:scale-95 transition-all shadow-xl flex items-center gap-3"
            style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif', letterSpacing: '0.02em', minHeight: '64px' }}
          >
            <span className="text-2xl">⏹</span>
            <span>STOP</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleButtonClick}
            className="px-10 py-4 text-base font-black rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 text-white hover:from-purple-500 hover:via-violet-500 hover:to-fuchsia-500 hover:scale-[1.02] active:scale-95 transition-all shadow-xl disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-3"
            disabled={!canSubmit}
            style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif', letterSpacing: '0.02em', minHeight: '64px' }}
          >
            <span className="text-2xl">⚡</span>
            <span>SEND</span>
          </button>
        )}
      </div>
    </div>
  )
}
