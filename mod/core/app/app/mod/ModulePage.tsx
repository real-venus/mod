"use client";

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loading } from '@/ui/Loading'
import { ModuleType } from '@/types'
import { userContext } from '@/context'
import { useRouter } from 'next/navigation'
import { text2color, colorWithOpacity, getModAppUrl } from '@/utils'
import UpdateMod from '@/user/UpdateMod'
import ModEdit from '@/mod/edit/ModEdit'
import ModVersions from '@/mod/versions/ModVersions'
import ModTask from '@/mod/task/ModTask'
import ModContent from '@/mod/content/ModContent'
import ModTerminal from '@/mod/terminal/ModTerminal'
import ModConfig from '@/mod/config/ModConfig'
import ModApp from '@/mod/app/ModApp'
import ModApiTab from '@/mod/api/ModApiTab'
import ModManage from '@/mod/manage/ModManage'

const defaultTab = 'content'
export default function ModulePage() {
  const params = useParams()
  const router = useRouter()
  const { client, user } = userContext()
  const modName = params.mod as string
  const modKey = (params.key as string) || ''
  const [mod, setMod] = useState<ModuleType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>(defaultTab)
  const [myMod, setMyMod] = useState(false)
  const [allModVersions, setAllModVersions] = useState<ModuleType[]>([])
  const [selectedOwnerIndex, setSelectedOwnerIndex] = useState(0)
  const [versions, setVersions] = useState<any[]>([])
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(0)

  const moduleColor = mod ? text2color(mod.name || mod.key) : '#ffffff'


  useEffect(() => {
    const fetchMod = async () => {
      if (!modName) return
      setLoading(true)
      setError(null)
      try {
        if (!client) {
          setError('Client not initialized')
          return
        }

        let resolvedKey = modKey
        let data: any = null

        if (resolvedKey) {
          // Key provided — fetch directly
          data = await client.call('mod', { mod: modName, key: resolvedKey, expand: true, schema: true })
        } else {
          // No key — resolve by searching for the module name
          const allVersions = await client.call('mods', { search: modName })
          const sameNameMods = (Array.isArray(allVersions) ? allVersions : [])
            .filter((m: any) => m.name === modName)
          if (sameNameMods.length > 0) {
            resolvedKey = sameNameMods[0].key
            data = await client.call('mod', { mod: modName, key: resolvedKey, expand: true, schema: true })
            setAllModVersions(sameNameMods)
            setSelectedOwnerIndex(0)
          }
        }

        if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
          setError(`Module '${modName}' not found`)
          return
        }
        if (data.error) {
          setError(data.error)
          return
        }
        if (user?.key && data.key === user.key) {
          setMyMod(true)
        } else {
          setMyMod(false)
        }
        setMod(data as ModuleType)

        // Fetch all versions of this module by different owners (if not already fetched above)
        if (modKey) {
          try {
            const allVersions = await client.call('mods', { search: modName })
            const sameNameMods = (Array.isArray(allVersions) ? allVersions : [])
              .filter((m: any) => m.name === modName)
            setAllModVersions(sameNameMods)

            const currentIndex = sameNameMods.findIndex((m: any) => m.key === resolvedKey)
            setSelectedOwnerIndex(currentIndex >= 0 ? currentIndex : 0)
          } catch (err) {
            console.error('Failed to fetch all mod versions:', err)
            setAllModVersions([data as ModuleType])
          }
        }

        // Fetch historical versions of this specific module
        try {
          const vers = await client.call('versions', { key: resolvedKey, mod: modName })
          const versionsList = Array.isArray(vers) ? vers : []
          setVersions(versionsList)
          setSelectedVersionIndex(0)
        } catch (err) {
          console.error('Failed to fetch versions:', err)
          setVersions([])
        }
      } catch (err: any) {
        console.error('Failed to fetch mod:', err)
        setError(err?.message || 'Failed to load module')
      } finally {
        setLoading(false)
      }
    }
    fetchMod()
  }, [modName, modKey, client, user])

  const fnCount = mod?.schema ? Object.keys(mod.schema).length : 0

  // Broadcast module info to TopBar
  useEffect(() => {
    if (!mod) return
    window.dispatchEvent(new CustomEvent('mod:info', {
      detail: { fnCount, key: mod.key, cid: mod.cid || '', url_app: getModAppUrl(mod) || '' }
    }))
    window.dispatchEvent(new CustomEvent('mod:tab-change', {
      detail: { tab: activeTab }
    }))
  }, [mod, fnCount, activeTab])

  // Listen for tab changes from TopBar
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setActiveTab(e.detail.tab)
    }
    window.addEventListener('mod:tab-set' as any, handler)
    return () => window.removeEventListener('mod:tab-set' as any, handler)
  }, [])

  if (loading) {
    return (
      <div
        className="min-h-screen font-mono relative overflow-hidden flex items-center justify-center"
        style={{
          fontFamily: 'var(--font-digital), monospace',
          backgroundColor: 'var(--bg-primary)',
          background: `repeating-linear-gradient(0deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 1px, transparent 1px, transparent 2px), var(--bg-primary)`,
        }}
      >
        <div className="flex flex-col items-center gap-5 z-20">
          <div className="w-16 h-16 border-4 flex items-center justify-center" style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-secondary)' }}>
            <span className="animate-pulse font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>_</span>
          </div>
          <span className="text-lg font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital)' }}>▸ LOADING MODULE...</span>
        </div>
      </div>
    )
  }

  if (error || !mod) {
    return (
      <div
        className="min-h-screen font-mono relative overflow-hidden flex items-center justify-center p-6"
        style={{
          fontFamily: 'var(--font-digital), monospace',
          backgroundColor: 'var(--bg-primary)',
          background: `repeating-linear-gradient(0deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 1px, transparent 1px, transparent 2px), var(--bg-primary)`,
        }}
      >
        <div className="max-w-2xl w-full border-4 z-20" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-strong)' }}>
          <div className="px-6 py-4 flex items-center gap-3 border-b-4" style={{ borderColor: 'var(--border-strong)' }}>
            <span className="text-red-500 text-base font-bold" style={{ fontFamily: 'var(--font-digital)' }}>[ERR]</span>
            <span className="text-base font-bold text-red-500 uppercase tracking-wider" style={{ fontFamily: 'var(--font-digital)' }}>▸ ERROR</span>
          </div>
          <div className="px-6 py-5">
            <p className="text-base text-red-500 font-bold uppercase" style={{ fontFamily: 'var(--font-digital)' }}>{error || 'MODULE NOT FOUND'}</p>
          </div>
        </div>
      </div>
    )
  }

  const handleOwnerChange = (newOwnerKey: string) => {
    router.push(`/${modName}`)
  }

  const handleVersionChange = async (versionIndex: number) => {
    setSelectedVersionIndex(versionIndex)
    // Optionally, you can load the version's content here
    // For now, this just updates the selection
  }

  return (
    <div
      className="min-h-screen font-mono relative overflow-hidden"
      style={{
        fontFamily: 'var(--font-digital), monospace',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
      }}
    >
      <main className="relative flex-1 px-4 pt-2 pb-4">
        <div className="w-full">
          {activeTab === 'task' && <ModTask mod={mod} moduleColor={moduleColor} />}
          {activeTab === 'content' && <ModContent mod={mod} />}
          {activeTab === 'config' && <ModConfig mod={mod} />}
          {activeTab === 'terminal' && <ModTerminal mod={mod} moduleColor={moduleColor} />}
          {activeTab === 'app' && getModAppUrl(mod) && <ModApp mod={mod} moduleColor={moduleColor} />}
          {activeTab === 'api' && mod.url && <ModApiTab mod={mod} moduleColor={moduleColor} />}
          {activeTab === 'versions' && <ModVersions mod={mod} selectedVersionIndex={selectedVersionIndex} onVersionChange={handleVersionChange} />}
          {activeTab === 'manage' && <ModManage mod={mod} moduleColor={moduleColor} />}
          {activeTab === 'update' && myMod && <UpdateMod mod={mod} />}
          {activeTab === 'edit' && myMod && <ModEdit mod={mod} />}
          {activeTab === 'edit' && !myMod && (
            <div className="flex items-center justify-center py-16">
              <p className="text-lg font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-digital)' }}>▸ ONLY THE MODULE OWNER CAN EDIT THIS MODULE</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
