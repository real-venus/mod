'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface ControlPanelContextType {
  isControlPanelCollapsed: boolean
  setIsControlPanelCollapsed: (collapsed: boolean) => void
}

const ControlPanelContext = createContext<ControlPanelContextType | undefined>(undefined)

export function ControlPanelProvider({ children }: { children: ReactNode }) {
  const [isControlPanelCollapsed, setIsControlPanelCollapsed] = useState(false)

  return (
    <ControlPanelContext.Provider value={{ isControlPanelCollapsed, setIsControlPanelCollapsed }}>
      {children}
    </ControlPanelContext.Provider>
  )
}

export function useControlPanelContext() {
  const context = useContext(ControlPanelContext)
  if (!context) throw new Error('useControlPanelContext must be used within ControlPanelProvider')
  return context
}
