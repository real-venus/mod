"use client";

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { userContext } from '@/context'
import { ModuleType } from '@/types'

interface ModStats {
  totalMods: number
  recentlyCreated: number
  recentlyUpdated: number
  activeUsers: number
}

export function NewsBanner() {
  const { client } = userContext()
  const [stats, setStats] = useState<ModStats>({
    totalMods: 0,
    recentlyCreated: 0,
    recentlyUpdated: 0,
    activeUsers: 0
  })
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const fetchStats = async () => {
      if (!client) return
      
      try {
        const mods = (await client.call('mods', {})) as ModuleType[]
        const now = Date.now() / 1000
        const last24h = now - (24 * 60 * 60)
        
        const recentlyCreated = mods.filter(m => (m.created || 0) >= last24h).length
        const recentlyUpdated = mods.filter(m => (m.updated || 0) >= last24h).length
        const uniqueKeys = new Set(mods.map(m => m.key)).size
        
        setStats({
          totalMods: mods.length,
          recentlyCreated,
          recentlyUpdated,
          activeUsers: uniqueKeys
        })
      } catch (err) {
        console.error('Failed to fetch mod stats:', err)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [client])

  const newsItems = [
    { label: 'MODS', value: stats.totalMods, color: '#3b82f6' },
    { label: 'CREATED (24H)', value: stats.recentlyCreated, color: '#10b981' },
    { label: 'UPDATED (24H)', value: stats.recentlyUpdated, color: '#f59e0b' },
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % newsItems.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [newsItems.length])

  return (
    <div className="w-full bg-black border-b-2 border-green-500/30 overflow-hidden" style={{ height: '50px' }}>
      <div className="flex items-center h-full px-4 gap-8">
        <div className="flex items-center gap-2 min-w-fit">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-green-400 font-bold text-sm uppercase tracking-wider">LIVE</span>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3"
          >
            <span 
              className="font-bold text-sm uppercase tracking-wide"
              style={{ color: newsItems[currentIndex].color }}
            >
              {newsItems[currentIndex].label}:
            </span>
            <span 
              className="text-2xl font-black"
              style={{ 
                color: newsItems[currentIndex].color,
                fontFamily: 'IBM Plex Mono, monospace',
                textShadow: `0 0 10px ${newsItems[currentIndex].color}40`
              }}
            >
              {newsItems[currentIndex].value.toLocaleString()}
            </span>
          </motion.div>
        </div>

        <div className="flex gap-2">
          {newsItems.map((item, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className="w-2 h-2 rounded-full transition-all"
              style={{
                backgroundColor: idx === currentIndex ? item.color : '#374151',
                boxShadow: idx === currentIndex ? `0 0 8px ${item.color}` : 'none'
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
