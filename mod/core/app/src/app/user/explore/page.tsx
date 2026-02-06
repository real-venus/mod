"use client";

import React, { useEffect, useState } from 'react'
import { Loading } from '@/mod/ui/Loading'
import { UserCard } from '@/mod/user/UserCard'
import { UserType } from '@/mod/types'
import { userContext } from '@/mod/context'
import { X, RotateCcw, Users } from 'lucide-react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

type SortKey = 'recent' | 'name' | 'balance' | 'modules'

export default function UsersPage() {
  const { client, user } = userContext()

  const [users, setUsers] = useState<UserType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize safely on client
  const [columns, setColumns] = useState<number>(2)
  const [localSearchTerm, setLocalSearchTerm] = useState<string>('')

  // Read from localStorage on mount
  useEffect(() => {
    const storedColumns = localStorage.getItem('user_explorer_columns')
    const storedSearch = localStorage.getItem('user_explorer_search')

    if (storedColumns) {
      setColumns(parseInt(storedColumns, 10))
    }
    if (storedSearch) {
      setLocalSearchTerm(storedSearch)
    }
  }, [])

  // Persist search term
  useEffect(() => {
    localStorage.setItem('user_explorer_search', localSearchTerm)
  }, [localSearchTerm])

  // Persist column count
  useEffect(() => {
    localStorage.setItem('user_explorer_columns', columns.toString())
  }, [columns])

  const filterUsersBySearch = (list: UserType[], searchTerm: string) => {
    if (!searchTerm) return list
    const lowerTerm = searchTerm.toLowerCase()
    return list.filter(u => u.key?.toLowerCase().includes(lowerTerm))
  }

  const fetchAll = async () => {
    setLoading(true)
    setError(null)

    try {
      if (!client) throw new Error('Client not initialized')

      const raw = (await client.call('users', {})) as UserType[]
      const allUsers = Array.isArray(raw) ? raw : []

      const searchFiltered = filterUsersBySearch(allUsers, localSearchTerm)
      setUsers(searchFiltered)
    } catch (err: any) {
      console.error('Error fetching users:', err)
      setError(err?.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (client) {
      fetchAll()
    }
  }, [client, localSearchTerm])

  const gridColsClass =
    {
      1: 'grid-cols-1',
      2: 'grid-cols-1 md:grid-cols-2',
      3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    }[columns] || 'grid-cols-1 md:grid-cols-2'

  return (
    <div className="min-h-screen bg-black text-white transition-all duration-300 pl-20">
      <main className="flex-1 px-2 pt-0 pb-0" role="main">
        <div className="mx-auto mb-6" style={{ width: '90%', maxWidth: 'none' }}>
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
                  fontFamily: 'IBM Plex Mono, monospace',
                }}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <MagnifyingGlassIcon className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-auto mb-4" style={{ width: '90%', maxWidth: 'none' }}>
            <div className="p-4 border-2 border-red-500/60 bg-gradient-to-r from-red-500/20 to-pink-500/20 rounded-xl flex items-start justify-between backdrop-blur-xl shadow-lg">
              <div className="flex-1">
                <div className="text-red-300 font-bold mb-1 text-lg uppercase tracking-wide">
                  ERROR
                </div>
                <div className="text-red-200/90 text-sm font-medium">
                  {error}
                </div>
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
          <div className="mx-auto text-center py-12" style={{ width: '90%', maxWidth: 'none' }}>
            <div className="mb-6 inline-block p-6 bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-blue-500/20 rounded-2xl border-2 border-purple-500/40 shadow-xl backdrop-blur-xl">
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

        <div
          className={`mx-auto grid ${gridColsClass} gap-6`}
          style={{ width: '90%', maxWidth: 'none' }}
        >
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
