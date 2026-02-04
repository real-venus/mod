'use client'

import { Market } from '@/mod/network/Market'
import { useState, useEffect } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { text2color } from '@/mod/utils'
import { userContext } from '@/mod/context/UserContext'
import { CopyButton } from '@/mod/ui/CopyButton'
import { QRCode } from '@/mod/ui/QRCode'
import { QrCodeIcon } from '@heroicons/react/24/outline'
import modConfig from '@/app/mod.json'

type TokenType = 'USDC' | 'USDT' | 'MARKET'

export default function WalletCreditDisplay() {
  const { user, network } = userContext()
  const [marketCredit, setMarketCredit] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedToken, setSelectedToken] = useState<TokenType>('USDC')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showAddressQr, setShowAddressQr] = useState(false)
  const [currentTokenAddress, setCurrentTokenAddress] = useState('')

  if (!user) return null

  const userColor = text2color(user.key)

  const refreshCredit = async () => {
    if (!user?.key || typeof window === 'undefined' || !window.ethereum) {
      setMarketCredit(0)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const market = new Market(modConfig.chain.testnet)
      const tokenAddress = market.getTokenAddress(selectedToken)
      setCurrentTokenAddress(tokenAddress)
      const credit = await market.checkBalance(user.key, selectedToken)
      setMarketCredit(credit)
    } catch (error) {
      console.error('Failed to fetch market credit:', error)
      setMarketCredit(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshCredit()
  }, [user?.key, selectedToken])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refreshCredit()
    setIsRefreshing(false)
  }

  const handleTokenToggle = (token: TokenType) => {
    setSelectedToken(token)
  }

  return (
    <div className="p-3 rounded-lg border-2 transition-all hover:bg-white/5" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', borderColor: `${userColor}60` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-400 font-bold uppercase tracking-wider">Market Balance</div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <button
              onClick={() => handleTokenToggle('USDC')}
              className={`px-2 py-1 text-xs font-bold rounded transition-all ${
                selectedToken === 'USDC'
                  ? 'bg-opacity-30 border'
                  : 'bg-opacity-10 border border-transparent hover:border-white/20'
              }`}
              style={{
                backgroundColor: selectedToken === 'USDC' ? `${userColor}30` : `${userColor}10`,
                borderColor: selectedToken === 'USDC' ? userColor : 'transparent',
                color: userColor
              }}
            >
              USDC
            </button>
            <button
              onClick={() => handleTokenToggle('USDT')}
              className={`px-2 py-1 text-xs font-bold rounded transition-all ${
                selectedToken === 'USDT'
                  ? 'bg-opacity-30 border'
                  : 'bg-opacity-10 border border-transparent hover:border-white/20'
              }`}
              style={{
                backgroundColor: selectedToken === 'USDT' ? `${userColor}30` : `${userColor}10`,
                borderColor: selectedToken === 'USDT' ? userColor : 'transparent',
                color: userColor
              }}
            >
              USDT
            </button>
            <button
              onClick={() => handleTokenToggle('MARKET')}
              className={`px-2 py-1 text-xs font-bold rounded transition-all ${
                selectedToken === 'MARKET'
                  ? 'bg-opacity-30 border'
                  : 'bg-opacity-10 border border-transparent hover:border-white/20'
              }`}
              style={{
                backgroundColor: selectedToken === 'MARKET' ? `${userColor}30` : `${userColor}10`,
                borderColor: selectedToken === 'MARKET' ? userColor : 'transparent',
                color: userColor
              }}
            >
              MARKET
            </button>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || loading}
            className="flex items-center gap-1 px-2 py-1 rounded border transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            style={{ borderColor: userColor, color: userColor }}
            title="Refresh Balance"
          >
            <ArrowPathIcon className={`w-4 h-4 ${isRefreshing || loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      <div className="font-mono text-lg font-bold mb-2" style={{ color: userColor }}>
        {loading ? 'Loading...' : `${marketCredit.toFixed(8)} ${selectedToken}`}
      </div>
      
      <div className="mt-3 pt-3 border-t-2" style={{ borderColor: `${userColor}40` }}>
        <div className="text-xs text-gray-400 mb-1 font-bold uppercase tracking-wider">Token Address</div>
        <div className="flex items-center gap-2">
          <code className="font-mono text-xs break-all text-gray-500">
            {currentTokenAddress.substring(0, 20)}...{currentTokenAddress.substring(currentTokenAddress.length - 10)}
          </code>
          <CopyButton text={currentTokenAddress} size="sm" showValueOnHover={true} />
          <div 
            className="relative"
            onMouseEnter={() => setShowAddressQr(true)}
            onMouseLeave={() => setShowAddressQr(false)}
          >
            <QrCodeIcon className="h-5 w-5 cursor-pointer" style={{ color: userColor }} />
            {showAddressQr && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-black/95 rounded-lg border-2 z-50 shadow-2xl" style={{ borderColor: userColor }}>
                <QRCode value={currentTokenAddress} size={120} color={userColor} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
