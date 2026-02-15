"use client"

import { useEffect, useState, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CubeIcon, MagnifyingGlassIcon, Bars3Icon, XMarkIcon, PlusIcon } from '@heroicons/react/24/outline'
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

function GlobalSearchBar({ menuOpen, setMenuOpen }: { menuOpen: boolean; setMenuOpen: (v: boolean) => void }) {
  const { handleSearch, searchFilters } = useSearchContext()
  const router = useRouter()
  const pathname = usePathname()
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputValue, setInputValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    setInputValue(searchFilters.searchTerm || '')
  }, [searchFilters.searchTerm])

  // Keyboard shortcut: Cmd/Ctrl+K to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
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
      inputRef.current?.blur()
    }
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] flex items-center gap-3 px-4"
      style={{
        height: '64px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.98) 80%, rgba(0,0,0,0))',
        backdropFilter: 'blur(16px)',
        fontFamily: 'IBM Plex Mono, monospace',
      }}
    >
      {/* Hamburger menu button */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="shrink-0 flex items-center justify-center transition-all border-2 hover:bg-white/[0.04]"
        style={{
          width: '44px',
          height: '44px',
          borderColor: menuOpen ? 'rgba(74, 222, 128, 0.4)' : 'rgba(255,255,255,0.08)',
          background: menuOpen ? 'rgba(74, 222, 128, 0.08)' : 'transparent',
        }}
      >
        {menuOpen ? (
          <XMarkIcon className="w-6 h-6 text-green-400" />
        ) : (
          <Bars3Icon className="w-6 h-6 text-white/50" />
        )}
      </button>

      {/* Logo */}
      <Link href="/" className="shrink-0">
        <CubeIcon
          className="w-7 h-7 text-green-400"
          style={{ filter: 'drop-shadow(0 0 6px rgba(74, 222, 128, 0.5))' }}
        />
      </Link>

      {/* Search */}
      <div className="relative flex-1 max-w-xl">
        <MagnifyingGlassIcon
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors"
          style={{ color: isFocused ? '#4ade80' : '#525252' }}
        />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Search mods..."
          className="w-full bg-transparent border text-white text-[16px] font-bold placeholder-neutral-600 focus:outline-none transition-all"
          style={{
            paddingLeft: '2.75rem',
            paddingRight: '4rem',
            height: '44px',
            borderColor: isFocused ? 'rgba(74, 222, 128, 0.4)' : 'rgba(255,255,255,0.06)',
            boxShadow: isFocused ? '0 0 16px rgba(74, 222, 128, 0.08)' : 'none',
            fontFamily: 'inherit',
            borderRadius: '0px',
            letterSpacing: '0.03em',
          }}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
          {inputValue ? (
            <button
              onClick={() => { setInputValue(''); handleSearch('') }}
              className="text-neutral-600 hover:text-white text-[13px] font-bold px-2 py-1 border border-neutral-800 hover:border-neutral-600 transition-all"
            >
              ESC
            </button>
          ) : (
            <span className="text-neutral-700 text-[13px] font-bold px-2 py-1 border border-neutral-800/60">
              {navigator?.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}K
            </span>
          )}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Create Mod */}
      <Link
        href="/create"
        className="shrink-0 flex items-center gap-2 px-4 border-2 border-green-500/40 bg-green-500/10 hover:bg-green-500/20 transition-all"
        style={{ height: '44px', fontFamily: 'inherit' }}
      >
        <PlusIcon className="w-5 h-5 text-green-400" />
        <span className="text-[14px] font-extrabold uppercase tracking-wider text-green-400 whitespace-nowrap">CREATE MOD</span>
      </Link>

      {/* Network + Wallet */}
      <NetworkSelector />
      <WalletHeader />
    </div>
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

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const isVertical = orientation === 'vertical'
  const containerClass = isVertical ? 'flex' : 'flex flex-col'
  const panelClass = 'flex-1'
  const borderClass = isVertical
    ? 'border-r-2 border-green-500/30'
    : 'border-b-2 border-green-500/30'

  const navItems = [
    { href: '/chat', label: 'CHAT', color: '#8b5cf6' },
    { href: '/mod/explore', label: 'MODULES', color: '#10b981' },
    { href: '/quests', label: 'QUESTS', color: '#0bf58c' },
    { href: '/docs', label: 'DOCS', color: '#a78bfa' },
    { href: '/create', label: 'CREATE', color: '#4ade80' },
  ]

  return (
    <div className="flex h-screen bg-black">
      {/* Global search bar at top with hamburger */}
      <GlobalSearchBar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

      {/* Sidebar overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[65]"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <motion.div
        initial={false}
        animate={{ x: menuOpen ? 0 : -280 }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        className="fixed left-0 top-0 h-full z-[70] flex flex-col bg-[#0a0a0e] border-r-2 border-white/[0.08]"
        style={{ width: '280px', paddingTop: '64px', fontFamily: 'IBM Plex Mono, monospace' }}
      >
        <div className="flex flex-col gap-1 px-3 py-4 flex-1">
          {navItems.map(item => {
            const isActive = pathname?.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3.5 transition-all border-2 hover:bg-white/[0.03]"
                style={{
                  borderColor: isActive ? `${item.color}40` : 'transparent',
                  background: isActive ? `${item.color}10` : undefined,
                }}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: item.color, boxShadow: isActive ? `0 0 8px ${item.color}` : 'none' }}
                />
                <span
                  className="text-[15px] font-extrabold uppercase tracking-[0.15em]"
                  style={{ color: isActive ? item.color : 'rgba(255,255,255,0.5)' }}
                >
                  {item.label}
                </span>
                {isActive && (
                  <span className="ml-auto text-[10px] font-extrabold uppercase tracking-wider" style={{ color: `${item.color}80` }}>
                    [ACTIVE]
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </motion.div>

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
