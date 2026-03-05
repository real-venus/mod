'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Users, TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react';
import { toast } from 'react-toastify';

interface TraderData {
  address: string;
  rank?: number;
  pnl?: number;
  roi?: number;
  volume?: number;
  trades?: number;
  winRate?: number;
  [key: string]: any;
}

export default function Traders() {
  const [traders, setTraders] = useState<TraderData[]>([]);
  const [selectedTrader, setSelectedTrader] = useState<TraderData | null>(null);
  const [traderDetails, setTraderDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [leaderboardType, setLeaderboardType] = useState<'pnl' | 'roi' | 'volume'>('pnl');

  useEffect(() => {
    fetchLeaderboard();
  }, [leaderboardType]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const data = await api.getLeaderboard(leaderboardType);
      setTraders(data?.slice(0, 20) || []);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      toast.error('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTrader = async (trader: TraderData) => {
    setSelectedTrader(trader);
    try {
      const details = await api.analyzeTrader(trader.address);
      setTraderDetails(details);
    } catch (error) {
      console.error('Error fetching trader details:', error);
      toast.error('Failed to load trader details');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-2xl font-bold text-white mb-6">Leaderboard</h2>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 bg-gray-800 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Traders Leaderboard */}
      <div className="lg:col-span-2">
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
              <Users className="w-6 h-6 text-blue-500" />
              <span>Top Traders</span>
            </h2>

            <div className="flex space-x-2">
              {[
                { value: 'pnl' as const, label: 'PnL' },
                { value: 'roi' as const, label: 'ROI' },
                { value: 'volume' as const, label: 'Volume' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setLeaderboardType(option.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    leaderboardType === option.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {traders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No traders found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {traders.map((trader, idx) => {
                const rank = trader.rank || idx + 1;
                return (
                  <div
                    key={trader.address || idx}
                    onClick={() => handleSelectTrader(trader)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedTrader?.address === trader.address
                        ? 'bg-blue-900/20 border-blue-600'
                        : 'bg-gray-800 border-gray-700 hover:border-blue-500'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      {/* Rank */}
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        rank === 1 ? 'bg-yellow-500 text-black' :
                        rank === 2 ? 'bg-gray-400 text-black' :
                        rank === 3 ? 'bg-orange-600 text-white' :
                        'bg-gray-700 text-gray-300'
                      }`}>
                        {rank}
                      </div>

                      {/* Address */}
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium truncate">
                          {trader.address}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center space-x-6">
                        {trader.pnl !== undefined && (
                          <div className="text-right">
                            <div className="text-xs text-gray-500">PnL</div>
                            <div className={`font-semibold ${
                              trader.pnl >= 0 ? 'text-green-500' : 'text-red-500'
                            }`}>
                              ${Math.abs(trader.pnl).toLocaleString()}
                            </div>
                          </div>
                        )}

                        {trader.roi !== undefined && (
                          <div className="text-right">
                            <div className="text-xs text-gray-500">ROI</div>
                            <div className={`font-semibold ${
                              trader.roi >= 0 ? 'text-green-500' : 'text-red-500'
                            }`}>
                              {trader.roi.toFixed(2)}%
                            </div>
                          </div>
                        )}

                        {trader.volume !== undefined && (
                          <div className="text-right">
                            <div className="text-xs text-gray-500">Volume</div>
                            <div className="text-white font-semibold">
                              ${trader.volume.toLocaleString()}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Trader Details */}
      <div>
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 sticky top-6">
          {selectedTrader ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-white mb-2">Trader Profile</h3>
                <p className="text-xs text-gray-400 break-all">{selectedTrader.address}</p>
              </div>

              {traderDetails ? (
                <div className="space-y-4">
                  {/* Stats Grid */}
                  {traderDetails.stats && (
                    <div className="grid grid-cols-2 gap-3">
                      {traderDetails.stats.pnl !== undefined && (
                        <div className="bg-gray-800 p-3 rounded-lg">
                          <div className="text-xs text-gray-500 mb-1">Total PnL</div>
                          <div className={`text-lg font-bold ${
                            traderDetails.stats.pnl >= 0 ? 'text-green-500' : 'text-red-500'
                          }`}>
                            ${Math.abs(traderDetails.stats.pnl).toLocaleString()}
                          </div>
                        </div>
                      )}

                      {traderDetails.stats.roi !== undefined && (
                        <div className="bg-gray-800 p-3 rounded-lg">
                          <div className="text-xs text-gray-500 mb-1">ROI</div>
                          <div className={`text-lg font-bold ${
                            traderDetails.stats.roi >= 0 ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {traderDetails.stats.roi.toFixed(2)}%
                          </div>
                        </div>
                      )}

                      {traderDetails.stats.volume !== undefined && (
                        <div className="bg-gray-800 p-3 rounded-lg">
                          <div className="text-xs text-gray-500 mb-1">Volume</div>
                          <div className="text-white text-lg font-bold">
                            ${traderDetails.stats.volume.toLocaleString()}
                          </div>
                        </div>
                      )}

                      {traderDetails.stats.trades !== undefined && (
                        <div className="bg-gray-800 p-3 rounded-lg">
                          <div className="text-xs text-gray-500 mb-1">Trades</div>
                          <div className="text-white text-lg font-bold">
                            {traderDetails.stats.trades}
                          </div>
                        </div>
                      )}

                      {traderDetails.stats.winRate !== undefined && (
                        <div className="bg-gray-800 p-3 rounded-lg col-span-2">
                          <div className="text-xs text-gray-500 mb-1">Win Rate</div>
                          <div className="text-white text-lg font-bold">
                            {traderDetails.stats.winRate.toFixed(2)}%
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Current Positions */}
                  {traderDetails.state?.assetPositions && traderDetails.state.assetPositions.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-400 mb-2">Current Positions</h4>
                      <div className="space-y-2">
                        {traderDetails.state.assetPositions.slice(0, 5).map((pos: any, idx: number) => (
                          <div key={idx} className="bg-gray-800 p-2 rounded text-xs">
                            <div className="flex justify-between items-center">
                              <span className="text-white font-medium">
                                {pos.position?.coin || 'Unknown'}
                              </span>
                              <span className={`${
                                parseFloat(pos.position?.szi || 0) > 0 ? 'text-green-500' : 'text-red-500'
                              }`}>
                                {parseFloat(pos.position?.szi || 0) > 0 ? 'LONG' : 'SHORT'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => toast.info('Copy trading feature coming soon')}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-all"
                  >
                    Copy Trader
                  </button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Select a trader to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
