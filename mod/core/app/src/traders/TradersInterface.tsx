"use client"

import { useState, useEffect } from 'react'
import { MagnifyingGlassIcon, FunnelIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { toast } from 'react-toastify'

interface Trader {
  proxyWallet: string
  userName?: string
  rank?: number
  vol: number
  pnl: number
  roi: number
  apr: number
  sharpe?: number
  trade_count?: number | null
}

interface TraderStats {
  address: string
  positions: any[]
  position_count: number
  total_value: number
  recent_trades: any[]
  total_trades: number
  leaderboard_rank?: number
  pnl: number
  volume: number
  roi: number
  apr: number
  win_rate?: number | null
}

export default function TradersInterface() {
  const [traders, setTraders] = useState<Trader[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTraders, setSelectedTraders] = useState<Set<string>>(new Set())
  const [viewingProfile, setViewingProfile] = useState<string | null>(null)
  const [profileData, setProfileData] = useState<TraderStats | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(false)

  // Filters
  const [window, setWindow] = useState('30d')
  const [sortBy, setSortBy] = useState('apr')
  const [minVolume, setMinVolume] = useState(10000)
  const [minApr, setMinApr] = useState<number | null>(null)
  const [limit, setLimit] = useState(20)
  const [showFilters, setShowFilters] = useState(false)

  // Search traders
  const searchTraders = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        window,
        limit: limit.toString(),
        min_volume: minVolume.toString(),
        sort_by: sortBy,
      })

      if (minApr !== null && minApr > 0) {
        params.append('min_apr', minApr.toString())
      }

      const response = await fetch(`/api/polycopy/traders?${params}`)
      const data = await response.json()

      if (data.error) {
        toast.error(data.error)
      } else {
        setTraders(data.traders || [])
        toast.success(`Found ${data.traders?.length || 0} traders`)
      }
    } catch (error) {
      toast.error('Failed to fetch traders')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // Load trader profile
  const loadProfile = async (address: string) => {
    setLoadingProfile(true)
    setViewingProfile(address)
    try {
      const response = await fetch(`/api/polycopy/trader/${address}?window=${window}`)
      const data = await response.json()

      if (data.error) {
        toast.error(data.error)
        setProfileData(null)
      } else {
        setProfileData(data)
      }
    } catch (error) {
      toast.error('Failed to load trader profile')
      console.error(error)
      setProfileData(null)
    } finally {
      setLoadingProfile(false)
    }
  }

  // Toggle trader selection
  const toggleTrader = (address: string) => {
    const newSelected = new Set(selectedTraders)
    if (newSelected.has(address)) {
      newSelected.delete(address)
    } else {
      newSelected.add(address)
    }
    setSelectedTraders(newSelected)
  }

  // Start copy trading with selected traders
  const startCopyTrading = async () => {
    if (selectedTraders.size === 0) {
      toast.warning('Please select at least one trader')
      return
    }

    const addresses = Array.from(selectedTraders)

    try {
      toast.info('Starting copy trading...')

      // Save to polycopy config
      const response = await fetch('/api/polycopy/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses })
      })

      const data = await response.json()

      if (data.error) {
        toast.error(data.error)
      } else {
        toast.success(`Copy trading configured for ${addresses.length} trader(s)`)
        // Could navigate to monitoring page or show status
      }
    } catch (error) {
      toast.error('Failed to start copy trading')
      console.error(error)
    }
  }

  // Initial load
  useEffect(() => {
    searchTraders()
  }, [])

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  // Format percentage
  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            🔍 Polymarket Traders
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Discover and copy top performing Polymarket traders
          </p>
        </div>

        {/* Search Controls */}
        <div className="px-6 pb-4 flex items-center gap-3 flex-wrap">
          {/* Time Window */}
          <select
            value={window}
            onChange={(e) => setWindow(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)'
            }}
          >
            <option value="1d">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All time</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)'
            }}
          >
            <option value="apr">Sort by APR</option>
            <option value="pnl">Sort by Profit</option>
            <option value="vol">Sort by Volume</option>
            <option value="roi">Sort by ROI</option>
          </select>

          {/* Filters Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-opacity hover:opacity-80"
            style={{
              background: showFilters ? 'var(--accent-primary)' : 'var(--bg-input)',
              border: '1px solid var(--border)',
              color: showFilters ? 'white' : 'var(--text-primary)'
            }}
          >
            <FunnelIcon className="w-4 h-4" />
            Filters
          </button>

          {/* Search Button */}
          <button
            onClick={searchTraders}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{
              background: 'var(--accent-primary)',
              color: 'white'
            }}
          >
            {loading ? (
              <>
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <MagnifyingGlassIcon className="w-4 h-4" />
                Search
              </>
            )}
          </button>

          {/* Selected Count */}
          {selectedTraders.size > 0 && (
            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {selectedTraders.size} selected
              </span>
              <button
                onClick={startCopyTrading}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
                style={{
                  background: '#10b981',
                  color: 'white'
                }}
              >
                Start Copy Trading
              </button>
            </div>
          )}
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="px-6 pb-4 border-t pt-4 grid grid-cols-1 md:grid-cols-3 gap-4" style={{ borderColor: 'var(--border)' }}>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                Min Volume
              </label>
              <input
                type="number"
                value={minVolume}
                onChange={(e) => setMinVolume(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)'
                }}
                placeholder="10000"
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                Min APR %
              </label>
              <input
                type="number"
                value={minApr || ''}
                onChange={(e) => setMinApr(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)'
                }}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                Max Results
              </label>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)'
                }}
                placeholder="20"
              />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {viewingProfile && profileData ? (
          /* Trader Profile View */
          <div className="p-6">
            <button
              onClick={() => setViewingProfile(null)}
              className="mb-4 text-sm hover:opacity-80"
              style={{ color: 'var(--accent-primary)' }}
            >
              ← Back to list
            </button>

            <div className="space-y-6">
              {/* Profile Header */}
              <div className="p-6 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                      {profileData.address.slice(0, 10)}...{profileData.address.slice(-8)}
                    </h2>
                    {profileData.leaderboard_rank && (
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Rank #{profileData.leaderboard_rank}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleTrader(profileData.address)}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
                    style={{
                      background: selectedTraders.has(profileData.address) ? '#10b981' : 'var(--accent-primary)',
                      color: 'white'
                    }}
                  >
                    {selectedTraders.has(profileData.address) ? '✓ Selected' : 'Select to Copy'}
                  </button>
                </div>

                {/* Performance Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>PnL</p>
                    <p className="text-lg font-semibold" style={{ color: profileData.pnl >= 0 ? '#10b981' : '#ef4444' }}>
                      {formatCurrency(profileData.pnl)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Volume</p>
                    <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {formatCurrency(profileData.volume)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>ROI</p>
                    <p className="text-lg font-semibold" style={{ color: profileData.roi >= 0 ? '#10b981' : '#ef4444' }}>
                      {formatPercent(profileData.roi)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>APR</p>
                    <p className="text-lg font-semibold" style={{ color: profileData.apr >= 0 ? '#10b981' : '#ef4444' }}>
                      {formatPercent(profileData.apr)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Portfolio Stats */}
              <div className="p-6 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                  Portfolio
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Active Positions</p>
                    <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                      {profileData.position_count}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Total Value</p>
                    <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                      {formatCurrency(profileData.total_value)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Total Trades</p>
                    <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                      {profileData.total_trades}
                    </p>
                  </div>
                </div>
              </div>

              {/* Recent Positions */}
              {profileData.positions && profileData.positions.length > 0 && (
                <div className="p-6 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                    Recent Positions
                  </h3>
                  <div className="space-y-3">
                    {profileData.positions.slice(0, 5).map((pos: any, i: number) => (
                      <div key={i} className="p-3 rounded" style={{ background: 'var(--bg-tertiary)' }}>
                        <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                          {pos.market?.question || 'Unknown Market'}
                        </p>
                        <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <span>Outcome: {pos.outcome || 'Unknown'}</span>
                          <span>Size: {formatCurrency(parseFloat(pos.size || 0))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : viewingProfile && loadingProfile ? (
          /* Loading Profile */
          <div className="flex items-center justify-center h-64">
            <ArrowPathIcon className="w-8 h-8 animate-spin" style={{ color: 'var(--accent-primary)' }} />
          </div>
        ) : (
          /* Traders List */
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <ArrowPathIcon className="w-8 h-8 animate-spin" style={{ color: 'var(--accent-primary)' }} />
              </div>
            ) : traders.length === 0 ? (
              <div className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>
                <p>No traders found. Try adjusting your filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                      <th className="text-left p-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        Select
                      </th>
                      <th className="text-left p-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        Rank
                      </th>
                      <th className="text-left p-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        Username
                      </th>
                      <th className="text-right p-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        Volume
                      </th>
                      <th className="text-right p-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        PnL
                      </th>
                      <th className="text-right p-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        ROI
                      </th>
                      <th className="text-right p-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        APR
                      </th>
                      <th className="text-center p-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {traders.map((trader) => (
                      <tr
                        key={trader.proxyWallet}
                        className="border-b hover:bg-opacity-50 transition-colors"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedTraders.has(trader.proxyWallet)}
                            onChange={() => toggleTrader(trader.proxyWallet)}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 text-sm" style={{ color: 'var(--text-primary)' }}>
                          #{trader.rank || '?'}
                        </td>
                        <td className="p-3">
                          <div>
                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                              {trader.userName || 'Anonymous'}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                              {trader.proxyWallet.slice(0, 8)}...{trader.proxyWallet.slice(-6)}
                            </p>
                          </div>
                        </td>
                        <td className="p-3 text-sm text-right" style={{ color: 'var(--text-primary)' }}>
                          {formatCurrency(trader.vol)}
                        </td>
                        <td className="p-3 text-sm text-right font-medium" style={{ color: trader.pnl >= 0 ? '#10b981' : '#ef4444' }}>
                          {formatCurrency(trader.pnl)}
                        </td>
                        <td className="p-3 text-sm text-right font-medium" style={{ color: trader.roi >= 0 ? '#10b981' : '#ef4444' }}>
                          {formatPercent(trader.roi)}
                        </td>
                        <td className="p-3 text-sm text-right font-semibold" style={{ color: trader.apr >= 0 ? '#10b981' : '#ef4444' }}>
                          {formatPercent(trader.apr)}
                          {trader.apr > 100 && <span className="ml-1">⭐</span>}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => loadProfile(trader.proxyWallet)}
                            className="px-3 py-1 rounded text-xs transition-opacity hover:opacity-80"
                            style={{
                              background: 'var(--accent-primary)',
                              color: 'white'
                            }}
                          >
                            View Profile
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
