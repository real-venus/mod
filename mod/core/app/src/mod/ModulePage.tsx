"use client";

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loading } from '@/ui/Loading'
import { ModuleType } from '@/types'
import { userContext } from '@/context'
import { ModContent, ModApi, ModApp } from '@/mod'
import ModCard from '@/mod/ModCard'
import { AlertCircle, ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { text2color } from '@/utils'
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
        const data = await client.call('mod', { mod: modName, key: modKey, expand: true })
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
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (error || !mod) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-6">
        <div className="max-w-2xl w-full flex items-start gap-4 p-6 rounded-2xl border-2 border-rose-500/50 bg-gradient-to-br from-rose-500/20 to-rose-600/15 backdrop-blur-xl shadow-2xl shadow-rose-500/20">
          <AlertCircle className="w-10 h-10 text-rose-400 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="text-3xl font-black text-rose-300 mb-2 uppercase tracking-wide">ERROR</h3>
            <p className="text-xl text-rose-200/90 font-bold">{error || 'Module not found'}</p>
          </div>
        </div>
      </div>
    )
  }

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 }
  }

  const rgb = hexToRgb(moduleColor)


  
    const tabColors = {
      api: { r: 59, g: 130, b: 246 },
      app: { r: 34, g: 197, b: 94 },
      update: { r: 251, g: 191, b: 36 },
      content: { r: 168, g: 85, b: 247 },
      versions: { r: 245, g: 158, b: 11 },
      edit: { r: 236, g: 72, b: 153 }
    }

  const handleOwnerChange = (newOwnerKey: string) => {
    router.push(`/mod/${modName}/${newOwnerKey}`)
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <main className="flex-1 px-6 pt-24 pb-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="mb-10">
            <ModCard mod={mod} card_enabled={false} />
          </div>

          {/* Owner Toggle - Show when multiple owners exist for this module */}
          {allModVersions.length > 1 && (
            <div className="mb-6 flex items-center gap-3">
              <span className="text-sm font-bold text-gray-400 uppercase tracking-wide">
                Owner:
              </span>
              <div className="relative">
                <select
                  value={modKey}
                  onChange={(e) => handleOwnerChange(e.target.value)}
                  className="px-4 py-2 rounded-xl border-2 bg-black/80 text-white font-mono text-sm font-bold focus:outline-none transition-all appearance-none pr-10"
                  style={{
                    borderColor: moduleColor,
                    backgroundColor: `${moduleColor}15`,
                    boxShadow: `0 0 20px ${moduleColor}30`
                  }}
                >
                  {allModVersions.map((version, idx) => (
                    <option key={version.key} value={version.key}>
                      {version.key.slice(0, 8)}...{version.key.slice(-6)} {version.updated ? `(Updated: ${new Date(version.updated * 1000).toLocaleDateString()})` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none w-4 h-4"
                  style={{ color: moduleColor }}
                />
              </div>
              <span className="text-xs text-gray-500">
                {allModVersions.length} version{allModVersions.length !== 1 ? 's' : ''} available
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-3 mb-6 bg-black p-4 rounded-xl">
            {availableTabs.map((tab) => {
              const isActive = activeTab === tab
              const color = tabColors[tab as keyof typeof tabColors]
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`px-6 py-3 rounded-xl font-black text-base uppercase transition-all duration-300 ${
                    isActive
                      ? 'text-white border-2 shadow-2xl scale-105'
                      : 'text-gray-400 border-2 border-gray-600/40 hover:scale-105 hover:border-gray-500/60'
                  }`}
                  style={{
                    backgroundColor: isActive ? `rgba(${color.r}, ${color.g}, ${color.b}, 0.3)` : 'rgba(0, 0, 0, 1)',
                    borderColor: isActive ? `rgba(${color.r}, ${color.g}, ${color.b}, 0.8)` : 'rgba(255, 255, 255, 0.1)',
                    boxShadow: isActive ? `0 0 24px rgba(${color.r}, ${color.g}, ${color.b}, 0.5)` : undefined
                  }}
                >
                  {tab}
                </button>
              )
            })}
          </div>
            <div className="bg-black p-6 rounded-xl min-h-[400px]">
              {activeTab === 'content' && <ModContent mod={mod} />}
              {activeTab === 'api' && <ModApi mod={mod} />}
              {activeTab === 'app' && mod.url_app && <ModApp mod={mod} moduleColor={moduleColor} />}
              {activeTab === 'versions' && <ModVersions mod={mod} />}
              {activeTab === 'update' && myMod && <UpdateMod mod={mod} />}
              {activeTab === 'edit' && myMod && <ModEdit mod={mod} />}
              {activeTab === 'edit' && !myMod && (
                <div className="flex items-center justify-center py-16">
                  <p className="text-gray-500 font-mono text-lg">Only the module owner can edit this module.</p>
                </div>
              )}
            </div>
      </div>
    </main>
  </div>
)
}
