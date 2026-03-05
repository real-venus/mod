"use client"

import { useEffect, useState, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { MagnifyingGlassIcon, PlusIcon, Bars3Icon, XMarkIcon, SunIcon, MoonIcon } from '@heroicons/react/24/outline'
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
import { ThemeProvider, useTheme } from '@/context/ThemeContext'
import { SplitScreenControls } from '@/components/SplitScreenControls'
import { getAllNavItems, getNavHref } from '@/config/navigation'
import { MetaMaskProvider } from '@/wallet/MetaMaskProvider'

function ThemedToast() {
  const { effectiveTheme } = useTheme()
  return (
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
      theme={effectiveTheme === 'dark' ? 'dark' : 'light'}
      style={{ zIndex: 9999 }}
    />
  )
}

function ThemeToggle() {
  const { effectiveTheme, setTheme } = useTheme()
  const toggle = () => setTheme(effectiveTheme === 'dark' ? 'light' : 'dark')

  return (
    <button
      onClick={toggle}
      className="shrink-0 flex items-center justify-center transition-all hover:opacity-80"
      style={{ width: '34px', height: '34px', background: 'var(--bg-input)', borderRadius: '20px', border: '1px solid var(--border-strong)' }}
      title={effectiveTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {effectiveTheme === 'dark' ? (
        <SunIcon className="w-4 h-4 text-white" />
      ) : (
        <MoonIcon className="w-4 h-4 text-black" />
      )}
    </button>
  )
}

function GlobalSearchBar({ menuOpen, setMenuOpen }: { menuOpen: boolean; setMenuOpen: (v: boolean) => void }) {
  const { handleSearch, searchFilters } = useSearchContext()
  const router = useRouter()
  const pathname = usePathname()
  const inputRef = useRef<HTMLInputElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const createDropdownRef = useRef<HTMLDivElement>(null)
  const [inputValue, setInputValue] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [createDropdownOpen, setCreateDropdownOpen] = useState(false)

  const navItems = getAllNavItems()

  // No longer close sidebar on route change — sidebar persists

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

  // Close create dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (createDropdownRef.current && !createDropdownRef.current.contains(e.target as Node)) {
        setCreateDropdownOpen(false)
      }
    }
    if (createDropdownOpen) {
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }
  }, [createDropdownOpen])

  return (
    <>
      <div
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-[60] flex items-center gap-0 px-4"
        style={{
          height: '48px',
          background: `linear-gradient(to bottom, var(--bg-header) 80%, transparent)`,
          backdropFilter: 'blur(16px)',
          fontFamily: 'IBM Plex Mono, monospace',
        }}
      >
        {/* Hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="shrink-0 flex items-center justify-center transition-all hover:opacity-80 mr-2"
          style={{ width: '40px', height: '36px' }}
        >
          {menuOpen ? (
            <XMarkIcon className="w-5 h-5 text-green-400" />
          ) : (
            <Bars3Icon className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
          )}
        </button>

        {/* Search bar - always visible, centered, takes most space */}
        <div className="flex-1 flex items-center">
          <div className="relative w-full max-w-2xl">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search mods..."
              className="w-full text-[16px] font-bold focus:outline-none focus:border-green-500/40 transition-all rounded-xl"
              style={{
                paddingLeft: '2.5rem',
                paddingRight: searchOpen ? '3.5rem' : '1rem',
                height: '36px',
                fontFamily: 'inherit',
                letterSpacing: '0.03em',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-input)',
                color: 'var(--text-primary)',
              }}
            />
            {searchOpen && inputValue && (
              <button
                onClick={closeSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold px-1.5 py-0.5 rounded-md transition-all"
                style={{ color: 'var(--text-secondary)', background: 'var(--bg-input)' }}
              >
                ESC
              </button>
            )}
          </div>
        </div>

        {/* Right side: + CREATE, Logo, Network, Wallet */}
        <div className="shrink-0 flex items-center gap-1 ml-3">
          <button
            onClick={() => router.push('/create')}
            className="shrink-0 flex items-center gap-2 px-5 border hover:opacity-80 transition-all"
            style={{ height: '44px', fontFamily: 'inherit', borderRadius: '22px', borderColor: 'var(--border-strong)', background: 'transparent' }}
          >
            <PlusIcon className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
            <span className="text-[17px] font-extrabold uppercase tracking-[0.08em] whitespace-nowrap hidden sm:inline" style={{ color: 'var(--text-primary)' }}>
              CREATE
            </span>
          </button>

          <ThemeToggle />
          <NetworkSelector />
          <WalletHeader />
        </div>
      </div>

      {/* Sidebar - push layout, no overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ x: -220 }}
            animate={{ x: 0 }}
            exit={{ x: -220 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="fixed left-0 top-0 bottom-0 z-[59] flex flex-col overflow-y-auto custom-scrollbar"
            style={{
              width: '220px',
              background: 'var(--bg-sidebar)',
              backdropFilter: 'blur(16px)',
              fontFamily: 'IBM Plex Mono, monospace',
              borderRight: '1px solid var(--border-color)',
            }}
          >
            {/* Spacer for top header */}
            <div className="h-[48px] shrink-0" />

            {/* Nav items */}
            <div className="flex-1 py-1">
              {navItems.map(item => {
                const finalHref = getNavHref(item)
                const isActive = pathname?.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={finalHref}
                    className="flex items-center px-4 py-2.5 transition-all"
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                    onMouseLeave={e => { if (!pathname?.startsWith(item.href)) e.currentTarget.style.background = 'transparent' }}
                    style={{
                      borderLeft: isActive ? `3px solid ${item.color}` : '3px solid transparent',
                      background: isActive ? `${item.color}08` : undefined,
                    }}
                  >
                    <span
                      className="text-[15px] font-extrabold uppercase tracking-[0.1em]"
                      style={{ color: isActive ? item.color : 'var(--text-secondary)' }}
                    >
                      {item.label}
                    </span>
                  </Link>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
  const [menuOpen, setMenuOpen] = useState(false)

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
    <div className="flex h-screen transition-all duration-200" style={{ paddingTop: '48px', marginLeft: menuOpen ? '220px' : '0px', backgroundColor: 'var(--bg-primary)' }}>
      {/* Global header with tabs */}
      <GlobalSearchBar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

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
      <MetaMaskProvider>
        <UserProvider>
          <MarketCreditProvider>
            <SearchProvider>
              <SplitScreenProvider>
                <ControlPanelProvider>
                  <LayoutProvider>
                    <LayoutContent>{children}</LayoutContent>
                    <ThemedToast />
                  </LayoutProvider>
                </ControlPanelProvider>
              </SplitScreenProvider>
            </SearchProvider>
          </MarketCreditProvider>
        </UserProvider>
      </MetaMaskProvider>
    </ThemeProvider>
  )
}
