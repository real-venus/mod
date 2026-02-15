"use client";

import { Settings, Grid3x3, Grid2x2, LayoutGrid, Filter, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { OwnerFilter } from './explore/OwnerFilter'

type SortKey = 'recent' | 'name' | 'author' | 'balance' | 'updated' | 'created'

interface ModCardSettingsProps {
  sort: SortKey
  onSortChange: (sort: SortKey) => void
  columns: number
  onColumnsChange: (columns: number) => void
  owners?: string[]
  selectedOwners?: string[]
  onToggleOwner?: (owner: string) => void
  onClearFilters?: () => void
}

export function ModCardSettings({
  sort,
  onSortChange,
  columns,
  onColumnsChange,
  owners = [],
  selectedOwners = [],
  onToggleOwner = () => {},
  onClearFilters = () => {},
}: ModCardSettingsProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative font-mono" style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2.5 border border-white/[0.15] bg-[#0d0d0d] hover:bg-white/[0.05] transition-all flex items-center gap-2"
        title="Settings"
      >
        <Settings className="w-4 h-4 text-white/50" />
        <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full right-0 mt-1 w-72 bg-[#0a0a0a] border border-white/[0.15] p-4 z-50">
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-extrabold text-cyan-400/50 uppercase tracking-[0.2em] mb-2 block">
                  SORT BY
                </label>
                <select
                  value={sort}
                  onChange={(e) => onSortChange(e.target.value as SortKey)}
                  className="w-full px-3 py-2 bg-black/50 border border-white/[0.15] text-[13px] text-white/70 font-mono font-bold focus:outline-none focus:border-blue-500/60 transition-colors"
                >
                  <option value="recent">Recent</option>
                  <option value="name">Name</option>
                  <option value="author">Author</option>
                  <option value="updated">Updated</option>
                  <option value="created">Created</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-cyan-400/50 uppercase tracking-[0.2em] mb-2 block">
                  COLUMNS
                </label>
                <div className="flex gap-px">
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      onClick={() => onColumnsChange(num)}
                      className={`flex-1 p-2 border transition-all ${
                        columns === num
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                          : 'bg-[#0d0d0d] border-white/[0.12] text-white/40 hover:text-white/60 hover:bg-white/[0.05]'
                      }`}
                    >
                      {num === 1 && <LayoutGrid className="w-4 h-4 mx-auto" />}
                      {num === 2 && <Grid2x2 className="w-4 h-4 mx-auto" />}
                      {num === 3 && <Grid3x3 className="w-4 h-4 mx-auto" />}
                      {num === 4 && <Filter className="w-4 h-4 mx-auto" />}
                    </button>
                  ))}
                </div>
              </div>

              {owners.length > 0 && (
                <div>
                  <OwnerFilter
                    owners={owners}
                    selectedOwners={selectedOwners}
                    onToggleOwner={onToggleOwner}
                    onClearFilters={onClearFilters}
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
