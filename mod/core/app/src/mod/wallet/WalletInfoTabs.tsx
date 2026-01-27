'use client'

import { userContext } from '@/mod/context/UserContext'
import { useState } from 'react'
import { CopyButton } from '@/mod/ui/CopyButton'
import { QRCode } from '@/mod/ui/QRCode'
import { text2color } from '@/mod/utils'

export default function WalletInfoTabs() {
  const { user } = userContext()
  const [activeTab, setActiveTab] = useState<'details' | 'qr'>('details')
  
  if (!user) return null
  
  const userColor = text2color(user.key)

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

          {user.balance !== undefined && (
            <div className="p-3 rounded-lg border-2 transition-all hover:bg-white/5" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', borderColor: `${userColor}60` }}>
              <div className="text-sm text-gray-400 mb-1 font-bold uppercase tracking-wider">Balance</div>
              <div className="font-mono text-lg font-bold" style={{ color: userColor }}>{user.balance?.toLocaleString() || 0}</div>
            </div>
          )}

          <div className="p-3 rounded-lg border-2 transition-all hover:bg-white/5" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', borderColor: `${userColor}60` }}>
            <div className="text-sm text-gray-400 mb-1 font-bold uppercase tracking-wider">Key Type</div>
            <div className="font-mono text-sm font-bold" style={{ color: userColor }}>{user.crypto_type || 'ecdsa'}</div>
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
