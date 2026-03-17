"use client"

import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { WalletHeader } from '@/wallet/WalletHeader'
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
        height: '60px',
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
              initial={{ width: 200, opacity: 0.8 }}
              animate={{ width: '100%', opacity: 1 }}
              exit={{ width: 200, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative flex items-center"
              style={{ maxWidth: '700px' }}
            >
              <MagnifyingGlassIcon
                className="absolute left-3 pointer-events-none w-5 h-5"
                style={{ color: 'var(--accent-primary)' }}
              />
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="search modules..."
                autoFocus
                className="w-full focus:outline-none"
                style={{
                  height: '42px',
                  padding: '0 48px 0 36px',
                  fontSize: '16px',
                  fontFamily: 'var(--font-pixel), monospace',
                  letterSpacing: '0.04em',
                  backgroundColor: 'var(--bg-input)',
                  border: `2px solid ${searchFocused ? 'var(--accent-primary)' : 'var(--border-strong)'}`,
                  color: 'var(--text-primary)',
                  caretColor: 'var(--accent-primary)',
                  transition: 'border-color 0.15s ease',
                }}
              />
              <button
                onClick={closeSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 transition-colors"
                style={{
                  fontFamily: 'var(--font-pixel)',
                  fontSize: '11px',
                  color: 'var(--text-tertiary)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--hover-bg)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
              >
                ESC
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="search-closed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setSearchOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
              className="flex items-center gap-2.5 px-3 transition-all"
              style={{
                height: '42px',
                fontFamily: 'var(--font-pixel), monospace',
                border: '2px solid var(--border-strong)',
                backgroundColor: 'var(--bg-input)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-strong)'}
            >
              <MagnifyingGlassIcon className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              <span style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>search...</span>
              <kbd
                className="ml-auto px-1.5 py-0.5"
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-pixel), monospace',
                  backgroundColor: 'var(--hover-bg)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-tertiary)',
                }}
              >
                ⌘K
              </kbd>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Right section */}
      <div className="flex items-center pr-4">
        {/* Wallet (includes network selector) */}
        <WalletHeader />
      </div>
    </div>
  )
}
