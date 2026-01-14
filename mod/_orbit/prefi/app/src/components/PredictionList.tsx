'use client'

import { useAccount, useContractRead } from 'wagmi'
import { PREDICTION_MARKET_ABI } from '@/lib/abis'

export default function PredictionList() {
  const { address } = useAccount()

  const { data: predictionCounter } = useContractRead({
    address: process.env.NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS as `0x${string}`,
    abi: PREDICTION_MARKET_ABI,
    functionName: 'predictionCounter',
  })

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <div className="space-y-4">
        {predictionCounter && Number(predictionCounter) > 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">Total Predictions: {Number(predictionCounter)}</p>
            <p className="text-sm text-gray-500 mt-2">Prediction history coming soon...</p>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📭</div>
            <p className="text-gray-400">No predictions yet</p>
            <p className="text-sm text-gray-500 mt-2">Place your first prediction to get started!</p>
          </div>
        )}
      </div>
    </div>
  )
}