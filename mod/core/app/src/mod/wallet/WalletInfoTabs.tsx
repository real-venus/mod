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
  const { user, client } = userContext()
  const [activeTab, setActiveTab] = useState<'KEY' | 'CLIENT' | 'ACCESS_TOKEN'>('KEY')
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

  useEffect(() => {
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
    fetchBalances()
  }, [user, client])

  useEffect(() => {
    const generateToken = () => {
      if (client?.auth) {
        const token = client.auth.getToken()
        setAccessToken(token)
        const expiryTime = Date.now() + 3600000 // 1 hour from now
        setTokenExpiry(expiryTime)
      }
    }

    generateToken()
    const interval = setInterval(generateToken, 3600000) // Refresh every hour

    return () => clearInterval(interval)
  }, [client])

  const handleRotateClientKey = () => {
    const newPassword = Math.random().toString(36).substring(2) + Date.now().toString(36)
    localStorage.setItem('client_key_password', newPassword)
    const newKey = new Key(newPassword, 'ecdsa')
    setClientKey(newKey)
    setShowPrivateKey(false)
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
    <div className="rounded-xl border-2 p-6" style={{ borderColor: userColor, backgroundColor: `${userColor}10` }}>
      <div className="flex gap-3 mb-6 border-b-2 pb-2" style={{ borderColor: `${userColor}40` }}>
        <button
          onClick={() => setActiveTab('KEY')}
          className={`px-6 py-3 font-bold text-base transition-all rounded-t-lg ${
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
          onClick={() => setActiveTab('CLIENT')}
          className={`px-6 py-3 font-bold text-base transition-all rounded-t-lg ${
            activeTab === 'CLIENT' ? 'border-b-4' : 'opacity-60 hover:opacity-90'
          }`}
          style={{
            color: userColor,
            borderColor: activeTab === 'CLIENT' ? userColor : 'transparent',
            backgroundColor: activeTab === 'CLIENT' ? `${userColor}15` : 'transparent'
          }}
        >
          💼 CLIENT
        </button>
        <button
          onClick={() => setActiveTab('ACCESS_TOKEN')}
          className={`px-6 py-3 font-bold text-base transition-all rounded-t-lg ${
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
          {/* Balance Display */}
          <div className="p-4 rounded-lg border-2 mb-4" style={{ backgroundColor: 'rgba(0, 0, 0, 1)', borderColor: `${userColor}60` }}>
            <div className="text-xs text-gray-400 mb-2">{activeTab === 'KEY' ? 'key balance' : 'client key balance'}</div>
            <div className="text-2xl text-green-400 font-bold">
              {loading ? 'Loading...' : `$${displayBalance.toFixed(2)}`}
            </div>
          </div>

          {/* Address Display */}
          <div className="bg-black/30 rounded-lg p-4 border-2" style={{ borderColor: `${userColor}30` }}>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-black/50 border" style={{ borderColor: `${userColor}20` }}>
              <div className="font-mono text-base flex-1 break-all" style={{ color: userColor }}>
                {shorten(displayAddress, 8, 8)}
              </div>
              <CopyButton text={displayAddress} size="sm" />
            </div>
          </div>
        </>
      )}

      {activeTab === 'CLIENT' && clientKey && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-4 p-3 bg-black/30 rounded-lg border-2" style={{ borderColor: `${userColor}30` }}>
            <button
              onClick={handleRotateClientKey}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg hover:bg-white/10 transition-all border-2"
              style={{ color: userColor, borderColor: `${userColor}40` }}
              title="Rotate client key"
            >
              <ArrowPathIcon className="w-4 h-4" />
              🔄 Rotate
            </button>
          </div>

          <div className="bg-black/30 rounded-lg p-4 border-2" style={{ borderColor: `${userColor}30` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-bold uppercase tracking-wider" style={{ color: `${userColor}90` }}>
                🔐 Private Key (Hot Wallet)
              </div>
              <button
                onClick={() => setShowPrivateKey(!showPrivateKey)}
                className="p-2 hover:bg-white/10 rounded-lg transition-all border-2"
                style={{ borderColor: `${userColor}30` }}
                title={showPrivateKey ? 'Hide' : 'Show'}
              >
                {showPrivateKey ? (
                  <EyeSlashIcon className="w-5 h-5" style={{ color: userColor }} />
                ) : (
                  <EyeIcon className="w-5 h-5" style={{ color: userColor }} />
                )}
              </button>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-black/50 border" style={{ borderColor: `${userColor}20` }}>
              <div className="font-mono text-sm flex-1 break-all" style={{ color: userColor }}>
                {showPrivateKey ? clientKey.private_key : '••••••••••••••••••••••••••••••••••••••••••••'}
              </div>
              {showPrivateKey && <CopyButton text={clientKey.private_key} size="sm" />}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ACCESS_TOKEN' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border-2" style={{ backgroundColor: 'rgba(0, 0, 0, 1)', borderColor: `${userColor}60` }}>
            <div className="text-xs text-gray-400 mb-2">Token Expires In</div>
            <div className="text-2xl text-green-400 font-bold">
              {getTimeRemaining()}
            </div>
          </div>

          {/* Sub-tabs for Token Data, Token, and Signature */}
          <div className="flex gap-2 mb-4 border-b border-white/20 pb-2">
            <button
              onClick={() => setActiveTokenSubTab('DATA')}
              className={`px-4 py-2 font-bold text-sm transition-all rounded-t ${
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
              className={`px-4 py-2 font-bold text-sm transition-all rounded-t ${
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
              className={`px-4 py-2 font-bold text-sm transition-all rounded-t ${
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
            <div className="bg-black/30 rounded-lg p-4 border-2" style={{ borderColor: `${userColor}30` }}>
              <div className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: `${userColor}90` }}>
                📊 Token Data
              </div>
              <div className="space-y-2">
                <div className="p-3 bg-black/50 rounded border" style={{ borderColor: `${userColor}20` }}>
                  <div className="text-xs text-gray-400 mb-1">Data</div>
                  <div className="font-mono text-xs break-all" style={{ color: userColor }}>{tokenData.data || 'N/A'}</div>
                </div>
                <div className="p-3 bg-black/50 rounded border" style={{ borderColor: `${userColor}20` }}>
                  <div className="text-xs text-gray-400 mb-1">Time</div>
                  <div className="font-mono text-xs" style={{ color: userColor }}>{tokenData.time}</div>
                </div>
                <div className="p-3 bg-black/50 rounded border" style={{ borderColor: `${userColor}20` }}>
                  <div className="text-xs text-gray-400 mb-1">Key</div>
                  <div className="font-mono text-xs break-all" style={{ color: userColor }}>{shorten(tokenData.key, 12, 12)}</div>
                </div>
                <div className="p-3 bg-black/50 rounded border" style={{ borderColor: `${userColor}20` }}>
                  <div className="text-xs text-gray-400 mb-1">Data Hash</div>
                  <div className="font-mono text-xs break-all" style={{ color: userColor }}>{tokenData.dataHash || 'N/A'}</div>
                </div>
              </div>
            </div>
          )}

          {activeTokenSubTab === 'TOKEN' && (
            <div className="bg-black/30 rounded-lg p-4 border-2" style={{ borderColor: `${userColor}30` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold uppercase tracking-wider" style={{ color: `${userColor}90` }}>
                  🎫 Access Token (Auto-Regenerates Every Hour)
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-black/50 border" style={{ borderColor: `${userColor}20` }}>
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
            <div className="bg-black/30 rounded-lg p-4 border-2" style={{ borderColor: `${userColor}30` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold uppercase tracking-wider" style={{ color: `${userColor}90` }}>
                  ✍️ Token Signature
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-black/50 border" style={{ borderColor: `${userColor}20` }}>
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
