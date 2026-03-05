'use client'

import { useState, useEffect } from 'react'
import { ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

export default function TradeHistory() {
  const [trades, setTrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const res = await fetch(`${API_URL}/api/trades?limit=50`)
        const data = await res.json()
        if (data.success) {
          setTrades(data.trades)
        }
      } catch (error) {
        console.error('Failed to fetch trades:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTrades()
    const interval = setInterval(fetchTrades, 10000) // Every 10 seconds
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Loading trade history...</p>
      </div>
    )
  }

  if (trades.length === 0) {
    return (
      <div className="bg-slate-900/50 rounded-xl p-12 border border-slate-800 text-center">
        <Clock className="w-16 h-16 text-slate-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">No Trades Yet</h3>
        <p className="text-slate-400">Start monitoring addresses to see trade history</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Trade History</h2>
        <p className="text-slate-400">{trades.length} recent trades</p>
      </div>

      <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Market
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {trades.map((trade, index) => {
                const isBuy = trade.side === 'BUY'
                const value = parseFloat(trade.value || 0)
                const quantity = parseFloat(trade.quantity || 0)
                const price = parseFloat(trade.price || 0)

                return (
                  <tr key={index} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {isBuy ? (
                          <ArrowUpRight className="w-4 h-4 text-green-400" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 text-red-400" />
                        )}
                        <span className={`font-semibold ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
                          {trade.side}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-xs truncate">{trade.market || 'Unknown Market'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{quantity.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">${price.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap font-semibold">${value.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {trade.simulated ? (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
                          Simulated
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-medium">
                          Executed
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
