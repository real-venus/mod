'use client'

import { useState } from 'react'

interface ChatInputProps {
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

export function ChatInput({
  input, setInput, selectedInputParam, setSelectedInputParam,
  wait, setWait, isLoading, selectedModule, selectedFunction,
  inputParamOptions, handleSubmit, onCancel,
  params, handleParamChange, handleResetParams, schema
}: ChatInputProps) {
  const [isParamsCollapsed, setIsParamsCollapsed] = useState(false)
  const [showParamSelector, setShowParamSelector] = useState(false)

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="enter your message..."
            className="w-full bg-black/60 border-2 border-orange-500/40 text-white px-4 py-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/60 focus:border-orange-500/60 placeholder-orange-600/40 resize-none text-xl"
            style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase', minHeight: '120px' }}
            disabled={isLoading}
            rows={6}
          />
        </div>

        <div className="flex gap-2 items-center">
          {inputParamOptions.length > 0 && (
            <div className="relative flex-1">
              <button
                type="button"
                onClick={() => setShowParamSelector(!showParamSelector)}
                className="w-full px-4 py-3 bg-cyan-500/30 text-cyan-300 border-2 border-cyan-400/60 hover:bg-cyan-500/40 hover:border-cyan-400/80 rounded-lg transition-all duration-200 font-bold text-sm shadow-lg backdrop-blur-sm"
                style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase', textShadow: '0 0 10px rgba(34, 211, 238, 0.6)' }}
                disabled={isLoading}
              >
                {selectedInputParam || 'param'}
              </button>
              {showParamSelector && (
                <div className="absolute bottom-full mb-2 left-0 right-0 bg-black/95 border-4 border-cyan-400/70 rounded-xl shadow-2xl max-h-80 overflow-y-auto z-50 backdrop-blur-md">
                  {inputParamOptions.map(param => (
                    <button
                      key={param}
                      type="button"
                      onClick={() => {
                        setSelectedInputParam(param)
                        setShowParamSelector(false)
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-cyan-500/30 text-cyan-300 border-b border-cyan-500/30 last:border-b-0 transition-all duration-200 font-bold text-sm"
                      style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase', textShadow: '0 0 8px rgba(34, 211, 238, 0.5)' }}
                    >
                      {param}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {isLoading ? (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 bg-red-500/20 text-red-400 border-2 border-red-500/40 hover:bg-red-500/30 rounded-lg transition-all font-bold text-sm"
              style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
            >
              ❌ cancel
            </button>
          ) : (
            <button
              type="submit"
              className="px-6 py-3 bg-orange-500/20 text-orange-400 border-2 border-orange-500/40 hover:bg-orange-500/30 rounded-lg transition-all font-bold text-sm"
              style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
              disabled={!selectedModule || !selectedFunction}
            >
              🚀 send
            </button>
          )}
        </div>
      </form>

      {selectedFunction && schema && schema[selectedFunction] && (
        <div className="border-2 border-orange-500/40 rounded-lg overflow-hidden bg-black/40 backdrop-blur-sm">
          <div 
            className="flex justify-between items-center p-3 cursor-pointer hover:bg-orange-500/10 transition-all"
            onClick={() => setIsParamsCollapsed(!isParamsCollapsed)}
          >
            <h3 className="text-orange-400 text-lg font-bold" style={{ fontFamily: 'Press Start 2P, monospace', textTransform: 'lowercase', textShadow: '0 0 10px rgba(251, 146, 60, 0.5)' }}>parameters</h3>
            <div className="flex gap-2 items-center">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleResetParams()
                }}
                className="px-3 py-2 bg-orange-500/20 text-orange-400 border-2 border-orange-500/40 hover:bg-orange-500/30 rounded-lg transition-all text-sm font-bold"
                style={{ fontFamily: 'Press Start 2P, monospace', textTransform: 'lowercase' }}
              >
                🔄 reset
              </button>
              <span className="text-orange-400 text-xl">
                {isParamsCollapsed ? '▲' : '▼'}
              </span>
            </div>
          </div>
          {!isParamsCollapsed && (
            <div className="p-3 grid gap-3 grid-cols-2">
              {Object.entries(schema[selectedFunction].input)
                .filter(([key]) => key !== 'self' && key !== 'cls')
                .map(([key, value]: [string, any]) => (
                  <div key={key} className="flex flex-col gap-2">
                    <label className="text-white text-sm font-bold" style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}>
                      {key} <span className="text-gray-500 text-xs">({value.type})</span>
                    </label>
                    <input
                      type="text"
                      value={params[key] ?? ''}
                      onChange={(e) => handleParamChange(key, e.target.value)}
                      placeholder={value.value !== '_empty' ? String(value.value) : 'enter value...'}
                      className="bg-black/60 border-2 border-orange-500/40 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/60 text-sm placeholder-orange-600/40"
                      style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
                    />
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
