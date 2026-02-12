"use client";

import { useState, useRef, useEffect } from 'react'
import { text2color } from '@/utils'

interface SchemaParamsPanelProps {
  selectedFunction: string
  schema: any
  params: Record<string, any>
  handleParamChange: (key: string, value: string) => void
  handleResetParams: () => void
  numColumns?: number
}

export function SchemaParamsPanel({
  selectedFunction,
  schema,
  params,
  handleParamChange,
  handleResetParams,
  numColumns = 2
}: SchemaParamsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(numColumns)
  const [customParams, setCustomParams] = useState<Record<string, string>>({})
  const [newParamKey, setNewParamKey] = useState('')
  const [newParamValue, setNewParamValue] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  const panelColor = text2color(selectedFunction || 'params')

  useEffect(() => {
    const checkWidth = () => {
      if (panelRef.current) {
        const width = panelRef.current.offsetWidth
        if (width < 600) setColumns(1)
        else setColumns(numColumns)
      }
    }
    checkWidth()
    window.addEventListener('resize', checkWidth)
    return () => window.removeEventListener('resize', checkWidth)
  }, [numColumns])

  const toggleColumns = () => {
    setColumns(prev => prev === 1 ? 2 : 1)
  }

  const handleAddCustomParam = () => {
    if (newParamKey.trim() && hasKwargs) {
      const updatedCustomParams = { ...customParams, [newParamKey]: newParamValue }
      setCustomParams(updatedCustomParams)
      handleParamChange(newParamKey, newParamValue)
      setNewParamKey('')
      setNewParamValue('')
    }
  }

  const handleRemoveCustomParam = (key: string) => {
    const updatedCustomParams = { ...customParams }
    delete updatedCustomParams[key]
    setCustomParams(updatedCustomParams)
    handleParamChange(key, '')
  }

  if (!selectedFunction || !schema || !schema[selectedFunction] || !schema[selectedFunction].input) {
    return null
  }

  const paramEntries = Object.entries(schema[selectedFunction].input || {})
    .filter(([key]) => key !== 'self' && key !== 'cls' && key !== 'kwargs')

  const hasKwargs = Object.keys(schema[selectedFunction].input || {}).includes('kwargs')
  
  const getGridCols = () => {
    return columns === 1 ? 'grid-cols-1' : 'grid-cols-2'
  }

  const shouldCollapse = paramEntries.length > 6

  return (
    <div
      ref={panelRef}
      className="overflow-hidden backdrop-blur-sm transition-all rounded-lg border-2 border-purple-500/60 bg-black/80"
      style={{ fontFamily: 'IBM Plex Mono, monospace' }}
    >
      <div>
        {/* Compact header */}
        <div className="flex justify-between items-center gap-2 px-5 py-4 border-b border-purple-500/30">
          <div className="text-sm font-bold text-white uppercase tracking-wide">
            {paramEntries.length} parameter{paramEntries.length !== 1 ? 's' : ''}
          </div>
          <div className="flex gap-2">
            {shouldCollapse && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsExpanded(!isExpanded)
                }}
                className="px-2 py-1 rounded transition-all text-xs font-bold bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white"
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleColumns()
              }}
              className="px-2 py-1 rounded transition-all text-xs font-bold bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white"
              title="Toggle columns"
            >
              = {columns}col
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleResetParams()
              }}
              className="px-2 py-1 rounded transition-all text-xs font-bold bg-neutral-800 text-cyan-400 hover:bg-neutral-700"
            >
              reset
            </button>
          </div>
        </div>
        <div
          className="overflow-y-auto px-5 pb-4 scrollbar-thin scrollbar-thumb-neutral-700/50 scrollbar-track-transparent"
          style={{
            maxHeight: shouldCollapse && !isExpanded ? '300px' : '600px',
            transition: 'max-height 0.3s ease',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(64, 64, 64, 0.5) transparent'
          }}
        >
          <div className={`grid gap-4 ${getGridCols()}`}>
            {paramEntries.map(([key, value]: [string, any]) => (
              <div key={key} className="flex flex-col gap-2">
                <label className="text-sm font-bold text-white">
                  {key} <span className="text-neutral-500 text-xs">({value.type})</span>
                </label>
                <input
                  type="text"
                  value={params[key] ?? ''}
                  onChange={(e) => handleParamChange(key, e.target.value)}
                  placeholder={value.value !== '_empty' ? String(value.value) : 'enter value...'}
                  className="border-2 text-neutral-300 px-4 py-3 rounded-xl focus:outline-none focus:border-purple-500 text-sm bg-neutral-900 border-neutral-700 placeholder-neutral-600 hover:border-neutral-600 transition-colors font-mono"
                />
              </div>
            ))}
            {Object.entries(customParams).map(([key, value]) => (
              <div key={key} className="flex flex-col gap-2">
                <label className="text-sm font-bold text-white flex justify-between items-center">
                  <span>{key} <span className="text-neutral-500 text-xs">(custom)</span></span>
                  <button
                    onClick={() => handleRemoveCustomParam(key)}
                    className="text-red-500 hover:text-red-400 text-sm transition-colors"
                  >
                    ✕
                  </button>
                </label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => {
                    const updated = { ...customParams, [key]: e.target.value }
                    setCustomParams(updated)
                    handleParamChange(key, e.target.value)
                  }}
                  placeholder="enter value..."
                  className="border-2 text-neutral-300 px-4 py-3 rounded-xl focus:outline-none focus:border-purple-500 text-sm bg-neutral-900 border-neutral-700 placeholder-neutral-600 hover:border-neutral-600 transition-colors font-mono"
                />
              </div>
            ))}
          </div>
          {hasKwargs && (
            <div className="mt-4 p-4 border-2 rounded-lg bg-neutral-900 border-purple-500/40">
              <h4 className="text-xs font-bold mb-3 text-neutral-300 uppercase tracking-wider">Add Custom Parameter</h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newParamKey}
                  onChange={(e) => setNewParamKey(e.target.value)}
                  placeholder="key"
                  className="flex-1 border-2 text-neutral-300 px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500 text-sm bg-neutral-900 border-neutral-700 placeholder-neutral-600 hover:border-neutral-600 transition-colors font-mono"
                />
                <input
                  type="text"
                  value={newParamValue}
                  onChange={(e) => setNewParamValue(e.target.value)}
                  placeholder="value"
                  className="flex-1 border-2 text-neutral-300 px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500 text-sm bg-neutral-900 border-neutral-700 placeholder-neutral-600 hover:border-neutral-600 transition-colors font-mono"
                />
                <button
                  onClick={handleAddCustomParam}
                  className="px-3 py-2 rounded-lg transition-all text-xs font-bold bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white"
                >
                  add
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
