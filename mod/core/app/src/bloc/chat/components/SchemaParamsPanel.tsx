'use client'

import { useState, useRef, useEffect } from 'react'

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
  const [isParamsCollapsed, setIsParamsCollapsed] = useState(true)
  const [isHovered, setIsHovered] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(numColumns)

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

  const handleHeaderClick = (e: React.MouseEvent) => {
    if (headerRef.current && headerRef.current.contains(e.target as Node)) {
      setIsParamsCollapsed(!isParamsCollapsed)
    }
  }

  const toggleColumns = () => {
    setColumns(prev => prev === 1 ? 2 : 1)
  }

  if (!selectedFunction || !schema || !schema[selectedFunction]) {
    return null
  }

  const paramEntries = Object.entries(schema[selectedFunction].input)
    .filter(([key]) => key !== 'self' && key !== 'cls')
  
  const getGridCols = () => {
    return columns === 1 ? 'grid-cols-1' : 'grid-cols-2'
  }

  return (
    <div 
      ref={panelRef} 
      className={`border-2 rounded-lg overflow-hidden mt-3 mx-3 backdrop-blur-sm transition-all ${
        isHovered ? 'border-orange-500/60 bg-orange-500/10' : 'border-orange-500/40 bg-orange-500/5'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="p-3 space-y-2 bg-black/40">
        <div 
          ref={headerRef}
          className="flex justify-between items-center cursor-pointer"
          onClick={handleHeaderClick}
        >
          <h3 className="text-orange-400 text-xl font-bold" style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase', textShadow: '0 0 10px rgba(251, 146, 60, 0.5)' }}>parameters</h3>
          <div className="flex gap-2 items-center">
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleColumns()
              }}
              className="px-3 py-2 bg-blue-500/20 text-blue-400 border-2 border-blue-500/40 hover:bg-blue-500/30 hover:border-blue-500/60 rounded-lg transition-all duration-200 font-bold shadow-lg text-base backdrop-blur-sm"
              style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}
              title="Toggle columns"
            >
              {columns === 1 ? '⚏' : '⚌'} {columns}col
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleResetParams()
              }}
              className="px-3 py-2 bg-orange-500/20 text-orange-400 border-2 border-orange-500/40 hover:bg-orange-500/30 hover:border-orange-500/60 rounded-lg transition-all duration-200 font-bold shadow-lg text-base backdrop-blur-sm"
              style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}
            >
              🔄 reset
            </button>
            <span className="text-orange-400 hover:text-orange-300 transition-all text-2xl px-1">
              {isParamsCollapsed ? '▼' : '▲'}
            </span>
          </div>
        </div>
        {!isParamsCollapsed && (
          <>
            <div className={`grid gap-3 ${getGridCols()}`}>
              {paramEntries.map(([key, value]: [string, any]) => (
                <div key={key} className="flex flex-col gap-2">
                  <label className="text-white text-lg font-bold" style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase', textShadow: '0 0 10px rgba(255, 255, 255, 0.5)' }}>
                    {key} <span className="text-gray-500 text-base">({value.type})</span>
                  </label>
                  <input
                    type="text"
                    value={params[key] ?? ''}
                    onChange={(e) => handleParamChange(key, e.target.value)}
                    placeholder={value.value !== '_empty' ? String(value.value) : 'enter value...'}
                    className="bg-black/60 border-2 border-orange-500/40 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/60 focus:border-orange-500/60 text-lg font-bold backdrop-blur-sm placeholder-orange-600/50"
                    style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
