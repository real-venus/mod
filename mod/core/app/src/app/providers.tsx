"use client"

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { CubeIcon } from '@heroicons/react/24/outline'

import { Header } from '@/mod/header/Header'
import { UserProvider } from '@/mod/context'
import { SearchProvider } from '@/mod/context/SearchContext'
import {
  SplitScreenProvider,
  useSplitScreenContext,
} from '@/mod/context/SplitScreenContext'
import { ControlPanelProvider } from '@/mod/context/ControlPanelContext'
import { MarketCreditProvider } from '@/mod/context/MarketCreditContext'
import {
  LayoutProvider,
  useLayoutContext,
} from '@/mod/context/LayoutContext'
import { SplitScreenControls } from '@/mod/components/SplitScreenControls'

function LayoutContent({ children }: { children: React.ReactNode }) {
  const {
    isSplitScreen,
    leftPanelUrl,
    rightPanelUrl,
    setLeftPanelUrl,
    orientation,
    isCollapsed,
  } = useSplitScreenContext()

  const { isHeaderMode } = useLayoutContext()
  const pathname = usePathname()

  const [hoveredLogo, setHoveredLogo] = useState(false)
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false)

  useEffect(() => {
    if (isSplitScreen && leftPanelUrl === pathname) {
      setLeftPanelUrl(pathname)
    }
  }, [pathname, isSplitScreen, leftPanelUrl, setLeftPanelUrl])

  const isVertical = orientation === 'vertical'
  const containerClass = isVertical ? 'flex' : 'flex flex-col'
  const panelClass = 'flex-1'
  const borderClass = isVertical
    ? 'border-r-2 border-green-500/30'
    : 'border-b-2 border-green-500/30'

  return (
    <div className="flex h-screen bg-black">
      {/* Left logo rail */}
      <div
        className="fixed left-0 top-0 h-full flex items-start justify-center pt-4"
        style={{ width: '80px', zIndex: 50 }}
      >
        <button onClick={() => setIsHeaderCollapsed(v => !v)}>
          <motion.div
            className="relative cursor-pointer"
            onMouseEnter={() => setHoveredLogo(true)}
            onMouseLeave={() => setHoveredLogo(false)}
            whileHover={{ scale: 1.1, rotate: 180 }}
            transition={{ duration: 0.3 }}
          >
            <CubeIcon
              className="w-12 h-12 text-green-400"
              style={{
                filter: 'drop-shadow(0 0 8px rgba(74, 222, 128, 0.6))',
              }}
            />

            {hoveredLogo && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl border border-green-500/30 whitespace-nowrap text-sm font-medium pointer-events-none"
              >
                {isHeaderCollapsed ? 'EXPAND HEADER' : 'COLLAPSE HEADER'}
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-gray-900" />
              </motion.div>
            )}
          </motion.div>
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col" style={{ marginLeft: '80px' }}>
        {isHeaderMode && !isHeaderCollapsed && <Header />}

        <main className="flex-1 overflow-hidden flex">
          {isSplitScreen ? (
            <div className={`w-full h-full ${containerClass}`}>
              <div
                className={`${isCollapsed ? 'hidden' : panelClass} overflow-auto ${borderClass}`}
              >
                {children}
              </div>

              <div className={`${panelClass} overflow-auto`}>
                <iframe
                  src={rightPanelUrl}
                  className="w-full h-full border-0"
                  title="Split Screen Panel"
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">{children}</div>
          )}
        </main>

        <SplitScreenControls />
      </div>
    </div>
  )
}

export default function Providers({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <UserProvider>
      <MarketCreditProvider>
        <SearchProvider>
          <SplitScreenProvider>
            <ControlPanelProvider>
              <LayoutProvider>
                <LayoutContent>{children}</LayoutContent>
              </LayoutProvider>
            </ControlPanelProvider>
          </SplitScreenProvider>
        </SearchProvider>
      </MarketCreditProvider>
    </UserProvider>
  )
}
