"use client";

import React, { useState } from 'react'
import { text2color } from '@/utils'
import { ChevronDown, X } from 'lucide-react'

interface OwnerFilterProps {
  owners: string[]
  selectedOwners: string[]
  onToggleOwner: (owner: string) => void
  onClearFilters: () => void
}

export function OwnerFilter({ owners, selectedOwners, onToggleOwner, onClearFilters }: OwnerFilterProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  if (owners.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">

        {/* Dropdown for adding owners */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="px-2.5 py-1.5 rounded-lg border-2 border-blue-500/40 bg-blue-500/10 text-blue-400 font-bold text-[12px] hover:bg-blue-500/20 transition-all flex items-center gap-1.5"
          >
            Add Owner
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 border-2 border-blue-500/60 rounded-lg shadow-2xl z-50 backdrop-blur-md max-h-60 overflow-y-auto min-w-[300px]" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              {owners.map(owner => {
                const ownerColor = text2color(owner)
                const isSelected = selectedOwners.includes(owner)
                return (
                  <button
                    key={owner}
                    onClick={() => {
                      onToggleOwner(owner)
                      setIsDropdownOpen(false)
                    }}
                    disabled={isSelected}
                    className={`w-full text-left px-4 py-3 border-b border-blue-500/30 last:border-b-0 transition-all font-mono text-sm ${
                      isSelected ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-500/20'
                    }`}
                    style={{
                      color: ownerColor
                    }}
                  >
                    {owner.slice(0, 8)}...{owner.slice(-6)}
                    {isSelected && <span className="ml-2 text-xs">(selected)</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Selected owner tags */}
        {selectedOwners.map(owner => {
          const ownerColor = text2color(owner)
          return (
            <div
              key={owner}
              className="px-2.5 py-1 rounded-full border-2 font-mono text-[12px] font-bold transition-all flex items-center gap-1.5"
              style={{
                backgroundColor: `${ownerColor}30`,
                borderColor: ownerColor,
                color: ownerColor,
                boxShadow: `0 0 15px ${ownerColor}40`
              }}
            >
              {owner.slice(0, 8)}...{owner.slice(-6)}
              <button
                onClick={() => onToggleOwner(owner)}
                className="hover:scale-110 transition-transform"
              >
                <X size={14} strokeWidth={3} />
              </button>
            </div>
          )
        })}

        {/* Clear all button */}
        {selectedOwners.length > 0 && (
          <button
            onClick={onClearFilters}
            className="px-2.5 py-1 rounded-full border-2 border-red-500/40 bg-red-500/10 text-red-400 font-bold text-[12px] hover:bg-red-500/20 transition-all"
          >
            Clear All
          </button>
        )}
      </div>
    </div>
  )
}
