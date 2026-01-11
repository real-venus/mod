'use client'

import { useState, useRef, useEffect } from 'react'
import { text2color } from '@/mod/utils'

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
      className="overflow-hidden mt-3 backdrop-blur-sm transition-all rounded-xl border-2 p-3"
      style={{ backgroundColor: `${panelColor}15`, borderColor: panelColor }}
    >
      <div className="space-y-2">
        <div className="flex justify-between items-center gap-2 mb-3">
          <h3 className="text-xl font-black" style={{ color: panelColor, letterSpacing: '0.02em' }}>Parameters</h3>
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleColumns()
              }}
              className="px-3 py-2 rounded-lg transition-all duration-200 font-bold shadow-lg text-lg backdrop-blur-sm border-2"
              style={{ 
                backgroundColor: `${panelColor}20`, 
                color: panelColor, 
                borderColor: `${panelColor}40`,
                fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', 
                textTransform: 'lowercase' 
              }}
              title="Toggle columns"
            >
              {columns === 1 ? '⚏' : '⚌'} {columns}col
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleResetParams()
              }}
              className="px-3 py-2 rounded-lg transition-all duration-200 font-bold shadow-lg text-lg backdrop-blur-sm border-2"
              style={{ 
                backgroundColor: '#ff6b3520', 
                color: '#ff6b35', 
                borderColor: '#ff6b3540',
                fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', 
                textTransform: 'lowercase' 
              }}
            >
              🔄 reset
            </button>
          </div>
        </div>
        <div className="max-h-[600px] overflow-y-auto pr-2">
          <div className={`grid gap-3 ${getGridCols()}`}>
            {paramEntries.map(([key, value]: [string, any]) => (
              <div key={key} className="flex flex-col gap-2">
                <label className="text-xl font-bold" style={{ color: panelColor, fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase', textShadow: `0 0 10px ${panelColor}80` }}>
                  {key} <span className="text-gray-500 text-lg">({value.type})</span>
                </label>
                <input
                  type="text"
                  value={params[key] ?? ''}
                  onChange={(e) => handleParamChange(key, e.target.value)}
                  placeholder={value.value !== '_empty' ? String(value.value) : 'enter value...'}
                  className="border-2 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 text-xl font-bold backdrop-blur-sm"
                  style={{ 
                    backgroundColor: 'rgba(0,0,0,0.4)', 
                    borderColor: `${panelColor}40`,
                    fontFamily: 'IBM Plex Mono, Courier New, monospace',
                    color: panelColor
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
