'use client'

import { useState } from 'react'
import { CodeBracketIcon as CodeBracketIcon, ArrowPathIcon as Loader2, CheckCircleIcon as CheckCircle, ExclamationCircleIcon as AlertCircle } from '@heroicons/react/24/outline'
import { userContext } from '@/mod/context'

const ui = {
  bg: '#0b0b0b',
  panel: '#121212',
  border: '#2a2a2a',
  text: '#e7e7e7',
  textDim: '#a8a8a8',
  purple: '#a855f7',
}

export default function ForkModule() {
  const { client, user } = userContext()
  const [sourceModule, setSourceModule] = useState('')
  const [newModName, setNewModName] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFork = async () => {
    if (!sourceModule || !newModName || !githubUrl || !client) return
    
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await client.call('call', {
        fn: 'api/fork',
        params: {
          source: sourceModule,
          mod: newModName,
          url: githubUrl,
          key: user?.key
        },
        url: 'api'
      })
      
      setResult(response)
    } catch (err: any) {
      setError(err?.message || 'Failed to fork module')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold mb-2" style={{ color: ui.textDim }}>
            Source Module to Fork
          </label>
          <input
            type="text"
            value={sourceModule}
            onChange={(e) => setSourceModule(e.target.value)}
            placeholder="original-module-name"
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
            New Module Name
          </label>
          <input
            type="text"
            value={newModName}
            onChange={(e) => setNewModName(e.target.value)}
            placeholder="my-forked-module"
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
            GitHub Repository URL
          </label>
          <input
            type="text"
            onChange={(e) => setGithubUrl(e.target.value)}
            placeholder="https://github.com/username/forked-repo"
            className="w-full px-4 py-3 rounded-lg border-2 outline-none"
            style={{
              backgroundColor: ui.panel,
              borderColor: ui.border,
              color: ui.text
            }}
          />
        </div>

        <button
          onClick={handleFork}
          disabled={!sourceModule || !newModName || !githubUrl || loading}
          className="w-full py-4 rounded-lg font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-3"
          style={{
            backgroundColor: `${ui.purple}20`,
            borderColor: ui.purple,
            color: ui.purple,
            border: '2px solid'
          }}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>FORKING...</span>
            </>
          ) : (
            <>
              <CodeBracketIcon className="w-5 h-5" />
              <span>FORK MODULE FROM GITHUB</span>
            </>
          )}
        </button>
      </div>

      {result && (
        <div className="p-4 rounded-lg border-2" style={{ backgroundColor: `${ui.purple}10`, borderColor: ui.purple }}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5" style={{ color: ui.purple }} />
            <span className="font-bold" style={{ color: ui.purple }}>MODULE FORKED</span>
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
