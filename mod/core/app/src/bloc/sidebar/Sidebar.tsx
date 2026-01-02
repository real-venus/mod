'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {  UsersIcon, CubeIcon,  HomeIcon, Cog6ToothIcon, TableCellsIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useRef, useEffect } from 'react'
import { useSidebarContext } from '@/bloc/context/SidebarContext'
import { useSplitScreenContext } from '@/bloc/context/SplitScreenContext'
import { Squares2X2Icon } from '@heroicons/react/24/outline'

const navigation = [
  { name: 'Chat', href: '/chat', icon: ChatBubbleLeftRightIcon },
  { name: 'Mods', href: '/mod/explore', icon: CubeIcon },
  { name: 'Users', href: '/user/explore', icon: UsersIcon },
  { name: 'Transactions', href: '/host', icon: TableCellsIcon },
]

const FIXED_WIDTH = 80

export function Sidebar() {
  const pathname = usePathname()
  const { isSidebarExpanded, toggleSidebar } = useSidebarContext()
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [showServerSettings, setShowServerSettings] = useState(false)
  const { orientation, setOrientation } = useSplitScreenContext()

  return (
    <>
      <div
        className="fixed"
        style={{ width: FIXED_WIDTH, zIndex: 40 }}
      >
        <div className="flex h-full flex-col relative">
          <nav className="flex-1 px-3 py-4 pt-4 overflow-y-auto space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <div
                  key={item.name}
                  className="relative"
                  onMouseEnter={() => setHoveredItem(item.name)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <Link
                    href={item.href}
                    className={`group relative flex items-center justify-center rounded-lg p-3 text-base font-semibold transition-all duration-200 ${
                      isActive
                        ? 'bg-green-500/20 text-green-400 shadow-lg shadow-green-500/20 border border-green-500/30'
                        : 'text-gray-400 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/20'
                    }`}
                  >
                    <item.icon
                      className="shrink-0 transition-transform duration-200 group-hover:scale-110"
                      style={{
                        color: isActive ? '#4ade80' : '#9ca3af',
                        width: '2.5rem',
                        height: '2.5rem',
                        minWidth: '2.5rem',
                        minHeight: '2.5rem'
                      }}
                      aria-hidden="true"
                    />
                    {isActive && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute inset-0 bg-green-500/10 rounded-lg -z-10"
                        initial={false}
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                  </Link>
                  <AnimatePresence>
                    {hoveredItem === item.name && (
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
                          {item.name}
                          <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-gray-900" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </nav>


        </div>
      </div>

      <style jsx global>{`
        :root {
          --sidebar-width: ${FIXED_WIDTH}px;
        }
      `}</style>
    </>
  )
}
