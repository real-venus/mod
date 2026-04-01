"use client";

import { useState } from 'react'
import { ArrowPathIcon, CheckCircleIcon, ClockIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline'

interface ClaimSearchProps {
  initialAddress?: string
  isOwnAddress?: boolean
  onSearch: (address: string) => Promise<void>
  onCopy: (text: string, label: string) => void
}

interface SearchResult {
  address: string
  total: number
  claimed: number
  unclaimed: number
  claimData?: {
    amount: number
    recipient: string
    from: string
  }
}

export function ClaimSearch({ initialAddress = '', isOwnAddress = false, onSearch, onCopy }: ClaimSearchProps) {
  const [address, setAddress] = useState('')
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState<SearchResult | null>(null)

  const handleSearch = async () => {
    const searchAddr = address.trim() || initialAddress
    if (!searchAddr) return

    setSearching(true)
    try {
      await onSearch(searchAddr)
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder={initialAddress ? `Default: ${initialAddress.slice(0,8)}...${initialAddress.slice(-6)}` : "Enter sr25519 address"}
          value={address}
          onChange={e => setAddress(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          className="flex-1 bg-neutral-950 border border-neutral-800 px-3 py-2.5 text-xs font-mono text-neutral-200 focus:outline-none focus:border-neutral-600 transition-colors"
        />
        <button
          onClick={handleSearch}
          disabled={searching || (!address.trim() && !initialAddress)}
          className="px-4 py-2.5 bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs font-mono uppercase tracking-wider"
        >
          {searching ? (
            <ArrowPathIcon className="w-4 h-4 animate-spin" />
          ) : (
            'search'
          )}
        </button>
      </div>
    </div>
  )
}
