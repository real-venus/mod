'use client'
import { createContext, useContext, useState, ReactNode } from 'react'

interface LayoutContextType {
  isHeaderMode: boolean
  toggleLayout: () => void
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined)

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [isHeaderMode, setIsHeaderMode] = useState(true)

  const toggleLayout = () => {
    setIsHeaderMode(!isHeaderMode)
  }

  return (
    <LayoutContext.Provider value={{ isHeaderMode, toggleLayout }}>
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