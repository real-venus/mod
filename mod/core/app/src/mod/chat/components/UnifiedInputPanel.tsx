'use client'

import { useState } from 'react'
import { InputModeToggle } from './InputModeToggle'
import { SchemaParamsPanel } from './SchemaParamsPanel'

interface UnifiedInputPanelProps {
  input: string
  setInput: (value: string) => void
  selectedInputParam: string
  setSelectedInputParam: (value: string) => void
  wait: boolean
  setWait: (value: boolean) => void
  isLoading: boolean
  selectedModule: string
  selectedFunction: string
  inputParamOptions: string[]
  handleSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  params: Record<string, any>
  handleParamChange: (key: string, value: string) => void
  handleResetParams: () => void
  schema: any
}

export function UnifiedInputPanel({
  input, setInput, selectedInputParam, setSelectedInputParam,
  wait, setWait, isLoading, selectedModule, selectedFunction,
  inputParamOptions, handleSubmit, onCancel,
  params, handleParamChange, handleResetParams, schema
}: UnifiedInputPanelProps) {
  const [inputMode, setInputMode] = useState<'chat' | 'params'>('chat')
  const [showParamDropdown, setShowParamDropdown] = useState(false)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  const handleParamChangeWithSync = (key: string, value: string) => {
    handleParamChange(key, value)
    if (key === selectedInputParam) {
      setInput(value)
    }
  }

  const handleInputChangeWithSync = (value: string) => {
    setInput(value)
    if (selectedInputParam) {
      handleParamChange(selectedInputParam, value)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3 items-center">
        <InputModeToggle mode={inputMode} onModeChange={setInputMode} />
        {isLoading ? (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 bg-red-500/20 text-red-400 border-2 border-red-500/40 hover:bg-red-500/30 rounded-xl transition-all font-bold text-base"
            style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
          >
            ❌ cancel
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => handleSubmit(e as any)}
            className="px-6 py-3 bg-orange-500/20 text-orange-400 border-2 border-orange-500/40 hover:bg-orange-500/30 rounded-xl transition-all font-bold text-base"
            style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
            disabled={!selectedModule || !selectedFunction}
          >
            🚀 send
          </button>
        )}
      </div>
      {inputMode === 'chat' ? (
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="relative flex gap-2 items-stretch">
            <textarea
              value={input}
              onChange={(e) => handleInputChangeWithSync(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="enter your message..."
              className="flex-1 bg-black border-2 border-orange-500/40 text-white px-6 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/60 focus:border-orange-500/60 placeholder-orange-600/40 resize-none text-lg overflow-y-auto"
              style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase', maxHeight: '400px', minHeight: '200px', paddingBottom: '50px' }}
              disabled={isLoading}
              rows={6}
            />
            {inputParamOptions.length > 0 && (
              <div className="absolute bottom-3 right-3">
                <button
                  type="button"
                  onClick={() => setShowParamDropdown(!showParamDropdown)}
                  className="px-4 py-2 bg-black/80 border-2 border-cyan-400/60 text-cyan-300 hover:bg-cyan-500/40 hover:border-cyan-400/80 rounded-lg transition-all duration-200 font-bold text-sm shadow-lg backdrop-blur-sm"
                  style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
                  disabled={isLoading}
                >
                  {selectedInputParam || inputParamOptions[0] || 'param'}
                </button>
                {showParamDropdown && (
                  <div className="absolute bottom-full mb-2 right-0 bg-black/95 border-2 border-cyan-400/70 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-50 backdrop-blur-md">
                    {inputParamOptions.map(param => (
                      <button
                        key={param}
                        type="button"
                        onClick={() => {
                          setSelectedInputParam(param)
                          setShowParamDropdown(false)
                        }}
                        className="w-full text-left px-5 py-3 hover:bg-cyan-500/30 text-cyan-300 border-b border-cyan-500/30 last:border-b-0 transition-all duration-200 font-bold text-base"
                        style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
                      >
                        {param}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </form>
      ) : (
        <div className="space-y-2">
          {selectedFunction && schema && schema[selectedFunction] && (
            <SchemaParamsPanel
              selectedFunction={selectedFunction}
              schema={schema}
              params={params}
              handleParamChange={handleParamChangeWithSync}
              handleResetParams={handleResetParams}
              numColumns={2}
            />
          )}
        </div>
      )}
    </div>
  )
}
