'use client'

import { WalletHeader } from '@/mod/wallet/WalletHeader'
import { TreasuryHeader } from '@/mod/header/TreasuryHeader'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import { useSearchContext } from '@/mod/context/SearchContext'
import { useRouter } from 'next/navigation'
import { NetworkSelector } from '@/mod/network/NetworkSelector'
import { userContext } from '@/mod/context/UserContext'

export function Header() {
  const [searchCollapsed, setSearchCollapsed] = useState(false)
  const { handleSearch } = useSearchContext()
  const router = useRouter()
  const [inputValue, setInputValue] = useState('')
  const { user } = userContext()

  useEffect(() => {
    const checkWidth = () => {
      const width = window.innerWidth
      setSearchCollapsed(width < 1200)
    }
    checkWidth()
    window.addEventListener('resize', checkWidth)
    return () => window.removeEventListener('resize', checkWidth)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    if (value === '') {
      handleSearch('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const trimmed = inputValue.trim()
      handleSearch(trimmed)
      router.push('/mod/explore')
    }
    if (e.key === 'Escape') {
      setInputValue('')
      handleSearch('')
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-black border-b-2" style={{ borderColor: 'rgba(0, 255, 0, 0.25)' }}>
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center">
            <div className="relative">
              {searchCollapsed ? (
                <button
                  onClick={() => setSearchCollapsed(false)}
                  className="p-3 rounded-xl border-2 transition-all active:scale-95 backdrop-blur-xl"
                  style={{
                    height: '60px',
                    width: '60px',
                    backgroundColor: 'rgba(239, 220, 11, 0.1)',
                    borderColor: 'rgba(239, 220, 11, 0.4)',
                    boxShadow: '0 0 12px rgba(239, 220, 11, 0.2)'
                  }}
                  title="Search"
                >
                  <MagnifyingGlassIcon className="w-8 h-8" style={{ color: '#d8cc1bff' }} />
                </button>
              ) : (
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-7 h-7" style={{ color: '#d3d30bff' }} />
                  <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onBlur={() => !inputValue && setSearchCollapsed(window.innerWidth < 1200)}
                    placeholder="Search mods..."
                    className="border-2 text-white pl-14 pr-5 py-3.5 rounded-xl text-xl hover:shadow-lg focus:outline-none focus:ring-2 transition-all w-80 backdrop-blur-xl"
                    style={{
                      backgroundColor: 'rgba(239, 220, 11, 0.1)',
                      borderColor: 'rgba(239, 220, 11, 0.4)',
                      fontFamily: "'Courier New', 'Consolas', 'Monaco', monospace",
                      boxShadow: '0 0 12px rgba(239, 220, 11, 0.2)'
                    }}
                    autoFocus={!searchCollapsed}
                  />
                </div>
              )}
            </div>
          </div>
          
          <TreasuryHeader />
        </div>
        
        <div className="flex items-center justify-end gap-3">
          <NetworkSelector />
          <WalletHeader />
        </div>
      </div>
    </header>
  )
}
