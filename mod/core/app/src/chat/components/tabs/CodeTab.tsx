"use client";

import { useState } from 'react'
import { CopyButton } from '@/ui/CopyButton'
import { FunctionSelector } from '../FunctionSelector'
import type { Module, ModuleSchema } from '../../types'

interface CodeTabProps {
  selectedModules: Module[]
  selectedFunction: string
  setSelectedFunction: (fn: string) => void
  schema: ModuleSchema | null
  fetchedSchemas?: Map<string, ModuleSchema>
}

/**
 * Code tab content - displays function source code
 */
export function CodeTab({
  selectedModules,
  selectedFunction,
  setSelectedFunction,
  schema,
  fetchedSchemas
}: CodeTabProps) {
  const functionCode = schema?.[selectedFunction]?.content || ''
  const hasCode = functionCode.length > 0

  return (
    <div className="flex-1 overflow-hidden min-h-0 flex flex-col gap-3">
      {/* Function Selector */}
      <div className="flex-shrink-0">
        <FunctionSelector
          selectedModules={selectedModules}
          selectedFunction={selectedFunction}
          setSelectedFunction={setSelectedFunction}
          fetchedSchemas={fetchedSchemas}
        />
      </div>

      <div className="flex-1 bg-neutral-950/60 border border-neutral-800/50 rounded-2xl overflow-hidden flex flex-col backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800/50">
          <div className="flex items-center gap-3">
            <span className="text-lg">💻</span>
            <div className="flex flex-col">
              <h3 className="text-white text-sm font-semibold" style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif', letterSpacing: '-0.01em' }}>
                Function Code
              </h3>
              {selectedFunction && (
                <span className="text-neutral-500 text-xs font-medium">
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
              className="text-sm text-neutral-200 leading-relaxed select-text"
              style={{
                fontFamily: 'SF Mono, Monaco, Consolas, monospace',
                userSelect: 'text',
                WebkitUserSelect: 'text',
                MozUserSelect: 'text',
                msUserSelect: 'text'
              }}
            >
              <code className="select-text" style={{ userSelect: 'text' }}>{functionCode}</code>
            </pre>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-4xl mb-3 opacity-30">📄</div>
                <p className="text-neutral-500 text-sm">No code available for this function</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
