"use client";

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import ModCard from '../ModCard'
import { ModCardSettings } from '../ModCardSettings'
import { ModuleType } from '@/types'
import { useSearchContext } from '@/context/SearchContext'
import { userContext } from '@/context'
import { X, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'
import { CubeIcon } from '@heroicons/react/24/outline'

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
  const [currentPage, setCurrentPage] = useState(0) // API uses 0-based pagination
  const [itemsPerPage] = useState(20)
  const [totalMods, setTotalMods] = useState(0)

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

      const params: any = {
        page: currentPage,
        page_size: itemsPerPage
      }

      if (searchTermToUse) {
        params.search = searchTermToUse
      }

      if (selectedOwners.length === 1) {
        params.key = selectedOwners[0]
      }

      const raw = (await client.call('mods', params)) as ModuleType[]
      const pageMods = Array.isArray(raw) ? raw : []

      // If we got fewer mods than requested, we're on the last page
      if (pageMods.length < itemsPerPage && currentPage === 0) {
        setTotalMods(pageMods.length)
      } else if (pageMods.length < itemsPerPage) {
        setTotalMods(currentPage * itemsPerPage + pageMods.length)
      } else {
        // Estimate total based on page size - we'll refine as we paginate
        setTotalMods((currentPage + 2) * itemsPerPage)
      }

      const sorted = sortModules(pageMods)
      setMods(sorted)
    } catch (err: any) {
      console.error('Error fetching modules:', err)
      setError(err?.message || 'Failed to load modules')
    } finally {
      setLoading(false)
    }
  }, [client, searchTermToUse, selectedOwners, sortModules, currentPage, itemsPerPage])

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
    if (activeTab === 'myMods' && user?.key) {
      result = result.filter(mod => mod.key === user.key)
    }
    return result
  }, [mods, activeTab, user?.key])

  const totalPages = Math.ceil(totalMods / itemsPerPage)

  // Mods are already paginated from the API
  const paginatedMods = filteredMods

  useEffect(() => {
    setCurrentPage(0) // Reset to first page (0-based)
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
    <div className="min-h-screen font-mono relative overflow-hidden" style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>


      <div className="relative max-w-7xl mx-auto px-6 pt-4 pb-12 z-20">

        {/* Header — single compact row */}
        <div className="flex items-center gap-4 mb-4" style={{ borderBottom: '1.5px solid var(--border-color)', paddingBottom: '10px' }}>
          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="relative px-3 py-1.5 text-[12px] font-extrabold tracking-wider transition-all whitespace-nowrap shrink-0 uppercase rounded-lg"
                style={activeTab === tab.key
                  ? { color: 'var(--text-primary)', background: 'var(--bg-input)' }
                  : { color: 'var(--text-tertiary)' }}
              >
                {tab.label}
                {tab.key === 'mods' && (
                  <span className="ml-1.5 text-[11px] font-extrabold" style={{ color: 'var(--text-secondary)' }}>
                    {totalMods}
                  </span>
                )}
                {tab.key === 'myMods' && user?.key && (
                  <span className="ml-1.5 text-[11px] font-extrabold" style={{ color: 'var(--text-secondary)' }}>
                    {filteredMods.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {searchTermToUse && (
            <span className="text-[11px] font-extrabold font-mono px-2.5 py-1 rounded-lg" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border-color)' }}>
              &gt; &quot;{searchTermToUse}&quot;
            </span>
          )}

          <div className="flex-1" />

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

          <Link
            href="/create"
            className="shrink-0 px-4 py-1.5 text-[12px] font-black uppercase tracking-widest transition-all rounded-lg hover:opacity-80 flex items-center"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1.5px solid var(--border-color)' }}
          >
            + Create Mod
          </Link>
        </div>

        {error && (
          <div className="mb-5">
            <div className="bg-red-500/[0.03] border border-red-500/20 rounded-xl flex items-start justify-between">
              <div className="flex-1 px-5 py-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  <span className="text-red-400/80 font-bold text-[12px] uppercase tracking-wider">Error</span>
                </div>
                <div className="text-red-400/50 text-[13px] font-medium">{error}</div>
              </div>
              <div className="flex gap-2 p-3">
                <button
                  onClick={fetchAll}
                  className="flex items-center gap-2 px-4 py-2 border border-red-500/25 text-red-400/70 hover:bg-red-500/10 transition-all text-[11px] font-bold uppercase tracking-wider rounded-lg"
                >
                  <RotateCcw size={13} />
                  Retry
                </button>
                <button
                  onClick={() => setError(null)}
                  className="p-2 border border-red-500/25 text-red-400/70 hover:bg-red-500/10 transition-all rounded-lg"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && filteredMods.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-24 rounded-2xl font-mono" style={{ backgroundColor: 'var(--bg-secondary)', border: '3px solid var(--border-color)' }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--bg-input)', border: '3px solid var(--border-color)' }}>
              <CubeIcon className="w-6 h-6" style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <p className="text-[14px] font-bold" style={{ color: 'var(--text-secondary)' }}>
              {activeTab === 'myMods'
                ? (user?.key ? 'No modules created yet' : 'Sign in to view your modules')
                : (searchTermToUse || selectedOwners.length > 0 ? 'No modules match your filters' : 'No modules yet')}
            </p>
            {(searchTermToUse || selectedOwners.length > 0) && (
              <button
                onClick={() => { handleSearch(''); clearOwnerFilters() }}
                className="mt-5 px-5 py-2.5 text-[12px] font-extrabold uppercase tracking-wider transition-all rounded-xl"
                style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)', border: '3px solid var(--border-color)' }}
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-24 font-mono">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border-color)', borderTopColor: 'var(--text-primary)' }} />
              </div>
              <span className="text-[13px] font-bold" style={{ color: 'var(--text-secondary)' }}>Loading modules...</span>
            </div>
          </div>
        )}

        <div className={`grid ${gridColsClass} gap-5`}>
          {paginatedMods.map((mod) => (
            <div key={`${mod.name}-${mod.key}`}>
              <ModCard mod={mod} card_enabled={true} />
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-10 pb-4">
            <button
              onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-[11px] font-extrabold uppercase tracking-wider rounded-xl"
              style={{ border: '3px solid var(--border-color)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)' }}
            >
              <ChevronLeft size={14} strokeWidth={3} />
              Prev
            </button>

            <div className="flex items-center gap-1.5">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageIndex: number
                if (totalPages <= 5) {
                  pageIndex = i
                } else if (currentPage <= 2) {
                  pageIndex = i
                } else if (currentPage >= totalPages - 3) {
                  pageIndex = totalPages - 5 + i
                } else {
                  pageIndex = currentPage - 2 + i
                }

                const displayNum = pageIndex + 1 // Display 1-based to users

                return (
                  <button
                    key={pageIndex}
                    onClick={() => setCurrentPage(pageIndex)}
                    className="w-10 h-10 text-[12px] font-extrabold transition-all rounded-lg"
                    style={currentPage === pageIndex
                      ? { border: '3px solid var(--text-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-input)' }
                      : { border: '2px solid var(--border-color)', color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-secondary)' }}
                  >
                    {displayNum}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
              disabled={currentPage === totalPages - 1}
              className="flex items-center gap-1.5 px-4 py-2.5 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-[11px] font-extrabold uppercase tracking-wider rounded-xl"
              style={{ border: '3px solid var(--border-color)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)' }}
            >
              Next
              <ChevronRight size={14} strokeWidth={3} />
            </button>

            <span className="ml-2 text-[12px] font-extrabold" style={{ color: 'var(--text-tertiary)' }}>
              {totalMods} total
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
