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
  const [activeTab, setActiveTab] = useState<'KEY' | 'CLIENT'>('KEY')
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [clientKey, setClientKey] = useState<Key | null>(null)
  const [keyBalance, setKeyBalance] = useState<number>(0)
  const [clientKeyBalance, setClientKeyBalance] = useState<number>(0)
  const [loading, setLoading] = useState(false)

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

  const handleRotateClientKey = () => {
    const newPassword = Math.random().toString(36).substring(2) + Date.now().toString(36)
    localStorage.setItem('client_key_password', newPassword)
    const newKey = new Key(newPassword, 'ecdsa')
    setClientKey(newKey)
    setShowPrivateKey(false)
  }

  if (!user || !client) return null

  const userColor = '#00ff00'
  const displayBalance = activeTab === 'KEY' ? keyBalance : clientKeyBalance
  const displayAddress = activeTab === 'KEY' ? user.key : (clientKey?.address || '')

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
      </div>

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
    </div>
  )
}

export default WalletInfoTabs