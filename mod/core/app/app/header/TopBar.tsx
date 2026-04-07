"use client"

import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { WalletHeader } from '@/wallet/WalletHeader'
import { useSearchContext } from '@/context/SearchContext'
import { userContext } from '@/context'
import { useLayoutContext } from '@/context/LayoutContext'
import Link from 'next/link'
import { text2color, colorWithOpacity, shorten } from '@/utils'
import { clearModsCache } from '@/mod/explore/ModExplorePage'
import { ModCardSettings } from '@/mod/ModCardSettings'
import { X } from 'lucide-react'

const COMMANDS = ['/search', '/ask', '/run'] as const

function isCid(s: string): boolean {
  const trimmed = s.trim()
  return /^Qm[1-9A-HJ-NP-Za-km-z]{44,}$/.test(trimmed) || /^bafy[a-z2-7]{50,}$/i.test(trimmed)
}

function parseRunArgs(input: string): { fn: string; params: Record<string, any> } {
  const parts = input.trim().split(/\s+/)
  const fn = parts[0] || ''
  const params: Record<string, any> = {}
  const positional: string[] = []

  for (let i = 1; i < parts.length; i++) {
    const arg = parts[i]
    const eqPos = arg.indexOf('=')
    if (eqPos > 0) {
      const key = arg.slice(0, eqPos)
      const val = arg.slice(eqPos + 1)
      params[key] = parseValue(val)
    } else {
      positional.push(arg)
    }
  }
  if (positional.length > 0) {
    params.args = positional.length === 1 ? parseValue(positional[0]) : positional.map(parseValue)
  }
  return { fn, params }
}

function parseValue(s: string): any {
  if (s === 'null' || s === 'none' || s === 'None') return null
  if (s === 'true' || s === 'True') return true
  if (s === 'false' || s === 'False') return false
  const n = Number(s)
  if (!isNaN(n) && s !== '') return n
  try {
    if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
      return JSON.parse(s)
    }
  } catch {}
  return s
}

// Extract module name from path like /bread or /mod/bread/key or /bread/0xkey
function getModuleFromPath(pathname: string): string | null {
  // /mod/[name]/[key]
  const modMatch = pathname.match(/^\/mod\/([^/]+)/)
  if (modMatch) return modMatch[1]
  const knownRoutes = ['mod', 'mods', 'user', 'cid', 'chat', 'docs', 'quests', 'create', 'safe', 'bridge', 'contracts', 'treasury', 'jobs', 'traders', 'network', 'home', 'transactions', 'buidl', 'apps', 'chain', 'balancer', 'workers']
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
  const { handleSearch, searchFilters } = useSearchContext()
  const { user, client } = userContext()
  const { isHeaderCollapsed, toggleHeaderCollapsed } = useLayoutContext()
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputValue, setInputValue] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [commandIndex, setCommandIndex] = useState(0)
  const [runResult, setRunResult] = useState<any>(null)
  const [runLoading, setRunLoading] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const activeCommand = COMMANDS[commandIndex]

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
  const [moduleTab, setModuleTab] = useState<string>('app')

  // Listen for module tab changes from ModulePage
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setModuleTab(e.detail.tab)
    }
    window.addEventListener('mod:tab-change' as any, handler)
    return () => window.removeEventListener('mod:tab-change' as any, handler)
  }, [])

  // Listen for module info (fnCount, key, cid, allOwners) from ModulePage
  const [moduleInfo, setModuleInfo] = useState<{ fnCount: number; key: string; cid: string; url_app?: string; allOwners?: any[] } | null>(null)
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
      setSearchExpanded(false)
      setShowOwnerDropdown(false)
    }
  }, [activeModule])

  // Mods toolbar state (synced from ModExplorePage via events)
  const isModsPage = pathname === '/mods'
  const [modsState, setModsState] = useState<{
    sort: string; columns: number; owners: string[]; selectedOwners: string[]; totalMods: number
  } | null>(null)

  useEffect(() => {
    const handler = (e: CustomEvent) => setModsState(e.detail)
    window.addEventListener('mods:state' as any, handler)
    return () => window.removeEventListener('mods:state' as any, handler)
  }, [])

  useEffect(() => {
    if (!isModsPage) setModsState(null)
  }, [isModsPage])

  useEffect(() => {
    setInputValue(searchFilters.searchTerm || '')
  }, [searchFilters.searchTerm])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (activeModule) {
          setSearchExpanded(true)
          setTimeout(() => inputRef.current?.focus(), 50)
        } else {
          inputRef.current?.focus()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    // Search only triggers on Enter now, not on every keystroke
  }

  const handleEnter = async () => {
    const trimmed = inputValue.trim()
    if (!trimmed) return

    if (isCid(trimmed)) {
      router.push(`/cid/${trimmed}`)
      setSearchExpanded(false)
      return
    }

    if (activeCommand === '/run') {
      if (!client) return
      const { fn, params } = parseRunArgs(trimmed)
      if (!fn) return
      setRunLoading(true)
      setRunError(null)
      setRunResult(null)
      try {
        const result = await client.call(fn, params)
        setRunResult(result)
      } catch (err: any) {
        setRunError(err.message || 'Run failed')
      } finally {
        setRunLoading(false)
      }
      return
    }

    // Search mods with the entered term
    handleSearch(trimmed)
    setSearchExpanded(false)
    if (pathname !== '/mods') {
      router.push('/mods')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleEnter()
    }
    if (e.key === 'Escape') {
      setInputValue('')
      handleSearch('')
      setRunResult(null)
      setRunError(null)
      setSearchExpanded(false)
      inputRef.current?.blur()
    }
    if ((e.key === 'Backspace' || e.key === 'Delete') && inputValue === '') {
      e.preventDefault()
      setRunResult(null)
      setRunError(null)
      setCommandIndex((prev) => (prev + 1) % COMMANDS.length)
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
    'api',
    ...(moduleInfo?.url_app ? ['app'] : []),
    'config', 'content', 'edit', 'manage', 'server', 'task', 'terminal', 'versions',
  ]

  // On a module page: show module info + tabs, search collapses to icon
  const showModuleBar = activeModule && !searchExpanded
  const showModsToolbar = isModsPage && modsState && !activeModule

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[70] flex items-center"
      style={{
        height: '48px',
        background: 'var(--bg-header)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-color)',
        transition: 'height 0.2s ease',
      }}
    >
      <div className="flex items-center flex-1 pl-3 pr-2 gap-3 min-w-0">
        {showModsToolbar ? (
          /* Mods toolbar: count + search bar + settings */
          <div className="flex items-center gap-2.5 flex-1 min-w-0" style={{ fontFamily: 'var(--font-digital), monospace' }}>
            {/* Title + count pill */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                MODS
              </span>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  color: 'var(--text-tertiary)',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  minWidth: '24px',
                  textAlign: 'center',
                }}
              >
                {modsState.totalMods}
              </span>
            </div>

            <div className="w-px h-4 flex-shrink-0" style={{ backgroundColor: 'var(--border-color)', opacity: 0.3 }} />

            {/* Search bar - always visible */}
            <div
              className="flex items-center flex-1 transition-all"
              style={{
                maxWidth: '400px',
                height: '32px',
                backgroundColor: searchFocused ? 'var(--bg-input)' : 'transparent',
                border: searchFocused ? '1px solid rgba(167, 139, 250, 0.3)' : '1px solid var(--border-color)',
                borderRadius: '8px',
                transition: 'all 0.2s ease',
              }}
            >
              <div
                className="flex items-center justify-center flex-shrink-0 pl-2.5 pr-1 cursor-pointer select-none"
                onClick={() => inputRef.current?.focus()}
                style={{ height: '100%' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={searchFocused ? 'var(--accent-primary)' : 'var(--text-tertiary)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.15s ease' }}>
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                </svg>
              </div>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="search modules..."
                className="flex-1 bg-transparent focus:outline-none min-w-0"
                style={{
                  height: '100%',
                  fontSize: '13px',
                  fontFamily: 'var(--font-digital), monospace',
                  color: 'var(--text-primary)',
                  caretColor: 'var(--accent-primary)',
                  padding: '0 8px 0 0',
                }}
              />
              {/* Active search pill inside input */}
              {searchFilters.searchTerm && (
                <button
                  onClick={() => { handleSearch(''); setInputValue('') }}
                  className="flex items-center gap-1.5 mr-2 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 transition-all"
                  style={{
                    background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.15), rgba(103, 232, 249, 0.08))',
                    border: '1px solid rgba(167, 139, 250, 0.25)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span style={{ opacity: 0.8 }}>{searchFilters.searchTerm}</span>
                  <X size={8} style={{ opacity: 0.5 }} />
                </button>
              )}
              {!searchFocused && !inputValue && !searchFilters.searchTerm && (
                <kbd
                  className="flex-shrink-0 mr-2 px-1.5 py-0.5"
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-digital), monospace',
                    backgroundColor: 'var(--hover-bg)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '3px',
                    color: 'var(--text-tertiary)',
                    lineHeight: 1.2,
                  }}
                >
                  ⌘K
                </kbd>
              )}
            </div>

            <div className="flex-1" />

            {/* Settings */}
            <div className="flex items-center gap-2.5">
              <div className="w-px h-4 flex-shrink-0" style={{ backgroundColor: 'var(--border-color)', opacity: 0.3 }} />
              <ModCardSettings
                sort={modsState.sort as any}
                onSortChange={(s) => window.dispatchEvent(new CustomEvent('mods:sort-change', { detail: s }))}
                columns={modsState.columns}
                onColumnsChange={(c) => window.dispatchEvent(new CustomEvent('mods:columns-change', { detail: c }))}
                owners={modsState.owners}
                selectedOwners={modsState.selectedOwners}
                onToggleOwner={(o) => window.dispatchEvent(new CustomEvent('mods:toggle-owner', { detail: o }))}
                onClearFilters={() => window.dispatchEvent(new Event('mods:clear-filters'))}
              />
            </div>
          </div>
        ) : showModuleBar ? (
          /* Module bar: name + meta + tabs */
          <div className="flex items-center gap-4 flex-1 min-w-0" style={{ fontFamily: 'var(--font-digital), monospace' }}>
            {/* Search icon to expand (far left) */}
            <button
              onClick={() => {
                setSearchExpanded(true)
                setTimeout(() => inputRef.current?.focus(), 50)
              }}
              className="flex-shrink-0 flex items-center justify-center"
              style={{
                width: '32px',
                height: '32px',
                color: 'var(--text-tertiary)',
                transition: 'color 0.15s ease',
              }}
              title="Search (⌘K)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
              </svg>
            </button>

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
                return (
                  <button
                    key={tab}
                    onClick={() => handleTabClick(tab)}
                    className="px-2.5 py-1 font-bold uppercase tracking-wider transition-all flex-shrink-0"
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
          /* Search bar (default or expanded on module page) */
          <div
            className="flex items-center flex-1 transition-all"
            style={{
              maxWidth: '560px',
              height: '36px',
              backgroundColor: searchFocused ? 'var(--bg-input)' : 'transparent',
              border: searchFocused ? '1px solid rgba(167, 139, 250, 0.3)' : '1px solid transparent',
              borderRadius: '8px',
              backdropFilter: searchFocused ? 'blur(12px)' : 'none',
              WebkitBackdropFilter: searchFocused ? 'blur(12px)' : 'none',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {/* Back button when search expanded on module page */}
            {activeModule && searchExpanded && (
              <button
                onClick={() => {
                  setSearchExpanded(false)
                  setInputValue('')
                  handleSearch('')
                }}
                className="flex items-center justify-center flex-shrink-0 pl-2"
                style={{ color: 'var(--text-tertiary)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6"/>
                </svg>
              </button>
            )}

            {/* Search icon */}
            <div
              className="flex items-center justify-center flex-shrink-0 pl-2.5 pr-1 cursor-pointer select-none"
              onClick={() => inputRef.current?.focus()}
              style={{ height: '100%' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={searchFocused ? 'var(--accent-primary)' : 'var(--text-tertiary)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.15s ease' }}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
              </svg>
            </div>

            {/* Input */}
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder={activeCommand === '/run' ? 'mod/fn key=value ...' : 'modules, functions, cid...'}
              className="flex-1 bg-transparent focus:outline-none min-w-0"
              style={{
                height: '100%',
                fontSize: '14px',
                fontFamily: 'var(--font-digital), monospace',
                color: 'var(--text-primary)',
                caretColor: 'var(--accent-primary)',
                padding: '0 8px 0 0',
              }}
            />

            {/* Mode indicator */}
            {activeCommand !== '/search' && (
              <span
                className="flex-shrink-0 mr-2 px-1.5 py-0.5"
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-digital), monospace',
                  backgroundColor: 'var(--accent-primary)15',
                  border: '1px solid var(--accent-primary)',
                  borderRadius: '3px',
                  color: 'var(--accent-primary)',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                }}
              >
                {activeCommand}
              </span>
            )}

            {/* CID hint */}
            {inputValue && isCid(inputValue.trim()) && (
              <span
                className="flex-shrink-0 mr-2 px-1.5 py-0.5"
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-digital), monospace',
                  backgroundColor: 'var(--accent-primary)15',
                  border: '1px solid var(--accent-primary)',
                  borderRadius: '3px',
                  color: 'var(--accent-primary)',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                }}
              >
                CID ↵
              </span>
            )}

            {/* ⌘K hint */}
            {!searchFocused && !inputValue && (
              <kbd
                className="flex-shrink-0 mr-2 px-1.5 py-0.5"
                style={{
                  fontSize: '12px',
                  fontFamily: 'var(--font-digital), monospace',
                  backgroundColor: 'var(--hover-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '3px',
                  color: 'var(--text-tertiary)',
                  lineHeight: 1.2,
                }}
              >
                ⌘K
              </kbd>
            )}
          </div>
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
        {/* + CREATE MOD button on mods page */}
        {showModsToolbar && (
          <Link
            href="/create"
            className="shrink-0 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all flex items-center rounded-full"
            style={{
              background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.15), rgba(103, 232, 249, 0.08))',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-digital)',
              border: '1px solid rgba(167, 139, 250, 0.2)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.4)'; e.currentTarget.style.background = 'linear-gradient(135deg, rgba(167, 139, 250, 0.25), rgba(103, 232, 249, 0.12))' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.2)'; e.currentTarget.style.background = 'linear-gradient(135deg, rgba(167, 139, 250, 0.15), rgba(103, 232, 249, 0.08))' }}
          >
            + CREATE
          </Link>
        )}
        {/* Build module button */}
        {user && (
          <button
            onClick={() => { setShowBuild(!showBuild); setShowFork(false) }}
            className="flex items-center justify-center flex-shrink-0 mr-1"
            style={{
              width: '28px',
              height: '28px',
              background: showBuild ? 'var(--text-primary)' : 'transparent',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              cursor: 'pointer',
              color: showBuild ? 'var(--bg-primary)' : 'var(--text-tertiary)',
              transition: 'all 0.15s ease',
            }}
            title="Build new module"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
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
                  return filtered.map((t: any) => {
                    const isSelected = buildBase === t.name
                    const tColor = text2color(t.name)
                    const fnCount = t.schema ? Object.keys(t.schema).length : 0
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

      {/* Run result dropdown */}
      {activeCommand === '/run' && (runResult !== null || runError || runLoading) && (
        <div
          className="fixed left-3 z-[80]"
          style={{
            top: '52px',
            maxWidth: '560px',
            width: '100%',
          }}
        >
          <div
            style={{
              background: 'var(--bg-secondary)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              maxHeight: '400px',
              overflow: 'auto',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.2)',
            }}
          >
            {runLoading && (
              <div className="p-4" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-digital), monospace', fontSize: '14px' }}>
                running...
              </div>
            )}
            {runError && (
              <div className="p-4" style={{ color: '#ff4444', fontFamily: 'var(--font-digital), monospace', fontSize: '14px' }}>
                {runError}
              </div>
            )}
            {runResult !== null && !runLoading && (
              <pre
                className="p-4 whitespace-pre-wrap break-all"
                style={{
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-digital), monospace',
                  fontSize: '13px',
                  margin: 0,
                }}
              >
                {typeof runResult === 'string' ? runResult : JSON.stringify(runResult, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
