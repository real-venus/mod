'use client'

import { useState } from 'react'
import { userContext } from '@/mod/context/UserContext'
import { CopyButton } from '@/mod/ui/CopyButton'
import { shorten } from '@/mod/utils'

export function ClientDisplay() {
  const { user } = userContext()
  const [showGenerator, setShowGenerator] = useState(false)
  const [newMnemonic, setNewMnemonic] = useState('')

  const generateNewKey = async () => {
    try {
      const { Key } = await import('@/mod/key')
      const newKey = new Key()
      setNewMnemonic(newKey.mnemonic)
      setShowGenerator(true)
    } catch (err) {
      console.error('Failed to generate key:', err)
    }
  }

  if (!user?.client) return null

  const clientUrl = user.client.url
  const clientKey = user.client.key?.address || user.key

  return (
    <div className="space-y-4 p-6 bg-black/60 border-2 border-green-500/40 rounded-xl backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-green-400 text-xl font-bold uppercase" style={{ fontFamily: 'Press Start 2P, monospace' }}>client info</h3>
        <button
          onClick={generateNewKey}
          className="px-4 py-2 bg-green-500/20 text-green-400 border-2 border-green-500/40 hover:bg-green-500/30 rounded-lg transition-all font-bold"
          style={{ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'lowercase' }}
        >
          🔑 generate new key
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-gray-400 text-sm mb-1 block">API URL</label>
          <div className="flex items-center gap-2 bg-black/40 border border-green-500/30 rounded-lg px-3 py-2">
            <span className="text-green-300 font-mono text-sm flex-1">{clientUrl}</span>
            <CopyButton text={clientUrl} size="sm" />
          </div>
        </div>

        <div>
          <label className="text-gray-400 text-sm mb-1 block">Client Key</label>
          <div className="flex items-center gap-2 bg-black/40 border border-green-500/30 rounded-lg px-3 py-2">
            <span className="text-green-300 font-mono text-sm flex-1">{shorten(clientKey, 12, 12)}</span>
            <CopyButton text={clientKey} size="sm" />
          </div>
        </div>
      </div>

      {showGenerator && newMnemonic && (
        <div className="mt-4 p-4 bg-yellow-500/10 border-2 border-yellow-500/40 rounded-lg">
          <h4 className="text-yellow-400 font-bold mb-2" style={{ fontFamily: 'Press Start 2P, monospace', fontSize: '0.8rem' }}>⚠️ new key generated</h4>
          <p className="text-yellow-300 text-xs mb-3">save this mnemonic phrase securely. you will need it to access this key.</p>
          <div className="bg-black/60 border border-yellow-500/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <span className="text-yellow-200 font-mono text-sm flex-1 break-all">{newMnemonic}</span>
              <CopyButton text={newMnemonic} size="sm" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
