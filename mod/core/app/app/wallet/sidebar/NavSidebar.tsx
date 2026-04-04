"use client"

import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Palette, Globe, Server, ChevronLeft, ChevronRight } from 'lucide-react'
import { getAllNavItems, getNavHref } from '@/config/navigation'
import { useModuleApps } from '@/hooks/useModuleApps'
import { ThemeSelectorCompact } from '@/themes/ThemeSelectorCompact'
import {
  Blocks, Landmark, FileCode2, ArrowLeftRight,
  BookOpen, MessageSquare, Waypoints, Shield
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { NetworkSelector } from '@/network/NetworkSelector'
import { useLayoutContext } from '@/context/LayoutContext'
import modConfig from '@config'

const NAV_ICONS: Record<string, React.ReactNode> = {
  'MODS': <Blocks size={22} strokeWidth={1.5} />,
  'TREASURY': <Landmark size={22} strokeWidth={1.5} />,
  'CONTRACTS': <FileCode2 size={22} strokeWidth={1.5} />,
  'TRANSACTIONS': <ArrowLeftRight size={22} strokeWidth={1.5} />,
  'DOCS': <BookOpen size={22} strokeWidth={1.5} />,
  'CHAT': <MessageSquare size={22} strokeWidth={1.5} />,
  'BRIDGE': <Waypoints size={22} strokeWidth={1.5} />,
  'WORKERS': <Shield size={22} strokeWidth={1.5} />,
}

export const SIDEBAR_WIDTH = 64
const COLLAPSED_WIDTH = 16

const PIXEL_FONT = "var(--font-pixel), 'Press Start 2P', monospace"

export function NavSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const moduleApps = useModuleApps()
  const navItems = getAllNavItems(moduleApps)
  const { isHeaderCollapsed } = useLayoutContext()
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [tooltipInfo, setTooltipInfo] = useState<{ label: string; y: number; color: string } | null>(null)
  const [mounted, setMounted] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const themeBtnRef = useRef<HTMLButtonElement>(null)
  const [themeBtnRect, setThemeBtnRect] = useState<DOMRect | null>(null)
  const [networkOpen, setNetworkOpen] = useState(false)
  const networkBtnRef = useRef<HTMLButtonElement>(null)
  const [networkBtnRect, setNetworkBtnRect] = useState<DOMRect | null>(null)
  const [apiOpen, setApiOpen] = useState(false)
  const apiBtnRef = useRef<HTMLButtonElement>(null)
  const [apiBtnRect, setApiBtnRect] = useState<DOMRect | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }

  const getShortLabel = (label: string) => {
    const map: Record<string, string> = { 'TRANSACTIONS': 'TXS' }
    return map[label] || label
  }

  const getIcon = (label: string) => {
    return NAV_ICONS[label] || <span style={{ fontSize: '10px', fontFamily: PIXEL_FONT }}>{label.slice(0, 3)}</span>
  }

  const getShortestLabel = (label: string) => {
    const map: Record<string, string> = { 'TRANSACTIONS': 'TXS', 'CONTRACTS': 'CNTR', 'TREASURY': 'TRSY' }
    return map[label] || label
  }

  const currentWidth = collapsed ? COLLAPSED_WIDTH : SIDEBAR_WIDTH

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', `${currentWidth}px`)
  }, [currentWidth])

  const handleHover = (href: string, label: string, color: string, e: React.MouseEvent) => {
    setHoveredItem(href)
    const r = e.currentTarget.getBoundingClientRect()
    setTooltipInfo({ label: getShortLabel(label).toLowerCase(), y: r.top + r.height / 2, color })
  }

  const clearHover = () => {
    setHoveredItem(null)
    setTooltipInfo(null)
  }

  // Hide sidebar when header is collapsed (module page full-screen mode)
  if (isHeaderCollapsed) {
    return null
  }

  return (
    <>
      <div
        className="fixed left-0 z-[60] flex flex-col transition-all duration-200"
        style={{
          top: '60px',
          bottom: 0,
          width: `${currentWidth}px`,
          background: 'var(--bg-header)',
          borderRight: '1px solid var(--border-default)',
          fontFamily: PIXEL_FONT,
          overflow: 'hidden',
        }}
      >
        {/* Collapsed state: just a thin expand button */}
        {collapsed && (
          <button
            onClick={toggleCollapsed}
            className="w-full h-full flex items-center justify-center transition-all duration-150"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-primary)'; e.currentTarget.style.background = 'var(--hover-bg)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent' }}
            title="Expand sidebar"
          >
            <ChevronRight size={14} />
          </button>
        )}

        {/* Expanded content */}
        {!collapsed && <>
        {/* Collapse toggle */}
        <div className="shrink-0 flex justify-center" style={{ borderBottom: '1px solid var(--border-default)' }}>
          <button
            onClick={toggleCollapsed}
            className="w-full flex items-center justify-center transition-all duration-200"
            style={{ height: '24px', color: 'var(--text-tertiary)', opacity: 0.5 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-primary)'; e.currentTarget.style.opacity = '1' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.opacity = '0.5' }}
            title="Collapse sidebar"
          >
            <ChevronLeft size={14} />
          </button>
        </div>

        {/* Nav items */}
        <div className="flex-1 overflow-y-auto hide-scrollbar py-2 px-1.5 flex flex-col gap-1" style={{ scrollbarWidth: 'none' }}>
          {navItems.map(item => {
            const isActive = pathname?.startsWith(item.href)
            const isHovered = hoveredItem === item.href
            const finalHref = getNavHref(item)
            const color = item.color || 'var(--accent-primary)'

            return (
              <Link
                key={item.href}
                href={finalHref}
                className="group relative flex flex-col items-center justify-center transition-all duration-200 rounded-lg"
                style={{
                  height: '52px',
                  padding: '4px 0',
                  fontFamily: PIXEL_FONT,
                  color: isActive ? color : isHovered ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: isActive
                    ? `${color}15`
                    : isHovered ? 'var(--hover-bg)' : 'transparent',
                }}
                onMouseEnter={(e) => handleHover(item.href, item.label, color, e)}
                onMouseLeave={clearHover}
              >
                {/* Active indicator dot */}
                {isActive && (
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                    style={{
                      width: '3px',
                      height: '20px',
                      background: color,
                      boxShadow: `0 0 8px ${color}`,
                    }}
                  />
                )}

                <span
                  className="relative transition-all duration-200"
                  style={{
                    filter: isActive ? `drop-shadow(0 0 4px ${color})` : 'none',
                    transform: isHovered && !isActive ? 'scale(1.1)' : 'scale(1)',
                  }}
                >
                  {getIcon(item.label)}
                </span>
                <span
                  className="transition-all duration-200"
                  style={{
                    fontSize: '7px',
                    marginTop: '3px',
                    letterSpacing: '0.05em',
                    opacity: isActive ? 1 : isHovered ? 0.8 : 0.45,
                    color: isActive ? color : 'var(--text-secondary)',
                  }}
                >
                  {getShortestLabel(item.label)}
                </span>
              </Link>
            )
          })}
        </div>

        {/* Bottom actions */}
        <div className="shrink-0 flex flex-col gap-1 px-1.5 py-2" style={{ borderTop: '1px solid var(--border-default)' }}>
          {/* New + button */}
          <button
            onClick={() => router.push('/create')}
            className="group relative w-full flex flex-col items-center justify-center transition-all duration-200 rounded-lg"
            style={{
              height: '48px',
              color: 'var(--accent-primary)',
              fontFamily: PIXEL_FONT,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--hover-bg)'
              handleHover('__new', 'NEW', 'var(--accent-primary)', e)
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              clearHover()
            }}
          >
            <Plus size={20} className="transition-all duration-200" style={{
              filter: hoveredItem === '__new' ? 'drop-shadow(0 0 4px var(--accent-primary))' : 'none',
            }} />
            <span style={{ fontSize: '7px', marginTop: '3px', opacity: 0.6 }}>NEW</span>
          </button>

          {/* Network selector icon */}
          <button
            ref={networkBtnRef}
            onClick={() => {
              if (networkBtnRef.current) {
                setNetworkBtnRect(networkBtnRef.current.getBoundingClientRect())
              }
              setNetworkOpen(!networkOpen)
            }}
            className="w-full flex flex-col items-center justify-center transition-all duration-200 rounded-lg"
            style={{
              height: '48px',
              color: networkOpen ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontFamily: PIXEL_FONT,
            }}
            title="Network"
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)'
              e.currentTarget.style.background = 'var(--hover-bg)'
              handleHover('__network', 'NETWORK', 'var(--accent-primary)', e)
            }}
            onMouseLeave={(e) => {
              if (!networkOpen) e.currentTarget.style.color = 'var(--text-secondary)'
              e.currentTarget.style.background = 'transparent'
              clearHover()
            }}
          >
            <Globe size={20} className="transition-all duration-200" style={{
              filter: hoveredItem === '__network' || networkOpen ? 'drop-shadow(0 0 4px var(--accent-primary))' : 'none',
            }} />
            <span style={{ fontSize: '7px', marginTop: '3px', opacity: 0.5 }}>NET</span>
          </button>

          {/* API host selector icon */}
          <button
            ref={apiBtnRef}
            onClick={() => {
              if (apiBtnRef.current) {
                setApiBtnRect(apiBtnRef.current.getBoundingClientRect())
              }
              setApiOpen(!apiOpen)
            }}
            className="w-full flex flex-col items-center justify-center transition-all duration-200 rounded-lg"
            style={{
              height: '48px',
              color: apiOpen ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontFamily: PIXEL_FONT,
            }}
            title="API Host"
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)'
              e.currentTarget.style.background = 'var(--hover-bg)'
              handleHover('__api', 'API', 'var(--accent-primary)', e)
            }}
            onMouseLeave={(e) => {
              if (!apiOpen) e.currentTarget.style.color = 'var(--text-secondary)'
              e.currentTarget.style.background = 'transparent'
              clearHover()
            }}
          >
            <Server size={20} className="transition-all duration-200" style={{
              filter: hoveredItem === '__api' || apiOpen ? 'drop-shadow(0 0 4px var(--accent-primary))' : 'none',
            }} />
            <span style={{ fontSize: '7px', marginTop: '3px', opacity: 0.5 }}>API</span>
          </button>

          {/* Theme selector icon */}
          <button
            ref={themeBtnRef}
            onClick={() => {
              if (themeBtnRef.current) {
                setThemeBtnRect(themeBtnRef.current.getBoundingClientRect())
              }
              setThemeOpen(!themeOpen)
            }}
            className="w-full flex flex-col items-center justify-center transition-all duration-200 rounded-lg"
            style={{
              height: '48px',
              color: themeOpen ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontFamily: PIXEL_FONT,
            }}
            title="Theme"
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)'
              e.currentTarget.style.background = 'var(--hover-bg)'
              handleHover('__theme', 'THEME', 'var(--accent-primary)', e)
            }}
            onMouseLeave={(e) => {
              if (!themeOpen) e.currentTarget.style.color = 'var(--text-secondary)'
              e.currentTarget.style.background = 'transparent'
              clearHover()
            }}
          >
            <Palette size={20} className="transition-all duration-200" style={{
              filter: hoveredItem === '__theme' || themeOpen ? 'drop-shadow(0 0 4px var(--accent-primary))' : 'none',
            }} />
            <span style={{ fontSize: '7px', marginTop: '3px', opacity: 0.5 }}>THEME</span>
          </button>
        </div>
        </>}
      </div>

      {/* Network selector portal */}
      {mounted && networkOpen && networkBtnRect && createPortal(
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setNetworkOpen(false)}
          />
          <div
            style={{
              position: 'fixed',
              left: `${currentWidth}px`,
              bottom: `${window.innerHeight - networkBtnRect.bottom}px`,
              zIndex: 9999,
            }}
          >
            <NetworkSelector onClose={() => setNetworkOpen(false)} sidebar />
          </div>
        </>,
        document.body
      )}

      {/* API host selector portal */}
      {mounted && apiOpen && apiBtnRect && createPortal(
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setApiOpen(false)}
          />
          <div
            style={{
              position: 'fixed',
              left: `${currentWidth}px`,
              bottom: `${window.innerHeight - apiBtnRect.bottom}px`,
              zIndex: 9999,
              width: '320px',
            }}
          >
            <ApiHostSelector onClose={() => setApiOpen(false)} />
          </div>
        </>,
        document.body
      )}

      {/* Theme dropdown portal */}
      {mounted && themeOpen && themeBtnRect && createPortal(
        <>
          {/* Backdrop to close */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setThemeOpen(false)}
          />
          <div
            style={{
              position: 'fixed',
              left: `${currentWidth}px`,
              bottom: `${window.innerHeight - themeBtnRect.bottom}px`,
              zIndex: 9999,
              width: '240px',
            }}
          >
            <ThemeSelectorCompact expandUpwards={false} onClose={() => setThemeOpen(false)} alwaysOpen />
          </div>
        </>,
        document.body
      )}

      {/* Tooltip portal - rendered outside sidebar to avoid overflow clipping */}
      {mounted && tooltipInfo && createPortal(
        <div
          className="pointer-events-none"
          style={{
            position: 'fixed',
            left: `${SIDEBAR_WIDTH + 4}px`,
            top: `${tooltipInfo.y}px`,
            transform: 'translateY(-50%)',
            zIndex: 9999,
          }}
        >
          <div
            className="flex items-center px-3 py-1"
            style={{
              background: 'var(--bg-header)',
              border: `1px solid ${tooltipInfo.color}40`,
              borderRadius: '6px',
              whiteSpace: 'nowrap',
              boxShadow: `0 4px 16px rgba(0,0,0,0.3), 0 0 8px ${tooltipInfo.color}15`,
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontFamily: PIXEL_FONT,
                color: tooltipInfo.color,
                letterSpacing: '0.06em',
                textShadow: `0 0 6px ${tooltipInfo.color}80`,
              }}
            >
              {tooltipInfo.label}
            </span>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL || modConfig.url.api || 'http://localhost:8000'

function ApiHostSelector({ onClose }: { onClose: () => void }) {
  const [hosts, setHosts] = useState<{ url: string; status: 'active' | 'inactive' | 'checking' }[]>([])
  const [currentHost, setCurrentHost] = useState('')
  const [newUrl, setNewUrl] = useState('')

  useEffect(() => {
    const current = localStorage.getItem('custom_node_url') || DEFAULT_API_URL
    setCurrentHost(current)
    const saved = localStorage.getItem('custom_hosts')
    const urls: string[] = saved ? JSON.parse(saved) : [DEFAULT_API_URL]
    if (!urls.includes(DEFAULT_API_URL)) urls.unshift(DEFAULT_API_URL)
    setHosts(urls.map(url => ({ url, status: 'checking' })))
    urls.forEach((url, i) => {
      fetch(`${url}/info`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then(r => r.ok ? 'active' as const : 'inactive' as const)
        .catch(() => 'inactive' as const)
        .then(status => setHosts(prev => prev.map((h, j) => j === i ? { ...h, status } : h)))
    })
  }, [])

  const selectHost = (url: string) => {
    localStorage.setItem('custom_node_url', url)
    window.location.reload()
  }

  const addHost = () => {
    if (!newUrl.trim()) return
    const url = newUrl.trim()
    const updated = [...hosts, { url, status: 'checking' as const }]
    setHosts(updated)
    localStorage.setItem('custom_hosts', JSON.stringify(updated.map(h => h.url)))
    setNewUrl('')
    fetch(`${url}/info`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(r => r.ok ? 'active' as const : 'inactive' as const)
      .catch(() => 'inactive' as const)
      .then(status => setHosts(prev => prev.map(h => h.url === url ? { ...h, status } : h)))
  }

  const removeHost = (url: string) => {
    const updated = hosts.filter(h => h.url !== url)
    setHosts(updated)
    localStorage.setItem('custom_hosts', JSON.stringify(updated.map(h => h.url)))
    if (currentHost === url) selectHost(DEFAULT_API_URL)
  }

  return (
    <div
      className="flex flex-col gap-1 p-3"
      style={{
        background: 'var(--bg-header)',
        border: '1px solid var(--border-default)',
        borderRadius: '8px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        fontFamily: PIXEL_FONT,
        maxHeight: '360px',
        overflowY: 'auto',
      }}
    >
      <div className="text-[9px] font-bold uppercase tracking-wider mb-1 px-1" style={{ color: 'var(--text-tertiary)' }}>
        API HOST
      </div>
      {hosts.map(host => {
        const isCurrent = host.url === currentHost
        return (
          <div
            key={host.url}
            className="flex items-center gap-2 px-2 py-2 rounded transition-all cursor-pointer"
            style={{
              background: isCurrent ? 'var(--accent-primary)15' : 'transparent',
              border: isCurrent ? '1px solid var(--accent-primary)' : '1px solid transparent',
            }}
            onClick={() => !isCurrent && selectHost(host.url)}
          >
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                background: host.status === 'active' ? '#10b981' : host.status === 'inactive' ? '#ef4444' : '#f59e0b',
                boxShadow: host.status === 'active' ? '0 0 6px #10b981' : 'none',
              }}
            />
            <span
              className="flex-1 text-[9px] truncate"
              style={{ color: isCurrent ? 'var(--accent-primary)' : 'var(--text-primary)' }}
            >
              {host.url.replace(/^https?:\/\//, '')}
            </span>
            {isCurrent && (
              <span className="text-[7px] uppercase tracking-wider shrink-0" style={{ color: 'var(--accent-primary)' }}>active</span>
            )}
            {!isCurrent && host.url !== DEFAULT_API_URL && (
              <button
                onClick={(e) => { e.stopPropagation(); removeHost(host.url) }}
                className="text-[9px] shrink-0 px-1 rounded transition-all"
                style={{ color: '#ef4444' }}
              >
                ×
              </button>
            )}
          </div>
        )
      })}
      <div className="flex gap-1 mt-1">
        <input
          type="text"
          value={newUrl}
          onChange={e => setNewUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addHost()}
          placeholder="http://host:port"
          className="flex-1 px-2 py-1 text-[9px] rounded"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            outline: 'none',
            fontFamily: PIXEL_FONT,
          }}
        />
        <button
          onClick={addHost}
          className="px-2 py-1 text-[9px] rounded font-bold"
          style={{
            background: 'var(--accent-primary)20',
            color: 'var(--accent-primary)',
            border: '1px solid var(--accent-primary)',
          }}
        >
          +
        </button>
      </div>
    </div>
  )
}
