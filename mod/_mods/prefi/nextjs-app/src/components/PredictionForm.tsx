'use client'

import { useState } from 'react'
import { useAccount, useContractWrite, usePrepareContractWrite } from 'wagmi'
import { parseEther } from 'viem'
import { PREDICTION_MARKET_ABI } from '@/lib/abis'

export default function PredictionForm() {
  const { address } = useAccount()
  const [asset, setAsset] = useState('')
  const [predictedPrice, setPredictedPrice] = useState('')
  const [collateralAmount, setCollateralAmount] = useState('')
  const [lockDuration, setLockDuration] = useState('7')

  const { config } = usePrepareContractWrite({
    address: process.env.NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS as `0x${string}`,
    abi: PREDICTION_MARKET_ABI,
    functionName: 'placePrediction',
    args: [
      asset as `0x${string}`,
      parseEther(predictedPrice || '0'),
      parseEther(collateralAmount || '0'),
      asset as `0x${string}`,
      BigInt(Number(lockDuration) * 24 * 60 * 60),
    ],
    enabled: Boolean(asset && predictedPrice && collateralAmount),
  })

  const { write, isLoading } = useContractWrite(config)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    write?.()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl p-6 border border-gray-700 space-y-4">
      <div>
        <label className="block text-sm font-semibold mb-2 text-gray-300">Asset Address</label>
        <input
          type="text"
          value={asset}
          onChange={(e) => setAsset(e.target.value)}
          placeholder="0x..."
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-green-500 focus:outline-none transition-colors"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2 text-gray-300">Predicted Price (ETH)</label>
        <input
          type="number"
          step="0.000001"
          value={predictedPrice}
          onChange={(e) => setPredictedPrice(e.target.value)}
          placeholder="0.0"
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-green-500 focus:outline-none transition-colors"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2 text-gray-300">Collateral Amount (ETH)</label>
        <input
          type="number"
          step="0.000001"
          value={collateralAmount}
          onChange={(e) => setCollateralAmount(e.target.value)}
          placeholder="0.0"
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-green-500 focus:outline-none transition-colors"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2 text-gray-300">Lock Duration (days)</label>
        <select
          value={lockDuration}
          onChange={(e) => setLockDuration(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-green-500 focus:outline-none transition-colors cursor-pointer"
        >
          <option value="1">1 day</option>
          <option value="7">7 days</option>
          <option value="14">14 days</option>
          <option value="30">30 days</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={isLoading || !write}
        className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
      >
        {isLoading ? '⏳ Placing Prediction...' : '🚀 Place Prediction'}
      </button>
    </form>
  )
}