"use client";

import { useState, useRef, useMemo } from 'react'
import { text2color } from '@/utils'
import type { Module } from '../types'

interface ModuleSelectorProps {
  selectedModules: Module[]
  setSelectedModules: (modules: Module[]) => void
  allModules: Module[]
}

/**
 * Module-only selector component
 * Displays selected modules as pills, allows adding/removing modules
 */
export function ModuleSelector({
  selectedModules,
  setSelectedModules,
  allModules
}: ModuleSelectorProps) {
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Calculate fuzzy match distance
  const calculateDistance = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase()
    const s2 = str2.toLowerCase()
    if (s1 === s2) return 0
    if (s1.startsWith(s2)) return 0.05
    if (s2.startsWith(s1)) return 0.1
    if (s1.includes(s2)) return 0.2
    if (s2.includes(s1)) return 0.3

    // Levenshtein distance
    const matrix: number[][] = []
    for (let i = 0; i <= s2.length; i++) matrix[i] = [i]
    for (let j = 0; j <= s1.length; j++) matrix[0][j] = j

    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }
    return matrix[s2.length][s1.length] / Math.max(s1.length, s2.length)
  }

  // Filter modules based on input
  const filteredModules = useMemo(() => {
    if (!inputValue) return []

    // Exclude already selected modules
    const selectedNames = new Set(selectedModules.map(m => m.name))

    return allModules
      .filter(m => !selectedNames.has(m.name))
      .map(m => ({ module: m, distance: calculateDistance(m.name, inputValue) }))
      .filter(({ distance }) => distance < 0.8)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 8)
  }, [inputValue, allModules, selectedModules])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    setShowSuggestions(value.length > 0)
    setSelectedIndex(0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % filteredModules.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + filteredModules.length) % filteredModules.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      if (filteredModules.length > 0) {
        addModule(filteredModules[selectedIndex].module)
      }
    } else if (e.key === 'Escape') {
      setInputValue('')
      setShowSuggestions(false)
    }
  }

  const addModule = (module: Module) => {
    setSelectedModules([...selectedModules, module])
    setInputValue('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const removeModule = (module: Module) => {
    setSelectedModules(selectedModules.filter(m => m.name !== module.name))
    inputRef.current?.focus()
  }

  return (
    <div className="relative">
      <div className="flex gap-2 items-center bg-black border-2 border-purple-500/40 px-4 py-3 rounded-lg">
        {/* Selected module pills */}
        {selectedModules.map(module => {
          const color = text2color(module.name)
          return (
            <div
              key={module.name}
              className="flex items-center gap-2 px-3 py-1 rounded-full font-bold border-2"
              style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: '1.1rem',
                backgroundColor: `${color}30`,
                borderColor: `${color}60`,
                color: 'white'
              }}
            >
              <span>{module.name}</span>
              <button
                onClick={() => removeModule(module)}
                className="hover:text-red-400 transition-colors"
                type="button"
              >
                ✕
              </button>
            </div>
          )
        })}

        {/* Input for adding modules */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={selectedModules.length === 0 ? 'select modules...' : ''}
          className="flex-1 bg-transparent text-white focus:outline-none placeholder-gray-500 text-lg"
          style={{ fontFamily: 'IBM Plex Mono, monospace' }}
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filteredModules.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-black/95 border-2 border-purple-500/60 rounded-lg shadow-2xl z-50 backdrop-blur-md max-h-60 overflow-y-auto">
          {filteredModules.map(({ module, distance }, idx) => (
            <button
              key={module.name}
              type="button"
              onClick={() => addModule(module)}
              className={`w-full text-left px-4 py-3 text-white border-b border-purple-500/30 last:border-b-0 transition-all font-bold flex justify-between items-center ${
                idx === selectedIndex ? 'bg-purple-500/40' : 'hover:bg-purple-500/30'
              }`}
              style={{ fontFamily: 'IBM Plex Mono, monospace' }}
            >
              <div className="flex flex-col gap-1">
                <span>{module.name}</span>
                {module.key && (
                  <span className="text-purple-400 text-xs font-mono">
                    owner: {module.key.slice(0, 8)}...{module.key.slice(-6)}
                  </span>
                )}
                {module.cid && (
                  <span className="text-cyan-400 text-xs font-mono">
                    cid: {module.cid.slice(0, 12)}...{module.cid.slice(-8)}
                  </span>
                )}
              </div>
              <span className="text-xs text-cyan-400 font-mono">~{distance.toFixed(2)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
