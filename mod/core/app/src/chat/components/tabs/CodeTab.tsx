"use client";

import { CopyButton } from '@/ui/CopyButton'
import type { Module, ModuleSchema } from '../../types'

interface CodeTabProps {
  selectedModules: Module[]
  selectedFunction: string
}

/**
 * Code tab content - displays function source code with IBM ASCII terminal vibe
 */
export function CodeTab({
  selectedModules,
  selectedFunction
}: CodeTabProps) {
  // Get schema from first selected module
  const schema = selectedModules[0]?.schema as ModuleSchema | undefined
  const functionCode = schema?.[selectedFunction]?.content || ''
  const hasCode = functionCode.length > 0

  return (
    <div className="flex-1 overflow-hidden min-h-0 flex flex-col gap-3 p-4">
      {/* Code display with IBM ASCII borders */}
      <div
        className="flex-1 relative rounded-lg overflow-hidden"
        style={{
          fontFamily: 'IBM Plex Mono, Menlo, Monaco, Courier New, monospace',
          background: 'linear-gradient(135deg, rgba(20,20,20,0.95) 0%, rgba(10,10,10,0.98) 100%)',
        }}
      >
        {/* ASCII border */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neutral-600 to-transparent" />
        <div className="absolute top-0 left-0 w-px h-full bg-gradient-to-b from-neutral-600 via-neutral-700 to-neutral-600" />
        <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-neutral-600 via-neutral-700 to-neutral-600" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neutral-600 to-transparent" />

        <div className="h-full border border-neutral-700/50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700/50 bg-neutral-900/40">
            <div className="flex items-center gap-3">
              <span className="text-purple-400">💻</span>
              <div className="flex flex-col">
                <h3 className="text-white text-xs font-bold uppercase tracking-widest" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                  SOURCE CODE
                </h3>
                {selectedFunction && (
                  <span className="text-purple-400 text-[10px] font-mono">
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
          <div className="flex-1 overflow-auto p-4 scrollbar-thin scrollbar-thumb-neutral-700/50 scrollbar-track-transparent">
            {hasCode ? (
              <pre
                className="text-xs text-purple-300 leading-relaxed select-text"
                style={{
                  fontFamily: 'IBM Plex Mono, Monaco, Consolas, monospace',
                  userSelect: 'text',
                  WebkitUserSelect: 'text',
                  MozUserSelect: 'text',
                  msUserSelect: 'text',
                  letterSpacing: '0.02em'
                }}
              >
                <code className="select-text" style={{ userSelect: 'text' }}>{functionCode}</code>
              </pre>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-4xl mb-3 opacity-30">┌─┐</div>
                  <p className="text-neutral-500 text-xs uppercase tracking-wider" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                    NO CODE AVAILABLE
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
