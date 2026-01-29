'use client'

import { useState } from 'react'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'

interface HoverSearchBarProps {
  title: string
  placeholder: string
  onSearch: (term: string) => void
  redirectPath?: string
}

export function HoverSearchBar({ title, placeholder, onSearch, redirectPath }: HoverSearchBarProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const router = useRouter()

  const handleSearch = () => {
    if (searchTerm.trim()) {
      onSearch(searchTerm)
      if (redirectPath) {
        router.push(redirectPath)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
    if (e.key === 'Escape') {
      setSearchTerm('')
      setIsVisible(false)
    }
  }

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <div className="px-4 py-2 text-white font-bold uppercase cursor-pointer hover:text-yellow-400 transition-colors">
        {title}
      </div>
      
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 mt-2 z-50 min-w-[320px]"
          >
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                autoFocus
                className="w-full px-4 py-3 pr-20 bg-black/90 border-2 border-yellow-500/40 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500/60 backdrop-blur-xl transition-all"
                style={{
                  boxShadow: '0 0 12px rgba(239, 220, 11, 0.2)'
                }}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-all"
                  >
                    <XMarkIcon className="w-4 h-4 text-gray-400" />
                  </button>
                )}
                <button
                  onClick={handleSearch}
                  className="p-1.5 hover:bg-yellow-500/20 rounded-lg transition-all"
                >
                  <MagnifyingGlassIcon className="w-4 h-4" style={{ color: '#d8cc1bff' }} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
