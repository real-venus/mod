'use client'

import { useState, useEffect } from 'react'
import { userContext } from '@/mod/context'
import { CopyButton } from '@/mod/ui/CopyButton'
import { EyeIcon, EyeSlashIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { Key } from '@/mod/key'
import { ethers } from 'ethers'
import modConfig from '@/app/mod.json'
import MarketABI from '@/mod/contracts/abi/market/Market.sol/Market.json'
import { shorten } from '@/mod/utils'

async function getKeyBalance(address: string): Promise<number> {
  const provider = new ethers.BrowserProvider(window.ethereum)
  const marketAddress = modConfig.chain['testnet'].contracts.Market.address
  const marketContract = new ethers.Contract(marketAddress, MarketABI.abi, provider)
  
  let balance = await marketContract.balanceOf(address)
  let decimals = await marketContract.decimals()
  decimals = Number(decimals) + 10
  balance = parseFloat(ethers.formatUnits(balance, decimals))
  return balance
}

export function WalletInfoTabs() {
  const { user, client, signIn } = userContext()
  const [activeTab, setActiveTab] = useState<'KEY' | 'ACCESS_TOKEN'>('KEY')
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [clientKey, setClientKey] = useState<Key | null>(null)
  const [keyBalance, setKeyBalance] = useState<number>(0)
  const [clientKeyBalance, setClientKeyBalance] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [accessToken, setAccessToken] = useState<string>('')
  const [tokenExpiry, setTokenExpiry] = useState<number>(0)
  const [activeTokenSubTab, setActiveTokenSubTab] = useState<'DATA' | 'TOKEN' | 'SIGNATURE'>('DATA')

  useEffect(() => {
    const initClientKey = () => {
      let password = localStorage.getItem('client_key_password')
      if (!password) {
        password = Math.random().toString(36).substring(2) + Date.now().toString(36)
        localStorage.setItem('client_key_password', password)
      }
      const key = new Key(password, 'ecdsa')
      setClientKey(key)
    }
    initClientKey()
  }, [])

  const fetchBalances = async () => {
    if (user && client && window.ethereum) {
      setLoading(true)
      try {
        const balance = await getKeyBalance(user.key)
        setKeyBalance(balance)
      } catch (error) {
        console.error('Error fetching key balance:', error)
      }
      try {
        const clientbalance = await getKeyBalance(client.key.address)
        setClientKeyBalance(clientbalance)
      } catch (error) {
        console.error('Error fetching client key balance:', error)
      }
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBalances()
  }, [user, client])

  const generateToken = async () => {
    if (client?.auth) {
      console.log('Generating token for user key:', user?.key)
      const token = client.token
      setAccessToken(token)
      const expiryTime = Date.now() + 3600000
      setTokenExpiry(expiryTime)
    }
  }

  useEffect(() => {
    generateToken()
    const interval = setInterval(generateToken, 3600000)
    return () => clearInterval(interval)
  }, [client])


  const handleRefreshToken = async () => {
    await signIn()
    await generateToken()
  }

  const handleRefreshBalance = async () => {
    await fetchBalances()

  }

  const getTimeRemaining = () => {
    const remaining = tokenExpiry - Date.now()
    if (remaining <= 0) return 'Expired'
    const minutes = Math.floor(remaining / 60000)
    const seconds = Math.floor((remaining % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  const parseTokenData = () => {
    if (!accessToken) return null
    try {
      const decoded = client?.auth?.token2data(accessToken)
      return decoded
    } catch (error) {
      console.error('Error parsing token:', error)
      return null
    }
  }

  if (!user || !client) return null

  const userColor = '#00ff00'
  const displayBalance = activeTab === 'KEY' ? keyBalance : clientKeyBalance
  const displayAddress = activeTab === 'KEY' ? user.key : (clientKey?.address || '')
  const tokenData = parseTokenData()

  return (
    <div className="rounded-xl border-2 p-6 shadow-2xl backdrop-blur-sm" style={{ borderColor: userColor, backgroundColor: `${userColor}10` }}>
      <div className="flex gap-3 mb-6 border-b-2 pb-2" style={{ borderColor: `${userColor}40` }}>
        <button
          onClick={() => setActiveTab('KEY')}
          className={`px-6 py-3 font-bold text-base transition-all rounded-t-lg hover:scale-105 ${
            activeTab === 'KEY' ? 'border-b-4' : 'opacity-60 hover:opacity-90'
          }`}
          style={{
            color: userColor,
            borderColor: activeTab === 'KEY' ? userColor : 'transparent',
            backgroundColor: activeTab === 'KEY' ? `${userColor}15` : 'transparent'
          }}
        >
          🔑 KEY
        </button>

        <button
          onClick={() => setActiveTab('ACCESS_TOKEN')}
          className={`px-6 py-3 font-bold text-base transition-all rounded-t-lg hover:scale-105 ${
            activeTab === 'ACCESS_TOKEN' ? 'border-b-4' : 'opacity-60 hover:opacity-90'
          }`}
          style={{
            color: userColor,
            borderColor: activeTab === 'ACCESS_TOKEN' ? userColor : 'transparent',
            backgroundColor: activeTab === 'ACCESS_TOKEN' ? `${userColor}15` : 'transparent'
          }}
        >
          🎫 ACCESS TOKEN
        </button>
      </div>

      {activeTab !== 'ACCESS_TOKEN' && (
        <>
          {/* Balance Display with Refresh */}
          <div className="p-5 rounded-lg border-2 mb-4 shadow-lg" style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', borderColor: `${userColor}60` }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                {activeTab === 'KEY' ? '🔑 Key Balance' : '💼 Client Key Balance'}
              </div>
              <button
                onClick={handleRefreshBalance}
                className="flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg hover:bg-white/10 transition-all border"
                style={{ color: userColor, borderColor: `${userColor}40` }}
                title="Refresh balance"
              >
                <ArrowPathIcon className="w-4 h-4" />
                Refresh
              </button>
            </div>
            <div className="text-3xl font-bold" style={{ color: userColor }}>
              {loading ? '⏳ Loading...' : `$${displayBalance.toFixed(2)}`}
            </div>
          </div>

          {/* Address Display */}
          <div className="bg-black/40 rounded-lg p-4 border-2 shadow-md" style={{ borderColor: `${userColor}30` }}>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-black/60 border" style={{ borderColor: `${userColor}20` }}>
              <div className="font-mono text-base flex-1 break-all" style={{ color: userColor }}>
                {shorten(displayAddress, 8, 8)}
              </div>
              <CopyButton text={displayAddress} size="sm" />
            </div>
          </div>
        </>
      )}

      {activeTab === 'ACCESS_TOKEN' && (
        <div className="space-y-4">
          <div className="p-5 rounded-lg border-2 shadow-lg" style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', borderColor: `${userColor}60` }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">⏱️ Token Expires In</div>
              <button
                onClick={handleRefreshToken}
                className="flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg hover:bg-white/10 transition-all border"
                style={{ color: userColor, borderColor: `${userColor}40` }}
                title="Refresh token"
              >
                <ArrowPathIcon className="w-4 h-4" />
                Refresh
              </button>
            </div>
            <div className="text-3xl font-bold" style={{ color: userColor }}>
              {getTimeRemaining()}
            </div>
          </div>

          {/* Sub-tabs for Token Data, Token, and Signature */}
          <div className="flex gap-2 mb-4 border-b border-white/20 pb-2">
            <button
              onClick={() => setActiveTokenSubTab('DATA')}
              className={`px-4 py-2 font-bold text-sm transition-all rounded-t hover:scale-105 ${
                activeTokenSubTab === 'DATA' ? 'border-b-2' : 'opacity-60 hover:opacity-90'
              }`}
              style={{
                color: userColor,
                borderColor: activeTokenSubTab === 'DATA' ? userColor : 'transparent',
                backgroundColor: activeTokenSubTab === 'DATA' ? `${userColor}10` : 'transparent'
              }}
            >
              📊 DATA
            </button>
            <button
              onClick={() => setActiveTokenSubTab('TOKEN')}
              className={`px-4 py-2 font-bold text-sm transition-all rounded-t hover:scale-105 ${
                activeTokenSubTab === 'TOKEN' ? 'border-b-2' : 'opacity-60 hover:opacity-90'
              }`}
              style={{
                color: userColor,
                borderColor: activeTokenSubTab === 'TOKEN' ? userColor : 'transparent',
                backgroundColor: activeTokenSubTab === 'TOKEN' ? `${userColor}10` : 'transparent'
              }}
            >
              🎫 TOKEN
            </button>
            <button
              onClick={() => setActiveTokenSubTab('SIGNATURE')}
              className={`px-4 py-2 font-bold text-sm transition-all rounded-t hover:scale-105 ${
                activeTokenSubTab === 'SIGNATURE' ? 'border-b-2' : 'opacity-60 hover:opacity-90'
              }`}
              style={{
                color: userColor,
                borderColor: activeTokenSubTab === 'SIGNATURE' ? userColor : 'transparent',
                backgroundColor: activeTokenSubTab === 'SIGNATURE' ? `${userColor}10` : 'transparent'
              }}
            >
              ✍️ SIGNATURE
            </button>
          </div>

          {/* Token Sub-tab Content */}
          {activeTokenSubTab === 'DATA' && tokenData && (
            <div className="bg-black/40 rounded-lg p-4 border-2 shadow-md" style={{ borderColor: `${userColor}30` }}>
              <div className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: `${userColor}90` }}>
                📊 Token Data
              </div>
              <div className="space-y-2">
                <div className="p-3 bg-black/60 rounded border" style={{ borderColor: `${userColor}20` }}>
                  <div className="text-xs text-gray-400 mb-1 font-semibold">Data</div>
                  <div className="font-mono text-xs break-all" style={{ color: userColor }}>{tokenData.data || 'N/A'}</div>
                </div>
                <div className="p-3 bg-black/60 rounded border" style={{ borderColor: `${userColor}20` }}>
                  <div className="text-xs text-gray-400 mb-1 font-semibold">Time</div>
                  <div className="font-mono text-xs" style={{ color: userColor }}>{tokenData.time}</div>
                </div>
                <div className="p-3 bg-black/60 rounded border" style={{ borderColor: `${userColor}20` }}>
                  <div className="text-xs text-gray-400 mb-1 font-semibold">Key</div>
                  <div className="font-mono text-xs break-all" style={{ color: userColor }}>{shorten(tokenData.key, 12, 12)}</div>
                </div>
                <div className="p-3 bg-black/60 rounded border" style={{ borderColor: `${userColor}20` }}>
                  <div className="text-xs text-gray-400 mb-1 font-semibold">Data Hash</div>
                  <div className="font-mono text-xs break-all" style={{ color: userColor }}>{tokenData.dataHash || 'N/A'}</div>
                </div>
              </div>
            </div>
          )}

          {activeTokenSubTab === 'TOKEN' && (
            <div className="bg-black/40 rounded-lg p-4 border-2 shadow-md" style={{ borderColor: `${userColor}30` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold uppercase tracking-wider" style={{ color: `${userColor}90` }}>
                  🎫 Access Token (Auto-Regenerates Every Hour)
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-black/60 border" style={{ borderColor: `${userColor}20` }}>
                <div className="font-mono text-xs flex-1 break-all" style={{ color: userColor }}>
                  {accessToken || 'Generating...'}
                </div>
                {accessToken && <CopyButton text={accessToken} size="sm" />}
              </div>
              <div className="mt-3 p-3 bg-yellow-900/20 border-2 border-yellow-500/40 rounded-lg">
                <p className="text-yellow-400 text-xs font-bold">⚠️ This token is used to authenticate API requests. It regenerates automatically every hour when you sign in with your wallet.</p>
              </div>
            </div>
          )}

          {activeTokenSubTab === 'SIGNATURE' && tokenData && (
            <div className="bg-black/40 rounded-lg p-4 border-2 shadow-md" style={{ borderColor: `${userColor}30` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold uppercase tracking-wider" style={{ color: `${userColor}90` }}>
                  ✍️ Token Signature
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-black/60 border" style={{ borderColor: `${userColor}20` }}>
                <div className="font-mono text-xs flex-1 break-all" style={{ color: userColor }}>
                  {tokenData.signature}
                </div>
                <CopyButton text={tokenData.signature} size="sm" />
              </div>
              <div className="mt-3 p-3 bg-blue-900/20 border-2 border-blue-500/40 rounded-lg">
                <p className="text-blue-400 text-xs font-bold">🔐 This signature proves the authenticity of the token data.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default WalletInfoTabs
