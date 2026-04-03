'use client'

import { useAccount } from 'wagmi'
import { useState, useEffect } from 'react'

interface Prediction {
  id: string
  predictedPrice: string
  collateralAmount: string
  timestamp: number
  status: 'active' | 'settled' | 'won' | 'lost'
  reward?: string
}

export default function PredictionList() {
  const { address } = useAccount()
  const [predictions, setPredictions] = useState<Prediction[]>([])

  // TODO: Fetch actual predictions from contract
  useEffect(() => {
    // Mock data for demonstration
    const mockPredictions: Prediction[] = []
    setPredictions(mockPredictions)
  }, [address])

  const getStatusBadge = (status: Prediction['status']) => {
    const badges = {
      active: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
      settled: 'bg-gray-500/20 text-gray-300 border-gray-500/50',
      won: 'bg-green-500/20 text-green-300 border-green-500/50',
      lost: 'bg-red-500/20 text-red-300 border-red-500/50',
    }
    const icons = {
      active: '⏳',
      settled: '✓',
      won: '🎉',
      lost: '😔',
    }
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${badges[status]}`}>
        {icons[status]} {status.toUpperCase()}
      </span>
    )
  }

  return (
    <div className="glass-card rounded-2xl p-8 card-hover">
      <div className="space-y-6">
        {predictions.length > 0 ? (
          <>
            <div className="flex items-center justify-between pb-4 border-b border-gray-700">
              <h3 className="text-lg font-bold text-gray-300">RECENT PREDICTIONS</h3>
              <span className="text-sm text-gray-400">{predictions.length} total</span>
            </div>
            <div className="space-y-4">
              {predictions.map((prediction) => (
                <div
                  key={prediction.id}
                  className="glass-card rounded-xl p-5 hover:bg-white/10 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-400">
                      {new Date(prediction.timestamp).toLocaleDateString()}
                    </span>
                    {getStatusBadge(prediction.status)}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Predicted Price</div>
                      <div className="text-lg font-bold text-blue-300">
                        ${prediction.predictedPrice}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Collateral</div>
                      <div className="text-lg font-bold text-green-300">
                        {prediction.collateralAmount} ETH
                      </div>
                    </div>
                  </div>
                  {prediction.reward && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Reward</span>
                        <span className="text-lg font-bold gradient-text">
                          +{prediction.reward} ETH
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <div className="mb-6 float">
              <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-5xl">
                📭
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-3 gradient-text">No Predictions Yet</h3>
            <p className="text-gray-400 mb-6 max-w-sm mx-auto">
              Start your prediction journey! Place your first prediction to see it here.
            </p>
            <div className="glass-card inline-block px-6 py-3 rounded-xl">
              <div className="flex items-center gap-2 text-sm">
                <span>💡</span>
                <span className="text-gray-300">Tip: Higher stakes = higher potential rewards</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Current Epoch Info */}
      <div className="mt-8 pt-6 border-t border-gray-700">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">Epoch #1</div>
            <div className="text-xs text-gray-400 mt-1">Current Round</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">24h</div>
            <div className="text-xs text-gray-400 mt-1">Time Remaining</div>
          </div>
          <div className="text-center col-span-2 md:col-span-1">
            <div className="text-2xl font-bold text-purple-400">0 ETH</div>
            <div className="text-xs text-gray-400 mt-1">Total Pool</div>
          </div>
        </div>
      </div>
    </div>
  )
}