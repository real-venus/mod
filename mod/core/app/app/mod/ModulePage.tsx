"use client";

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loading } from '@/ui/Loading'
import { ModuleType } from '@/types'
import { userContext } from '@/context'
import { useRouter } from 'next/navigation'
import { text2color, colorWithOpacity, shorten } from '@/utils'
import UpdateMod from '@/user/UpdateMod'
import ModEdit from '@/mod/edit/ModEdit'
import ModVersions from '@/mod/versions/ModVersions'
import ModTask from '@/mod/task/ModTask'
import ModCode from '@/mod/code/ModCode'
import ModContent from '@/mod/content/ModContent'
import Link from 'next/link'

const defaultTab = 'task'
const availableTabs = ['task', 'content', 'versions', 'edit']
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
  const [versions, setVersions] = useState<any[]>([])
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(0)

  const moduleColor = mod ? text2color(mod.name || mod.key) : '#ffffff'


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

        // Fetch historical versions of this specific module
        try {
          const vers = await client.call('versions', { key: modKey, mod: modName })
          const versionsList = Array.isArray(vers) ? vers : []
          setVersions(versionsList)
          setSelectedVersionIndex(0) // Default to latest version
        } catch (err) {
          console.error('Failed to fetch versions:', err)
          setVersions([])
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
    router.push(`/mod/${modName}/${newOwnerKey}`)
  }

  const handleVersionChange = async (versionIndex: number) => {
    setSelectedVersionIndex(versionIndex)
    // Optionally, you can load the version's content here
    // For now, this just updates the selection
  }

  const fnCount = mod.schema ? Object.keys(mod.schema).length : 0

  return (
    <div
      className="min-h-screen font-mono relative overflow-hidden"
      style={{
        fontFamily: 'var(--font-digital), monospace',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
      }}
    >
      <main className="relative flex-1 px-5 pt-3 pb-4">
        <div className="w-full">
          {/* Single top bar: name + owner + cid + tabs all inline */}
          <div
            className="flex items-center gap-5 pb-3 mb-3"
            style={{ borderBottom: '1px solid var(--border-color)', fontFamily: 'var(--font-digital)' }}
          >
            {/* Name */}
            <code
              className="font-bold tracking-wide"
              style={{ color: 'var(--text-primary)', fontSize: '18px', textShadow: `0 0 12px ${colorWithOpacity(moduleColor, 0.4)}` }}
            >
              {mod.name?.toLowerCase()}
            </code>

            {fnCount > 0 && (
              <span style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>[{fnCount} fn]</span>
            )}

            {/* Owner */}
            <Link href={`/user/${mod.key}`} className="hover:underline" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              {shorten(mod.key, 4, 4)}
            </Link>

            {/* CID */}
            {mod.cid && (
              <span style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>
                {shorten(mod.cid, 4, 4)}
              </span>
            )}

            {/* Tabs right beside */}
            {availableTabs.map((tab) => {
              const isActive = activeTab === tab
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className="px-3 py-1 font-bold uppercase tracking-wider transition-all"
                  style={{
                    fontSize: '13px',
                    ...(isActive
                      ? {
                          color: 'var(--bg-primary)',
                          backgroundColor: 'var(--text-primary)',
                        }
                      : {
                          color: 'var(--text-tertiary)',
                          backgroundColor: 'transparent',
                        }),
                  }}
                >
                  {tab}
                </button>
              )
            })}
          </div>

          {/* Tab content - full width */}
          <div>
            {activeTab === 'task' && <ModTask mod={mod} moduleColor={moduleColor} />}
            {activeTab === 'content' && <ModContent mod={mod} />}
            {activeTab === 'versions' && <ModVersions mod={mod} selectedVersionIndex={selectedVersionIndex} onVersionChange={handleVersionChange} />}
            {activeTab === 'update' && myMod && <UpdateMod mod={mod} />}
            {activeTab === 'edit' && myMod && <ModEdit mod={mod} />}
            {activeTab === 'edit' && !myMod && (
              <div className="flex items-center justify-center py-16">
                <p className="text-lg font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-digital)' }}>▸ ONLY THE MODULE OWNER CAN EDIT THIS MODULE</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
