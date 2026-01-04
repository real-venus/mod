'use client'
import { useState, useEffect } from 'react'
import { WalletIcon } from '@heroicons/react/24/outline'

export function MetamaskAccountSelector() {
  const [accounts, setAccounts] = useState<string[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [previouslyUsed, setPreviouslyUsed] = useState<string[]>([])

  useEffect(() => {
    loadPreviouslyUsedAccounts()
    loadMetamaskAccounts()
  }, [])

  const loadPreviouslyUsedAccounts = () => {
    const stored = localStorage.getItem('metamask_used_accounts')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setPreviouslyUsed(Array.isArray(parsed) ? parsed : [])
      } catch (e) {
        setPreviouslyUsed([])
      }
    }
  }

  const saveToUsedAccounts = (account: string) => {
    const updated = [account, ...previouslyUsed.filter(a => a !== account)].slice(0, 10)
    setPreviouslyUsed(updated)
    localStorage.setItem('metamask_used_accounts', JSON.stringify(updated))
  }

  const loadMetamaskAccounts = async () => {
    setLoading(true)
    setError('')
    
    try {
      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask is not installed')
      }

      const accounts = await window.ethereum.request({ method: 'eth_accounts' })
      
      if (!accounts || accounts.length === 0) {
        const requestedAccounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
        setAccounts(requestedAccounts)
      } else {
        setAccounts(accounts)
      }

      const storedAddress = localStorage.getItem('wallet_address')
      if (storedAddress && accounts.includes(storedAddress)) {
        setSelectedAccount(storedAddress)
      } else if (previouslyUsed.length > 0 && accounts.includes(previouslyUsed[0])) {
        setSelectedAccount(previouslyUsed[0])
      } else if (accounts.length > 0) {
        setSelectedAccount(accounts[0])
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load MetaMask accounts')
    } finally {
      setLoading(false)
    }
  }

  const handleAccountSelect = (account: string) => {
    setSelectedAccount(account)
    saveToUsedAccounts(account)
    localStorage.setItem('wallet_address', account)
    localStorage.setItem('wallet_mode', 'metamask')
    localStorage.setItem('wallet_type', 'ethereum')
  }

  if (loading) {
    return (
      <div className="p-5 bg-black border-2 border-orange-500/40 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-orange-400 font-bold text-sm">Loading MetaMask accounts...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-5 bg-red-900/20 border-2 border-red-500/40 rounded-xl">
        <p className="text-red-400 font-bold text-sm">❌ {error}</p>
        <button
          onClick={loadMetamaskAccounts}
          className="mt-3 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 rounded-lg font-bold text-xs uppercase transition-all"
        >
          Retry
        </button>
      </div>
    )
  }

  if (accounts.length === 0) {
    return (
      <div className="p-5 bg-orange-900/20 border-2 border-orange-500/40 rounded-xl">
        <p className="text-orange-400 font-bold text-sm">🦊 No MetaMask accounts found. Please connect your wallet.</p>
        <button
          onClick={loadMetamaskAccounts}
          className="mt-3 px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-400 rounded-lg font-bold text-xs uppercase transition-all"
        >
          Connect MetaMask
        </button>
      </div>
    )
  }

  const sortedAccounts = [...accounts].sort((a, b) => {
    const aIndex = previouslyUsed.indexOf(a)
    const bIndex = previouslyUsed.indexOf(b)
    if (aIndex === -1 && bIndex === -1) return 0
    if (aIndex === -1) return 1
    if (bIndex === -1) return -1
    return aIndex - bIndex
  })

  return (
    <div>
      <label className="block text-white/70 mb-3 font-bold text-base uppercase tracking-wider">SELECT METAMASK ACCOUNT</label>
      <div className="max-h-80 overflow-y-auto bg-black border-2 border-orange-500/40 rounded-xl">
        {sortedAccounts.map((account) => {
          const isPreviouslyUsed = previouslyUsed.includes(account)
          return (
            <button
              key={account}
              type="button"
              onClick={() => handleAccountSelect(account)}
              className={`w-full text-left px-5 py-4 font-mono text-sm transition-all border-b border-orange-500/20 last:border-b-0 hover:bg-orange-500/10 ${
                selectedAccount === account
                  ? 'bg-orange-500/20 text-white font-bold'
                  : 'text-white/70'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <WalletIcon className="w-4 h-4 text-orange-400" />
                    <div className="font-bold text-base">MetaMask Account</div>
                    {isPreviouslyUsed && (
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/40">Previously Used</span>
                    )}
                  </div>
                  <div className="text-xs text-white/50 mt-1 truncate">
                    {account.slice(0, 12)}...{account.slice(-12)}
                  </div>
                </div>
                {selectedAccount === account && (
                  <div className="w-5 h-5 bg-orange-400 rounded-full flex items-center justify-center flex-shrink-0 ml-3">
                    <span className="text-black font-bold text-sm">✓</span>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-white/50 mt-3 font-mono leading-relaxed bg-orange-500/5 p-3 rounded-lg border border-orange-500/20">
        🦊 Select a MetaMask account to use for authentication. Previously used accounts are shown first.
      </p>
    </div>
  )
}

export default MetamaskAccountSelector