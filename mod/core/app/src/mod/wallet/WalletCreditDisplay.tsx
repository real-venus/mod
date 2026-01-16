'use client'

import { useState, useEffect } from 'react'
import { userContext } from '@/mod/context/UserContext'
import { CreditCardIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { CopyButton } from '@/mod/ui/CopyButton'
import { ethers } from 'ethers'
import modConfig from '@/app/mod.json'
import { MarketAllowanceManager } from '@/mod/network/marketAllowance'
import { shorten } from '@/mod/utils'
import MarketABI from '@/mod/contracts/abi/market/Market.sol/Market.json'

export default function WalletCreditDisplay() {
  const { user, client } = userContext()
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // Key balances
  const [keyUsdcCredit, setKeyUsdcCredit] = useState<number>(0)
  const [keyUsdtCredit, setKeyUsdtCredit] = useState<number>(0)
  
  // Client key balances
  const [clientKeyUsdcCredit, setClientKeyUsdcCredit] = useState<number>(0)
  const [clientKeyUsdtCredit, setClientKeyUsdtCredit] = useState<number>(0)

  useEffect(() => {
    const fetchMarketCredits = async () => {
      if (!user?.key || !client?.key?.address || typeof window === 'undefined' || !window.ethereum) {
        return
      }

      try {
        setLoading(true)
        const network = 'testnet'
        const chainConfig = modConfig.chain?.[network]
        if (!chainConfig) return

        const provider = new ethers.BrowserProvider(window.ethereum)
        const marketAddress = chainConfig.contracts.Market.address
        const marketContract = new ethers.Contract(marketAddress, MarketABI.abi, provider)
        
        // Get market decimals (should be 8 for stable representation)
        const marketDecimals = await marketContract.decimals()
        
        // Fetch key credits - balanceOf returns market token balance
        const keyBalance = await marketContract.balanceOf(user.key)
        const keyBalanceFormatted = parseFloat(ethers.formatUnits(keyBalance, marketDecimals))
        
        // For now, split evenly between USDC and USDT (you can enhance this later)
        setKeyUsdcCredit(keyBalanceFormatted / 2)
        setKeyUsdtCredit(keyBalanceFormatted / 2)
        
        // Fetch client key credits
        const clientBalance = await marketContract.balanceOf(client.key.address)
        const clientBalanceFormatted = parseFloat(ethers.formatUnits(clientBalance, marketDecimals))
        
        setClientKeyUsdcCredit(clientBalanceFormatted / 2)
        setClientKeyUsdtCredit(clientBalanceFormatted / 2)
        
      } catch (error) {
        console.error('Failed to fetch market credits:', error)
      } finally {
        setLoading(false)
      }
    }

    if (expanded) {
      fetchMarketCredits()
    }
  }, [expanded, user?.key, client?.key?.address])

  if (!user || !client) return null

  const totalCredit = keyUsdcCredit + keyUsdtCredit + clientKeyUsdcCredit + clientKeyUsdtCredit

  return (
    <div
      className="relative flex items-center gap-2 px-4 py-2 bg-black/50 border border-green-500/40 rounded-lg hover:border-green-500/60 transition-all cursor-pointer hover:scale-105 active:scale-95"
      style={{ height: '60px', minWidth: '60px' }}
      onClick={() => setExpanded(!expanded)}
      title={`Total Market Credit: $${totalCredit.toFixed(2)}`}
    >
      <div className="w-8 h-8 flex items-center justify-center bg-green-500/20 border-2 border-green-500/60 rounded-lg hover:bg-green-500/30 transition-all">
        <CreditCardIcon className="w-5 h-5 text-green-400" />
      </div>

      {expanded && (
        <div className="flex flex-col gap-1 min-w-[280px]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50 uppercase font-bold">Market Credit</span>
            {expanded ? (
              <ChevronUpIcon className="w-4 h-4 text-white/50" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 text-white/50" />
            )}
          </div>
          
          {/* KEY SECTION */}
          <div className="pt-2 border-t border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-white/70 font-bold uppercase">Key</span>
              <span className="text-xs text-white/50 font-mono">{shorten(user.key, 6, 4)}</span>
              <CopyButton text={user.key} size="sm" />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50 uppercase font-bold">USDC</span>
              <span className="text-sm text-green-400 font-mono font-bold">
                {loading ? '...' : `$${keyUsdcCredit.toFixed(2)}`}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50 uppercase font-bold">USDT</span>
              <span className="text-sm text-green-400 font-mono font-bold">
                {loading ? '...' : `$${keyUsdtCredit.toFixed(2)}`}
              </span>
            </div>
          </div>

          {/* CLIENT KEY SECTION */}
          <div className="pt-2 border-t border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-white/70 font-bold uppercase">Client Key</span>
              <span className="text-xs text-white/50 font-mono">{shorten(client.key.address, 6, 4)}</span>
              <CopyButton text={client.key.address} size="sm" />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50 uppercase font-bold">USDC</span>
              <span className="text-sm text-green-400 font-mono font-bold">
                {loading ? '...' : `$${clientKeyUsdcCredit.toFixed(2)}`}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50 uppercase font-bold">USDT</span>
              <span className="text-sm text-green-400 font-mono font-bold">
                {loading ? '...' : `$${clientKeyUsdtCredit.toFixed(2)}`}
              </span>
            </div>
          </div>
          
          {/* TOTAL */}
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <span className="text-xs text-white/50 uppercase font-bold">TOTAL CREDIT</span>
            <span className="text-sm text-green-400 font-mono font-bold">
              {loading ? '...' : `$${totalCredit.toFixed(2)}`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
