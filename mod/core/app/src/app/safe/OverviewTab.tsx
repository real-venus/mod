"use client"

import { useState, useEffect } from 'react'
import {
  ShieldCheckIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { CopyButton } from '@/ui/CopyButton'
import { GlowCard } from './GlowCard'
import { ACCENT } from './shared'
import type { SafeInfo } from '@/network/safe'
import { ethers } from 'ethers'
import modConfig from '@/config.json'

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
]

interface TokenBalance {
  symbol: string
  name: string
  balance: number
  address: string
}

export function OverviewTab({
  safeInfo, walletAddress, ethBalance, loading,
}: {
  safeInfo: SafeInfo | null
  walletAddress: string
  ethBalance: string
  loading: boolean
}) {
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([])
  const [loadingBalances, setLoadingBalances] = useState(false)

  const fetchTokenBalances = async () => {
    if (!safeInfo?.address || typeof window === 'undefined' || !window.ethereum) return
    setLoadingBalances(true)
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const chainConfig = (modConfig.chain as any)?.testnet
      if (!chainConfig?.contracts) return

      const tokens: { name: string; address: string }[] = []
      for (const [name, val] of Object.entries(chainConfig.contracts) as [string, any][]) {
        if (['USDC', 'USDT', 'NativeToken', 'Market'].includes(name) && val.address) {
          tokens.push({ name, address: val.address })
        }
      }

      const results: TokenBalance[] = []
      for (const token of tokens) {
        try {
          const contract = new ethers.Contract(token.address, ERC20_ABI, provider)
          const [raw, decimals, symbol] = await Promise.all([
            contract.balanceOf(safeInfo.address),
            contract.decimals(),
            contract.symbol(),
          ])
          const balance = parseFloat(ethers.formatUnits(raw, decimals))
          results.push({
            symbol,
            name: token.name,
            balance,
            address: token.address,
          })
        } catch (err) {
          console.error(`Failed to fetch ${token.name} balance:`, err)
        }
      }
      setTokenBalances(results)
    } catch (err) {
      console.error('Failed to fetch token balances:', err)
    } finally {
      setLoadingBalances(false)
    }
  }

  useEffect(() => {
    if (safeInfo?.address) fetchTokenBalances()
  }, [safeInfo?.address])

  if (!safeInfo && !loading) {
    return (
      <GlowCard color={ACCENT}>
        <div className="text-center py-8 text-white/40">
          <ShieldCheckIcon className="w-12 h-12 mx-auto mb-3 text-amber-500/30" />
          <p>Enter a Safe address and click Load to get started</p>
        </div>
      </GlowCard>
    )
  }

  if (!safeInfo) return null

  return (
    <div className="space-y-4">
      <GlowCard color={ACCENT} delay={0.1}>
        <h2 className="text-sm font-bold uppercase tracking-wider text-amber-500/70 mb-4">Owners</h2>
        <div className="space-y-2">
          {safeInfo.owners.map((owner, i) => {
            const isMe = owner.toLowerCase() === walletAddress.toLowerCase()
            return (
              <div
                key={i}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                  isMe ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/[0.03]'
                }`}
              >
                {isMe && <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />}
                <span className="font-mono text-sm text-white/80 flex-1 break-all">{owner}</span>
                <CopyButton text={owner} size="sm" />
                {isMe && (
                  <span className="text-[10px] font-bold text-emerald-400 uppercase">you</span>
                )}
              </div>
            )
          })}
        </div>
      </GlowCard>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlowCard color={ACCENT} delay={0.2}>
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-500/70 mb-1">Threshold</div>
          <div className="text-2xl font-bold text-white">{safeInfo.threshold} <span className="text-white/30 text-lg">/ {safeInfo.owners.length}</span></div>
          <div className="text-xs text-white/40 mt-1">confirmations required</div>
        </GlowCard>
        <GlowCard color={ACCENT} delay={0.25}>
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-500/70 mb-1">Nonce</div>
          <div className="text-2xl font-bold text-white font-mono">{safeInfo.nonce}</div>
          <div className="text-xs text-white/40 mt-1">transactions executed</div>
        </GlowCard>
        <GlowCard color={ACCENT} delay={0.3}>
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-500/70 mb-1">ETH Balance</div>
          <div className="text-2xl font-bold text-white font-mono">{parseFloat(ethBalance).toFixed(4)}</div>
          <div className="text-xs text-white/40 mt-1">native balance</div>
        </GlowCard>
      </div>

      {/* ERC20 Portfolio */}
      <GlowCard color={ACCENT} delay={0.35}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-amber-500/70">Portfolio</h2>
          <button
            onClick={fetchTokenBalances}
            disabled={loadingBalances}
            className="p-1.5 hover:bg-white/5 rounded-lg transition-all disabled:opacity-50"
            title="Refresh balances"
          >
            <ArrowPathIcon className={`w-4 h-4 text-amber-500/60 ${loadingBalances ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loadingBalances && tokenBalances.length === 0 ? (
          <div className="flex items-center justify-center py-6 gap-2 text-white/40 text-xs">
            <ArrowPathIcon className="w-4 h-4 animate-spin" />
            <span>Loading balances...</span>
          </div>
        ) : tokenBalances.length === 0 ? (
          <div className="text-center py-4 text-white/30 text-xs">No token balances found</div>
        ) : (
          <div className="space-y-2">
            {/* ETH row */}
            <div className="flex items-center justify-between px-3 py-2.5 bg-white/[0.03] rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white/50 uppercase tracking-wider font-mono">ETH</span>
              </div>
              <span className="font-mono text-sm font-bold text-white tabular-nums">
                {parseFloat(ethBalance).toFixed(4)}
              </span>
            </div>

            {/* ERC20 token rows */}
            {tokenBalances.map((token) => (
              <div
                key={token.address}
                className="flex items-center justify-between px-3 py-2.5 bg-white/[0.03] rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white/50 uppercase tracking-wider font-mono">
                    {token.name === 'Market' ? 'MARKET' : token.symbol}
                  </span>
                  <CopyButton text={token.address} size="sm" />
                </div>
                <span className="font-mono text-sm font-bold text-white tabular-nums">
                  {token.name === 'NativeToken'
                    ? token.balance.toFixed(4)
                    : `$${token.balance.toFixed(2)}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </GlowCard>

      <GlowCard color={ACCENT} delay={0.4}>
        <div className="text-[11px] font-bold uppercase tracking-wider text-amber-500/70 mb-1">Safe Address</div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-white/80 break-all">{safeInfo.address}</span>
          <CopyButton text={safeInfo.address} size="sm" />
        </div>
      </GlowCard>
    </div>
  )
}
