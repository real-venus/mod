"use client";

import { useState, useEffect, useRef } from 'react'
import { userContext } from '@/context'
import { ModuleType } from '@/types'
import { text2color, colorWithOpacity } from '@/utils'
import { CopyButton } from '@/ui/CopyButton'
import { Zap, Search } from 'lucide-react'

interface ModApiProps {
  mod: ModuleType
}

export default function ModApi({ mod }: ModApiProps) {
  const { client } = userContext()
  const [selectedFunction, setSelectedFunction] = useState<string>('')
  const [params, setParams] = useState<Record<string, any>>({})
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fnSearch, setFnSearch] = useState('')
  const fnSearchRef = useRef<HTMLInputElement>(null)

  const modColor = text2color(mod.name || mod.key)
  const schema = mod.schema || {}
  const functions = Object.keys(schema)

  const filteredFunctions = fnSearch
    ? functions.filter(fn => fn.toLowerCase().includes(fnSearch.toLowerCase()))
    : functions

  useEffect(() => {
    if (functions.length > 0 && !selectedFunction) {
      setSelectedFunction(functions[0])
    }
  }, [functions, selectedFunction])

  const handleParamChange = (key: string, value: string) => {
    setParams(prev => ({ ...prev, [key]: value }))
  }

  const handleResetParams = () => {
    setParams({})
    setResult(null)
    setError(null)
  }

  const handleSelectFunction = (fn: string) => {
    setSelectedFunction(fn === selectedFunction ? '' : fn)
    setParams({})
    setResult(null)
    setError(null)
  }

  const handleExecute = async () => {
    if (!client || !selectedFunction) return
    setLoading(true)
    setError(null)
    try {
      const fnpath = `${mod.name}/${selectedFunction}`
      const res = await client.call(fnpath, { ...params })
      setResult(res)
    } catch (err: any) {
      setError(err?.message || 'Execution failed')
    } finally {
      setLoading(false)
    }
  }

  // Get param entries for a function
  const getFnParams = (fnName: string) => {
    const fnSchema = (schema as Record<string, any>)[fnName]
    if (!fnSchema?.input) return []
    // if it is a array just get the names and types, else if it is a dict get the entries excluding self, cls and kwargs
    if (Array.isArray(fnSchema.input)) {
      return fnSchema.input.map((param: any) => [param.name, { type: param.type, value: param.value }])
    }
    return Object.entries(fnSchema.input)
      .filter(([key]) => key !== 'self' && key !== 'cls' && key !== 'kwargs')
  }

  const getFnOutput = (fnName: string) => {
    const fnSchema = (schema as Record<string, any>)[fnName]
    return fnSchema?.output || null
  }

  const hasKwargs = (fnName: string) => {
    const fnSchema = (schema as Record<string, any>)[fnName]
    return fnSchema?.input ? Object.keys(fnSchema.input).includes('kwargs') : false
  }

  const selectedFnParams = selectedFunction ? getFnParams(selectedFunction) : []
  const selectedFnOutput = selectedFunction ? getFnOutput(selectedFunction) : null
  const selectedHasKwargs = selectedFunction ? hasKwargs(selectedFunction) : false

  // Custom params for kwargs
  const [customParams, setCustomParams] = useState<Record<string, string>>({})
  const [newParamKey, setNewParamKey] = useState('')
  const [newParamValue, setNewParamValue] = useState('')

  const handleAddCustomParam = () => {
    if (newParamKey.trim() && selectedHasKwargs) {
      const updated = { ...customParams, [newParamKey]: newParamValue }
      setCustomParams(updated)
      handleParamChange(newParamKey, newParamValue)
      setNewParamKey('')
      setNewParamValue('')
    }
  }

  const handleRemoveCustomParam = (key: string) => {
    const updated = { ...customParams }
    delete updated[key]
    setCustomParams(updated)
    handleParamChange(key, '')
  }

  // Reset custom params when switching functions
  useEffect(() => {
    setCustomParams({})
    setNewParamKey('')
    setNewParamValue('')
  }, [selectedFunction])

  return (
    <div
      className="font-mono relative"
      style={{ fontFamily: 'JetBrains Mono, monospace' }}
    >
      {/* Cyberpunk ambient glow background */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div className="absolute top-0 left-0 w-96 h-96 bg-cyan-500/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/20 blur-[120px] rounded-full" />
      </div>

      {/* Two-column layout */}
      <div className="flex gap-6 relative">
        {/* Left: function list */}
        <div className="w-[340px] shrink-0">
          {/* Function search */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
            <input
              ref={fnSearchRef}
              type="text"
              value={fnSearch}
              onChange={(e) => setFnSearch(e.target.value)}
              placeholder="Search functions..."
              className="w-full pl-11 pr-20 py-3 text-[13px] font-mono font-bold focus:outline-none transition-all"
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '2px solid rgba(6, 182, 212, 0.3)',
                color: 'var(--text-primary)',
                boxShadow: '0 0 20px rgba(6, 182, 212, 0.1), inset 0 1px 1px rgba(6, 182, 212, 0.05)'
              }}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {fnSearch && (
                <button
                  onClick={() => { setFnSearch(''); fnSearchRef.current?.focus() }}
                  className="text-[10px] font-bold font-mono px-2 py-0.5 transition-colors text-cyan-400 hover:text-cyan-300"
                >
                  CLR
                </button>
              )}
              <span className="text-[10px] font-mono text-cyan-400/70">
                {filteredFunctions.length}/{functions.length}
              </span>
            </div>
          </div>

          {/* Scrollable function cards */}
          <div className="max-h-[600px] overflow-y-auto pr-1 space-y-2 custom-scrollbar">
            {filteredFunctions.map(fn => {
              const isActive = selectedFunction === fn
              const fnParams = getFnParams(fn)
              const fnOutput = getFnOutput(fn)
              return (
                <button
                  key={fn}
                  onClick={() => handleSelectFunction(fn)}
                  className="w-full text-left px-4 py-3 transition-all duration-200 group relative overflow-hidden"
                  style={{
                    border: isActive
                      ? `2px solid rgba(6, 182, 212, 0.6)`
                      : '2px solid rgba(6, 182, 212, 0.2)',
                    backgroundColor: isActive
                      ? 'rgba(6, 182, 212, 0.1)'
                      : 'var(--bg-surface)',
                    boxShadow: isActive
                      ? '0 0 20px rgba(6, 182, 212, 0.3), inset 0 0 20px rgba(6, 182, 212, 0.05)'
                      : 'none',
                  }}
                >
                  {/* Cyberpunk corner accent */}
                  <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-400 opacity-50" />
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-400 opacity-50" />

                  {/* Left accent bar */}
                  <div className="absolute left-0 top-2 bottom-2 w-1 transition-all" style={{
                    background: isActive
                      ? 'linear-gradient(180deg, rgba(6, 182, 212, 1), rgba(168, 85, 247, 1))'
                      : 'transparent',
                    boxShadow: isActive ? '0 0 10px rgba(6, 182, 212, 0.6)' : 'none',
                  }} />

                  {/* Function name row */}
                  <div className="flex items-center gap-2.5 mb-1">
                    <span
                      className="shrink-0 px-2 py-0.5 text-[10px] font-bold font-mono uppercase"
                      style={{
                        backgroundColor: 'rgba(6, 182, 212, 0.15)',
                        color: '#06b6d4',
                        border: `1px solid rgba(6, 182, 212, 0.4)`,
                        textShadow: '0 0 8px rgba(6, 182, 212, 0.8)',
                      }}
                    >
                      fn
                    </span>
                    <span
                      className="text-[14px] font-bold font-mono truncate"
                      style={{
                        color: isActive ? '#06b6d4' : 'var(--text-primary)',
                        textShadow: isActive ? '0 0 10px rgba(6, 182, 212, 0.5)' : 'none',
                      }}
                    >{fn}</span>
                  </div>

                  {/* Schema: params & output */}
                  <div className="ml-7 space-y-0.5">
                    {fnParams.length > 0 && (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        {fnParams.map(([key, value]: [string, any]) => (
                          <span key={key} className="text-[11px] font-mono">
                            <span className="text-purple-400">{key}</span>
                            <span style={{ color: 'var(--text-tertiary)' }}> : </span>
                            <span className="text-cyan-400/70">{value.type || 'any'}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {fnOutput && (
                      <div className="text-[11px] font-mono text-cyan-400/60">
                        <span className="text-purple-400">{'\u2192'} </span>
                        <span>{typeof fnOutput === 'object' ? fnOutput.type || 'any' : fnOutput}</span>
                      </div>
                    )}
                    {fnParams.length === 0 && !fnOutput && (
                      <span className="text-[11px] font-mono text-cyan-400/60">{'() -> void'}</span>
                    )}
                  </div>
                </button>
              )
            })}
            {filteredFunctions.length === 0 && (
              <div
                className="text-center text-[13px] font-mono py-12 relative overflow-hidden"
                style={{
                  color: '#06b6d4',
                  backgroundColor: 'var(--bg-input)',
                  border: '2px solid rgba(6, 182, 212, 0.3)',
                  boxShadow: '0 0 20px rgba(6, 182, 212, 0.1)',
                }}
              >
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute inset-0" style={{
                    background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(6, 182, 212, 0.1) 2px, rgba(6, 182, 212, 0.1) 4px)'
                  }} />
                </div>
                <span className="relative font-bold uppercase tracking-wider" style={{ textShadow: '0 0 10px rgba(6, 182, 212, 0.5)' }}>
                  {functions.length === 0 ? '// NO FUNCTIONS //' : '// NO MATCHES //'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: interaction panel */}
        <div className="flex-1 min-w-0">
          {selectedFunction ? (
            <div className="p-5 space-y-4 relative overflow-hidden" style={{
              border: `2px solid rgba(6, 182, 212, 0.4)`,
              backgroundColor: 'var(--bg-surface)',
              boxShadow: '0 0 30px rgba(6, 182, 212, 0.15), inset 0 0 30px rgba(6, 182, 212, 0.03)',
            }}>
              {/* Cyberpunk corner accents */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-purple-400" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-purple-400" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400" />

              {/* Top scan line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50" />

              {/* Function header */}
              <div className="flex items-center gap-3 relative">
                <span
                  className="px-3 py-1 text-[11px] font-bold uppercase font-mono"
                  style={{
                    backgroundColor: 'rgba(6, 182, 212, 0.15)',
                    color: '#06b6d4',
                    border: `1px solid rgba(6, 182, 212, 0.4)`,
                    textShadow: '0 0 8px rgba(6, 182, 212, 0.8)',
                  }}
                >FN</span>
                <span
                  className="text-lg font-bold font-mono"
                  style={{
                    color: '#06b6d4',
                    textShadow: '0 0 15px rgba(6, 182, 212, 0.6)',
                  }}
                >{selectedFunction}</span>
              </div>

              {/* Full signature */}
              <div className="px-4 py-3 relative" style={{
                backgroundColor: 'var(--bg-input)',
                border: '2px solid rgba(6, 182, 212, 0.2)',
                boxShadow: 'inset 0 0 20px rgba(6, 182, 212, 0.05)',
              }}>
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute inset-0" style={{
                    background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(6, 182, 212, 0.1) 2px, rgba(6, 182, 212, 0.1) 4px)'
                  }} />
                </div>
                <code className="text-[13px] font-mono leading-relaxed relative">
                  <span className="text-cyan-400/40">fn </span>
                  <span className="text-cyan-400">{selectedFunction}</span>
                  <span className="text-purple-400">(</span>
                  {selectedFnParams.map(([key, value]: [string, any], i: number) => (
                    <span key={key}>
                      {i > 0 && <span className="text-purple-400">, </span>}
                      <span className="text-purple-300">{key}</span>
                      <span className="text-purple-400"> : </span>
                      <span className="text-cyan-400/70">{value.type || 'any'}</span>
                    </span>
                  ))}
                  <span className="text-purple-400">)</span>
                  {selectedFnOutput && (
                    <span>
                      <span className="text-purple-400"> {'->'} </span>
                      <span className="text-cyan-400/70">{typeof selectedFnOutput === 'object' ? selectedFnOutput.type || 'any' : selectedFnOutput}</span>
                    </span>
                  )}
                </code>
              </div>

              {/* Args */}
              {(selectedFnParams.length > 0 || Object.keys(customParams).length > 0 || selectedHasKwargs) && (
                <div className="space-y-3">
                  {selectedFnParams.map(([key, value]: [string, any]) => (
                    <div key={key}>
                      <label className="text-[12px] font-mono mb-1 block font-semibold text-cyan-400">
                        {key} <span className="text-purple-400/70">:: {value.type || 'any'}</span>
                      </label>
                      {value.type === 'bool' ? (
                        <select
                          value={params[key] || ''}
                          onChange={(e) => handleParamChange(key, e.target.value)}
                          className="w-full px-4 py-3 text-[14px] font-mono focus:outline-none transition-all appearance-none cursor-pointer"
                          style={{
                            backgroundColor: 'var(--bg-input)',
                            border: '2px solid rgba(6, 182, 212, 0.3)',
                            color: 'var(--text-primary)',
                            boxShadow: '0 0 15px rgba(6, 182, 212, 0.1)'
                          }}
                        >
                          <option value="">Select...</option>
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={params[key] ?? ''}
                          onChange={(e) => handleParamChange(key, e.target.value)}
                          placeholder={value.value !== '_empty' ? String(value.value) : value.type || '_empty'}
                          className="w-full px-4 py-3 text-[14px] font-mono focus:outline-none transition-all"
                          style={{
                            backgroundColor: 'var(--bg-input)',
                            border: '2px solid rgba(6, 182, 212, 0.3)',
                            color: 'var(--text-primary)',
                            boxShadow: '0 0 15px rgba(6, 182, 212, 0.1)'
                          }}
                        />
                      )}
                    </div>
                  ))}

                  {/* Custom kwargs params */}
                  {Object.entries(customParams).map(([key, value]) => (
                    <div key={key}>
                      <label className="text-[12px] font-mono mb-1 flex justify-between items-center font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        <span>{key} <span style={{ color: 'var(--text-tertiary)' }}>:: custom</span></span>
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
                        className="w-full rounded-xl px-4 py-3 text-[14px] font-mono focus:outline-none transition-all"
                        style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)' }}
                      />
                    </div>
                  ))}

                  {/* Add custom param for kwargs */}
                  {selectedHasKwargs && (
                    <div className="pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newParamKey}
                          onChange={(e) => setNewParamKey(e.target.value)}
                          placeholder="key"
                          className="flex-1 rounded-xl px-4 py-2.5 text-[13px] font-mono focus:outline-none transition-all"
                          style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)' }}
                        />
                        <input
                          type="text"
                          value={newParamValue}
                          onChange={(e) => setNewParamValue(e.target.value)}
                          placeholder="value"
                          className="flex-1 rounded-xl px-4 py-2.5 text-[13px] font-mono focus:outline-none transition-all"
                          style={{ backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)' }}
                        />
                        <button
                          onClick={handleAddCustomParam}
                          className="px-4 py-2.5 rounded-xl text-[12px] font-bold font-mono transition-all"
                          style={{
                            backgroundColor: colorWithOpacity(modColor, 0.1),
                            border: `1.5px solid ${colorWithOpacity(modColor, 0.2)}`,
                            color: modColor,
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Execute button */}
              <button
                onClick={handleExecute}
                disabled={loading || !selectedFunction}
                className="w-full py-3.5 text-[14px] font-bold font-mono uppercase tracking-wider transition-all duration-200 disabled:opacity-40 flex items-center justify-center gap-2.5 relative overflow-hidden group"
                style={{
                  background: loading
                    ? 'transparent'
                    : 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(168, 85, 247, 0.15))',
                  borderWidth: '2px',
                  borderStyle: 'solid',
                  borderColor: loading ? 'rgba(6, 182, 212, 0.2)' : 'rgba(6, 182, 212, 0.5)',
                  color: loading ? 'rgba(6, 182, 212, 0.4)' : '#06b6d4',
                  boxShadow: loading
                    ? 'none'
                    : '0 0 30px rgba(6, 182, 212, 0.3), 0 0 60px rgba(168, 85, 247, 0.2)',
                  textShadow: loading ? 'none' : '0 0 10px rgba(6, 182, 212, 0.8)',
                }}
              >
                {/* Hover glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />

                {loading ? (
                  <>
                    <span className="animate-pulse relative">_</span>
                    <span className="relative">EXECUTING...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 relative" />
                    <span className="relative">EXECUTE {selectedFunction.toUpperCase()}</span>
                  </>
                )}
              </button>

              {/* Error */}
              {error && (
                <div className="rounded-xl overflow-hidden border border-red-500/20 bg-red-500/[0.04]">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-red-500/10">
                    <span className="text-red-400/80 text-[13px] font-extrabold uppercase tracking-wider">error</span>
                    <CopyButton text={error} />
                  </div>
                  <pre className="text-red-400/70 text-[13px] font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-96 overflow-y-auto p-5">
                    {error}
                  </pre>
                </div>
              )}

              {/* Result */}
              {result !== null && (
                <div className="overflow-hidden relative" style={{
                  border: `2px solid rgba(6, 182, 212, 0.4)`,
                  boxShadow: '0 0 20px rgba(6, 182, 212, 0.2)'
                }}>
                  {/* Corner accents */}
                  <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400" />
                  <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-purple-400" />

                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
                  <div className="flex items-center justify-between px-5 py-3 relative" style={{
                    borderBottom: `2px solid rgba(6, 182, 212, 0.2)`,
                    backgroundColor: 'rgba(6, 182, 212, 0.05)'
                  }}>
                    <span
                      className="text-[11px] font-bold uppercase tracking-wider font-mono"
                      style={{
                        color: '#06b6d4',
                        textShadow: '0 0 10px rgba(6, 182, 212, 0.6)'
                      }}
                    >
                      ► OUTPUT
                    </span>
                    <CopyButton text={JSON.stringify(result, null, 2)} />
                  </div>
                  {(() => {
                    const isBase64Image = typeof result === 'string' && result.startsWith('data:image/')
                    const isImageUrl = typeof result === 'string' && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(result)
                    const hasImageField = typeof result === 'object' && result !== null &&
                      (result.image || result.url || result.data) &&
                      (typeof result.image === 'string' && (result.image.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(result.image)) ||
                       typeof result.url === 'string' && (result.url.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(result.url)) ||
                       typeof result.data === 'string' && (result.data.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(result.data)))

                    const imageSource = isBase64Image || isImageUrl ? result :
                                      hasImageField ? (result.image || result.url || result.data) : null

                    if (imageSource) {
                      return (
                        <div className="p-5 space-y-3">
                          <div className="overflow-hidden rounded-lg" style={{ backgroundColor: '#06060a' }}>
                            <img
                              src={imageSource as string}
                              alt="Result"
                              className="w-full h-auto"
                              style={{ maxHeight: 'none' }}
                            />
                          </div>
                          {hasImageField && (
                            <pre className="text-[13px] font-medium overflow-x-auto p-5 rounded-lg" style={{ backgroundColor: '#06060a', color: colorWithOpacity(modColor, 0.6) }}>
                              <code>{JSON.stringify(result, null, 2)}</code>
                            </pre>
                          )}
                        </div>
                      )
                    }

                    return (
                      <pre className="text-[16px] font-mono font-bold whitespace-pre-wrap break-all leading-relaxed p-5" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                        <code>{JSON.stringify(result, null, 2)}</code>
                      </pre>
                    )
                  })()}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-80 relative overflow-hidden" style={{
              border: '2px dashed rgba(6, 182, 212, 0.3)',
              backgroundColor: 'var(--bg-input)',
            }}>
              {/* Scanline effect */}
              <div className="absolute inset-0 opacity-20">
                <div className="absolute inset-0" style={{
                  background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(6, 182, 212, 0.1) 2px, rgba(6, 182, 212, 0.1) 4px)'
                }} />
              </div>

              <div className="w-12 h-12 mb-4 flex items-center justify-center relative" style={{
                border: `2px solid rgba(6, 182, 212, 0.4)`,
                boxShadow: '0 0 20px rgba(6, 182, 212, 0.2)'
              }}>
                <Zap className="w-6 h-6 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.6))' }} />
              </div>
              <span className="text-[14px] font-mono font-bold uppercase tracking-wider text-cyan-400/70 relative" style={{ textShadow: '0 0 10px rgba(6, 182, 212, 0.3)' }}>
                ► SELECT FUNCTION TO EXECUTE
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
