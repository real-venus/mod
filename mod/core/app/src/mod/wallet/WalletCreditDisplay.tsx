'use client'

import { useMarketCredit } from '@/mod/context/MarketCreditContext'
import { useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { text2color } from '@/mod/utils'
import { userContext } from '@/mod/context/UserContext'

type TokenType = 'USDC' | 'USDT' | 'MARKET'

export default function WalletCreditDisplay() {
  const { user } = userContext()
  const { marketCredit, loading, refreshCredit } = useMarketCredit()
  const [selectedToken, setSelectedToken] = useState<TokenType>('USDC')
  const [isRefreshing, setIsRefreshing] = useState(false)

  if (!user) return null

  const userColor = text2color(user.key)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refreshCredit()
    setIsRefreshing(false)
  }

  const handleTokenToggle = (token: TokenType) => {
    setSelectedToken(token)
    refreshCredit()
  }

  return (
    <div className="p-3 rounded-lg border-2 transition-all hover:bg-white/5" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', borderColor: `${userColor}60` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-400 font-bold uppercase tracking-wider">Market Balance</div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <button
              onClick={() => handleTokenToggle('USDC')}
              className={`px-2 py-1 text-xs font-bold rounded transition-all ${
                selectedToken === 'USDC'
                  ? 'bg-opacity-30 border'
                  : 'bg-opacity-10 border border-transparent hover:border-white/20'
              }`}
              style={{
                backgroundColor: selectedToken === 'USDC' ? `${userColor}30` : `${userColor}10`,
                borderColor: selectedToken === 'USDC' ? userColor : 'transparent',
                color: userColor
              }}
            >
              USDC
            </button>
            <button
              onClick={() => handleTokenToggle('USDT')}
              className={`px-2 py-1 text-xs font-bold rounded transition-all ${
                selectedToken === 'USDT'
                  ? 'bg-opacity-30 border'
                  : 'bg-opacity-10 border border-transparent hover:border-white/20'
              }`}
              style={{
                backgroundColor: selectedToken === 'USDT' ? `${userColor}30` : `${userColor}10`,
                borderColor: selectedToken === 'USDT' ? userColor : 'transparent',
                color: userColor
              }}
            >
              USDT
            </button>

            <button
              onClick={() => handleTokenToggle('MARKET')}
              className={`px-2 py-1 text-xs font-bold rounded transition-all ${
                selectedToken === 'MARKET'
                  ? 'bg-opacity-30 border'
                  : 'bg-opacity-10 border border-transparent hover:border-white/20'
              }`}
              style={{
                backgroundColor: selectedToken === 'MARKET' ? `${userColor}30` : `${userColor}10`,
                borderColor: selectedToken === 'MARKET' ? userColor : 'transparent',
                color: userColor
              }}
            >
              MARKET
            </button>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || loading}
            className="flex items-center gap-1 px-2 py-1 rounded border transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            style={{ borderColor: userColor, color: userColor }}
            title="Refresh Balance"
          >
            <ArrowPathIcon className={`w-4 h-4 ${isRefreshing || loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      <div className="font-mono text-lg font-bold" style={{ color: userColor }}>
        {loading ? 'Loading...' : `${marketCredit.toLocaleString()} ${selectedToken}`}
      </div>
    </div>
  )
}
