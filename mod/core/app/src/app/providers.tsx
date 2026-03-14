"use client"

import { useEffect, useState, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { MagnifyingGlassIcon, PlusIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { WalletHeader } from '@/wallet/WalletHeader'
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
import { getAllNavItems, getNavHref, NavItem } from '@/config/navigation'
import { MetaMaskProvider } from '@/wallet/MetaMaskProvider'
import { ThemeSelectorCompact } from '@/themes/ThemeSelectorCompact'
import { ThemeInitializer } from '@/themes/ThemeInitializer'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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


// Sortable tab item component
function SortableNavItem({ item, isActive, onRemove }: { item: NavItem; isActive: boolean; onRemove: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.href })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const finalHref = getNavHref(item)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group px-3 mb-2"
    >
      <Link
        href={finalHref}
        className="flex items-center justify-between px-4 py-3.5 transition-all border-4 cursor-move"
        {...attributes}
        {...listeners}
        onMouseEnter={e => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = `${item.color}15`
            e.currentTarget.style.borderColor = `${item.color}60`
          }
        }}
        onMouseLeave={e => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'
            e.currentTarget.style.borderColor = 'var(--border-strong)'
          }
        }}
        style={{
          borderColor: isActive ? item.color : 'var(--border-strong)',
          backgroundColor: isActive ? `${item.color}20` : 'var(--bg-secondary)',
          boxShadow: isActive ? `0 0 20px ${item.color}30` : 'none',
        }}
      >
        <span
          className="text-xl font-digital uppercase tracking-[0.15em] font-bold"
          style={{ color: isActive ? item.color : 'var(--text-primary)' }}
        >
          {item.label}
        </span>

        {/* Remove button */}
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onRemove()
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 border-2"
          style={{
            borderColor: 'var(--border-strong)',
            backgroundColor: 'var(--bg-primary)',
          }}
          title="Remove from sidebar"
        >
          <XMarkIcon className="w-4 h-4" style={{ color: 'var(--text-primary)' }} />
        </button>
      </Link>
    </div>
  )
}

function GlobalSearchBar({ menuOpen, setMenuOpen, sidebarWidth, setIsResizing }: { menuOpen: boolean; setMenuOpen: (v: boolean) => void; sidebarWidth: number; setIsResizing: (v: boolean) => void }) {
  const { handleSearch, searchFilters } = useSearchContext()
  const router = useRouter()
  const pathname = usePathname()
  const inputRef = useRef<HTMLInputElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const createDropdownRef = useRef<HTMLDivElement>(null)
  const [inputValue, setInputValue] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [createDropdownOpen, setCreateDropdownOpen] = useState(false)
  const [orderedTabs, setOrderedTabs] = useState<NavItem[]>([])

  const navItems = getAllNavItems()

  // Load tab order from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('tabOrder')
    if (saved) {
      try {
        const savedOrder: string[] = JSON.parse(saved)
        // Reconstruct the ordered array from saved hrefs
        const ordered = savedOrder
          .map(href => navItems.find(item => item.href === href))
          .filter(Boolean) as NavItem[]

        // Add any new tabs that weren't in the saved order
        const existingHrefs = new Set(savedOrder)
        const newTabs = navItems.filter(item => !existingHrefs.has(item.href))

        setOrderedTabs([...ordered, ...newTabs])
      } catch (e) {
        setOrderedTabs(navItems)
      }
    } else {
      setOrderedTabs(navItems)
    }
  }, [])

  // Save tab order to localStorage whenever it changes
  useEffect(() => {
    if (orderedTabs.length > 0) {
      const order = orderedTabs.map(item => item.href)
      localStorage.setItem('tabOrder', JSON.stringify(order))
    }
  }, [orderedTabs])

  const removeTab = (href: string) => {
    setOrderedTabs(prev => prev.filter(item => item.href !== href))
  }

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setOrderedTabs((items) => {
        const oldIndex = items.findIndex(item => item.href === active.id)
        const newIndex = items.findIndex(item => item.href === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

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
          className="shrink-0 flex items-center justify-center transition-all border-4 mr-2"
          style={{
            width: '44px',
            height: '44px',
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-strong)'
          }}
        >
          {menuOpen ? (
            <XMarkIcon className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />
          ) : (
            <Bars3Icon className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />
          )}
        </button>

        {/* Search bar and Create button - centered together */}
        <div className="flex-1 flex items-center justify-center gap-2">
          <div className="relative w-full max-w-2xl">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-primary)' }} />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setSearchOpen(true)}
              placeholder="SEARCH MODS..."
              className="w-full text-lg font-digital focus:outline-none transition-all border-4 uppercase"
              style={{
                paddingLeft: '3rem',
                paddingRight: searchOpen ? '4rem' : '1.5rem',
                height: '44px',
                fontFamily: 'var(--font-digital), monospace',
                letterSpacing: '0.05em',
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            />
            {searchOpen && inputValue && (
              <button
                onClick={closeSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold px-2 py-1 border-2 transition-all uppercase"
                style={{
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border-strong)',
                  fontFamily: 'var(--font-digital)'
                }}
              >
                ESC
              </button>
            )}
          </div>

          <button
            onClick={() => router.push('/create')}
            className="shrink-0 flex items-center gap-2 px-5 border-4 transition-all uppercase"
            style={{
              height: '44px',
              fontFamily: 'var(--font-digital), monospace',
              borderColor: 'var(--border-strong)',
              backgroundColor: 'var(--bg-secondary)'
            }}
          >
            <PlusIcon className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />
            <span className="text-xl font-digital font-bold tracking-wider whitespace-nowrap hidden sm:inline" style={{ color: 'var(--text-primary)' }}>
              CREATE
            </span>
          </button>
        </div>

        {/* Right side: Wallet */}
        <div className="shrink-0 flex items-center gap-2 ml-3">
          <WalletHeader />
        </div>
      </div>

      {/* Sidebar - push layout, no overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ x: -sidebarWidth }}
            animate={{ x: 0 }}
            exit={{ x: -sidebarWidth }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="fixed left-0 top-0 bottom-0 z-[59] flex flex-col overflow-y-auto custom-scrollbar"
            style={{
              width: `${sidebarWidth}px`,
              background: 'var(--bg-sidebar)',
              backdropFilter: 'blur(16px)',
              fontFamily: 'IBM Plex Mono, monospace',
              borderRight: '4px solid var(--border-strong)',
            }}
          >
            {/* Spacer for top header */}
            <div className="h-[48px] shrink-0" />

            {/* Nav items with drag and drop */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={orderedTabs.map(item => item.href)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex-1 py-3">
                  {orderedTabs.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <p className="text-sm font-digital uppercase" style={{ color: 'var(--text-secondary)' }}>
                        No tabs
                      </p>
                    </div>
                  ) : (
                    orderedTabs.map(item => {
                      const isActive = pathname?.startsWith(item.href)
                      return (
                        <SortableNavItem
                          key={item.href}
                          item={item}
                          isActive={isActive}
                          onRemove={() => removeTab(item.href)}
                        />
                      )
                    })
                  )}
                </div>
              </SortableContext>
            </DndContext>

            {/* Theme Selector at bottom */}
            <div className="mt-auto px-3 py-3 border-t-4" style={{ borderColor: 'var(--border-strong)' }}>
              <ThemeSelectorCompact expandUpwards={true} />
            </div>

            {/* Resize handle */}
            <div
              onMouseDown={() => setIsResizing(true)}
              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/50 transition-colors group"
              style={{ zIndex: 100 }}
            >
              <div className="absolute right-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-blue-500/50" />
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
  const [menuOpen, setMenuOpen] = useState(() => {
    // Initialize from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebarOpen')
      return saved === 'true'
    }
    return false
  })

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    // Initialize sidebar width from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebarWidth')
      return saved ? parseInt(saved, 10) : 340
    }
    return 340
  })

  const [isResizing, setIsResizing] = useState(false)

  // Persist sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarOpen', String(menuOpen))
  }, [menuOpen])

  // Persist sidebar width to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarWidth', String(sidebarWidth))
  }, [sidebarWidth])

  // Handle resizing
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(600, e.clientX))
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

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
    <div className="flex h-screen transition-all duration-200" style={{ paddingTop: '48px', marginLeft: menuOpen ? `${sidebarWidth}px` : '0px', backgroundColor: 'var(--bg-primary)' }}>
      {/* Global header with tabs */}
      <GlobalSearchBar menuOpen={menuOpen} setMenuOpen={setMenuOpen} sidebarWidth={sidebarWidth} setIsResizing={setIsResizing} />

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
      <ThemeInitializer />
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
