"use client";

import { useState, useRef, useEffect } from 'react'

interface SchemaParamsPanelProps {
  selectedFunction: string
  schema: any
  params: Record<string, any>
  handleParamChange: (key: string, value: string) => void
  handleResetParams: () => void
  numColumns?: number
  modColor?: string
}

export function SchemaParamsPanel({
  selectedFunction,
  schema,
  params,
  handleParamChange,
  handleResetParams,
  numColumns = 2,
  modColor,
}: SchemaParamsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(numColumns)
  const [customParams, setCustomParams] = useState<Record<string, string>>({})
  const [newParamKey, setNewParamKey] = useState('')
  const [newParamValue, setNewParamValue] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

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
  const hasParams = paramEntries.length > 0 || Object.keys(customParams).length > 0 || hasKwargs

  // Hide entirely when no params and no kwargs
  if (!hasParams) return null

  const getGridCols = () => {
    return columns === 1 ? 'grid-cols-1' : 'grid-cols-2'
  }

  const shouldCollapse = paramEntries.length > 6

  return (
    <div
      ref={panelRef}
      className="overflow-hidden transition-all"
      style={{ fontFamily: 'IBM Plex Mono, monospace' }}
    >
      {/* Header - only show controls when there are actual params */}
      <div className="flex justify-between items-center gap-2 mb-3">
        <div className="text-[10px] font-bold text-white/30 uppercase tracking-wider">
          {paramEntries.length} param{paramEntries.length !== 1 ? 's' : ''}
        </div>
        <div className="flex gap-1.5">
          {shouldCollapse && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsExpanded(!isExpanded)
              }}
              className="px-2 py-1 transition-all text-[10px] font-bold text-white/20 hover:text-white/50"
            >
              {isExpanded ? '[-]' : '[+]'}
            </button>
          )}
          {paramEntries.length > 2 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleColumns()
              }}
              className="px-2 py-1 transition-all text-[10px] font-bold text-white/20 hover:text-white/50"
              title="Toggle columns"
            >
              {columns}col
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleResetParams()
            }}
            className="px-2 py-1 transition-all text-[10px] font-bold text-white/20 hover:text-white/40"
          >
            reset
          </button>
        </div>
      </div>

      {/* Parameters */}
      <div
        className="overflow-y-auto"
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
              <label className="text-[11px] font-bold text-white/50">
                {key} <span className="text-white/20 text-[10px]">({value.type})</span>
              </label>
              <input
                type="text"
                value={params[key] ?? ''}
                onChange={(e) => handleParamChange(key, e.target.value)}
                placeholder={value.value !== '_empty' ? String(value.value) : '...'}
                className="text-white/80 px-3 py-2 focus:outline-none text-[12px] bg-white/[0.03] border border-white/[0.08] placeholder-white/15 hover:border-white/[0.15] focus:border-white/25 transition-colors font-mono"
              />
            </div>
          ))}
          {Object.entries(customParams).map(([key, value]) => (
            <div key={key} className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-white/50 flex justify-between items-center">
                <span>{key} <span className="text-white/20 text-[10px]">(custom)</span></span>
                <button
                  onClick={() => handleRemoveCustomParam(key)}
                  className="text-red-500/40 hover:text-red-400 text-[10px] transition-colors"
                >
                  x
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
                placeholder="..."
                className="text-white/80 px-3 py-2 focus:outline-none text-[12px] bg-white/[0.03] border border-white/[0.08] placeholder-white/15 hover:border-white/[0.15] focus:border-white/25 transition-colors font-mono"
              />
            </div>
          ))}
        </div>

        {/* Add custom parameter */}
        {hasKwargs && (
          <div className="mt-4 pt-3 border-t border-white/[0.06]">
            <div className="flex gap-2">
              <input
                type="text"
                value={newParamKey}
                onChange={(e) => setNewParamKey(e.target.value)}
                placeholder="key"
                className="flex-1 text-white/80 px-3 py-2 focus:outline-none text-[12px] bg-white/[0.03] border border-white/[0.08] placeholder-white/15 hover:border-white/[0.15] focus:border-white/25 transition-colors font-mono"
              />
              <input
                type="text"
                value={newParamValue}
                onChange={(e) => setNewParamValue(e.target.value)}
                placeholder="value"
                className="flex-1 text-white/80 px-3 py-2 focus:outline-none text-[12px] bg-white/[0.03] border border-white/[0.08] placeholder-white/15 hover:border-white/[0.15] focus:border-white/25 transition-colors font-mono"
              />
              <button
                onClick={handleAddCustomParam}
                className="px-3 py-2 transition-all text-[10px] font-bold text-white/30 hover:text-white/60 border border-white/[0.08] hover:border-white/[0.15] bg-white/[0.03]"
              >
                +
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
