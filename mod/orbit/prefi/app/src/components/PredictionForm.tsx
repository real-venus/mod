'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { usePreFi } from '@/hooks/usePreFi'

interface PredictionFormProps {
  selectedMarketId?: number | null
  onPredictionPlaced?: () => void
}

export default function PredictionForm({ selectedMarketId, onPredictionPlaced }: PredictionFormProps) {
  const { address } = useAccount()
  const { markets, placePrediction, isLoading, getTokenBalance } = usePreFi()
  const [predictedPrice, setPredictedPrice] = useState('')
  const [collateralAmount, setCollateralAmount] = useState('')
  const [marketId, setMarketId] = useState<number | null>(null)
  const [balance, setBalance] = useState('0')

  const activeMarkets = markets.filter(m => !m.settled && m.endTime > Date.now() / 1000)

  useEffect(() => {
    if (selectedMarketId) {
      setMarketId(selectedMarketId)
    } else if (activeMarkets.length > 0 && !marketId) {
      setMarketId(activeMarkets[0].id)
    }
  }, [selectedMarketId, activeMarkets.length])

  useEffect(() => {
    if (address) {
      getTokenBalance().then(setBalance)
    }
  }, [address])

  const selectedMarket = markets.find(m => m.id === marketId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!marketId || !predictedPrice || !collateralAmount) return

    const success = await placePrediction(marketId, predictedPrice, collateralAmount)
    if (success) {
      setPredictedPrice('')
      setCollateralAmount('')
      onPredictionPlaced?.()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-8 space-y-6 card-hover">
      {/* Market selector */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-bold text-gray-300 uppercase tracking-wide">
          <span>🎯</span> Select Market
        </label>
        {activeMarkets.length > 0 ? (
          <select
            value={marketId || ''}
            onChange={(e) => setMarketId(Number(e.target.value))}
            className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-5 py-4 text-white text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 focus:outline-none transition-all"
          >
            {activeMarkets.map(m => (
              <option key={m.id} value={m.id}>
                #{m.id} — {m.asset}
              </option>
            ))}
          </select>
        ) : (
          <div className="bg-gray-900/50 border border-gray-700 rounded-xl px-5 py-4 text-gray-500">
            No active markets available
          </div>
        )}
      </div>

      {selectedMarket && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-400">Asset:</span>
              <span className="ml-2 font-bold text-blue-300">{selectedMarket.asset}</span>
            </div>
            <div>
              <span className="text-gray-400">Ends:</span>
              <span className="ml-2 font-bold text-green-300">
                {new Date(selectedMarket.endTime * 1000).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-bold text-gray-300 uppercase tracking-wide">
          <span>💰</span> Predicted Price
        </label>
        <div className="relative">
          <input
            type="number"
            step="0.000001"
            value={predictedPrice}
            onChange={(e) => setPredictedPrice(e.target.value)}
            placeholder="0.0"
            className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-5 py-4 text-white text-lg placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 focus:outline-none transition-all"
            required
          />
          <span className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">
            USD
          </span>
        </div>
        <p className="text-xs text-gray-500 pl-1">Enter your price prediction for this market</p>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-bold text-gray-300 uppercase tracking-wide">
          <span>🔒</span> Stake Amount
        </label>
        <div className="relative">
          <input
            type="number"
            step="0.000001"
            value={collateralAmount}
            onChange={(e) => setCollateralAmount(e.target.value)}
            placeholder="0.0"
            className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-5 py-4 text-white text-lg placeholder-gray-500 focus:border-green-500 focus:ring-2 focus:ring-green-500/50 focus:outline-none transition-all"
            required
          />
          <span className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">
            TOKEN
          </span>
        </div>
        <p className="text-xs text-gray-500 pl-1">
          Balance: {parseFloat(balance).toFixed(4)} tokens — Higher stakes increase your potential rewards
        </p>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">ℹ️</span>
          <div className="flex-1">
            <h4 className="font-bold text-blue-300 mb-1">L2 Distance Scoring</h4>
            <p className="text-sm text-gray-300">
              Score = stake / (1 + distance²). The closer your prediction to the actual price, the higher your share of the reward pool.
            </p>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading || !predictedPrice || !collateralAmount || !marketId}
        className="w-full btn-shine text-white font-bold py-4 px-8 rounded-xl transition-all transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed disabled:opacity-50 shadow-lg hover:shadow-xl disabled:shadow-none"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Placing Prediction...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            🚀 Place Prediction
          </span>
        )}
      </button>

      <div className="text-center">
        <p className="text-xs text-gray-500">
          By placing a prediction, you agree to lock your collateral until market settlement
        </p>
      </div>
    </form>
  )
}
