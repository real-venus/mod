'use client'
import { useState } from 'react'
import { ChevronDown, ChevronUp, SlidersHorizontal, Grid3x3, Grid2x2, LayoutGrid, User, Home, Globe, Filter } from 'lucide-react'

type SortKey = 'recent' | 'name' | 'author' | 'balance' | 'updated' | 'created'

interface ModCardSettingsProps {
  sort: SortKey
  onSortChange: (sort: SortKey) => void
  columns: number
  onColumnsChange: (columns: number) => void
  userFilter: string
  onUserFilterChange: (filter: string) => void
  showMyModsOnly: boolean
  onShowMyModsOnlyChange: (show: boolean) => void
  showLocalOnly: boolean
  onShowLocalOnlyChange: (show: boolean) => void
  showOnchainOnly: boolean
  onShowOnchainOnlyChange: (show: boolean) => void
}

export function ModCardSettings({
  sort,
  onSortChange,
  columns,
  onColumnsChange,
  userFilter,
  onUserFilterChange,
  showMyModsOnly,
  onShowMyModsOnlyChange,
  showLocalOnly,
  onShowLocalOnlyChange,
  showOnchainOnly,
  onShowOnchainOnlyChange,
}: ModCardSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const sortOptions: { value: SortKey; label: string }[] = [
    { value: 'recent', label: 'RECENT' },
    { value: 'name', label: 'NAME' },
    { value: 'author', label: 'AUTHOR' },
    { value: 'updated', label: 'UPDATED' },
    { value: 'created', label: 'CREATED' },
  ]

  const columnOptions = [1, 2, 3, 4]

  return (
    <div className="w-full">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-purple-900/40 to-blue-900/40 border-2 border-purple-500/50 rounded-xl hover:border-purple-400 transition-all backdrop-blur-sm"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-purple-300" />
          <span className="font-bold text-purple-300 uppercase tracking-wider">FILTERS</span>
        </div>
        {isExpanded ? <ChevronUp className="w-5 h-5 text-purple-300" /> : <ChevronDown className="w-5 h-5 text-purple-300" />}
      </button>

      {isExpanded && (
        <div className="mt-3 p-4 bg-gradient-to-br from-black/80 to-purple-900/20 border-2 border-purple-500/30 rounded-xl backdrop-blur-sm space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-bold text-purple-300 mb-2 uppercase tracking-wider">SORT BY</label>
              <select
                value={sort}
                onChange={(e) => onSortChange(e.target.value as SortKey)}
                className="w-full px-3 py-2 bg-black/60 border-2 border-purple-500/40 rounded-lg text-purple-200 font-bold text-sm focus:border-purple-400 focus:outline-none transition-all"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-bold text-purple-300 mb-2 uppercase tracking-wider">COLUMNS</label>
              <div className="flex gap-2">
                {columnOptions.map((col) => (
                  <button
                    key={col}
                    onClick={() => onColumnsChange(col)}
                    className={`flex-1 px-3 py-2 rounded-lg font-bold text-sm transition-all border-2 ${
                      columns === col
                        ? 'bg-purple-500/30 text-purple-200 border-purple-400'
                        : 'bg-black/60 text-purple-400/60 border-purple-500/30 hover:border-purple-400/50'
                    }`}
                  >
                    {col}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-bold text-purple-300 mb-2 uppercase tracking-wider">USER FILTER</label>
              <input
                type="text"
                value={userFilter}
                onChange={(e) => onUserFilterChange(e.target.value)}
                placeholder="Filter by user key..."
                className="w-full px-3 py-2 bg-black/60 border-2 border-purple-500/40 rounded-lg text-purple-200 font-mono text-sm focus:border-purple-400 focus:outline-none transition-all placeholder:text-purple-500/40"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t-2 border-purple-500/20">
            <button
              onClick={() => onShowMyModsOnlyChange(!showMyModsOnly)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all border-2 ${
                showMyModsOnly
                  ? 'bg-blue-500/30 text-blue-200 border-blue-400'
                  : 'bg-black/60 text-blue-400/60 border-blue-500/30 hover:border-blue-400/50'
              }`}
            >
              <User size={16} />
              MY MODS
            </button>

            <button
              onClick={() => onShowLocalOnlyChange(!showLocalOnly)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all border-2 ${
                showLocalOnly
                  ? 'bg-green-500/30 text-green-200 border-green-400'
                  : 'bg-black/60 text-green-400/60 border-green-500/30 hover:border-green-400/50'
              }`}
            >
              <Home size={16} />
              LOCAL
            </button>

            <button
              onClick={() => onShowOnchainOnlyChange(!showOnchainOnly)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all border-2 ${
                showOnchainOnly
                  ? 'bg-orange-500/30 text-orange-200 border-orange-400'
                  : 'bg-black/60 text-orange-400/60 border-orange-500/30 hover:border-orange-400/50'
              }`}
            >
              <Globe size={16} />
              ONCHAIN
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
