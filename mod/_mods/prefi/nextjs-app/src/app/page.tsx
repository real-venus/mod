'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import PredictionForm from '@/components/PredictionForm'
import PredictionList from '@/components/PredictionList'
import NetworkSelector from '@/components/NetworkSelector'

export default function Home() {
  const { isConnected } = useAccount()

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      <div className="container mx-auto px-4 py-8">
        <header className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
              🎯 Prefi Prediction Market
            </h1>
            <p className="text-gray-400 mt-2">Decentralized price predictions on Base & Ganache</p>
          </div>
          <div className="flex items-center gap-4">
            <NetworkSelector />
            <ConnectButton />
          </div>
        </header>

        {isConnected ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <span className="text-green-400">📊</span>
                Place Prediction
              </h2>
              <PredictionForm />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <span className="text-blue-400">📈</span>
                Your Predictions
              </h2>
              <PredictionList />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-center space-y-4">
              <div className="text-6xl mb-4">🔌</div>
              <h2 className="text-3xl font-bold">Connect Your Wallet</h2>
              <p className="text-gray-400 max-w-md">
                Connect your wallet to start making predictions on asset prices.
                Supports Ganache, Base, and Base Sepolia networks.
              </p>
              <div className="pt-4">
                <ConnectButton />
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}