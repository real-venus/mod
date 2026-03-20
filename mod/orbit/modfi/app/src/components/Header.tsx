'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'

export function Header() {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-modfi-border">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold bg-gradient-to-r from-modfi-purple to-modfi-violet bg-clip-text text-transparent">
          ModFi
        </h1>
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
          Base
        </span>
      </div>
      <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
    </header>
  )
}
