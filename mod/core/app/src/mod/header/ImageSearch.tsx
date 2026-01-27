'use client'

import { useState } from 'react'
import { MagnifyingGlassIcon, PhotoIcon } from '@heroicons/react/24/outline'
import { useSearchContext } from '@/mod/context/SearchContext'
import { useRouter } from 'next/navigation'

export function ImageSearch() {
  const { handleSearch } = useSearchContext()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [imageQuery, setImageQuery] = useState('')

  const handleImageSearch = async () => {
    if (!imageQuery.trim()) return
    
    // construct google image search query
    const googleImageSearchUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(imageQuery)}`
    
    // open in new tab
    window.open(googleImageSearchUrl, '_blank')
    
    // also update local search context
    handleSearch(imageQuery)
    router.push('/mod/explore')
    
    setImageQuery('')
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleImageSearch()
    }
    if (e.key === 'Escape') {
      setIsOpen(false)
      setImageQuery('')
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 rounded-xl border-2 transition-all backdrop-blur-xl hover:scale-105"
        style={{
          height: '60px',
          width: '60px',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderColor: 'rgba(59, 130, 246, 0.4)',
          boxShadow: '0 0 12px rgba(59, 130, 246, 0.2)'
        }}
        title="Image Search"
      >
        <PhotoIcon className="w-8 h-8" style={{ color: '#3b82f6' }} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-80 bg-black/95 border-2 border-blue-500/40 rounded-xl p-4 backdrop-blur-xl z-50"
          style={{ boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <PhotoIcon className="w-5 h-5 text-blue-400" />
            <h3 className="text-blue-400 font-bold" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>image search</h3>
          </div>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={imageQuery}
              onChange={(e) => setImageQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="search images..."
              autoFocus
              className="flex-1 px-3 py-2 bg-black/50 border-2 border-blue-500/40 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500/60"
              style={{ fontFamily: 'IBM Plex Mono, monospace' }}
            />
            <button
              onClick={handleImageSearch}
              className="px-4 py-2 bg-blue-500/20 border-2 border-blue-500/40 hover:bg-blue-500/30 rounded-lg transition-all"
              disabled={!imageQuery.trim()}
            >
              <MagnifyingGlassIcon className="w-5 h-5 text-blue-400" />
            </button>
          </div>
          
          <p className="text-xs text-gray-500 mt-2" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
            powered by google images
          </p>
        </div>
      )}
    </div>
  )
}
