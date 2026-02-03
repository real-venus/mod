'use client'

import { useState, useEffect } from 'react'
import { userContext } from '@/mod/context'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { text2color } from '@/mod/utils'

interface ModuleSelectorProps {
  onSelect: (moduleName: string) => void
  selectedModule?: string
  filterByOwner?: string
  allowOwnerSelection?: boolean
}

const ui = {
  bg: '#0b0b0b',
  panel: '#121212',
  border: '#2a2a2a',
  text: '#e7e7e7',
  textDim: '#a8a8a8',
  purple: '#a855f7',
}

export default function ModuleSelector({ onSelect, selectedModule, filterByOwner, allowOwnerSelection = false }: ModuleSelectorProps) {
  const { client, user } = userContext()
  const [modules, setModules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOwner, setSelectedOwner] = useState<string>(filterByOwner || '')
  const [allOwners, setAllOwners] = useState<string[]>([])

  useEffect(() => {
    const fetchModules = async () => {
      if (!client) return
      
      setLoading(true)
      try {
        // If selectedOwner is provided, fetch user's modules
        if (selectedOwner) {
          const userData = await client.call('user', { key: selectedOwner, expand: true })
          setModules(userData.mods || [])
        } else {
          // Otherwise fetch all modules
          const allMods = await client.call('mods', {})
          setModules(allMods || [])
          
          // Extract unique owners for filter
          if (allowOwnerSelection) {
            const owners = Array.from(new Set(allMods.map((m: any) => m.key).filter(Boolean)))
            setAllOwners(owners as string[])
          }
        }
      } catch (err) {
        console.error('Failed to fetch modules:', err)
        setModules([])
      } finally {
        setLoading(false)
      }
    }

    fetchModules()
  }, [client, selectedOwner, allowOwnerSelection])

  const filteredModules = modules.filter(mod => 
    mod.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mod.key?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: ui.purple }}></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {allowOwnerSelection && allOwners.length > 0 && (
        <div>
          <label className="text-sm font-bold mb-2 block" style={{ color: ui.text }}>Filter by Owner</label>
          <select
            value={selectedOwner}
            onChange={(e) => setSelectedOwner(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border-2 outline-none"
            style={{
              backgroundColor: ui.panel,
              borderColor: ui.border,
              color: ui.text
            }}
          >
            <option value="">All Owners</option>
            {allOwners.map((owner) => {
              const ownerColor = text2color(owner)
              return (
                <option key={owner} value={owner}>
                  {owner.slice(0, 8)}...{owner.slice(-6)}
                </option>
              )
            })}
          </select>
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search modules..."
          className="w-full px-4 py-3 pl-12 rounded-lg border-2 outline-none"
          style={{
            backgroundColor: ui.panel,
            borderColor: ui.border,
            color: ui.text
          }}
        />
        <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2" style={{ color: ui.textDim }} />
      </div>

      <div className="max-h-96 overflow-y-auto space-y-2">
        {filteredModules.length === 0 ? (
          <div className="text-center py-8" style={{ color: ui.textDim }}>
            {selectedOwner ? 'No modules owned by this address' : 'No modules found'}
          </div>
        ) : (
          filteredModules.map((mod) => (
            <button
              key={mod.key}
              onClick={() => onSelect(mod.name)}
              className="w-full text-left px-4 py-3 rounded-lg border-2 transition-all"
              style={{
                backgroundColor: selectedModule === mod.name ? `${ui.purple}20` : ui.panel,
                borderColor: selectedModule === mod.name ? ui.purple : ui.border,
                color: ui.text
              }}
            >
              <div className="font-bold" style={{ color: selectedModule === mod.name ? ui.purple : ui.text }}>
                {mod.name}
              </div>
              <div className="text-sm font-mono mt-1" style={{ color: ui.textDim }}>
                {mod.key?.slice(0, 8)}...{mod.key?.slice(-6)}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}