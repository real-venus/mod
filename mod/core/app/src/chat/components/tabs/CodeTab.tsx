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
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        {/* ASCII border */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right, transparent, var(--border-color), transparent)' }} />
        <div className="absolute top-0 left-0 w-px h-full" style={{ background: 'linear-gradient(to bottom, var(--border-color), var(--border-input), var(--border-color))' }} />
        <div className="absolute top-0 right-0 w-px h-full" style={{ background: 'linear-gradient(to bottom, var(--border-color), var(--border-input), var(--border-color))' }} />
        <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right, transparent, var(--border-color), transparent)' }} />

        <div className="h-full flex flex-col" style={{ border: '1px solid var(--border-color)' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)' }}>
            <div className="flex items-center gap-3">
              <span className="text-purple-400">💻</span>
              <div className="flex flex-col">
                <h3 className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-primary)' }}>
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
          <div className="flex-1 overflow-auto p-4 scrollbar-thin">
            {hasCode ? (
              <pre
                className="text-xs text-purple-500 leading-relaxed select-text"
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
                  <p className="text-xs uppercase tracking-wider" style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-tertiary)' }}>
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
