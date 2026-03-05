'use client'

import { useState } from 'react'
import { toast } from 'react-toastify'
import { Save } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

interface ConfigPanelProps {
  config: any
  onConfigChange: (config: any) => void
}

export default function ConfigPanel({ config, onConfigChange }: ConfigPanelProps) {
  const [dryRun, setDryRun] = useState(config?.dry_run ?? true)
  const [multiplier, setMultiplier] = useState(config?.multiplier ?? 1.0)
  const [maxTradeSize, setMaxTradeSize] = useState(config?.max_trade_size ?? 500)
  const [maxPositionSize, setMaxPositionSize] = useState(config?.max_position_size ?? 1000)
  const [minTradeSize, setMinTradeSize] = useState(config?.min_trade_size ?? 1)
  const [pollInterval, setPollInterval] = useState(config?.poll_interval ?? 30)

  // Risk Limits
  const [maxDailyTrades, setMaxDailyTrades] = useState(config?.risk_limits?.max_daily_trades ?? 50)
  const [maxDailyVolume, setMaxDailyVolume] = useState(config?.risk_limits?.max_daily_volume ?? 5000)
  const [maxConcurrentPositions, setMaxConcurrentPositions] = useState(config?.risk_limits?.max_concurrent_positions ?? 20)

  const handleSaveConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dry_run: dryRun,
          multiplier,
          max_trade_size: maxTradeSize,
          max_position_size: maxPositionSize,
          poll_interval: pollInterval,
          risk_limits: {
            max_daily_trades: maxDailyTrades,
            max_daily_volume: maxDailyVolume,
            max_concurrent_positions: maxConcurrentPositions,
          },
        }),
      })

      const data = await res.json()
      if (data.success) {
        onConfigChange(data.config)
        toast.success('Configuration saved successfully')
      } else {
        toast.error('Failed to save configuration')
      }
    } catch (error) {
      toast.error('Failed to connect to API')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Configuration</h2>
        <p className="text-slate-400">Manage copy trading settings and risk limits</p>
      </div>

      {/* Trading Settings */}
      <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
        <h3 className="text-lg font-semibold mb-4">Trading Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Dry Run */}
          <div className="col-span-2">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-blue-500"
              />
              <div>
                <span className="font-medium">Dry Run Mode</span>
                <p className="text-sm text-slate-400">Simulate trades without real execution</p>
              </div>
            </label>
          </div>

          {/* Multiplier */}
          <div>
            <label className="block text-sm font-medium mb-2">Position Multiplier</label>
            <input
              type="number"
              value={multiplier}
              onChange={(e) => setMultiplier(parseFloat(e.target.value))}
              step="0.1"
              min="0.1"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Max Trade Size */}
          <div>
            <label className="block text-sm font-medium mb-2">Max Trade Size (USD)</label>
            <input
              type="number"
              value={maxTradeSize}
              onChange={(e) => setMaxTradeSize(parseFloat(e.target.value))}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Max Position Size */}
          <div>
            <label className="block text-sm font-medium mb-2">Max Position Size (USD)</label>
            <input
              type="number"
              value={maxPositionSize}
              onChange={(e) => setMaxPositionSize(parseFloat(e.target.value))}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Min Trade Size */}
          <div>
            <label className="block text-sm font-medium mb-2">Min Trade Size (USD)</label>
            <input
              type="number"
              value={minTradeSize}
              onChange={(e) => setMinTradeSize(parseFloat(e.target.value))}
              min="0.1"
              step="0.1"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Poll Interval */}
          <div>
            <label className="block text-sm font-medium mb-2">Poll Interval (seconds)</label>
            <input
              type="number"
              value={pollInterval}
              onChange={(e) => setPollInterval(parseInt(e.target.value))}
              min={10}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Risk Limits */}
      <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
        <h3 className="text-lg font-semibold mb-4">Risk Limits</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Max Daily Trades */}
          <div>
            <label className="block text-sm font-medium mb-2">Max Daily Trades</label>
            <input
              type="number"
              value={maxDailyTrades}
              onChange={(e) => setMaxDailyTrades(parseInt(e.target.value))}
              min="1"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Max Daily Volume */}
          <div>
            <label className="block text-sm font-medium mb-2">Max Daily Volume (USD)</label>
            <input
              type="number"
              value={maxDailyVolume}
              onChange={(e) => setMaxDailyVolume(parseFloat(e.target.value))}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Max Concurrent Positions */}
          <div>
            <label className="block text-sm font-medium mb-2">Max Concurrent Positions</label>
            <input
              type="number"
              value={maxConcurrentPositions}
              onChange={(e) => setMaxConcurrentPositions(parseInt(e.target.value))}
              min="1"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSaveConfig}
        className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2"
      >
        <Save className="w-5 h-5" />
        <span>Save Configuration</span>
      </button>
    </div>
  )
}
