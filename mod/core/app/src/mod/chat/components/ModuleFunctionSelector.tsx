'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import { text2color } from '@/mod/utils'
import { HostSelector } from './HostSelector'

interface ModuleFunctionSelectorProps {
  selectedModule: string
  setSelectedModule: (value: string) => void
  selectedFunction: string
  setSelectedFunction: (value: string) => void
  modules: any[]
  functions: string[]
  onEnterPress?: () => void
}

export function ModuleFunctionSelector({
  selectedModule,
  setSelectedModule,
  selectedFunction,
  setSelectedFunction,
  modules,
  functions,
  onEnterPress
}: ModuleFunctionSelectorProps) {
  const [showModuleList, setShowModuleList] = useState(false)
  const [showFunctionList, setShowFunctionList] = useState(false)
  const moduleRef = useRef<HTMLDivElement>(null)
  const functionRef = useRef<HTMLDivElement>(null)

  const moduleColor = useMemo(() => {
    return selectedModule ? text2color(selectedModule) : '#8b5cf6'
  }, [selectedModule])

  const functionColor = useMemo(() => {
    return selectedFunction ? text2color(selectedFunction) : '#8b5cf6'
  }, [selectedFunction])

  const handleModuleClick = (modName: string) => {
    setSelectedModule(modName)
    setShowModuleList(false)
    setTimeout(() => {
      setShowFunctionList(true)
    }, 100)
  }

  const handleFunctionClick = (fn: string) => {
    setSelectedFunction(fn)
    setShowFunctionList(false)
    if (onEnterPress) {
      setTimeout(() => onEnterPress(), 100)
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moduleRef.current && !moduleRef.current.contains(event.target as Node)) {
        setShowModuleList(false)
      }
      if (functionRef.current && !functionRef.current.contains(event.target as Node)) {
        setShowFunctionList(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="flex gap-2 items-center">
      <div ref={moduleRef} className="relative flex-1">
        <button
          onClick={() => {
            setShowModuleList(!showModuleList)
            setShowFunctionList(false)
          }}
          className="w-full bg-black border-2 px-4 py-3 rounded-lg transition-all shadow-lg text-left flex items-center justify-between"
          style={{
            fontFamily: 'IBM Plex Mono, monospace',
            backgroundColor: `${moduleColor}20`,
            borderColor: `${moduleColor}60`,
            color: selectedModule ? 'white' : '#9ca3af',
            fontSize: '1.1rem'
          }}
        >
          <span>{selectedModule || 'select module'}</span>
          <span className="text-sm">{showModuleList ? '▲' : '▼'}</span>
        </button>
        {showModuleList && (
          <div className="absolute w-full mt-1 bg-gray-900 border-2 border-white/60 rounded-lg shadow-xl max-h-64 overflow-y-auto z-50">
            {modules.map(mod => {
              const modColor = text2color(mod.name)
              return (
                <button
                  key={mod.name}
                  onClick={() => handleModuleClick(mod.name)}
                  className="w-full text-left px-4 py-3 hover:bg-white/20 text-white transition-all border-l-4"
                  style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    borderLeftColor: modColor,
                    fontSize: '1rem'
                  }}
                >
                  {mod.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div ref={functionRef} className="relative flex-1">
        <button
          onClick={() => {
            if (selectedModule) {
              setShowFunctionList(!showFunctionList)
              setShowModuleList(false)
            }
          }}
          disabled={!selectedModule}
          className="w-full bg-black border-2 px-4 py-3 rounded-lg transition-all shadow-lg text-left flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            fontFamily: 'IBM Plex Mono, monospace',
            backgroundColor: `${functionColor}20`,
            borderColor: `${functionColor}60`,
            color: selectedFunction ? 'white' : '#9ca3af',
            fontSize: '1.1rem'
          }}
        >
          <span>{selectedFunction || 'select function'}</span>
          <span className="text-sm">{showFunctionList ? '▲' : '▼'}</span>
        </button>
        {showFunctionList && selectedModule && (
          <div className="absolute w-full mt-1 bg-gray-900 border-2 border-white/60 rounded-lg shadow-xl max-h-64 overflow-y-auto z-50">
            {functions.map(fn => {
              const fnColor = text2color(fn)
              return (
                <button
                  key={fn}
                  onClick={() => handleFunctionClick(fn)}
                  className="w-full text-left px-4 py-3 hover:bg-white/20 text-white transition-all border-l-4"
                  style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    borderLeftColor: fnColor,
                    fontSize: '1rem'
                  }}
                >
                  {fn}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <HostSelector />
    </div>
  )
}
