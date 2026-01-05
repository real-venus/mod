'use client'

import { Squares2X2Icon, XMarkIcon } from '@heroicons/react/24/outline'
import { useSplitScreenContext } from '@/mod/context/SplitScreenContext'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export function SidebarSplitScreenButton() {
  const { isSplitScreen, toggleSplitScreen, setOrientation } = useSplitScreenContext()
  const [showOrientationMenu, setShowOrientationMenu] = useState(false)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)

  const handleOrientationSelect = (newOrientation: 'vertical' | 'horizontal') => {
    setOrientation(newOrientation)
    toggleSplitScreen()
    setShowOrientationMenu(false)
  }

  const handleCancelSplitScreen = () => {
    toggleSplitScreen()
  }

  return (
    <div 
      className="relative"
      onMouseEnter={() => setHoveredItem('Split Screen')}
      onMouseLeave={() => setHoveredItem(null)}
    >
      {!isSplitScreen ? (
        <>
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
                    onMouseEnter={() => setHoveredItem('Vertical Split')}
                    className="w-full px-4 py-3 text-left text-white hover:bg-green-500/20 transition-colors flex items-center gap-3 border-b border-gray-800"
                  >
                    <Squares2X2Icon className="w-5 h-5" />
                    <span className="text-sm font-medium">Vertical Split</span>
                  </button>
                  <button
                    onClick={() => handleOrientationSelect('horizontal')}
                    onMouseEnter={() => setHoveredItem('Horizontal Split')}
                    className="w-full px-4 py-3 text-left text-white hover:bg-green-500/20 transition-colors flex items-center gap-3"
                  >
                    <Squares2X2Icon className="w-5 h-5 rotate-90" />
                    <span className="text-sm font-medium">Horizontal Split</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {hoveredItem === 'Vertical Split' && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="fixed pointer-events-none"
                style={{ 
                  zIndex: 100000,
                  left: '240px',
                  top: 'auto'
                }}
              >
                <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl border border-green-500/30 whitespace-nowrap text-sm font-medium">
                  Vertical Split
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-gray-900" />
                </div>
              </motion.div>
            )}
            {hoveredItem === 'Horizontal Split' && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="fixed pointer-events-none"
                style={{ 
                  zIndex: 100000,
                  left: '240px',
                  top: 'auto'
                }}
              >
                <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl border border-green-500/30 whitespace-nowrap text-sm font-medium">
                  Horizontal Split
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-gray-900" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <button
          onClick={handleCancelSplitScreen}
          className="group relative flex items-center justify-center rounded-lg p-3 text-base font-semibold transition-all duration-200 text-red-400 hover:text-red-300 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50"
          title="Close Split Screen"
        >
          <XMarkIcon
            className="shrink-0 transition-transform duration-200 group-hover:scale-110"
            style={{
              color: '#f87171',
              width: '2.5rem',
              height: '2.5rem',
              minWidth: '2.5rem',
              minHeight: '2.5rem'
            }}
            aria-hidden="true"
          />
        </button>
      )}
    </div>
  )
}
