'use client'

import { useState } from 'react'
import { userContext } from '@/mod/context'
import { WalletIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import WalletAuthButton from '@/mod/wallet/WalletAuthButton'

const FIXED_WIDTH = 80

export function SidebarWalletButton() {
  const { user } = userContext()
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)

  if (user) {
    return null
  }

  return (
    <>
      <div
        className="relative"
        onMouseEnter={() => setHoveredItem('Wallet')}
        onMouseLeave={() => setHoveredItem(null)}
      >
        <button
          onClick={() => setShowAuthModal(true)}
          className="group relative flex items-center justify-center rounded-lg p-3 text-base font-semibold transition-all duration-200 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/20 w-full"
          title="Sign In"
        >
          <WalletIcon
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
          {hoveredItem === 'Wallet' && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="fixed pointer-events-none"
              style={{ 
                zIndex: 99999,
                left: `${FIXED_WIDTH + 8}px`,
                top: 'auto'
              }}
            >
              <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl border border-green-500/30 whitespace-nowrap text-sm font-medium">
                Sign In
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-gray-900" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showAuthModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[100000] p-4">
          <div className="relative">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute -top-4 -right-4 w-8 h-8 bg-red-500/20 hover:bg-red-500/30 border-2 border-red-500/40 rounded-full flex items-center justify-center text-red-400 font-bold z-10"
            >
              ✕
            </button>
            <WalletAuthButton />
          </div>
        </div>
      )}
    </>
  )
}
