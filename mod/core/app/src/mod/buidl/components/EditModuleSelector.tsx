"use client";

import { useState, useEffect } from 'react'
import { userContext } from '@/mod/context/UserContext'
import { text2color } from '@/mod/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { MagnifyingGlassIcon, PencilSquareIcon, CubeIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import Client from '@/mod/client'

export default function EditModuleSelector() {
  const { user, network } = userContext()
  const [modules, setModules] = useState<any[]>([])
  const [filteredModules, setFilteredModules] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedModule, setSelectedModule] = useState<any>(null)
  const [editCode, setEditCode] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const userColor = user?.key ? text2color(user.key) : '#3b82f6'

  useEffect(() => {
    const fetchModules = async () => {
      if (!user?.key) return
      try {
        setLoading(true)
        const client = new Client(network as unknown as string ?? undefined)
        const mods = await client.call('module/modules', { key: user.key })
        setModules(Array.isArray(mods) ? mods : [])
      } catch (err) {
        console.error('Failed to fetch modules:', err)
        setModules([])
        setFilteredModules([])
      } finally {
        setLoading(false)
      }
    }
    fetchModules()
  }, [user?.key, network])

  useEffect(() => {
    if (!search.trim()) {
      setFilteredModules(modules)
    } else {
      setFilteredModules(
        modules.filter(m => 
          (m.name || m.module || '').toLowerCase().includes(search.toLowerCase())
        )
      )
    }
  }, [search, modules])

  const handleSelectModule = async (mod: any) => {
    setSelectedModule(mod)
    setEditCode(mod.code || mod.content || '# Module code will appear here')
  }

  const handleSave = async () => {
    if (!selectedModule) return
    setIsSaving(true)
    try {
      // TODO: Implement save API call
      console.log('Saving module:', selectedModule.name, editCode)
      await new Promise(resolve => setTimeout(resolve, 1500))
    } finally {
      setIsSaving(false)
    }
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <PencilSquareIcon className="w-16 h-16 text-gray-700 mb-4" />
        <p className="text-gray-500 font-mono text-sm">Connect your wallet to edit modules</p>
      </div>
    )
  }

  if (selectedModule) {
    return (
      <div className="space-y-4">
        {/* Back button + module name */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedModule(null)}
            className="px-3 py-2 rounded-lg border-2 text-sm font-bold transition-all hover:scale-105 active:scale-95"
            style={{ borderColor: `${userColor}40`, color: userColor, fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
          >
            ← Back
          </button>
          <div className="flex items-center gap-2">
            <CubeIcon className="w-5 h-5" style={{ color: userColor }} />
            <span className="font-bold text-lg" style={{ color: userColor, fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>
              {selectedModule.name || selectedModule.module}
            </span>
          </div>
        </div>

        {/* Code editor */}
        <textarea
          value={editCode}
          onChange={(e) => setEditCode(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border-2 bg-transparent text-green-400 placeholder-gray-700 outline-none transition-all duration-300 font-mono text-sm resize-none leading-relaxed"
          style={{
            borderColor: `${userColor}30`,
            backgroundColor: `${userColor}03`,
            fontFamily: 'IBM Plex Mono, Courier New, monospace',
            minHeight: '400px',
          }}
          spellCheck={false}
        />

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-3 rounded-xl border-2 font-bold text-sm tracking-wider uppercase transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40"
          style={{
            borderColor: userColor,
            color: userColor,
            backgroundColor: `${userColor}08`,
            fontFamily: 'IBM Plex Mono, Courier New, monospace',
          }}
        >
          {isSaving ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Saving...
            </span>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your modules..."
          className="w-full pl-12 pr-4 py-3 rounded-xl border-2 bg-transparent text-white placeholder-gray-600 outline-none transition-all duration-300 font-mono text-sm"
          style={{ borderColor: `${userColor}20`, backgroundColor: `${userColor}03` }}
        />
      </div>

      {/* Module list */}
      {loading ? (
        <div className="flex flex-col items-center py-16">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-3" style={{ borderColor: userColor }} />
          <span className="text-gray-500 font-mono text-sm">Loading modules...</span>
        </div>
      ) : filteredModules.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <CubeIcon className="w-12 h-12 text-gray-700 mb-3" />
          <span className="text-gray-500 font-mono text-sm">
            {search ? 'No modules match your search' : 'No modules found'}
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredModules.map((mod, index) => (
            <motion.button
              key={mod.name || mod.module || index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: index * 0.04 }}
              onClick={() => handleSelectModule(mod)}
              className="w-full group flex items-center justify-between px-5 py-4 rounded-xl border-2 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
              style={{
                borderColor: 'rgba(255,255,255,0.06)',
                backgroundColor: 'rgba(255,255,255,0.01)',
              }}
            >
              <div className="flex items-center gap-3">
                <CubeIcon className="w-5 h-5 text-gray-600 group-hover:text-current transition-colors" />
                <span className="font-bold text-sm text-gray-300 group-hover:text-white transition-colors font-mono">
                  {mod.name || mod.module}
                </span>
              </div>
              <ChevronRightIcon className="w-4 h-4 text-gray-700 group-hover:text-gray-400 transition-all group-hover:translate-x-1" />
            </motion.button>
          ))}
        </div>
      )}
    </div>
  )
}
