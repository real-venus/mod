"use client";

import { useState, useEffect } from 'react'
import { userContext } from '@/context'
import { ModuleType } from '@/types'
import { Clock, GitBranch, Hash, RotateCcw, ArrowUpDown } from 'lucide-react'
import { CopyButton } from '@/ui/CopyButton'
import { text2color } from '@/utils'

interface ModVersionsProps {
  mod: ModuleType
}

interface Version {
  data: string
  comment: string | null
  updated: string
}

export default function ModVersions({ mod }: ModVersionsProps) {
  const { client } = userContext()
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(false)

  const modColor = text2color(mod.name || mod.key)

  useEffect(() => {
    const fetchVersions = async () => {
      if (!client || !mod.key) return
      setLoading(true)
      setError(null)
      try {
        const vers = await client.call('versions', { key: mod.key, mod: mod.name })
        setVersions(Array.isArray(vers) ? vers : [])
      } catch (err: any) {
        setError(err?.message || 'Failed to load versions')
      } finally {
        setLoading(false)
      }
    }
    fetchVersions()
  }, [client, mod.key])

  const handleSetVersion = async (data: string, versionNum: number) => {
    if (!client || !mod.key) return
    try {
      await client.call('set_version', { key: mod.key, mod: mod.name, data })
    } catch (err: any) {
      alert(`Failed to set version: ${err?.message || 'Unknown error'}`)
    }
  }

  const sortedVersions = [...versions].sort((a, b) => {
    const timeA = new Date(a.updated).getTime()
    const timeB = new Date(b.updated).getTime()
    return sortAsc ? timeA - timeB : timeB - timeA
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 rounded-xl border-2" style={{ backgroundColor: `${modColor}15`, borderColor: modColor }}>
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-t-transparent" style={{ borderColor: modColor }} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl border-2" style={{ backgroundColor: `${modColor}15`, borderColor: '#ef4444' }}>
        <p className="text-red-400 text-sm font-mono">{error}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border-2 font-mono" style={{ backgroundColor: `${modColor}15`, borderColor: modColor }}>
      <div className="flex items-center justify-between p-3 border-b-2" style={{ borderColor: modColor }}>
        <h3 className="text-xl font-black" style={{ color: modColor, letterSpacing: '0.02em' }}>Versions</h3>
        <button
          onClick={() => setSortAsc(!sortAsc)}
          className="px-3 py-1.5 rounded-lg hover:opacity-80 transition-all flex items-center gap-2 text-xs font-semibold border"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)', color: modColor, borderColor: `${modColor}40` }}
        >
          <ArrowUpDown className="w-4 h-4" />
          {sortAsc ? 'Oldest' : 'Newest'}
        </button>
      </div>
      {versions.length === 0 ? (
        <p className="text-center py-8 text-base" style={{ color: `${modColor}80` }}>No versions found</p>
      ) : (
        <div className="max-h-96 overflow-y-auto space-y-2 p-3" style={{ scrollbarWidth: 'thin' }}>
          {sortedVersions.map((ver, idx) => {
            const originalIdx = versions.length - versions.indexOf(ver)
            return (
              <div
                key={versions.indexOf(ver)}
                className="p-3 rounded-lg border-2 hover:bg-opacity-90 transition-all"
                style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderColor: `${modColor}40` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1 bg-black/40 border rounded px-2 py-1" style={{ borderColor: `${modColor}40` }}>
                        <GitBranch className="w-4 h-4 flex-shrink-0" style={{ color: modColor }} />
                        <span className="font-black text-sm" style={{ color: modColor }}>v{originalIdx}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-black/40 border border-blue-500/30 rounded px-2 py-1">
                        <Clock className="w-4 h-4 flex-shrink-0" style={{ color: '#3b82f6' }} />
                        <span className="text-xs text-blue-400 font-mono">{ver.updated}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-black/40 border border-green-500/30 rounded px-2 py-1">
                      <Hash className="w-4 h-4 flex-shrink-0" style={{ color: '#10b981' }} />
                      <code className="text-xs font-mono" style={{ color: '#10b981' }}>
                        {ver.data.slice(0, 12)}...{ver.data.slice(-8)}
                      </code>
                      <CopyButton text={ver.data} size="sm" />
                    </div>
                    {ver.comment && (
                      <p className="text-xs truncate" style={{ color: `${modColor}80` }}>{ver.comment}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleSetVersion(ver.data, originalIdx)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold hover:opacity-90 transition-all flex items-center gap-2 flex-shrink-0 border"
                    style={{ backgroundColor: '#10b981', color: '#fff', borderColor: '#10b981' }}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Set
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
