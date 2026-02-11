"use client";

import { useState, useRef, useEffect } from 'react'

interface ParameterSelectorProps {
  parameters: string[]
  selectedParameter: string
  setSelectedParameter: (param: string) => void
}

/**
 * Parameter selector dropdown for chat input
 */
export function ParameterSelector({
  parameters,
  selectedParameter,
  setSelectedParameter
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
        className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest rounded-xl border-2 border-green-600/50 bg-green-950/40 text-green-400 hover:bg-green-900/60 transition-all flex items-center gap-2"
        style={{
          fontFamily: 'IBM Plex Mono, monospace',
        }}
      >
        <span>{selectedParameter}</span>
        <span className={`text-[8px] transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {/* Dropdown Menu - Grid Layout - Opens Upward */}
      {isDropdownOpen && (
        <div className="absolute bottom-full left-0 mb-2 bg-black/95 border-2 border-green-500/40 rounded-xl shadow-2xl z-[9999] backdrop-blur-md overflow-hidden p-2">
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              maxWidth: '500px'
            }}
          >
            {parameters.map((param, idx) => (
              <button
                key={param}
                type="button"
                onClick={() => selectParameter(param)}
                className={`aspect-square flex flex-col items-center justify-center gap-2 px-4 py-3 text-white transition-all font-bold rounded-lg border-2 ${
                  idx === selectedIndex
                    ? 'bg-green-500/20 border-green-500/60 backdrop-blur-sm'
                    : 'bg-black/60 border-green-500/20 hover:bg-green-500/10 hover:border-green-500/40'
                }`}
                style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                }}
              >
                <span className="text-2xl">📝</span>
                <span className="text-xs uppercase tracking-wider">{param}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
