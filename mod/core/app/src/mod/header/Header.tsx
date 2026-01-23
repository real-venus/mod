'use client'

import { WalletHeader } from '@/mod/wallet/WalletHeader'
import { TreasuryHeader } from '@/mod/header/TreasuryHeader'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import { useSearchContext } from '@/mod/context/SearchContext'
import { useRouter } from 'next/navigation'
import { NetworkSelector } from '@/mod/network/NetworkSelector'
import { userContext } from '@/mod/context/UserContext'
import { motion, AnimatePresence } from 'framer-motion'

export function Header() {
  const [searchCollapsed, setSearchCollapsed] = useState(false)
  const { handleSearch } = useSearchContext()
  const router = useRouter()
  const [inputValue, setInputValue] = useState('')
  const { user } = userContext()
  const [hoveredSection, setHoveredSection] = useState<string | null>(null)

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
          <div 
            className="relative flex items-center"
            onMouseEnter={() => setHoveredSection('search')}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <div className="relative">
              {searchCollapsed ? (
                <>
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
                  <AnimatePresence>
                    {hoveredSection === 'search' && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 mt-2 pointer-events-none z-50"
                      >
                        <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl border border-yellow-500/30 whitespace-nowrap text-sm font-medium">
                          Search
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-8 border-transparent border-b-gray-900" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
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
          
          <div
            className="relative"
            onMouseEnter={() => setHoveredSection('treasury')}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <TreasuryHeader />
            <AnimatePresence>
              {hoveredSection === 'treasury' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-2 pointer-events-none z-50"
                >
                  <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl border border-green-500/30 whitespace-nowrap text-sm font-medium">
                    Treasury
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-8 border-transparent border-b-gray-900" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-3">
          <div
            className="relative"
            onMouseEnter={() => setHoveredSection('network')}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <NetworkSelector />
            <AnimatePresence>
              {hoveredSection === 'network' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full right-0 mt-2 pointer-events-none z-50"
                >
                  <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl border border-green-500/30 whitespace-nowrap text-sm font-medium">
                    Network
                    <div className="absolute bottom-full right-4 border-8 border-transparent border-b-gray-900" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div
            className="relative"
            onMouseEnter={() => setHoveredSection('wallet')}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <WalletHeader />
            <AnimatePresence>
              {hoveredSection === 'wallet' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full right-0 mt-2 pointer-events-none z-50"
                >
                  <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl border border-green-500/30 whitespace-nowrap text-sm font-medium">
                    Wallet
                    <div className="absolute bottom-full right-4 border-8 border-transparent border-b-gray-900" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  )
}
