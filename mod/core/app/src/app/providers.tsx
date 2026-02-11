"use client"

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { CubeIcon } from '@heroicons/react/24/outline'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import Header from '@/header/Header'
import { WalletHeader } from '@/wallet/WalletHeader'
import { NetworkSelector } from '@/network/NetworkSelector'
import { UserProvider } from '@/context'
import { SearchProvider } from '@/context/SearchContext'
import {
  SplitScreenProvider,
  useSplitScreenContext,
} from '@/context/SplitScreenContext'
import { ControlPanelProvider } from '@/context/ControlPanelContext'
import { MarketCreditProvider } from '@/context/MarketCreditContext'
import {
  LayoutProvider,
  useLayoutContext,
} from '@/context/LayoutContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { SplitScreenControls } from '@/components/SplitScreenControls'

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
      {/* Left sidebar with header items */}
      <div
        className="fixed left-0 top-0 h-full flex flex-col items-center py-4 gap-3 border-r-2"
        style={{ width: '80px', zIndex: 50, borderColor: 'rgba(0, 255, 0, 0.25)' }}
      >
        {/* Logo at top */}
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
                {isHeaderCollapsed ? 'EXPAND SIDEBAR' : 'COLLAPSE SIDEBAR'}
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-gray-900" />
              </motion.div>
            )}
          </motion.div>
        </button>

        {/* Header navigation items */}
        {!isHeaderCollapsed && (
          <div className="flex flex-col gap-3 mt-4">
            <Header />
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />
      </div>

      {/* Top right - Network and Wallet */}
      <div className="fixed top-4 right-4 z-[70] flex items-center gap-3">
        <WalletHeader />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col" style={{ marginLeft: '80px' }}>
        <main className="flex-1 overflow-auto flex">
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
    <ThemeProvider>
      <UserProvider>
        <MarketCreditProvider>
          <SearchProvider>
            <SplitScreenProvider>
              <ControlPanelProvider>
                <LayoutProvider>
                  <LayoutContent>{children}</LayoutContent>
                  <ToastContainer
                    position="bottom-right"
                    autoClose={3000}
                    hideProgressBar={false}
                    newestOnTop={true}
                    closeOnClick
                    rtl={false}
                    pauseOnFocusLoss
                    draggable
                    pauseOnHover
                    theme="dark"
                    style={{ zIndex: 9999 }}
                  />
                </LayoutProvider>
              </ControlPanelProvider>
            </SplitScreenProvider>
          </SearchProvider>
        </MarketCreditProvider>
      </UserProvider>
    </ThemeProvider>
  )
}
