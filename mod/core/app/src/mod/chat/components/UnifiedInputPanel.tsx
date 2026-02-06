"use client";

import { useState } from 'react'
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
  functionHasCode?: boolean
  activeTab?: 'chat' | 'params' | 'code'
  setActiveTab?: (tab: 'chat' | 'params' | 'code') => void
}

export function UnifiedInputPanel({
  input, setInput, selectedInputParam, setSelectedInputParam,
  wait, setWait, isLoading, selectedModule, selectedFunction,
  inputParamOptions, handleSubmit, onCancel,
  params, handleParamChange, handleResetParams, schema,
  functionHasCode = false,
  activeTab = 'chat',
  setActiveTab = () => {}
}: UnifiedInputPanelProps) {
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

  const functionCode = schema?.[selectedFunction]?.content || ''

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Tab Toggle and Send Button on Same Line */}
      <div className="flex gap-3 items-center justify-between border-b-2 border-white/20 pb-3">
        <div className="flex gap-2 flex-1">

          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`px-6 py-3 border-2 rounded-lg transition-all font-bold text-base ${
              activeTab === 'chat'
                ? 'bg-cyan-500/30 text-cyan-300 border-cyan-400/80 shadow-[0_0_15px_rgba(0,255,255,0.4)]'
                : 'bg-black/40 text-cyan-600/60 border-white/20 hover:bg-cyan-500/10'
            }`}
            style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
          >
            💬 chat
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('params')}
            className={`px-6 py-3 border-2 rounded-lg transition-all font-bold text-base ${
              activeTab === 'params'
                ? 'bg-orange-500/30 text-orange-300 border-orange-400/80 shadow-[0_0_15px_rgba(255,165,0,0.4)]'
                : 'bg-black/40 text-orange-600/60 border-white/20 hover:bg-orange-500/10'
            }`}
            style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
          >
            ⚙️ params
          </button>
          {functionHasCode && (
            <button
              type="button"
              onClick={() => setActiveTab('code')}
              className={`px-6 py-3 border-2 rounded-lg transition-all font-bold text-base ${
                activeTab === 'code'
                  ? 'bg-purple-500/30 text-purple-300 border-purple-400/80 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                  : 'bg-black/40 text-purple-600/60 border-white/20 hover:bg-purple-500/10'
              }`}
              style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
            >
              💻 code
            </button>
          )}
        </div>

        {/* SEND BUTTON */}
        <div className="flex gap-3" style={{ width: '25%' }}>
          {isLoading ? (
            <button
              type="button"
              onClick={onCancel}
              className="w-full px-6 py-3 bg-red-500/30 text-red-300 border-2 border-red-400/80 hover:bg-red-500/40 rounded-lg transition-all font-bold text-base shadow-[0_0_15px_rgba(255,0,0,0.4)] hover:shadow-[0_0_20px_rgba(255,0,0,0.6)]"
              style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
            >
              ❌ cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => handleSubmit(e as any)}
              className="w-full px-6 py-3 bg-cyan-500/30 text-cyan-300 border-2 border-cyan-400/80 hover:bg-cyan-500/40 rounded-lg transition-all font-bold text-base shadow-[0_0_15px_rgba(0,255,255,0.4)] hover:shadow-[0_0_20px_rgba(0,255,255,0.6)] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
              disabled={!selectedModule || !selectedFunction}
            >
              🚀 send
            </button>
          )}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'chat' ? (
        <form onSubmit={handleSubmit} className="space-y-3 flex-1 flex flex-col">
          <div className="relative flex gap-2 items-stretch flex-1">
            <textarea
              value={input}
              onChange={(e) => handleInputChangeWithSync(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="enter your message..."
              className="flex-1 bg-black/60 border-2 border-white/30 text-white px-6 py-5 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-500/60 focus:border-cyan-400/80 placeholder-cyan-600/50 resize-none text-lg overflow-y-auto shadow-[inset_0_0_20px_rgba(255,255,255,0.1)]"
              style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase', minHeight: '300px' }}
              disabled={isLoading}
            />
            {inputParamOptions.length > 0 && (
              <div className="absolute bottom-4 right-4">
                <button
                  type="button"
                  onClick={() => setShowParamDropdown(!showParamDropdown)}
                  className="px-5 py-3 bg-black/90 border-2 border-orange-400/60 text-orange-300 hover:bg-orange-500/40 hover:border-orange-400/80 rounded-xl transition-all duration-200 font-bold text-base shadow-lg backdrop-blur-sm"
                  style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
                  disabled={isLoading}
                >
                  {selectedInputParam || inputParamOptions[0] || 'param'}
                </button>
                {showParamDropdown && (
                  <div className="absolute bottom-full mb-2 right-0 bg-black/95 border-2 border-orange-400/70 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-50 backdrop-blur-md">
                    {inputParamOptions.map(param => (
                      <button
                        key={param}
                        type="button"
                        onClick={() => {
                          setSelectedInputParam(param)
                          setShowParamDropdown(false)
                        }}
                        className="w-full text-left px-6 py-4 hover:bg-orange-500/30 text-orange-300 border-b border-orange-500/30 last:border-b-0 transition-all duration-200 font-bold text-base"
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
      ) : activeTab === 'params' ? (
        <div className="space-y-3 flex-1 overflow-y-auto">
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
      ) : (
        <div className="space-y-3 flex-1 overflow-y-auto">
          <div className="bg-black/60 border-2 border-white/30 rounded-2xl p-6">
            <h3 className="text-white text-xl font-bold mb-4" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
              💻 Function Code
            </h3>
            <pre className="bg-black/80 border border-white/20 rounded-lg p-4 overflow-x-auto text-sm text-white" style={{ fontFamily: 'Fira Code, monospace' }}>
              <code>{functionCode || 'No code available for this function'}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
