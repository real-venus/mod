'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
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
  const [inputValue, setInputValue] = useState('')
  const [showModuleSuggestions, setShowModuleSuggestions] = useState(false)
  const [showFunctionSuggestions, setShowFunctionSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const functionColor = useMemo(() => {
    return selectedFunction ? text2color(selectedFunction) : '#8b5cf6'
  }, [selectedFunction])

  const moduleColor = useMemo(() => {
    return selectedModule ? text2color(selectedModule) : '#06b6d4'
  }, [selectedModule])

  // Calculate semantic distance (simple string similarity for now)
  const calculateDistance = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase()
    const s2 = str2.toLowerCase()
    if (s1.includes(s2) || s2.includes(s1)) return 0.1
    const commonChars = s1.split('').filter(c => s2.includes(c)).length
    return 1 - (commonChars / Math.max(s1.length, s2.length))
  }

  const filteredModules = useMemo(() => {
    if (!inputValue || inputValue.includes('/')) return []
    return modules
      .map(m => ({
        ...m,
        distance: calculateDistance(m.name, inputValue)
      }))
      .filter(m => m.name.toLowerCase().includes(inputValue.toLowerCase()))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5)
  }, [inputValue, modules])

  const filteredFunctions = useMemo(() => {
    if (!inputValue.includes('/')) return []
    const fnPart = inputValue.split('/')[1] || ''
    return functions
      .map(f => ({
        name: f,
        distance: calculateDistance(f, fnPart)
      }))
      .filter(f => f.name.toLowerCase().includes(fnPart.toLowerCase()))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5)
  }, [inputValue, functions])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)

    if (value.includes('/')) {
      const [mod, fn] = value.split('/')
      const trimmedMod = mod.trim()
      const trimmedFn = fn?.trim() || ''

      setShowModuleSuggestions(false)
      setShowFunctionSuggestions(trimmedFn.length > 0)

      const matchedModule = modules.find(m => m.name.toLowerCase() === trimmedMod.toLowerCase())
      if (matchedModule) {
        setSelectedModule(matchedModule.name)
        
        if (trimmedFn) {
          const matchedFunction = functions.find(f => f.toLowerCase() === trimmedFn.toLowerCase())
          if (matchedFunction) {
            setSelectedFunction(matchedFunction)
            setInputValue('')
            setShowFunctionSuggestions(false)
            if (onEnterPress) {
              setTimeout(() => onEnterPress(), 100)
            }
          }
        }
      }
    } else {
      setShowModuleSuggestions(value.length > 0)
      setShowFunctionSuggestions(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (inputValue.includes('/')) {
        const [mod, fn] = inputValue.split('/')
        const trimmedMod = mod.trim()
        const trimmedFn = fn?.trim() || ''

        const matchedModule = modules.find(m => m.name.toLowerCase() === trimmedMod.toLowerCase())
        if (matchedModule && trimmedFn) {
          const matchedFunction = functions.find(f => f.toLowerCase() === trimmedFn.toLowerCase())
          if (matchedFunction) {
            setSelectedModule(matchedModule.name)
            setSelectedFunction(matchedFunction)
            setInputValue('')
            setShowFunctionSuggestions(false)
            if (onEnterPress) {
              setTimeout(() => onEnterPress(), 100)
            }
          }
        }
      }
    } else if (e.key === 'Escape') {
      setInputValue('')
      setShowModuleSuggestions(false)
      setShowFunctionSuggestions(false)
    }
  }

  const handleRemoveModule = () => {
    setSelectedModule('')
    setSelectedFunction('')
    inputRef.current?.focus()
  }

  const handleRemoveFunction = () => {
    setSelectedFunction('')
    inputRef.current?.focus()
  }

  const selectModule = (moduleName: string) => {
    setInputValue(moduleName + '/')
    setSelectedModule(moduleName)
    setShowModuleSuggestions(false)
    setShowFunctionSuggestions(true)
    inputRef.current?.focus()
  }

  const selectFunction = (functionName: string) => {
    setSelectedFunction(functionName)
    setInputValue('')
    setShowFunctionSuggestions(false)
    if (onEnterPress) {
      setTimeout(() => onEnterPress(), 100)
    }
  }

  return (
    <div className="flex gap-3 items-center w-full relative">
      <div className="flex-1 flex gap-2 items-center bg-black border-2 border-purple-500/40 px-4 py-3 rounded-lg relative">
        {selectedModule && (
          <div 
            className="flex items-center gap-2 px-3 py-1 rounded-full font-bold"
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: '1.1rem',
              backgroundColor: `${moduleColor}30`,
              borderColor: `${moduleColor}60`,
              border: '2px solid',
              color: 'white'
            }}
          >
            <span>{selectedModule}</span>
            <button
              onClick={handleRemoveModule}
              className="hover:text-red-400 transition-colors"
              type="button"
            >
              ✕
            </button>
          </div>
        )}
        
        {selectedFunction && (
          <div 
            className="flex items-center gap-2 px-3 py-1 rounded-full font-bold"
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: '1.1rem',
              backgroundColor: `${functionColor}30`,
              borderColor: `${functionColor}60`,
              border: '2px solid',
              color: 'white'
            }}
          >
            <span>/{selectedFunction}</span>
            <button
              onClick={handleRemoveFunction}
              className="hover:text-red-400 transition-colors"
              type="button"
            >
              ✕
            </button>
          </div>
        )}

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="module/function"
          className="flex-1 bg-transparent text-white focus:outline-none placeholder-gray-500 text-lg"
          style={{ fontFamily: 'IBM Plex Mono, monospace' }}
        />

        {showModuleSuggestions && filteredModules.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-black/95 border-2 border-purple-500/60 rounded-lg shadow-2xl z-50 backdrop-blur-md max-h-60 overflow-y-auto">
            {filteredModules.map(mod => (
              <button
                key={mod.name}
                type="button"
                onClick={() => selectModule(mod.name)}
                className="w-full text-left px-4 py-3 hover:bg-purple-500/30 text-white border-b border-purple-500/30 last:border-b-0 transition-all font-bold flex justify-between items-center"
                style={{ fontFamily: 'IBM Plex Mono, monospace' }}
              >
                <span>
                  {mod.name}
                  {mod.owner && <span className="text-purple-400 text-sm ml-2">({mod.owner})</span>}
                </span>
                <span className="text-xs text-cyan-400 font-mono">~{mod.distance.toFixed(2)}</span>
              </button>
            ))}
          </div>
        )}

        {showFunctionSuggestions && filteredFunctions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-black/95 border-2 border-cyan-500/60 rounded-lg shadow-2xl z-50 backdrop-blur-md max-h-60 overflow-y-auto">
            {filteredFunctions.map(fn => (
              <button
                key={fn.name}
                type="button"
                onClick={() => selectFunction(fn.name)}
                className="w-full text-left px-4 py-3 hover:bg-cyan-500/30 text-white border-b border-cyan-500/30 last:border-b-0 transition-all font-bold flex justify-between items-center"
                style={{ fontFamily: 'IBM Plex Mono, monospace' }}
              >
                <span>/{fn.name}</span>
                <span className="text-xs text-orange-400 font-mono">~{fn.distance.toFixed(2)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
