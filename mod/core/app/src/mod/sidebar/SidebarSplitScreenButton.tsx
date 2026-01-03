'use client'

import { Squares2X2Icon } from '@heroicons/react/24/outline'
import { useSplitScreenContext } from '@/mod/context/SplitScreenContext'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export function SidebarSplitScreenButton() {
  const { toggleSplitScreen, orientation, setOrientation } = useSplitScreenContext()
  const [showOrientationMenu, setShowOrientationMenu] = useState(false)

  const handleOrientationSelect = (newOrientation: 'vertical' | 'horizontal') => {
    setOrientation(newOrientation)
    toggleSplitScreen()
    setShowOrientationMenu(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowOrientationMenu(!showOrientationMenu)}
        className="group relative flex items-center justify-center rounded-lg p-3 text-base font-semibold transition-all duration-200 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/20"
        title="Split Screen"
      >
        <Squares2X2Icon
          className="shrink-0 transition-transform duration-200 group-hover:scale-110"
          style={{
            color: '#9ca3af',
            width: '2.5rem',
            height: '2.5rem',
            minWidth: '2.5rem',
            minHeight: '2.5rem'
          }}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {showOrientationMenu && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
            className="fixed"
            style={{ 
              zIndex: 99999,
              left: '88px',
              top: 'auto'
            }}
          >
            <div className="bg-gray-900 border border-green-500/30 rounded-lg shadow-xl overflow-hidden">
              <button
                onClick={() => handleOrientationSelect('vertical')}
                className="w-full px-4 py-3 text-left text-white hover:bg-green-500/20 transition-colors flex items-center gap-3 border-b border-gray-800"
              >
                <Squares2X2Icon className="w-5 h-5" />
                <span className="text-sm font-medium">Vertical Split</span>
              </button>
              <button
                onClick={() => handleOrientationSelect('horizontal')}
                className="w-full px-4 py-3 text-left text-white hover:bg-green-500/20 transition-colors flex items-center gap-3"
              >
                <Squares2X2Icon className="w-5 h-5 rotate-90" />
                <span className="text-sm font-medium">Horizontal Split</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
