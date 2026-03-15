"use client"

import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { CubeIcon } from '@heroicons/react/24/outline'
import { WalletHeader } from '@/wallet/WalletHeader'
import { NetworkSelector } from '@/network/NetworkSelector'
import { useSearchContext } from '@/context/SearchContext'
import { AnimatePresence, motion } from 'framer-motion'

export function TopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { handleSearch, searchFilters } = useSearchContext()
  const inputRef = useRef<HTMLInputElement>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  useEffect(() => {
    setInputValue(searchFilters.searchTerm || '')
  }, [searchFilters.searchTerm])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
        setTimeout(() => inputRef.current?.focus(), 100)
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

  const closeSearch = () => {
    setSearchOpen(false)
    setInputValue('')
    handleSearch('')
  }

  return (
    <div
      className="fixed top-0 right-0 z-[60] flex items-center"
      style={{
        left: 'var(--sidebar-width, 220px)',
        height: '56px',
        background: 'var(--bg-header)',
        borderBottom: '2px solid var(--border-color)',
        imageRendering: 'pixelated',
      }}
    >
      {/* Search */}
      <div className="flex items-center px-4 flex-1" style={{ minWidth: '160px' }}>
        <AnimatePresence mode="wait">
          {searchOpen ? (
            <motion.div
              key="search-open"
              initial={{ width: 140, opacity: 0.8 }}
              animate={{ width: '100%', opacity: 1 }}
              exit={{ width: 140, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative flex items-center"
              style={{ maxWidth: '520px' }}
            >
              <CubeIcon
                className="absolute left-2.5 pointer-events-none w-8 h-8"
                style={{
                  color: searchFocused ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                }}
              />
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search modules..."
                autoFocus
                className="w-full focus:outline-none"
                style={{
                  height: '36px',
                  padding: '0 32px 0 36px',
                  fontSize: '20px',
                  fontFamily: 'var(--font-pixel), monospace',
                  letterSpacing: '0.05em',
                  backgroundColor: 'var(--bg-input)',
                  border: `2px solid ${searchFocused ? 'var(--text-tertiary)' : 'var(--border-color)'}`,
                  borderRadius: '0px',
                  color: 'var(--text-primary)',
                  caretColor: 'var(--text-primary)',
                }}
              />
              <button
                onClick={closeSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10"
                style={{ fontFamily: 'var(--font-pixel)', fontSize: '16px', color: 'var(--text-tertiary)' }}
              >
                ✕
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="search-closed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setSearchOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
              className="flex items-center gap-2.5 px-3 hover:bg-[var(--hover-bg)]"
              style={{
                height: '36px',
                color: 'var(--text-tertiary)',
                fontSize: '20px',
                fontFamily: 'var(--font-pixel), monospace',
                border: '2px solid var(--border-color)',
                borderRadius: '0px',
                backgroundColor: 'var(--bg-input)',
              }}
            >
              <CubeIcon className="w-8 h-8" style={{ color: 'var(--text-tertiary)' }} />
              <span style={{ fontSize: '16px', fontFamily: 'var(--font-pixel)' }}>SEARCH</span>
              <kbd
                className="ml-1 px-1.5 py-0.5"
                style={{
                  fontSize: '14px',
                  fontFamily: 'var(--font-pixel), monospace',
                  backgroundColor: 'var(--bg-primary)',
                  border: '2px solid var(--border-color)',
                  color: 'var(--text-tertiary)',
                  lineHeight: '1.2',
                }}
              >
                ⌘K
              </kbd>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2 pr-3">
        {/* Network Selector */}
        <NetworkSelector />

        {/* Divider */}
        <div className="w-0.5 h-6 mx-1" style={{ backgroundColor: 'var(--border-color)' }} />

        {/* Wallet */}
        <WalletHeader />
      </div>
    </div>
  )
}
