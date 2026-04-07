"use client";

import React, { useEffect, useState, useCallback } from 'react'
import ModCard from '../ModCard'
import { ModuleType } from '@/types'
import { useSearchContext } from '@/context/SearchContext'
import { userContext } from '@/context'
import { RotateCcw, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { CubeIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

type SortKey = 'recent' | 'name' | 'author' | 'balance' | 'updated' | 'created'

// Simple in-memory cache for mod listings
const modsCache: Record<string, { data: ModuleType[], time: number }> = {}
const CACHE_TTL = 30_000 // 30 seconds

export function clearModsCache() {
  Object.keys(modsCache).forEach(k => delete modsCache[k])
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('mods-cache-cleared'))
  }
}

export default function ModExplorePage() {
  const { client } = userContext()
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
  const [currentPage, setCurrentPage] = useState(0) // API uses 0-based pagination
  const [itemsPerPage] = useState(20)
  const [totalMods, setTotalMods] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)

  const searchTermToUse = searchFilters.searchTerm?.trim() || ''

  // Listen for cache-clear events (fired after create/fork/build) and tx events
  useEffect(() => {
    const handleCacheClear = () => setRefreshKey(k => k + 1)
    const handleTx = () => {
      Object.keys(modsCache).forEach(k => delete modsCache[k])
      setRefreshKey(k => k + 1)
    }
    window.addEventListener('mods-cache-cleared', handleCacheClear)
    window.addEventListener('mod:tx', handleTx)
    return () => {
      window.removeEventListener('mods-cache-cleared', handleCacheClear)
      window.removeEventListener('mod:tx', handleTx)
    }
  }, [])

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
    if (!client) {
      setError('Client not initialized')
      return
    }
    setError(null)

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

    const cacheKey = JSON.stringify(params)
    const cached = modsCache[cacheKey]

    // Show cached data immediately if available
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      const sorted = sortModules(cached.data)
      setMods(sorted)
      const pageMods = cached.data
      if (pageMods.length < itemsPerPage && currentPage === 0) {
        setTotalMods(pageMods.length)
      } else if (pageMods.length < itemsPerPage) {
        setTotalMods(currentPage * itemsPerPage + pageMods.length)
      } else {
        setTotalMods((currentPage + 2) * itemsPerPage)
      }
      return
    }

    // Show stale cache while loading if available
    if (cached) {
      setMods(sortModules(cached.data))
    }

    setLoading(true)
    try {
      const raw = (await client.call('mods', params)) as ModuleType[]
      // Deduplicate by name+key (backend may return dupes from registry casing issues)
      const seen = new Set<string>()
      const pageMods = (Array.isArray(raw) ? raw : []).filter(mod => {
        const k = `${(mod.name || '').toLowerCase()}:${(mod.key || '').toLowerCase()}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })

      // Update cache
      modsCache[cacheKey] = { data: pageMods, time: Date.now() }

      if (pageMods.length < itemsPerPage && currentPage === 0) {
        setTotalMods(pageMods.length)
      } else if (pageMods.length < itemsPerPage) {
        setTotalMods(currentPage * itemsPerPage + pageMods.length)
      } else {
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
  }, [client, searchTermToUse, selectedOwners, sortModules, currentPage, itemsPerPage, refreshKey])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const uniqueOwners = Array.from(new Set(mods.map(m => m.key).filter(Boolean) as string[])).sort()

  const totalPages = Math.ceil(totalMods / itemsPerPage)

  useEffect(() => {
    setCurrentPage(0) // Reset to first page (0-based)
  }, [searchTermToUse, selectedOwners, sort])

  // Emit state to TopBar
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('mods:state', {
      detail: { sort, columns, owners: uniqueOwners, selectedOwners, totalMods }
    }))
  }, [sort, columns, uniqueOwners.join(','), selectedOwners.join(','), totalMods])

  // Listen for changes from TopBar
  useEffect(() => {
    const onSort = (e: CustomEvent) => setSort(e.detail)
    const onCols = (e: CustomEvent) => setColumns(e.detail)
    const onToggle = (e: CustomEvent) => toggleOwner(e.detail)
    const onClear = () => clearOwnerFilters()
    window.addEventListener('mods:sort-change' as any, onSort)
    window.addEventListener('mods:columns-change' as any, onCols)
    window.addEventListener('mods:toggle-owner' as any, onToggle)
    window.addEventListener('mods:clear-filters' as any, onClear)
    return () => {
      window.removeEventListener('mods:sort-change' as any, onSort)
      window.removeEventListener('mods:columns-change' as any, onCols)
      window.removeEventListener('mods:toggle-owner' as any, onToggle)
      window.removeEventListener('mods:clear-filters' as any, onClear)
    }
  }, [])

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
    <div
      className="min-h-screen"
      style={{
        fontFamily: 'var(--font-digital), monospace',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
      }}
    >
      <div className="relative max-w-7xl mx-auto px-6 pt-4 pb-12 z-20">

        {/* Controls now rendered in TopBar header */}

        {error && (
          <div className="mb-8">
            <div className="border-4 flex items-start justify-between" style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-secondary)' }}>
              <div className="flex-1 px-6 py-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-3 h-3 bg-red-400 animate-pulse" />
                  <span className="text-red-400 font-bold text-base uppercase tracking-wider" style={{ fontFamily: 'var(--font-digital)' }}>▸ ERROR</span>
                </div>
                <div className="text-red-400 text-base font-bold" style={{ fontFamily: 'var(--font-digital)' }}>{error}</div>
              </div>
              <div className="flex gap-3 p-4">
                <button
                  onClick={fetchAll}
                  className="flex items-center gap-2 px-5 py-3 border-4 text-red-400 transition-all text-sm font-bold uppercase tracking-wider"
                  style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-primary)', fontFamily: 'var(--font-digital)' }}
                >
                  <RotateCcw size={16} />
                  RETRY
                </button>
                <button
                  onClick={() => setError(null)}
                  className="p-3 border-4 text-red-400 transition-all"
                  style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-primary)' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && mods.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-24 font-mono border-4" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-strong)' }}>
            <div className="w-16 h-16 flex items-center justify-center mb-6 border-4" style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-strong)' }}>
              <CubeIcon className="w-8 h-8" style={{ color: 'var(--text-primary)' }} />
            </div>
            <p className="text-lg font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital)' }}>
              {searchTermToUse || selectedOwners.length > 0 ? '▸ NO MODULES MATCH YOUR FILTERS' : '▸ NO MODULES YET'}
            </p>
            {(searchTermToUse || selectedOwners.length > 0) && (
              <button
                onClick={() => { handleSearch(''); clearOwnerFilters() }}
                className="mt-8 px-8 py-4 text-base font-bold uppercase tracking-wider transition-all border-4"
                style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', borderColor: 'var(--border-strong)', fontFamily: 'var(--font-digital)' }}
              >
                ▸ CLEAR FILTERS
              </button>
            )}
          </div>
        )}

        {loading && mods.length === 0 && (
          <div className="flex items-center justify-center py-24 font-mono">
            <div className="flex flex-col items-center gap-5">
              <div className="w-16 h-16 border-4 flex items-center justify-center" style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-secondary)' }}>
                <ArrowPathIcon className="w-8 h-8 animate-spin" style={{ color: 'var(--text-primary)' }} />
              </div>
              <span className="text-lg font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital)' }}>▸ LOADING MODULES...</span>
            </div>
          </div>
        )}

        <div className={`grid ${gridColsClass} gap-5`}>
          {mods.map((mod, index) => (
            <div
              key={`${mod.name}-${mod.key}`}
              className="animate-fade-in"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <ModCard mod={mod} card_enabled={true} />
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-10 pb-4">
            <button
              onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
              className="flex items-center gap-1.5 px-4 py-2 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-sm font-bold uppercase tracking-wider rounded-md"
              style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', fontFamily: 'var(--font-digital)' }}
            >
              <ChevronLeft size={14} strokeWidth={3} />
              PREV
            </button>

            <div className="flex items-center gap-1">
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

                const displayNum = pageIndex + 1

                return (
                  <button
                    key={pageIndex}
                    onClick={() => setCurrentPage(pageIndex)}
                    className="w-9 h-9 text-sm font-bold transition-all rounded-md"
                    style={
                      currentPage === pageIndex
                        ? {
                            color: 'var(--text-primary)',
                            background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.2), rgba(103, 232, 249, 0.1))',
                            border: '1px solid rgba(167, 139, 250, 0.3)',
                            fontFamily: 'var(--font-digital)',
                          }
                        : { color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', fontFamily: 'var(--font-digital)' }
                    }
                  >
                    {displayNum}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
              disabled={currentPage === totalPages - 1}
              className="flex items-center gap-1.5 px-4 py-2 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-sm font-bold uppercase tracking-wider rounded-md"
              style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', fontFamily: 'var(--font-digital)' }}
            >
              NEXT
              <ChevronRight size={14} strokeWidth={3} />
            </button>

            <span className="ml-2 text-xs font-bold uppercase px-3 py-2 rounded-md" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-digital)' }}>
              {totalMods} total
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
