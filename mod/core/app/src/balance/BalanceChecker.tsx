"use client";

import { useState } from 'react'
import { userContext } from '@/context'

const TOKENS = ['ETH', 'USDC', 'USDT', 'MARKET']

export function BalanceChecker() {
  const { user, client } = userContext()
  const [balances, setBalances] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const checkBalances = async () => {
    if (!user?.key) {
      setError('No wallet connected')
      return
    }

    if (!client) {
      setError('Client not initialized')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Use API to get all balances - works on all browsers without MetaMask
      const results = await client.call('get_balances', {
        address: user.key,
        tokens: TOKENS
      })

      const formattedBalances: Record<string, string> = {}
      for (const [token, balance] of Object.entries(results)) {
        formattedBalances[token] = typeof balance === 'number' ? balance.toFixed(2) : '0.00'
      }

      setBalances(formattedBalances)
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
            <div key={token} className="flex justify-between p-3 bg-green-500/10 border border-green-500 rounded-lg">
              <span className="text-green-500 font-bold">{token}</span>
              <span className="text-green-500 font-mono">
                {token === 'ETH' ? `${balances[token] || '0.000000'}` : `$${balances[token] || '0.00'}`}
              </span>
            </div>
          ))}
          <div className="flex justify-between p-3 bg-green-500/20 border-2 border-green-500 rounded-lg mt-4">
            <span className="text-green-500 font-black">TOTAL USD</span>
            <span className="text-green-500 font-black">
              ${Object.entries(balances)
                .filter(([token]) => token !== 'ETH')
                .reduce((sum, [, val]) => sum + (parseFloat(val) || 0), 0)
                .toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}