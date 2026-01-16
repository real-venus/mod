'use client'

import { WalletHeader } from '@/mod/wallet/WalletHeader'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import { useSearchContext } from '@/mod/context/SearchContext'
import { useRouter } from 'next/navigation'
import { NetworkSelector } from '@/mod/network/NetworkSelector'
import WalletCreditDisplay from '@/mod/wallet/WalletCreditDisplay'
import { userContext } from '@/mod/context/UserContext'
import { CopyButton } from '@/mod/ui/CopyButton'
import modConfig from '@/app/mod.json'

export function Header() {
  const [searchCollapsed, setSearchCollapsed] = useState(false)
  const { handleSearch } = useSearchContext()
  const router = useRouter()
  const [inputValue, setInputValue] = useState('')
  const { user } = userContext()
  const [treasuryAddress, setTreasuryAddress] = useState('')
  const [totalUsdValue, setTotalUsdValue] = useState('0')

  useEffect(() => {
    const checkWidth = () => {
      const width = window.innerWidth
      setSearchCollapsed(width < 1200)
    }
    checkWidth()
    window.addEventListener('resize', checkWidth)
    return () => window.removeEventListener('resize', checkWidth)
  }, [])

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
          totalUsd += parseFloat(ethers.formatUnits(balance, decimals))
        }
        
        if (usdtAddress) {
          const ERC20ABI = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)']
          const usdtContract = new ethers.Contract(usdtAddress, ERC20ABI, provider)
          const balance = await usdtContract.balanceOf(treasuryAddress)
          const decimals = await usdtContract.decimals()
          totalUsd += parseFloat(ethers.formatUnits(balance, decimals))
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    if (value === '') {
      handleSearch('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const trimmed = inputValue.trim()
      handleSearch(trimmed)
      router.push('/mod/explore')
    }
    if (e.key === 'Escape') {
      setInputValue('')
      handleSearch('')
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-black border-b-2" style={{ borderColor: 'rgba(0, 255, 0, 0.25)' }}>
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center">
            <div className="relative">
              {searchCollapsed ? (
                <button
                  onClick={() => setSearchCollapsed(false)}
                  className="p-3 rounded-xl border-2 transition-all active:scale-95 backdrop-blur-xl"
                  style={{
                    height: '60px',
                    width: '60px',
                    backgroundColor: 'rgba(239, 220, 11, 0.1)',
                    borderColor: 'rgba(239, 220, 11, 0.4)',
                    boxShadow: '0 0 12px rgba(239, 220, 11, 0.2)'
                  }}
                  title="Search"
                >
                  <MagnifyingGlassIcon className="w-8 h-8" style={{ color: '#d8cc1bff' }} />
                </button>
              ) : (
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-7 h-7" style={{ color: '#d3d30bff' }} />
                  <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onBlur={() => !inputValue && setSearchCollapsed(window.innerWidth < 1200)}
                    placeholder="Search mods..."
                    className="border-2 text-white pl-14 pr-5 py-3.5 rounded-xl text-xl hover:shadow-lg focus:outline-none focus:ring-2 transition-all w-80 backdrop-blur-xl"
                    style={{
                      backgroundColor: 'rgba(239, 220, 11, 0.1)',
                      borderColor: 'rgba(239, 220, 11, 0.4)',
                      fontFamily: "'Courier New', 'Consolas', 'Monaco', monospace",
                      boxShadow: '0 0 12px rgba(239, 220, 11, 0.2)'
                    }}
                    autoFocus={!searchCollapsed}
                  />
                </div>
              )}
            </div>
          </div>
          
          {treasuryAddress && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-black/50 border border-purple-500/40 rounded-lg" style={{ height: '60px' }}>
                <div className="flex flex-col">
                  <span className="text-xs text-white/50 uppercase font-bold">Treasury</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/70 font-mono">
                      {treasuryAddress.slice(0, 6)}...{treasuryAddress.slice(-4)}
                    </span>
                    <CopyButton text={treasuryAddress} size="sm" />
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 px-4 py-2 bg-black/50 border border-purple-500/40 rounded-lg" style={{ height: '60px' }}>
                <div className="flex flex-col">
                  <span className="text-xs text-white/50 uppercase font-bold">Balance</span>
                  <span className="text-sm text-purple-400 font-mono font-bold">${totalUsdValue}</span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-end gap-3">
          {/* {user && <WalletCreditDisplay />} */}
          <NetworkSelector />
          <WalletHeader />
        </div>
      </div>
    </header>
  )
}
