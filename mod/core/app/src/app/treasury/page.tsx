"use client";

import { useState, useEffect } from 'react'
import { BuildingLibraryIcon, ArrowTrendingUpIcon, BanknotesIcon, ChartBarIcon, ClockIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline'
import { ethers } from 'ethers'
import modConfig from '@/app/mod.json'
import { CopyButton } from '@/ui/CopyButton'
import { motion } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'

export const dynamic = 'force-dynamic'

interface RevenueDataPoint {
  timestamp: number
  date: string
  revenue: number
  totalBalance: number
}

export default function TreasuryPage() {
  const [treasuryAddress, setTreasuryAddress] = useState('')
  const [usdcBalance, setUsdcBalance] = useState('0')
  const [usdtBalance, setUsdtBalance] = useState('0')
  const [totalBalance, setTotalBalance] = useState('0')
  const [loading, setLoading] = useState(true)
  const [ownerPercentage, setOwnerPercentage] = useState('0')
  const [governanceToken, setGovernanceToken] = useState('')
  const [revenueHistory, setRevenueHistory] = useState<RevenueDataPoint[]>([])
  const [totalRevenue, setTotalRevenue] = useState('0')
  const [dailyAverage, setDailyAverage] = useState('0')
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  useEffect(() => {
    const network = 'testnet'
    const chainConfig = modConfig.chain?.[network]
    if (chainConfig?.contracts?.Treasury?.address) {
      setTreasuryAddress(chainConfig.contracts.Treasury.address)
    }
  }, [])

  useEffect(() => {
    const fetchTreasuryData = async () => {
      if (!treasuryAddress || typeof window.ethereum === 'undefined') return
      
      try {
        setLoading(true)
        const provider = new ethers.BrowserProvider(window.ethereum)
        const network = 'testnet'
        const chainConfig = modConfig.chain?.[network]
        
        const usdcAddress = chainConfig?.contracts?.USDC?.address
        const usdtAddress = chainConfig?.contracts?.USDT?.address
        
        let usdc = 0
        let usdt = 0
        
        if (usdcAddress) {
          const ERC20ABI = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)']
          const usdcContract = new ethers.Contract(usdcAddress, ERC20ABI, provider)
          const balance = await usdcContract.balanceOf(treasuryAddress)
          const decimals = await usdcContract.decimals()
          usdc = parseFloat(ethers.formatUnits(balance, decimals))
          setUsdcBalance(usdc.toFixed(2))
        }
        
        if (usdtAddress) {
          const ERC20ABI = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)']
          const usdtContract = new ethers.Contract(usdtAddress, ERC20ABI, provider)
          const balance = await usdtContract.balanceOf(treasuryAddress)
          const decimals = await usdtContract.decimals()
          usdt = parseFloat(ethers.formatUnits(balance, decimals))
          setUsdtBalance(usdt.toFixed(2))
        }
        
        setTotalBalance((usdc + usdt).toFixed(2))
        
        // Fetch treasury info
        const TreasuryABI = [
          'function ownerPercentage() view returns (uint256)',
          'function governanceToken() view returns (address)'
        ]
        const treasuryContract = new ethers.Contract(treasuryAddress, TreasuryABI, provider)
        const ownerPct = await treasuryContract.ownerPercentage()
        const govToken = await treasuryContract.governanceToken()
        
        setOwnerPercentage((Number(ownerPct) / 100).toFixed(2))
        setGovernanceToken(govToken)

        // Update revenue history
        const newDataPoint: RevenueDataPoint = {
          timestamp: Date.now(),
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          revenue: usdc + usdt,
          totalBalance: usdc + usdt
        }

        setRevenueHistory(prev => {
          const updated = [...prev, newDataPoint]
          // Keep last 30 data points
          const limited = updated.slice(-30)

          // Calculate total revenue and daily average
          if (limited.length > 1) {
            const firstBalance = limited[0].totalBalance
            const lastBalance = limited[limited.length - 1].totalBalance
            const revenueGenerated = lastBalance - firstBalance
            setTotalRevenue(Math.max(0, revenueGenerated).toFixed(2))

            const timeSpan = (limited[limited.length - 1].timestamp - limited[0].timestamp) / (1000 * 60 * 60 * 24) // days
            const avgPerDay = timeSpan > 0 ? revenueGenerated / timeSpan : 0
            setDailyAverage(Math.max(0, avgPerDay).toFixed(2))
          }

          return limited
        })

        setLastUpdate(new Date())

      } catch (error) {
        console.error('Error fetching treasury data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (treasuryAddress) {
      fetchTreasuryData()
      const interval = setInterval(fetchTreasuryData, 30000)
      return () => clearInterval(interval)
    }
  }, [treasuryAddress])

  if (!treasuryAddress) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-purple-400 text-xl">Treasury not configured</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black p-8 pt-24">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <div className="w-16 h-16 flex items-center justify-center bg-purple-500/20 border-2 border-purple-500/60 rounded-xl">
            <BuildingLibraryIcon className="w-10 h-10 text-purple-400" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-white">Treasury Statistics</h1>
            <p className="text-purple-300 text-lg mt-1">Real-time treasury analytics and balances</p>
          </div>
        </motion.div>

        {/* Treasury Address */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-2 border-purple-500/30 rounded-xl p-6 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-300 text-sm uppercase tracking-wide mb-2">Treasury Address</p>
              <p className="text-white font-mono text-lg">{treasuryAddress}</p>
            </div>
            <CopyButton text={treasuryAddress} size="lg" />
          </div>
        </motion.div>

        {/* Revenue Chart */}
        {revenueHistory.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-2 border-purple-500/30 rounded-xl p-6 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <ArrowTrendingUpIcon className="w-8 h-8 text-purple-400" />
                <h2 className="text-2xl font-bold text-white">Revenue Over Time</h2>
              </div>
              <div className="flex items-center gap-2 text-purple-300 text-sm">
                <ClockIcon className="w-4 h-4" />
                <span>Updated: {lastUpdate.toLocaleTimeString()}</span>
              </div>
            </div>

            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueHistory}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis
                    dataKey="date"
                    stroke="#9ca3af"
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    stroke="#9ca3af"
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    tickFormatter={(value) => `$${value.toFixed(0)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '2px solid #a855f7',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    formatter={(value: any) => [`$${parseFloat(value).toFixed(2)}`, 'Balance']}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalBalance"
                    stroke="#a855f7"
                    strokeWidth={3}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-purple-500/30">
              <div>
                <p className="text-purple-300 text-xs uppercase tracking-wide mb-1">Total Revenue</p>
                <p className="text-2xl font-bold text-white">${totalRevenue}</p>
              </div>
              <div>
                <p className="text-purple-300 text-xs uppercase tracking-wide mb-1">Daily Average</p>
                <p className="text-2xl font-bold text-white">${dailyAverage}</p>
              </div>
              <div>
                <p className="text-purple-300 text-xs uppercase tracking-wide mb-1">Data Points</p>
                <p className="text-2xl font-bold text-white">{revenueHistory.length}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Balance */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-2 border-green-500/40 rounded-xl p-6 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <BanknotesIcon className="w-8 h-8 text-green-400" />
              <h3 className="text-green-300 text-sm uppercase tracking-wide font-bold">Total Balance</h3>
            </div>
            <p className="text-4xl font-bold text-white">${loading ? '...' : totalBalance}</p>
            <p className="text-green-400 text-sm mt-2">USD Value</p>
          </motion.div>

          {/* USDC Balance */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-2 border-blue-500/40 rounded-xl p-6 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <ChartBarIcon className="w-8 h-8 text-blue-400" />
              <h3 className="text-blue-300 text-sm uppercase tracking-wide font-bold">USDC Balance</h3>
            </div>
            <p className="text-4xl font-bold text-white">${loading ? '...' : usdcBalance}</p>
            <p className="text-blue-400 text-sm mt-2">Stablecoin</p>
          </motion.div>

          {/* USDT Balance */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border-2 border-teal-500/40 rounded-xl p-6 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <ArrowTrendingUpIcon className="w-8 h-8 text-teal-400" />
              <h3 className="text-teal-300 text-sm uppercase tracking-wide font-bold">USDT Balance</h3>
            </div>
            <p className="text-4xl font-bold text-white">${loading ? '...' : usdtBalance}</p>
            <p className="text-teal-400 text-sm mt-2">Stablecoin</p>
          </motion.div>

          {/* Owner Percentage */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-2 border-purple-500/40 rounded-xl p-6 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <BuildingLibraryIcon className="w-8 h-8 text-purple-400" />
              <h3 className="text-purple-300 text-sm uppercase tracking-wide font-bold">Owner Share</h3>
            </div>
            <p className="text-4xl font-bold text-white">{loading ? '...' : ownerPercentage}%</p>
            <p className="text-purple-400 text-sm mt-2">Treasury Fee</p>
          </motion.div>
        </div>

        {/* Governance Token */}
        {governanceToken && governanceToken !== ethers.ZeroAddress && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-2 border-purple-500/30 rounded-xl p-6 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-300 text-sm uppercase tracking-wide mb-2">Governance Token</p>
                <p className="text-white font-mono text-lg">{governanceToken}</p>
              </div>
              <CopyButton text={governanceToken} size="lg" />
            </div>
          </motion.div>
        )}

        {/* Info Box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-2 border-purple-500/30 rounded-xl p-6 backdrop-blur-xl"
        >
          <h3 className="text-purple-300 text-lg font-bold mb-4">About Treasury</h3>
          <div className="space-y-3 text-purple-200">
            <p>• The treasury holds protocol funds in stablecoins (USDC & USDT)</p>
            <p>• Owner percentage represents the protocol fee on treasury operations</p>
            <p>• Governance token holders can claim proportional shares from the treasury</p>
            <p>• All balances are updated in real-time from the blockchain</p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
