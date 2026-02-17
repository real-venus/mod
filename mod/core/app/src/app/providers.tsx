"use client"

import { useEffect, useState, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CubeIcon, MagnifyingGlassIcon, PlusIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { WalletHeader } from '@/wallet/WalletHeader'
import { NetworkSelector } from '@/network/NetworkSelector'
import { UserProvider } from '@/context'
import { SearchProvider, useSearchContext } from '@/context/SearchContext'
import {
  SplitScreenProvider,
  useSplitScreenContext,
} from '@/context/SplitScreenContext'
import { ControlPanelProvider } from '@/context/ControlPanelContext'
import { MarketCreditProvider } from '@/context/MarketCreditContext'
import {
  LayoutProvider,
  useLayoutContext,
} from '@/context/LayoutContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { SplitScreenControls } from '@/components/SplitScreenControls'

function GlobalSearchBar() {
  const { handleSearch, searchFilters } = useSearchContext()
  const router = useRouter()
  const pathname = usePathname()
  const inputRef = useRef<HTMLInputElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const [inputValue, setInputValue] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [compact, setCompact] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const navItems = [
    { href: '/mod/explore', label: 'MODS', color: '#10b981' },
    { href: '/quests', label: 'QUESTS', color: '#0bf58c' },
    { href: '/treasury', label: 'TREASURY', color: '#a855f7' },
    { href: '/docs', label: 'DOCS', color: '#a78bfa' },
    { href: '/chat', label: 'CHAT', color: '#8b5cf6' },
  ]

  // Responsive: watch for narrow widths
  useEffect(() => {
    const check = () => setCompact(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false) }, [pathname])

  useEffect(() => {
    setInputValue(searchFilters.searchTerm || '')
  }, [searchFilters.searchTerm])

  // Keyboard shortcut: Cmd/Ctrl+K to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    handleSearch(value)
    if (pathname !== '/mod/explore') {
      router.push('/mod/explore')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch(inputValue.trim())
      if (pathname !== '/mod/explore') {
        router.push('/mod/explore')
      }
    }
    if (e.key === 'Escape') {
      setInputValue('')
      handleSearch('')
      setSearchOpen(false)
      inputRef.current?.blur()
    }
  }

  const openSearch = () => {
    setSearchOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const closeSearch = () => {
    setSearchOpen(false)
    setInputValue('')
    handleSearch('')
  }

  return (
    <>
      <div
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-[60] flex items-center gap-0 px-4"
        style={{
          height: '48px',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.98) 80%, rgba(0,0,0,0))',
          backdropFilter: 'blur(16px)',
          fontFamily: 'IBM Plex Mono, monospace',
        }}
      >
        {/* Logo */}
        <Link href="/" className="shrink-0 mr-2 flex items-center justify-center" style={{ width: '40px', height: '48px' }}>
          <CubeIcon
            className="w-6 h-6 text-green-400"
            style={{ filter: 'drop-shadow(0 0 6px rgba(74, 222, 128, 0.5))' }}
          />
        </Link>

        {/* Search bar - left side, expandable */}
        {!compact && (
          <div className="shrink-0 flex items-center mr-1">
            {searchOpen ? (
              <motion.div
                initial={{ width: 44 }}
                animate={{ width: 260 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="flex items-center"
              >
                <div className="relative" style={{ width: '260px' }}>
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Search mods..."
                    className="w-full bg-transparent border text-white text-[14px] font-bold placeholder-neutral-600 focus:outline-none transition-all"
                    style={{
                      paddingLeft: '2.25rem',
                      paddingRight: '3.5rem',
                      height: '36px',
                      borderColor: 'rgba(74, 222, 128, 0.3)',
                      boxShadow: '0 0 12px rgba(74, 222, 128, 0.06)',
                      fontFamily: 'inherit',
                      borderRadius: '0px',
                      letterSpacing: '0.03em',
                    }}
                  />
                  <button
                    onClick={closeSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white text-[11px] font-bold px-1.5 py-0.5 border border-neutral-800 hover:border-neutral-600 transition-all"
                  >
                    ESC
                  </button>
                </div>
              </motion.div>
            ) : (
              <button
                onClick={openSearch}
                className="shrink-0 flex items-center justify-center transition-all hover:bg-white/[0.04]"
                style={{ width: '40px', height: '36px' }}
                title={`Search (${typeof navigator !== 'undefined' && navigator?.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}K)`}
              >
                <MagnifyingGlassIcon className="w-5 h-5 text-white/30 hover:text-white/60 transition-colors" />
              </button>
            )}
          </div>
        )}

        {/* Separator after search */}
        {!compact && <div className="w-px h-5 bg-white/[0.08] mx-1 shrink-0" />}

        {/* Desktop tabs */}
        {!compact ? (
          <div className="flex items-center h-full flex-1 min-w-0">
            {navItems.map(item => {
              const isActive = pathname?.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative flex items-center h-full px-4 transition-all group"
                  style={{ textDecoration: 'none' }}
                >
                  <span
                    className="text-[14px] font-extrabold uppercase tracking-[0.12em] transition-colors whitespace-nowrap"
                    style={{
                      color: isActive ? item.color : 'rgba(255,255,255,0.35)',
                    }}
                  >
                    {item.label}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-2 right-2"
                      style={{
                        height: '2px',
                        background: item.color,
                        boxShadow: `0 0 8px ${item.color}80`,
                      }}
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  {!isActive && (
                    <div
                      className="absolute bottom-0 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ height: '1px', background: 'rgba(255,255,255,0.15)' }}
                    />
                  )}
                </Link>
              )
            })}
          </div>
        ) : (
          /* Hamburger button for mobile */
          <div className="flex-1 flex items-center">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="shrink-0 flex items-center justify-center transition-all hover:bg-white/[0.04]"
              style={{ width: '40px', height: '36px' }}
            >
              {menuOpen ? (
                <XMarkIcon className="w-5 h-5 text-green-400" />
              ) : (
                <Bars3Icon className="w-5 h-5 text-white/50" />
              )}
            </button>
          </div>
        )}

        {/* + New Mod button */}
        <Link
          href="/create"
          className="shrink-0 flex items-center gap-1.5 px-3 border border-green-500/30 bg-green-500/8 hover:bg-green-500/15 transition-all mr-2"
          style={{ height: '34px', fontFamily: 'inherit' }}
        >
          <PlusIcon className="w-4 h-4 text-green-400" />
          {!compact && (
            <span className="text-[13px] font-extrabold uppercase tracking-wider text-green-400 whitespace-nowrap">
              NEW
            </span>
          )}
        </Link>

        {/* Separator */}
        <div className="w-px h-5 bg-white/[0.06] mx-1 shrink-0" />

        {/* Network + Wallet */}
        <NetworkSelector />
        <WalletHeader />
      </div>

      {/* Mobile dropdown menu */}
      {compact && menuOpen && (
        <>
          <div className="fixed inset-0 z-[58] bg-black/50" onClick={() => setMenuOpen(false)} />
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed left-0 right-0 z-[59] flex flex-col border-b border-white/[0.08]"
            style={{
              top: '48px',
              background: 'rgba(8,8,12,0.98)',
              backdropFilter: 'blur(16px)',
              fontFamily: 'IBM Plex Mono, monospace',
            }}
          >
            {/* Mobile search */}
            <div className="px-4 pt-3 pb-2">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400/60" />
                <input
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Search mods..."
                  className="w-full bg-transparent border text-white text-[14px] font-bold placeholder-neutral-600 focus:outline-none transition-all"
                  style={{
                    paddingLeft: '2.25rem',
                    paddingRight: '1rem',
                    height: '38px',
                    borderColor: 'rgba(255,255,255,0.08)',
                    fontFamily: 'inherit',
                    borderRadius: '0px',
                    letterSpacing: '0.03em',
                  }}
                />
              </div>
            </div>
            {/* Mobile nav items */}
            {navItems.map(item => {
              const isActive = pathname?.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-5 py-3 transition-all hover:bg-white/[0.03]"
                  style={{
                    borderLeft: isActive ? `3px solid ${item.color}` : '3px solid transparent',
                    background: isActive ? `${item.color}08` : undefined,
                  }}
                >
                  <span
                    className="text-[15px] font-extrabold uppercase tracking-[0.12em]"
                    style={{ color: isActive ? item.color : 'rgba(255,255,255,0.4)' }}
                  >
                    {item.label}
                  </span>
                </Link>
              )
            })}
            <div className="h-2" />
          </motion.div>
        </>
      )}
    </>
  )
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const {
    isSplitScreen,
    leftPanelUrl,
    rightPanelUrl,
    setLeftPanelUrl,
    orientation,
    isCollapsed,
  } = useSplitScreenContext()

  const { isHeaderMode } = useLayoutContext()
  const pathname = usePathname()

  useEffect(() => {
    if (isSplitScreen && leftPanelUrl === pathname) {
      setLeftPanelUrl(pathname)
    }
  }, [pathname, isSplitScreen, leftPanelUrl, setLeftPanelUrl])

  const isVertical = orientation === 'vertical'
  const containerClass = isVertical ? 'flex' : 'flex flex-col'
  const panelClass = 'flex-1'
  const borderClass = isVertical
    ? 'border-r-2 border-green-500/30'
    : 'border-b-2 border-green-500/30'

  return (
    <div className="flex h-screen bg-black" style={{ paddingTop: '48px' }}>
      {/* Global header with tabs */}
      <GlobalSearchBar />

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <main className="flex-1 overflow-auto flex">
          {isSplitScreen ? (
            <div className={`w-full h-full ${containerClass}`}>
              <div
                className={`${isCollapsed ? 'hidden' : panelClass} overflow-auto ${borderClass}`}
              >
                {children}
              </div>

              <div className={`${panelClass} overflow-auto`}>
                <iframe
                  src={rightPanelUrl}
                  className="w-full h-full border-0"
                  title="Split Screen Panel"
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">{children}</div>
          )}
        </main>

        <SplitScreenControls />
      </div>
    </div>
  )
}

export default function Providers({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ThemeProvider>
      <UserProvider>
        <MarketCreditProvider>
          <SearchProvider>
            <SplitScreenProvider>
              <ControlPanelProvider>
                <LayoutProvider>
                  <LayoutContent>{children}</LayoutContent>
                  <ToastContainer
                    position="bottom-right"
                    autoClose={3000}
                    hideProgressBar={false}
                    newestOnTop={true}
                    closeOnClick
                    rtl={false}
                    pauseOnFocusLoss
                    draggable
                    pauseOnHover
                    theme="dark"
                    style={{ zIndex: 9999 }}
                  />
                </LayoutProvider>
              </ControlPanelProvider>
            </SplitScreenProvider>
          </SearchProvider>
        </MarketCreditProvider>
      </UserProvider>
    </ThemeProvider>
  )
}
