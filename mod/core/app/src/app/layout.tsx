'use client'

import './globals.css'
import { Inter } from 'next/font/google'
import { Sidebar } from '@/bloc/sidebar/Sidebar'
import { Header } from '@/bloc/header/Header'
import { UserProvider } from '@/bloc/context'
import { SearchProvider } from '@/bloc/context/SearchContext'
import { SidebarProvider } from '@/bloc/context/SidebarContext'
import { SplitScreenProvider, useSplitScreenContext } from '@/bloc/context/SplitScreenContext'
import { ControlPanelProvider } from '@/bloc/context/ControlPanelContext'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { SplitScreenControls } from '@/bloc/components/SplitScreenControls'
import  GlobalControlPanel  from '@/bloc/components/GlobalControlPanel'

const inter = Inter({ subsets: ['latin'] })

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isSplitScreen, leftPanelUrl, rightPanelUrl, setLeftPanelUrl, setRightPanelUrl, orientation, isCollapsed } = useSplitScreenContext()
  const pathname = usePathname()

  useEffect(() => {
    if (isSplitScreen && leftPanelUrl === pathname) {
      setLeftPanelUrl(pathname)
    }
  }, [pathname])

  const isVertical = orientation === 'vertical'
  const containerClass = isVertical ? 'flex' : 'flex flex-col'
  const panelClass = isVertical ? 'flex-1' : 'flex-1'
  const borderClass = isVertical ? 'border-r-2 border-green-500/30' : 'border-b-2 border-green-500/30'

  return (
    <div className="flex h-screen bg-black">
      <Sidebar />
      <div className="flex-1 flex flex-col" style={{ marginLeft: '80px' }}>
        <Header />
        <main className="flex-1 overflow-hidden flex">
          {isSplitScreen ? (
            <div className={`w-full h-full ${containerClass}`}>
              <div className={`${isCollapsed ? 'hidden' : panelClass} overflow-auto ${borderClass}`}>
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
            <div className="flex-1 overflow-auto">
              {children}
            </div>
          )}
        </main>
        <SplitScreenControls />
        {/* <GlobalControlPanel /> */}
      </div>
    </div>
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <UserProvider>
          <SearchProvider>
            <SidebarProvider>
              <SplitScreenProvider>
                <ControlPanelProvider>
                  <LayoutContent>{children}</LayoutContent>
                </ControlPanelProvider>
              </SplitScreenProvider>
            </SidebarProvider>
          </SearchProvider>
        </UserProvider>
      </body>
    </html>
  )
}
