'use client'

import { useState } from 'react'
import { PlusIcon, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { userContext } from '@/mod/context'

const ui = {
  bg: '#0b0b0b',
  panel: '#121212',
  border: '#2a2a2a',
  text: '#e7e7e7',
  textDim: '#a8a8a8',
  green: '#10b981',
}

const inferNameFromUrl = async (url: string, client: any): Promise<string> => {
  // Check if it's a CID (IPFS hash)
  if (url.match(/^(Qm[a-zA-Z0-9]{44}|baf[a-zA-Z0-9]+)$/)) {
    try {
      if (!client) return ''
      const data = await client.call('get', { cid: url })
      if (typeof data === 'object' && data.name) {
        return data.name
      }
    } catch (err) {
      console.error('Failed to fetch CID data:', err)
    }
  }
  
  // For git URLs, extract repo name
  if (url.includes('github.com') || url.includes('gitlab.com') || url.includes('bitbucket.org')) {
    let name = url.split('/').pop() || ''
    name = name.endsWith('.git') ? name.slice(0, -4) : name
    return name.toLowerCase()
  }
  
  return ''
}

export default function CreateModule() {
  const { client, user } = userContext()
  const [githubUrl, setGithubUrl] = useState('')
  const [modName, setModName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleUrlChange = async (value: string) => {
    setGithubUrl(value)
    
    // Auto-infer name if URL is provided
    if (value.trim() && !modName) {
      const inferredName = await inferNameFromUrl(value.trim(), client)
      if (inferredName) {
        setModName(inferredName)
      }
    }
  }

  const handleCreate = async () => {
    if (!githubUrl || !client) return
    
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await client.call('call', {
        fn: 'api/reg',
        params: {
          mod: modName || undefined,
          url: githubUrl,
          key: user?.key
        },
        url: 'api'
      })
      
      setResult(response)
    } catch (err: any) {
      setError(err?.message || 'Failed to create module')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold mb-2" style={{ color: ui.textDim }}>
            GitHub Repository URL or IPFS CID
          </label>
          <input
            type="text"
            value={githubUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://github.com/username/repo or Qm..."
            className="w-full px-4 py-3 rounded-lg border-2 outline-none"
            style={{
              backgroundColor: ui.panel,
              borderColor: ui.border,
              color: ui.text
            }}
          />
        </div>

        <div>
          <label className="block text-sm font-bold mb-2" style={{ color: ui.textDim }}>
            Module Name (optional - auto-inferred from URL)
          </label>
          <input
            type="text"
            value={modName}
            onChange={(e) => setModName(e.target.value)}
            placeholder="my-awesome-module"
            className="w-full px-4 py-3 rounded-lg border-2 outline-none"
            style={{
              backgroundColor: ui.panel,
              borderColor: ui.border,
              color: ui.text
            }}
          />
        </div>

        <button
          onClick={handleCreate}
          disabled={!githubUrl || loading}
          className="w-full py-4 rounded-lg font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-3"
          style={{
            backgroundColor: `${ui.green}20`,
            borderColor: ui.green,
            color: ui.green,
            border: '2px solid'
          }}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>CREATING...</span>
            </>
          ) : (
            <>
              <PlusIcon className="w-5 h-5" />
              <span>CREATE MODULE</span>
            </>
          )}
        </button>
      </div>

      {result && (
        <div className="p-4 rounded-lg border-2" style={{ backgroundColor: `${ui.green}10`, borderColor: ui.green }}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5" style={{ color: ui.green }} />
            <span className="font-bold" style={{ color: ui.green }}>MODULE CREATED</span>
          </div>
          <pre className="text-sm overflow-x-auto" style={{ color: ui.textDim }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg border-2" style={{ backgroundColor: '#ef444410', borderColor: '#ef4444' }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5" style={{ color: '#ef4444' }} />
            <span className="font-bold" style={{ color: '#ef4444' }}>ERROR</span>
          </div>
          <p style={{ color: '#ef4444' }}>{error}</p>
        </div>
      )}
    </div>
  )
}
