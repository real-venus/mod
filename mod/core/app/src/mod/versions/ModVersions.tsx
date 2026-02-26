"use client";

import { useState, useEffect } from 'react'
import { userContext } from '@/context'
import { ModuleType } from '@/types'
import { Clock, GitBranch, Hash, RotateCcw, ArrowUpDown } from 'lucide-react'
import { CopyButton } from '@/ui/CopyButton'
import { text2color, colorWithOpacity } from '@/utils'
import { toast } from 'react-toastify'

interface ModVersionsProps {
  mod: ModuleType
}

interface Version {
  cid: string
  data: string
  comment: string | null
  updated: string
  created: string
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
      toast.error(`Failed to set version: ${err?.message || 'Unknown error'}`)
    }
  }

  const sortedVersions = [...versions].sort((a, b) => {
    const timeA = new Date(a.updated).getTime()
    const timeB = new Date(b.updated).getTime()
    return sortAsc ? timeA - timeB : timeB - timeA
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-3">
          <span className="animate-pulse font-extrabold" style={{ color: modColor }}>_</span>
          <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Loading versions...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg" style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)' }}>
        <p className="text-red-500 text-[12px] font-mono">{error}</p>
      </div>
    )
  }

  return (
    <div className="font-mono space-y-4" style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-extrabold" style={{ color: modColor }}>[VER]</span>
          <h3 className="text-[12px] font-extrabold uppercase tracking-[0.15em]" style={{ color: 'var(--text-secondary)' }}>
            Versions
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold" style={{ color: 'var(--text-tertiary)' }}>
            {versions.length} version{versions.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setSortAsc(!sortAsc)}
            className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold transition-all rounded-md"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
          >
            <ArrowUpDown className="w-3 h-3" />
            {sortAsc ? 'Oldest' : 'Newest'}
          </button>
        </div>
      </div>

      {versions.length === 0 ? (
        <p className="text-center py-8 text-[12px]" style={{ color: 'var(--text-tertiary)' }}>No versions found</p>
      ) : (
        <div className="space-y-1 max-h-[500px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {sortedVersions.map((ver, idx) => {
            const originalIdx = versions.length - versions.indexOf(ver)
            return (
              <div
                key={versions.indexOf(ver)}
                className="flex items-center justify-between gap-4 px-4 py-3 transition-all group rounded-lg"
                style={{
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                }}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Version number */}
                  <div className="flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5 flex-shrink-0" style={{ color: modColor }} />
                    <span className="text-[12px] font-extrabold" style={{ color: modColor }}>v{originalIdx}</span>
                  </div>

                  {/* Date */}
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                    <span className="text-[11px] font-mono" style={{ color: 'var(--text-secondary)' }}>{ver.updated}</span>
                  </div>

                  {/* Hash */}
                  <div className="flex items-center gap-1.5">
                    <Hash className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                    <code className="text-[11px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {ver.data.slice(0, 8)}...{ver.data.slice(-6)}
                    </code>
                    <CopyButton text={ver.data} size="sm" />
                  </div>

                  {/* Comment */}
                  {ver.comment && (
                    <span className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>{ver.comment}</span>
                  )}
                </div>

                <button
                  onClick={() => handleSetVersion(ver.data, originalIdx)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all opacity-50 group-hover:opacity-100 rounded-md"
                  style={{
                    color: modColor,
                    border: `1px solid ${colorWithOpacity(modColor, 0.4)}`,
                    backgroundColor: 'transparent',
                  }}
                >
                  <RotateCcw className="w-3 h-3" />
                  Set
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
