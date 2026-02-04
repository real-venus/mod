'use client'

import { BuildingLibraryIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import { CopyButton } from '@/mod/ui/CopyButton'
import modConfig from '@/app/mod.json'
import { ethers } from 'ethers'
import { useRouter } from 'next/navigation'

export function TreasuryHeader() {
  const router = useRouter()
  const [treasuryAddress, setTreasuryAddress] = useState('')
  const [totalUsdValue, setTotalUsdValue] = useState('0')
  const [showTreasuryDetails, setShowTreasuryDetails] = useState(false)
  const [usdcBalance, setUsdcBalance] = useState('0')
  const [usdtBalance, setUsdtBalance] = useState('0')

  useEffect(() => {
    const network = 'testnet'
    const chainConfig = modConfig.chain?.[network]
    if (chainConfig?.contracts?.Treasury?.address) {
      setTreasuryAddress(chainConfig.contracts.Treasury.address)
    }
  }, [])

  useEffect(() => {
    const fetchTreasuryBalance = async () => {
      if (!treasuryAddress || typeof window.ethereum === 'undefined') return
      
      try {
        const { ethers } = await import('ethers')
        const provider = new ethers.BrowserProvider(window.ethereum)
        
        const network = 'testnet'
        const chainConfig = modConfig.chain?.[network]
        
        const usdcAddress = chainConfig?.contracts?.USDC?.address
        const usdtAddress = chainConfig?.contracts?.USDT?.address
        
        let totalUsd = 0
        
        if (usdcAddress) {
          const ERC20ABI = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)']
          const usdcContract = new ethers.Contract(usdcAddress, ERC20ABI, provider)
          const balance = await usdcContract.balanceOf(treasuryAddress)
          const decimals = await usdcContract.decimals()
          const usdc = parseFloat(ethers.formatUnits(balance, decimals))
          setUsdcBalance(usdc.toFixed(2))
          totalUsd += usdc
        }
        
        if (usdtAddress) {
          const ERC20ABI = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)']
          const usdtContract = new ethers.Contract(usdtAddress, ERC20ABI, provider)
          const balance = await usdtContract.balanceOf(treasuryAddress)
          const decimals = await usdtContract.decimals()
          const usdt = parseFloat(ethers.formatUnits(balance, decimals))
          setUsdtBalance(usdt.toFixed(2))
          totalUsd += usdt
        }
        
        setTotalUsdValue(totalUsd.toFixed(2))
      } catch (error) {
        console.error('Error fetching treasury balance:', error)
      }
    }

    if (treasuryAddress) {
      fetchTreasuryBalance()
      const interval = setInterval(fetchTreasuryBalance, 30000)
      return () => clearInterval(interval)
    }
  }, [treasuryAddress])

  const handleClick = () => {
    router.push('/user/billing')
  }

  if (!treasuryAddress) return null

  return (
    <div
      className="relative flex items-center gap-2 px-4 py-2 bg-black/50 border border-purple-500/40 rounded-lg hover:border-purple-500/60 transition-all cursor-pointer hover:scale-105 active:scale-95"
      style={{ height: '60px', minWidth: '60px', opacity: showTreasuryDetails ? 1 : 0.9 }}
      onMouseEnter={() => setShowTreasuryDetails(true)}
      onMouseLeave={() => setShowTreasuryDetails(false)}
      onClick={handleClick}
      title={`Treasury Balance: $${totalUsdValue} - Click to go to Billing`}
    >
      <div className="w-8 h-8 flex items-center justify-center bg-purple-500/20 border-2 border-purple-500/60 rounded-lg hover:bg-purple-500/30 transition-all">
        <BuildingLibraryIcon className="w-5 h-5 text-purple-400" />
      </div>

      {showTreasuryDetails && (
        <>
          <div className="absolute top-full left-0 mt-2 bg-black/95 backdrop-blur-xl border-2 border-purple-500/40 rounded-xl shadow-2xl p-4 z-50 min-w-[250px]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-white/50 uppercase font-bold">Treasury</span>
              <ChevronUpIcon className="w-4 h-4 text-white/50" />
            </div>
            
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-white/70 font-mono">
                {treasuryAddress.slice(0, 6)}...{treasuryAddress.slice(-4)}
              </span>
              <CopyButton text={treasuryAddress} size="sm" />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-xs text-white/50 uppercase font-bold">TOTAL USD</span>
              <span className="text-sm text-green-400 font-mono font-bold">
                ${totalUsdValue}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}