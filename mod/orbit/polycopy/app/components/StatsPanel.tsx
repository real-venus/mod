'use client'

import { BarChart3, TrendingUp, DollarSign, Activity } from 'lucide-react'

interface StatsPanelProps {
  stats: any
}

export default function StatsPanel({ stats }: StatsPanelProps) {
  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Loading statistics...</p>
      </div>
    )
  }

  const statCards = [
    {
      label: 'Total Trades',
      value: stats.total_trades || 0,
      icon: BarChart3,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      label: 'Total Volume',
      value: `$${(stats.total_volume || 0).toFixed(2)}`,
      icon: DollarSign,
      color: 'from-green-500 to-emerald-500',
    },
    {
      label: 'Success Rate',
      value: `${(stats.success_rate || 0).toFixed(1)}%`,
      icon: TrendingUp,
      color: 'from-purple-500 to-pink-500',
    },
    {
      label: 'Active Positions',
      value: stats.active_positions || 0,
      icon: Activity,
      color: 'from-orange-500 to-red-500',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Statistics</h2>
        <p className="text-slate-400">Copy trading performance metrics</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="bg-slate-900/50 rounded-xl p-6 border border-slate-800 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-400">{stat.label}</p>
              <div className={`w-10 h-10 bg-gradient-to-br ${stat.color} rounded-lg flex items-center justify-center`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-3xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Detailed Stats */}
      <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
        <h3 className="text-lg font-semibold mb-4">Detailed Breakdown</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-slate-800">
            <span className="text-slate-400">Successful Trades</span>
            <span className="font-semibold">{stats.success_count || 0}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-800">
            <span className="text-slate-400">Failed Trades</span>
            <span className="font-semibold text-red-400">{stats.fail_count || 0}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-slate-400">Average Trade Size</span>
            <span className="font-semibold">
              ${stats.total_trades > 0 ? ((stats.total_volume || 0) / stats.total_trades).toFixed(2) : '0.00'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
