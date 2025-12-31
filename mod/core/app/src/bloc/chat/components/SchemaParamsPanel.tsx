'use client'

import { useState } from 'react'

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

  if (!selectedFunction || !schema || !schema[selectedFunction]) {
    return null
  }

  return (
    <div className="border-2 border-gray-700/60 rounded-lg overflow-hidden mt-3 mx-3">
      <div className="p-3 space-y-2 bg-gray-900/40">
        <div className="flex justify-between items-center">
          <h3 className="text-cyan-400 text-sm font-bold" style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}>parameters</h3>
          <div className="flex gap-2 items-center">
            <button
              onClick={handleResetParams}
              className="px-2 py-1 bg-gradient-to-r from-orange-500/20 to-orange-600/10 text-orange-400 border-2 border-orange-500/40 hover:from-orange-500/30 hover:to-orange-600/20 hover:border-orange-500/60 rounded-lg transition-all duration-200 font-bold shadow-lg text-xs"
              style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}
            >
              🔄 reset
            </button>
            <button
              onClick={() => setIsParamsCollapsed(!isParamsCollapsed)}
              className="text-cyan-400 hover:text-cyan-300 transition-all text-lg px-1"
            >
              <span>{isParamsCollapsed ? '▼' : '▲'}</span>
            </button>
          </div>
        </div>
        {!isParamsCollapsed && (
          <>
            {Object.entries(schema[selectedFunction].input)
              .filter(([key]) => key !== 'self' && key !== 'cls')
              .map(([key, value]: [string, any]) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-green-400 text-xs font-bold" style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase', textShadow: '0 0 10px rgba(34, 197, 94, 0.5)' }}>
                    {key} <span className="text-gray-500 text-xs">({value.type})</span>
                  </label>
                  <input
                    type="text"
                    value={params[key] ?? ''}
                    onChange={(e) => handleParamChange(key, e.target.value)}
                    placeholder={value.value !== '_empty' ? String(value.value) : 'enter value...'}
                    className="bg-gray-900/80 border-2 border-green-500/60 text-green-300 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-bold"
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
