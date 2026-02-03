'use client'

import Link from 'next/link'
import { HomeIcon } from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'
import { useState } from 'react'

export function HomeLink() {
  const [isHovered, setIsHovered] = useState(false)
  
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative"
    >
      <Link
        href="/"
        className="flex items-center justify-center rounded-xl p-3 border-2 border-cyan-400/30 hover:border-cyan-400/50 hover:bg-cyan-400/10 transition-all backdrop-blur-sm"
        style={{ 
          height: '60px', 
          width: '60px',
          boxShadow: '0 0 15px rgba(34, 211, 238, 0.2)'
        }}
      >
        <HomeIcon className="w-8 h-8 text-cyan-400" />
      </Link>
      
      {isHovered && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.15 }}
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 pointer-events-none z-50"
        >
          <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl border border-cyan-400/30 whitespace-nowrap text-sm font-medium">
            Home
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-8 border-transparent border-b-gray-900" />
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
