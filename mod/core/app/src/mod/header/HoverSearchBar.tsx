"use client";

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
  const [searchTerm, setSearchTerm] = useState('')
  const router = useRouter()

  const handleSearch = () => {
    if (searchTerm.trim()) {
      onSearch(searchTerm)
      if (redirectPath) {
        const searchParams = new URLSearchParams({ search: searchTerm })
        router.push(`${redirectPath}?${searchParams.toString()}`)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
    if (e.key === 'Escape') {
      setSearchTerm('')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl border border-purple-500/30 whitespace-nowrap min-w-[320px]"
      style={{ boxShadow: '0 0 20px rgba(168, 85, 247, 0.3)' }}
    >
      <div className="text-xs font-bold uppercase mb-2 text-purple-300">{title}</div>
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus
          className="w-full px-4 py-2 pr-20 bg-black/90 border-2 border-purple-500/40 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500/60 backdrop-blur-xl transition-all text-sm"
          style={{
            boxShadow: '0 0 12px rgba(168, 85, 247, 0.2)'
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
            className="p-1.5 hover:bg-purple-500/20 rounded-lg transition-all"
          >
            <MagnifyingGlassIcon className="w-4 h-4 text-purple-400" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
