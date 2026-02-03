'use client'

import { useState, useEffect } from 'react'
import { CodeBracketIcon, Loader2, CheckCircle, AlertCircle } from '@heroicons/react/24/outline'
import { userContext } from '@/mod/context'
import ModuleSelector from './ModuleSelector'

const ui = {
  bg: '#0b0b0b',
  panel: '#121212',
  border: '#2a2a2a',
  text: '#e7e7e7',
  textDim: '#a8a8a8',
  purple: '#a855f7',
}

export default function ForkModuleEnhanced() {
  const { client, user } = userContext()
  const [sourceModule, setSourceModule] = useState('')
  const [newModName, setNewModName] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [owner, setOwner] = useState<string>('')
  const [showSelector, setShowSelector] = useState(false)

  // Default owner to current user's key
  useEffect(() => {
    if (user?.key && !owner) {
      setOwner(user.key)
    }
  }, [user, owner])

  const handleFork = async () => {
    if (!sourceModule || !newModName || !client) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // If no GitHub URL provided, fork from base module
      const forkParams: any = {
        source: sourceModule,
        mod: newModName,
        key: owner || user?.key
      }

      // Only include URL if provided
      if (githubUrl.trim()) {
        forkParams.url = githubUrl
      }

      const response = await client.call('call', {
        fn: 'api/fork',
        params: forkParams,
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
        {/* Owner Input */}
        <div>
          <label className="block text-sm font-bold mb-2" style={{ color: ui.textDim }}>
            Owner Address (defaults to your address)
          </label>
          <input
            type="text"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder={user?.key || "Enter owner address"}
            className="w-full px-4 py-3 rounded-lg border-2 outline-none font-mono"
            style={{
              backgroundColor: ui.panel,
              borderColor: ui.border,
              color: ui.text
            }}
          />
        </div>

        {/* Module Selector Toggle */}
        <div>
          <button
            onClick={() => setShowSelector(!showSelector)}
            className="w-full py-3 rounded-lg font-bold transition-all border-2"
            style={{
              backgroundColor: `${ui.purple}10`,
              borderColor: ui.purple,
              color: ui.purple
            }}
          >
            {showSelector ? 'Hide' : 'Show'} Available Modules
          </button>
        </div>

        {/* Module Selector */}
        {showSelector && (
          <div className="p-4 rounded-lg border-2" style={{ backgroundColor: ui.panel, borderColor: ui.border }}>
            <ModuleSelector 
              onSelect={(name) => {
                setSourceModule(name)
                setShowSelector(false)
              }}
              selectedModule={sourceModule}
              filterByOwner={owner}
            />
          </div>
        )}

        {/* Source Module Input */}
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

        {/* New Module Name */}
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

        {/* GitHub URL - OPTIONAL */}
        <div>
          <label className="block text-sm font-bold mb-2" style={{ color: ui.textDim }}>
            GitHub Repository URL (optional - leave empty to fork from base module)
          </label>
          <input
            type="text"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            placeholder="https://github.com/username/forked-repo (optional)"
            className="w-full px-4 py-3 rounded-lg border-2 outline-none"
            style={{
              backgroundColor: ui.panel,
              borderColor: ui.border,
              color: ui.text
            }}
          />
          <p className="text-xs mt-2" style={{ color: ui.textDim }}>
            💡 Leave empty to fork the base module without a custom GitHub URL
          </p>
        </div>

        {/* Fork Button */}
        <button
          onClick={handleFork}
          disabled={!sourceModule || !newModName || loading}
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
              <span>FORK MODULE</span>
            </>
          )}
        </button>
      </div>

      {/* Success Result */}
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

      {/* Error */}
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