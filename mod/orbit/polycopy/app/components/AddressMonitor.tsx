'use client'

import { useState } from 'react'
import { toast } from 'react-toastify'
import { Play, Trash2, Plus } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

interface AddressMonitorProps {
  config: any
  onMonitoringChange: (isMonitoring: boolean) => void
  initialAddresses?: string[]
}

export default function AddressMonitor({ config, onMonitoringChange, initialAddresses }: AddressMonitorProps) {
  const [addresses, setAddresses] = useState<string[]>(initialAddresses && initialAddresses.length > 0 ? initialAddresses : [''])
  const [dryRun, setDryRun] = useState(true)
  const [multiplier, setMultiplier] = useState(1.0)
  const [maxTradeSize, setMaxTradeSize] = useState(500)
  const [pollInterval, setPollInterval] = useState(30)

  const handleAddAddress = () => {
    setAddresses([...addresses, ''])
  }

  const handleRemoveAddress = (index: number) => {
    setAddresses(addresses.filter((_, i) => i !== index))
  }

  const handleAddressChange = (index: number, value: string) => {
    const newAddresses = [...addresses]
    newAddresses[index] = value
    setAddresses(newAddresses)
  }

  const handleStartMonitoring = async () => {
    const validAddresses = addresses.filter((addr) => addr.trim().length > 0)

    if (validAddresses.length === 0) {
      toast.error('Please add at least one address')
      return
    }

    try {
      const res = await fetch(`${API_URL}/api/monitor/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addresses: validAddresses,
          dry_run: dryRun,
          multiplier,
          max_trade_size: maxTradeSize,
          poll_interval: pollInterval,
        }),
      })

      const data = await res.json()
      if (data.success) {
        toast.success(`Started monitoring ${validAddresses.length} address(es)`)
        onMonitoringChange(true)
      } else {
        toast.error('Failed to start monitoring')
      }
    } catch (error) {
      toast.error('Failed to connect to API')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Address Monitor</h2>
        <p className="text-slate-400">Monitor Polymarket addresses and copy their trades</p>
      </div>

      {/* Addresses */}
      <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Target Addresses</h3>
          <button
            onClick={handleAddAddress}
            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Address</span>
          </button>
        </div>

        <div className="space-y-3">
          {addresses.map((address, index) => (
            <div key={index} className="flex items-center space-x-3">
              <input
                type="text"
                value={address}
                onChange={(e) => handleAddressChange(index, e.target.value)}
                placeholder="0x..."
                className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-sm"
              />
              <button
                onClick={() => handleRemoveAddress(index)}
                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                disabled={addresses.length === 1}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Settings */}
      <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
        <h3 className="text-lg font-semibold mb-4">Copy Trading Settings</h3>

        <div className="grid grid-cols-2 gap-4">
          {/* Dry Run */}
          <div className="col-span-2">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
              />
              <div>
                <span className="font-medium">Dry Run Mode</span>
                <p className="text-sm text-slate-400">Simulate trades without executing (RECOMMENDED)</p>
              </div>
            </label>
          </div>

          {/* Multiplier */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Position Multiplier
              <span className="ml-2 text-slate-400">({multiplier}x)</span>
            </label>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={multiplier}
              onChange={(e) => setMultiplier(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>0.1x</span>
              <span>5x</span>
            </div>
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

      {/* Start Button */}
      <button
        onClick={handleStartMonitoring}
        className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl text-lg font-bold transition-all transform hover:scale-[1.02] flex items-center justify-center space-x-3"
      >
        <Play className="w-6 h-6" />
        <span>Start Monitoring</span>
      </button>

      {!dryRun && (
        <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
          <p className="text-red-400 font-medium flex items-center space-x-2">
            <span>⚠️</span>
            <span>Warning: Live trading mode enabled - real funds will be used!</span>
          </p>
        </div>
      )}
    </div>
  )
}
