"use client";

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loading } from '@/ui/Loading'
import { ModuleType } from '@/types'
import { userContext } from '@/context'
import { ModContent, ModApi, ModApp } from '@/mod'
import ModCard from '@/mod/ModCard'
import { ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { text2color, colorWithOpacity } from '@/utils'
import UpdateMod from '@/user/UpdateMod'
import ModEdit from '@/mod/edit/ModEdit'
import ModVersions from '@/mod/versions/ModVersions'

const defaultTab = 'api'
const availableTabs = ['api', 'app', 'versions', 'content', 'edit']
export default function ModulePage() {
  const params = useParams()
  const router = useRouter()
  const { client, user } = userContext()
  const modName = params.mod as string
  const modKey = params.key as string
  const [mod, setMod] = useState<ModuleType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>(defaultTab)
  const [myMod, setMyMod] = useState(false)
  const [allModVersions, setAllModVersions] = useState<ModuleType[]>([])
  const [selectedOwnerIndex, setSelectedOwnerIndex] = useState(0)

  const moduleColor = mod ? text2color(mod.name || mod.key) : '#ffffff'


  // if mod has no app, remove app from availableTabs
  if (mod && !mod.url_app) {
    const index = availableTabs.indexOf('app')
    if (index > -1) {
      availableTabs.splice(index, 1)
      if (activeTab === 'app') {
        setActiveTab(defaultTab)
      }
    }
  } else {
    if (!availableTabs.includes('app')) {
      availableTabs.push('app')
    }
  }

  useEffect(() => {
    const fetchMod = async () => {
      if (!modName || !modKey) return
      setLoading(true)
      setError(null)
      try {
        if (!client) {
          setError('Client not initialized')
          return
        }
        console.log('Fetching mod:', modName, modKey)
        const data = await client.call('mod', { mod: modName, key: modKey, expand: true , schema: true })
        console.log('Fetched mod data:', data)
        if (user?.key && data.key === user.key) {
          setMyMod(true)
        } else {
          setMyMod(false)
        }
        setMod(data as ModuleType)

        // Fetch all versions of this module by different owners
        try {
          const allVersions = await client.call('mods', { search: modName })
          const sameNameMods = (Array.isArray(allVersions) ? allVersions : [])
            .filter((m: any) => m.name === modName)
          setAllModVersions(sameNameMods)

          // Set selected owner index based on current mod key
          const currentIndex = sameNameMods.findIndex((m: any) => m.key === modKey)
          setSelectedOwnerIndex(currentIndex >= 0 ? currentIndex : 0)
        } catch (err) {
          console.error('Failed to fetch all mod versions:', err)
          setAllModVersions([data as ModuleType])
        }
      } catch (err: any) {
        console.error('Failed to fetch mod:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchMod()
  }, [modName, modKey, client, user])

  if (loading) {
    return (
      <div className="min-h-screen bg-black font-mono relative overflow-hidden flex items-center justify-center" style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>
        <div
          className="fixed inset-0 pointer-events-none z-10 opacity-[0.03]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)',
          }}
        />
        <div className="flex items-center gap-3 z-20">
          <span className="text-blue-400 animate-pulse font-extrabold">_</span>
          <span className="text-[12px] text-blue-400/50 font-bold">LOADING MODULE...</span>
        </div>
      </div>
    )
  }

  if (error || !mod) {
    return (
      <div className="min-h-screen bg-black font-mono relative overflow-hidden flex items-center justify-center p-6" style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>
        <div
          className="fixed inset-0 pointer-events-none z-10 opacity-[0.03]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)',
          }}
        />
        <div className="max-w-2xl w-full bg-[#0d0d0d] border-2 border-red-500/40 z-20">
          <div className="px-5 py-3 border-b border-red-500/30 flex items-center gap-2">
            <span className="text-red-400 text-[11px] font-extrabold">[ERR]</span>
            <span className="text-[11px] font-extrabold text-red-400 uppercase tracking-wider">Error</span>
          </div>
          <div className="px-5 py-4">
            <p className="text-[12px] text-red-400/70 font-medium">{error || 'Module not found'}</p>
          </div>
        </div>
      </div>
    )
  }

  const handleOwnerChange = (newOwnerKey: string) => {
    router.push(`/mod/${modName}/${newOwnerKey}`)
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono relative overflow-hidden" style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>
      {/* CRT scanline overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-10 opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)',
        }}
      />

      <main className="relative flex-1 px-6 pt-24 pb-8 z-20">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="mb-6">
            <ModCard mod={mod} card_enabled={false} />
          </div>

          {/* Owner Toggle */}
          {allModVersions.length > 1 && (
            <div className="mb-4 flex items-center gap-3">
              <span className="text-[10px] font-extrabold text-cyan-400/50 uppercase tracking-[0.2em]">
                OWNER
              </span>
              <div className="relative">
                <select
                  value={modKey}
                  onChange={(e) => handleOwnerChange(e.target.value)}
                  className="px-3 py-2 bg-[#0d0d0d] text-white/70 font-mono font-bold text-[12px] focus:outline-none transition-all appearance-none pr-8 hover:bg-white/[0.03] border border-cyan-500/25"
                >
                  {allModVersions.map((version, idx) => (
                    <option key={version.key} value={version.key}>
                      {version.key.slice(0, 8)}...{version.key.slice(-6)} {version.updated ? `(Updated: ${new Date(version.updated * 1000).toLocaleDateString()})` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none w-3.5 h-3.5 text-white/25"
                />
              </div>
              <span className="text-[10px] text-amber-400/40 font-bold uppercase tracking-wider">
                {allModVersions.length} version{allModVersions.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-px">
            {availableTabs.map((tab) => {
              const isActive = activeTab === tab
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`relative px-5 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.15em] transition-all border-b ${
                    isActive
                      ? 'bg-[#0d0d0d] text-white/80'
                      : 'bg-transparent text-white/25 hover:text-white/45 border-transparent'
                  }`}
                  style={isActive ? { borderColor: colorWithOpacity(moduleColor, 0.5) } : undefined}
                >
                  {tab}
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          <div className="bg-[#0d0d0d] border border-white/[0.08] min-h-[400px] p-6">
            {activeTab === 'content' && <ModContent mod={mod} />}
            {activeTab === 'api' && <ModApi mod={mod} />}
            {activeTab === 'app' && mod.url_app && <ModApp mod={mod} moduleColor={moduleColor} />}
            {activeTab === 'versions' && <ModVersions mod={mod} />}
            {activeTab === 'update' && myMod && <UpdateMod mod={mod} />}
            {activeTab === 'edit' && myMod && <ModEdit mod={mod} />}
            {activeTab === 'edit' && !myMod && (
              <div className="flex items-center justify-center py-16">
                <p className="text-[12px] text-amber-400/40 font-bold uppercase tracking-wider">Only the module owner can edit this module.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
