"use client";

import { useState, useEffect } from 'react'
import { userContext } from '@/context/UserContext'
import { motion } from 'framer-motion'
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'

export default function CreateModule() {
  const { user, client } = userContext()
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [comment, setComment] = useState('')
  const [registerToKey, setRegisterToKey] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // Default registerToKey to user's key when user changes
  useEffect(() => {
    if (user?.key && !registerToKey) {
      setRegisterToKey(user.key)
    }
  }, [user?.key])

  // Auto-infer module name from GitHub URL
  useEffect(() => {
    if (isGitUrl(url) && !name) {
      const inferredName = inferModuleName(url)
      if (inferredName) {
        setName(inferredName)
      }
    }
  }, [url, name])

  const isGitUrl = (input: string) => {
    // Match full URLs
    if (input.includes('github.com') || input.includes('gitlab.com')) {
      return true
    }
    // Match shorthand: user/repo or user/repo.git
    const shorthandPattern = /^[\w-]+\/[\w-]+(\.git)?$/
    return shorthandPattern.test(input.trim())
  }

  const isCid = (input: string) => {
    // Basic CID validation - starts with Qm or bafy
    return input.startsWith('Qm') || input.startsWith('bafy') || input.startsWith('ipfs://')
  }

  const expandGitUrl = (input: string): string => {
    // If it's already a full URL, return as-is
    if (input.includes('github.com') || input.includes('gitlab.com') || input.startsWith('http')) {
      return input
    }
    // If it matches user/repo pattern, expand to GitHub URL
    const shorthandPattern = /^([\w-]+\/[\w-]+)(\.git)?$/
    const match = input.trim().match(shorthandPattern)
    if (match) {
      const repo = match[1]
      return `https://github.com/${repo}.git`
    }
    return input
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const inferModuleName = (githubUrl: string): string => {
    try {
      let cleanUrl = githubUrl.trim()

      // Handle SSH format: git@github.com:username/repo.git
      if (cleanUrl.startsWith('git@')) {
        const match = cleanUrl.match(/git@[^:]+:(.+)/)
        if (match) {
          cleanUrl = match[1]
        }
      }

      // Remove .git suffix if present
      cleanUrl = cleanUrl.replace(/\.git$/, '')

      // Try parsing as URL first
      try {
        const urlObj = new URL(cleanUrl)
        const pathParts = urlObj.pathname.split('/').filter(p => p)

        // GitHub URL format: github.com/username/repo
        // We want the repo name (last part)
        if (pathParts.length >= 2) {
          return pathParts[pathParts.length - 1]
        }
      } catch {
        // If URL parsing fails, try simple path splitting (for SSH URLs)
        const pathParts = cleanUrl.split('/').filter(p => p)
        if (pathParts.length >= 2) {
          return pathParts[pathParts.length - 1]
        }
      }

      return ''
    } catch {
      return ''
    }
  }

  const isValidInput = () => {
    return url.trim() && (isGitUrl(url) || isCid(url))
  }

  const getInputType = () => {
    if (!url.trim()) return ''
    if (isGitUrl(url)) return 'GitHub URL'
    if (isCid(url)) return 'IPFS CID'
    return 'Invalid'
  }

  const handleSubmit = async () => {
    if (!isValidInput() || !user?.key || !registerToKey.trim()) return

    setIsSubmitting(true)
    setError(null)
    setResult(null)

    try {
      if (!client?.token) {
        throw new Error('Authentication required. Please connect your wallet.')
      }

      // Expand shorthand URLs before submitting
      const expandedUrl = expandGitUrl(url)

      // Call the registration API
      const response = await client.call('api/reg',{
          mod: expandedUrl,
          key: registerToKey.trim(),
          public: false,
          token: client.token
        },
      )

      setResult(response)
      // Clear form on success (but keep registerToKey as default)
      setUrl('')
      setName('')
      setComment('')
    } catch (err: any) {
      setError(err?.message || 'Failed to register module')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col gap-6 min-h-0 overflow-visible p-6">
      {/* Main Input Container */}
      <div className="flex-shrink-0 space-y-5">
        {/* URL Input */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
              Repository URL or IPFS CID
            </label>
            {url && (
              <div
                className="font-mono text-xs font-bold tracking-widest uppercase px-2 py-0.5 rounded"
                style={{
                  backgroundColor: isValidInput() ? '#22c55e20' : '#ef444420',
                  color: isValidInput() ? '#22c55e' : '#ef4444',
                  border: `1px solid ${isValidInput() ? '#22c55e40' : '#ef444440'}`,
                }}
              >
                {isValidInput() ? `✓ ${getInputType()}` : '✗ Invalid'}
              </div>
            )}
          </div>
          <div className="relative group">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onFocus={() => setFocusedField('url')}
              onBlur={() => setFocusedField(null)}
              placeholder="user/repo  or  github.com/user/repo.git  or  Qm..."
              className="w-full border-2 text-green-400 px-5 py-4 rounded-lg focus:outline-none text-base bg-neutral-950/80 placeholder-neutral-700 hover:border-neutral-600 transition-all duration-200 font-mono shadow-lg"
              style={{
                borderColor: focusedField === 'url'
                  ? (isValidInput() ? '#22c55e' : '#a855f7')
                  : 'rgba(115, 115, 115, 0.4)',
                fontFamily: 'IBM Plex Mono, monospace',
              }}
            />
          </div>
        </div>

        {/* Register Key Input */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
              Registration Key
            </label>
            {registerToKey === user?.key && (
              <span className="font-mono text-xs font-bold text-green-400 px-2 py-0.5 bg-green-400/10 border border-green-400/30 rounded">
                ✓ YOUR KEY
              </span>
            )}
          </div>
          <div className="relative group">
            <input
              type="text"
              value={registerToKey}
              onChange={(e) => setRegisterToKey(e.target.value)}
              onFocus={() => setFocusedField('registerToKey')}
              onBlur={() => setFocusedField(null)}
              placeholder="0x..."
              className="w-full border-2 text-cyan-400 px-5 py-4 rounded-lg focus:outline-none text-base bg-neutral-950/80 placeholder-neutral-700 hover:border-neutral-600 transition-all duration-200 font-mono pr-32 shadow-lg"
              style={{
                borderColor: focusedField === 'registerToKey' ? '#06b6d4' : 'rgba(115, 115, 115, 0.4)',
                fontFamily: 'IBM Plex Mono, monospace',
              }}
            />
            {/* Copy and reset buttons */}
            {registerToKey && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                <button
                  onClick={() => copyToClipboard(registerToKey)}
                  className="font-mono text-xs font-bold tracking-widest uppercase px-3 py-1.5 rounded transition-all hover:bg-cyan-500/20 bg-neutral-900 text-cyan-400 border border-cyan-500/30 hover:border-cyan-500/60"
                >
                  COPY
                </button>
                {registerToKey !== user?.key && user?.key && (
                  <button
                    onClick={() => setRegisterToKey(user.key || '')}
                    className="font-mono text-xs font-bold tracking-widest uppercase px-3 py-1.5 rounded transition-all hover:bg-neutral-700 bg-neutral-900 text-neutral-400 border border-neutral-600"
                  >
                    RESET
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Register Button */}
        <button
          onClick={handleSubmit}
          disabled={!isValidInput() || isSubmitting || !user || !registerToKey.trim()}
          className="w-full py-5 rounded-lg font-bold text-xl tracking-widest uppercase transition-all disabled:opacity-30 disabled:cursor-not-allowed border-2 hover:shadow-xl hover:shadow-purple-500/20 hover:scale-[1.01] active:scale-[0.99] mt-2"
          style={{
            borderColor: '#a855f7',
            color: '#a855f7',
            backgroundColor: '#a855f720',
            fontFamily: 'IBM Plex Mono, monospace',
          }}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-3">
              <span className="animate-pulse">[</span>
              <span>REGISTERING</span>
              <span className="animate-pulse">]</span>
            </span>
          ) : (
            <span>[ REGISTER MODULE ]</span>
          )}
        </button>
      </div>

      {/* Output Section - Only show when there's a result/error from submission */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-700/50 scrollbar-track-transparent">
        {/* Success Output */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border-2 bg-gradient-to-br from-green-950/40 to-black overflow-hidden shadow-xl"
            style={{
              borderColor: '#22c55e60',
              fontFamily: 'IBM Plex Mono, monospace'
            }}
          >
            <div className="px-5 py-4 border-b border-green-500/30 bg-green-900/30">
              <div className="flex items-center gap-2.5">
                <CheckCircleIcon className="w-5 h-5 text-green-400" />
                <span className="font-bold text-sm uppercase tracking-widest text-green-400">
                  Module Registered Successfully
                </span>
              </div>
            </div>
            <div className="p-5">
              <pre className="text-xs overflow-x-auto text-green-300/90 leading-relaxed">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </motion.div>
        )}

        {/* Error Output */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border-2 bg-gradient-to-br from-red-950/40 to-black overflow-hidden shadow-xl"
            style={{
              borderColor: '#ef444460',
              fontFamily: 'IBM Plex Mono, monospace'
            }}
          >
            <div className="px-5 py-4 border-b border-red-500/30 bg-red-900/30">
              <div className="flex items-center gap-2.5">
                <ExclamationCircleIcon className="w-5 h-5 text-red-400" />
                <span className="font-bold text-sm uppercase tracking-widest text-red-400">
                  Registration Failed
                </span>
              </div>
            </div>
            <div className="p-5">
              <p className="text-sm text-red-300/90 leading-relaxed">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Connect wallet message */}
        {!user && !result && !error && (
          <div className="text-center py-12">
            <div className="inline-block px-6 py-3 border-2 border-neutral-800 rounded-lg bg-neutral-950/60">
              <p className="text-neutral-500 font-mono text-xs uppercase tracking-widest">
                Connect wallet to register modules
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
