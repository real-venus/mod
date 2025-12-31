
'use client'

import { useState, useRef, useEffect } from 'react'
import { ChatInput } from './ChatInput'
import { ChatMessages } from './ChatMessages'

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
    const [unifiedInput, setUnifiedInput] = useState('')
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [solidifiedModule, setSolidifiedModule] = useState('')
    const [solidifiedFunction, setSolidifiedFunction] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

  const setOrientationDirect = (orientation: 'vertical' | 'horizontal' | 'left' | 'top') => {
    setConfigOrientation(orientation)
  }

  const handleUnifiedInput = (value: string) => {
    setUnifiedInput(value)
    setShowSuggestions(true)
    
    if (value.includes('/')) {
      const [modPart, fnPart] = value.split('/')
      
      if (!solidifiedModule) {
        const trimmedMod = modPart.trim()
        const foundModule = modules.find(m => m.name === trimmedMod)
        
        if (foundModule) {
          setSolidifiedModule(trimmedMod)
          setSelectedModule(trimmedMod)
          if (fnPart && fnPart.trim()) {
             const trimmedFn = fnPart.trim()
             const foundFunction = functions.find(f => f === trimmedFn)
             if (foundFunction) {
                setSolidifiedFunction(trimmedFn)
                setSelectedFunction(trimmedFn)
                setUnifiedInput('')
                setShowSuggestions(false)
             } else {
                setUnifiedInput(trimmedFn)
             }
          } else {
            setUnifiedInput('')
          }
        } else {
            alert(`Module "${trimmedMod}" not found`)
        }
      }
    } 
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && unifiedInput === '') {
      if (solidifiedFunction) {
        setUnifiedInput(solidifiedFunction)
        setSolidifiedFunction('')
        setSelectedFunction('')
        e.preventDefault()
      } else if (solidifiedModule) {
        setUnifiedInput(solidifiedModule)
        setSolidifiedModule('')
        setSelectedModule('')
        setSolidifiedFunction('')
        e.preventDefault()
      }
    }
  }

  const handleModuleSelect = (modName: string) => {
    setSolidifiedModule(modName)
    setSelectedModule(modName)
    setUnifiedInput('')
    setShowSuggestions(true)
    inputRef.current?.focus()
  }

  const handleFunctionSelect = (fn: string) => {
    setSolidifiedFunction(fn)
    setSelectedFunction(fn)
    setUnifiedInput('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const getSuggestedModules = () => {
    if (solidifiedModule) return [] 
    const lowerSearch = unifiedInput.toLowerCase()
    return modules
      .filter(m => m.name.toLowerCase().includes(lowerSearch))
      .slice(0, 5)
  }

  const getSuggestedFunctions = () => {
    if (!solidifiedModule) return []
    const lowerSearch = unifiedInput.toLowerCase()
    return functions
        .filter(f => f.toLowerCase().includes(lowerSearch))
        .slice(0, 5)
  }

  const suggestedModules = getSuggestedModules()
  const suggestedFunctions = getSuggestedFunctions()

  const getPlaceholder = () => {
    if (!solidifiedModule) return "Type module (e.g., openrouter)..."
    if (!solidifiedFunction) return "Type function..."
    return ""
  }

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-gradient-to-br from-black/90 to-gray-900/70 border-b-2 border-green-500/30">
        <div className="flex justify-between items-center p-3">
          <h2 className="text-green-400 text-base font-bold" style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}>⚙ inputs</h2>
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
          </div>
        </div>
      </div>

      <div className="border-2 border-gray-700/60 rounded-lg overflow-hidden mt-3 mx-3">
        <div className="p-3 bg-gray-900/80">
          <h3 className="text-green-400 text-sm font-bold mb-2" style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}>mod / fn</h3>
          <div className="flex flex-col gap-2">
            <div className="relative">
              <div className="w-full bg-gray-900/80 border-2 border-gray-700/60 px-2 py-1.5 rounded-lg focus-within:ring-2 focus-within:ring-green-500/60 focus-within:border-green-500/60 transition-all shadow-lg text-sm flex items-center gap-1 flex-wrap">
                {solidifiedModule && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-green-500/30 to-emerald-500/20 border border-green-500/50 rounded-full text-green-300 font-bold text-xs" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                    {solidifiedModule}
                  </span>
                )}
                {solidifiedModule && solidifiedFunction && (
                  <span className="text-gray-500">/</span>
                )}
                {solidifiedFunction && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-cyan-500/30 to-blue-500/20 border border-cyan-500/50 rounded-full text-cyan-300 font-bold text-xs" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                    {solidifiedFunction}
                  </span>
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={unifiedInput}
                  onChange={(e) => handleUnifiedInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder={getPlaceholder()}
                  className="flex-1 min-w-[120px] bg-transparent text-white outline-none placeholder-gray-600"
                  style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
                />
              </div>
              {showSuggestions && (suggestedModules.length > 0 || suggestedFunctions.length > 0) && (
                <div className="absolute w-full mt-1 bg-gray-900 border-2 border-green-500/60 rounded-lg shadow-xl max-h-48 overflow-y-auto" style={{ zIndex: 99999 }}>
                  {suggestedModules.map(mod => (
                    <button
                      key={mod.name}
                      onClick={() => handleModuleSelect(mod.name)}
                      className="w-full text-left px-3 py-2 hover:bg-green-500/20 text-green-300 text-sm border-b border-gray-700/40 last:border-b-0 transition-all"
                      style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
                    >
                      {mod.name}
                    </button>
                  ))}
                  {suggestedFunctions.map(fn => (
                    <button
                      key={fn}
                      onClick={() => handleFunctionSelect(fn)}
                      className="w-full text-left px-3 py-2 hover:bg-cyan-500/20 text-cyan-300 text-sm border-b border-gray-700/40 last:border-b-0 transition-all"
                      style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
                    >
                      {fn}
                    </button>
                  ))}
                </div>
              )}
            </div>
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

      {selectedFunction && schema && schema[selectedFunction] && (
        <div className="border-2 border-gray-700/60 rounded-lg overflow-hidden mt-3 mx-3">
          <div className="p-3 space-y-2 bg-gray-900/40">
            <div className="flex justify-between items-center">
              <h3 className="text-cyan-400 text-sm font-bold" style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}>parameters</h3>
              <div className="flex gap-2 items-center">
                <button
                  onClick={handleResetParams}
                  className="px-2 py-1 bg-gradient-to-r from-orange-500/20 to-orange-600/10 text-orange-400 border-2 border-orange-500/40 hover:from-orange-500/30 hover:to-orange-600/20 hover:border-orange-500/60 rounded-lg transition-all duration-200 font-bold shadow-lg text-xs"
                  style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}
                >
                  🔄 reset
                </button>
                <button
                  onClick={() => setIsParamsCollapsed(!isParamsCollapsed)}
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
