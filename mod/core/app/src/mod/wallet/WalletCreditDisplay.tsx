'use client'

import { useMarketCredit } from '@/mod/context/MarketCreditContext'
import { userContext } from '@/mod/context/UserContext'
import { CoinsIcon } from '@heroicons/react/24/outline'
import { useState, useContext } from 'react'
import { useRouter } from 'next/navigation'

export default function WalletCreditDisplay() {
  const { marketCredit, loading } = useMarketCredit()
  const { user } = userContext()
  const [showValue, setShowValue] = useState(false)
  const router = useRouter()

  const handleClick = () => {
    if (user?.key) {
      router.push(`/user/${user.key}/billing`)
    }
  }

  if (loading) {
    return (
      <div
        className="flex items-center gap-2 px-4 py-2 bg-black/50 border border-white/20 rounded-lg"
        style={{ height: '60px' }}
      >
        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        <span className="text-white/70 text-sm font-mono">Loading...</span>
      </div>
    )
  }

  return (
    <div
      onMouseEnter={() => setShowValue(true)}
      onMouseLeave={() => setShowValue(false)}
      onClick={handleClick}
      className="relative flex items-center gap-2 px-4 py-2 bg-black/50 border border-green-500/40 rounded-lg hover:border-green-500/60 transition-all cursor-pointer hover:scale-105 active:scale-95"
      style={{ height: '60px', minWidth: '60px' }}
    >
      <div className="w-8 h-8 flex items-center justify-center bg-green-500/20 border-2 border-green-500/60 rounded-lg hover:bg-green-500/30 transition-all">
        <CoinsIcon className="w-5 h-5 text-green-400" />
      </div>

      {showValue && (
        <div className="flex flex-col">
          <span className="text-xs text-white/50 uppercase font-bold">
            Market Credit
          </span>
          <span className="text-sm text-green-400 font-mono font-bold">
            {marketCredit.toFixed(2)} USDC
          </span>
        </div>
      )}
    </div>
  )
}
