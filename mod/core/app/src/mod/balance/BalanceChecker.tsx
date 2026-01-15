'use client'

import { useState } from 'react'
import { userContext } from '@/mod/context'
import { ethers } from 'ethers'

const ERC20_ABI = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)', 'function symbol() view returns (string)']

const TOKENS = [
  { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 }
]

export function BalanceChecker() {
  const { user } = userContext()
  const [balances, setBalances] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const checkBalances = async () => {
    if (!user?.key) {
      setError('No wallet connected')
      return
    }

    setLoading(true)
    setError('')
    const results: Record<string, string> = {}

    try {
      const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com')
      
      for (const token of TOKENS) {
        try {
          const contract = new ethers.Contract(token.address, ERC20_ABI, provider)
          const balance = await contract.balanceOf(user.key)
          const formatted = ethers.formatUnits(balance, token.decimals)
          results[token.symbol] = parseFloat(formatted).toFixed(2)
        } catch (err) {
          results[token.symbol] = 'Error'
        }
      }

      setBalances(results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch balances')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 bg-black border-4 border-green-500 rounded-xl">
      <h2 className="text-2xl font-black text-green-500 mb-4 uppercase">ERC20 Balance Checker</h2>
      
      <div className="mb-4">
        <p className="text-green-500 font-mono">Address: {user?.key ? `${user.key.slice(0, 8)}...${user.key.slice(-6)}` : 'Not connected'}</p>
      </div>

      <button
        onClick={checkBalances}
        disabled={loading || !user?.key}
        className="w-full py-3 mb-4 bg-green-500/20 border-2 border-green-500 text-green-500 font-black uppercase rounded-lg hover:bg-green-500/30 disabled:opacity-50"
      >
        {loading ? 'CHECKING...' : 'CHECK BALANCES'}
      </button>

      {error && (
        <div className="p-3 mb-4 bg-red-500/20 border-2 border-red-500 text-red-500 rounded-lg">
          {error}
        </div>
      )}

      {Object.keys(balances).length > 0 && (
        <div className="space-y-2">
          {TOKENS.map(token => (
            <div key={token.symbol} className="flex justify-between p-3 bg-green-500/10 border border-green-500 rounded-lg">
              <span className="text-green-500 font-bold">{token.symbol}</span>
              <span className="text-green-500 font-mono">${balances[token.symbol] || '0.00'} USD</span>
            </div>
          ))}
          <div className="flex justify-between p-3 bg-green-500/20 border-2 border-green-500 rounded-lg mt-4">
            <span className="text-green-500 font-black">TOTAL</span>
            <span className="text-green-500 font-black">${Object.values(balances).reduce((sum, val) => sum + (parseFloat(val) || 0), 0).toFixed(2)} USD</span>
          </div>
        </div>
      )}
    </div>
  )
}