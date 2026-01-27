'use client'

import { Settings, Grid3x3, Grid2x2, LayoutGrid, User, Filter } from 'lucide-react'
import { useState } from 'react'

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
}: ModCardSettingsProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 rounded-xl border-2 border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 transition-all backdrop-blur-xl"
        title="Settings"
      >
        <Settings className="w-5 h-5 text-purple-400" />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 w-80 bg-black/95 border-2 border-purple-500/40 rounded-xl p-4 backdrop-blur-xl shadow-2xl z-50">
            <div className="space-y-4">
              <div>
                <label className="text-purple-300 font-bold text-sm uppercase tracking-wide mb-2 block">
                  Sort By
                </label>
                <select
                  value={sort}
                  onChange={(e) => onSortChange(e.target.value as SortKey)}
                  className="w-full px-3 py-2 bg-black/50 border-2 border-purple-500/40 rounded-lg text-white focus:outline-none focus:border-purple-500/60"
                >
                  <option value="recent">Recent</option>
                  <option value="name">Name</option>
                  <option value="author">Author</option>
                  <option value="updated">Updated</option>
                  <option value="created">Created</option>
                </select>
              </div>

              <div>
                <label className="text-purple-300 font-bold text-sm uppercase tracking-wide mb-2 block">
                  Columns
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      onClick={() => onColumnsChange(num)}
                      className={`flex-1 p-2 rounded-lg border-2 transition-all ${
                        columns === num
                          ? 'bg-purple-500/30 border-purple-500 text-purple-300'
                          : 'bg-black/50 border-purple-500/30 text-purple-500/60 hover:bg-purple-500/10'
                      }`}
                    >
                      {num === 1 && <LayoutGrid className="w-5 h-5 mx-auto" />}
                      {num === 2 && <Grid2x2 className="w-5 h-5 mx-auto" />}
                      {num === 3 && <Grid3x3 className="w-5 h-5 mx-auto" />}
                      {num === 4 && <Filter className="w-5 h-5 mx-auto" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-purple-300 font-bold text-sm uppercase tracking-wide mb-2 block">
                  Filter by User
                </label>
                <input
                  type="text"
                  value={userFilter}
                  onChange={(e) => onUserFilterChange(e.target.value)}
                  placeholder="Enter user key..."
                  className="w-full px-3 py-2 bg-black/50 border-2 border-purple-500/40 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/60"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showMyModsOnly}
                    onChange={(e) => onShowMyModsOnlyChange(e.target.checked)}
                    className="w-5 h-5 rounded border-2 border-purple-500/40 bg-black/50 checked:bg-purple-500 checked:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                  <span className="text-purple-300 font-bold text-sm uppercase tracking-wide">
                    My Modules Only
                  </span>
                </label>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
