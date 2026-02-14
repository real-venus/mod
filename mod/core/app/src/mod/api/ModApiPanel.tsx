"use client";

import { useState, useEffect, useMemo } from 'react'
import { userContext } from '@/context'
import { text2color, colorWithOpacity } from '@/utils'
import { SchemaParamsPanel } from '@/chat/components/SchemaParamsPanel'
import { CopyButton } from '@/ui/CopyButton'
import { Zap } from 'lucide-react'

interface ModApiPanelProps {
  selectedModule: string
  selectedFunction: string
  modules: any[]
  schema: any
  params: Record<string, any>
  handleParamChange: (key: string, value: string) => void
  handleResetParams: () => void
}

export default function ModApiPanel({
  selectedModule,
  selectedFunction,
  modules,
  schema,
  params,
  handleParamChange,
  handleResetParams
}: ModApiPanelProps) {
  const { client } = userContext()
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Find the selected module from modules array
  const mod = useMemo(() => {
    return modules.find(m => m.name === selectedModule)
  }, [selectedModule, modules])

  const modColor = useMemo(() => {
    return mod ? text2color(mod.name || mod.key) : '#8b5cf6'
  }, [mod])

  const functions = Object.keys(schema || {})

  const handleExecute = async () => {
    if (!client || !selectedFunction || !mod) return
    setLoading(true)
    setError(null)
    try {
      const res = await client.call(selectedFunction, { ...params, mod: mod.name, key: mod.key })
      setResult(res)
    } catch (err: any) {
      setError(err?.message || 'Execution failed')
    } finally {
      setLoading(false)
    }
  }

  if (!mod) {
    return (
      <div className="h-full flex items-center justify-center p-4 bg-black font-mono" style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>
        <p className="text-[12px] text-white/40 font-bold uppercase tracking-wider">Select a module to view API</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-4 bg-black font-mono" style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>
      {/* Header */}
      <div className="mb-4 overflow-hidden border border-white/[0.12] bg-[#0d0d0d]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.08]">
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

        <div className="p-5 space-y-4">
          {selectedFunction && schema && schema[selectedFunction] && (
            <SchemaParamsPanel
              selectedFunction={selectedFunction}
              schema={schema}
              params={params}
              handleParamChange={handleParamChange}
              handleResetParams={handleResetParams}
              numColumns={2}
            />
          )}

          <button
            onClick={handleExecute}
            disabled={loading || !selectedFunction}
            className="w-full px-5 py-3 font-extrabold text-[11px] uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 border-2 disabled:opacity-30"
            style={{
              background: loading ? 'transparent' : colorWithOpacity(modColor, 0.15),
              borderColor: colorWithOpacity(modColor, loading ? 0.15 : 0.5),
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

          {error && (
            <div className="overflow-hidden border-2 border-red-500/30 bg-red-500/[0.04]">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-red-500/20">
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

          {result !== null && (
            <div className="overflow-hidden border border-white/[0.12] bg-black/30">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.08]">
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
                      <div className="overflow-hidden border border-white/[0.1]" style={{ backgroundColor: '#06060a' }}>
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
                  <pre className="text-[12px] font-medium overflow-x-auto p-4 m-3" style={{ backgroundColor: '#06060a', color: colorWithOpacity(modColor, 0.85) }}>
                    <code>{JSON.stringify(result, null, 2)}</code>
                  </pre>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
