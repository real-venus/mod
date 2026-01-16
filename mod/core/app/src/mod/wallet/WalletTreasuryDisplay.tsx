'use client'

import { useState, useEffect } from 'react'
import { userContext } from '@/mod/context/UserContext'
import { BuildingLibraryIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { CopyButton } from '@/mod/ui/CopyButton'
import { ethers } from 'ethers'
import modConfig from '@/app/mod.json'
import TreasuryABI from '@/mod/contracts/abi/treasury/Treasury.sol/Treasury.json'

export default function WalletTreasuryDisplay() {
  const { user } = userContext()
  const [expanded, setExpanded] = useState(false)
  const [treasuryAddress, setTreasuryAddress] = useState<string>('')
  const [usdcTVL, setUsdcTVL] = useState<number>(0)
  const [usdtTVL, setUsdtTVL] = useState<number>(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchTreasuryData = async () => {
      try {
        const network = 'testnet'
        const chainConfig = modConfig.chain?.[network]
        if (!chainConfig) return

        const treasuryAddr = chainConfig.contracts.Treasury.address
        setTreasuryAddress(treasuryAddr)

        if (window.ethereum) {
          setLoading(true)
          const provider = new ethers.BrowserProvider(window.ethereum)
          
          // Get USDC balance
          const usdcAddress = chainConfig.contracts.USDC?.address
          if (usdcAddress) {
            const usdcABI = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)']
            const usdcContract = new ethers.Contract(usdcAddress, usdcABI, provider)
            const usdcBalance = await usdcContract.balanceOf(treasuryAddr)
            const usdcDecimals = await usdcContract.decimals()
            const formattedUsdcBalance = parseFloat(ethers.formatUnits(usdcBalance, usdcDecimals))
            setUsdcTVL(formattedUsdcBalance)
          }
          
          // Get USDT balance
          const usdtAddress = chainConfig.contracts.USDT?.address
          if (usdtAddress) {
            const usdtABI = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)']
            const usdtContract = new ethers.Contract(usdtAddress, usdtABI, provider)
            const usdtBalance = await usdtContract.balanceOf(treasuryAddr)
            const usdtDecimals = await usdtContract.decimals()
            const formattedUsdtBalance = parseFloat(ethers.formatUnits(usdtBalance, usdtDecimals))
            setUsdtTVL(formattedUsdtBalance)
          }
          
          setLoading(false)
        }
      } catch (error) {
        console.error('Error fetching treasury data:', error)
        setLoading(false)
      }
    }

    fetchTreasuryData()
  }, [])

  if (!user) return null

  const totalTVL = usdcTVL + usdtTVL

  return (
    <div
      className="relative flex items-center gap-2 px-4 py-2 bg-black/50 border border-purple-500/40 rounded-lg hover:border-purple-500/60 transition-all cursor-pointer hover:scale-105 active:scale-95"
      style={{ height: '60px', minWidth: '60px' }}
      onClick={() => setExpanded(!expanded)}
      title={`Total USD Value: $${totalTVL.toFixed(2)}`}
    >
      <div className="w-8 h-8 flex items-center justify-center bg-purple-500/20 border-2 border-purple-500/60 rounded-lg hover:bg-purple-500/30 transition-all">
        <BuildingLibraryIcon className="w-5 h-5 text-purple-400" />
      </div>

      {expanded && (
        <div className="flex flex-col gap-1 min-w-[200px]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50 uppercase font-bold">Treasury</span>
            {expanded ? (
              <ChevronUpIcon className="w-4 h-4 text-white/50" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 text-white/50" />
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/70 font-mono">
              {treasuryAddress.slice(0, 6)}...{treasuryAddress.slice(-4)}
            </span>
            <CopyButton text={treasuryAddress} size="sm" />
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-white/10">
            <span className="text-xs text-white/50 uppercase font-bold">USDC TVL</span>
            <span className="text-sm text-purple-400 font-mono font-bold">
              {loading ? '...' : `$${usdcTVL.toFixed(2)}`}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50 uppercase font-bold">USDT TVL</span>
            <span className="text-sm text-purple-400 font-mono font-bold">
              {loading ? '...' : `$${usdtTVL.toFixed(2)}`}
            </span>
          </div>
          
          <div className="flex items-center justify-between pt-1 border-t border-white/10">
            <span className="text-xs text-white/50 uppercase font-bold">TOTAL USD</span>
            <span className="text-sm text-green-400 font-mono font-bold">
              {loading ? '...' : `$${totalTVL.toFixed(2)}`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
