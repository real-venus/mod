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
  fetchedSchemas?: Map<string, ModuleSchema>
}

/**
 * Params tab content - function selector + params editor
 */
export function ParamsTab({
  selectedModules,
  selectedFunction,
  setSelectedFunction,
  schema,
  params,
  handleParamChange,
  handleResetParams,
  fetchedSchemas
}: ParamsTabProps) {
  return (
    <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden">
      {/* Function selector */}
      <div className="flex-shrink-0">
        <FunctionSelector
          selectedModules={selectedModules}
          selectedFunction={selectedFunction}
          setSelectedFunction={setSelectedFunction}
          fetchedSchemas={fetchedSchemas}
        />
      </div>

      {/* Params editor */}
      <div className="flex-1 overflow-y-auto px-1">
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
    </div>
  )
}
