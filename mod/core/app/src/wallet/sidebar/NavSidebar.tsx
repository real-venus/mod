"use client"

import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Palette } from 'lucide-react'
import { getAllNavItems, getNavHref } from '@/config/navigation'
import { ThemeSelectorCompact } from '@/themes/ThemeSelectorCompact'
import {
  Swords, Landmark, FileCode2, ArrowLeftRight,
  BookOpen, MessageSquare, Shield, Waypoints
} from 'lucide-react'
import { createPortal } from 'react-dom'

const NAV_ICONS: Record<string, React.ReactNode> = {
  'QUESTS': <Swords size={36} strokeWidth={1.8} />,
  'TREASURY': <Landmark size={36} strokeWidth={1.8} />,
  'CONTRACTS': <FileCode2 size={36} strokeWidth={1.8} />,
  'TRANSACTIONS': <ArrowLeftRight size={36} strokeWidth={1.8} />,
  'DOCS': <BookOpen size={36} strokeWidth={1.8} />,
  'CHAT': <MessageSquare size={36} strokeWidth={1.8} />,
  'SAFE': <Shield size={36} strokeWidth={1.8} />,
  'BRIDGE': <Waypoints size={36} strokeWidth={1.8} />,
}

export const SIDEBAR_WIDTH = 56

const PIXEL_FONT = "var(--font-pixel), 'Press Start 2P', monospace"

export function NavSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const navItems = getAllNavItems()
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [tooltipInfo, setTooltipInfo] = useState<{ label: string; y: number; color: string } | null>(null)
  const [mounted, setMounted] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const themeBtnRef = useRef<HTMLButtonElement>(null)
  const [themeBtnRect, setThemeBtnRect] = useState<DOMRect | null>(null)

  useEffect(() => { setMounted(true) }, [])

  const getShortLabel = (label: string) => {
    const map: Record<string, string> = { 'TRANSACTIONS': 'TXS' }
    return map[label] || label
  }

  const getIcon = (label: string) => {
    return NAV_ICONS[label] || <span style={{ fontSize: '16px', fontFamily: PIXEL_FONT }}>{label.slice(0, 3)}</span>
  }

  const currentWidth = SIDEBAR_WIDTH

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

  return (
    <>
      <div
        className="fixed left-0 z-[60] flex flex-col transition-all duration-200"
        style={{
          top: '60px',
          bottom: 0,
          width: `${currentWidth}px`,
          background: 'var(--bg-header)',
          borderRight: '2px solid var(--border-strong)',
          fontFamily: PIXEL_FONT,
        }}
      >
        {/* Nav items */}
        <div className="flex-1 overflow-y-auto hide-scrollbar py-1" style={{ scrollbarWidth: 'none' }}>
          {navItems.map(item => {
            const isActive = pathname?.startsWith(item.href)
            const isHovered = hoveredItem === item.href
            const finalHref = getNavHref(item)
            const color = item.color || 'var(--accent-primary)'

            return (
              <Link
                key={item.href}
                href={finalHref}
                className="group relative flex items-center transition-all duration-150"
                style={{
                  height: '42px',
                  padding: '0',
                  justifyContent: 'center',
                  fontFamily: PIXEL_FONT,
                  color: isActive ? color : isHovered ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: isActive
                    ? `linear-gradient(90deg, ${color}18 0%, transparent 100%)`
                    : 'transparent',
                  borderLeft: isActive ? `3px solid ${color}` : '3px solid transparent',
                }}
                onMouseEnter={(e) => handleHover(item.href, item.label, color, e)}
                onMouseLeave={clearHover}
              >
                {/* Hover background */}
                {!isActive && (
                  <div
                    className="absolute inset-0 transition-opacity duration-150"
                    style={{
                      opacity: isHovered ? 1 : 0,
                      background: 'var(--hover-bg)',
                    }}
                  />
                )}

                <span
                  className="relative transition-all duration-150"
                  style={{
                    filter: isActive ? `drop-shadow(0 0 6px ${color})` : isHovered ? `drop-shadow(0 0 3px var(--text-primary))` : 'none',
                  }}
                >
                  {getIcon(item.label)}
                </span>
              </Link>
            )
          })}
        </div>

        {/* New + button */}
        <div className="shrink-0" style={{ borderTop: '2px solid var(--border-strong)' }}>
          <button
            onClick={() => router.push('/create')}
            className="group relative w-full flex items-center transition-all duration-150"
            style={{
              height: '42px',
              color: 'var(--accent-primary)',
              justifyContent: 'center',
              padding: '0',
              fontFamily: PIXEL_FONT,
              fontSize: '18px',
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
            <Plus size={36} className="transition-all duration-150" style={{
              filter: hoveredItem === '__new' ? 'drop-shadow(0 0 4px var(--accent-primary))' : 'none',
            }} />
          </button>
        </div>

        {/* Theme selector icon */}
        <div className="shrink-0" style={{ borderTop: '2px solid var(--border-strong)' }}>
          <button
            ref={themeBtnRef}
            onClick={() => {
              if (themeBtnRef.current) {
                setThemeBtnRect(themeBtnRef.current.getBoundingClientRect())
              }
              setThemeOpen(!themeOpen)
            }}
            className="w-full flex items-center justify-center transition-all duration-150"
            style={{
              height: '42px',
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
            <Palette size={36} className="transition-all duration-150" style={{
              filter: hoveredItem === '__theme' || themeOpen ? 'drop-shadow(0 0 4px var(--accent-primary))' : 'none',
            }} />
          </button>
        </div>
      </div>

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
              left: `${SIDEBAR_WIDTH}px`,
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
            left: `${SIDEBAR_WIDTH}px`,
            top: `${tooltipInfo.y}px`,
            transform: 'translateY(-50%)',
            zIndex: 9999,
          }}
        >
          <div
            className="flex items-center gap-2 px-3 py-1.5"
            style={{
              background: 'var(--bg-header)',
              border: `2px solid ${tooltipInfo.color}`,
              borderLeft: 'none',
              whiteSpace: 'nowrap',
              boxShadow: '4px 2px 12px rgba(0,0,0,0.4)',
            }}
          >
            <span
              style={{
                fontSize: '18px',
                fontFamily: PIXEL_FONT,
                color: tooltipInfo.color,
                letterSpacing: '0.08em',
                textShadow: `0 0 8px ${tooltipInfo.color}`,
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
