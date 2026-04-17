"use client"

import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { WalletHeader } from '@/wallet/WalletHeader'
import { userContext } from '@/context'
import { useLayoutContext } from '@/context/LayoutContext'
import { text2color, colorWithOpacity, shorten } from '@/utils'
import { clearModsCache } from '@/mod/explore/ModExplorePage'
import { Wrench } from 'lucide-react'

// Extract module name from path like /bread or /mod/bread/key or /bread/0xkey
function getModuleFromPath(pathname: string): string | null {
  // /mod/[name]/[key]
  const modMatch = pathname.match(/^\/mod\/([^/]+)/)
  if (modMatch) return modMatch[1]
  const knownRoutes = ['mod', 'mods', 'user', 'cid', 'chat', 'docs', 'quests', 'create', 'safe', 'contracts', 'treasury', 'jobs', 'traders', 'network', 'home', 'transactions', 'buidl', 'apps', 'chain', 'balancer', 'workers', 'agent']
  // /[name]/[key] (two segments, first is not a known route)
  const twoSegMatch = pathname.match(/^\/([^/]+)\/([^/]+)$/)
  if (twoSegMatch && !knownRoutes.includes(twoSegMatch[1])) return twoSegMatch[1]
  // /[name] (single segment, not a known route)
  const singleMatch = pathname.match(/^\/([^/]+)$/)
  if (singleMatch && !knownRoutes.includes(singleMatch[1])) return singleMatch[1]
  return null
}

export function TopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, client } = userContext()
  const { isHeaderCollapsed, toggleHeaderCollapsed, isEditSidebarOpen, toggleEditSidebar } = useLayoutContext()

  // Build dropdown state
  const [showBuild, setShowBuild] = useState(false)
  const [buildName, setBuildName] = useState('')
  const [buildBase, setBuildBase] = useState('base')
  const [buildSubmitting, setBuildSubmitting] = useState(false)
  const [buildResult, setBuildResult] = useState<any>(null)
  const [buildError, setBuildError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<any[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templateSearch, setTemplateSearch] = useState('')
  const [buildMode, setBuildMode] = useState<'build' | 'fork'>('build')
  const buildRef = useRef<HTMLDivElement>(null)
  const templateSearchRef = useRef<HTMLInputElement>(null)

  // Fork dropdown state (module page only)
  const [showFork, setShowFork] = useState(false)
  const [forkName, setForkName] = useState('')
  const [forkSubmitting, setForkSubmitting] = useState(false)
  const [forkResult, setForkResult] = useState<any>(null)
  const [forkError, setForkError] = useState<string | null>(null)
  const forkRef = useRef<HTMLDivElement>(null)

  // Module page detection
  const activeModule = getModuleFromPath(pathname)
  const moduleColor = activeModule ? text2color(activeModule) : '#ffffff'

  // Module tab state (shared with ModulePage via custom event)
  const [moduleTab, setModuleTab] = useState<string>('info')

  // Listen for module tab changes from ModulePage
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setModuleTab(e.detail.tab)
    }
    window.addEventListener('mod:tab-change' as any, handler)
    return () => window.removeEventListener('mod:tab-change' as any, handler)
  }, [])

  // Listen for module info (fnCount, key, cid, allOwners) from ModulePage
  const [moduleInfo, setModuleInfo] = useState<{ fnCount: number; key: string; cid: string; url_app?: string; url_api?: string; allOwners?: any[]; isRunning?: boolean; myMod?: boolean; isCreator?: boolean; isPublic?: boolean } | null>(null)
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false)
  const ownerDropdownRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setModuleInfo(e.detail)
    }
    window.addEventListener('mod:info' as any, handler)
    return () => window.removeEventListener('mod:info' as any, handler)
  }, [])

  // Close owner dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (showOwnerDropdown && ownerDropdownRef.current && !ownerDropdownRef.current.contains(e.target as Node)) {
        setShowOwnerDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showOwnerDropdown])

  // Reset when leaving module page
  useEffect(() => {
    if (!activeModule) {
      setModuleInfo(null)
      setShowOwnerDropdown(false)
    }
  }, [activeModule])

  // Click-outside for build/fork dropdowns
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (showBuild && buildRef.current && !buildRef.current.contains(e.target as Node)) {
        setShowBuild(false)
      }
      if (showFork && forkRef.current && !forkRef.current.contains(e.target as Node)) {
        setShowFork(false)
      }
    }
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowBuild(false)
        setShowFork(false)
        setShowOwnerDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', escHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', escHandler)
    }
  }, [showBuild, showFork])

  // Fetch templates when build dropdown opens
  useEffect(() => {
    if (showBuild && client && templates.length === 0) {
      setTemplatesLoading(true)
      client.call('mods', { page: 0, page_size: 100 })
        .then((res: any) => {
          setTemplates(Array.isArray(res) ? res : [])
        })
        .catch(() => {})
        .finally(() => setTemplatesLoading(false))
    }
    if (showBuild) {
      setBuildError(null)
      setBuildResult(null)
      setTemplateSearch('')
    }
  }, [showBuild, client])

  // Reset fork name when module changes
  useEffect(() => {
    if (activeModule) setForkName(activeModule)
  }, [activeModule])

  const handleBuildSubmit = async () => {
    if (!client?.token || !user?.key || !buildName.trim()) return
    setBuildSubmitting(true)
    setBuildError(null)
    setBuildResult(null)
    try {
      const response = await client.call('new', {
        name: buildName.trim(),
        base: buildBase,
        key: user.key,
      })
      if (response?.error) throw new Error(response.error)
      setBuildResult(response)
      clearModsCache()
      setTimeout(() => {
        setShowBuild(false)
        router.push('/mods')
      }, 1000)
    } catch (err: any) {
      setBuildError(err?.message || 'Failed to build module')
    } finally {
      setBuildSubmitting(false)
    }
  }

  const handleForkSubmit = async (modName?: string) => {
    const target = modName || activeModule
    if (!client?.token || !user?.key || !target) return
    setForkSubmitting(true)
    setForkError(null)
    setForkResult(null)
    setBuildError(null)
    setBuildResult(null)
    try {
      const response = await client.call('fork', {
        mod: target,
        key: user.key,
      })
      if (response?.error) throw new Error(response.error)
      setForkResult(response)
      setBuildResult(response)
      clearModsCache()
      setTimeout(() => {
        setShowFork(false)
        setShowBuild(false)
        router.push('/mods')
      }, 1000)
    } catch (err: any) {
      const msg = err?.message || 'Failed to fork module'
      setForkError(msg)
      setBuildError(msg)
    } finally {
      setForkSubmitting(false)
    }
  }

  const handleTabClick = (tab: string) => {
    window.dispatchEvent(new CustomEvent('mod:tab-set', { detail: { tab } }))
    setModuleTab(tab)
  }

  // Collapsed state
  if (isHeaderCollapsed) {
    return (
      <div
        className="fixed top-0 left-0 right-0 z-[70] flex items-center justify-between"
        style={{
          height: '6px',
          background: 'var(--bg-header)',
          borderBottom: '1px solid var(--border-color)',
          transition: 'height 0.2s ease',
          cursor: 'pointer',
        }}
        onClick={toggleHeaderCollapsed}
        onMouseEnter={(e) => {
          e.currentTarget.style.height = '12px'
          e.currentTarget.style.background = 'var(--bg-secondary)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.height = '6px'
          e.currentTarget.style.background = 'var(--bg-header)'
        }}
      >
        <div className="flex items-center justify-center w-full" style={{ opacity: 0.4 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
    )
  }

  const availableTabs = [
    'info',
    ...(moduleInfo?.isPublic !== false ? ['content'] : []),
    'app', 'api',
  ]

  // On a module page: always show module info + tabs
  const showModuleBar = !!activeModule

  return (
    <div
      className="fixed top-0 left-0 z-[70] flex items-center"
      style={{
        right: isEditSidebarOpen ? '420px' : '0px',
        height: '48px',
        background: 'var(--bg-header)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-color)',
        transition: 'height 0.2s ease, right 0.2s ease',
      }}
    >
      <div className="flex items-center flex-1 pl-3 pr-2 gap-3 min-w-0">
        {showModuleBar ? (
          /* Module bar: name + meta + tabs */
          <div className="flex items-center gap-4 flex-1 min-w-0" style={{ fontFamily: 'var(--font-digital), monospace' }}>
            {/* Module name */}
            <code
              className="font-bold tracking-wide flex-shrink-0"
              style={{
                color: 'var(--text-primary)',
                fontSize: '16px',
                textShadow: `0 0 10px ${colorWithOpacity(moduleColor, 0.4)}`,
              }}
            >
              {activeModule}
            </code>

            {/* Fn count */}
            {moduleInfo && moduleInfo.fnCount > 0 && (
              <span className="flex-shrink-0" style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
                [{moduleInfo.fnCount}]
              </span>
            )}

            {/* Owner key with dropdown for other owners */}
            {moduleInfo?.key && (
              <div className="relative flex-shrink-0" ref={ownerDropdownRef}>
                <button
                  onClick={() => {
                    if (moduleInfo.allOwners && moduleInfo.allOwners.length > 1) {
                      setShowOwnerDropdown(!showOwnerDropdown)
                    }
                  }}
                  className="flex items-center gap-1 transition-all"
                  style={{
                    color: 'var(--text-tertiary)',
                    fontSize: '12px',
                    cursor: moduleInfo.allOwners && moduleInfo.allOwners.length > 1 ? 'pointer' : 'default',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: showOwnerDropdown ? 'var(--hover-bg)' : 'transparent',
                    border: showOwnerDropdown ? '1px solid var(--border-color)' : '1px solid transparent',
                  }}
                  onMouseEnter={e => {
                    if (moduleInfo.allOwners && moduleInfo.allOwners.length > 1) {
                      e.currentTarget.style.background = 'var(--hover-bg)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!showOwnerDropdown) e.currentTarget.style.background = 'transparent'
                  }}
                  title={moduleInfo.allOwners && moduleInfo.allOwners.length > 1
                    ? `${moduleInfo.allOwners.length} owners — click to switch`
                    : moduleInfo.key}
                >
                  <span>{shorten(moduleInfo.key, 4, 4)}</span>
                  {moduleInfo.allOwners && moduleInfo.allOwners.length > 1 && (
                    <span style={{ fontSize: '10px', opacity: 0.5 }}>
                      ({moduleInfo.allOwners.length}) ▾
                    </span>
                  )}
                </button>

                {/* Owner dropdown */}
                {showOwnerDropdown && moduleInfo.allOwners && moduleInfo.allOwners.length > 1 && (
                  <div
                    className="absolute left-0 top-full mt-1 z-[90] overflow-y-auto"
                    style={{
                      background: 'var(--bg-secondary)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.25)',
                      fontFamily: 'var(--font-digital), monospace',
                      minWidth: '220px',
                      maxHeight: '300px',
                    }}
                  >
                    <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                        OWNERS OF {activeModule?.toUpperCase()}
                      </span>
                    </div>
                    {moduleInfo.allOwners.map((ownerMod: any, idx: number) => {
                      const isCurrentOwner = ownerMod.key === moduleInfo.key
                      const ownerColor = text2color(ownerMod.key || '')
                      const ownerFnCount = ownerMod.schema ? Object.keys(ownerMod.schema).length : 0
                      return (
                        <button
                          key={`${ownerMod.key}-${idx}`}
                          onClick={() => {
                            setShowOwnerDropdown(false)
                            if (!isCurrentOwner) {
                              router.push(`/${activeModule}/${ownerMod.key}`)
                            }
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all"
                          style={{
                            background: isCurrentOwner ? colorWithOpacity(ownerColor, 0.1) : 'transparent',
                            borderBottom: '1px solid var(--border-color)',
                          }}
                          onMouseEnter={e => { if (!isCurrentOwner) e.currentTarget.style.background = 'var(--hover-bg)' }}
                          onMouseLeave={e => { if (!isCurrentOwner) e.currentTarget.style.background = 'transparent' }}
                        >
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{
                              background: isCurrentOwner ? ownerColor : 'var(--text-tertiary)',
                              boxShadow: isCurrentOwner ? `0 0 6px ${ownerColor}` : 'none',
                            }}
                          />
                          <div className="flex flex-col flex-1 min-w-0">
                            <span
                              className="text-xs font-bold truncate"
                              style={{ color: isCurrentOwner ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                            >
                              {shorten(ownerMod.key, 6, 4)}
                            </span>
                            {ownerMod.cid && (
                              <span className="text-[10px] truncate" style={{ color: 'var(--text-tertiary)', opacity: 0.6 }}>
                                {shorten(ownerMod.cid, 6, 4)}
                              </span>
                            )}
                          </div>
                          {ownerFnCount > 0 && (
                            <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                              {ownerFnCount} fn
                            </span>
                          )}
                          {isCurrentOwner && (
                            <span className="text-[10px] flex-shrink-0" style={{ color: ownerColor }}>&#10003;</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tabs */}
            <div className="flex items-center gap-1 min-w-0 overflow-x-auto scrollbar-none">
              {availableTabs.map((tab) => {
                const isActive = moduleTab === tab
                const tabUrl = tab === 'app' ? moduleInfo?.url_app : tab === 'api' ? moduleInfo?.url_api : undefined
                return (
                  <button
                    key={tab}
                    onClick={() => handleTabClick(tab)}
                    className="px-2.5 py-1 font-bold uppercase tracking-wider transition-all flex-shrink-0 flex items-center gap-1.5"
                    style={{
                      fontSize: '12px',
                      fontFamily: 'var(--font-digital), monospace',
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

            {/* Running status dot */}
            {moduleInfo && (
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  background: moduleInfo.isRunning ? '#10b981' : '#6b7280',
                  boxShadow: moduleInfo.isRunning ? '0 0 6px #10b981' : 'none',
                }}
                title={moduleInfo.isRunning ? 'Running' : 'Not running'}
              />
            )}

            {/* Suggest button — shown when user is a creator of another version but not the current owner */}
            {moduleInfo?.isCreator && !moduleInfo.myMod && (
              <button
                onClick={() => handleTabClick('edit')}
                className="flex-shrink-0 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-all"
                style={{
                  fontFamily: 'var(--font-digital), monospace',
                  border: `1px solid ${colorWithOpacity(moduleColor, 0.5)}`,
                  color: moduleColor,
                  background: colorWithOpacity(moduleColor, 0.08),
                }}
                title="Suggest changes to this version"
              >
                SUGGEST
              </button>
            )}

            {/* Fork button */}
            {user && (
              <button
                onClick={() => { setShowFork(!showFork); setShowBuild(false) }}
                className="flex-shrink-0 flex items-center justify-center"
                style={{
                  width: '32px',
                  height: '32px',
                  color: showFork ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  transition: 'color 0.15s ease',
                }}
                title="Fork module"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/>
                  <path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"/><path d="M12 12v3"/>
                </svg>
              </button>
            )}
          </div>
        ) : (
          /* Empty spacer when not on a module page — search is in sidebar */
          <div className="flex-1" />
        )}
      </div>

      {/* Collapse button */}
      <button
        onClick={toggleHeaderCollapsed}
        className="flex items-center justify-center flex-shrink-0 mr-1"
        style={{
          width: '24px',
          height: '24px',
          background: 'transparent',
          border: '1px solid var(--border-color)',
          borderRadius: '4px',
          cursor: 'pointer',
          color: 'var(--text-tertiary)',
          transition: 'all 0.15s ease',
        }}
        title="Collapse header"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 15 12 9 18 15" />
        </svg>
      </button>

      {/* Right section */}
      <div className="flex items-center pr-3 gap-2">
        {/* Wrench button: edit sidebar on module pages, build dropdown otherwise */}
        {user && (
          <button
            onClick={() => {
              if (activeModule) {
                toggleEditSidebar()
              } else {
                setShowBuild(!showBuild)
                setShowFork(false)
              }
            }}
            className="flex items-center justify-center flex-shrink-0 mr-1"
            style={{
              width: '28px',
              height: '28px',
              background: (activeModule ? isEditSidebarOpen : showBuild)
                ? (activeModule ? colorWithOpacity(moduleColor, 0.2) : 'var(--text-primary)')
                : 'transparent',
              border: (activeModule && isEditSidebarOpen)
                ? `1px solid ${colorWithOpacity(moduleColor, 0.5)}`
                : '1px solid var(--border-color)',
              borderRadius: '4px',
              cursor: 'pointer',
              color: (activeModule ? isEditSidebarOpen : showBuild)
                ? (activeModule ? moduleColor : 'var(--bg-primary)')
                : 'var(--text-tertiary)',
              transition: 'all 0.15s ease',
            }}
            title={activeModule ? `Edit ${activeModule}` : 'Build new module'}
          >
            <Wrench size={15} />
          </button>
        )}
        <WalletHeader />
      </div>

      {/* Build module dropdown */}
      {showBuild && (
        <div
          ref={buildRef}
          className="fixed z-[80]"
          style={{
            top: '52px',
            right: '12px',
            width: '400px',
          }}
        >
          <div
            style={{
              background: 'var(--bg-secondary)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.25)',
              fontFamily: 'var(--font-digital), monospace',
            }}
          >
            <div className="p-4 space-y-3">
              {/* Mode toggle: Build / Fork */}
              <div className="flex items-center gap-1 p-0.5 rounded-md" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                {(['build', 'fork'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => { setBuildMode(mode); setBuildError(null); setBuildResult(null) }}
                    className="flex-1 py-1.5 text-xs font-bold uppercase tracking-wider transition-all rounded-md"
                    style={{
                      background: buildMode === mode ? 'var(--bg-secondary)' : 'transparent',
                      color: buildMode === mode ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      border: buildMode === mode ? '1px solid var(--border-color)' : '1px solid transparent',
                    }}
                  >
                    {mode === 'build' ? 'NEW MOD' : 'FORK MOD'}
                  </button>
                ))}
              </div>

              {/* Search modules */}
              <div className="relative">
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="var(--text-tertiary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2"
                >
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                </svg>
                <input
                  ref={templateSearchRef}
                  type="text"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder={buildMode === 'build' ? 'SEARCH TEMPLATE...' : 'SEARCH MODULE TO FORK...'}
                  className="w-full pl-8 pr-3 py-2 text-xs font-bold focus:outline-none uppercase"
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-digital), monospace',
                  }}
                  autoFocus
                />
              </div>

              {/* Module list */}
              <div
                className="overflow-y-auto scrollbar-none"
                style={{
                  maxHeight: '200px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                }}
              >
                {templatesLoading ? (
                  <div className="px-3 py-6 text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
                    LOADING MODULES...
                  </div>
                ) : (() => {
                  const filtered = templates.filter((t: any) =>
                    !templateSearch || t.name?.toLowerCase().includes(templateSearch.toLowerCase())
                  )
                  if (filtered.length === 0) return (
                    <div className="px-3 py-6 text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
                      {templateSearch ? 'NO MATCHES' : 'NO MODULES FOUND'}
                    </div>
                  )
                  const nameCounts: Record<string, number> = {}
                  filtered.forEach((t: any) => { nameCounts[t.name] = (nameCounts[t.name] || 0) + 1 })
                  return filtered.map((t: any) => {
                    const isSelected = buildBase === t.name
                    const tColor = text2color(t.name)
                    const fnCount = t.schema ? Object.keys(t.schema).length : 0
                    const isDupe = nameCounts[t.name] > 1
                    return (
                      <button
                        key={`${t.name}-${t.key}`}
                        onClick={() => setBuildBase(t.name)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all"
                        style={{
                          background: isSelected ? colorWithOpacity(tColor, 0.08) : 'transparent',
                          borderBottom: '1px solid var(--border-color)',
                        }}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--hover-bg)' }}
                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                      >
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: isSelected ? tColor : 'var(--text-tertiary)', boxShadow: isSelected ? `0 0 6px ${tColor}` : 'none' }}
                        />
                        <span
                          className="text-xs font-bold uppercase tracking-wide truncate"
                          style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                        >
                          {t.name}
                        </span>
                        {isDupe && t.key && (
                          <span className="text-[10px] truncate flex-shrink-0 opacity-50" style={{ color: 'var(--text-tertiary)' }}>
                            {t.key.slice(0, 6)}...{t.key.slice(-4)}
                          </span>
                        )}
                        {fnCount > 0 && (
                          <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                            {fnCount} fn
                          </span>
                        )}
                        {t.url && (
                          <span className="flex items-center gap-1 flex-shrink-0" style={{ fontSize: '10px', color: 'var(--accent-success, #34d399)' }}>
                            <span className="w-1 h-1 rounded-full" style={{ background: 'var(--accent-success, #34d399)' }} />
                            LIVE
                          </span>
                        )}
                        <span className="flex-1" />
                        {isSelected && (
                          <span className="text-xs" style={{ color: tColor }}>&#10003;</span>
                        )}
                      </button>
                    )
                  })
                })()}
              </div>

              {/* Name input (build mode only) */}
              {buildMode === 'build' && (
                <input
                  type="text"
                  value={buildName}
                  onChange={(e) => setBuildName(e.target.value)}
                  placeholder="YOUR MOD NAME"
                  className="w-full px-3 py-2.5 text-sm font-bold focus:outline-none uppercase"
                  style={{
                    background: 'var(--bg-input)',
                    border: buildName.trim() ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-digital), monospace',
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && buildName.trim()) handleBuildSubmit() }}
                />
              )}

              {/* Action button */}
              {buildMode === 'build' ? (
                <button
                  onClick={handleBuildSubmit}
                  disabled={buildSubmitting || !buildName.trim()}
                  className="w-full py-2.5 text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-30"
                  style={{
                    background: 'var(--hover-bg)',
                    border: '1px solid var(--accent-primary)',
                    borderRadius: '6px',
                    color: 'var(--accent-primary)',
                    fontFamily: 'var(--font-digital), monospace',
                  }}
                >
                  {buildSubmitting ? 'BUILDING...' : `BUILD FROM ${buildBase.toUpperCase()}`}
                </button>
              ) : (
                <button
                  onClick={() => handleForkSubmit(buildBase)}
                  disabled={forkSubmitting || !buildBase}
                  className="w-full py-2.5 text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-30"
                  style={{
                    background: colorWithOpacity(text2color(buildBase), 0.12),
                    border: `1px solid ${colorWithOpacity(text2color(buildBase), 0.4)}`,
                    borderRadius: '6px',
                    color: text2color(buildBase),
                    fontFamily: 'var(--font-digital), monospace',
                  }}
                >
                  {forkSubmitting ? 'FORKING...' : `FORK ${buildBase.toUpperCase()}`}
                </button>
              )}

              {/* Result */}
              {buildResult && (
                <div className="text-xs font-bold text-green-500 uppercase px-1">
                  {buildMode === 'fork' ? 'FORKED' : 'BUILT'} &mdash; {buildResult.name || buildName}
                </div>
              )}

              {/* Error */}
              {buildError && (
                <div className="text-xs font-bold text-red-500 uppercase px-1 py-1">
                  {buildError}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fork module dropdown */}
      {showFork && activeModule && (
        <div
          ref={forkRef}
          className="fixed z-[80]"
          style={{
            top: '52px',
            left: '12px',
            width: '340px',
          }}
        >
          <div
            style={{
              background: 'var(--bg-secondary)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.2)',
              fontFamily: 'var(--font-digital), monospace',
            }}
          >
            <div className="p-4 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                FORK <span style={{ color: moduleColor }}>{activeModule}</span>
              </div>

              {/* Fork name input */}
              <input
                type="text"
                value={forkName}
                onChange={(e) => setForkName(e.target.value)}
                placeholder="FORK NAME"
                className="w-full px-3 py-2.5 text-sm font-bold focus:outline-none uppercase"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-digital), monospace',
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleForkSubmit() }}
                autoFocus
              />

              {/* Fork button */}
              <button
                onClick={() => handleForkSubmit()}
                disabled={forkSubmitting || !forkName.trim()}
                className="w-full py-2.5 text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-30"
                style={{
                  background: `${colorWithOpacity(moduleColor, 0.15)}`,
                  border: `1px solid ${colorWithOpacity(moduleColor, 0.4)}`,
                  borderRadius: '4px',
                  color: moduleColor,
                  fontFamily: 'var(--font-digital), monospace',
                }}
              >
                {forkSubmitting ? 'FORKING...' : 'FORK'}
              </button>

              {/* Result */}
              {forkResult && (
                <div className="text-xs font-bold text-green-500 uppercase">
                  FORKED SUCCESSFULLY
                </div>
              )}

              {/* Error */}
              {forkError && (
                <div className="text-xs font-bold text-red-500 uppercase py-1">
                  {forkError}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
