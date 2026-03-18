"use client"

import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { WalletHeader } from '@/wallet/WalletHeader'
import { useSearchContext } from '@/context/SearchContext'

export function TopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { handleSearch, searchFilters } = useSearchContext()
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputValue, setInputValue] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  useEffect(() => {
    setInputValue(searchFilters.searchTerm || '')
  }, [searchFilters.searchTerm])

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
      className="fixed top-0 left-0 right-0 z-[70] flex items-center"
      style={{
        height: '48px',
        background: 'var(--bg-header)',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      {/* Search bar - always visible */}
      <div className="flex items-center flex-1 px-3" style={{ marginLeft: 'var(--sidebar-width, 56px)' }}>
        <div
          className="flex items-center flex-1 transition-all"
          style={{
            maxWidth: '560px',
            height: '34px',
            backgroundColor: searchFocused ? 'var(--bg-input)' : 'transparent',
            border: searchFocused ? '1px solid var(--accent-primary)' : '1px solid transparent',
            borderRadius: '6px',
            transition: 'all 0.15s ease',
          }}
        >
          {/* /search bubble */}
          <div
            className="flex items-center gap-1.5 flex-shrink-0 px-2 cursor-pointer select-none"
            onClick={() => inputRef.current?.focus()}
            style={{ height: '100%' }}
          >
            <span
              className="inline-flex items-center px-1.5 py-0.5"
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-pixel), monospace',
                fontWeight: 700,
                color: searchFocused ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                backgroundColor: searchFocused ? 'var(--accent-primary)10' : 'var(--hover-bg)',
                border: `1px solid ${searchFocused ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                borderRadius: '4px',
                letterSpacing: '0.02em',
                transition: 'all 0.15s ease',
              }}
            >
              /search
            </span>
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
            placeholder="modules, functions, tags..."
            className="flex-1 bg-transparent focus:outline-none min-w-0"
            style={{
              height: '100%',
              fontSize: '13px',
              fontFamily: 'var(--font-pixel), monospace',
              color: 'var(--text-primary)',
              caretColor: 'var(--accent-primary)',
              padding: '0 8px 0 0',
            }}
          />

          {/* Keyboard shortcut hint */}
          {!searchFocused && !inputValue && (
            <kbd
              className="flex-shrink-0 mr-2 px-1.5 py-0.5"
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-pixel), monospace',
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

        {/* /mods bubble - client call */}
        <div
          className="flex-shrink-0 ml-2 cursor-pointer select-none"
          onClick={() => {
            if (pathname !== '/mod/explore') router.push('/mod/explore')
          }}
        >
          <span
            className="inline-flex items-center px-2 py-1 transition-all"
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-pixel), monospace',
              fontWeight: 700,
              color: pathname === '/mod/explore' ? 'var(--accent-primary)' : 'var(--text-tertiary)',
              backgroundColor: pathname === '/mod/explore' ? 'var(--accent-primary)10' : 'transparent',
              border: `1px solid ${pathname === '/mod/explore' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              borderRadius: '4px',
              letterSpacing: '0.02em',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--accent-primary)'
              e.currentTarget.style.borderColor = 'var(--accent-primary)'
            }}
            onMouseLeave={(e) => {
              if (pathname !== '/mod/explore') {
                e.currentTarget.style.color = 'var(--text-tertiary)'
                e.currentTarget.style.borderColor = 'var(--border-color)'
              }
            }}
          >
            /mods
          </span>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center pr-3 gap-1">
        <WalletHeader />
      </div>
    </div>
  )
}
