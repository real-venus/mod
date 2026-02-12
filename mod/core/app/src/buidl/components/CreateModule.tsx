"use client";

import { useState, useEffect } from 'react'
import { userContext } from '@/context/UserContext'
import { motion } from 'framer-motion'
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CreateModule() {
  const router = useRouter()
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
    <div className="flex-1 flex flex-col gap-8 min-h-0 overflow-visible p-8">
      {/* Main Input Container with gradient background */}
      <div className="flex-shrink-0 space-y-6 relative">
        {/* Ambient glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-cyan-500/5 rounded-2xl blur-3xl -z-10" />

        {/* URL Input */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <label className="text-lg font-black uppercase tracking-[0.25em] flex items-center gap-3 bg-gradient-to-r from-purple-400 via-pink-400 to-purple-500 bg-clip-text text-transparent" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
              <span className="text-purple-400 text-2xl animate-pulse">●</span>
              Repository URL or IPFS CID
            </label>
            {url && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="font-mono text-sm font-bold tracking-widest uppercase px-4 py-2 rounded-xl backdrop-blur-sm"
                style={{
                  backgroundColor: isValidInput() ? '#22c55e25' : '#ef444425',
                  color: isValidInput() ? '#22c55e' : '#ef4444',
                  border: `2px solid ${isValidInput() ? '#22c55e60' : '#ef444460'}`,
                  boxShadow: isValidInput()
                    ? '0 0 20px rgba(34, 197, 94, 0.3)'
                    : '0 0 20px rgba(239, 68, 68, 0.3)',
                }}
              >
                {isValidInput() ? `✓ ${getInputType()}` : '✗ Invalid'}
              </motion.div>
            )}
          </div>
          <div className="relative group">
            {/* Glow effect on focus */}
            {focusedField === 'url' && (
              <div
                className="absolute inset-0 rounded-3xl blur-2xl transition-opacity"
                style={{
                  background: isValidInput()
                    ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.5), rgba(16, 185, 129, 0.5))'
                    : 'linear-gradient(135deg, rgba(168, 85, 247, 0.5), rgba(236, 72, 153, 0.5))',
                  opacity: 0.7,
                }}
              />
            )}
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onFocus={() => setFocusedField('url')}
              onBlur={() => setFocusedField(null)}
              placeholder="user/repo  or  github.com/user/repo.git  or  Qm..."
              className="w-full border-[3px] text-green-400 px-8 py-7 rounded-3xl focus:outline-none text-2xl bg-black/95 backdrop-blur-sm placeholder-neutral-600 hover:border-purple-500/60 transition-all duration-300 font-mono shadow-2xl relative z-10"
              style={{
                borderColor: focusedField === 'url'
                  ? (isValidInput() ? '#22c55e' : '#a855f7')
                  : '#a855f7',
                fontFamily: 'IBM Plex Mono, monospace',
                boxShadow: focusedField === 'url'
                  ? '0 12px 48px rgba(168, 85, 247, 0.6), 0 0 30px rgba(168, 85, 247, 0.4)'
                  : '0 6px 24px rgba(168, 85, 247, 0.3), 0 0 20px rgba(168, 85, 247, 0.2)',
              }}
            />
          </div>
        </div>

        {/* Register Key Input */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <label className="text-lg font-black uppercase tracking-[0.25em] flex items-center gap-3 bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-500 bg-clip-text text-transparent" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
              <span className="text-cyan-400 text-2xl animate-pulse" style={{ animationDelay: '0.5s' }}>●</span>
              Registration Key
            </label>
            {registerToKey === user?.key && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="font-mono text-sm font-bold text-green-400 px-4 py-2 bg-green-400/20 border-2 border-green-400/50 rounded-xl backdrop-blur-sm"
                style={{
                  boxShadow: '0 0 20px rgba(34, 197, 94, 0.4)',
                }}
              >
                ✓ YOUR KEY
              </motion.span>
            )}
          </div>
          <div className="relative group">
            {/* Glow effect on focus */}
            {focusedField === 'registerToKey' && (
              <div
                className="absolute inset-0 rounded-3xl blur-2xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.5), rgba(59, 130, 246, 0.5))',
                  opacity: 0.7,
                }}
              />
            )}
            <input
              type="text"
              value={registerToKey}
              onChange={(e) => setRegisterToKey(e.target.value)}
              onFocus={() => setFocusedField('registerToKey')}
              onBlur={() => setFocusedField(null)}
              placeholder="0x..."
              className="w-full border-[3px] text-cyan-400 px-8 py-7 rounded-3xl focus:outline-none text-2xl bg-black/95 backdrop-blur-sm placeholder-neutral-600 hover:border-cyan-500/60 transition-all duration-300 font-mono pr-64 shadow-2xl relative z-10"
              style={{
                borderColor: focusedField === 'registerToKey' ? '#06b6d4' : '#06b6d4',
                fontFamily: 'IBM Plex Mono, monospace',
                boxShadow: focusedField === 'registerToKey'
                  ? '0 12px 48px rgba(6, 182, 212, 0.6), 0 0 30px rgba(6, 182, 212, 0.4)'
                  : '0 6px 24px rgba(6, 182, 212, 0.3), 0 0 20px rgba(6, 182, 212, 0.2)',
              }}
            />
            {/* Copy and reset buttons */}
            {registerToKey && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-3 z-20">
                <button
                  onClick={() => copyToClipboard(registerToKey)}
                  className="font-mono text-sm font-bold tracking-widest uppercase px-5 py-3 rounded-xl transition-all hover:scale-105 active:scale-95 bg-cyan-500/10 text-cyan-400 border-2 border-cyan-500/40 hover:border-cyan-500/80 hover:bg-cyan-500/20 backdrop-blur-sm"
                  style={{
                    boxShadow: '0 4px 16px rgba(6, 182, 212, 0.3)',
                  }}
                >
                  COPY
                </button>
                {registerToKey !== user?.key && user?.key && (
                  <button
                    onClick={() => setRegisterToKey(user.key || '')}
                    className="font-mono text-sm font-bold tracking-widest uppercase px-5 py-3 rounded-xl transition-all hover:scale-105 active:scale-95 bg-neutral-800/60 text-neutral-400 border-2 border-neutral-600/40 hover:border-neutral-500 hover:bg-neutral-700/60 backdrop-blur-sm"
                  >
                    RESET
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Register Button - Premium Edition */}
        <div className="relative mt-6">
          {/* Epic glow effect */}
          {!isSubmitting && isValidInput() && user && registerToKey.trim() && (
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/40 via-pink-500/40 to-purple-500/40 rounded-2xl blur-2xl animate-pulse" />
          )}

          <button
            onClick={handleSubmit}
            disabled={!isValidInput() || isSubmitting || !user || !registerToKey.trim()}
            className="w-full py-8 rounded-2xl font-black text-2xl tracking-[0.3em] uppercase transition-all disabled:opacity-20 disabled:cursor-not-allowed border-[3px] hover:shadow-[0_0_60px_rgba(168,85,247,0.6)] hover:scale-[1.01] active:scale-[0.99] relative overflow-hidden group"
            style={{
              borderColor: '#a855f7',
              color: '#a855f7',
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(147, 51, 234, 0.25), rgba(168, 85, 247, 0.15))',
              fontFamily: 'IBM Plex Mono, monospace',
              boxShadow: '0 8px 32px rgba(168, 85, 247, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            }}
          >
            {/* Animated shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

            {/* Animated background gradient on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/0 via-purple-600/30 to-pink-600/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Particle effect background */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-purple-400 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
              <div className="absolute top-3/4 right-1/4 w-2 h-2 bg-pink-400 rounded-full animate-ping" style={{ animationDuration: '3s', animationDelay: '1s' }} />
              <div className="absolute top-1/2 right-1/3 w-2 h-2 bg-purple-400 rounded-full animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
            </div>

            {isSubmitting ? (
              <span className="flex items-center justify-center gap-5 relative z-10">
                {/* Spinning loader */}
                <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="relative">
                  <span className="animate-pulse">REGISTERING MODULE</span>
                  <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-purple-400 to-transparent animate-pulse" />
                </span>
                <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </span>
            ) : (
              <span className="relative z-10 flex items-center justify-center gap-4">
                <span className="text-3xl animate-bounce" style={{ animationDuration: '1s' }}>⚡</span>
                <span className="relative">
                  REGISTER MODULE
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-400 to-pink-400 group-hover:w-full transition-all duration-500" />
                </span>
                <span className="text-3xl animate-bounce" style={{ animationDuration: '1s', animationDelay: '0.1s' }}>⚡</span>
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Output Section - Only show when there's a result/error from submission */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-700/50 scrollbar-track-transparent">
        {/* Success Output */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", bounce: 0.4, duration: 0.8 }}
            className="rounded-2xl border-[3px] bg-gradient-to-br from-green-950/60 via-emerald-950/40 to-black overflow-hidden shadow-2xl relative"
            style={{
              borderColor: '#22c55e',
              fontFamily: 'IBM Plex Mono, monospace',
              boxShadow: '0 0 60px rgba(34, 197, 94, 0.4), 0 8px 32px rgba(0, 0, 0, 0.8)',
            }}
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent rounded-2xl" />

            <div className="px-6 py-5 border-b-2 border-green-500/40 bg-gradient-to-r from-green-900/50 to-emerald-900/50 backdrop-blur-sm relative">
              <div className="flex items-center gap-3">
                <CheckCircleIcon className="w-7 h-7 text-green-400 animate-bounce" style={{ animationDuration: '1s', animationIterationCount: '2' }} />
                <span className="font-black text-base uppercase tracking-[0.2em] text-green-400">
                  Module Registered Successfully
                </span>
              </div>
              {/* Sparkle effect */}
              <div className="absolute top-2 right-2 text-2xl animate-ping" style={{ animationDuration: '1.5s', animationIterationCount: '3' }}>✨</div>
            </div>

            {/* Navigation Button */}
            {result.name && registerToKey && (
              <div className="px-6 pt-6 relative">
                {/* Button glow */}
                <div className="absolute inset-x-6 top-6 h-16 bg-green-500/30 rounded-xl blur-xl" />

                <Link
                  href={`/mod/${result.name}/${registerToKey}`}
                  className="block relative"
                >
                  <button className="w-full py-5 px-8 rounded-xl font-black text-xl tracking-[0.2em] uppercase transition-all border-[3px] hover:shadow-[0_0_60px_rgba(34,197,94,0.6)] hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-green-500/20 via-emerald-500/30 to-green-500/20 border-green-500 text-green-400 hover:bg-green-500/40 group relative overflow-hidden">
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

                    {/* Animated gradient */}
                    <div className="absolute inset-0 bg-gradient-to-r from-green-600/0 via-green-600/30 to-emerald-600/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    <span className="relative z-10 flex items-center justify-center gap-4">
                      <span className="text-3xl group-hover:scale-110 transition-transform">🚀</span>
                      <span className="relative">
                        VIEW YOUR MODULE
                        <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-green-400 to-emerald-400 group-hover:w-full transition-all duration-500" />
                      </span>
                      <span className="text-2xl group-hover:translate-x-1 transition-transform">→</span>
                    </span>
                  </button>
                </Link>
              </div>
            )}

            <div className="p-6 relative">
              <div className="bg-black/60 backdrop-blur-sm rounded-xl p-4 border border-green-500/20">
                <pre className="text-sm overflow-x-auto text-green-300/90 leading-relaxed">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </div>
          </motion.div>
        )}

        {/* Error Output */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", bounce: 0.4, duration: 0.8 }}
            className="rounded-2xl border-[3px] bg-gradient-to-br from-red-950/60 via-rose-950/40 to-black overflow-hidden shadow-2xl relative"
            style={{
              borderColor: '#ef4444',
              fontFamily: 'IBM Plex Mono, monospace',
              boxShadow: '0 0 60px rgba(239, 68, 68, 0.4), 0 8px 32px rgba(0, 0, 0, 0.8)',
            }}
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent rounded-2xl" />

            <div className="px-6 py-5 border-b-2 border-red-500/40 bg-gradient-to-r from-red-900/50 to-rose-900/50 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <ExclamationCircleIcon className="w-7 h-7 text-red-400 animate-pulse" />
                <span className="font-black text-base uppercase tracking-[0.2em] text-red-400">
                  Registration Failed
                </span>
              </div>
            </div>

            <div className="p-6">
              <div className="bg-black/60 backdrop-blur-sm rounded-xl p-5 border border-red-500/20">
                <p className="text-base text-red-300/90 leading-relaxed font-mono">{error}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Connect wallet message */}
        {!user && !result && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center py-16"
          >
            <div className="inline-block px-8 py-4 border-2 border-neutral-700/50 rounded-xl bg-gradient-to-br from-neutral-900/80 to-black backdrop-blur-sm relative overflow-hidden group">
              {/* Subtle animated glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-cyan-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

              <p className="text-neutral-400 font-mono text-sm uppercase tracking-[0.2em] relative z-10">
                Connect wallet to register modules
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
