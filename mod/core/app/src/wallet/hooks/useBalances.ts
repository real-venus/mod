"use client";

import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { toast } from 'react-toastify'

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
]

interface CustomToken {
  address: string
  symbol: string
  decimals: number
}

export function useBalances(userKey: string | undefined, client: any) {
  const [marketCredit, setMarketCredit] = useState(0)
  const [tokenBalances, setTokenBalances] = useState<Record<string, number>>({})
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [customTokens, setCustomTokens] = useState<CustomToken[]>([])
  const [customTokenBalances, setCustomTokenBalances] = useState<Record<string, number>>({})
  const [showAddToken, setShowAddToken] = useState(false)
  const [newTokenAddress, setNewTokenAddress] = useState('')
  const [isAddingToken, setIsAddingToken] = useState(false)

  const fetchMarketCredit = async () => {
    if (!userKey || !client) return
    try {
      setIsRefreshing(true)
      const result = await client.call('api/get_balances', { address: userKey })
      setTokenBalances(result)
      setMarketCredit(parseFloat(result?.MARKET) || 0)
    } catch (err) {
      console.error('Error fetching balances:', err)
      setMarketCredit(0)
      setTokenBalances({})
    } finally {
      setIsRefreshing(false)
    }
  }

  const fetchCustomTokenBalances = async () => {
    if (!userKey || customTokens.length === 0 || typeof window === 'undefined' || !window.ethereum) return
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const balances: Record<string, number> = {}
      for (const token of customTokens) {
        try {
          const contract = new ethers.Contract(token.address, ERC20_ABI, provider)
          const raw = await contract.balanceOf(userKey)
          balances[token.symbol] = parseFloat(ethers.formatUnits(raw, token.decimals))
        } catch {
          balances[token.symbol] = 0
        }
      }
      setCustomTokenBalances(balances)
    } catch (err) {
      console.error('Failed to fetch custom token balances:', err)
    }
  }

  const handleAddCustomToken = async () => {
    if (!newTokenAddress || !ethers.isAddress(newTokenAddress)) {
      toast.error('Enter a valid token address')
      return
    }
    if (customTokens.some(t => t.address.toLowerCase() === newTokenAddress.toLowerCase())) {
      toast.error('Token already added')
      return
    }
    setIsAddingToken(true)
    try {
      if (!window.ethereum) throw new Error('No wallet connected')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const contract = new ethers.Contract(newTokenAddress, ERC20_ABI, provider)
      const [symbol, decimals] = await Promise.all([contract.symbol(), contract.decimals()])
      const newToken = { address: ethers.getAddress(newTokenAddress), symbol, decimals: Number(decimals) }
      const updated = [...customTokens, newToken]
      setCustomTokens(updated)
      localStorage.setItem('custom_tokens', JSON.stringify(updated))
      setNewTokenAddress('')
      setShowAddToken(false)
      toast.success(`Added ${symbol}`)
      fetchCustomTokenBalances()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add token')
    } finally {
      setIsAddingToken(false)
    }
  }

  const handleRemoveCustomToken = (addr: string) => {
    const updated = customTokens.filter(t => t.address.toLowerCase() !== addr.toLowerCase())
    setCustomTokens(updated)
    localStorage.setItem('custom_tokens', JSON.stringify(updated))
  }

  const refreshAll = () => {
    fetchMarketCredit()
    fetchCustomTokenBalances()
  }

  // Load custom tokens from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('custom_tokens')
      if (saved) setCustomTokens(JSON.parse(saved))
    } catch {}
  }, [])

  // Fetch custom token balances when tokens change
  useEffect(() => {
    if (userKey && customTokens.length > 0) fetchCustomTokenBalances()
  }, [userKey, customTokens.length])

  // Fetch on mount + 10-minute poll
  useEffect(() => {
    if (!userKey) return
    fetchMarketCredit()
    const interval = setInterval(fetchMarketCredit, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [userKey])

  return {
    marketCredit, tokenBalances, isRefreshing,
    customTokens, customTokenBalances,
    showAddToken, setShowAddToken,
    newTokenAddress, setNewTokenAddress,
    isAddingToken,
    fetchMarketCredit, fetchCustomTokenBalances, refreshAll,
    handleAddCustomToken, handleRemoveCustomToken,
  }
}
