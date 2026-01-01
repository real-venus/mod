'use client'

import { useState, useRef, useEffect } from 'react'

interface SchemaParamsPanelProps {
  selectedFunction: string
  schema: any
  params: Record<string, any>
  handleParamChange: (key: string, value: string) => void
  handleResetParams: () => void
}

export function SchemaParamsPanel({
  selectedFunction,
  schema,
  params,
  handleParamChange,
  handleResetParams
}: SchemaParamsPanelProps) {
  const [isParamsCollapsed, setIsParamsCollapsed] = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsParamsCollapsed(true)
      }
    }

    if (!isParamsCollapsed) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isParamsCollapsed])

  if (!selectedFunction || !schema || !schema[selectedFunction]) {
    return null
  }

  return (
    <div ref={panelRef} className="border-2 border-yellow-500/40 rounded-lg overflow-hidden mt-3 mx-3 bg-yellow-500/5 backdrop-blur-sm">
      <div className="p-3 space-y-2 bg-black/40">
        <div 
          className="flex justify-between items-center cursor-pointer"
          onClick={() => setIsParamsCollapsed(!isParamsCollapsed)}
        >
          <h3 className="text-yellow-400 text-sm font-bold" style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase', textShadow: '0 0 10px rgba(234, 179, 8, 0.5)' }}>parameters</h3>
          <div className="flex gap-2 items-center">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleResetParams()
              }}
              className="px-2 py-1 bg-yellow-500/20 text-yellow-400 border-2 border-yellow-500/40 hover:bg-yellow-500/30 hover:border-yellow-500/60 rounded-lg transition-all duration-200 font-bold shadow-lg text-xs backdrop-blur-sm"
              style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}
            >
              🔄 reset
            </button>
            <span className="text-yellow-400 hover:text-yellow-300 transition-all text-lg px-1">
              {isParamsCollapsed ? '▼' : '▲'}
            </span>
          </div>
        </div>
        {!isParamsCollapsed && (
          <>
            {Object.entries(schema[selectedFunction].input)
              .filter(([key]) => key !== 'self' && key !== 'cls')
              .map(([key, value]: [string, any]) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-yellow-400 text-xs font-bold" style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase', textShadow: '0 0 10px rgba(234, 179, 8, 0.5)' }}>
                    {key} <span className="text-gray-500 text-xs">({value.type})</span>
                  </label>
                  <input
                    type="text"
                    value={params[key] ?? ''}
                    onChange={(e) => handleParamChange(key, e.target.value)}
                    placeholder={value.value !== '_empty' ? String(value.value) : 'enter value...'}
                    className="bg-black/60 border-2 border-yellow-500/40 text-yellow-300 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500/60 focus:border-yellow-500/60 text-sm font-bold backdrop-blur-sm placeholder-yellow-600/50"
                    style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
                  />
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  )
}
