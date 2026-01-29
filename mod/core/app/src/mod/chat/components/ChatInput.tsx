'use client'

import { useState } from 'react'

interface ChatInputConfig {
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

export function ChatInput(config: ChatInputConfig) {
  const [isParamsCollapsed, setIsParamsCollapsed] = useState(false)
  const [showParamSelector, setShowParamSelector] = useState(false)

  return (
    <div className="space-y-4">
      <form onSubmit={config.handleSubmit} className="space-y-4">
        {/* MODFN SELECTOR */}
        {config.inputParamOptions.length > 0 && (
          <div className="relative flex-1">
            <button
              type="button"
              onClick={() => setShowParamSelector(!showParamSelector)}
              className="w-full px-5 py-4 bg-cyan-500/30 text-cyan-300 border-2 border-cyan-400/60 hover:bg-cyan-500/40 hover:border-cyan-400/80 rounded-lg transition-all duration-200 font-bold text-xl shadow-lg backdrop-blur-sm"
              style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase', textShadow: '0 0 10px rgba(34, 211, 238, 0.6)' }}
              disabled={config.isLoading}
            >
              {config.selectedInputParam || 'param'}
            </button>
            {showParamSelector && (
              <div className="absolute bottom-full mb-2 left-0 right-0 bg-black/95 border-4 border-cyan-400/70 rounded-xl shadow-2xl max-h-80 overflow-y-auto z-50 backdrop-blur-md">
                {config.inputParamOptions.map(param => (
                  <button
                    key={param}
                    type="button"
                    onClick={() => {
                      config.setSelectedInputParam(param)
                      setShowParamSelector(false)
                    }}
                    className="w-full text-left px-5 py-4 hover:bg-cyan-500/30 text-cyan-300 border-b border-cyan-500/30 last:border-b-0 transition-all duration-200 font-bold text-lg"
                    style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase', textShadow: '0 0 8px rgba(34, 211, 238, 0.5)' }}
                  >
                    {param}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CENTERED LARGER CHAT INPUT */}
        <div className="relative flex justify-center">
          <textarea
            value={config.input}
            onChange={(e) => config.setInput(e.target.value)}
            placeholder="enter your message..."
            className="w-full bg-black/60 border-4 border-orange-500/60 text-white px-8 py-8 rounded-2xl focus:outline-none focus:ring-4 focus:ring-orange-500/80 focus:border-orange-500/80 placeholder-orange-600/50 resize-none text-3xl text-center"
            style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase', minHeight: '200px', maxWidth: '900px' }}
            disabled={config.isLoading}
            rows={8}
          />
        </div>

        {/* BUTTONS BELOW CHAT */}
        <div className="flex gap-4 items-center justify-center">
          {config.isLoading ? (
            <button
              type="button"
              onClick={config.onCancel}
              className="px-10 py-5 bg-red-500/20 text-red-400 border-3 border-red-500/50 hover:bg-red-500/30 rounded-xl transition-all font-bold text-2xl"
              style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
            >
              ❌ cancel
            </button>
          ) : (
            <button
              type="submit"
              className="px-10 py-5 bg-orange-500/20 text-orange-400 border-3 border-orange-500/50 hover:bg-orange-500/30 rounded-xl transition-all font-bold text-2xl"
              style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
              disabled={!config.selectedModule || !config.selectedFunction}
            >
              🚀 send
            </button>
          )}
        </div>
      </form>

      {/* PARAMS BELOW */}
      {config.selectedFunction && config.schema && config.schema[config.selectedFunction] && (
        <div className="border-2 border-orange-500/40 rounded-lg overflow-hidden bg-black/40 backdrop-blur-sm">
          <div 
            className="flex justify-between items-center p-4 cursor-pointer hover:bg-orange-500/10 transition-all"
            onClick={() => setIsParamsCollapsed(!isParamsCollapsed)}
          >
            <h3 className="text-orange-400 text-2xl font-bold" style={{ fontFamily: 'Press Start 2P, monospace', textTransform: 'lowercase', textShadow: '0 0 10px rgba(251, 146, 60, 0.5)' }}>parameters</h3>
            <div className="flex gap-3 items-center">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  config.handleResetParams()
                }}
                className="px-4 py-3 bg-orange-500/20 text-orange-400 border-2 border-orange-500/40 hover:bg-orange-500/30 rounded-lg transition-all text-lg font-bold"
                style={{ fontFamily: 'Press Start 2P, monospace', textTransform: 'lowercase' }}
              >
                🔄 reset
              </button>
              <span className="text-orange-400 text-2xl">
                {isParamsCollapsed ? '▲' : '▼'}
              </span>
            </div>
          </div>
          {!isParamsCollapsed && (
            <div className="p-4 grid gap-4 grid-cols-2">
              {Object.entries(config.schema[config.selectedFunction].input)
                .filter(([key]) => key !== 'self' && key !== 'cls')
                .map(([key, value]: [string, any]) => (
                  <div key={key} className="flex flex-col gap-2">
                    <label className="text-white text-lg font-bold" style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}>
                      {key} <span className="text-gray-500 text-base">({value.type})</span>
                    </label>
                    <input
                      type="text"
                      value={config.params[key] ?? ''}
                      onChange={(e) => config.handleParamChange(key, e.target.value)}
                      placeholder={value.value !== '_empty' ? String(value.value) : 'enter value...'}
                      className="bg-black/60 border-2 border-orange-500/40 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/60 text-lg placeholder-orange-600/40"
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
