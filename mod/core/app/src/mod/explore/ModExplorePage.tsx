"use client";

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import ModCard from '../ModCard'
import { ModCardSettings } from '../ModCardSettings'
import { ModuleType } from '@/types'
import { useSearchContext } from '@/context/SearchContext'
import { userContext } from '@/context'
import { X, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'

type SortKey = 'recent' | 'name' | 'author' | 'balance' | 'updated' | 'created'
type ModTab = 'mods' | 'myMods'

const TABS: { key: ModTab; label: string }[] = [
  { key: 'mods', label: 'MODS' },
  { key: 'myMods', label: 'MY MODS' },
]

export default function ModExplorePage() {
  const { client, user } = userContext()
  const { searchFilters, handleSearch } = useSearchContext()

  const [activeTab, setActiveTab] = useState<ModTab>('mods')
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

  const sortModules = useCallback((list: ModuleType[]) => {
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
  }, [sort])

  const fetchAll = useCallback(async () => {
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

      const raw = (await client.call('mods', params)) as ModuleType[]
      const allMods = Array.isArray(raw) ? raw : []
      const sorted = sortModules(allMods)
      setMods(sorted)
    } catch (err: any) {
      console.error('Error fetching modules:', err)
      setError(err?.message || 'Failed to load modules')
    } finally {
      setLoading(false)
    }
  }, [client, searchTermToUse, selectedOwners, sortModules])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const uniqueOwners = useMemo(() => {
    const owners = new Set<string>()
    mods.forEach(mod => {
      if (mod.key) owners.add(mod.key)
    })
    return Array.from(owners).sort()
  }, [mods])

  const filteredMods = useMemo(() => {
    let result = mods
    if (selectedOwners.length > 0) {
      result = result.filter(mod => selectedOwners.includes(mod.key))
    }
    if (activeTab === 'myMods' && user?.key) {
      result = result.filter(mod => mod.key === user.key)
    }
    return result
  }, [mods, selectedOwners, activeTab, user?.key])

  const totalPages = Math.ceil(filteredMods.length / itemsPerPage)

  const paginatedMods = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredMods.slice(startIndex, endIndex)
  }, [filteredMods, currentPage, itemsPerPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTermToUse, selectedOwners, sort, activeTab])

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
    <div className="min-h-screen bg-black text-white font-mono relative overflow-hidden" style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>
      {/* CRT scanline overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-10 opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)',
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-8 z-20">

        {/* Header + Tabs + Create (quests-style) */}
        <div className="mb-6">
          <div className="flex items-end gap-5 border-b border-white/[0.08] pb-0">
            <div className="flex items-center gap-2.5 shrink-0 pb-3">
              <span className="text-green-400/60 text-[16px] font-extrabold select-none">&gt;_</span>
              <h1 className="text-[24px] font-extrabold text-white tracking-tight uppercase leading-none" style={{ textShadow: '0 0 20px rgba(74, 222, 128, 0.2)' }}>MODULES</h1>
            </div>
            <div className="flex items-center gap-0 overflow-x-auto scrollbar-none flex-1">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative px-4 py-3.5 text-[14px] font-extrabold tracking-wider transition-all whitespace-nowrap shrink-0 uppercase border-b-2 -mb-px ${
                    activeTab === tab.key
                      ? 'text-green-400 border-green-400 bg-green-500/[0.06]'
                      : 'text-white/35 border-transparent hover:text-white/60 hover:border-white/15'
                  }`}
                >
                  {tab.label}
                  {tab.key === 'mods' && (
                    <span className="ml-2 text-[11px] text-white/25 font-bold">{mods.length}</span>
                  )}
                  {tab.key === 'myMods' && user?.key && (
                    <span className="ml-2 text-[11px] text-white/25 font-bold">{mods.filter(m => m.key === user.key).length}</span>
                  )}
                </button>
              ))}
            </div>
            {/* <a href="/create">
              <button
                className={`shrink-0 px-6 py-2.5 mb-1.5 text-[14px] font-extrabold uppercase tracking-widest transition-all border-2 bg-green-500/15 text-green-400 border-green-500/50 hover:bg-green-500/25 hover:border-green-400 hover:shadow-[0_0_15px_rgba(74,222,128,0.2)]`}
              >
                + CREATE MOD
              </button>
            </a> */}
          </div>
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {searchTermToUse && (
              <span className="text-[13px] text-cyan-400/60 font-bold font-mono">
                &gt; &quot;{searchTermToUse}&quot;
              </span>
            )}
            <span className="text-[12px] text-green-400/40 font-bold font-mono uppercase tracking-wider">
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

        {error && (
          <div className="mb-4">
            <div className="bg-[#0d0d0d] border-2 border-red-500/40 flex items-start justify-between">
              <div className="flex-1 px-5 py-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-red-400 text-[12px] font-extrabold">[ERR]</span>
                  <span className="text-red-400 font-extrabold text-[12px] uppercase tracking-wider">ERROR</span>
                </div>
                <div className="text-red-400/70 text-[13px] font-medium">{error}</div>
              </div>
              <div className="flex gap-px p-3">
                <button
                  onClick={fetchAll}
                  className="flex items-center gap-2 px-4 py-2 border-2 border-red-500/40 text-red-400 hover:bg-red-500/10 transition-all text-[11px] font-extrabold uppercase tracking-wider"
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
          <div className="flex flex-col items-center justify-center py-20 bg-[#0a0a0e] border-2 border-white/[0.1] font-mono">
            <span className="text-green-400/50 text-[15px] mb-2 font-extrabold">[EMPTY]</span>
            <p className="text-[15px] text-white/40 font-bold">
              {activeTab === 'myMods'
                ? (user?.key ? 'No modules created yet.' : 'Sign in to view your modules.')
                : (searchTermToUse || selectedOwners.length > 0 ? 'No modules match your filters.' : 'No modules yet.')}
            </p>
            {(searchTermToUse || selectedOwners.length > 0) && (
              <button
                onClick={() => { handleSearch(''); clearOwnerFilters() }}
                className="mt-4 px-5 py-2 bg-green-500/15 hover:bg-green-500/25 text-green-400 text-[11px] font-extrabold uppercase tracking-wider transition-colors border-2 border-green-500/30"
              >
                CLEAR ALL FILTERS
              </button>
            )}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20 font-mono">
            <div className="flex items-center gap-3">
              <span className="text-green-400 animate-pulse text-lg">_</span>
              <span className="text-[15px] text-white/45 font-extrabold">LOADING MODULES...</span>
            </div>
          </div>
        )}

        <div className={`grid ${gridColsClass} gap-3 mt-2`}>
          {paginatedMods.map((mod) => (
            <div key={`${mod.name}-${mod.key}`}>
              <ModCard mod={mod} card_enabled={true} />
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-8">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-4 py-2 border border-green-500/20 text-green-400/50 hover:text-green-400/80 hover:bg-green-500/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all text-[11px] font-extrabold uppercase tracking-wider"
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
                    className={`w-9 h-9 text-[12px] font-extrabold transition-all ${
                      currentPage === pageNum
                        ? 'bg-green-500 text-black border-2 border-green-400'
                        : 'bg-[#0d0d0d] border border-green-500/20 text-green-400/40 hover:text-green-400/70 hover:bg-green-500/[0.06]'
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
              className="flex items-center gap-1 px-4 py-2 border border-green-500/20 text-green-400/50 hover:text-green-400/80 hover:bg-green-500/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all text-[11px] font-extrabold uppercase tracking-wider"
            >
              NEXT
              <ChevronRight size={14} strokeWidth={2.5} />
            </button>

            <div className="ml-3 px-3 py-2 bg-[#0d0d0d] border border-green-500/20 text-green-400/50 text-[11px] font-extrabold uppercase tracking-wider">
              {filteredMods.length} TOTAL
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
