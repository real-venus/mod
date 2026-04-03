'use client'

import { useState } from 'react'
import { ModEntry, parseDataUri, gatewayUrl } from '@/network/registry'

interface Props {
  mod: ModEntry
  isOwner: boolean
  onRemove: () => void
  onUpdate: (data: string) => void
}

export function ModCard({ mod, isOwner, onRemove, onUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [newData, setNewData] = useState(mod.data)
  const [confirming, setConfirming] = useState(false)

  const { provider, cid } = parseDataUri(mod.data)

  const providerColor: Record<string, string> = {
    ipfs: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
    lighthouse: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
    filecoin: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:border-gray-600 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-white">{mod.name}</h3>
          <p className="text-xs text-gray-500 font-mono mt-0.5">#{mod.id}</p>
        </div>
        {provider && (
          <span className={`text-xs px-2 py-0.5 rounded-full border ${providerColor[provider] || 'text-gray-400'}`}>
            {provider}
          </span>
        )}
      </div>

      {/* Owner */}
      <div className="mb-3">
        <p className="text-xs text-gray-500">Owner</p>
        <p className="text-sm text-gray-300 font-mono truncate">{mod.owner}</p>
      </div>

      {/* Data */}
      <div className="mb-4">
        <p className="text-xs text-gray-500">Data</p>
        {editing ? (
          <div className="mt-1 space-y-2">
            <input
              value={newData}
              onChange={e => setNewData(e.target.value)}
              className="w-full text-sm font-mono"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { onUpdate(newData); setEditing(false) }}
                className="px-3 py-1 text-xs bg-accent text-black rounded-lg font-medium"
              >
                Save
              </button>
              <button
                onClick={() => { setEditing(false); setNewData(mod.data) }}
                className="px-3 py-1 text-xs border border-border text-gray-400 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <a
            href={gatewayUrl(mod.data)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent hover:underline font-mono break-all block mt-0.5"
          >
            {mod.data}
          </a>
        )}
      </div>

      {/* Owner Actions */}
      {isOwner && !editing && (
        <div className="flex gap-2 pt-3 border-t border-border">
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 text-xs border border-border text-gray-400 rounded-lg hover:text-white hover:border-gray-500"
          >
            Update
          </button>
          {confirming ? (
            <div className="flex gap-1">
              <button
                onClick={() => { onRemove(); setConfirming(false) }}
                className="px-3 py-1.5 text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="px-3 py-1.5 text-xs border border-border text-gray-500 rounded-lg"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="px-3 py-1.5 text-xs border border-border text-gray-500 rounded-lg hover:text-red-400 hover:border-red-500/30"
            >
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  )
}
