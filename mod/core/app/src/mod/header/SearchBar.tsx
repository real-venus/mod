"use client";

import { useState, useEffect } from 'react'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useSearchContext } from '@/mod/context/SearchContext'
import { useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

export function SearchBar() {
  const { handleSearch, searchFilters } = useSearchContext()
  const router = useRouter()
  const pathname = usePathname()
  const [inputValue, setInputValue] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    setInputValue(searchFilters.searchTerm || '')
  }, [searchFilters.searchTerm])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    handleSearch(value)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const trimmed = inputValue.trim()
      handleSearch(trimmed)
      if (pathname !== '/mod/explore') {
        router.push('/mod/explore')
      }
    }
    if (e.key === 'Escape') {
      setInputValue('')
      handleSearch('')
      setIsExpanded(false)
    }
  }

  const handleClear = () => {
    setInputValue('')
    handleSearch('')
  }

  const handleSearchClick = () => {
    const trimmed = inputValue.trim()
    if (trimmed) {
      handleSearch(trimmed)
      if (pathname !== '/mod/explore') {
        router.push('/mod/explore')
      }
    }
  }

  return (
    <div className="relative flex items-center">
      <AnimatePresence>
        {isExpanded ? (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: '320px', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="flex items-center gap-2 overflow-hidden"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Search tabs, mods, users..."
                autoFocus
                className="w-full px-4 py-3 pr-20 bg-black/50 border-2 border-yellow-500/40 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500/60 backdrop-blur-xl transition-all"
                style={{
                  boxShadow: '0 0 12px rgba(239, 220, 11, 0.2)'
                }}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {inputValue && (
                  <button
                    onClick={handleClear}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-all"
                  >
                    <XMarkIcon className="w-4 h-4 text-gray-400" />
                  </button>
                )}
                <button
                  onClick={handleSearchClick}
                  className="p-1.5 hover:bg-yellow-500/20 rounded-lg transition-all"
                >
                  <MagnifyingGlassIcon className="w-4 h-4" style={{ color: '#d8cc1bff' }} />
                </button>
              </div>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-3 rounded-xl border-2 border-white/20 hover:border-white/40 hover:bg-white/10 transition-all"
              style={{ height: '48px', width: '48px' }}
            >
              <XMarkIcon className="w-5 h-5 text-gray-400" />
            </button>
          </motion.div>
        ) : (
          <motion.button
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={() => setIsExpanded(true)}
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
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
