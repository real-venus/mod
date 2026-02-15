"use client";

import { useState, useEffect } from 'react'
import { userContext } from '@/context'
import { ModuleType } from '@/types'
import { text2color, colorWithOpacity } from '@/utils'
import { SchemaParamsPanel } from '@/chat/components/SchemaParamsPanel'
import { CopyButton } from '@/ui/CopyButton'
import { Zap } from 'lucide-react'

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

  const modColor = text2color(mod.name || mod.key)
  const schema = mod.schema || {}
  const functions = Object.keys(schema)

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-extrabold" style={{ color: modColor }}>[API]</span>
          <h3 className="text-[12px] font-extrabold text-white/60 uppercase tracking-[0.15em]">
            API Schema
          </h3>
        </div>
        <span className="text-[10px] font-bold text-amber-400/40">
          {functions.length} fn{functions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Function selector */}
      <div>
        <label className="text-[10px] font-extrabold text-cyan-400/50 uppercase tracking-[0.2em] mb-1.5 block">
          SELECT FUNCTION
        </label>
        <select
          value={selectedFunction}
          onChange={(e) => {
            setSelectedFunction(e.target.value)
            handleResetParams()
          }}
          className="w-full bg-white/[0.04] px-3 py-2.5 text-[13px] font-mono font-bold focus:outline-none focus:border-white/30 transition-all border border-white/[0.1]"
          style={{
            color: modColor,
            fontFamily: 'IBM Plex Mono, Courier New, monospace',
          }}
        >
          {functions.map(fn => (
            <option key={fn} value={fn}>{fn}</option>
          ))}
        </select>
      </div>

      <SchemaParamsPanel
        selectedFunction={selectedFunction}
        schema={schema}
        params={params}
        handleParamChange={handleParamChange}
        handleResetParams={handleResetParams}
        numColumns={2}
        modColor={modColor}
      />

      {/* Execute button */}
      <button
        onClick={handleExecute}
        disabled={loading || !selectedFunction}
        className="w-full px-5 py-3 font-extrabold text-[11px] uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 border disabled:opacity-30"
        style={{
          background: loading ? 'transparent' : colorWithOpacity(modColor, 0.08),
          borderColor: colorWithOpacity(modColor, loading ? 0.15 : 0.3),
          color: loading ? colorWithOpacity(modColor, 0.5) : modColor,
        }}
      >
        {loading ? (
          <>
            <span className="animate-pulse">_</span>
            <span>EXECUTING...</span>
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            <span>EXECUTE</span>
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="overflow-hidden border border-red-500/20 bg-red-500/[0.04]">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-red-500/10">
            <div className="flex items-center gap-2">
              <span className="text-red-400 text-[11px] font-extrabold">[ERR]</span>
              <h4 className="text-red-400/80 text-[10px] font-extrabold uppercase tracking-wider">Error</h4>
            </div>
            <CopyButton text={error} />
          </div>
          <pre className="text-red-400/70 text-[12px] font-mono font-medium overflow-x-auto whitespace-pre-wrap break-words max-h-96 overflow-y-auto p-4">
            {error}
          </pre>
        </div>
      )}

      {/* Result */}
      {result !== null && (
        <div className="overflow-hidden border border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold" style={{ color: colorWithOpacity(modColor, 0.8) }}>[RES]</span>
              <h4 className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: colorWithOpacity(modColor, 0.7) }}>
                Result
              </h4>
            </div>
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
                    <pre className="text-[12px] font-medium overflow-x-auto p-4" style={{ backgroundColor: '#06060a', color: colorWithOpacity(modColor, 0.75) }}>
                      <code>{JSON.stringify(result, null, 2)}</code>
                    </pre>
                  )}
                </div>
              );
            }

            return (
              <pre className="text-[12px] font-medium overflow-x-auto p-4" style={{ backgroundColor: '#06060a', color: colorWithOpacity(modColor, 0.85) }}>
                <code>{JSON.stringify(result, null, 2)}</code>
              </pre>
            );
          })()}
        </div>
      )}
    </div>
  )
}
