"use client"

import TradersInterface from '@/traders/TradersInterface'

export const dynamic = 'force-dynamic'

export default function TradersPage() {
  return (
    <div className="h-full pt-20">
      <TradersInterface />
    </div>
  )
}
