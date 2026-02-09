"use client";

import { useState } from 'react'
import { SchemaParamsPanel } from './SchemaParamsPanel'
import type { UnifiedInputPanelProps } from '../types'

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
    if (key === selectedInputParam) setInput(value)
  }

  const handleInputChangeWithSync = (value: string) => {
    setInput(value)
    if (selectedInputParam) handleParamChange(selectedInputParam, value)
  }

  const functionCode = schema?.[selectedFunction]?.content || ''

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="flex-shrink-0 flex gap-3 items-center justify-between border-b border-neutral-700/50 pb-3 mb-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'chat'
                ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md'
                : 'bg-neutral-800/50 text-neutral-400 hover:bg-neutral-700/50 hover:text-neutral-200'
            }`}
          >
            Chat
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('params')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'params'
                ? 'bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-md'
                : 'bg-neutral-800/50 text-neutral-400 hover:bg-neutral-700/50 hover:text-neutral-200'
            }`}
          >
            Params
          </button>
          {functionHasCode && (
            <button
              type="button"
              onClick={() => setActiveTab('code')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'code'
                  ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md'
                  : 'bg-neutral-800/50 text-neutral-400 hover:bg-neutral-700/50 hover:text-neutral-200'
              }`}
            >
              Code
            </button>
          )}
        </div>

        <div className="flex gap-2">
          {isLoading ? (
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-br from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 transition-all shadow-md flex items-center gap-2"
            >
              <span className="animate-pulse">⏹</span> Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => handleSubmit(e as any)}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700 transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-2"
              disabled={!selectedModule || !selectedFunction}
            >
              <span>⚡</span> Send
            </button>
          )}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'chat' ? (
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-2 min-h-0">
          {/* Param selector row - outside textarea */}
          {inputParamOptions.length > 0 && (
            <div className="flex-shrink-0 flex items-center gap-2 px-1">
              <label className="text-xs text-neutral-500 font-medium">Input param:</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowParamDropdown(!showParamDropdown)}
                  className="px-3 py-1.5 text-xs font-mono rounded-lg bg-neutral-800 border border-neutral-600 text-neutral-300 hover:bg-neutral-700 hover:border-neutral-500 transition-all flex items-center gap-2"
                  disabled={isLoading}
                >
                  <span className="text-cyan-400">→</span>
                  <span>{selectedInputParam || inputParamOptions[0] || 'param'}</span>
                  <span className="text-neutral-500">▼</span>
                </button>
                {showParamDropdown && (
                  <div className="absolute top-full mt-1 left-0 min-w-[160px] bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl overflow-hidden z-50">
                    {inputParamOptions.map(param => (
                      <button
                        key={param}
                        type="button"
                        onClick={() => {
                          setSelectedInputParam(param)
                          setShowParamDropdown(false)
                        }}
                        className="w-full text-left px-4 py-2 text-sm font-mono hover:bg-neutral-800 text-neutral-300 border-b border-neutral-800 last:border-b-0 transition-all"
                      >
                        {param}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Textarea - clean, no overlapping elements */}
          <div className="flex-1 min-h-0">
            <textarea
              value={input}
              onChange={(e) => handleInputChangeWithSync(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your message... (Shift+Enter for new line, Enter to send)"
              className="w-full h-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-4 py-3 rounded-lg text-sm font-mono focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 placeholder-neutral-600 resize-none"
              disabled={isLoading}
            />
          </div>
        </form>
      ) : activeTab === 'params' ? (
        <div className="flex-1 overflow-y-auto min-h-0">
          {selectedFunction && schema?.[selectedFunction] && (
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
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-4">
            <h3 className="text-neutral-400 text-xs font-semibold mb-3 uppercase tracking-wide">Function Code</h3>
            <pre className="bg-black border border-neutral-800 rounded-lg p-3 overflow-x-auto text-xs text-neutral-300 font-mono">
              <code>{functionCode || 'No code available'}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
