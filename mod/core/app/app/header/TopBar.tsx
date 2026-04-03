"use client"

import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { WalletHeader } from '@/wallet/WalletHeader'
import { useSearchContext } from '@/context/SearchContext'
import { userContext } from '@/context'
import { useLayoutContext } from '@/context/LayoutContext'
import Link from 'next/link'
import { text2color, colorWithOpacity, shorten } from '@/utils'

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

// Extract module name from path like /bread or /mod/bread/key
function getModuleFromPath(pathname: string): string | null {
  // /mod/[name]/[key]
  const modMatch = pathname.match(/^\/mod\/([^/]+)/)
  if (modMatch) return modMatch[1]
  // /[name] (single segment, not a known route)
  const knownRoutes = ['mod', 'user', 'cid', 'chat', 'docs', 'quests', 'create', 'safe', 'bridge', 'contracts', 'treasury', 'jobs', 'traders', 'network', 'home', 'transactions', 'buidl']
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

  // Create dropdown state
  const [showCreate, setShowCreate] = useState(false)
  const [createMode, setCreateMode] = useState<'local' | 'github' | 'cid'>('local')
  const [createName, setCreateName] = useState('')
  const [createUrl, setCreateUrl] = useState('')
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createResult, setCreateResult] = useState<any>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const createRef = useRef<HTMLDivElement>(null)

  // Fork dropdown state
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
  const [moduleTab, setModuleTab] = useState<string>('content')

  // Listen for module tab changes from ModulePage
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setModuleTab(e.detail.tab)
    }
    window.addEventListener('mod:tab-change' as any, handler)
    return () => window.removeEventListener('mod:tab-change' as any, handler)
  }, [])

  // Listen for module info (fnCount, key, cid) from ModulePage
  const [moduleInfo, setModuleInfo] = useState<{ fnCount: number; key: string; cid: string; url_app?: string } | null>(null)
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setModuleInfo(e.detail)
    }
    window.addEventListener('mod:info' as any, handler)
    return () => window.removeEventListener('mod:info' as any, handler)
  }, [])

  // Reset when leaving module page
  useEffect(() => {
    if (!activeModule) {
      setModuleInfo(null)
      setSearchExpanded(false)
    }
  }, [activeModule])

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

  // Click-outside for create/fork dropdowns
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (showCreate && createRef.current && !createRef.current.contains(e.target as Node)) {
        setShowCreate(false)
      }
      if (showFork && forkRef.current && !forkRef.current.contains(e.target as Node)) {
        setShowFork(false)
      }
    }
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCreate(false)
        setShowFork(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', escHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', escHandler)
    }
  }, [showCreate, showFork])

  // Reset fork name when module changes
  useEffect(() => {
    if (activeModule) setForkName(activeModule)
  }, [activeModule])

  const handleCreateSubmit = async () => {
    if (!client?.token || !user?.key || !createName.trim()) return
    setCreateSubmitting(true)
    setCreateError(null)
    setCreateResult(null)
    try {
      const modValue = createMode === 'local' ? createName.trim() : createUrl.trim()
      if (!modValue) throw new Error('Module source required')
      const response = await client.call('api/reg', {
        mod: modValue,
        name: createName.trim(),
        key: user.key,
        public: false,
        token: client.token,
      })
      setCreateResult(response)
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create module')
    } finally {
      setCreateSubmitting(false)
    }
  }

  const handleForkSubmit = async () => {
    if (!client?.token || !user?.key || !activeModule) return
    setForkSubmitting(true)
    setForkError(null)
    setForkResult(null)
    try {
      const response = await client.call('api/fork', {
        mod: activeModule,
        key: user.key,
      })
      setForkResult(response)
      const forkModName = response?.name || activeModule
      setTimeout(() => {
        setShowFork(false)
        router.push(`/${forkModName}`)
      }, 1000)
    } catch (err: any) {
      setForkError(err?.message || 'Failed to fork module')
    } finally {
      setForkSubmitting(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    if (activeCommand !== '/run') {
      handleSearch(value)
      if (pathname !== '/mods') {
        router.push('/mods')
      }
    }
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
    'task', 'content', 'api', 'config', 'terminal',
    ...(moduleInfo?.url_app ? ['app'] : []),
    'versions', 'manage', 'edit',
  ]

  // On a module page: show module info + tabs, search collapses to icon
  const showModuleBar = activeModule && !searchExpanded

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

            {/* Owner key */}
            {moduleInfo?.key && (
              <Link
                href={`/user/${moduleInfo.key}`}
                className="flex-shrink-0 hover:underline"
                style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}
              >
                {shorten(moduleInfo.key, 4, 4)}
              </Link>
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
                onClick={() => { setShowFork(!showFork); setShowCreate(false) }}
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

            {/* Search icon to expand */}
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
          </div>
        ) : (
          /* Search bar (default or expanded on module page) */
          <div
            className="flex items-center flex-1 transition-all"
            style={{
              maxWidth: '560px',
              height: '36px',
              backgroundColor: searchFocused ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
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
      <div className="flex items-center pr-3 gap-1">
        {/* Create module button */}
        {user && (
          <button
            onClick={() => { setShowCreate(!showCreate); setShowFork(false) }}
            className="flex items-center justify-center flex-shrink-0 mr-1"
            style={{
              width: '28px',
              height: '28px',
              background: showCreate ? 'var(--text-primary)' : 'transparent',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              cursor: 'pointer',
              color: showCreate ? 'var(--bg-primary)' : 'var(--text-tertiary)',
              transition: 'all 0.15s ease',
              fontFamily: 'var(--font-digital), monospace',
              fontSize: '18px',
              fontWeight: 'bold',
              lineHeight: 1,
            }}
            title="Create module"
          >
            +
          </button>
        )}
        <WalletHeader />
      </div>

      {/* Create module dropdown */}
      {showCreate && (
        <div
          ref={createRef}
          className="fixed z-[80]"
          style={{
            top: '52px',
            right: '12px',
            width: '380px',
          }}
        >
          <div
            style={{
              background: 'rgba(15, 20, 40, 0.95)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
              fontFamily: 'var(--font-digital), monospace',
            }}
          >
            <div className="p-4 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                NEW MODULE
              </div>

              {/* Mode tabs */}
              <div className="flex gap-0">
                {(['local', 'github', 'cid'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setCreateMode(m); setCreateUrl(''); setCreateResult(null); setCreateError(null) }}
                    className="flex-1 py-1.5 text-xs font-bold uppercase tracking-wider transition-all"
                    style={{
                      background: createMode === m ? 'var(--text-primary)' : 'transparent',
                      color: createMode === m ? 'var(--bg-primary)' : 'var(--text-tertiary)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {/* Name input */}
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="MODULE NAME"
                className="w-full px-3 py-2.5 text-sm font-bold focus:outline-none uppercase"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: createName.trim() ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-digital), monospace',
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' && createName.trim()) handleCreateSubmit() }}
                autoFocus
              />

              {/* URL/CID input for non-local modes */}
              {createMode !== 'local' && (
                <input
                  type="text"
                  value={createUrl}
                  onChange={(e) => setCreateUrl(e.target.value)}
                  placeholder={createMode === 'github' ? 'GITHUB URL OR USER/REPO' : 'Qm... OR bafy...'}
                  className="w-full px-3 py-2.5 text-sm font-bold focus:outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: createUrl.trim() ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-digital), monospace',
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateSubmit() }}
                />
              )}

              {/* Submit */}
              <button
                onClick={handleCreateSubmit}
                disabled={createSubmitting || !createName.trim() || (createMode !== 'local' && !createUrl.trim())}
                className="w-full py-2.5 text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-30"
                style={{
                  background: 'rgba(34,197,94,0.15)',
                  border: '1px solid rgba(34,197,94,0.4)',
                  borderRadius: '4px',
                  color: 'rgb(34,197,94)',
                  fontFamily: 'var(--font-digital), monospace',
                }}
              >
                {createSubmitting ? 'CREATING...' : 'CREATE'}
              </button>

              {/* Result */}
              {createResult && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-green-500 uppercase">MODULE CREATED</div>
                  <button
                    onClick={() => {
                      router.push(`/${createResult.name || createName}`)
                      setShowCreate(false)
                      setCreateName('')
                      setCreateUrl('')
                      setCreateResult(null)
                    }}
                    className="w-full py-2 text-sm font-bold uppercase tracking-wider transition-all hover:bg-green-500/20"
                    style={{
                      border: '1px solid rgba(34,197,94,0.4)',
                      borderRadius: '4px',
                      color: 'rgb(34,197,94)',
                      fontFamily: 'var(--font-digital), monospace',
                    }}
                  >
                    VIEW {createResult.name || createName} &rarr;
                  </button>
                </div>
              )}

              {/* Error */}
              {createError && (
                <div className="text-xs font-bold text-red-500 uppercase py-1">
                  {createError}
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
              background: 'rgba(15, 20, 40, 0.95)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
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
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-digital), monospace',
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleForkSubmit() }}
                autoFocus
              />

              {/* Fork button */}
              <button
                onClick={handleForkSubmit}
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
              background: 'rgba(15, 20, 40, 0.8)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              maxHeight: '400px',
              overflow: 'auto',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.3)',
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
