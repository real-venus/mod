'use client'

import React, { useEffect, useMemo, useState } from 'react'
import ModCard from './ModCard'
import { ModCardSettings } from './ModCardSettings'
import { ModuleType } from '@/mod/types'
import { useSearchContext } from '@/mod/context/SearchContext'
import { userContext } from '@/mod/context'
import { X, RotateCcw, Sparkles } from 'lucide-react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { text2color } from '@/mod/utils'

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

  const [selectedKeys, setSelectedKeys] = useState<string[]>([])

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

  const filterModsBySearch = (list: ModuleType[], term: string) => {
    if (!term) return list
    const lowerTerm = term.toLowerCase()
    return list.filter(mod => 
      (mod.name?.toLowerCase().includes(lowerTerm)) ||
      (mod.key?.toLowerCase().includes(lowerTerm)) ||
      (mod.desc?.toLowerCase().includes(lowerTerm))
    )
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

  const uniqueKeys = useMemo(() => {
    const keys = new Set<string>()
    mods.forEach(mod => {
      if (mod.key) keys.add(mod.key)
    })
    return Array.from(keys).sort()
  }, [mods])

  const filteredMods = useMemo(() => {
    if (selectedKeys.length === 0) return mods
    return mods.filter(mod => selectedKeys.includes(mod.key))
  }, [mods, selectedKeys])

  const toggleKey = (key: string) => {
    setSelectedKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const clearKeyFilters = () => {
    setSelectedKeys([])
  }

  const gridColsClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  }[columns] || 'grid-cols-1 md:grid-cols-2'

  return (
    <div className={'min-h-screen bg-black text-white transition-all duration-300 pl-20'}>
      <main className="flex-1 px-2 pt-0 pb-0" role="main">
        <div className="mx-auto max-w-7xl mb-6">
          <div className="flex items-center gap-4 mb-4">
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
                className="w-full px-6 py-4 pr-14 bg-black/50 border-2 border-blue-500/40 rounded-xl text-white text-base placeholder-gray-400 focus:outline-none focus:border-blue-500/60 backdrop-blur-xl transition-all"
                style={{
                  boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
                  fontFamily: 'IBM Plex Mono, monospace'
                }}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <MagnifyingGlassIcon className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>

          {uniqueKeys.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-gray-400 uppercase tracking-wide">Filter by Owner:</span>
                {uniqueKeys.map(key => {
                  const keyColor = text2color(key)
                  const isSelected = selectedKeys.includes(key)
                  return (
                    <button
                      key={key}
                      onClick={() => toggleKey(key)}
                      className="px-3 py-1.5 rounded-full border-2 font-mono text-sm font-bold transition-all hover:scale-105"
                      style={{
                        backgroundColor: isSelected ? `${keyColor}30` : `${keyColor}10`,
                        borderColor: isSelected ? keyColor : `${keyColor}40`,
                        color: keyColor,
                        boxShadow: isSelected ? `0 0 15px ${keyColor}40` : 'none'
                      }}
                    >
                      {key.slice(0, 8)}...{key.slice(-6)}
                    </button>
                  )
                })}
                {selectedKeys.length > 0 && (
                  <button
                    onClick={clearKeyFilters}
                    className="px-3 py-1.5 rounded-full border-2 border-red-500/40 bg-red-500/10 text-red-400 font-bold text-sm hover:bg-red-500/20 transition-all"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mx-auto max-w-7xl mb-4">
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
              {searchTermToUse || selectedKeys.length > 0 ? 'NO MODULES MATCH YOUR FILTERS' : 'NO MODULES YET'}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
          </div>
        )}

        <div className={`mx-auto max-w-7xl grid ${gridColsClass} gap-6`}>
          {filteredMods.map((mod) => (
            <div
              key={`${mod.name}-${mod.key}`}
              className="transform hover:scale-[1.02] transition-all duration-300 ease-out"
            >
              <ModCard mod={mod} card_enabled={true} />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
