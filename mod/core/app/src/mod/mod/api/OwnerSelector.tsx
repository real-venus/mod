'use client'

import { useState } from 'react'
import { text2color } from '@/mod/utils'

interface OwnerSelectorProps {
  currentOwner: string
  onOwnerChange: (newOwner: string) => void
  modColor: string
}

export function OwnerSelector({ currentOwner, onOwnerChange, modColor }: OwnerSelectorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [newOwner, setNewOwner] = useState(currentOwner)

  const handleSave = () => {
    if (newOwner.trim()) {
      onOwnerChange(newOwner.trim())
      setIsEditing(false)
    }
  }

  const handleCancel = () => {
    setNewOwner(currentOwner)
    setIsEditing(false)
  }

  return (
    <div className="rounded-xl border-2 p-4" style={{ backgroundColor: `${modColor}15`, borderColor: modColor }}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-lg font-black" style={{ color: modColor, fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}>API Owner</h4>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="px-3 py-1 rounded-lg border-2 font-bold text-sm transition-all"
            style={{ borderColor: `${modColor}40`, color: modColor, backgroundColor: `${modColor}20` }}
          >
            Change
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <input
            type="text"
            value={newOwner}
            onChange={(e) => setNewOwner(e.target.value)}
            placeholder="Enter new owner address"
            className="w-full border-2 bg-black/40 px-4 py-3 rounded-lg text-sm font-mono backdrop-blur-sm focus:outline-none focus:ring-2"
            style={{ borderColor: `${modColor}40`, color: modColor }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 rounded-lg border-2 font-bold text-sm transition-all"
              style={{ borderColor: `${modColor}`, color: modColor, backgroundColor: `${modColor}30` }}
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 px-4 py-2 rounded-lg border-2 font-bold text-sm transition-all"
              style={{ borderColor: `${modColor}40`, color: `${modColor}80`, backgroundColor: 'rgba(0,0,0,0.4)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <p className="text-sm font-mono break-all" style={{ color: modColor }}>{currentOwner}</p>
        </div>
      )}
    </div>
  )
}
