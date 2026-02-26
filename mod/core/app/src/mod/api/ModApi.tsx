"use client";

import { useState, useEffect } from 'react'
import { userContext } from '@/context'
import { ModuleType } from '@/types'
import { text2color, colorWithOpacity } from '@/utils'
import { SchemaParamsPanel } from '@/chat/components/SchemaParamsPanel'
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
  const [search, setSearch] = useState('')

  const modColor = text2color(mod.name || mod.key)
  const schema = mod.schema || {}
  const functions = Object.keys(schema)
  const filteredFunctions = search
    ? functions.filter(fn => fn.toLowerCase().includes(search.toLowerCase()))
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

  return (
    <div
      className="font-mono space-y-5"
      style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
    >
      {/* Search */}
      {functions.length > 8 && (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: colorWithOpacity(modColor, 0.3) }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="search functions..."
            className="w-full pl-11 pr-4 py-3 text-[13px] font-bold bg-transparent outline-none rounded-xl transition-all"
            style={{
              color: 'var(--text-primary)',
              borderWidth: '1.5px',
              borderStyle: 'solid',
              borderColor: search ? colorWithOpacity(modColor, 0.3) : 'var(--border-color)',
              backgroundColor: 'var(--bg-input)',
            }}
          />
        </div>
      )}

      {/* Function selector */}
      <div className="flex flex-wrap gap-2">
        {filteredFunctions.map(fn => {
          const isActive = selectedFunction === fn
          return (
            <button
              key={fn}
              onClick={() => {
                setSelectedFunction(fn)
                handleResetParams()
              }}
              className="px-4 py-2 text-[13px] font-extrabold transition-all rounded-xl"
              style={{
                color: isActive ? modColor : 'var(--text-tertiary)',
                backgroundColor: isActive ? colorWithOpacity(modColor, 0.12) : 'transparent',
                borderWidth: '1.5px',
                borderStyle: 'solid',
                borderColor: isActive ? colorWithOpacity(modColor, 0.35) : 'var(--border-color)',
              }}
            >
              {fn}
            </button>
          )
        })}
      </div>

      {/* Params */}
      <SchemaParamsPanel
        selectedFunction={selectedFunction}
        schema={schema}
        params={params}
        handleParamChange={handleParamChange}
        handleResetParams={handleResetParams}
        numColumns={2}
        modColor={modColor}
      />

      {/* Execute */}
      <button
        onClick={handleExecute}
        disabled={loading || !selectedFunction}
        className="w-full px-6 py-3.5 font-extrabold text-[14px] uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2.5 disabled:opacity-30 rounded-xl"
        style={{
          background: loading ? 'transparent' : colorWithOpacity(modColor, 0.1),
          borderWidth: '2px',
          borderStyle: 'solid',
          borderColor: colorWithOpacity(modColor, loading ? 0.15 : 0.3),
          color: loading ? colorWithOpacity(modColor, 0.4) : modColor,
        }}
      >
        {loading ? (
          <>
            <span className="animate-pulse">_</span>
            <span>executing...</span>
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            <span>execute {selectedFunction}</span>
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
        <div className="rounded-xl overflow-hidden" style={{ border: `1.5px solid ${colorWithOpacity(modColor, 0.15)}` }}>
          <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${colorWithOpacity(modColor, 0.1)}` }}>
            <span className="text-[13px] font-extrabold uppercase tracking-wider" style={{ color: colorWithOpacity(modColor, 0.6) }}>
              result
            </span>
            <CopyButton text={JSON.stringify(result, null, 2)} />
          </div>
          {(() => {
            const isBase64Image = typeof result === 'string' && result.startsWith('data:image/');
            const isImageUrl = typeof result === 'string' && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(result);
            const hasImageField = typeof result === 'object' && result !== null &&
              (result.image || result.url || result.data) &&
              (typeof result.image === 'string' && (result.image.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(result.image)) ||
               typeof result.url === 'string' && (result.url.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(result.url)) ||
               typeof result.data === 'string' && (result.data.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(result.data)));

            const imageSource = isBase64Image || isImageUrl ? result :
                              hasImageField ? (result.image || result.url || result.data) : null;

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
              );
            }

            return (
              <pre className="text-[13px] font-medium overflow-x-auto p-5" style={{ backgroundColor: 'var(--bg-input)', color: colorWithOpacity(modColor, 0.7) }}>
                <code>{JSON.stringify(result, null, 2)}</code>
              </pre>
            );
          })()}
        </div>
      )}
    </div>
  )
}
