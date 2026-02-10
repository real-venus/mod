"use client";

import type { ModuleSchema } from '../../types'

interface CodeTabProps {
  selectedFunction: string
  schema: ModuleSchema | null
}

/**
 * Code tab content - displays function source code
 */
export function CodeTab({ selectedFunction, schema }: CodeTabProps) {
  const functionCode = schema?.[selectedFunction]?.content || ''

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="bg-black/60 border border-neutral-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-emerald-400 text-sm">💻</span>
          <h3 className="text-neutral-400 text-[10px] font-bold uppercase tracking-wider">
            Function Code
          </h3>
          {selectedFunction && (
            <span className="text-emerald-400 text-xs font-mono">
              {selectedFunction}
            </span>
          )}
        </div>
        <pre className="bg-black border border-neutral-800 rounded-lg p-3 overflow-x-auto text-xs text-neutral-300 font-mono leading-relaxed">
          <code>{functionCode || 'No code available for this function'}</code>
        </pre>
      </div>
    </div>
  )
}
