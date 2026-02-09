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
    <div className="space-y-4 h-full flex flex-col">
      {/* Tab bar */}
      <div className="flex gap-3 items-center justify-between border-b border-neutral-700/50 pb-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`px-6 py-3 text-base font-bold rounded-xl transition-all duration-200 ${
              activeTab === 'chat'
                ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30'
                : 'bg-neutral-800/50 text-neutral-400 hover:bg-neutral-700/50 hover:text-neutral-200 border border-neutral-700/30'
            }`}
          >
            💬 Chat
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('params')}
            className={`px-6 py-3 text-base font-bold rounded-xl transition-all duration-200 ${
              activeTab === 'params'
                ? 'bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-lg shadow-purple-500/30'
                : 'bg-neutral-800/50 text-neutral-400 hover:bg-neutral-700/50 hover:text-neutral-200 border border-neutral-700/30'
            }`}
          >
            ⚙️ Params
          </button>
          {functionHasCode && (
            <button
              type="button"
              onClick={() => setActiveTab('code')}
              className={`px-6 py-3 text-base font-bold rounded-xl transition-all duration-200 ${
                activeTab === 'code'
                  ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30'
                  : 'bg-neutral-800/50 text-neutral-400 hover:bg-neutral-700/50 hover:text-neutral-200 border border-neutral-700/30'
              }`}
            >
              💻 Code
            </button>
          )}
        </div>

        <div className="flex gap-3">
          {isLoading ? (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 text-base font-bold rounded-xl bg-gradient-to-br from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-lg shadow-red-500/30 flex items-center gap-2"
            >
              <span className="animate-pulse">⏹</span> Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => handleSubmit(e as any)}
              className="px-6 py-3 text-base font-bold rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700 transition-all duration-200 shadow-lg shadow-cyan-500/30 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-2"
              disabled={!selectedModule || !selectedFunction}
            >
              <span>⚡</span> Send
            </button>
          )}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'chat' ? (
        <form onSubmit={handleSubmit} className="space-y-2 flex-1 flex flex-col">
          <div className="relative flex gap-2 items-stretch flex-1">
            <textarea
              value={input}
              onChange={(e) => handleInputChangeWithSync(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="enter message..."
              className="flex-1 bg-neutral-900 border border-neutral-700 text-neutral-200 px-4 py-3 rounded text-sm font-mono focus:outline-none focus:border-neutral-500 placeholder-neutral-600 resize-none"
              style={{ minHeight: '200px' }}
              disabled={isLoading}
            />
            {inputParamOptions.length > 0 && (
              <div className="absolute bottom-3 right-3">
                <button
                  type="button"
                  onClick={() => setShowParamDropdown(!showParamDropdown)}
                  className="px-3 py-1.5 text-xs font-mono rounded bg-neutral-800 border border-neutral-600 text-neutral-400 hover:bg-neutral-700 transition-all"
                  disabled={isLoading}
                >
                  {selectedInputParam || inputParamOptions[0] || 'param'}
                </button>
                {showParamDropdown && (
                  <div className="absolute bottom-full mb-1 right-0 bg-neutral-900 border border-neutral-700 rounded shadow-lg max-h-48 overflow-y-auto z-50">
                    {inputParamOptions.map(param => (
                      <button
                        key={param}
                        type="button"
                        onClick={() => {
                          setSelectedInputParam(param)
                          setShowParamDropdown(false)
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-mono hover:bg-neutral-800 text-neutral-300 border-b border-neutral-800 last:border-b-0 transition-all"
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
        <div className="space-y-2 flex-1 overflow-y-auto">
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
        <div className="space-y-2 flex-1 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-700 rounded p-4">
            <h3 className="text-neutral-400 text-xs font-medium mb-3">function code</h3>
            <pre className="bg-black border border-neutral-800 rounded p-3 overflow-x-auto text-xs text-neutral-300 font-mono">
              <code>{functionCode || 'no code available'}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
