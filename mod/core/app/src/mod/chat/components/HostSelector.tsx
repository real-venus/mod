'use client'

import { useState, useEffect } from 'react'
import { Cog6ToothIcon } from '@heroicons/react/24/outline'

const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface HostSelectorProps {
  onHostChange?: (url: string) => void
}

export function HostSelector({ onHostChange }: HostSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputUrl, setInputUrl] = useState<string>('')
  const [currentHost, setCurrentHost] = useState<string>('')

  useEffect(() => {
    const saved = localStorage.getItem('custom_node_url')
    const host = saved || DEFAULT_API_URL
    setInputUrl(host)
    setCurrentHost(host)
  }, [])

  const handleSave = () => {
    if (inputUrl.trim()) {
      localStorage.setItem('custom_node_url', inputUrl.trim())
      setCurrentHost(inputUrl.trim())
      if (onHostChange) {
        onHostChange(inputUrl.trim())
      }
      window.location.reload()
    }
  }

  const handleReset = () => {
    localStorage.removeItem('custom_node_url')
    setInputUrl(DEFAULT_API_URL)
    setCurrentHost(DEFAULT_API_URL)
    if (onHostChange) {
      onHostChange(DEFAULT_API_URL)
    }
    window.location.reload()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 bg-purple-500/20 text-purple-400 border-2 border-purple-500/40 hover:bg-purple-500/30 rounded-lg transition-all"
        title={`Current Host: ${currentHost}`}
        style={{ fontFamily: 'IBM Plex Mono, monospace' }}
      >
        <Cog6ToothIcon className="h-5 w-5" />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-80 bg-black/95 border-2 border-purple-500/60 rounded-lg shadow-2xl p-4 z-50 backdrop-blur-md">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-purple-400 font-bold text-sm" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>HOST SETTINGS</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-gray-400" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
              current: <span className="text-purple-300">{currentHost}</span>
            </div>

            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Enter API URL"
              className="w-full bg-black/40 border-2 border-purple-500/40 text-white text-sm placeholder:text-purple-600/40 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/60"
              style={{ fontFamily: 'IBM Plex Mono, monospace' }}
            />

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="flex-1 px-3 py-2 text-xs bg-green-500/20 text-green-400 border-2 border-green-500/40 hover:bg-green-500/30 rounded-lg transition-all font-bold"
                style={{ fontFamily: 'IBM Plex Mono, monospace' }}
              >
                💾 SAVE
              </button>
              <button
                onClick={handleReset}
                className="flex-1 px-3 py-2 text-xs bg-red-500/20 text-red-400 border-2 border-red-500/40 hover:bg-red-500/30 rounded-lg transition-all font-bold"
                style={{ fontFamily: 'IBM Plex Mono, monospace' }}
              >
                🔄 RESET
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
