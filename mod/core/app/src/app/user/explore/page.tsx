'use client'

import React, { useEffect, useState } from 'react'
import { Loading } from '@/mod/ui/Loading'
import { UserCard } from '@/mod/user/UserCard'
import { UserType } from '@/mod/types'
import { userContext } from '@/mod/context'
import { X, RotateCcw, Users } from 'lucide-react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'

type SortKey = 'recent' | 'name' | 'balance' | 'modules'

export default function UsersPage() {
  const { client, user } = userContext()
  const [users, setUsers] = useState<UserType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [columns, setColumns] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('user_explorer_columns') || '2')
    }
    return 2
  })

  const [localSearchTerm, setLocalSearchTerm] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('user_explorer_search') || ''
    }
    return ''
  })

  const [excludedAddresses, setExcludedAddresses] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('user_explorer_excluded')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })

  const [showFilterDropdown, setShowFilterDropdown] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('user_explorer_search', localSearchTerm)
    }
  }, [localSearchTerm])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('user_explorer_columns', columns.toString())
    }
  }, [columns])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('user_explorer_excluded', JSON.stringify(excludedAddresses))
    }
  }, [excludedAddresses])

  const filterUsersBySearch = (list: UserType[], searchTerm: string) => {
    if (!searchTerm) return list
    const lowerTerm = searchTerm.toLowerCase()
    return list.filter(u => u.key?.toLowerCase().includes(lowerTerm))
  }

  const filterUsersByExclusion = (list: UserType[]) => {
    return list.filter(u => !excludedAddresses.includes(u.key))
  }

  const fetchAll = async () => {
    setLoading(true)
    setError(null)
    try {
      if (!client) throw new Error('Client not initialized')
      const raw = (await client.call('users', {})) as UserType[]
      const allUsers = Array.isArray(raw) ? raw : []
      const searchFiltered = filterUsersBySearch(allUsers, localSearchTerm)
      const filtered = filterUsersByExclusion(searchFiltered)
      setUsers(filtered)
    } catch (err: any) {
      console.error('Error fetching users:', err)
      setError(err?.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [client, localSearchTerm, excludedAddresses])

  const toggleAddressExclusion = (address: string) => {
    setExcludedAddresses(prev => 
      prev.includes(address) 
        ? prev.filter(a => a !== address)
        : [...prev, address]
    )
  }

  const clearAllExclusions = () => {
    setExcludedAddresses([])
  }

  const gridColsClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  }[columns] || 'grid-cols-1 md:grid-cols-2'

  // Get all unique addresses for the filter dropdown
  const [allAddresses, setAllAddresses] = useState<string[]>([])
  
  useEffect(() => {
    const fetchAllAddresses = async () => {
      try {
        if (!client) return
        const raw = (await client.call('users', {})) as UserType[]
        const addresses = Array.isArray(raw) ? raw.map(u => u.key) : []
        setAllAddresses(addresses)
      } catch (err) {
        console.error('Error fetching addresses:', err)
      }
    }
    fetchAllAddresses()
  }, [client])

  return (
    <div className={'min-h-screen bg-black text-white transition-all duration-300 pl-20'}>
      <main className="flex-1 px-2 pt-0 pb-0" role="main">
        <div className="mx-auto max-w-7xl mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <input
                type="text"
                value={localSearchTerm}
                onChange={(e) => setLocalSearchTerm(e.target.value)}
                placeholder="Search users by key..."
                className="w-full px-6 py-4 pr-14 bg-black/50 border-2 border-green-500/40 rounded-xl text-white text-base placeholder-gray-400 focus:outline-none focus:border-green-500/60 backdrop-blur-xl transition-all"
                style={{
                  boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)',
                  fontFamily: 'IBM Plex Mono, monospace'
                }}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <MagnifyingGlassIcon className="w-6 h-6 text-green-400" />
              </div>
            </div>

            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="px-6 py-4 bg-black/50 border-2 border-purple-500/40 rounded-xl text-white font-bold uppercase hover:border-purple-500/60 transition-all backdrop-blur-xl"
                style={{
                  boxShadow: '0 0 20px rgba(168, 85, 247, 0.3)',
                  fontFamily: 'IBM Plex Mono, monospace'
                }}
              >
                FILTER ({excludedAddresses.length})
              </button>

              {showFilterDropdown && (
                <div className="absolute top-full right-0 mt-2 w-96 max-h-96 overflow-y-auto bg-black/95 border-2 border-purple-500/60 rounded-xl p-4 z-50 backdrop-blur-xl" style={{ boxShadow: '0 0 30px rgba(168, 85, 247, 0.4)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold uppercase text-purple-300">Exclude Addresses</h3>
                    {excludedAddresses.length > 0 && (
                      <button
                        onClick={clearAllExclusions}
                        className="px-3 py-1 text-xs font-bold uppercase bg-red-500/20 border border-red-500/60 rounded text-red-300 hover:bg-red-500/30 transition-all"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {allAddresses.map(address => (
                      <label
                        key={address}
                        className="flex items-center gap-3 p-2 rounded hover:bg-white/5 cursor-pointer transition-all"
                      >
                        <input
                          type="checkbox"
                          checked={excludedAddresses.includes(address)}
                          onChange={() => toggleAddressExclusion(address)}
                          className="w-4 h-4 accent-purple-500"
                        />
                        <code className="text-sm font-mono text-gray-300">
                          {address.substring(0, 10)}...{address.substring(address.length - 8)}
                        </code>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
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

        {!loading && users.length === 0 && !error && (
          <div className="mx-auto max-w-4xl text-center py-12">
            <div className="mb-6 inline-bloc p-6 bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-blue-500/20 rounded-2xl border-2 border-purple-500/40 shadow-xl backdrop-blur-xl">
              <Users className="w-16 h-16 text-purple-300" strokeWidth={2} />
            </div>
            <div className="text-purple-300 text-3xl mb-6 font-black uppercase tracking-wide">
              {localSearchTerm ? 'NO USERS MATCH YOUR SEARCH' : 'NO USERS YET'}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <Loading />
          </div>
        )}

        <div className={`mx-auto max-w-7xl grid ${gridColsClass} gap-6`}>
          {users.map((user) => (
            <div
              key={user.key}
              className="transform hover:scale-[1.02] transition-all duration-300 ease-out"
            >
              <UserCard user={user} />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
