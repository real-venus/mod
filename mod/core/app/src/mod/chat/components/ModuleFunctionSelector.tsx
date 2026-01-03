'use client'

import { useState, useRef, useMemo } from 'react'
import { text2color } from '@/mod/utils'

interface ModuleFunctionSelectorProps {
  selectedModule: string
  setSelectedModule: (value: string) => void
  selectedFunction: string
  setSelectedFunction: (value: string) => void
  modules: any[]
  functions: string[]
  onEnterPress?: () => void
}


export function ModuleFunctionSelector({
  selectedModule,
  setSelectedModule,
  selectedFunction,
  setSelectedFunction,
  modules,
  functions,
  onEnterPress
}: ModuleFunctionSelectorProps) {
  const [unifiedInput, setUnifiedInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [solidifiedModule, setSolidifiedModule] = useState('api')
  const [solidifiedFunction, setSolidifiedFunction] = useState('edit')
  const inputRef = useRef<HTMLInputElement>(null)

  const moduleColor = useMemo(() => {
    return solidifiedModule ? text2color(solidifiedModule) : '#8b5cf6'
  }, [solidifiedModule])

  const functionColor = useMemo(() => {
    return solidifiedFunction ? text2color(solidifiedFunction) : '#8b5cf6'
  }, [solidifiedFunction])

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
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const inlineSuggestion = getInlineSuggestion
      if (inlineSuggestion) {
        const fullSuggestion = unifiedInput + inlineSuggestion
        if (!solidifiedModule) {
          handleModuleSelect(fullSuggestion)
        } else if (!solidifiedFunction) {
          handleFunctionSelect(fullSuggestion)
        }
      } else if (suggestedModules.length > 0 && !solidifiedModule) {
        handleModuleSelect(suggestedModules[0].name)
      } else if (suggestedFunctions.length > 0 && solidifiedModule && !solidifiedFunction) {
        handleFunctionSelect(suggestedFunctions[0])
      } else if (solidifiedModule && solidifiedFunction) {
        setShowSuggestions(false)
        if (e.key === 'Enter' && onEnterPress) {
          onEnterPress()
        }
      }
    } else if (e.key === 'Backspace' && unifiedInput === '') {
      if (solidifiedFunction) {
        setSolidifiedFunction('')
        setSelectedFunction('')
        e.preventDefault()
      } else if (solidifiedModule) {
        setSolidifiedModule('')
        setSelectedModule('')
        setSolidifiedFunction('')
        setSelectedFunction('')
        e.preventDefault()
      }
    } else if (e.key === 'Delete' && unifiedInput === '') {
      if (solidifiedFunction) {
        setSolidifiedFunction('')
        setSelectedFunction('')
        e.preventDefault()
      } else if (solidifiedModule) {
        setSolidifiedModule('')
        setSelectedModule('')
        setSolidifiedFunction('')
        setSelectedFunction('')
        e.preventDefault()
      }
    }
  }

  const handleModuleSelect = (modName: string) => {
    setSolidifiedModule(modName)
    setSelectedModule(modName)
    setSolidifiedFunction('forward')
    setSelectedFunction('forward')
    setUnifiedInput('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const handleFunctionSelect = (fn: string) => {
    setSolidifiedFunction(fn)
    setSelectedFunction(fn)
    setUnifiedInput('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const handleDeleteModule = () => {
    setSolidifiedModule('')
    setSelectedModule('')
    setSolidifiedFunction('')
    setSelectedFunction('')
    setUnifiedInput('')
    inputRef.current?.focus()
  }

  const handleDeleteFunction = () => {
    setSolidifiedFunction('')
    setSelectedFunction('')
    setUnifiedInput('')
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

  const getInlineSuggestion = useMemo(() => {
    if (!unifiedInput) return ''
    const lowerInput = unifiedInput.toLowerCase()
    
    if (!solidifiedModule && suggestedModules.length > 0) {
      const topMatch = suggestedModules[0].name
      if (topMatch.toLowerCase().startsWith(lowerInput)) {
        return topMatch.slice(unifiedInput.length)
      }
    }
    
    if (solidifiedModule && !solidifiedFunction && suggestedFunctions.length > 0) {
      const topMatch = suggestedFunctions[0]
      if (topMatch.toLowerCase().startsWith(lowerInput)) {
        return topMatch.slice(unifiedInput.length)
      }
    }
    
    return ''
  }, [unifiedInput, solidifiedModule, solidifiedFunction, suggestedModules, suggestedFunctions])

    return (
            <div className="relative mx-3 mt-1">
              <div className="w-full bg-black border-2 border-gray-700/60 px-3 py-2.5 rounded-lg focus-within:ring-2 focus-within:ring-white/60 focus-within:border-white/60 transition-all shadow-lg text-base flex items-center gap-2 flex-wrap">
                {solidifiedModule && (
                  <span 
                    className="inline-flex items-center gap-1 px-3 py-1 border-2 rounded-full text-white font-bold text-lg shadow-lg" 
                    style={{ 
                      fontFamily: 'IBM Plex Mono, monospace',
                      backgroundColor: `${moduleColor}30`,
                      borderColor: moduleColor,
                      boxShadow: `0 0 10px ${moduleColor}40`,
                      fontSize: '1.125rem'
                    }}
                  >
                    {solidifiedModule}
                    <button
                      onClick={handleDeleteModule}
                      className="ml-1 text-red-400 hover:text-red-300 font-bold text-xs"
                      title="Delete module"
                    >
                      ✕
                    </button>
                  </span>
                )}
                {solidifiedModule && solidifiedFunction && (
                  <span className="text-gray-500 text-lg">/</span>
                )}
                {solidifiedFunction && (
                  <span 
                    className="inline-flex items-center gap-1 px-3 py-1 border-2 rounded-full text-white font-bold text-lg shadow-lg" 
                    style={{ 
                      fontFamily: 'IBM Plex Mono, monospace',
                      backgroundColor: `${functionColor}30`,
                      borderColor: functionColor,
                      boxShadow: `0 0 10px ${functionColor}40`,
                      fontSize: '1.125rem'
                    }}
                  >
                    {solidifiedFunction}
                    <button
                      onClick={handleDeleteFunction}
                      className="ml-1 text-red-400 hover:text-red-300 font-bold text-xs"
                      title="Delete function"
                    >
                      ✕
                    </button>
                  </span>
                )}
                <div className="relative flex-1 min-w-[150px]">
                  <input
                    ref={inputRef}
                    type="text"
                    value={unifiedInput}
                    onChange={(e) => handleUnifiedInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    placeholder={getPlaceholder()}
                    className="w-full bg-transparent text-white outline-none placeholder-gray-600 text-base"
                    style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
                  />
                  {getInlineSuggestion && (
                    <div className="absolute top-0 left-0 pointer-events-none text-base" style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>
                      <span className="invisible">{unifiedInput}</span>
                      <span className="text-gray-500/50">{getInlineSuggestion}</span>
                    </div>
                  )}
                </div>
              </div>
              {showSuggestions && (suggestedModules.length > 0 || suggestedFunctions.length > 0) && (
                <div className="absolute w-full mt-1 bg-gray-900 border-2 border-white/60 rounded-lg shadow-xl max-h-48 overflow-y-auto" style={{ zIndex: 99999 }}>
                  {suggestedModules.map(mod => {
                    const modColor = text2color(mod.name)
                    return (
                      <button
                        key={mod.name}
                        onClick={() => handleModuleSelect(mod.name)}
                        className="w-full text-left px-4 py-2.5 hover:bg-white/20 text-white text-base last:border-b-0 transition-all border-l-4"
                        style={{ 
                          fontFamily: 'IBM Plex Mono, Courier New, monospace',
                          borderLeftColor: modColor
                        }}
                      >
                        {mod.name}
                      </button>
                    )
                  })}
                  {suggestedFunctions.map(fn => {
                    const fnColor = text2color(fn)
                    return (
                      <button
                        key={fn}
                        onClick={() => handleFunctionSelect(fn)}
                        className="w-full text-left px-4 py-2.5 hover:bg-white/20 text-white text-base last:border-b-0 transition-all border-l-4"
                        style={{ 
                          fontFamily: 'IBM Plex Mono, Courier New, monospace',
                          borderLeftColor: fnColor
                        }}
                      >
                        {fn}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
    )
  }
  
