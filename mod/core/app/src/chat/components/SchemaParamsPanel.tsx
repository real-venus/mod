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

  if (!selectedFunction || !schema || !schema[selectedFunction]) {
    return null
  }

  const paramEntries = Object.entries(schema[selectedFunction].input)
    .filter(([key]) => key !== 'self' && key !== 'cls' && key !== 'kwargs')
  
  const hasKwargs = Object.keys(schema[selectedFunction].input).includes('kwargs')
  
  const getGridCols = () => {
    return columns === 1 ? 'grid-cols-1' : 'grid-cols-2'
  }

  const shouldCollapse = paramEntries.length > 6

  return (
    <div
      ref={panelRef}
      className="overflow-hidden backdrop-blur-sm transition-all rounded-2xl border border-neutral-800/30 bg-neutral-950/40"
    >
      <div>
        {/* Compact header */}
        <div className="flex justify-between items-center gap-2 px-4 py-3 border-b border-neutral-800/20">
          <div className="text-sm font-semibold text-neutral-400" style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif', letterSpacing: '-0.01em' }}>
            {paramEntries.length} parameter{paramEntries.length !== 1 ? 's' : ''}
          </div>
          <div className="flex gap-2">
            {shouldCollapse && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsExpanded(!isExpanded)
                }}
                className="px-2.5 py-1.5 rounded-lg transition-all text-sm font-medium bg-neutral-800/30 text-neutral-400 hover:bg-neutral-800/50 hover:text-white"
                style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif', letterSpacing: '-0.01em' }}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleColumns()
              }}
              className="px-2.5 py-1.5 rounded-lg transition-all text-sm font-medium bg-neutral-800/30 text-neutral-400 hover:bg-neutral-800/50 hover:text-white"
              style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif', letterSpacing: '-0.01em' }}
              title="Toggle columns"
            >
              {columns === 1 ? '=' : '≡'} {columns}col
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleResetParams()
              }}
              className="px-2.5 py-1.5 rounded-lg transition-all text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20"
              style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif', letterSpacing: '-0.01em' }}
            >
              🔄 reset
            </button>
          </div>
        </div>
        <div
          className="overflow-y-auto px-4 pb-4 scrollbar-thin scrollbar-thumb-neutral-700/50 scrollbar-track-transparent"
          style={{
            maxHeight: shouldCollapse && !isExpanded ? '300px' : '600px',
            transition: 'max-height 0.3s ease',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(64, 64, 64, 0.5) transparent'
          }}
        >
          <div className={`grid gap-3 ${getGridCols()}`}>
            {paramEntries.map(([key, value]: [string, any]) => (
              <div key={key} className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-neutral-300" style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif', letterSpacing: '-0.01em' }}>
                  {key} <span className="text-neutral-500 text-xs">({value.type})</span>
                </label>
                <input
                  type="text"
                  value={params[key] ?? ''}
                  onChange={(e) => handleParamChange(key, e.target.value)}
                  placeholder={value.value !== '_empty' ? String(value.value) : 'enter value...'}
                  className="border text-white px-3 py-3 rounded-xl focus:outline-none focus:border-neutral-600/80 text-base bg-neutral-900/60 border-neutral-800/30 placeholder-neutral-600 hover:border-neutral-700/50 transition-colors"
                  style={{
                    fontFamily: 'SF Mono, monospace'
                  }}
                />
              </div>
            ))}
            {Object.entries(customParams).map(([key, value]) => (
              <div key={key} className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-neutral-300 flex justify-between items-center" style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif', letterSpacing: '-0.01em' }}>
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
                  className="border text-white px-3 py-3 rounded-xl focus:outline-none focus:border-neutral-600/80 text-base bg-neutral-900/60 border-neutral-800/30 placeholder-neutral-600 hover:border-neutral-700/50 transition-colors"
                  style={{
                    fontFamily: 'SF Mono, monospace'
                  }}
                />
              </div>
            ))}
          </div>
          {hasKwargs && (
            <div className="mt-4 p-3 border rounded-xl bg-neutral-900/40 border-neutral-800/30">
              <h4 className="text-xs font-semibold mb-2 text-neutral-400 uppercase tracking-wide" style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif', letterSpacing: '0.05em' }}>Add Custom Parameter</h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newParamKey}
                  onChange={(e) => setNewParamKey(e.target.value)}
                  placeholder="key"
                  className="flex-1 border text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-neutral-600/80 text-sm bg-neutral-900/60 border-neutral-800/30 placeholder-neutral-600 hover:border-neutral-700/50 transition-colors"
                  style={{
                    fontFamily: 'SF Mono, monospace'
                  }}
                />
                <input
                  type="text"
                  value={newParamValue}
                  onChange={(e) => setNewParamValue(e.target.value)}
                  placeholder="value"
                  className="flex-1 border text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-neutral-600/80 text-sm bg-neutral-900/60 border-neutral-800/30 placeholder-neutral-600 hover:border-neutral-700/50 transition-colors"
                  style={{
                    fontFamily: 'SF Mono, monospace'
                  }}
                />
                <button
                  onClick={handleAddCustomParam}
                  className="px-3 py-2.5 rounded-lg transition-all text-sm font-medium bg-neutral-800/40 text-neutral-300 hover:bg-neutral-800/60 hover:text-white"
                  style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif', letterSpacing: '-0.01em' }}
                >
                  ➕ add
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
