'use client'

import { useState, useEffect } from 'react'
import { userContext } from '@/mod/context/UserContext'
import { text2color } from '@/mod/utils'
import { motion } from 'framer-motion'
import { MagnifyingGlassIcon, DocumentDuplicateIcon, CubeIcon, ArrowDownTrayIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import Client from '@/mod/client'

export default function ForkModuleEnhanced() {
  const { user, network } = userContext()
  const [modules, setModules] = useState<any[]>([])
  const [filteredModules, setFilteredModules] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [forking, setForking] = useState<string | null>(null)
  const [forked, setForked] = useState<Set<string>>(new Set())

  const userColor = user?.key ? text2color(user.key) : '#a855f7'

  useEffect(() => {
    const fetchModules = async () => {
      try {
        setLoading(true)
        const client = new Client(network?.url ?? undefined)
        const mods = await client.call('module',  {})
        setModules(Array.isArray(mods) ? mods : [])
        setFilteredModules(Array.isArray(mods) ? mods : [])
      } catch (err) {
        console.error('Failed to fetch modules:', err)
        setModules([])
        setFilteredModules([])
      } finally {
        setLoading(false)
      }
    }
    fetchModules()
  }, [network])

  useEffect(() => {
    if (!search.trim()) {
      setFilteredModules(modules)
    } else {
      setFilteredModules(
        modules.filter(m =>
          (m.name || m.module || '').toLowerCase().includes(search.toLowerCase()) ||
          (m.owner || '').toLowerCase().includes(search.toLowerCase())
        )
      )
    }
  }, [search, modules])

  const handleFork = async (mod: any) => {
    const modName = mod.name || mod.module
    if (!modName || !user?.key) return
    setForking(modName)
    try {
      // TODO: Implement fork API call
      console.log('Forking module:', modName)
      await new Promise(resolve => setTimeout(resolve, 1500))
      setForked(prev => new Set(prev).add(modName))
    } finally {
      setForking(null)
    }
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
          placeholder="Search modules to fork..."
          className="w-full pl-12 pr-4 py-3 rounded-xl border-2 bg-transparent text-white placeholder-gray-600 outline-none transition-all duration-300 font-mono text-sm"
          style={{ borderColor: `${userColor}20`, backgroundColor: `${userColor}03` }}
        />
      </div>

      {/* Module grid */}
      {loading ? (
        <div className="flex flex-col items-center py-16">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-3" style={{ borderColor: userColor }} />
          <span className="text-gray-500 font-mono text-sm">Loading modules...</span>
        </div>
      ) : filteredModules.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <CubeIcon className="w-12 h-12 text-gray-700 mb-3" />
          <span className="text-gray-500 font-mono text-sm">
            {search ? 'No modules match your search' : 'No modules available'}
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredModules.slice(0, 20).map((mod, index) => {
            const modName = mod.name || mod.module || `module-${index}`
            const modColor = text2color(modName)
            const isForking = forking === modName
            const isForked = forked.has(modName)

            return (
              <motion.div
                key={modName}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.03 }}
                className="group relative flex items-center justify-between px-5 py-4 rounded-xl border-2 transition-all duration-200"
                style={{
                  borderColor: isForked ? `${modColor}50` : 'rgba(255,255,255,0.06)',
                  backgroundColor: isForked ? `${modColor}08` : 'rgba(255,255,255,0.01)',
                }}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border"
                    style={{ borderColor: `${modColor}30`, backgroundColor: `${modColor}10` }}
                  >
                    <CubeIcon className="w-4 h-4" style={{ color: modColor }} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-gray-200 truncate font-mono">{modName}</div>
                    {mod.owner && (
                      <div className="text-xs text-gray-600 truncate font-mono">
                        by {mod.owner.slice(0, 8)}...
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleFork(mod)}
                  disabled={isForking || isForked || !user}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-xs font-bold uppercase tracking-wider transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 ml-3"
                  style={{
                    borderColor: isForked ? `${modColor}50` : `${userColor}40`,
                    color: isForked ? modColor : userColor,
                    backgroundColor: isForked ? `${modColor}10` : `${userColor}05`,
                    fontFamily: 'IBM Plex Mono, Courier New, monospace',
                  }}
                >
                  {isForking ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      <span>Forking</span>
                    </>
                  ) : isForked ? (
                    <>
                      <CheckCircleIcon className="w-3.5 h-3.5" />
                      <span>Forked</span>
                    </>
                  ) : (
                    <>
                      <DocumentDuplicateIcon className="w-3.5 h-3.5" />
                      <span>Fork</span>
                    </>
                  )}
                </button>
              </motion.div>
            )
          })}
        </div>
      )}

      {!user && (
        <div className="text-center py-8">
          <p className="text-gray-500 font-mono text-sm">Connect your wallet to fork modules</p>
        </div>
      )}
    </div>
  )
}
