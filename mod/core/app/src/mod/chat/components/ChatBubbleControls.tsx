'use client'

import { useState } from 'react'
import { InputModeToggle } from './InputModeToggle'
import { SchemaParamsPanel } from './SchemaParamsPanel'

interface ChatBubbleControlsProps {
  inputMode: 'chat' | 'params'
  setInputMode: (mode: 'chat' | 'params') => void
  selectedFunction: string
  schema: any
  params: Record<string, any>
  handleParamChange: (key: string, value: string) => void
  handleResetParams: () => void
  isCollapsed: boolean
  setIsCollapsed: (value: boolean) => void
}

export function ChatBubbleControls({
  inputMode,
  setInputMode,
  selectedFunction,
  schema,
  params,
  handleParamChange,
  handleResetParams,
  isCollapsed,
  setIsCollapsed
}: ChatBubbleControlsProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end">
      {!isCollapsed && (
        <div className="bg-black/95 backdrop-blur-md border-2 border-orange-500/60 rounded-xl p-4 shadow-2xl max-w-md">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-orange-400 font-bold text-lg" style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}>controls</h3>
            <button
              onClick={() => setIsCollapsed(true)}
              className="px-3 py-1 bg-orange-500/20 text-orange-400 border border-orange-500/40 hover:bg-orange-500/30 rounded transition-all text-sm"
              style={{ fontFamily: 'IBM Plex Mono, monospace' }}
            >
              ▼ collapse
            </button>
          </div>
          
          <InputModeToggle mode={inputMode} onModeChange={setInputMode} />
          
          {inputMode === 'params' && selectedFunction && schema && schema[selectedFunction] && (
            <div className="mt-3">
              <SchemaParamsPanel
                selectedFunction={selectedFunction}
                schema={schema}
                params={params}
                handleParamChange={handleParamChange}
                handleResetParams={handleResetParams}
                numColumns={1}
              />
            </div>
          )}
        </div>
      )}
      
      {isCollapsed && (
        <button
          onClick={() => setIsCollapsed(false)}
          className="px-4 py-3 bg-orange-500/30 text-orange-400 border-2 border-orange-500/60 hover:bg-orange-500/40 rounded-lg transition-all shadow-lg font-bold"
          style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
          title="Show Controls"
        >
          ⚙️ controls
        </button>
      )}
    </div>
  )
}