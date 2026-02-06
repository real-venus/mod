"use client";

import { useState, useRef, useMemo, useEffect } from 'react'
import { text2color } from '@/mod/utils'
import { QRCode } from '@/mod/ui/QRCode'
import { useRouter } from 'next/navigation'
import { QrCodeIcon } from '@heroicons/react/24/outline'
import { userContext } from '@/mod/context'

interface ModuleFunctionSelectorProps {
  selectedModule: string
  setSelectedModule: (value: string) => void
  selectedFunction: string
  setSelectedFunction: (value: string) => void
  modules: any[]
  functions: string[]
  onEnterPress?: () => void
  selectedOwner?: string
  setSelectedOwner?: (value: string) => void
}

export function ModuleFunctionSelector({
  selectedModule,
  setSelectedModule,
  selectedFunction,
  setSelectedFunction,
  modules,
  functions,
  onEnterPress,
  selectedOwner,
  setSelectedOwner
}: ModuleFunctionSelectorProps) {
  const { client } = userContext()
  const [inputValue, setInputValue] = useState('')
  const [showModuleSuggestions, setShowModuleSuggestions] = useState(false)
  const [showFunctionSuggestions, setShowFunctionSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showQR, setShowQR] = useState(false)
  const [ownerModules, setOwnerModules] = useState<any[]>([])
  const [loadingOwnerMods, setLoadingOwnerMods] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const functionColor = useMemo(() => {
    return selectedFunction ? text2color(selectedFunction) : '#8b5cf6'
  }, [selectedFunction])

  const moduleColor = useMemo(() => {
    return selectedModule ? text2color(selectedModule) : '#06b6d4'
  }, [selectedModule])

  const ownerColor = useMemo(() => {
    return selectedOwner ? text2color(selectedOwner) : '#f59e0b'
  }, [selectedOwner])

  const selectedModuleInfo = useMemo(() => {
    return modules.find(m => m.name === selectedModule)
  }, [selectedModule, modules])

  const modulePageUrl = useMemo(() => {
    if (!selectedModuleInfo) return ''
    return typeof window !== 'undefined' 
      ? `${window.location.origin}/mod/${selectedModuleInfo.name}/${selectedModuleInfo.key}`
      : ''
  }, [selectedModuleInfo])

  const uniqueOwners = useMemo(() => {
    const owners = new Set(modules.map(m => m.key).filter(Boolean))
    return Array.from(owners)
  }, [modules])

  useEffect(() => {
    const fetchOwnerModules = async () => {
      if (!selectedOwner || !client) return
      setLoadingOwnerMods(true)
      try {
        const userData = await client.call('user', { key: selectedOwner, expand: true })
        setOwnerModules(userData.mods || [])
      } catch (err) {
        console.error('Failed to fetch owner modules:', err)
        setOwnerModules([])
      } finally {
        setLoadingOwnerMods(false)
      }
    }
    fetchOwnerModules()
  }, [selectedOwner, client])

  const handleQRClick = () => {
    if (modulePageUrl) {
      router.push(modulePageUrl)
    }
  }

  const calculateDistance = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase()
    const s2 = str2.toLowerCase()
    if (s1 === s2) return 0
    if (s1.startsWith(s2)) return 0.05
    if (s2.startsWith(s1)) return 0.1
    if (s1.includes(s2)) return 0.2
    if (s2.includes(s1)) return 0.3
    const matrix: number[][] = []
    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i]
    }
    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j
    }
    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }
    return matrix[s2.length][s1.length] / Math.max(s1.length, s2.length)
  }

  const filteredModules = useMemo(() => {
    if (!inputValue || inputValue.includes('/')) return []
    const modsToFilter = selectedOwner ? ownerModules : modules
    return modsToFilter
      .map(m => ({ ...m, distance: calculateDistance(m.name, inputValue) }))
      .filter(m => m.distance < 0.8)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 8)
  }, [inputValue, modules, ownerModules, selectedOwner])

  const filteredFunctions = useMemo(() => {
    if (!inputValue.includes('/')) return []
    const fnPart = inputValue.split('/')[1] || ''
    return functions
      .map(f => ({ name: f, distance: calculateDistance(f, fnPart) }))
      .filter(f => f.distance < 0.8)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 8)
  }, [inputValue, functions])

  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredModules, filteredFunctions])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    if (value.includes('/')) {
      const [mod, fn] = value.split('/')
      const trimmedMod = mod.trim()
      const trimmedFn = fn?.trim() || ''
      setShowModuleSuggestions(false)
      setShowFunctionSuggestions(trimmedFn.length > 0)
      const matchedModule = modules.find(m => m.name.toLowerCase() === trimmedMod.toLowerCase())
      if (matchedModule) {
        setSelectedModule(matchedModule.name)
        if (trimmedFn) {
          const matchedFunction = functions.find(f => f.toLowerCase() === trimmedFn.toLowerCase())
          if (matchedFunction) {
            setSelectedFunction(matchedFunction)
            setInputValue('')
            setShowFunctionSuggestions(false)
            if (onEnterPress) setTimeout(() => onEnterPress(), 100)
          }
        }
      }
    } else {
      setShowModuleSuggestions(value.length > 0)
      setShowFunctionSuggestions(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const currentSuggestions = showModuleSuggestions ? filteredModules : showFunctionSuggestions ? filteredFunctions : []
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % currentSuggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + currentSuggestions.length) % currentSuggestions.length)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      if (showModuleSuggestions && filteredModules.length > 0) {
        selectModule(filteredModules[selectedIndex].name)
      } else if (showFunctionSuggestions && filteredFunctions.length > 0) {
        selectFunction(filteredFunctions[selectedIndex].name)
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (showModuleSuggestions && filteredModules.length > 0) {
        selectModule(filteredModules[selectedIndex].name)
      } else if (showFunctionSuggestions && filteredFunctions.length > 0) {
        selectFunction(filteredFunctions[selectedIndex].name)
      } else if (inputValue.includes('/')) {
        const [mod, fn] = inputValue.split('/')
        const trimmedMod = mod.trim()
        const trimmedFn = fn?.trim() || ''
        const matchedModule = modules.find(m => m.name.toLowerCase() === trimmedMod.toLowerCase())
        if (matchedModule && trimmedFn) {
          const matchedFunction = functions.find(f => f.toLowerCase() === trimmedFn.toLowerCase())
          if (matchedFunction) {
            setSelectedModule(matchedModule.name)
            setSelectedFunction(matchedFunction)
            setInputValue('')
            setShowFunctionSuggestions(false)
            if (onEnterPress) setTimeout(() => onEnterPress(), 100)
          }
        }
      }
    } else if (e.key === 'Escape') {
      setInputValue('')
      setShowModuleSuggestions(false)
      setShowFunctionSuggestions(false)
    }
  }

  const handleRemoveOwner = () => {
    if (setSelectedOwner) setSelectedOwner('')
    inputRef.current?.focus()
  }

  const handleRemoveModule = () => {
    setSelectedModule('')
    setSelectedFunction('')
    inputRef.current?.focus()
  }

  const handleRemoveFunction = () => {
    setSelectedFunction('')
    inputRef.current?.focus()
  }

  const selectModule = (moduleName: string) => {
    setInputValue(moduleName + '/')
    setSelectedModule(moduleName)
    setShowModuleSuggestions(false)
    setShowFunctionSuggestions(true)
    inputRef.current?.focus()
  }

  const selectFunction = (functionName: string) => {
    setSelectedFunction(functionName)
    setInputValue('')
    setShowFunctionSuggestions(false)
    if (onEnterPress) setTimeout(() => onEnterPress(), 100)
  }

  return (
    <div className="space-y-3">
      {setSelectedOwner && (
        <div className="flex gap-2 items-center">
          <label className="text-sm font-bold" style={{ color: ownerColor, fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}>Owner:</label>
          <select
            value={selectedOwner || ''}
            onChange={(e) => setSelectedOwner(e.target.value)}
            className="flex-1 border-2 bg-black/40 px-4 py-2 rounded-lg text-sm font-bold backdrop-blur-sm focus:outline-none focus:ring-2"
            style={{ borderColor: `${ownerColor}40`, color: ownerColor, fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
          >
            <option value="">All Owners</option>
            {uniqueOwners.map((owner) => (
              <option key={owner} value={owner}>
                {owner.slice(0, 8)}...{owner.slice(-6)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex gap-3 items-center w-full relative">
        <div className="flex-1 flex gap-2 items-center bg-black border-2 border-purple-500/40 px-4 py-3 rounded-lg relative">
          {selectedOwner && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full font-bold" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '1.1rem', backgroundColor: `${ownerColor}30`, borderColor: `${ownerColor}60`, border: '2px solid', color: 'white' }}>
              <span>{selectedOwner.slice(0, 8)}...{selectedOwner.slice(-6)}</span>
              <button onClick={handleRemoveOwner} className="hover:text-red-400 transition-colors" type="button">✕</button>
            </div>
          )}
          {selectedModule && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full font-bold" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '1.1rem', backgroundColor: `${moduleColor}30`, borderColor: `${moduleColor}60`, border: '2px solid', color: 'white' }}>
              <span>{selectedModule}</span>
              <button onClick={handleRemoveModule} className="hover:text-red-400 transition-colors" type="button">✕</button>
            </div>
          )}
          {selectedFunction && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full font-bold" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '1.1rem', backgroundColor: `${functionColor}30`, borderColor: `${functionColor}60`, border: '2px solid', color: 'white' }}>
              <span>{selectedFunction}</span>
              <button onClick={handleRemoveFunction} className="hover:text-red-400 transition-colors" type="button">✕</button>
            </div>
          )}
          <input ref={inputRef} type="text" value={inputValue} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder={selectedModule && selectedFunction ? '' : 'module/function'} className="flex-1 bg-transparent text-white focus:outline-none placeholder-gray-500 text-lg" style={{ fontFamily: 'IBM Plex Mono, monospace' }} />
          {selectedModuleInfo && (
            <button type="button" onClick={handleQRClick} onMouseEnter={() => setShowQR(true)} onMouseLeave={() => setShowQR(false)} className="p-2 bg-black/60 rounded-lg border-2 transition-all hover:scale-105 cursor-pointer flex items-center gap-2" style={{ borderColor: moduleColor }}>
              <QrCodeIcon className="w-5 h-5" style={{ color: moduleColor }} />
              <div className="w-8 h-8"><QRCode value={modulePageUrl} size={32} color={moduleColor} /></div>
            </button>
          )}
          {showQR && selectedModuleInfo && (
            <div className="absolute right-0 top-full mt-2 px-4 py-3 rounded-lg border-2 text-sm font-mono whitespace-nowrap z-50 shadow-2xl pointer-events-none" style={{ backgroundColor: 'rgba(0, 0, 0, 0.95)', borderColor: moduleColor, color: moduleColor, boxShadow: `0 0 20px ${moduleColor}40` }}>
              <div className="space-y-1"><div><strong>Module:</strong> {selectedModuleInfo.name}</div><div><strong>Owner:</strong> {selectedModuleInfo.key?.slice(0, 8)}...{selectedModuleInfo.key?.slice(-6)}</div><div><strong>CID:</strong> {selectedModuleInfo.cid?.slice(0, 12)}...{selectedModuleInfo.cid?.slice(-8)}</div><div className="text-xs opacity-75 mt-2">Click QR to visit page</div></div>
            </div>
          )}
          {showModuleSuggestions && filteredModules.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-black/95 border-2 border-purple-500/60 rounded-lg shadow-2xl z-50 backdrop-blur-md max-h-60 overflow-y-auto">
              {loadingOwnerMods && <div className="p-4 text-center text-purple-400">Loading modules...</div>}
              {filteredModules.map((mod, idx) => (
                <button key={mod.name} type="button" onClick={() => selectModule(mod.name)} className={`w-full text-left px-4 py-3 text-white border-b border-purple-500/30 last:border-b-0 transition-all font-bold flex justify-between items-center ${idx === selectedIndex ? 'bg-purple-500/40' : 'hover:bg-purple-500/30'}`} style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                  <div className="flex flex-col gap-1"><span>{mod.name}</span>{mod.key && <span className="text-purple-400 text-xs font-mono">owner: {mod.key.slice(0, 8)}...{mod.key.slice(-6)}</span>}{mod.cid && <span className="text-cyan-400 text-xs font-mono">cid: {mod.cid.slice(0, 12)}...{mod.cid.slice(-8)}</span>}</div>
                  <span className="text-xs text-cyan-400 font-mono">~{mod.distance.toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
          {showFunctionSuggestions && filteredFunctions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-black/95 border-2 border-cyan-500/60 rounded-lg shadow-2xl z-50 backdrop-blur-md max-h-60 overflow-y-auto">
              {filteredFunctions.map((fn, idx) => (
                <button key={fn.name} type="button" onClick={() => selectFunction(fn.name)} className={`w-full text-left px-4 py-3 text-white border-b border-cyan-500/30 last:border-b-0 transition-all font-bold flex justify-between items-center ${idx === selectedIndex ? 'bg-cyan-500/40' : 'hover:bg-cyan-500/30'}`} style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                  <span>{fn.name}</span><span className="text-xs text-orange-400 font-mono">~{fn.distance.toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedFunction && selectedModule && (
        <div className="text-sm font-mono" style={{ color: functionColor }}>
          <span className="font-bold">Cost:</span> {modules.find(m => m.name === selectedModule)?.schema?.[selectedFunction]?.cost || 0} tokens
        </div>
      )}
    </div>
  )
}
