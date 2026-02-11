"use client";

import { useState, useRef, useMemo } from 'react'
import { text2color, shorten, colorWithOpacity } from '@/utils'
import { QrCodeIcon, KeyIcon, CubeIcon } from '@heroicons/react/24/outline'
import { CopyButton } from '@/ui/CopyButton'
import { QRCode } from '@/ui/QRCode'
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
      .sort((a, b) => {
        // First sort by distance (relevance)
        if (Math.abs(a.distance - b.distance) > 0.01) {
          return a.distance - b.distance
        }
        // Then by date (most recent first)
        const timeA = a.module.updated || a.module.created || 0
        const timeB = b.module.updated || b.module.created || 0
        return timeB - timeA
      })
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
    // Limit to one module - replace existing
    setSelectedModules([module])
    setInputValue('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const removeModule = (module: Module) => {
    setSelectedModules([])
    setInputValue('')
    inputRef.current?.focus()
  }

  const [qrPopupModule, setQrPopupModule] = useState<string | null>(null)

  // Sort modules by most recent (updated or created timestamp)
  const sortedModules = useMemo(() => {
    return [...selectedModules].sort((a, b) => {
      const timeA = a.updated || a.created || 0
      const timeB = b.updated || b.created || 0
      return timeB - timeA // Most recent first
    })
  }, [selectedModules])

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return ''
    const now = Date.now()
    const diff = now - timestamp * 1000
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d`
    if (hours > 0) return `${hours}h`
    if (minutes > 0) return `${minutes}m`
    return `${seconds}s`
  }

  const copyCid = (cid: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(cid)
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-3 bg-black border-2 border-purple-500/40 px-5 py-4 rounded-xl">
        {/* Selected module - single line compact */}
        {sortedModules.length > 0 ? (
          sortedModules.map(module => {
            const color = text2color(module.name)
            const keyColor = text2color(module.key)
            const cidColor = text2color(module.cid || '')
            const timeAgo = formatTime(module.updated || module.created)

            return (
              <div
                key={module.name}
                className="relative flex items-center gap-3 border-2 rounded-xl font-mono transition-all backdrop-blur-sm overflow-visible px-5 py-3 shadow-lg hover:shadow-xl group"
                style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  backgroundColor: colorWithOpacity(color, 0.12),
                  borderColor: color,
                  boxShadow: `0 0 20px ${colorWithOpacity(color, 0.15)}`,
                }}
              >
                {/* Module Name */}
                <code className="text-lg font-black tracking-wide" style={{ color: color }}>
                  {module.name}
                </code>

                {/* Owner Key - Icon with hover effect */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigator.clipboard.writeText(module.key)
                  }}
                  className="flex items-center justify-center bg-gradient-to-r from-black/70 to-black/50 rounded-lg p-2.5 hover:from-black/90 hover:to-black/70 transition-all cursor-pointer hover:scale-110 border border-white/10 hover:border-white/20 shadow-md"
                  title={`Copy Key: ${module.key}`}
                >
                  <KeyIcon className="h-5 w-5 transition-transform group-hover:rotate-12" style={{ color: keyColor }} />
                </button>

                {/* CID - Icon with hover effect */}
                {module.cid && (
                  <button
                    onClick={(e) => copyCid(module.cid!, e)}
                    className="flex items-center justify-center bg-gradient-to-r from-black/70 to-black/50 rounded-lg p-2.5 hover:from-black/90 hover:to-black/70 transition-all cursor-pointer hover:scale-110 border border-white/10 hover:border-white/20 shadow-md"
                    title={`Copy CID: ${module.cid}`}
                  >
                    <CubeIcon className="h-5 w-5 transition-transform group-hover:rotate-12" style={{ color: cidColor }} />
                  </button>
                )}

                {/* QR Code - Clickable with better styling */}
                {module.cid && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setQrPopupModule(qrPopupModule === module.name ? null : module.name)
                    }}
                    className="flex-shrink-0 p-2.5 rounded-lg bg-black/50 hover:bg-black/70 transition-all hover:scale-110 border border-white/10 hover:border-white/20 shadow-md"
                    title="Show QR Code"
                  >
                    <QrCodeIcon className="h-5 w-5 cursor-pointer transition-transform" style={{ color: cidColor }} />
                  </button>
                )}

                {/* Time with better styling */}
                {timeAgo && (
                  <span className="text-sm font-bold text-neutral-400 font-mono px-3 py-1.5 bg-black/40 rounded-lg border border-white/10">
                    {timeAgo}
                  </span>
                )}

                {/* Remove Button with better styling */}
                <button
                  onClick={() => removeModule(module)}
                  className="hover:text-red-400 hover:bg-red-500/10 transition-all text-white/70 text-xl px-2.5 py-1 rounded-lg hover:scale-110 border border-transparent hover:border-red-500/30"
                  type="button"
                >
                  ✕
                </button>

                {/* QR Code Popup */}
                {qrPopupModule === module.name && module.cid && (
                  <div
                    className="absolute top-full left-0 mt-2 p-4 bg-black/98 rounded-xl border-2 z-[9999] shadow-2xl"
                    style={{ borderColor: cidColor }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="text-xs font-mono text-neutral-400">CID: {shorten(module.cid, 6, 6)}</div>
                      <QRCode value={module.cid} size={150} color={cidColor} />
                    </div>
                  </div>
                )}
              </div>
            )
          })
        ) : (
          /* Input for selecting module - only shown when no module selected */
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="select module..."
            className="flex-1 bg-transparent text-white focus:outline-none placeholder-gray-500 text-lg"
            style={{ fontFamily: 'IBM Plex Mono, monospace' }}
          />
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filteredModules.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-black/95 border-2 border-purple-500/60 rounded-lg shadow-2xl z-[9999] backdrop-blur-md max-h-60 overflow-y-auto">
          {filteredModules.map(({ module, distance }, idx) => {
            const timeAgo = formatTime(module.updated || module.created)
            const timestamp = module.updated || module.created
            const date = timestamp ? new Date(timestamp * 1000).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: new Date(timestamp * 1000).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
            }) : ''

            return (
              <button
                key={`${module.name}-${module.key}`}
                type="button"
                onClick={() => addModule(module)}
                className={`w-full text-left px-4 py-3 text-white border-b border-purple-500/30 last:border-b-0 transition-all font-bold flex justify-between items-start ${
                  idx === selectedIndex ? 'bg-purple-500/40' : 'hover:bg-purple-500/30'
                }`}
                style={{ fontFamily: 'IBM Plex Mono, monospace' }}
              >
                <div className="flex flex-col gap-1 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-base">{module.name}</span>
                    {date && (
                      <span className="text-[10px] text-neutral-500 font-mono whitespace-nowrap">
                        {date} ({timeAgo})
                      </span>
                    )}
                  </div>
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
                <span className="text-xs text-cyan-400 font-mono ml-2 flex-shrink-0">~{distance.toFixed(2)}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
