'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { Play, Square, Activity, TrendingUp, Settings, BarChart3, Search } from 'lucide-react'
import AddressMonitor from '../components/AddressMonitor'
import StatsPanel from '../components/StatsPanel'
import ConfigPanel from '../components/ConfigPanel'
import TradeHistory from '../components/TradeHistory'
import TraderDiscovery from '../components/TraderDiscovery'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

export default function Home() {
  const [activeTab, setActiveTab] = useState<'discover' | 'monitor' | 'stats' | 'config' | 'trades'>('discover')
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const [config, setConfig] = useState<any>(null)
  const [apiConnected, setApiConnected] = useState<boolean | null>(null)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [monitorAddresses, setMonitorAddresses] = useState<string[]>([''])

  // Check API connection
  useEffect(() => {
    let toastId: any = null
    let hasShownError = false

    const checkConnection = async () => {
      try {
        const res = await fetch(`${API_URL}/api/health`, {
          signal: AbortSignal.timeout(5000)
        })
        if (res.ok) {
          setApiConnected(true)
          setConnectionError(null)
          if (toastId) {
            toast.dismiss(toastId)
            toastId = null
          }
        } else {
          throw new Error(`API returned ${res.status}`)
        }
      } catch (error) {
        console.error('API connection error:', error)
        setApiConnected(false)
        const errorMsg = error instanceof Error ? error.message : 'Connection failed'
        setConnectionError(errorMsg)

        // Only show toast once, not on every retry
        if (!hasShownError) {
          toastId = toast.error('Failed to connect to API', {
            autoClose: false,
            closeButton: true
          })
          hasShownError = true
        }
      }
    }

    checkConnection()
    const interval = setInterval(checkConnection, 10000) // Check every 10 seconds
    return () => {
      clearInterval(interval)
      if (toastId) toast.dismiss(toastId)
    }
  }, [])

  // Fetch stats periodically (only when connected)
  useEffect(() => {
    if (!apiConnected) return

    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_URL}/api/stats`, {
          signal: AbortSignal.timeout(5000)
        })
        const data = await res.json()
        if (data.success) {
          setStats(data.stats)
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 5000) // Every 5 seconds
    return () => clearInterval(interval)
  }, [apiConnected])

  // Fetch config on mount (only when connected)
  useEffect(() => {
    if (!apiConnected) return

    const fetchConfig = async () => {
      try {
        const res = await fetch(`${API_URL}/api/config`, {
          signal: AbortSignal.timeout(5000)
        })
        const data = await res.json()
        if (data.success) {
          setConfig(data.config)
        }
      } catch (error) {
        console.error('Failed to fetch config:', error)
      }
    }
    fetchConfig()
  }, [apiConnected])

  const handleStopAll = async () => {
    try {
      const res = await fetch(`${API_URL}/api/monitor/stop`, {
        method: 'POST'
      })
      const data = await res.json()
      if (data.success) {
        setIsMonitoring(false)
        toast.success('Stopped all monitoring')
      }
    } catch (error) {
      toast.error('Failed to stop monitoring')
    }
  }

  const handleAddTradersToMonitor = (addresses: string[]) => {
    setMonitorAddresses(addresses)
    setActiveTab('monitor')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Polycopy</h1>
                <p className="text-xs text-slate-400">Polymarket Copy Trading</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* API Connection Status */}
              <div className="flex items-center space-x-2 text-sm">
                {apiConnected === null ? (
                  <>
                    <div className="w-2 h-2 bg-slate-500 rounded-full animate-pulse" />
                    <span className="text-slate-400">Connecting...</span>
                  </>
                ) : apiConnected ? (
                  <>
                    <div className="w-2 h-2 bg-green-400 rounded-full" />
                    <span className="text-green-400">API Connected</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                    <span className="text-red-400" title={connectionError || 'Not connected'}>API Disconnected</span>
                  </>
                )}
              </div>

              {isMonitoring && (
                <div className="flex items-center space-x-2 text-sm">
                  <Activity className="w-4 h-4 text-green-400 animate-pulse" />
                  <span className="text-green-400">Monitoring</span>
                </div>
              )}
              <button
                onClick={handleStopAll}
                disabled={!isMonitoring || !apiConnected}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
              >
                <Square className="w-4 h-4" />
                <span>Stop All</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Nav Tabs */}
      <div className="border-b border-slate-800 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'discover', label: 'Discover', icon: Search },
              { id: 'monitor', label: 'Monitor', icon: Activity },
              { id: 'stats', label: 'Statistics', icon: BarChart3 },
              { id: 'trades', label: 'Trade History', icon: TrendingUp },
              { id: 'config', label: 'Configuration', icon: Settings },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-3 py-4 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'discover' && (
          <TraderDiscovery onAddToMonitor={handleAddTradersToMonitor} />
        )}
        {activeTab === 'monitor' && (
          <AddressMonitor
            config={config}
            onMonitoringChange={setIsMonitoring}
            initialAddresses={monitorAddresses}
          />
        )}
        {activeTab === 'stats' && <StatsPanel stats={stats} />}
        {activeTab === 'config' && (
          <ConfigPanel config={config} onConfigChange={setConfig} />
        )}
        {activeTab === 'trades' && <TradeHistory />}
      </main>

      {/* Footer Stats Bar */}
      {stats && (
        <div className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-sm border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xs text-slate-400">Total Trades</p>
                <p className="text-lg font-bold">{stats.total_trades || 0}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Volume</p>
                <p className="text-lg font-bold">${stats.total_volume?.toFixed(2) || '0.00'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Success Rate</p>
                <p className="text-lg font-bold">{stats.success_rate?.toFixed(1) || '0.0'}%</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Active Positions</p>
                <p className="text-lg font-bold">{stats.active_positions || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
