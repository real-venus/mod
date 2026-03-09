'use client'

import { motion } from 'framer-motion'

interface PriceChartProps {
  asset: string
  currentPrice?: string
}

export default function PriceChart({ asset, currentPrice }: PriceChartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl p-6 col-span-full"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold gradient-text">{asset} Price</h3>
          <p className="text-sm text-gray-400">Real-time Uniswap V3 Oracle</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-400">Current Price</div>
          <div className="text-3xl font-bold text-green-400">
            ${currentPrice || '—'}
          </div>
        </div>
      </div>

      {/* Placeholder chart */}
      <div className="h-64 bg-gray-900/50 rounded-xl border border-gray-700 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-6xl">📈</div>
          <div className="text-gray-400">
            Live price chart powered by Uniswap V3 Oracle
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-4">
        <div className="text-center p-3 bg-gray-900/30 rounded-lg">
          <div className="text-xs text-gray-400 mb-1">24h High</div>
          <div className="text-lg font-bold text-green-400">—</div>
        </div>
        <div className="text-center p-3 bg-gray-900/30 rounded-lg">
          <div className="text-xs text-gray-400 mb-1">24h Low</div>
          <div className="text-lg font-bold text-red-400">—</div>
        </div>
        <div className="text-center p-3 bg-gray-900/30 rounded-lg">
          <div className="text-xs text-gray-400 mb-1">24h Change</div>
          <div className="text-lg font-bold text-blue-400">—</div>
        </div>
      </div>
    </motion.div>
  )
}
