"use client";

import { useState, useEffect } from 'react'
import { userContext } from '@/mod/context/UserContext'
import { text2color } from '@/mod/utils'
import { motion } from 'framer-motion'
import { SparklesIcon, LinkIcon, ArrowUpTrayIcon, CheckCircleIcon, ExclamationCircleIcon, DocumentTextIcon, KeyIcon } from '@heroicons/react/24/outline'
import Client from '@/mod/client'
import { Auth } from '@/mod/client/auth'

export default function CreateModule() {
  const { user } = userContext()
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

  const userColor = user?.key ? text2color(user.key) : '#a855f7'

  const isGitUrl = (input: string) => {
    return input.includes('github.com') || input.includes('gitlab.com')
  }

  const isCid = (input: string) => {
    // Basic CID validation - starts with Qm or bafy
    return input.startsWith('Qm') || input.startsWith('bafy') || input.startsWith('ipfs://')
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
      // Generate authentication token
      const auth = new Auth()
      const wallet_mode = typeof window !== 'undefined' ? localStorage.getItem('wallet_mode') : 'local'
      const wallet_address = typeof window !== 'undefined' ? localStorage.getItem('wallet_address') : null

      // Generate token with the registration data
      const tokenData = {
        fn: 'api/reg',
        mod: url,
        key: registerToKey.trim(),
        time: Date.now() / 1000
      }

      const token = await auth.token(tokenData, wallet_address, wallet_mode)

      // Use NEXT_PUBLIC_API_URL instead of network.url to avoid WebSocket/CORS issues
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || undefined
      const client = new Client(apiUrl)
      const response = await client.call('call', {
        fn: 'api/reg',
        params: {
          mod: url,
          key: registerToKey.trim(),
          name: name.trim() || undefined,
          comment: comment.trim() || undefined,
          public: false,
          token: token
        },
        url: 'api'
      })

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

  const inputStyle = (fieldName: string) => ({
    borderColor: focusedField === fieldName ? userColor : 'rgba(255,255,255,0.08)',
    backgroundColor: focusedField === fieldName ? `${userColor}05` : 'rgba(255,255,255,0.02)',
    boxShadow: focusedField === fieldName ? `0 0 20px ${userColor}10` : 'none',
  })

  return (
    <div className="space-y-5">
      {/* URL/CID Input */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <label className="flex items-center gap-2 mb-2">
          <LinkIcon className="w-4 h-4" style={{ color: userColor }} />
          <span
            className="text-sm font-bold uppercase tracking-wider"
            style={{ color: `${userColor}90`, fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
          >
            GitHub URL or IPFS CID
          </span>
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onFocus={() => setFocusedField('url')}
          onBlur={() => setFocusedField(null)}
          placeholder="https://github.com/user/repo.git or Qm..."
          className="w-full px-4 py-3 rounded-xl border-2 bg-transparent text-white placeholder-gray-600 outline-none transition-all duration-300 font-mono text-sm"
          style={inputStyle('url')}
        />
        {url && (
          <div className="mt-2 text-xs font-mono">
            <span style={{ color: isValidInput() ? '#22c55e' : '#ef4444' }}>
              {isValidInput() ? `✓ Valid ${getInputType()}` : '✗ Invalid - must be GitHub URL or IPFS CID'}
            </span>
          </div>
        )}
      </motion.div>

      {/* Name Input (Optional) */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.08 }}
      >
        <label className="flex items-center gap-2 mb-2">
          <SparklesIcon className="w-4 h-4" style={{ color: userColor }} />
          <span
            className="text-sm font-bold uppercase tracking-wider"
            style={{ color: `${userColor}90`, fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
          >
            Module Name (Optional)
          </span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => setFocusedField('name')}
          onBlur={() => setFocusedField(null)}
          placeholder="Leave empty to auto-detect from URL"
          className="w-full px-4 py-3 rounded-xl border-2 bg-transparent text-white placeholder-gray-600 outline-none transition-all duration-300 font-mono text-sm"
          style={inputStyle('name')}
        />
      </motion.div>

      {/* Register To Key Input */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.16 }}
      >
        <label className="flex items-center gap-2 mb-2">
          <KeyIcon className="w-4 h-4" style={{ color: userColor }} />
          <span
            className="text-sm font-bold uppercase tracking-wider"
            style={{ color: `${userColor}90`, fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
          >
            Register To Key
          </span>
        </label>
        <div className="relative">
          <input
            type="text"
            value={registerToKey}
            onChange={(e) => setRegisterToKey(e.target.value)}
            onFocus={() => setFocusedField('registerToKey')}
            onBlur={() => setFocusedField(null)}
            placeholder="Key address to register module to"
            className="w-full px-4 py-3 rounded-xl border-2 bg-transparent text-white placeholder-gray-600 outline-none transition-all duration-300 font-mono text-sm"
            style={inputStyle('registerToKey')}
          />
          {registerToKey !== user?.key && user?.key && (
            <button
              onClick={() => setRegisterToKey(user.key || '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono px-2 py-1 rounded border transition-all hover:scale-105"
              style={{ borderColor: `${userColor}60`, color: `${userColor}90` }}
            >
              RESET TO MY KEY
            </button>
          )}
        </div>
        {registerToKey && registerToKey === user?.key && (
          <div className="mt-2 text-xs font-mono" style={{ color: '#22c55e' }}>
            ✓ Registering to your key
          </div>
        )}
        {registerToKey && registerToKey !== user?.key && (
          <div className="mt-2 text-xs font-mono" style={{ color: '#f59e0b' }}>
            ⚠ Registering to different key: {registerToKey.slice(0, 8)}...{registerToKey.slice(-6)}
          </div>
        )}
      </motion.div>

      {/* Comment Input (Optional) */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.24 }}
      >
        <label className="flex items-center gap-2 mb-2">
          <DocumentTextIcon className="w-4 h-4" style={{ color: userColor }} />
          <span
            className="text-sm font-bold uppercase tracking-wider"
            style={{ color: `${userColor}90`, fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
          >
            Comment (Optional)
          </span>
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onFocus={() => setFocusedField('comment')}
          onBlur={() => setFocusedField(null)}
          placeholder="Add a note about this module..."
          rows={3}
          className="w-full px-4 py-3 rounded-xl border-2 bg-transparent text-white placeholder-gray-600 outline-none transition-all duration-300 font-mono text-sm resize-none"
          style={inputStyle('comment')}
        />
      </motion.div>

      {/* Submit Button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.32 }}
        className="pt-4"
      >
        <button
          onClick={handleSubmit}
          disabled={!isValidInput() || isSubmitting || !user || !registerToKey.trim()}
          className="group relative w-full py-4 rounded-xl border-2 font-bold text-base tracking-wider uppercase transition-all duration-300 overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            borderColor: userColor,
            color: userColor,
            backgroundColor: `${userColor}08`,
            fontFamily: 'IBM Plex Mono, Courier New, monospace',
          }}
        >
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: `linear-gradient(135deg, ${userColor}10, transparent, ${userColor}10)` }}
          />
          <div className="relative flex items-center justify-center gap-3">
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Registering...</span>
              </>
            ) : (
              <>
                <ArrowUpTrayIcon className="w-5 h-5" />
                <span>Register Module</span>
              </>
            )}
          </div>
        </button>
      </motion.div>

      {/* Success Message */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl border-2"
          style={{ backgroundColor: `${userColor}10`, borderColor: userColor }}
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckCircleIcon className="w-5 h-5" style={{ color: userColor }} />
            <span className="font-bold" style={{ color: userColor }}>MODULE REGISTERED</span>
          </div>
          <pre className="text-sm overflow-x-auto font-mono" style={{ color: '#a8a8a8' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </motion.div>
      )}

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl border-2"
          style={{ backgroundColor: '#ef444410', borderColor: '#ef4444' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <ExclamationCircleIcon className="w-5 h-5" style={{ color: '#ef4444' }} />
            <span className="font-bold" style={{ color: '#ef4444' }}>ERROR</span>
          </div>
          <p className="font-mono text-sm" style={{ color: '#ef4444' }}>{error}</p>
        </motion.div>
      )}

      {!user && (
        <div className="text-center py-4">
          <p className="text-gray-500 font-mono text-sm">Connect your wallet to register modules</p>
        </div>
      )}
    </div>
  )
}
