"use client";

import { useState, useRef, useMemo, useEffect } from 'react'
import { text2color } from '@/utils'
import type { Module, ModuleSchema } from '../types'
import { userContext } from '@/context';


interface FunctionSelectorProps {
  selectedModules: Module[]
  selectedFunction: string
  setSelectedFunction: (fn: string) => void
  onFunctionChange?: () => void
  fetchedSchemas?: Map<string, ModuleSchema>
}

/**
 * Function selector component - Dropdown menu with search
 * Used within tabs to select a function from selected modules
 */
export function FunctionSelector({
  selectedModules,
  selectedFunction,
  setSelectedFunction,
  onFunctionChange,
  fetchedSchemas = new Map()
}: FunctionSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const functionColor = useMemo(() => {
    return selectedFunction ? text2color(selectedFunction) : '#8b5cf6'
  }, [selectedFunction])

  // Get all functions from selected modules
  const allFunctions = useMemo(() => {
    const functionsMap = new Map<string, { name: string; moduleName: string; owner: string }>()

    selectedModules.forEach(module => {
      if (!module.schema) return

      let schema: ModuleSchema

      // Get schema - either from fetched schemas or directly
      if (typeof module.schema === 'string') {
        const fetchedSchema = fetchedSchemas.get(module.schema)
        if (!fetchedSchema) return // Still fetching
        schema = fetchedSchema
      } else {
        schema = module.schema
      }

      // Extract function names from schema
      Object.keys(schema).forEach(fnName => {
        if (!functionsMap.has(fnName)) {
          functionsMap.set(fnName, {
            name: fnName,
            moduleName: module.name,
            owner: module.key // Get owner from module.key (matches API pattern)
          })
        }
      })
    })

    console.log('FunctionSelector - allFunctions:', Array.from(functionsMap.values()))
    return Array.from(functionsMap.values())
  }, [selectedModules, fetchedSchemas])

  // Calculate fuzzy match distance
  const calculateDistance = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase()
    const s2 = str2.toLowerCase()
    if (s1 === s2) return 0
    if (s1.startsWith(s2)) return 0.05
    if (s2.startsWith(s1)) return 0.1
    if (s1.includes(s2)) return 0.2
    if (s2.includes(s1)) return 0.3

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

  // Filter functions based on search query
  const filteredFunctions = useMemo(() => {
    if (!searchQuery.trim()) {
      // Show all functions sorted by name when no search query
      return allFunctions
        .map(fn => ({ ...fn, distance: 0 }))
        .sort((a, b) => a.name.localeCompare(b.name))
    }

    // Filter and sort by fuzzy match distance
    return allFunctions
      .map(fn => ({ ...fn, distance: calculateDistance(fn.name, searchQuery) }))
      .filter(({ distance }) => distance < 0.8)
      .sort((a, b) => a.distance - b.distance)
  }, [searchQuery, allFunctions])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setSelectedIndex(0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, filteredFunctions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredFunctions.length > 0 && filteredFunctions[selectedIndex]) {
        selectFunction(filteredFunctions[selectedIndex].name)
      }
    } else if (e.key === 'Escape') {
      closeDropdown()
    }
  }

  const selectFunction = (functionName: string) => {
    setSelectedFunction(functionName)
    closeDropdown()
    onFunctionChange?.()
  }

  const openDropdown = () => {
    setIsDropdownOpen(true)
    setSearchQuery('')
    setSelectedIndex(0)
    // Focus search input after dropdown opens
    setTimeout(() => searchInputRef.current?.focus(), 0)
  }

  const closeDropdown = () => {
    setIsDropdownOpen(false)
    setSearchQuery('')
    setSelectedIndex(0)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeDropdown()
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  // Auto-select first function if none selected
  useEffect(() => {
    if (!selectedFunction && allFunctions.length > 0) {
      setSelectedFunction(allFunctions[0].name)
    }
  }, [allFunctions, selectedFunction, setSelectedFunction])

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        type="button"
        onClick={openDropdown}
        className="w-full flex gap-2 items-center bg-black/60 border border-neutral-800 hover:border-cyan-500/50 px-3 py-2 rounded-lg transition-all"
      >
        <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider flex-shrink-0 pointer-events-none">
          Function:
        </label>

        {/* Selected function display */}
        {selectedFunction ? (
          <div
            className="flex items-center gap-2 px-3 py-1 rounded-full font-bold border-2 pointer-events-none"
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: '0.9rem',
              backgroundColor: `${functionColor}30`,
              borderColor: `${functionColor}60`,
              color: 'white'
            }}
          >
            <span>{selectedFunction}</span>
          </div>
        ) : (
          <span className="text-gray-500 text-sm flex-1 text-left" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
            select function...
          </span>
        )}

        {/* Dropdown arrow */}
        <span className="ml-auto text-neutral-500 text-xs">▼</span>
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-black/95 border-2 border-cyan-500/60 rounded-lg shadow-2xl z-50 backdrop-blur-md overflow-hidden">
          {/* Search input */}
          <div className="sticky top-0 p-3 bg-black/90 border-b border-cyan-500/30">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              placeholder="search functions..."
              className="w-full bg-neutral-900 border border-neutral-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-cyan-500/50 placeholder-gray-500"
              style={{ fontFamily: 'IBM Plex Mono, monospace' }}
            />
          </div>

          {/* Function list */}
          <div className="max-h-80 overflow-y-auto">
            {filteredFunctions.length === 0 ? (
              <div className="px-4 py-8 text-center text-neutral-500">
                {searchQuery ? 'No matching functions' : 'No functions available'}
              </div>
            ) : (
              filteredFunctions.map(({ name, moduleName, owner, distance }, idx) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => selectFunction(name)}
                  className={`w-full text-left px-4 py-3 text-white border-b border-cyan-500/30 last:border-b-0 transition-all font-bold flex justify-between items-center ${
                    idx === selectedIndex ? 'bg-cyan-500/40' : 'hover:bg-cyan-500/30'
                  }`}
                  style={{ fontFamily: 'IBM Plex Mono, monospace' }}
                >
                  <div className="flex flex-col gap-1">
                    <span>{name}</span>
                    <span className="text-cyan-400 text-xs font-mono">from: {moduleName}</span>
                    {owner && (
                      <span className="text-purple-400 text-xs font-mono">
                        owner: {owner.slice(0, 8)}...{owner.slice(-6)}
                      </span>
                    )}
                  </div>
                  {searchQuery && (
                    <span className="text-xs text-orange-400 font-mono">~{distance.toFixed(2)}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
