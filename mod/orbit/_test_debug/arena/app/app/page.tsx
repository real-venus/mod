'use client'

import { useWallet } from './providers'
import { Leaderboard } from '@/components/Leaderboard'
import { LiquidityPool } from '@/components/LiquidityPool'
import { useState } from 'react'

export default function Home() {
  const { address, isConnected, connect, disconnect } = useWallet()
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'pool'>('leaderboard')

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black">
      <nav className="border-b border-purple-500/30 bg-black/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
                Arena
              </h1>
              <div className="flex space-x-4">
                <button
                  onClick={() => setActiveTab('leaderboard')}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    activeTab === 'leaderboard'
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Leaderboard
                </button>
                <button
                  onClick={() => setActiveTab('pool')}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    activeTab === 'pool'
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Liquidity Pool
                </button>
              </div>
            </div>
            <div>
              {isConnected ? (
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-300">
                    {address?.substring(0, 6)}...{address?.substring(address.length - 4)}
                  </span>
                  <button
                    onClick={disconnect}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={connect}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-semibold transition-all transform hover:scale-105"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!isConnected ? (
          <div className="text-center py-20">
            <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-12 max-w-md mx-auto">
              <h2 className="text-3xl font-bold text-white mb-4">Welcome to Arena</h2>
              <p className="text-gray-300 mb-8">
                Connect your wallet to view the leaderboard and participate in agent competitions
              </p>
              <button
                onClick={connect}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-semibold transition-all transform hover:scale-105"
              >
                Connect MetaMask
              </button>
            </div>
          </div>
        ) : (
          <div>
            {activeTab === 'leaderboard' && <Leaderboard />}
            {activeTab === 'pool' && <LiquidityPool />}
          </div>
        )}
      </div>
    </main>
  )
}
