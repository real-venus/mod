"use client";

import { useState, useEffect, useRef } from 'react'
import { Zap, Search, Copy, Check } from 'lucide-react'
import type { ModuleData } from '../UnifiedInterface'

interface ApiPanelProps {
  mod: ModuleData
  client?: any
}

export default function ApiPanel({ mod, client }: ApiPanelProps) {
  const [selectedFunction, setSelectedFunction] = useState<string>('')
  const [params, setParams] = useState<Record<string, any>>({})
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fnSearch, setFnSearch] = useState('')
  const [copied, setCopied] = useState(false)
  const fnSearchRef = useRef<HTMLInputElement>(null)

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

  const getFnParams = (fnName: string) => {
    const fnSchema = (schema as Record<string, any>)[fnName]
    if (!fnSchema?.input) return []
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

  const selectedFnParams = selectedFunction ? getFnParams(selectedFunction) : []
  const selectedFnOutput = selectedFunction ? getFnOutput(selectedFunction) : null

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="font-mono" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
      <div className="flex gap-4">
        {/* Left: function list */}
        <div className="w-[300px] shrink-0 flex flex-col">
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
            <input
              ref={fnSearchRef}
              type="text"
              value={fnSearch}
              onChange={(e) => setFnSearch(e.target.value)}
              placeholder="Search functions..."
              className="w-full pl-9 pr-16 py-2.5 text-[12px] font-mono focus:outline-none transition-all"
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {fnSearch && (
                <button
                  onClick={() => { setFnSearch(''); fnSearchRef.current?.focus() }}
                  className="text-[10px] font-mono px-1.5 py-0.5 transition-colors"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  CLR
                </button>
              )}
              <span className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                {filteredFunctions.length}/{functions.length}
              </span>
            </div>
          </div>

          {/* Function cards */}
          <div className="max-h-[600px] overflow-y-auto space-y-1 api-scroll">
            {filteredFunctions.map(fn => {
              const isActive = selectedFunction === fn
              const fnParams = getFnParams(fn)
              const fnOutput = getFnOutput(fn)
              return (
                <button
                  key={fn}
                  onClick={() => handleSelectFunction(fn)}
                  className="w-full text-left px-3 py-2.5 transition-all duration-150 group"
                  style={{
                    border: isActive ? '1px solid var(--border-strong)' : '1px solid transparent',
                    backgroundColor: isActive ? 'var(--bg-input)' : 'transparent',
                  }}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className="shrink-0 px-1.5 py-0.5 text-[9px] font-bold font-mono uppercase"
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-color)',
                      }}
                    >fn</span>
                    <span
                      className="text-[13px] font-semibold font-mono truncate"
                      style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                    >{fn}</span>
                  </div>

                  <div className="ml-7 space-y-0.5">
                    {fnParams.length > 0 && (
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                        {fnParams.map(([key, value]: [string, any]) => (
                          <span key={key} className="text-[10px] font-mono">
                            <span style={{ color: 'var(--text-secondary)' }}>{key}</span>
                            <span style={{ color: 'var(--text-tertiary)' }}> : </span>
                            <span style={{ color: 'var(--text-tertiary)' }}>{value.type || 'any'}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {fnOutput && (
                      <div className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                        → {typeof fnOutput === 'object' ? fnOutput.type || 'any' : fnOutput}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
            {filteredFunctions.length === 0 && (
              <div className="text-center text-[12px] font-mono py-12" style={{ color: 'var(--text-tertiary)' }}>
                {functions.length === 0 ? 'No functions' : 'No matches'}
              </div>
            )}
          </div>
        </div>

        {/* Right: interaction panel */}
        <div className="flex-1 min-w-0">
          {selectedFunction ? (
            <div
              className="p-5 space-y-4"
              style={{
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-surface)',
              }}
            >
              {/* Function header */}
              <div className="flex items-center gap-2.5">
                <span
                  className="px-2 py-0.5 text-[10px] font-bold uppercase font-mono"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                  }}
                >FN</span>
                <span className="text-base font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                  {selectedFunction}
                </span>
              </div>

              {/* Signature */}
              <div className="px-4 py-2.5" style={{
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
              }}>
                <code className="text-[12px] font-mono leading-relaxed">
                  <span style={{ color: 'var(--text-tertiary)' }}>fn </span>
                  <span style={{ color: 'var(--text-primary)' }}>{selectedFunction}</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>(</span>
                  {selectedFnParams.map(([key, value]: [string, any], i: number) => (
                    <span key={key}>
                      {i > 0 && <span style={{ color: 'var(--text-tertiary)' }}>, </span>}
                      <span style={{ color: 'var(--text-secondary)' }}>{key}</span>
                      <span style={{ color: 'var(--text-tertiary)' }}> : </span>
                      <span style={{ color: 'var(--text-tertiary)' }}>{value.type || 'any'}</span>
                    </span>
                  ))}
                  <span style={{ color: 'var(--text-tertiary)' }}>)</span>
                  {selectedFnOutput && (
                    <span>
                      <span style={{ color: 'var(--text-tertiary)' }}> → </span>
                      <span style={{ color: 'var(--text-tertiary)' }}>{typeof selectedFnOutput === 'object' ? selectedFnOutput.type || 'any' : selectedFnOutput}</span>
                    </span>
                  )}
                </code>
              </div>

              {/* Args */}
              {selectedFnParams.length > 0 && (
                <div className="space-y-3">
                  {selectedFnParams.map(([key, value]: [string, any]) => (
                    <div key={key}>
                      <label className="text-[11px] font-mono mb-1.5 block font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {key} <span style={{ color: 'var(--text-tertiary)' }}>:: {value.type || 'any'}</span>
                      </label>
                      {value.type === 'bool' ? (
                        <select
                          value={params[key] || ''}
                          onChange={(e) => handleParamChange(key, e.target.value)}
                          className="w-full px-3 py-2.5 text-[13px] font-mono focus:outline-none transition-all appearance-none cursor-pointer"
                          style={{
                            backgroundColor: 'var(--bg-input)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
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
                          className="w-full px-3 py-2.5 text-[13px] font-mono focus:outline-none transition-all"
                          style={{
                            backgroundColor: 'var(--bg-input)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Execute button */}
              <button
                onClick={handleExecute}
                disabled={loading || !selectedFunction || !client}
                className="w-full py-3 text-[12px] font-bold font-mono uppercase tracking-wider transition-all duration-150 disabled:opacity-30 flex items-center justify-center gap-2"
                style={{
                  backgroundColor: loading ? 'transparent' : 'var(--bg-input)',
                  border: '1px solid var(--border-strong)',
                  color: 'var(--text-primary)',
                }}
              >
                {loading ? (
                  <>
                    <span className="animate-pulse">_</span>
                    <span>Executing...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Execute {selectedFunction}</span>
                  </>
                )}
              </button>

              {/* Error */}
              {error && (
                <div style={{ border: '1px solid var(--border-color)' }}>
                  <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <span className="text-red-400 text-[11px] font-bold uppercase tracking-wider font-mono">error</span>
                    <button onClick={() => copyToClipboard(error)}>
                      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />}
                    </button>
                  </div>
                  <pre className="text-red-400/80 text-[12px] font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-96 overflow-y-auto p-4">
                    {error}
                  </pre>
                </div>
              )}

              {/* Result */}
              {result !== null && (
                <div style={{ border: '1px solid var(--border-color)' }}>
                  <div className="flex items-center justify-between px-4 py-2.5" style={{
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                  }}>
                    <span className="text-[11px] font-bold uppercase tracking-wider font-mono" style={{ color: 'var(--text-secondary)' }}>
                      Output
                    </span>
                    <button onClick={() => copyToClipboard(JSON.stringify(result, null, 2))}>
                      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />}
                    </button>
                  </div>
                  {(() => {
                    const isBase64Image = typeof result === 'string' && result.startsWith('data:image/')
                    const isImageUrl = typeof result === 'string' && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(result)

                    if (isBase64Image || isImageUrl) {
                      return (
                        <div className="p-4">
                          <img src={result} alt="Result" className="w-full h-auto" />
                        </div>
                      )
                    }

                    return (
                      <pre className="text-[13px] font-mono whitespace-pre-wrap break-all leading-relaxed p-4" style={{ color: 'var(--text-primary)' }}>
                        <code>{JSON.stringify(result, null, 2)}</code>
                      </pre>
                    )
                  })()}
                </div>
              )}
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center h-80"
              style={{
                border: '1px dashed var(--border-color)',
                backgroundColor: 'var(--bg-input)',
              }}
            >
              <Zap className="w-5 h-5 mb-3" style={{ color: 'var(--text-tertiary)' }} />
              <span className="text-[12px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                Select a function to execute
              </span>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .api-scroll {
          scrollbar-width: thin;
          scrollbar-color: var(--scrollbar-thumb) transparent;
        }
        .api-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .api-scroll::-webkit-scrollbar-thumb {
          background: var(--scrollbar-thumb);
          border-radius: 3px;
        }
        .api-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
    </div>
  )
}
