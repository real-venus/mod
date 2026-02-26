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
    <div className="min-h-screen font-mono relative overflow-hidden" style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>


      <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-12 z-20">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-end gap-6 pb-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
            {/* Logo / title */}
            <div className="flex items-center gap-3 shrink-0 pb-3.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                <span className="text-[14px] font-bold select-none" style={{ color: 'var(--text-secondary)' }}>&gt;_</span>
              </div>
              <h1 className="text-[22px] font-bold tracking-tight uppercase leading-none" style={{ color: 'var(--text-primary)' }}>MODULES</h1>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative px-5 py-3.5 text-[13px] font-bold tracking-wider transition-all whitespace-nowrap shrink-0 uppercase border-b-2 -mb-px rounded-t-lg ${
                    activeTab !== tab.key ? 'border-transparent' : ''
                  }`}
                  style={activeTab === tab.key
                    ? { color: 'var(--text-primary)', borderColor: 'var(--text-primary)' }
                    : { color: 'var(--text-tertiary)' }}
                >
                  {tab.label}
                  {tab.key === 'mods' && (
                    <span className="ml-2 text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: 'var(--text-secondary)' }}>
                      {mods.length}
                    </span>
                  )}
                  {tab.key === 'myMods' && user?.key && (
                    <span className="ml-2 text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: 'var(--text-secondary)' }}>
                      {mods.filter(m => m.key === user.key).length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Create button */}
            <Link
              href="/create"
              className="shrink-0 px-5 py-2.5 mb-2 text-[13px] font-bold uppercase tracking-widest transition-all rounded-xl hover:opacity-80"
              style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
            >
              + Create Mod
            </Link>
          </div>
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            {searchTermToUse && (
              <span className="text-[12px] font-bold font-mono px-3 py-1.5 rounded-lg" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                &gt; &quot;{searchTermToUse}&quot;
              </span>
            )}
            <span className="text-[11px] font-bold font-mono uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              {filteredMods.length} module{filteredMods.length !== 1 ? 's' : ''}
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
          <div className="flex flex-col items-center justify-center py-24 rounded-2xl font-mono" style={{ backgroundColor: 'var(--bg-secondary)', border: '2px solid var(--border-color)' }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--bg-input)', border: '2px solid var(--border-color)' }}>
              <CubeIcon className="w-6 h-6" style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <p className="text-[14px] font-medium" style={{ color: 'var(--text-secondary)' }}>
              {activeTab === 'myMods'
                ? (user?.key ? 'No modules created yet' : 'Sign in to view your modules')
                : (searchTermToUse || selectedOwners.length > 0 ? 'No modules match your filters' : 'No modules yet')}
            </p>
            {(searchTermToUse || selectedOwners.length > 0) && (
              <button
                onClick={() => { handleSearch(''); clearOwnerFilters() }}
                className="mt-5 px-5 py-2.5 text-[12px] font-bold uppercase tracking-wider transition-all rounded-xl"
                style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)', border: '2px solid var(--border-color)' }}
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

        <div className={`grid ${gridColsClass} gap-4`}>
          {paginatedMods.map((mod) => (
            <div key={`${mod.name}-${mod.key}`}>
              <ModCard mod={mod} card_enabled={true} />
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-10 pb-4">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1.5 px-4 py-2.5 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-[11px] font-bold uppercase tracking-wider rounded-xl"
              style={{ border: '2px solid var(--border-color)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)' }}
            >
              <ChevronLeft size={14} />
              Prev
            </button>

            <div className="flex items-center gap-1">
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
                    className="w-9 h-9 text-[12px] font-bold transition-all rounded-lg"
                    style={currentPage === pageNum
                      ? { border: '2px solid var(--text-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-input)' }
                      : { border: '2px solid var(--border-color)', color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-secondary)' }}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1.5 px-4 py-2.5 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-[11px] font-bold uppercase tracking-wider rounded-xl"
              style={{ border: '2px solid var(--border-color)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)' }}
            >
              Next
              <ChevronRight size={14} />
            </button>

            <span className="ml-2 text-[11px] font-bold" style={{ color: 'var(--text-tertiary)' }}>
              {filteredMods.length} total
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
