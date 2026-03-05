"use client";

import { useState, useRef, useEffect } from 'react'
import { userContext } from '@/context/UserContext'

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

  // Get user wallet address
  const { user } = userContext()

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

  // Auto-populate address fields with user's wallet address on function change
  useEffect(() => {
    if (!selectedFunction || !schema || !user?.key) return

    const functionSchema = schema[selectedFunction]
    const input = functionSchema?.input
    if (!input) return

    let paramEntries: [string, any][]
    if (Array.isArray(input)) {
      paramEntries = input
        .filter(param => param.name !== 'kwargs')
        .map(param => [param.name, { type: param.type, value: param.value }])
    } else {
      paramEntries = Object.entries(input).filter(([key]) => key !== 'kwargs')
    }

    // Auto-fill address parameters with user's wallet address if empty
    paramEntries.forEach(([key, value]: [string, any]) => {
      const isAddressType = value.type?.toLowerCase().includes('address')
      const currentValue = params[key]
      const isEmpty = !currentValue || currentValue === '' || currentValue === '_empty'

      if (isAddressType && isEmpty && user?.key) {
        handleParamChange(key, user.key)
      }
    })
  }, [selectedFunction, user?.key])

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

  const functionSchema = schema[selectedFunction]
  const input = functionSchema.input || {}

  // Handle both array and object format
  let paramEntries: [string, any][]
  let hasKwargs = false

  if (Array.isArray(input)) {
    // New array format: [{name, value, type}, ...]
    paramEntries = input
      .filter(param => param.name !== 'kwargs')
      .map(param => [param.name, { type: param.type, value: param.value }])
    hasKwargs = input.some(param => param.name === 'kwargs')
  } else {
    // Old object format
    paramEntries = Object.entries(input).filter(([key]) => key !== 'kwargs')
    hasKwargs = Object.keys(input).includes('kwargs')
  }
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
        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          {paramEntries.length} param{paramEntries.length !== 1 ? 's' : ''}
        </div>
        <div className="flex gap-1.5">
          {shouldCollapse && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsExpanded(!isExpanded)
              }}
              className="px-2 py-1 transition-all text-[10px] font-bold"
              style={{ color: 'var(--text-tertiary)' }}
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
              className="px-2 py-1 transition-all text-[10px] font-bold"
              title="Toggle columns"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {columns}col
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleResetParams()
            }}
            className="px-2 py-1 transition-all text-[10px] font-bold"
            style={{ color: 'var(--text-tertiary)' }}
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
          scrollbarColor: 'var(--scrollbar-thumb) transparent'
        }}
      >
        <div className={`grid gap-3 ${getGridCols()}`}>
          {paramEntries.map(([key, value]: [string, any]) => {
            const isAddressType = value.type?.toLowerCase().includes('address')
            const hasUserAddress = user?.key

            return (
              <div key={key} className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <span>
                    {key} <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>({value.type})</span>
                  </span>
                  {isAddressType && hasUserAddress && (
                    <button
                      type="button"
                      onClick={() => handleParamChange(key, user.key || '')}
                      className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded border transition-all hover:bg-green-500/20"
                      style={{
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-tertiary)',
                      }}
                      title="Use my wallet address"
                    >
                      isme
                    </button>
                  )}
                </label>
                <input
                  type="text"
                  value={params[key] ?? ''}
                  onChange={(e) => handleParamChange(key, e.target.value)}
                  placeholder={value.value !== '_empty' ? String(value.value) : '...'}
                  className="px-3 py-2 focus:outline-none text-[12px] transition-colors font-mono"
                  style={{
                    color: 'var(--text-primary)',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                  }}
                />
              </div>
            )
          })}
          {Object.entries(customParams).map(([key, value]) => (
            <div key={key} className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold flex justify-between items-center" style={{ color: 'var(--text-secondary)' }}>
                <span>{key} <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>(custom)</span></span>
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
                className="px-3 py-2 focus:outline-none text-[12px] transition-colors font-mono"
                style={{
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                }}
              />
            </div>
          ))}
        </div>

        {/* Add custom parameter */}
        {hasKwargs && (
          <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
            <div className="flex gap-2">
              <input
                type="text"
                value={newParamKey}
                onChange={(e) => setNewParamKey(e.target.value)}
                placeholder="key"
                className="flex-1 px-3 py-2 focus:outline-none text-[12px] transition-colors font-mono"
                style={{
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                }}
              />
              <input
                type="text"
                value={newParamValue}
                onChange={(e) => setNewParamValue(e.target.value)}
                placeholder="value"
                className="flex-1 px-3 py-2 focus:outline-none text-[12px] transition-colors font-mono"
                style={{
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                }}
              />
              <button
                onClick={handleAddCustomParam}
                className="px-3 py-2 transition-all text-[10px] font-bold"
                style={{
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                }}
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
