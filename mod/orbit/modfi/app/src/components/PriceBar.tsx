'use client'

import { usePrices } from '@/hooks/usePrices'

const DISPLAY_TOKENS = ['ETH', 'USDC', 'USDT']

export function PriceBar() {
  const { data: prices, isLoading } = usePrices()

  return (
    <div className="flex items-center gap-6 px-6 py-2 border-b border-modfi-border text-sm">
      {DISPLAY_TOKENS.map(token => (
        <div key={token} className="flex items-center gap-2">
          <span className="text-modfi-muted">{token}</span>
          <span className="font-mono text-modfi-text">
            {isLoading || !prices ? '...' : `$${(prices[token] || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </span>
        </div>
      ))}
    </div>
  )
}
