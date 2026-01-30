'use client'
import { createContext, useContext, useState, ReactNode } from 'react'

interface HeaderModeContextType {
  headerMode: 'top' | 'sidebar'
  toggleHeaderMode: () => void
  setHeaderMode: (mode: 'top' | 'sidebar') => void
}

const HeaderModeContext = createContext<HeaderModeContextType | undefined>(undefined)

export function HeaderModeProvider({ children }: { children: ReactNode }) {
  const [headerMode, setHeaderMode] = useState<'top' | 'sidebar'>('top')

  const toggleHeaderMode = () => {
    setHeaderMode(prev => prev === 'top' ? 'sidebar' : 'top')
  }

  return (
    <HeaderModeContext.Provider value={{ headerMode, toggleHeaderMode, setHeaderMode }}>
      {children}
    </HeaderModeContext.Provider>
  )
}

export function useHeaderMode() {
  const context = useContext(HeaderModeContext)
  if (context === undefined) {
    throw new Error('useHeaderMode must be used within a HeaderModeProvider')
  }
  return context
}
