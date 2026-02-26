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
        className="p-2.5 transition-all flex items-center gap-2"
        style={{ border: '2px solid var(--border-strong)', backgroundColor: 'var(--bg-secondary)' }}
        title="Settings"
      >
        <Settings className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--text-tertiary)' }} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full right-0 mt-1 w-72 p-4 z-50" style={{ backgroundColor: 'var(--bg-secondary)', border: '2px solid var(--border-strong)' }}>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-extrabold text-cyan-400/50 uppercase tracking-[0.2em] mb-2 block">
                  SORT BY
                </label>
                <select
                  value={sort}
                  onChange={(e) => onSortChange(e.target.value as SortKey)}
                  className="w-full px-3 py-2 text-[13px] font-mono font-bold focus:outline-none focus:border-blue-500/60 transition-colors"
                  style={{ backgroundColor: 'var(--bg-input)', border: '2px solid var(--border-color)', color: 'var(--text-primary)' }}
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
                      className={`flex-1 p-2 transition-all ${
                        columns === num
                          ? 'bg-blue-500/20 text-blue-400'
                          : ''
                      }`}
                      style={columns === num
                        ? { border: '2px solid rgba(59,130,246,0.5)' }
                        : { border: '2px solid var(--border-color)', color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-input)' }
                      }
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
