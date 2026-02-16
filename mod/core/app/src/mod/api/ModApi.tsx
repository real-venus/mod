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
      className="font-mono space-y-4"
      style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
    >
      {/* Search + Function selector */}
      {functions.length > 8 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.2)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="search functions..."
            className="w-full pl-9 pr-3 py-2 text-[11px] font-bold bg-transparent border outline-none"
            style={{
              color: 'rgba(255,255,255,0.6)',
              borderColor: search ? colorWithOpacity(modColor, 0.3) : 'rgba(255,255,255,0.06)',
            }}
          />
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {filteredFunctions.map(fn => {
          const isActive = selectedFunction === fn
          return (
            <button
              key={fn}
              onClick={() => {
                setSelectedFunction(fn)
                handleResetParams()
              }}
              className="px-3 py-1.5 text-[11px] font-bold transition-all"
              style={{
                color: isActive ? modColor : 'rgba(255,255,255,0.35)',
                backgroundColor: isActive ? colorWithOpacity(modColor, 0.1) : 'transparent',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: isActive ? colorWithOpacity(modColor, 0.3) : 'rgba(255,255,255,0.06)',
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
        className="w-full px-5 py-2.5 font-extrabold text-[11px] uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-30"
        style={{
          background: loading ? 'transparent' : colorWithOpacity(modColor, 0.06),
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: colorWithOpacity(modColor, loading ? 0.1 : 0.2),
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
            <Zap className="w-3.5 h-3.5" />
            <span>execute {selectedFunction}</span>
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="border border-red-500/15 bg-red-500/[0.03]">
          <div className="flex items-center justify-between px-4 py-2 border-b border-red-500/10">
            <span className="text-red-400/70 text-[11px] font-bold">error</span>
            <CopyButton text={error} />
          </div>
          <pre className="text-red-400/60 text-[12px] font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-96 overflow-y-auto p-4">
            {error}
          </pre>
        </div>
      )}

      {/* Result */}
      {result !== null && (
        <div className="border border-white/[0.06]">
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.05]">
            <span className="text-[11px] font-bold" style={{ color: colorWithOpacity(modColor, 0.5) }}>
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
                <div className="p-4 space-y-3">
                  <div className="overflow-hidden" style={{ backgroundColor: '#06060a' }}>
                    <img
                      src={imageSource as string}
                      alt="Result"
                      className="w-full h-auto"
                      style={{ maxHeight: 'none' }}
                    />
                  </div>
                  {hasImageField && (
                    <pre className="text-[12px] font-medium overflow-x-auto p-4" style={{ backgroundColor: '#06060a', color: colorWithOpacity(modColor, 0.6) }}>
                      <code>{JSON.stringify(result, null, 2)}</code>
                    </pre>
                  )}
                </div>
              );
            }

            return (
              <pre className="text-[12px] font-medium overflow-x-auto p-4" style={{ backgroundColor: '#06060a', color: colorWithOpacity(modColor, 0.7) }}>
                <code>{JSON.stringify(result, null, 2)}</code>
              </pre>
            );
          })()}
        </div>
      )}
    </div>
  )
}
