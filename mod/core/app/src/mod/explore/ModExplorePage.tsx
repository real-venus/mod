"use client";

import React, { useEffect, useMemo, useState } from 'react'
import ModCard from '../ModCard'
import { ModCardSettings } from '../ModCardSettings'
import { ModuleType } from '@/types'
import { useSearchContext } from '@/context/SearchContext'
import { userContext } from '@/context'
import { X, RotateCcw, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react'

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

      // Build search parameters
      const params: any = {}
      if (searchTermToUse) {
        params.search = searchTermToUse
      }

      // Add owner filter if only one owner is selected
      // (Multiple owners still need client-side filtering)
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
    <div className={'min-h-screen bg-black text-white transition-all duration-300 pt-20'}>
      <main className="flex-1 px-6 pt-6 pb-0" role="main">
        <div className="mx-auto mb-6" style={{ maxWidth: '100%' }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-black text-green-400 uppercase tracking-wider" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                Explore
              </h1>
              {searchTermToUse && (
                <span className="text-base text-gray-400 font-mono">
                  &middot; &ldquo;{searchTermToUse}&rdquo;
                </span>
              )}
              <span className="text-sm text-gray-600 font-mono">
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
            <div className="p-4 border-2 border-red-500/60 bg-gradient-to-r from-red-500/20 to-pink-500/20 rounded-xl flex items-start justify-between backdrop-blur-xl shadow-lg">
              <div className="flex-1">
                <div className="text-red-300 font-bold mb-1 text-lg uppercase tracking-wide">ERROR</div>
                <div className="text-red-200/90 text-sm font-medium">{error}</div>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={fetchAll}
                  className="flex items-center gap-2 px-4 py-2 border border-red-400/60 rounded-lg text-red-300 hover:bg-red-500/30 transition-all font-bold text-sm uppercase"
                >
                  <RotateCcw size={16} strokeWidth={2.5} />
                  RETRY
                </button>
                <button
                  onClick={() => setError(null)}
                  className="p-2 border border-red-400/60 rounded-lg text-red-300 hover:bg-red-500/30 transition-all"
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && filteredMods.length === 0 && !error && (
          <div className="mx-auto max-w-4xl text-center py-12">
            <div className="mb-6 inline-bloc p-6 bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-blue-500/20 rounded-2xl border-2 border-purple-500/40 shadow-xl backdrop-blur-xl">
              <Sparkles className="w-16 h-16 text-purple-300" strokeWidth={2} />
            </div>
            <div className="text-purple-300 text-3xl mb-6 font-black uppercase tracking-wide">
              {searchTermToUse || selectedOwners.length > 0 ? 'NO MODULES MATCH YOUR FILTERS' : 'NO MODULES YET'}
            </div>
            {(searchTermToUse || selectedOwners.length > 0) && (
              <div className="text-neutral-400 text-sm space-y-2">
                {searchTermToUse && (
                  <div>Search: <span className="text-blue-400 font-mono">"{searchTermToUse}"</span></div>
                )}
                {selectedOwners.length > 0 && (
                  <div>Owners: <span className="text-purple-400 font-mono">{selectedOwners.length} selected</span></div>
                )}
                <div className="mt-4">
                  <button
                    onClick={() => {
                      handleSearch('')
                      clearOwnerFilters()
                    }}
                    className="px-6 py-2 bg-purple-500/20 border-2 border-purple-500/40 text-purple-300 rounded-lg hover:bg-purple-500/30 transition-all font-bold text-sm uppercase"
                  >
                    Clear All Filters
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
          </div>
        )}

        <div className={`mx-auto grid ${gridColsClass} gap-8 mt-2`} style={{ maxWidth: '100%' }}>
          {paginatedMods.map((mod) => (
            <div
              key={`${mod.name}-${mod.key}`}
              className="transform hover:scale-[1.02] transition-all duration-300 ease-out"
            >
              <ModCard mod={mod} card_enabled={true} />
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="mx-auto flex items-center justify-center gap-4 py-8" style={{ maxWidth: '100%' }}>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-2 px-4 py-2 border-2 border-blue-500/40 rounded-lg text-blue-300 hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold text-sm uppercase backdrop-blur-xl"
              style={{ boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)' }}
            >
              <ChevronLeft size={18} strokeWidth={2.5} />
              PREV
            </button>

            <div className="flex items-center gap-2">
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
                    className={`w-10 h-10 rounded-lg font-bold text-sm transition-all backdrop-blur-xl ${
                      currentPage === pageNum
                        ? 'bg-blue-500/40 border-2 border-blue-400 text-white'
                        : 'bg-black/50 border-2 border-blue-500/40 text-blue-300 hover:bg-blue-500/20'
                    }`}
                    style={{
                      boxShadow: currentPage === pageNum ? '0 0 20px rgba(59, 130, 246, 0.4)' : '0 0 10px rgba(59, 130, 246, 0.2)'
                    }}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-2 px-4 py-2 border-2 border-blue-500/40 rounded-lg text-blue-300 hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold text-sm uppercase backdrop-blur-xl"
              style={{ boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)' }}
            >
              NEXT
              <ChevronRight size={18} strokeWidth={2.5} />
            </button>

            <div className="ml-4 px-4 py-2 bg-black/50 border-2 border-blue-500/40 rounded-lg text-blue-300 font-bold text-sm backdrop-blur-xl">
              {filteredMods.length} TOTAL MODS
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
