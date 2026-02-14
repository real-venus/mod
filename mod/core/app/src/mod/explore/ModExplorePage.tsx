"use client";

import React, { useEffect, useMemo, useState } from 'react'
import ModCard from '../ModCard'
import { ModCardSettings } from '../ModCardSettings'
import { ModuleType } from '@/types'
import { useSearchContext } from '@/context/SearchContext'
import { userContext } from '@/context'
import { X, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'

type SortKey = 'recent' | 'name' | 'author' | 'balance' | 'updated' | 'created'

export default function ModExplorePage() {
  const { client, user } = userContext()
  const { searchFilters, handleSearch } = useSearchContext()

  const [mods, setMods] = useState<ModuleType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('mod_explorer_sort') as SortKey) || 'recent'
    }
    return 'recent'
  })
  const [columns, setColumns] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('mod_explorer_columns') || '2')
    }
    return 2
  })

  const [selectedOwners, setSelectedOwners] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)

  const searchTermToUse = searchFilters.searchTerm?.trim() || ''

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mod_explorer_sort', sort)
    }
  }, [sort])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mod_explorer_columns', columns.toString())
    }
  }, [columns])

  const sortModules = (list: ModuleType[]) => {
    const sortOrder = typeof window !== 'undefined'
      ? (localStorage.getItem('mod_explorer_sort_order') || 'desc')
      : 'desc'

    const sorted = [...list]

    switch (sort) {
      case 'name':
        sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        break
      case 'author':
        sorted.sort((a, b) => (a.key || '').localeCompare(b.key || ''))
        break
      case 'updated':
        sorted.sort((a, b) => (b.updated || 0) - (a.updated || 0))
        break
      case 'created':
        sorted.sort((a, b) => (b.created || 0) - (a.created || 0))
        break
      case 'recent':
      default:
        sorted.sort((a, b) => (b.updated || b.created || 0) - (a.updated || a.created || 0))
    }

    return sortOrder === 'asc' ? sorted.reverse() : sorted
  }

  const fetchAll = async () => {
    setLoading(true)
    setError(null)
    try {
      if (!client) {
        setError('Client not initialized')
        return
      }

      const params: any = {}
      if (searchTermToUse) {
        params.search = searchTermToUse
      }

      if (selectedOwners.length === 1) {
        params.key = selectedOwners[0]
      }

      console.log('Fetching modules with params:', params)
      console.log('Selected owners:', selectedOwners)

      const raw = (await client.call('mods', params)) as ModuleType[]
      const allMods = Array.isArray(raw) ? raw : []

      console.log('Server returned modules:', allMods.length)
      console.log('Search term:', searchTermToUse)

      const sorted = sortModules(allMods)
      setMods(sorted)
    } catch (err: any) {
      console.error('Error fetching modules:', err)
      setError(err?.message || 'Failed to load modules')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [client, searchTermToUse, sort, selectedOwners])

  const uniqueOwners = useMemo(() => {
    const owners = new Set<string>()
    mods.forEach(mod => {
      if (mod.key) owners.add(mod.key)
    })
    return Array.from(owners).sort()
  }, [mods])

  const filteredMods = useMemo(() => {
    if (selectedOwners.length === 0) return mods
    return mods.filter(mod => selectedOwners.includes(mod.key))
  }, [mods, selectedOwners])

  const totalPages = Math.ceil(filteredMods.length / itemsPerPage)

  const paginatedMods = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredMods.slice(startIndex, endIndex)
  }, [filteredMods, currentPage, itemsPerPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTermToUse, selectedOwners, sort])

  const toggleOwner = (owner: string) => {
    setSelectedOwners(prev =>
      prev.includes(owner) ? prev.filter(o => o !== owner) : [...prev, owner]
    )
  }

  const clearOwnerFilters = () => {
    setSelectedOwners([])
  }

  const gridColsClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  }[columns] || 'grid-cols-1 md:grid-cols-2'

  return (
    <div className="min-h-screen bg-black text-white font-mono relative overflow-hidden pt-20" style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>
      {/* CRT scanline overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-10 opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)',
        }}
      />

      <main className="relative flex-1 px-6 pt-6 pb-0 z-20" role="main">
        <div className="mx-auto mb-6" style={{ maxWidth: '100%' }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-green-400 text-[12px] font-extrabold">[SYS]</span>

              </div>
              {searchTermToUse && (
                <span className="text-[12px] text-cyan-400/60 font-bold font-mono">
                  &gt; &quot;{searchTermToUse}&quot;
                </span>
              )}
              <span className="text-[11px] text-amber-400/40 font-bold font-mono uppercase tracking-wider">
                {filteredMods.length} mod{filteredMods.length !== 1 ? 's' : ''}
              </span>
            </div>
            <ModCardSettings
              sort={sort}
              onSortChange={setSort}
              columns={columns}
              onColumnsChange={setColumns}
              owners={uniqueOwners}
              selectedOwners={selectedOwners}
              onToggleOwner={toggleOwner}
              onClearFilters={clearOwnerFilters}
            />
          </div>
        </div>

        {error && (
          <div className="mx-auto mb-4" style={{ maxWidth: '100%' }}>
            <div className="bg-[#0d0d0d] border-2 border-red-500/40 flex items-start justify-between">
              <div className="flex-1 px-5 py-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-red-400 text-[11px] font-extrabold">[ERR]</span>
                  <span className="text-red-400 font-extrabold text-[11px] uppercase tracking-wider">ERROR</span>
                </div>
                <div className="text-red-400/70 text-[12px] font-medium">{error}</div>
              </div>
              <div className="flex gap-px p-3">
                <button
                  onClick={fetchAll}
                  className="flex items-center gap-2 px-4 py-2 border-2 border-red-500/40 text-red-400 hover:bg-red-500/10 transition-all text-[10px] font-extrabold uppercase tracking-wider"
                >
                  <RotateCcw size={14} strokeWidth={2.5} />
                  RETRY
                </button>
                <button
                  onClick={() => setError(null)}
                  className="p-2 border-2 border-red-500/40 text-red-400 hover:bg-red-500/10 transition-all"
                >
                  <X size={14} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && filteredMods.length === 0 && !error && (
          <div className="mx-auto max-w-4xl text-center py-16">
            <div className="bg-[#0d0d0d] border border-white/[0.12] px-8 py-12">
              <span className="text-cyan-400/30 text-[12px] font-bold mb-2 block">---</span>
              <div className="text-white/50 text-[13px] font-bold mb-4 uppercase tracking-wider">
                {searchTermToUse || selectedOwners.length > 0 ? 'NO MODULES MATCH YOUR FILTERS' : 'NO MODULES YET'}
              </div>
              {(searchTermToUse || selectedOwners.length > 0) && (
                <div className="text-white/30 text-[11px] font-medium space-y-2">
                  {searchTermToUse && (
                    <div>Search: <span className="text-cyan-400 font-bold">&quot;{searchTermToUse}&quot;</span></div>
                  )}
                  {selectedOwners.length > 0 && (
                    <div>Owners: <span className="text-cyan-400 font-bold">{selectedOwners.length} selected</span></div>
                  )}
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        handleSearch('')
                        clearOwnerFilters()
                      }}
                      className="px-5 py-2 bg-blue-500 hover:bg-blue-400 text-black text-[10px] font-extrabold uppercase tracking-wider transition-colors"
                    >
                      CLEAR ALL FILTERS
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3">
              <span className="text-green-400 animate-pulse font-extrabold">_</span>
              <span className="text-[12px] text-green-400/50 font-bold">LOADING MODULES...</span>
            </div>
          </div>
        )}

        <div className={`mx-auto grid ${gridColsClass} gap-px bg-white/[0.04] mt-2`} style={{ maxWidth: '100%' }}>
          {paginatedMods.map((mod) => (
            <div key={`${mod.name}-${mod.key}`}>
              <ModCard mod={mod} card_enabled={true} />
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="mx-auto flex items-center justify-center gap-2 py-8" style={{ maxWidth: '100%' }}>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-4 py-2 border border-blue-500/20 text-blue-400/50 hover:text-blue-400/80 hover:bg-blue-500/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all text-[10px] font-extrabold uppercase tracking-wider"
            >
              <ChevronLeft size={14} strokeWidth={2.5} />
              PREV
            </button>

            <div className="flex items-center gap-px">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-9 h-9 text-[11px] font-extrabold transition-all ${
                      currentPage === pageNum
                        ? 'bg-blue-500 text-black border-2 border-blue-400'
                        : 'bg-[#0d0d0d] border border-blue-500/20 text-blue-400/40 hover:text-blue-400/70 hover:bg-blue-500/[0.06]'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-4 py-2 border border-blue-500/20 text-blue-400/50 hover:text-blue-400/80 hover:bg-blue-500/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all text-[10px] font-extrabold uppercase tracking-wider"
            >
              NEXT
              <ChevronRight size={14} strokeWidth={2.5} />
            </button>

            <div className="ml-3 px-3 py-2 bg-[#0d0d0d] border border-green-500/20 text-green-400/50 text-[10px] font-extrabold uppercase tracking-wider">
              {filteredMods.length} TOTAL
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
