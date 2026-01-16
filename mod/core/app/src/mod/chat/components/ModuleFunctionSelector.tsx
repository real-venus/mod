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
  const [moduleSearch, setModuleSearch] = useState('')
  const [functionSearch, setFunctionSearch] = useState('')
  const moduleRef = useRef<HTMLDivElement>(null)
  const functionRef = useRef<HTMLDivElement>(null)

  const moduleColor = useMemo(() => {
    return selectedModule ? text2color(selectedModule) : '#8b5cf6'
  }, [selectedModule])

  const functionColor = useMemo(() => {
    return selectedFunction ? text2color(selectedFunction) : '#8b5cf6'
  }, [selectedFunction])

  const filteredModules = useMemo(() => {
    if (!moduleSearch) return modules
    return modules.filter(mod => 
      mod.name.toLowerCase().includes(moduleSearch.toLowerCase())
    )
  }, [modules, moduleSearch])

  const filteredFunctions = useMemo(() => {
    if (!functionSearch) return functions
    return functions.filter(fn => 
      fn.toLowerCase().includes(functionSearch.toLowerCase())
    )
  }, [functions, functionSearch])

  const handleModuleClick = (modName: string) => {
    setSelectedModule(modName)
    setShowModuleList(false)
    setModuleSearch('')
    setTimeout(() => {
      setShowFunctionList(true)
    }, 100)
  }

  const handleFunctionClick = (fn: string) => {
    setSelectedFunction(fn)
    setShowFunctionList(false)
    setFunctionSearch('')
    if (onEnterPress) {
      setTimeout(() => onEnterPress(), 100)
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moduleRef.current && !moduleRef.current.contains(event.target as Node)) {
        setShowModuleList(false)
        setModuleSearch('')
      }
      if (functionRef.current && !functionRef.current.contains(event.target as Node)) {
        setShowFunctionList(false)
        setFunctionSearch('')
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
          <div className="absolute w-full mt-1 bg-gray-900 border-2 border-white/60 rounded-lg shadow-xl max-h-64 overflow-hidden z-50">
            <input
              type="text"
              value={moduleSearch}
              onChange={(e) => setModuleSearch(e.target.value)}
              placeholder="🔍 search modules..."
              className="w-full bg-black/60 border-b-2 border-white/20 text-white px-4 py-2 focus:outline-none focus:bg-black/80 placeholder-gray-500"
              style={{ fontFamily: 'IBM Plex Mono, monospace' }}
              autoFocus
            />
            <div className="max-h-52 overflow-y-auto">
              {filteredModules.map(mod => {
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
              {filteredModules.length === 0 && (
                <div className="px-4 py-3 text-gray-500 text-center" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                  no modules found
                </div>
              )}
            </div>
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
          <div className="absolute w-full mt-1 bg-gray-900 border-2 border-white/60 rounded-lg shadow-xl max-h-64 overflow-hidden z-50">
            <input
              type="text"
              value={functionSearch}
              onChange={(e) => setFunctionSearch(e.target.value)}
              placeholder="🔍 search functions..."
              className="w-full bg-black/60 border-b-2 border-white/20 text-white px-4 py-2 focus:outline-none focus:bg-black/80 placeholder-gray-500"
              style={{ fontFamily: 'IBM Plex Mono, monospace' }}
              autoFocus
            />
            <div className="max-h-52 overflow-y-auto">
              {filteredFunctions.map(fn => {
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
              {filteredFunctions.length === 0 && (
                <div className="px-4 py-3 text-gray-500 text-center" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                  no functions found
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <HostSelector />
    </div>
  )
}
