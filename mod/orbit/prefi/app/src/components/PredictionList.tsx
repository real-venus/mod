'use client'

import { useAccount } from 'wagmi'
import { usePreFi } from '@/hooks/usePreFi'
import { formatPrice } from '@/lib/contracts'

export default function PredictionList() {
  const { address } = useAccount()
  const { markets, userPredictions, claimReward, isLoading } = usePreFi()

  const getMarketAsset = (marketId: number) => {
    const market = markets.find(m => m.id === marketId)
    return market?.asset || `Market #${marketId}`
  }

  const getStatus = (pred: any) => {
    const market = markets.find(m => m.id === pred.marketId)
    if (!market) return 'active'
    if (!market.settled) return 'active'
    if (pred.claimed) return pred.reward > BigInt(0) ? 'won' : 'lost'
    return 'settled'
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      active: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
      settled: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
      won: 'bg-green-500/20 text-green-300 border-green-500/50',
      lost: 'bg-red-500/20 text-red-300 border-red-500/50',
    }
    const icons: Record<string, string> = {
      active: '⏳',
      settled: '✅',
      won: '🎉',
      lost: '😔',
    }
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${badges[status] || badges.active}`}>
        {icons[status] || '⏳'} {status.toUpperCase()}
      </span>
    )
  }

  const handleClaim = async (marketId: number) => {
    await claimReward(marketId)
  }

  return (
    <div className="glass-card rounded-2xl p-8 card-hover">
      <div className="space-y-6">
        {userPredictions.length > 0 ? (
          <>
            <div className="flex items-center justify-between pb-4 border-b border-gray-700">
              <h3 className="text-lg font-bold text-gray-300">YOUR PREDICTIONS</h3>
              <span className="text-sm text-gray-400">{userPredictions.length} total</span>
            </div>
            <div className="space-y-4">
              {userPredictions.map((pred, idx) => {
                const status = getStatus(pred)
                const canClaim = status === 'settled' && pred.reward > BigInt(0) && !pred.claimed

                return (
                  <div
                    key={`${pred.marketId}-${idx}`}
                    className="glass-card rounded-xl p-5 hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="font-bold text-white">{getMarketAsset(pred.marketId)}</span>
                        <span className="text-xs text-gray-400 ml-2">Market #{pred.marketId}</span>
                      </div>
                      {getStatusBadge(status)}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Predicted Price</div>
                        <div className="text-lg font-bold text-blue-300">
                          ${formatPrice(pred.predictedPrice)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Staked</div>
                        <div className="text-lg font-bold text-green-300">
                          {formatPrice(pred.stakedAmount)}
                        </div>
                      </div>
                    </div>

                    {pred.reward > BigInt(0) && (
                      <div className="mt-3 pt-3 border-t border-gray-700">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm text-gray-400">Reward: </span>
                            <span className="text-lg font-bold gradient-text">
                              +{formatPrice(pred.reward)}
                            </span>
                          </div>
                          {canClaim && (
                            <button
                              onClick={() => handleClaim(pred.marketId)}
                              disabled={isLoading}
                              className="btn-shine text-white font-bold py-2 px-6 rounded-lg text-sm transition transform hover:scale-105 disabled:opacity-50"
                            >
                              {isLoading ? 'Claiming...' : '💰 Claim'}
                            </button>
                          )}
                          {pred.claimed && (
                            <span className="text-xs text-green-400 font-bold">✅ Claimed</span>
                          )}
                        </div>
                      </div>
                    )}

                    {pred.timestamp > 0 && (
                      <div className="mt-2 text-xs text-gray-500">
                        Placed: {new Date(pred.timestamp * 1000).toLocaleString()}
                      </div>
                    )}
                  </div>
                )
              })}
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

      {/* Market Stats */}
      {markets.length > 0 && (
        <div className="mt-8 pt-6 border-t border-gray-700">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">
                {markets.filter(m => !m.settled).length}
              </div>
              <div className="text-xs text-gray-400 mt-1">Active Markets</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">
                {userPredictions.length}
              </div>
              <div className="text-xs text-gray-400 mt-1">Your Predictions</div>
            </div>
            <div className="text-center col-span-2 md:col-span-1">
              <div className="text-2xl font-bold text-purple-400">
                {markets.length}
              </div>
              <div className="text-xs text-gray-400 mt-1">Total Markets</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
