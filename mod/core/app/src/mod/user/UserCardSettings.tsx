'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState, useEffect } from 'react'

type SortKey = 'recent' | 'name' | 'balance' | 'modules'

interface UserCardSettingsProps {
  sort: SortKey
  onSortChange: (sort: SortKey) => void
  columns: number
  onColumnsChange: (columns: number) => void
  userFilter?: string
  onUserFilterChange?: (filter: string) => void
  showMyUsersOnly?: boolean
  onShowMyUsersOnlyChange?: (show: boolean) => void
}

export const UserCardSettings = ({
  sort,
  onSortChange,
  columns,
  onColumnsChange,
  userFilter = '',
  onUserFilterChange,
  showMyUsersOnly = false,
  onShowMyUsersOnlyChange
}: UserCardSettingsProps) => {
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('user_filters_expanded')
      setIsExpanded(saved === 'true')
    }
  }, [])

  const toggleExpanded = () => {
    const newState = !isExpanded
    setIsExpanded(newState)
    if (typeof window !== 'undefined') {
      localStorage.setItem('user_filters_expanded', String(newState))
    }
  }

  return (
    <div className="relative z-50">
      <div className="border border-gray-800 rounded bg-black font-mono" style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>
        <button
          onClick={toggleExpanded}
          className="px-4 py-3 flex items-center gap-2 bg-black hover:bg-white/5 transition-colors whitespace-nowrap"
        >
          <span className="text-white font-bold uppercase tracking-wider">
            Filters
          </span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-white" />
          ) : (
            <ChevronDown className="w-5 h-5 text-white" />
          )}
        </button>

        {isExpanded && (
          <div className="absolute top-full left-0 mt-2 p-4 bg-black border border-gray-800 rounded shadow-2xl backdrop-blur-xl min-w-[400px]">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-white text-sm font-bold uppercase whitespace-nowrap">
                    Sort:
                  </label>
                  <select
                    value={sort}
                    onChange={(e) => onSortChange(e.target.value as SortKey)}
                    className="px-3 py-2 bg-black border border-gray-800 rounded text-white focus:outline-none focus:border-gray-600 transition-colors"
                  >
                    <option value="recent">Recent</option>
                    <option value="balance">Balance</option>
                    <option value="modules">Modules</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-white text-sm font-bold uppercase whitespace-nowrap">
                    Columns:
                  </label>
                  <select
                    value={columns}
                    onChange={(e) => onColumnsChange(Number(e.target.value))}
                    className="px-3 py-2 bg-black border border-gray-800 rounded text-white focus:outline-none focus:border-gray-600 transition-colors"
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                  </select>
                </div>
              </div>

              {onUserFilterChange && (
                <div className="flex items-center gap-2">
                  <label className="text-white text-sm font-bold uppercase whitespace-nowrap">
                    User:
                  </label>
                  <input
                    type="text"
                    value={userFilter}
                    onChange={(e) => onUserFilterChange(e.target.value)}
                    placeholder="Filter by user key..."
                    className="flex-1 px-3 py-2 bg-black border border-gray-800 rounded text-white placeholder-white/40 focus:outline-none focus:border-gray-600 transition-colors"
                  />
                </div>
              )}

              {onShowMyUsersOnlyChange && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="myUsersOnly"
                    checked={showMyUsersOnly}
                    onChange={(e) => onShowMyUsersOnlyChange(e.target.checked)}
                    className="w-4 h-4 bg-black border border-gray-800 rounded focus:ring-2 focus:ring-white/40"
                  />
                  <label htmlFor="myUsersOnly" className="text-white text-sm font-bold uppercase cursor-pointer">
                    My Users Only
                  </label>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
