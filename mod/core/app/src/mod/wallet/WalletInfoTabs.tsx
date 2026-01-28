'use client'

import { userContext } from '@/mod/context/UserContext'
import { useState } from 'react'
import { CopyButton } from '@/mod/ui/CopyButton'
import { QRCode } from '@/mod/ui/QRCode'
import { text2color } from '@/mod/utils'
import { ArrowPathIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { Auth } from '@/mod/client/auth'
import WalletCreditDisplay from './WalletCreditDisplay'

export default function WalletInfoTabs() {
  const { user } = userContext()
  const [activeTab, setActiveTab] = useState<'details' | 'qr'>('details')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showBalanceDropdown, setShowBalanceDropdown] = useState(false)
  
  if (!user) return null
  
  const userColor = text2color(user.key)

  const handleRefreshToken = async () => {
    setIsRefreshing(true)
    try {
      const wallet_mode = localStorage.getItem('wallet_mode') || 'local'
      const wallet_address = localStorage.getItem('wallet_address')
      const auth = new Auth()
      const newToken = await auth.token('', wallet_address, wallet_mode)
      localStorage.setItem('wallet_token', newToken)
      console.log('Token refreshed successfully:', newToken)
    } catch (error) {
      console.error('Failed to refresh token:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b-2" style={{ borderColor: `${userColor}40` }}>
        <button
          onClick={() => setActiveTab('details')}
          className={`px-4 py-2 font-bold text-sm uppercase transition-all ${
            activeTab === 'details'
              ? 'border-b-2 text-white'
              : 'text-white/50 hover:text-white/70'
          }`}
          style={{
            borderColor: activeTab === 'details' ? userColor : 'transparent'
          }}
        >
          Details
        </button>
        <button
          onClick={() => setActiveTab('qr')}
          className={`px-4 py-2 font-bold text-sm uppercase transition-all ${
            activeTab === 'qr'
              ? 'border-b-2 text-white'
              : 'text-white/50 hover:text-white/70'
          }`}
          style={{
            borderColor: activeTab === 'qr' ? userColor : 'transparent'
          }}
        >
          QR Code
        </button>
      </div>

      {activeTab === 'details' ? (
        <div className="space-y-3">
          <div className="p-3 rounded-lg border-2 transition-all hover:bg-white/5" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', borderColor: `${userColor}60` }}>
            <div className="text-sm text-gray-400 mb-1 font-bold uppercase tracking-wider">Address</div>
            <div className="flex items-center gap-2">
              <code className="font-mono text-sm break-all" style={{ color: userColor }}>
                {user.key}
              </code>
              <CopyButton text={user.key} size="sm" />
            </div>
          </div>

          <div className="p-3 rounded-lg border-2 transition-all hover:bg-white/5" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', borderColor: `${userColor}60` }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-400 font-bold uppercase tracking-wider">Balance</div>
              <button
                onClick={() => setShowBalanceDropdown(!showBalanceDropdown)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-all"
              >
                <ChevronDownIcon className={`w-4 h-4 transition-transform ${showBalanceDropdown ? 'rotate-180' : ''}`} />
              </button>
            </div>
            {showBalanceDropdown && (
              <div className="space-y-2 mb-2">
                <div className="flex items-center justify-between p-2 rounded bg-black/30">
                  <span className="text-xs text-gray-400 font-bold uppercase">Native Token</span>
                  <span className="font-mono text-sm font-bold" style={{ color: userColor }}>{user.balance?.toLocaleString() || 0}</span>
                </div>
                <div className="border-t border-white/10 pt-2">
                  <WalletCreditDisplay />
                </div>
              </div>
            )}
            {!showBalanceDropdown && (
              <div className="font-mono text-lg font-bold" style={{ color: userColor }}>{user.balance?.toLocaleString() || 0}</div>
            )}
          </div>

          {user.network && (
            <div className="p-3 rounded-lg border-2 transition-all hover:bg-white/5" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', borderColor: `${userColor}60` }}>
              <div className="text-sm text-gray-400 mb-1 font-bold uppercase tracking-wider">Network Modules</div>
              <div className="font-mono text-lg font-bold" style={{ color: userColor }}>{user.mods?.length || 0}</div>
            </div>
          )}

          <div className="p-3 rounded-lg border-2 transition-all hover:bg-white/5" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', borderColor: `${userColor}60` }}>
            <div className="text-sm text-gray-400 mb-1 font-bold uppercase tracking-wider">Key Type</div>
            <div className="font-mono text-sm font-bold" style={{ color: userColor }}>{user.crypto_type || 'ecdsa'}</div>
          </div>

          <div className="p-3 rounded-lg border-2 transition-all hover:bg-white/5" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', borderColor: `${userColor}60` }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-400 font-bold uppercase tracking-wider">Auth Token</div>
              <button
                onClick={handleRefreshToken}
                disabled={isRefreshing}
                className="flex items-center gap-1 px-2 py-1 rounded border transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                style={{ borderColor: userColor, color: userColor }}
                title="Refresh Token"
              >
                <ArrowPathIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="text-xs font-bold">REFRESH</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <code className="font-mono text-xs break-all text-gray-500">
                {localStorage.getItem('wallet_token')?.substring(0, 40)}...
              </code>
              <CopyButton text={localStorage.getItem('wallet_token') || ''} size="sm" />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-6 space-y-4">
          <div className="p-4 bg-white rounded-xl">
            <QRCode value={user.key} size={250} color={userColor} />
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-400 font-bold uppercase tracking-wider mb-2">Scan to Copy Address</div>
            <code className="font-mono text-xs text-gray-500 break-all">
              {user.key.substring(0, 20)}...{user.key.substring(user.key.length - 20)}
            </code>
          </div>
        </div>
      )}
    </div>
  )
}
