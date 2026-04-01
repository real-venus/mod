"use client";

import { useState, useRef, useEffect } from 'react'

interface ParameterInfo {
  name: string
  type?: string
  value?: any
}

interface ParameterSelectorProps {
  parameters: string[]
  selectedParameter: string
  setSelectedParameter: (param: string) => void
  schema?: Record<string, { type: string; value: any }>
}

/**
 * Parameter selector dropdown for chat input
 */
export function ParameterSelector({
  parameters,
  selectedParameter,
  setSelectedParameter,
  schema
}: ParameterSelectorProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isDropdownOpen) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, parameters.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (parameters[selectedIndex]) {
        selectParameter(parameters[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false)
    }
  }

  const selectParameter = (param: string) => {
    setSelectedParameter(param)
    setIsDropdownOpen(false)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  if (parameters.length === 0) return null

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        onKeyDown={handleKeyDown}
        className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest rounded-xl border-2 border-green-600/50 text-green-500 transition-all flex items-center gap-2"
        style={{
          fontFamily: 'IBM Plex Mono, monospace',
          backgroundColor: 'var(--bg-input)',
        }}
      >
        <span>{selectedParameter}</span>
        <span className={`text-[8px] transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {/* Dropdown Menu - Clean List - Opens Upward */}
      {isDropdownOpen && (
        <div
          className="absolute bottom-full left-0 mb-2 border-2 border-green-500/40 rounded-xl shadow-2xl z-[9999] backdrop-blur-md overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-surface)',
            minWidth: '280px',
            maxWidth: '400px'
          }}
        >
          <div className="flex flex-col max-h-96 overflow-y-auto">
            {parameters.map((param, idx) => {
              const paramInfo = schema?.[param]
              const isSelected = param === selectedParameter
              const isHighlighted = idx === selectedIndex
              const isEmpty = paramInfo?.value === '_empty'
              const showValue = paramInfo?.value && !isEmpty

              return (
                <button
                  key={param}
                  type="button"
                  onClick={() => selectParameter(param)}
                  className={`flex items-center justify-between gap-3 px-4 py-3 transition-all font-mono text-left border-b ${
                    isHighlighted || isSelected
                      ? 'bg-green-500/20 border-green-500/40'
                      : 'border-green-500/10 hover:bg-green-500/10'
                  }`}
                  style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    color: 'var(--text-primary)',
                    borderBottomColor: idx === parameters.length - 1 ? 'transparent' : undefined
                  }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {isSelected && (
                      <span className="text-green-500 text-sm flex-shrink-0">✓</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate">{param}</div>
                      {paramInfo?.type && (
                        <div className="text-[10px] mt-0.5 opacity-60">
                          {paramInfo.type}
                          {showValue && (
                            <span className="ml-2 opacity-80">
                              = {String(paramInfo.value).length > 30
                                  ? String(paramInfo.value).substring(0, 30) + '...'
                                  : String(paramInfo.value)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
