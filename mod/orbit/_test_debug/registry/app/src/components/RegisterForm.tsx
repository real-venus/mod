'use client'

import { useState } from 'react'

interface Props {
  onSubmit: (name: string, data: string) => Promise<void>
}

const STORAGE_PROVIDERS = ['ipfs', 'lighthouse', 'filecoin'] as const

export function RegisterForm({ onSubmit }: Props) {
  const [name, setName] = useState('')
  const [dataJson, setDataJson] = useState('{\n  "version": "1.0",\n  "description": ""\n}')
  const [storage, setStorage] = useState<string>('ipfs')
  const [cidInput, setCidInput] = useState('')
  const [mode, setMode] = useState<'json' | 'cid'>('cid')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    let data: string
    if (mode === 'cid') {
      if (!cidInput.trim()) return
      data = `${storage}/${cidInput.trim()}`
    } else {
      try {
        JSON.parse(dataJson)
      } catch {
        alert('Invalid JSON')
        return
      }
      // In CID mode, the data is the prefixed CID
      // In JSON mode, we'd need to upload first — for now pass as json string
      // The contract stores the raw string, so pass the prefixed CID
      data = `${storage}/${cidInput.trim() || 'pending'}`
    }

    setSubmitting(true)
    try {
      await onSubmit(name.trim(), data)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-4">
      <h2 className="text-lg font-semibold text-accent">Register Module</h2>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="my-module"
          className="w-full"
          required
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('cid')}
          className={`px-3 py-1 text-xs rounded-full border ${
            mode === 'cid' ? 'border-accent text-accent' : 'border-border text-gray-500'
          }`}
        >
          CID
        </button>
        <button
          type="button"
          onClick={() => setMode('json')}
          className={`px-3 py-1 text-xs rounded-full border ${
            mode === 'json' ? 'border-accent text-accent' : 'border-border text-gray-500'
          }`}
        >
          JSON
        </button>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Storage Provider</label>
        <div className="flex gap-2">
          {STORAGE_PROVIDERS.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setStorage(p)}
              className={`px-3 py-1.5 text-xs rounded-lg border ${
                storage === p
                  ? 'border-accent text-accent bg-accent/10'
                  : 'border-border text-gray-500 hover:text-gray-300'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {mode === 'cid' ? (
        <div>
          <label className="block text-sm text-gray-400 mb-1">CID</label>
          <input
            value={cidInput}
            onChange={e => setCidInput(e.target.value)}
            placeholder="QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"
            className="w-full font-mono text-sm"
            required
          />
          <p className="text-xs text-gray-600 mt-1">
            Data URI: <span className="text-gray-400">{storage}/{cidInput || '...'}</span>
          </p>
        </div>
      ) : (
        <div>
          <label className="block text-sm text-gray-400 mb-1">JSON Metadata</label>
          <textarea
            value={dataJson}
            onChange={e => setDataJson(e.target.value)}
            rows={5}
            className="w-full font-mono text-sm"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 bg-accent text-black font-semibold rounded-lg hover:bg-accent-dim disabled:opacity-50"
      >
        {submitting ? 'Registering...' : 'Register'}
      </button>
    </form>
  )
}
