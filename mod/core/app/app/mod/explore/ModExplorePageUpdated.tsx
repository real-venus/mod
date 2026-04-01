"use client";

import React, { useEffect, useMemo, useState } from 'react'
import ModCard from '../ModCard'
import { ModCardSettings } from '../ModCardSettings'
import { ModuleType } from '@/types'
import { useSearchContext } from '@/context/SearchContext'
import { userContext } from '@/context'
import { X, RotateCcw, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { OwnerFilter } from './OwnerFilter'

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

  const [localSearchTerm, setLocalSearchTerm] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mod_explorer_search') || ''
    }
    return ''
  })

  const [selectedOwners, setSelectedOwners] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mod_explorer_search', localSearchTerm)
    }
  }, [localSearchTerm])

  const searchTermToUse = localSearchTerm || searchFilters.searchTerm?.trim() || ''

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
      const raw = (await client.call('mods', { search: searchTermToUse })) as ModuleType[]
      const allMods = Array.isArray(raw) ? raw : []
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
  }, [client, searchTermToUse, sort])

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
      <main className="flex-1 ml-20 px-5 pb-8" role="main">

          <div className="flex items-center gap-3 mb-6">
            <ModCardSettings
              sort={sort}
              onSortChange={setSort}
              columns={columns}
              onColumnsChange={setColumns}
            />

            <div className="relative flex-1">
              <input
                type="text"
                value={localSearchTerm}
                onChange={(e) => setLocalSearchTerm(e.target.value)}
                placeholder="Search mods by name, author, or description..."
                className="w-full px-6 py-4 pr-14 bg-gradient-to-r from-black/80 to-black/60 border-2 border-blue-500/40 rounded-xl text-white text-base placeholder-gray-500 focus:outline-none focus:border-blue-400 focus:shadow-lg focus:shadow-blue-500/30 backdrop-blur-xl transition-all"
                style={{
                  boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)',
                  fontFamily: 'IBM Plex Mono, monospace'
                }}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <MagnifyingGlassIcon className="w-6 h-6 text-blue-400/60" />
              </div>
            </div>
          </div>

          <OwnerFilter
            owners={uniqueOwners}
            selectedOwners={selectedOwners}
            onToggleOwner={toggleOwner}
            onClearFilters={clearOwnerFilters}
          />

        {error && (
          <div className="mb-5">
            <div className="p-5 border-2 border-red-500/60 bg-gradient-to-br from-red-500/30 to-pink-500/20 rounded-2xl flex items-start justify-between backdrop-blur-xl shadow-2xl shadow-red-500/20">
              <div className="flex-1">
                <div className="text-red-200 font-black mb-2 text-xl uppercase tracking-wider">ERROR</div>
                <div className="text-red-300/90 text-sm font-medium">{error}</div>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={fetchAll}
                  className="flex items-center gap-2 px-4 py-2 border-2 border-red-400/60 rounded-xl text-red-300 hover:bg-red-500/30 transition-all font-bold text-sm uppercase hover:scale-105 active:scale-95"
                >
                  <RotateCcw size={16} strokeWidth={2.5} />
                  RETRY
                </button>
                <button
                  onClick={() => setError(null)}
                  className="p-2 border-2 border-red-400/60 rounded-xl text-red-300 hover:bg-red-500/30 transition-all hover:scale-105 active:scale-95"
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && filteredMods.length === 0 && !error && (
          <div className="mx-auto max-w-4xl text-center py-16">
            <div className="mb-6 inline-block p-8 bg-gradient-to-br from-purple-500/30 via-pink-500/20 to-blue-500/30 rounded-3xl border-2 border-purple-500/50 shadow-2xl shadow-purple-500/30 backdrop-blur-xl">
              <Sparkles className="w-20 h-20 text-purple-300" strokeWidth={2.5} />
            </div>
            <div className="text-purple-200 text-3xl mb-4 font-black uppercase tracking-wider">
              {searchTermToUse || selectedOwners.length > 0 ? 'NO MODULES MATCH YOUR FILTERS' : 'NO MODULES YET'}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-16">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500/20 border-t-blue-400"></div>
              <div className="absolute inset-0 rounded-full blur-xl bg-blue-500/30 animate-pulse"></div>
            </div>
          </div>
        )}

        <div className={`grid ${gridColsClass} gap-5`}>
          {paginatedMods.map((mod) => (
            <div
              key={`${mod.name}-${mod.key}`}
              className="transform hover:scale-[1.01] transition-all duration-300 ease-out"
            >
              <ModCard mod={mod} card_enabled={true} />
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-8 pb-4">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-2 px-5 py-3 border-2 border-blue-500/50 rounded-xl text-blue-300 hover:bg-blue-500/20 hover:border-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-bold text-sm uppercase backdrop-blur-xl hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/20"
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
                    className={`w-11 h-11 rounded-xl font-black text-sm transition-all backdrop-blur-xl hover:scale-110 active:scale-95 ${
                      currentPage === pageNum
                        ? 'bg-gradient-to-br from-blue-500/40 to-blue-600/40 border-2 border-blue-400 text-white shadow-xl shadow-blue-500/40'
                        : 'bg-gradient-to-br from-black/80 to-black/60 border-2 border-blue-500/40 text-blue-300 hover:bg-blue-500/20 hover:border-blue-400 shadow-lg shadow-blue-500/20'
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
              className="flex items-center gap-2 px-5 py-3 border-2 border-blue-500/50 rounded-xl text-blue-300 hover:bg-blue-500/20 hover:border-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-bold text-sm uppercase backdrop-blur-xl hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/20"
            >
              NEXT
              <ChevronRight size={18} strokeWidth={2.5} />
            </button>

            <div className="ml-3 px-5 py-3 bg-gradient-to-r from-black/80 to-black/60 border-2 border-blue-500/50 rounded-xl text-blue-300 font-bold text-sm backdrop-blur-xl shadow-lg shadow-blue-500/20">
              {filteredMods.length} TOTAL
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
