"use client";

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
  const [isExpanded, setIsExpanded] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('user_filters_expanded')
      if (saved === null) {
        setIsExpanded(true)
        localStorage.setItem('user_filters_expanded', 'true')
      } else {
        setIsExpanded(saved === 'true')
      }
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
    <div className="w-full">
      <button
        onClick={toggleExpanded}
        className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-2 border-purple-500/40 rounded-xl hover:border-purple-400/60 transition-all backdrop-blur-xl shadow-lg w-full justify-between"
      >
        <span className="text-purple-200 font-bold text-sm uppercase tracking-wider">
          Filters
        </span>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-purple-300" />
        ) : (
          <ChevronDown className="w-5 h-5 text-purple-300" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-2 border-purple-500/30 rounded-xl backdrop-blur-xl shadow-lg">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-purple-200 text-xs font-bold uppercase whitespace-nowrap">
                  Sort:
                </label>
                <select
                  value={sort}
                  onChange={(e) => onSortChange(e.target.value as SortKey)}
                  className="px-3 py-2 bg-black/40 border border-purple-500/40 rounded-lg text-purple-200 text-sm font-medium focus:outline-none focus:border-purple-400/60 transition-all"
                >
                  <option value="recent">Recent</option>
                  <option value="balance">Balance</option>
                  <option value="modules">Modules</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-purple-200 text-xs font-bold uppercase whitespace-nowrap">
                  Columns:
                </label>
                <select
                  value={columns}
                  onChange={(e) => onColumnsChange(Number(e.target.value))}
                  className="px-3 py-2 bg-black/40 border border-purple-500/40 rounded-lg text-purple-200 text-sm font-medium focus:outline-none focus:border-purple-400/60 transition-all"
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
                <label className="text-purple-200 text-xs font-bold uppercase whitespace-nowrap">
                  User:
                </label>
                <input
                  type="text"
                  value={userFilter}
                  onChange={(e) => onUserFilterChange(e.target.value)}
                  placeholder="Filter by user key..."
                  className="flex-1 px-3 py-2 bg-black/40 border border-purple-500/40 rounded-lg text-purple-200 text-sm placeholder-purple-400/50 focus:outline-none focus:border-purple-400/60 transition-all"
                />
              </div>
            )}

            {onShowMyUsersOnlyChange && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  id="myUsersOnly"
                  checked={showMyUsersOnly}
                  onChange={(e) => onShowMyUsersOnlyChange(e.target.checked)}
                  className="w-4 h-4 rounded border-purple-500/40 bg-black/40 text-purple-500 focus:ring-purple-500/40"
                />
                <span className="text-purple-200 text-xs font-bold uppercase">My Users Only</span>
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
