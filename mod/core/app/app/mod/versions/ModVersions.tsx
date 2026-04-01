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
  selectedVersionIndex?: number
  onVersionChange?: (index: number) => void
}

interface Version {
  cid: string
  data: string
  comment: string | null
  updated: string
  created: string
}

export default function ModVersions({ mod, selectedVersionIndex = 0, onVersionChange }: ModVersionsProps) {
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
    <div className="font-mono space-y-4 relative" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
      {/* Cyberpunk ambient glow */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 left-0 w-64 h-64 bg-cyan-500/30 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-500/30 blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between relative px-4 py-3" style={{
        border: '2px solid rgba(6, 182, 212, 0.3)',
        background: 'rgba(6, 182, 212, 0.05)',
        boxShadow: '0 0 20px rgba(6, 182, 212, 0.1)'
      }}>
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-400" />
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-purple-400" />

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-extrabold text-cyan-400 uppercase" style={{ textShadow: '0 0 10px rgba(6, 182, 212, 0.6)' }}>► VER</span>
          <h3 className="text-[13px] font-extrabold uppercase tracking-[0.15em] text-cyan-400" style={{ textShadow: '0 0 10px rgba(6, 182, 212, 0.4)' }}>
            Version History
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-purple-400 px-2 py-1" style={{
            border: '1px solid rgba(168, 85, 247, 0.3)',
            textShadow: '0 0 8px rgba(168, 85, 247, 0.5)'
          }}>
            {versions.length} version{versions.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setSortAsc(!sortAsc)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold transition-all uppercase"
            style={{
              color: '#06b6d4',
              border: '2px solid rgba(6, 182, 212, 0.3)',
              boxShadow: '0 0 15px rgba(6, 182, 212, 0.15)',
              textShadow: '0 0 8px rgba(6, 182, 212, 0.4)'
            }}
          >
            <ArrowUpDown className="w-3 h-3" />
            {sortAsc ? 'Oldest' : 'Newest'}
          </button>
        </div>
      </div>

      {versions.length === 0 ? (
        <div className="text-center py-12 relative" style={{
          border: '2px dashed rgba(6, 182, 212, 0.3)',
          background: 'rgba(6, 182, 212, 0.05)'
        }}>
          {/* Scanline effect */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0" style={{
              background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(6, 182, 212, 0.1) 2px, rgba(6, 182, 212, 0.1) 4px)'
            }} />
          </div>
          <p className="text-[13px] font-bold uppercase tracking-wider text-cyan-400 relative" style={{ textShadow: '0 0 10px rgba(6, 182, 212, 0.5)' }}>
            // NO VERSIONS FOUND //
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar relative">
          {sortedVersions.map((ver, idx) => {
            const originalIdx = versions.length - versions.indexOf(ver)
            const versionIndex = versions.indexOf(ver)
            const isSelected = versionIndex === selectedVersionIndex
            return (
              <div
                key={versionIndex}
                className="flex items-center justify-between gap-4 px-4 py-3 transition-all group cursor-pointer relative"
                onClick={() => onVersionChange?.(versionIndex)}
                style={{
                  border: isSelected ? `2px solid rgba(6, 182, 212, 0.5)` : '2px solid rgba(6, 182, 212, 0.2)',
                  backgroundColor: isSelected ? 'rgba(6, 182, 212, 0.1)' : 'var(--bg-input)',
                  boxShadow: isSelected ? '0 0 25px rgba(6, 182, 212, 0.25)' : 'none',
                }}
              >
                {isSelected && (
                  <>
                    <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-400" />
                    <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-400" />
                  </>
                )}

                <div className="flex items-center gap-4 flex-1 min-w-0 relative">
                  {/* Version number */}
                  <div className="flex items-center gap-1.5">
                    <GitBranch className="w-4 h-4 flex-shrink-0 text-cyan-400" style={{ filter: 'drop-shadow(0 0 4px rgba(6, 182, 212, 0.5))' }} />
                    <span className="text-[13px] font-extrabold text-cyan-400" style={{ textShadow: '0 0 10px rgba(6, 182, 212, 0.6)' }}>
                      v{originalIdx}
                      {isSelected && <span className="ml-2 text-[10px] font-bold text-purple-400" style={{ textShadow: '0 0 8px rgba(168, 85, 247, 0.6)' }}>(ACTIVE)</span>}
                    </span>
                  </div>

                  {/* Date */}
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 flex-shrink-0 text-purple-400" />
                    <span className="text-[11px] font-mono text-purple-400">{ver.updated}</span>
                  </div>

                  {/* Hash */}
                  <div className="flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 flex-shrink-0 text-cyan-400/70" />
                    <code className="text-[11px] font-mono text-cyan-400/70">
                      {ver.data.slice(0, 8)}...{ver.data.slice(-6)}
                    </code>
                    <CopyButton text={ver.data} size="sm" />
                  </div>

                  {/* Comment */}
                  {ver.comment && (
                    <span className="text-[11px] truncate text-purple-400/70">{ver.comment}</span>
                  )}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSetVersion(ver.data, originalIdx)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all opacity-60 group-hover:opacity-100 relative"
                  style={{
                    color: '#06b6d4',
                    border: `2px solid rgba(6, 182, 212, 0.3)`,
                    backgroundColor: 'transparent',
                    boxShadow: '0 0 15px rgba(6, 182, 212, 0.1)',
                    textShadow: '0 0 8px rgba(6, 182, 212, 0.4)'
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
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
