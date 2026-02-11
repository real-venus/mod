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
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

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
      setSelectedIndex(prev => {
        const newIndex = Math.min(prev + 1, filteredFunctions.length - 1)
        // Scroll to the selected item
        setTimeout(() => {
          itemRefs.current.get(newIndex)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }, 0)
        return newIndex
      })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => {
        const newIndex = Math.max(prev - 1, 0)
        // Scroll to the selected item
        setTimeout(() => {
          itemRefs.current.get(newIndex)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }, 0)
        return newIndex
      })
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
    itemRefs.current.clear()
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
    <div className="relative h-full" ref={dropdownRef}>
      {/* Selection Bar with Integrated Search */}
      <button
        type="button"
        onClick={isDropdownOpen ? closeDropdown : openDropdown}
        className="h-full w-full px-6 py-4 rounded-2xl bg-black/80 border-2 border-white/10 hover:border-purple-500/50 text-white transition-all flex items-center justify-between backdrop-blur-sm group"
        style={{ minHeight: '64px' }}
      >
        {isDropdownOpen ? (
          // Search input when dropdown is open
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            placeholder="search..."
            className="flex-1 bg-transparent text-white text-lg font-bold focus:outline-none placeholder-neutral-600"
            style={{
              fontFamily: 'SF Pro Display, -apple-system, sans-serif',
              letterSpacing: '-0.01em',
            }}
            autoFocus
          />
        ) : (
          // Selected function display when dropdown is closed
          <span className="flex-1 text-left truncate text-lg font-bold">
            {selectedFunction || <span className="text-neutral-600">select...</span>}
          </span>
        )}

        {/* Dropdown arrow */}
        <span
          className={`text-sm text-neutral-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
        >
          ▼
        </span>
      </button>

      {/* Dropdown Menu - Functions List Only */}
      {isDropdownOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-transparent rounded-xl shadow-2xl z-[9999] backdrop-blur-md overflow-hidden">
          {/* Function list - Scrollable */}
          <div
            ref={listRef}
            className="overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-neutral-700/50 scrollbar-track-transparent hover:scrollbar-thumb-neutral-600/50"
            style={{
              maxHeight: 'calc(100vh - 200px)',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(64, 64, 64, 0.5) transparent'
            }}
          >
            {filteredFunctions.length === 0 ? (
              <div className="px-4 py-6 text-center text-neutral-500 text-sm">
                {searchQuery ? 'No matching functions' : 'No functions available'}
              </div>
            ) : (
              filteredFunctions.map(({ name, moduleName, owner, distance }, idx) => (
                <button
                  key={name}
                  ref={(el) => {
                    if (el) itemRefs.current.set(idx, el)
                    else itemRefs.current.delete(idx)
                  }}
                  type="button"
                  onClick={() => selectFunction(name)}
                  className={`w-full text-left px-4 py-3 text-white transition-all font-medium flex justify-between items-center ${
                    idx === selectedIndex ? 'bg-purple-500/20 backdrop-blur-sm' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold">{name}</span>
                    <span className="text-neutral-500 text-xs">from: {moduleName}</span>
                    {owner && (
                      <span className="text-neutral-600 text-[10px]">
                        {owner.slice(0, 8)}...{owner.slice(-6)}
                      </span>
                    )}
                  </div>
                  {searchQuery && distance > 0 && (
                    <span className="text-xs text-neutral-600 font-medium">~{distance.toFixed(2)}</span>
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
