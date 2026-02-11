"use client";

import { SchemaParamsPanel } from '../SchemaParamsPanel'
import { RecentTransaction } from '../RecentTransaction'
import type { ModuleSchema } from '../../types'

interface ParamsTabProps {
  params: Record<string, any>
  handleParamChange: (key: string, value: string) => void
  handleResetParams: () => void
  schema: ModuleSchema | null
  selectedFunction: string
}

/**
 * Params tab content - params editor with IBM ASCII terminal vibe
 */
export function ParamsTab({
  params,
  handleParamChange,
  handleResetParams,
  schema,
  selectedFunction
}: ParamsTabProps) {
  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-visible p-4">
      {/* Content area - Params */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-700/50 scrollbar-track-transparent">
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
            <div
              className="flex items-center justify-center h-full text-neutral-500 text-xs uppercase tracking-wider"
              style={{ fontFamily: 'IBM Plex Mono, monospace' }}
            >
              ┌─ SELECT A FUNCTION TO EDIT PARAMETERS ─┐
            </div>
          )}

          {/* Recent Transaction Output - Below inputs */}
          <RecentTransaction />
        </div>
      </div>
    </div>
  )
}
