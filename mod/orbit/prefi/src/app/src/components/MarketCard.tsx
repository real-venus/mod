'use client'

import { motion } from 'framer-motion'
import { formatPrice } from '@/lib/contracts'

interface MarketCardProps {
  market: {
    id: number
    asset: string
    startTime: number
    endTime: number
    settled: boolean
    actualPrice: bigint
    totalStaked: bigint
    playersCount: number
  }
  onPredict?: () => void
}

export default function MarketCard({ market, onPredict }: MarketCardProps) {
  const timeLeft = Math.max(0, market.endTime - Date.now() / 1000)
  const hours = Math.floor(timeLeft / 3600)
  const minutes = Math.floor((timeLeft % 3600) / 60)

  const isActive = !market.settled && timeLeft > 0

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      className={`glass-card rounded-2xl p-6 border-l-4 ${
        isActive ? 'border-green-400' : market.settled ? 'border-blue-400' : 'border-gray-600'
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-2xl font-bold gradient-text mb-1">{market.asset}</h3>
          <p className="text-sm text-gray-400">Market #{market.id}</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
          isActive ? 'bg-green-500/20 text-green-300' :
          market.settled ? 'bg-blue-500/20 text-blue-300' :
          'bg-gray-500/20 text-gray-400'
        }`}>
          {isActive ? '🟢 Active' : market.settled ? '✅ Settled' : '⏸️ Closed'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Total Staked</div>
          <div className="text-lg font-bold text-green-400">
            {formatPrice(market.totalStaked, 18)} ETH
          </div>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Participants</div>
          <div className="text-lg font-bold text-blue-400">
            {market.playersCount} 👥
          </div>
        </div>
      </div>

      {market.settled ? (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="text-sm text-gray-300 mb-1">Final Price</div>
          <div className="text-2xl font-bold text-blue-300">
            ${formatPrice(market.actualPrice, 18)}
          </div>
        </div>
      ) : isActive ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Time Remaining</span>
            <span className="font-bold text-green-400">
              {hours}h {minutes}m
            </span>
          </div>
          {onPredict && (
            <button
              onClick={onPredict}
              className="w-full btn-shine text-white font-bold py-3 px-6 rounded-xl transition transform hover:scale-105"
            >
              📊 Make Prediction
            </button>
          )}
        </div>
      ) : (
        <div className="text-center py-3 text-gray-500">
          Market ended, waiting for settlement
        </div>
      )}
    </motion.div>
  )
}
