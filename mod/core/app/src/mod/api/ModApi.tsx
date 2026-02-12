"use client";

import { useState, useEffect } from 'react'
import { userContext } from '@/context'
import { ModuleType } from '@/types'
import { text2color } from '@/utils'
import { SchemaParamsPanel } from '@/chat/components/SchemaParamsPanel'
import { CopyButton } from '@/ui/CopyButton'
import { Play, Code, Zap } from 'lucide-react'

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
      const res = await client.call(selectedFunction, { ...params, mod: mod.name, key: mod.key })
      setResult(res)
    } catch (err: any) {
      setError(err?.message || 'Execution failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border-2 font-mono" style={{ backgroundColor: `${modColor}15`, borderColor: modColor }}>
      <div className="flex items-center justify-between p-3 border-b-2" style={{ borderColor: modColor }}>
        <h3 className="text-xl font-black" style={{ color: modColor, letterSpacing: '0.02em' }}>API Schema</h3>
        <div className="flex items-center gap-2">
          <Code className="w-5 h-5" style={{ color: modColor }} />
          <span className="text-sm" style={{ color: `${modColor}80` }}>{functions.length} functions</span>
        </div>
      </div>

      <div className="p-3 space-y-3">
        <div>
          <label className="text-sm font-bold mb-2 block" style={{ color: modColor, fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}>Select Function</label>
          <select
            value={selectedFunction}
            onChange={(e) => {
              setSelectedFunction(e.target.value)
              handleResetParams()
            }}
            className="w-full border-2 bg-black/40 px-4 py-3 rounded-lg text-lg font-bold backdrop-blur-sm focus:outline-none focus:ring-2"
            style={{ borderColor: `${modColor}40`, color: modColor, fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
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
        />

        <button
          onClick={handleExecute}
          disabled={loading || !selectedFunction}
          className="w-full px-6 py-4 rounded-xl font-black text-xl uppercase transition-all duration-300 border-2 shadow-2xl flex items-center justify-center gap-3"
          style={{
            backgroundColor: loading ? 'rgba(0,0,0,0.4)' : `${modColor}30`,
            borderColor: modColor,
            color: modColor,
            fontFamily: 'Press Start 2P, IBM Plex Mono, monospace',
            textTransform: 'lowercase',
            textShadow: `0 0 20px ${modColor}80`,
            boxShadow: `0 0 30px ${modColor}40`
          }}
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-t-transparent" style={{ borderColor: modColor }} />
              executing...
            </>
          ) : (
            <>
              <Zap className="w-6 h-6" />
              execute
            </>
          )}
        </button>

        {error && (
          <div className="p-4 rounded-xl border-2 border-red-500/50" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-red-400 font-bold text-sm uppercase">Error</h4>
              <CopyButton text={error} />
            </div>
            <pre className="text-red-400 text-sm font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-96 overflow-y-auto p-3 rounded-lg bg-black/30">
              {error}
            </pre>
          </div>
        )}

        {result !== null && (
          <div className="rounded-xl border-2 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderColor: `${modColor}40` }}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-black" style={{ color: modColor, fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}>Result</h4>
              <CopyButton text={JSON.stringify(result, null, 2)} />
            </div>
            {(() => {
              // Check if result is a base64 image string
              const isBase64Image = typeof result === 'string' && result.startsWith('data:image/');
              // Check if result is an image URL
              const isImageUrl = typeof result === 'string' && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(result);
              // Check if result object has an image field
              const hasImageField = typeof result === 'object' && result !== null &&
                (result.image || result.url || result.data) &&
                (typeof result.image === 'string' && (result.image.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(result.image)) ||
                 typeof result.url === 'string' && (result.url.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(result.url)) ||
                 typeof result.data === 'string' && (result.data.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(result.data)));

              const imageSource = isBase64Image || isImageUrl ? result :
                                hasImageField ? (result.image || result.url || result.data) : null;

              if (imageSource) {
                return (
                  <div className="space-y-3">
                    <div className="rounded-lg overflow-hidden border-2" style={{ borderColor: `${modColor}40`, backgroundColor: '#0a0a0a' }}>
                      <img
                        src={imageSource as string}
                        alt="Result"
                        className="w-full h-auto"
                        style={{ maxHeight: 'none' }}
                      />
                    </div>
                    {hasImageField && (
                      <pre className="text-sm overflow-x-auto p-3 rounded-lg" style={{ backgroundColor: '#0a0a0a', color: modColor }}>
                        <code>{JSON.stringify(result, null, 2)}</code>
                      </pre>
                    )}
                  </div>
                );
              }

              return (
                <pre className="text-sm overflow-x-auto p-3 rounded-lg" style={{ backgroundColor: '#0a0a0a', color: modColor }}>
                  <code>{JSON.stringify(result, null, 2)}</code>
                </pre>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
