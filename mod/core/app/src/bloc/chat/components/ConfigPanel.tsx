'use client'

import { useState } from 'react'
import { ChatInput } from './ChatInput'

interface ConfigPanelProps {
  selectedModule: string
  setSelectedModule: (value: string) => void
  selectedFunction: string
  setSelectedFunction: (value: string) => void
  modules: any[]
  functions: string[]
  schema: any
  params: Record<string, any>
  handleParamChange: (key: string, value: string) => void
  handleResetParams: () => void
  handleRefresh: () => void
  configOrientation: 'vertical' | 'horizontal' | 'left' | 'top'
  setConfigOrientation: (value: 'vertical' | 'horizontal' | 'left' | 'top') => void
  messages: any[]
  messagesEndRef: any
  input: string
  setInput: (value: string) => void
  selectedInputParam: string
  setSelectedInputParam: (value: string) => void
  wait: boolean
  setWait: (value: boolean) => void
  isLoading: boolean
  inputParamOptions: string[]
  handleSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}

export function ConfigPanel({
  selectedModule, setSelectedModule, selectedFunction, setSelectedFunction,
  modules, functions, schema, params, handleParamChange, handleResetParams,
  handleRefresh, configOrientation, setConfigOrientation,
  messages, messagesEndRef, input, setInput, selectedInputParam, setSelectedInputParam,
  wait, setWait, isLoading, inputParamOptions, handleSubmit, onCancel
}: ConfigPanelProps) {
  const [isModuleFnCollapsed, setIsModuleFnCollapsed] = useState(false)
  const [isParamsCollapsed, setIsParamsCollapsed] = useState(false)

  const setOrientationDirect = (orientation: 'vertical' | 'horizontal' | 'left' | 'top') => {
    setConfigOrientation(orientation)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-gradient-to-br from-black/90 to-gray-900/70 border-b-2 border-green-500/30">
        <div className="flex justify-between items-center p-3">
          <h2 className="text-green-400 text-base font-bold" style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}>⚙ config</h2>
          <div className="flex gap-2">
            <div className="flex gap-1">
              <button
                onClick={() => setOrientationDirect('top')}
                className={`px-2 py-1.5 text-xl ${configOrientation === 'top' ? 'bg-blue-500/40 border-blue-400' : 'bg-blue-500/20 border-blue-500/40'} text-blue-400 border-2 hover:bg-blue-500/30 rounded transition-all`}
                title="Top"
              >↑</button>
              <button
                onClick={() => setOrientationDirect('vertical')}
                className={`px-2 py-1.5 text-xl ${configOrientation === 'vertical' ? 'bg-blue-500/40 border-blue-400' : 'bg-blue-500/20 border-blue-500/40'} text-blue-400 border-2 hover:bg-blue-500/30 rounded transition-all`}
                title="Right"
              >→</button>
              <button
                onClick={() => setOrientationDirect('horizontal')}
                className={`px-2 py-1.5 text-xl ${configOrientation === 'horizontal' ? 'bg-blue-500/40 border-blue-400' : 'bg-blue-500/20 border-blue-500/40'} text-blue-400 border-2 hover:bg-blue-500/30 rounded transition-all`}
                title="Bottom"
              >↓</button>
              <button
                onClick={() => setOrientationDirect('left')}
                className={`px-2 py-1.5 text-xl ${configOrientation === 'left' ? 'bg-blue-500/40 border-blue-400' : 'bg-blue-500/20 border-blue-500/40'} text-blue-400 border-2 hover:bg-blue-500/30 rounded transition-all`}
                title="Left"
              >←</button>
            </div>
            <button
              onClick={handleRefresh}
              className="px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-purple-600/10 text-purple-400 border-2 border-purple-500/40 hover:from-purple-500/30 hover:to-purple-600/20 hover:border-purple-500/60 rounded-full transition-all duration-200 font-bold shadow-lg text-xs"
              style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}
            >
              🔄 refresh
            </button>
          </div>
        </div>
      </div>

      <ChatInput
        input={input}
        setInput={setInput}
        selectedInputParam={selectedInputParam}
        setSelectedInputParam={setSelectedInputParam}
        wait={wait}
        setWait={setWait}
        isLoading={isLoading}
        selectedModule={selectedModule}
        selectedFunction={selectedFunction}
        inputParamOptions={inputParamOptions}
        handleSubmit={handleSubmit}
        onCancel={onCancel}
      />

      <div className="border-2 border-gray-700/60 rounded-lg overflow-hidden mt-3 mx-3 cursor-pointer" onClick={() => setIsModuleFnCollapsed(!isModuleFnCollapsed)}>
        <div className="p-3 bg-gray-900/80">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-green-400 text-sm font-bold" style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}>mod / fn</h3>
            <button
              onClick={(e) => { e.stopPropagation(); setIsModuleFnCollapsed(!isModuleFnCollapsed); }}
              className="text-green-400 hover:text-green-300 transition-all text-lg px-1"
            >
              <span>{isModuleFnCollapsed ? '▼' : '▲'}</span>
            </button>
          </div>
          {!isModuleFnCollapsed && (
            <div className="flex flex-col gap-2">
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                className="bg-gray-900/80 border-2 border-gray-700/60 text-white px-2 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/60 focus:border-green-500/60 transition-all shadow-lg text-sm"
                style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
              >
                <option value="">Select Module</option>
                {modules.map(mod => (
                  <option key={mod.name} value={mod.name}>{mod.name}</option>
                ))}
              </select>
              <select
                value={selectedFunction}
                onChange={(e) => setSelectedFunction(e.target.value)}
                disabled={!selectedModule}
                className="bg-gray-900/80 border-2 border-gray-700/60 text-white px-2 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/60 focus:border-green-500/60 disabled:opacity-50 transition-all shadow-lg text-sm"
                style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
              >
                <option value="">Select Function</option>
                {functions.map(fn => (
                  <option key={fn} value={fn}>{fn}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {selectedFunction && schema && schema[selectedFunction] && (
        <div className="border-2 border-gray-700/60 rounded-lg overflow-hidden mt-3 mx-3 cursor-pointer" onClick={() => setIsParamsCollapsed(!isParamsCollapsed)}>
          <div className="p-3 space-y-2 bg-gray-900/40">
            <div className="flex justify-between items-center">
              <h3 className="text-cyan-400 text-sm font-bold" style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}>parameters</h3>
              <div className="flex gap-2 items-center">
                <button
                  onClick={(e) => { e.stopPropagation(); handleResetParams(); }}
                  className="px-2 py-1 bg-gradient-to-r from-orange-500/20 to-orange-600/10 text-orange-400 border-2 border-orange-500/40 hover:from-orange-500/30 hover:to-orange-600/20 hover:border-orange-500/60 rounded-lg transition-all duration-200 font-bold shadow-lg text-xs"
                  style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}
                >
                  🔄 reset
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setIsParamsCollapsed(!isParamsCollapsed); }}
                  className="text-cyan-400 hover:text-cyan-300 transition-all text-lg px-1"
                >
                  <span>{isParamsCollapsed ? '▼' : '▲'}</span>
                </button>
              </div>
            </div>
            {!isParamsCollapsed && (
              <>
                {Object.entries(schema[selectedFunction].input)
                  .filter(([key]) => key !== 'self' && key !== 'cls')
                  .map(([key, value]: [string, any]) => (
                    <div key={key} className="flex flex-col gap-1">
                      <label className="text-green-400 text-xs font-bold" style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase', textShadow: '0 0 10px rgba(34, 197, 94, 0.5)' }}>
                        {key} <span className="text-gray-500 text-xs">({value.type})</span>
                      </label>
                      <input
                        type="text"
                        value={params[key] ?? ''}
                        onChange={(e) => handleParamChange(key, e.target.value)}
                        placeholder={value.value !== '_empty' ? String(value.value) : 'enter value...'}
                        className="bg-gray-900/80 border-2 border-green-500/60 text-green-300 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-bold"
                        style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
                      />
                    </div>
                  ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
