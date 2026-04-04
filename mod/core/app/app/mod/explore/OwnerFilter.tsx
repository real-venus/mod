"use client";

import React, { useState, useRef, useEffect } from 'react'
import { text2color, shorten } from '@/utils'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { KeyIcon } from '@heroicons/react/24/outline'

interface OwnerFilterProps {
  owners: string[]
  selectedOwners: string[]
  onToggleOwner: (owner: string) => void
  onClearFilters: () => void
}

const FONT = "var(--font-digital), monospace"

export function OwnerFilter({ owners, selectedOwners, onToggleOwner, onClearFilters }: OwnerFilterProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (owners.length === 0) return null

  const hasSelected = selectedOwners.length > 0

  return (
    <div className="flex items-center gap-2" ref={dropdownRef}>
      {/* Dropdown trigger */}
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-all rounded-md"
          style={{
            fontFamily: FONT,
            color: hasSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
            backgroundColor: hasSelected ? 'rgba(167, 139, 250, 0.1)' : 'var(--bg-input)',
            border: hasSelected ? '1px solid rgba(167, 139, 250, 0.3)' : '1px solid var(--border-color)',
          }}
        >
          <KeyIcon className="w-3.5 h-3.5" style={{ strokeWidth: 2 }} />
          {hasSelected ? `${selectedOwners.length} Owner${selectedOwners.length > 1 ? 's' : ''}` : 'Owner'}
          {isDropdownOpen
            ? <ChevronUp className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
            : <ChevronDown className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
          }
        </button>

        {isDropdownOpen && (
          <div
            className="absolute top-full left-0 mt-1.5 z-50 min-w-[220px] max-h-[240px] overflow-y-auto rounded-lg"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            }}
          >
            {owners.map(owner => {
              const ownerColor = text2color(owner)
              const isSelected = selectedOwners.includes(owner)
              return (
                <button
                  key={owner}
                  onClick={() => onToggleOwner(owner)}
                  className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-all"
                  style={{
                    fontFamily: FONT,
                    fontSize: '12px',
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: isSelected ? `${ownerColor}12` : 'transparent',
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-input)' }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: ownerColor, boxShadow: isSelected ? `0 0 6px ${ownerColor}` : 'none' }}
                  />
                  <code style={{ color: isSelected ? ownerColor : 'var(--text-secondary)', fontFamily: FONT }}>
                    {shorten(owner, 6, 4)}
                  </code>
                  {isSelected && (
                    <span className="ml-auto text-[10px] font-bold" style={{ color: ownerColor }}>
                      ON
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Selected owner chips */}
      {selectedOwners.map(owner => {
        const ownerColor = text2color(owner)
        return (
          <div
            key={owner}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold"
            style={{
              fontFamily: FONT,
              backgroundColor: `${ownerColor}15`,
              border: `1px solid ${ownerColor}40`,
              color: ownerColor,
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ownerColor }} />
            {shorten(owner, 4, 4)}
            <button
              onClick={() => onToggleOwner(owner)}
              className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
            >
              <X size={10} strokeWidth={3} />
            </button>
          </div>
        )
      })}

      {/* Clear all */}
      {selectedOwners.length > 1 && (
        <button
          onClick={onClearFilters}
          className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md transition-all"
          style={{
            fontFamily: FONT,
            color: 'var(--text-tertiary)',
            border: '1px solid var(--border-color)',
          }}
        >
          Clear
        </button>
      )}
    </div>
  )
}
