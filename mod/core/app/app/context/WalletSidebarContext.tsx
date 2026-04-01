"use client";

import { createContext, useContext, useState, ReactNode } from 'react'

interface WalletSidebarContextType {
  isWalletOpen: boolean
  setIsWalletOpen: (isOpen: boolean) => void
}

const WalletSidebarContext = createContext<WalletSidebarContextType | undefined>(undefined)

export function WalletSidebarProvider({ children }: { children: ReactNode }) {
  const [isWalletOpen, setIsWalletOpen] = useState(false)

  return (
    <WalletSidebarContext.Provider value={{ isWalletOpen, setIsWalletOpen }}>
      {children}
    </WalletSidebarContext.Provider>
  )
}

export function useWalletSidebar() {
  const context = useContext(WalletSidebarContext)
  if (!context) {
    throw new Error('useWalletSidebar must be used within a WalletSidebarProvider')
  }
  return context
}
