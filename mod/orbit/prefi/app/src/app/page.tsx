'use client'

import Link from 'next/link'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useNetwork } from 'wagmi'
import PredictionForm from '@/components/PredictionForm'
import PredictionList from '@/components/PredictionList'
import NetworkSelector from '@/components/NetworkSelector'

export default function Home() {
  const { isConnected } = useAccount()
  const { chain } = useNetwork()

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-96 h-96 -top-48 -left-48 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute w-96 h-96 -bottom-48 -right-48 bg-green-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute w-96 h-96 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        <header className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6">
          <div className="text-center md:text-left">
            <Link href="/" className="inline-block cursor-pointer logo-hover">
              <h1 className="text-5xl md:text-6xl font-bold gradient-text mb-3 float">
                🎯 PreFi
              </h1>
            </Link>
            <p className="text-gray-300 text-lg font-medium">
              Decentralized Prediction Market on <span className="text-blue-400 font-bold">Base Mainnet</span>
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Powered by Uniswap V3 Oracle • L2 Distance Scoring
            </p>
          </div>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            {isConnected && chain && (
              <div className="glass-card px-4 py-2 rounded-lg flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-sm font-semibold">{chain.name}</span>
              </div>
            )}
            <NetworkSelector />
            <div className="glow-hover rounded-xl">
              <ConnectButton />
            </div>
          </div>
        </header>

        {isConnected ? (
          <div className="space-y-8">
            {/* Welcome Banner */}
            <div className="glass-card rounded-2xl p-6 border-l-4 border-green-400">
              <div className="flex items-center gap-3">
                <div className="text-3xl">👋</div>
                <div>
                  <h3 className="text-xl font-bold gradient-text">Welcome Back!</h3>
                  <p className="text-gray-300 text-sm">Start making predictions and track your portfolio</p>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-2xl shadow-lg">
                    📊
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold">Place Prediction</h2>
                    <p className="text-gray-400 text-sm">Create a new price prediction</p>
                  </div>
                </div>
                <PredictionForm />
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-2xl shadow-lg">
                    📈
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold">Your Predictions</h2>
                    <p className="text-gray-400 text-sm">Track your active predictions</p>
                  </div>
                </div>
                <PredictionList />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Hero Section */}
            <div className="flex flex-col items-center justify-center py-12">
              <div className="glass-card rounded-3xl p-12 text-center space-y-8 max-w-4xl card-hover">
                <div className="text-8xl mb-6 float">🚀</div>
                <h2 className="text-5xl md:text-6xl font-bold gradient-text leading-tight">
                  Welcome to the Future of Predictions
                </h2>
                <p className="text-gray-300 text-xl max-w-2xl mx-auto leading-relaxed">
                  Connect your wallet to start making price predictions on Base mainnet.
                  Stake tokens, predict prices, and earn rewards based on accuracy.
                </p>
                <div className="pt-4 scale-110">
                  <ConnectButton />
                </div>
              </div>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              <div className="glass-card p-8 rounded-2xl card-hover text-center space-y-4">
                <div className="text-6xl float" style={{ animationDelay: '0s' }}>🎲</div>
                <h3 className="text-2xl font-bold text-blue-400">Predict</h3>
                <p className="text-gray-300 leading-relaxed">
                  Submit price predictions for your favorite tokens using Uniswap V3 Oracle data
                </p>
                <div className="pt-2">
                  <span className="inline-block px-4 py-2 rounded-full bg-blue-500/20 text-blue-300 text-sm font-semibold">
                    Real-time Oracle
                  </span>
                </div>
              </div>

              <div className="glass-card p-8 rounded-2xl card-hover text-center space-y-4">
                <div className="text-6xl float" style={{ animationDelay: '0.5s' }}>💎</div>
                <h3 className="text-2xl font-bold text-green-400">Stake</h3>
                <p className="text-gray-300 leading-relaxed">
                  Lock your collateral tokens to back your predictions and show confidence
                </p>
                <div className="pt-2">
                  <span className="inline-block px-4 py-2 rounded-full bg-green-500/20 text-green-300 text-sm font-semibold">
                    Non-Custodial
                  </span>
                </div>
              </div>

              <div className="glass-card p-8 rounded-2xl card-hover text-center space-y-4">
                <div className="text-6xl float" style={{ animationDelay: '1s' }}>🏆</div>
                <h3 className="text-2xl font-bold text-purple-400">Earn</h3>
                <p className="text-gray-300 leading-relaxed">
                  Win rewards proportional to your prediction accuracy using L2 distance scoring
                </p>
                <div className="pt-2">
                  <span className="inline-block px-4 py-2 rounded-full bg-purple-500/20 text-purple-300 text-sm font-semibold">
                    Fair Rewards
                  </span>
                </div>
              </div>
            </div>

            {/* How It Works */}
            <div className="glass-card rounded-3xl p-10 max-w-4xl mx-auto">
              <h3 className="text-3xl font-bold text-center mb-8 gradient-text">How It Works</h3>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-xl font-bold">
                    1
                  </div>
                  <div>
                    <h4 className="text-xl font-bold mb-2 text-blue-400">Connect Your Wallet</h4>
                    <p className="text-gray-300">Link your Web3 wallet to access the prediction market on Base mainnet</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-xl font-bold">
                    2
                  </div>
                  <div>
                    <h4 className="text-xl font-bold mb-2 text-green-400">Make Predictions</h4>
                    <p className="text-gray-300">Choose a token pair, predict the future price, and stake your collateral</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl font-bold">
                    3
                  </div>
                  <div>
                    <h4 className="text-xl font-bold mb-2 text-purple-400">Earn Rewards</h4>
                    <p className="text-gray-300">Get rewarded based on accuracy when predictions settle using oracle data</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tech Stack */}
            <div className="glass-card rounded-3xl p-10 max-w-6xl mx-auto">
              <h3 className="text-3xl font-bold text-center mb-8 gradient-text">Powered By</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center space-y-2">
                  <div className="text-5xl">⛓️</div>
                  <div className="font-bold text-lg">Base L2</div>
                  <div className="text-sm text-gray-400">Fast & Cheap</div>
                </div>
                <div className="text-center space-y-2">
                  <div className="text-5xl">🦄</div>
                  <div className="font-bold text-lg">Uniswap V3</div>
                  <div className="text-sm text-gray-400">Price Oracle</div>
                </div>
                <div className="text-center space-y-2">
                  <div className="text-5xl">📊</div>
                  <div className="font-bold text-lg">L2 Scoring</div>
                  <div className="text-sm text-gray-400">Fair Algorithm</div>
                </div>
                <div className="text-center space-y-2">
                  <div className="text-5xl">🔐</div>
                  <div className="font-bold text-lg">Smart Contracts</div>
                  <div className="text-sm text-gray-400">Trustless</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Footer */}
        {isConnected && (
          <footer className="mt-16 glass-card rounded-3xl p-10 card-hover">
            <h3 className="text-2xl font-bold text-center mb-8 gradient-text">Platform Features</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="text-center space-y-3">
                <div className="text-4xl">⛓️</div>
                <div className="text-2xl font-bold gradient-text">Base</div>
                <div className="text-sm text-gray-400 leading-relaxed">Lightning-fast L2 network</div>
              </div>
              <div className="text-center space-y-3">
                <div className="text-4xl">🦄</div>
                <div className="text-2xl font-bold text-green-400">Uniswap V3</div>
                <div className="text-sm text-gray-400 leading-relaxed">Reliable price oracle</div>
              </div>
              <div className="text-center space-y-3">
                <div className="text-4xl">📊</div>
                <div className="text-2xl font-bold text-blue-400">L2 Scoring</div>
                <div className="text-sm text-gray-400 leading-relaxed">Fair distance algorithm</div>
              </div>
              <div className="text-center space-y-3">
                <div className="text-4xl">🔒</div>
                <div className="text-2xl font-bold text-purple-400">Decentralized</div>
                <div className="text-sm text-gray-400 leading-relaxed">Non-custodial & secure</div>
              </div>
            </div>
          </footer>
        )}
      </div>
    </main>
  )
}