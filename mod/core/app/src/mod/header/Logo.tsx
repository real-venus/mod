'use client'

import Link from 'next/link'
import { CubeIcon } from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'
import { useState } from 'react'

export function Logo() {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <Link href="/">
      <motion.div
        className="relative cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ scale: 1.1, rotate: 180 }}
        transition={{ duration: 0.3 }}
      >
        <CubeIcon 
          className="w-12 h-12 text-green-400"
          style={{
            filter: 'drop-shadow(0 0 8px rgba(74, 222, 128, 0.6))'
          }}
        />
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl border border-green-500/30 whitespace-nowrap text-sm font-medium pointer-events-none"
          >
            Home
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-gray-900" />
          </motion.div>
        )}
      </motion.div>
    </Link>
  )
}
