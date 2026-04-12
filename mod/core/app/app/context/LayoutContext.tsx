"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { usePathname } from 'next/navigation'

interface LayoutContextType {
  isHeaderMode: boolean
  toggleLayout: () => void
  isHeaderCollapsed: boolean
  setHeaderCollapsed: (collapsed: boolean) => void
  toggleHeaderCollapsed: () => void
  isEditSidebarOpen: boolean
  toggleEditSidebar: () => void
  setEditSidebarOpen: (open: boolean) => void
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined)

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [isHeaderMode, setIsHeaderMode] = useState(true)
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false)
  const [isEditSidebarOpen, setIsEditSidebarOpen] = useState(false)
  const pathname = usePathname()

  // Keep header visible on module pages (module info shows in header)
  useEffect(() => {
    setIsHeaderCollapsed(false)
    setIsEditSidebarOpen(false)
  }, [pathname])

  const toggleLayout = () => {
    setIsHeaderMode(!isHeaderMode)
  }

  const setHeaderCollapsed = (collapsed: boolean) => {
    setIsHeaderCollapsed(collapsed)
  }

  const toggleHeaderCollapsed = () => {
    setIsHeaderCollapsed(prev => !prev)
  }

  const toggleEditSidebar = () => {
    setIsEditSidebarOpen(prev => !prev)
  }

  return (
    <LayoutContext.Provider value={{ isHeaderMode, toggleLayout, isHeaderCollapsed, setHeaderCollapsed, toggleHeaderCollapsed, isEditSidebarOpen, toggleEditSidebar, setEditSidebarOpen: (open: boolean) => setIsEditSidebarOpen(open) }}>
      {children}
    </LayoutContext.Provider>
  )
}

export function useLayoutContext() {
  const context = useContext(LayoutContext)
  if (context === undefined) {
    throw new Error('useLayoutContext must be used within a LayoutProvider')
  }
  return context
}
