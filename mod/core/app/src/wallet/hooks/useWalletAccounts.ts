"use client";

import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'

interface WalletHistoryEntry {
  address: string
  mode: string
  type: string
  lastUsed: number
}

export function useWalletAccounts(
  userKey: string | undefined,
  address: string,
  switchWallet: (addr: string, mode: string, type: string) => Promise<void>,
) {
  const [walletHistory, setWalletHistory] = useState<WalletHistoryEntry[]>([])
  const [isSwitchingWallet, setIsSwitchingWallet] = useState(false)

  const handleSwitchWallet = async (wallet: { address: string; mode: string; type: string }) => {
    if (wallet.address.toLowerCase() === address.toLowerCase()) return
    setIsSwitchingWallet(true)
    try {
      await switchWallet(wallet.address, wallet.mode, wallet.type)
      try {
        const saved = localStorage.getItem('wallet_history')
        if (saved) setWalletHistory(JSON.parse(saved))
      } catch {}
      toast.success(`Switched to ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to switch wallet')
    } finally {
      setIsSwitchingWallet(false)
    }
  }

  const handleRemoveFromHistory = (addr: string) => {
    try {
      const history = walletHistory.filter(w => w.address.toLowerCase() !== addr.toLowerCase())
      setWalletHistory(history)
      localStorage.setItem('wallet_history', JSON.stringify(history))
      localStorage.removeItem(`wallet_pw_${addr}`)
    } catch {}
  }

  const refreshHistory = () => {
    try {
      const saved = localStorage.getItem('wallet_history')
      if (saved) setWalletHistory(JSON.parse(saved))
    } catch {}
  }

  useEffect(() => {
    refreshHistory()
  }, [userKey])

  return {
    walletHistory, isSwitchingWallet,
    handleSwitchWallet, handleRemoveFromHistory, refreshHistory,
  }
}
