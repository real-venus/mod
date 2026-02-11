"use client";

import { useState, useRef, useMemo } from 'react'
import { text2color } from '@/utils'
import type { Module } from '../types'

interface CompactModuleSelectorProps {
  selectedModules: Module[]
  setSelectedModules: (modules: Module[]) => void
  allModules: Module[]
}

/**
 * Compact single-selection module selector with owner filtering
 * Fits inline with function selector
 */
export function CompactModuleSelector({
  selectedModules,
  setSelectedModules,
  allModules
}: CompactModuleSelectorProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [ownerFilter, setOwnerFilter] = useState<string>('all')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const selectedModule = selectedModules[0] || null

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

  // Get unique owners
  const uniqueOwners = useMemo(() => {
    const owners = new Set<string>()
    allModules.forEach(m => {
      if (m.key) owners.add(m.key)
    })
    return Array.from(owners)
  }, [allModules])

  // Filter modules based on search query and owner
  const filteredModules = useMemo(() => {
    let modules = allModules

    // Filter by owner first
    if (ownerFilter !== 'all') {
      modules = modules.filter(m => m.key === ownerFilter)
    }

    if (!searchQuery.trim()) {
      // Show all modules when no search query
      return modules
        .map(m => ({ module: m, distance: 0 }))
        .sort((a, b) => a.module.name.localeCompare(b.module.name))
    }

    // Filter by search query
    return modules
      .map(m => ({ module: m, distance: calculateDistance(m.name, searchQuery) }))
      .filter(({ distance }) => distance < 0.8)
      .sort((a, b) => a.distance - b.distance)
  }, [searchQuery, ownerFilter, allModules])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setSelectedIndex(0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, filteredModules.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredModules.length > 0 && filteredModules[selectedIndex]) {
        selectModule(filteredModules[selectedIndex].module)
      }
    } else if (e.key === 'Escape') {
      closeDropdown()
    }
  }

  const selectModule = (module: Module) => {
    setSelectedModules([module]) // Single selection
    closeDropdown()
  }

  const openDropdown = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width
      })
    }
    setIsDropdownOpen(true)
    setSearchQuery('')
    setSelectedIndex(0)
    setTimeout(() => searchInputRef.current?.focus(), 0)
  }

  const closeDropdown = () => {
    setIsDropdownOpen(false)
    setSearchQuery('')
    setSelectedIndex(0)
  }

  // Close dropdown when clicking outside
  useMemo(() => {
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

  const moduleColor = selectedModule ? text2color(selectedModule.name) : '#8b5cf6'

  return (
    <div className="relative h-full" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={isDropdownOpen ? closeDropdown : openDropdown}
        className="h-full w-full px-5 py-3 rounded-xl bg-black/80 border border-purple-500/20 hover:border-purple-500/40 text-white transition-all flex items-center justify-between backdrop-blur-sm group shadow-lg shadow-purple-900/10"
        style={{ minHeight: '52px' }}
      >
        {isDropdownOpen ? (
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            placeholder="search modules..."
            className="flex-1 bg-transparent text-white text-sm font-bold focus:outline-none placeholder-neutral-600"
            style={{
              fontFamily: 'SF Pro Display, -apple-system, sans-serif',
              letterSpacing: '-0.01em',
            }}
            autoFocus
          />
        ) : (
          <div className="flex-1 text-left flex items-center gap-2 min-w-0">
            <span className="text-sm font-bold truncate" style={{ color: moduleColor }}>
              {selectedModule ? selectedModule.name : <span className="text-neutral-600">select module...</span>}
            </span>
            {selectedModule?.cid && (
              <span className="text-[10px] font-mono text-neutral-600 flex-shrink-0">
                ({selectedModule.cid.slice(0, 6)}...{selectedModule.cid.slice(-4)})
              </span>
            )}
          </div>
        )}

        <span
          className={`text-xs text-neutral-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
        >
          ▼
        </span>
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div
          className="fixed bg-transparent rounded-xl shadow-2xl z-[9999] backdrop-blur-md overflow-hidden"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            boxShadow: '0 10px 40px rgba(139, 92, 246, 0.2)'
          }}
        >
          {/* Owner Filter */}
          {uniqueOwners.length > 1 && (
            <div className="p-2">
              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-black/30 border-none text-purple-300 text-xs font-mono px-2 py-1.5 rounded-lg focus:outline-none backdrop-blur-sm"
              >
                <option value="all">All Owners</option>
                {uniqueOwners.map(owner => (
                  <option key={owner} value={owner}>
                    {owner.slice(0, 8)}...{owner.slice(-6)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div
            className="overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-neutral-700/50 scrollbar-track-transparent hover:scrollbar-thumb-neutral-600/50"
            style={{
              maxHeight: 'calc(100vh - 260px)',
              minHeight: '100px',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(64, 64, 64, 0.5) transparent'
            }}
          >
            {filteredModules.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="text-purple-400 text-2xl mb-2">📦</div>
                <div className="text-white text-sm font-bold mb-1">
                  {searchQuery ? 'No matching modules' : 'No modules available'}
                </div>
                <div className="text-neutral-500 text-xs">
                  Total modules: {allModules.length}
                </div>
              </div>
            ) : (
              filteredModules.map(({ module, distance }, idx) => {
                // Get function count from schema
                const functionCount = module.schema && typeof module.schema === 'object'
                  ? Object.keys(module.schema).length
                  : 0

                return (
                  <button
                    key={module.name}
                    type="button"
                    onClick={() => selectModule(module)}
                    className={`w-full text-left px-4 py-3.5 text-white transition-all font-medium ${
                      idx === selectedIndex ? 'bg-purple-500/20 backdrop-blur-sm' : 'hover:bg-purple-500/10'
                    }`}
                  >
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{module.name}</span>
                        {functionCount > 0 && (
                          <span className="text-purple-400 text-xs">
                            {functionCount} function{functionCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                        {module.version && (
                          <span>v{module.version}</span>
                        )}
                        {module.key && (
                          <span>{module.key.slice(0, 6)}...{module.key.slice(-4)}</span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
