'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { Search, TrendingUp, DollarSign, Activity, Plus, Check, X, Eye, BarChart, ArrowUpDown } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

interface Trader {
  proxyWallet: string
  userName?: string
  pnl: number
  vol: number
  roi: number
  apr: number
  sharpe: number
  profit_factor: number
  rank?: number
}

interface TraderProfile {
  address: string
  pnl: number
  volume: number
  roi: number
  apr: number
  leaderboard_rank: number | null
  position_count: number
  total_value: number
  total_trades: number
  positions: any[]
  recent_trades: any[]
}

interface TraderDiscoveryProps {
  onAddToMonitor: (addresses: string[]) => void
}

export default function TraderDiscovery({ onAddToMonitor }: TraderDiscoveryProps) {
  const [traders, setTraders] = useState<Trader[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTraders, setSelectedTraders] = useState<Set<string>>(new Set())
  const [selectedProfile, setSelectedProfile] = useState<TraderProfile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(false)

  // Filter controls
  const [window, setWindow] = useState('30d')
  const [limit, setLimit] = useState(50)
  const [minVolume, setMinVolume] = useState('')
  const [minAPR, setMinAPR] = useState('')
  const [sortBy, setSortBy] = useState('apr')

  useEffect(() => {
    fetchTraders()
  }, [window])

  const fetchTraders = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        window,
        limit: limit.toString(),
        sort_by: sortBy,
      })

      if (minVolume) params.append('min_volume', minVolume)
      if (minAPR) params.append('min_apr', minAPR)

      const res = await fetch(`${API_URL}/api/traders/search?${params}`)
      const data = await res.json()

      if (data.success) {
        setTraders(data.traders)
        toast.success(`Found ${data.traders.length} traders`)
      } else {
        toast.error('Failed to fetch traders')
      }
    } catch (error) {
      toast.error('Failed to connect to API')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    fetchTraders()
  }

  const toggleTrader = (address: string) => {
    const newSelected = new Set(selectedTraders)
    if (newSelected.has(address)) {
      newSelected.delete(address)
    } else {
      newSelected.add(address)
    }
    setSelectedTraders(newSelected)
  }

  const handleAddSelected = () => {
    if (selectedTraders.size === 0) {
      toast.error('Please select at least one trader')
      return
    }
    const addresses = Array.from(selectedTraders)
    onAddToMonitor(addresses)
    toast.success(`Added ${addresses.length} trader(s) to monitor`)
    setSelectedTraders(new Set())
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const fetchTraderProfile = async (address: string) => {
    setLoadingProfile(true)
    try {
      const res = await fetch(`${API_URL}/api/traders/profile/${address}?window=${window}`)
      const data = await res.json()

      if (data.success) {
        setSelectedProfile(data.profile)
      } else {
        toast.error('Failed to fetch trader profile')
      }
    } catch (error) {
      toast.error('Failed to connect to API')
    } finally {
      setLoadingProfile(false)
    }
  }

  const handleViewProfile = async (address: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await fetchTraderProfile(address)
  }

  const closeProfile = () => {
    setSelectedProfile(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Discover Traders</h2>
        <p className="text-slate-400">Find and copy profitable Polymarket traders</p>
      </div>

      {/* Search Filters */}
      <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* Time Window */}
          <div>
            <label className="block text-sm font-medium mb-2">Time Window</label>
            <select
              value={window}
              onChange={(e) => setWindow(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="1d">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-sm font-medium mb-2">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="apr">APR (Annualized Return)</option>
              <option value="pnl">Profit & Loss</option>
              <option value="vol">Volume</option>
              <option value="roi">ROI</option>
            </select>
          </div>

          {/* Min Volume */}
          <div>
            <label className="block text-sm font-medium mb-2">Min Volume (USD)</label>
            <input
              type="number"
              value={minVolume}
              onChange={(e) => setMinVolume(e.target.value)}
              placeholder="e.g. 10000"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Min APR */}
          <div>
            <label className="block text-sm font-medium mb-2">Min APR (%)</label>
            <input
              type="number"
              value={minAPR}
              onChange={(e) => setMinAPR(e.target.value)}
              placeholder="e.g. 50"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <button
          onClick={handleSearch}
          disabled={loading}
          className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-700 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2"
        >
          <Search className="w-5 h-5" />
          <span>{loading ? 'Searching...' : 'Search Traders'}</span>
        </button>
      </div>

      {/* Selected Traders Action */}
      {selectedTraders.size > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/50 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Check className="w-5 h-5 text-blue-400" />
            <span className="font-medium">{selectedTraders.size} trader(s) selected</span>
          </div>
          <button
            onClick={handleAddSelected}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-medium transition-colors flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add to Monitor</span>
          </button>
        </div>
      )}

      {/* Traders Table */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-400">Loading traders...</p>
          </div>
        ) : traders.length === 0 ? (
          <div className="p-12 text-center">
            <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No traders found. Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50 border-b border-slate-700">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">Select</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">Address</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-slate-300">PnL</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-slate-300">Volume</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-slate-300">ROI</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-slate-300">APR</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-slate-300">Sharpe</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {traders.map((trader, index) => {
                  const isSelected = selectedTraders.has(trader.proxyWallet)
                  return (
                    <tr
                      key={trader.proxyWallet}
                      className={`hover:bg-slate-800/30 cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-500/10' : ''
                      }`}
                      onClick={() => toggleTrader(trader.proxyWallet)}
                    >
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleTrader(trader.proxyWallet)}
                          className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-xs font-bold">
                            #{index + 1}
                          </div>
                          <code className="text-sm text-slate-300 font-mono">
                            {formatAddress(trader.proxyWallet)}
                          </code>
                        </div>
                      </td>
                      <td className={`px-6 py-4 text-right font-semibold ${
                        trader.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {formatCurrency(trader.pnl)}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-300">
                        {formatCurrency(trader.vol)}
                      </td>
                      <td className={`px-6 py-4 text-right font-medium ${
                        trader.roi >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {trader.roi.toFixed(1)}%
                      </td>
                      <td className={`px-6 py-4 text-right font-bold ${
                        trader.apr >= 100 ? 'text-green-400' :
                        trader.apr >= 50 ? 'text-yellow-400' : 'text-slate-300'
                      }`}>
                        {trader.apr.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 text-right text-slate-300">
                        {trader.sharpe.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={(e) => handleViewProfile(trader.proxyWallet, e)}
                          className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors flex items-center space-x-1"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Details</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Results Summary */}
      {!loading && traders.length > 0 && (
        <div className="text-center text-sm text-slate-400">
          Showing {traders.length} traders for {window === '1d' ? 'last 24 hours' : window === '7d' ? 'last 7 days' : window === '30d' ? 'last 30 days' : 'all time'}
        </div>
      )}

      {/* Trader Profile Modal */}
      {selectedProfile && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeProfile}>
          <div className="bg-slate-900 rounded-2xl border border-slate-800 max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Trader Profile</h3>
                <code className="text-sm text-slate-400 font-mono">{selectedProfile.address}</code>
              </div>
              <button
                onClick={closeProfile}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Content */}
            {loadingProfile ? (
              <div className="p-12 text-center">
                <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-slate-400">Loading profile...</p>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Performance Metrics */}
                <div>
                  <h4 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-blue-400" />
                    <span>Performance Metrics</span>
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <p className="text-sm text-slate-400 mb-1">Profit & Loss</p>
                      <p className={`text-2xl font-bold ${selectedProfile.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(selectedProfile.pnl)}
                      </p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <p className="text-sm text-slate-400 mb-1">Total Volume</p>
                      <p className="text-2xl font-bold text-slate-200">
                        {formatCurrency(selectedProfile.volume)}
                      </p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <p className="text-sm text-slate-400 mb-1">ROI</p>
                      <p className={`text-2xl font-bold ${selectedProfile.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {selectedProfile.roi.toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <p className="text-sm text-slate-400 mb-1">APR</p>
                      <p className={`text-2xl font-bold ${
                        selectedProfile.apr >= 100 ? 'text-green-400' :
                        selectedProfile.apr >= 50 ? 'text-yellow-400' : 'text-slate-200'
                      }`}>
                        {selectedProfile.apr.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Trading Activity */}
                <div>
                  <h4 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                    <Activity className="w-5 h-5 text-blue-400" />
                    <span>Trading Activity</span>
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <p className="text-sm text-slate-400 mb-1">Leaderboard Rank</p>
                      <p className="text-2xl font-bold text-blue-400">
                        {selectedProfile.leaderboard_rank !== null ? `#${selectedProfile.leaderboard_rank}` : 'N/A'}
                      </p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <p className="text-sm text-slate-400 mb-1">Total Trades</p>
                      <p className="text-2xl font-bold text-slate-200">
                        {selectedProfile.total_trades}
                      </p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <p className="text-sm text-slate-400 mb-1">Active Positions</p>
                      <p className="text-2xl font-bold text-slate-200">
                        {selectedProfile.position_count}
                      </p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <p className="text-sm text-slate-400 mb-1">Portfolio Value</p>
                      <p className="text-2xl font-bold text-slate-200">
                        {formatCurrency(selectedProfile.total_value)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Current Positions */}
                {selectedProfile.positions && selectedProfile.positions.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                      <BarChart className="w-5 h-5 text-blue-400" />
                      <span>Current Positions ({selectedProfile.positions.length})</span>
                    </h4>
                    <div className="bg-slate-800/30 rounded-lg border border-slate-700 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-800/50 border-b border-slate-700">
                            <tr>
                              <th className="text-left px-4 py-3 text-sm font-semibold text-slate-300">Market</th>
                              <th className="text-left px-4 py-3 text-sm font-semibold text-slate-300">Outcome</th>
                              <th className="text-right px-4 py-3 text-sm font-semibold text-slate-300">Size</th>
                              <th className="text-right px-4 py-3 text-sm font-semibold text-slate-300">Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {selectedProfile.positions.slice(0, 10).map((pos: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-800/30">
                                <td className="px-4 py-3 text-sm text-slate-300">
                                  {pos.market?.question?.slice(0, 60) || 'Unknown Market'}...
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    pos.outcome === 'Yes' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                  }`}>
                                    {pos.outcome || 'Unknown'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-right text-slate-300">
                                  {parseFloat(pos.size || 0).toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-sm text-right font-medium text-slate-200">
                                  {formatCurrency(parseFloat(pos.currentValue || 0))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recent Trades */}
                {selectedProfile.recent_trades && selectedProfile.recent_trades.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                      <ArrowUpDown className="w-5 h-5 text-blue-400" />
                      <span>Recent Trades</span>
                    </h4>
                    <div className="bg-slate-800/30 rounded-lg border border-slate-700 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-800/50 border-b border-slate-700">
                            <tr>
                              <th className="text-left px-4 py-3 text-sm font-semibold text-slate-300">Side</th>
                              <th className="text-left px-4 py-3 text-sm font-semibold text-slate-300">Market</th>
                              <th className="text-right px-4 py-3 text-sm font-semibold text-slate-300">Price</th>
                              <th className="text-right px-4 py-3 text-sm font-semibold text-slate-300">Quantity</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {selectedProfile.recent_trades.map((trade: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-800/30">
                                <td className="px-4 py-3 text-sm">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    trade.side?.toUpperCase() === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                  }`}>
                                    {trade.side?.toUpperCase() || 'N/A'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-300">
                                  {trade.market?.question?.slice(0, 50) || 'Unknown'}...
                                </td>
                                <td className="px-4 py-3 text-sm text-right text-slate-300">
                                  ${parseFloat(trade.price || 0).toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-sm text-right text-slate-300">
                                  {parseFloat(trade.quantity || 0).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                  <button
                    onClick={closeProfile}
                    className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      onAddToMonitor([selectedProfile.address])
                      toast.success('Added trader to monitor')
                      closeProfile()
                    }}
                    className="px-6 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-medium transition-colors flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add to Monitor</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
