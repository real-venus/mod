"use client";

import { useState, useEffect, useRef } from 'react'
import { userContext } from '@/context/UserContext'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircleIcon, ExclamationCircleIcon, MagnifyingGlassIcon, ArrowPathIcon, XMarkIcon, PencilSquareIcon } from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface GitHubRepo {
  name: string
  full_name: string
  description: string | null
  url: string
  stars: number
  forks: number
  language: string | null
  updated_at: string
  topics: string[]
}

type CreateMode = 'search' | 'manual'

export default function CreateModule() {
  const router = useRouter()
  const { user, client } = userContext()
  const [mode, setMode] = useState<CreateMode>('search')
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [registerToKey, setRegisterToKey] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<GitHubRepo[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const searchTimeout = useRef<NodeJS.Timeout | null>(null)
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null)
  const [waitForCompletion, setWaitForCompletion] = useState(false)

  useEffect(() => {
    if (user?.key && !registerToKey) {
      setRegisterToKey(user.key)
    }
  }, [user?.key])

  useEffect(() => {
    if (isGitUrl(url) && !name) {
      const inferredName = inferModuleName(url)
      if (inferredName) setName(inferredName)
    }
  }, [url, name])

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([])
      setSearchError(null)
      return
    }
    searchTimeout.current = setTimeout(() => {
      searchGitHub(searchQuery.trim())
    }, 400)
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current)
    }
  }, [searchQuery])

  const searchGitHub = async (query: string) => {
    setIsSearching(true)
    setSearchError(null)
    try {
      if (client) {
        try {
          const results = await client.call('gitsearch/forward', {
            query, sort: 'stars', order: 'desc', per_page: 8,
          })
          if (Array.isArray(results) && results.length > 0 && !results[0]?.error) {
            setSearchResults(results)
            setIsSearching(false)
            return
          }
        } catch {}
      }
      const res = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=8`,
        { headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'mod-buidl' } }
      )
      if (!res.ok) throw new Error(`GitHub API ${res.status}`)
      const data = await res.json()
      setSearchResults((data.items || []).map((item: any) => ({
        name: item.name, full_name: item.full_name, description: item.description,
        url: item.html_url, stars: item.stargazers_count, forks: item.forks_count,
        language: item.language, updated_at: item.updated_at, topics: item.topics || [],
      })))
    } catch (err: any) {
      setSearchError(err?.message || 'Search failed')
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const selectRepo = (repo: GitHubRepo) => {
    setUrl(repo.url + '.git')
    setName(repo.name)
    setSelectedRepo(repo)
    setSearchQuery('')
    setSearchResults([])
  }

  const clearSelection = () => {
    setUrl('')
    setName('')
    setSelectedRepo(null)
  }

  const isGitUrl = (input: string) => {
    if (input.includes('github.com') || input.includes('gitlab.com')) return true
    return /^[\w-]+\/[\w-]+(\.git)?$/.test(input.trim())
  }

  const isCid = (input: string) => {
    return input.startsWith('Qm') || input.startsWith('bafy') || input.startsWith('ipfs://')
  }

  const expandGitUrl = (input: string): string => {
    if (input.includes('github.com') || input.includes('gitlab.com') || input.startsWith('http')) return input
    const match = input.trim().match(/^([\w-]+\/[\w-]+)(\.git)?$/)
    if (match) return `https://github.com/${match[1]}.git`
    return input
  }

  const inferModuleName = (githubUrl: string): string => {
    try {
      let cleanUrl = githubUrl.trim()
      if (cleanUrl.startsWith('git@')) {
        const match = cleanUrl.match(/git@[^:]+:(.+)/)
        if (match) cleanUrl = match[1]
      }
      cleanUrl = cleanUrl.replace(/\.git$/, '')
      try {
        const urlObj = new URL(cleanUrl)
        const pathParts = urlObj.pathname.split('/').filter(p => p)
        if (pathParts.length >= 2) return pathParts[pathParts.length - 1]
      } catch {
        const pathParts = cleanUrl.split('/').filter(p => p)
        if (pathParts.length >= 2) return pathParts[pathParts.length - 1]
      }
      return ''
    } catch { return '' }
  }

  const isValidInput = () => url.trim() && (isGitUrl(url) || isCid(url))

  const getInputType = () => {
    if (!url.trim()) return ''
    if (isGitUrl(url)) return 'git'
    if (isCid(url)) return 'ipfs'
    return 'invalid'
  }

  const handleSubmit = async () => {
    if (!isValidInput() || !user?.key || !registerToKey.trim()) return
    setIsSubmitting(true)
    setError(null)
    setResult(null)
    try {
      if (!client?.token) throw new Error('Authentication required. Please connect your wallet.')
      const response = await client.call('api/reg', {
        mod: expandGitUrl(url),
        key: registerToKey.trim(),
        public: false,
        token: client.token,
      }, waitForCompletion)
      setResult(response)
      setUrl('')
      setName('')
      setSelectedRepo(null)
    } catch (err: any) {
      setError(err?.message || 'Failed to register module')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatStars = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toString()

  const timeAgo = (dateStr: string) => {
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
    if (days < 1) return 'today'
    if (days < 30) return `${days}d ago`
    if (days < 365) return `${Math.floor(days / 30)}mo ago`
    return `${Math.floor(days / 365)}y ago`
  }

  const langColors: Record<string, string> = {
    JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Rust: '#dea584',
    Go: '#00ADD8', Java: '#b07219', C: '#555555', 'C++': '#f34b7d', Ruby: '#701516',
    Solidity: '#AA6746', Swift: '#F05138', Kotlin: '#A97BFF', Dart: '#00B4AB',
    PHP: '#4F5D95', Shell: '#89e051', Lua: '#000080', Zig: '#ec915c',
  }

  const valid = isValidInput()
  const inputType = getInputType()

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-6" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>

      {/* Mode Selector */}
      <div className="flex gap-2 p-1 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)' }}>
        <button
          onClick={() => setMode('search')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
            mode === 'search' ? 'text-green-500 dark:text-green-400' : ''
          }`}
          style={{
            background: mode === 'search' ? 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(16,185,129,0.1) 100%)' : 'transparent',
            border: mode === 'search' ? '1.5px solid rgba(34,197,94,0.3)' : '1.5px solid transparent',
            color: mode === 'search' ? undefined : 'var(--text-secondary)',
          }}
        >
          <MagnifyingGlassIcon className="w-4 h-4" />
          Search
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
            mode === 'manual' ? 'text-green-500 dark:text-green-400' : ''
          }`}
          style={{
            background: mode === 'manual' ? 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(16,185,129,0.1) 100%)' : 'transparent',
            border: mode === 'manual' ? '1.5px solid rgba(34,197,94,0.3)' : '1.5px solid transparent',
            color: mode === 'manual' ? undefined : 'var(--text-secondary)',
          }}
        >
          <PencilSquareIcon className="w-4 h-4" />
          Manual
        </button>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'search' ? (
          <motion.div
            key="search-mode"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col gap-4"
          >
            {/* Compact Platform Indicator */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                <span className="text-xs font-bold text-green-500 dark:text-green-400">GitHub</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-600/70 dark:text-green-400/70 uppercase tracking-wider">active</span>
              </div>
              <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>IPFS, npm coming soon</span>
            </div>

            {/* GitHub Search Interface */}
            <div className="flex-1 space-y-3">
              <div className="relative">
                <MagnifyingGlassIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
                {isSearching && (
                  <ArrowPathIcon className="w-3.5 h-3.5 absolute right-3.5 top-1/2 -translate-y-1/2 text-green-500/60 animate-spin" />
                )}
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="search repositories..."
                  className="w-full pl-10 pr-10 py-3 rounded-xl text-sm focus:outline-none transition-all placeholder:text-[var(--text-tertiary)]"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1.5px solid var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              {searchError && (
                <p className="text-red-500/70 text-xs px-1">{searchError}</p>
              )}

              {/* Quick suggestions */}
              {!searchQuery.trim() && searchResults.length === 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wider font-bold px-1" style={{ color: 'var(--text-tertiary)' }}>Popular searches</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {['machine learning', 'solidity', 'react', 'rust cli', 'python api'].map((s) => (
                      <button
                        key={s}
                        onClick={() => setSearchQuery(s)}
                        className="text-[11px] px-3 py-1.5 rounded-full transition-all hover:border-green-500/30"
                        style={{ border: '1px solid var(--border-color)', color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Results */}
              {searchResults.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {searchResults.map((repo) => (
                    <button
                      key={repo.full_name}
                      onClick={() => selectRepo(repo)}
                      className="text-left p-3.5 rounded-xl transition-all group hover:border-green-500/30"
                      style={{ background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)' }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="text-[13px] font-bold group-hover:text-green-500 dark:group-hover:text-green-300 transition-colors truncate" style={{ color: 'var(--text-primary)' }}>
                          {repo.full_name}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <StarSolid className="w-3 h-3 text-amber-500/50" />
                          <span className="text-[11px] text-amber-500/50">{formatStars(repo.stars)}</span>
                        </div>
                      </div>
                      {repo.description && (
                        <p className="text-[11px] line-clamp-2 leading-relaxed mb-2" style={{ color: 'var(--text-secondary)' }}>{repo.description}</p>
                      )}
                      <div className="flex items-center gap-3">
                        {repo.language && (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: langColors[repo.language] || '#555' }} />
                            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{repo.language}</span>
                          </div>
                        )}
                        <span className="text-[11px]" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>{timeAgo(repo.updated_at)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searchQuery.trim().length >= 2 && !isSearching && searchResults.length === 0 && !searchError && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ background: 'var(--bg-secondary)' }}>
                    <MagnifyingGlassIcon className="w-8 h-8" style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No repositories found</p>
                </div>
              )}
            </div>

            {/* Selected repo */}
            {selectedRepo && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <span className="text-green-500 dark:text-green-400 font-bold text-base">{selectedRepo.full_name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md text-green-600/60 dark:text-green-400/60 border border-green-500/20 uppercase tracking-wider font-bold">git</span>
                      </div>
                      {selectedRepo.description && (
                        <p className="text-xs leading-relaxed mb-2.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{selectedRepo.description}</p>
                      )}
                      <div className="flex items-center gap-4">
                        {selectedRepo.language && (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: langColors[selectedRepo.language] || '#737373' }} />
                            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{selectedRepo.language}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <StarSolid className="w-3 h-3 text-amber-500/60" />
                          <span className="text-[11px] text-amber-500/60">{formatStars(selectedRepo.stars)}</span>
                        </div>
                        <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{timeAgo(selectedRepo.updated_at)}</span>
                      </div>
                    </div>
                    <button
                      onClick={clearSelection}
                      className="p-1.5 rounded-lg transition-all hover:bg-red-500/10"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Module Name Input */}
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-[0.2em] font-bold px-1" style={{ color: 'var(--text-secondary)' }}>
                      Module Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="module-name"
                      className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all placeholder:text-[var(--text-tertiary)]"
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '1.5px solid var(--border-color)',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <p className="text-[10px] px-1" style={{ color: 'var(--text-tertiary)' }}>
                      Auto-detected from repository. You can customize it here.
                    </p>
                  </div>

                  {/* Wait toggle */}
                  <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Wait for completion</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{
                          background: waitForCompletion ? 'rgba(59,130,246,0.15)' : 'rgba(34,197,94,0.15)',
                          color: waitForCompletion ? 'rgb(59,130,246)' : 'rgb(34,197,94)',
                        }}>
                          {waitForCompletion ? 'sync' : 'async'}
                        </span>
                      </div>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        {waitForCompletion ? 'Wait for module to build' : 'Register in background'}
                      </p>
                    </div>
                    <button
                      onClick={() => setWaitForCompletion(!waitForCompletion)}
                      className="relative w-11 h-6 rounded-full transition-all"
                      style={{
                        background: waitForCompletion ? 'rgba(59,130,246,0.3)' : 'rgba(34,197,94,0.3)',
                      }}
                    >
                      <div
                        className="absolute top-0.5 w-5 h-5 rounded-full transition-all shadow-sm"
                        style={{
                          background: waitForCompletion ? 'rgb(59,130,246)' : 'rgb(34,197,94)',
                          left: waitForCompletion ? 'calc(100% - 22px)' : '2px',
                        }}
                      />
                    </button>
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={!valid || isSubmitting || !user || !registerToKey.trim()}
                    className="w-full py-3 rounded-xl font-bold text-[12px] uppercase tracking-[0.15em] transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.99]"
                    style={{
                      background: 'linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(16,185,129,0.08) 100%)',
                      border: '1.5px solid rgba(34,197,94,0.4)',
                      color: '#22c55e',
                    }}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        {waitForCompletion ? 'Building...' : 'Registering...'}
                      </span>
                    ) : (
                      'Register Module'
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="manual-mode"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className="space-y-3">
              <label className="text-[11px] uppercase tracking-[0.2em] font-bold px-1" style={{ color: 'var(--text-secondary)' }}>
                Module URL
              </label>

              <div className="relative">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="user/repo  or  github.com/user/repo.git  or  Qm..."
                  className="w-full px-4 py-3.5 rounded-xl text-sm focus:outline-none transition-all placeholder:text-[var(--text-tertiary)]"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: `1.5px solid ${url ? (valid ? 'rgba(34,197,94,0.4)' : '#ef4444') : 'var(--border-color)'}`,
                    color: 'var(--text-primary)',
                    boxShadow: url && valid ? '0 0 0 3px rgba(34,197,94,0.08)' : 'none',
                  }}
                />
                {url && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                      valid ? 'text-green-500 dark:text-green-400 border border-green-500/20' : 'text-red-500 dark:text-red-400 border border-red-500/20'
                    }`}>
                      {inputType}
                    </span>
                    <button onClick={() => setUrl('')} className="transition-colors hover:text-red-400" style={{ color: 'var(--text-secondary)' }}>
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Module Name Input */}
              {url && valid && (
                <div className="space-y-2">
                  <label className="text-[11px] uppercase tracking-[0.2em] font-bold px-1" style={{ color: 'var(--text-secondary)' }}>
                    Module Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="module-name"
                    className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all placeholder:text-[var(--text-tertiary)]"
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1.5px solid var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <p className="text-[10px] px-1" style={{ color: 'var(--text-tertiary)' }}>
                    Auto-detected from URL. You can customize it here.
                  </p>
                </div>
              )}

              <div className="rounded-lg p-3 flex items-start gap-2" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                <div className="text-blue-500/60 mt-0.5">ℹ</div>
                <div className="flex-1 text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  <span className="font-bold block mb-1" style={{ color: 'var(--text-primary)' }}>Supported formats:</span>
                  <div className="space-y-0.5">
                    <div><span className="text-green-500/70">•</span> GitHub shorthand: <code className="text-[10px] px-1 py-0.5 rounded" style={{ background: 'var(--bg-secondary)' }}>user/repo</code></div>
                    <div><span className="text-green-500/70">•</span> Full Git URL: <code className="text-[10px] px-1 py-0.5 rounded" style={{ background: 'var(--bg-secondary)' }}>github.com/user/repo.git</code></div>
                    <div><span className="text-green-500/70">•</span> IPFS: <code className="text-[10px] px-1 py-0.5 rounded" style={{ background: 'var(--bg-secondary)' }}>Qm...</code> or <code className="text-[10px] px-1 py-0.5 rounded" style={{ background: 'var(--bg-secondary)' }}>bafy...</code></div>
                  </div>
                </div>
              </div>

              {/* Wait toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Wait for completion</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{
                      background: waitForCompletion ? 'rgba(59,130,246,0.15)' : 'rgba(34,197,94,0.15)',
                      color: waitForCompletion ? 'rgb(59,130,246)' : 'rgb(34,197,94)',
                    }}>
                      {waitForCompletion ? 'sync' : 'async'}
                    </span>
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    {waitForCompletion ? 'Wait for module to build' : 'Register in background'}
                  </p>
                </div>
                <button
                  onClick={() => setWaitForCompletion(!waitForCompletion)}
                  className="relative w-11 h-6 rounded-full transition-all"
                  style={{
                    background: waitForCompletion ? 'rgba(59,130,246,0.3)' : 'rgba(34,197,94,0.3)',
                  }}
                >
                  <div
                    className="absolute top-0.5 w-5 h-5 rounded-full transition-all shadow-sm"
                    style={{
                      background: waitForCompletion ? 'rgb(59,130,246)' : 'rgb(34,197,94)',
                      left: waitForCompletion ? 'calc(100% - 22px)' : '2px',
                    }}
                  />
                </button>
              </div>

              {/* Register button */}
              <button
                onClick={handleSubmit}
                disabled={!valid || isSubmitting || !user || !registerToKey.trim()}
                className="w-full py-3 rounded-xl font-bold text-[12px] uppercase tracking-[0.15em] transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.99]"
                style={{
                  background: valid ? 'linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(16,185,129,0.08) 100%)' : 'var(--bg-secondary)',
                  border: `1.5px solid ${valid ? 'rgba(34,197,94,0.4)' : 'var(--border-color)'}`,
                  color: valid ? '#22c55e' : 'var(--text-tertiary)',
                }}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    {waitForCompletion ? 'Building...' : 'Registering...'}
                  </span>
                ) : (
                  'Register Module'
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result / Error - Show at bottom */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-green-500/30 overflow-hidden"
            style={{ background: 'var(--bg-surface)' }}
          >
            <div className="px-4 py-3 border-b border-green-500/15 flex items-center gap-2">
              <CheckCircleIcon className="w-4 h-4 text-green-500" />
              <span className="font-bold text-xs uppercase tracking-wider text-green-500 dark:text-green-400">Module Registered</span>
            </div>
            {result.name && registerToKey && (
              <div className="px-4 pt-3">
                <Link href={`/mod/${result.name}/${registerToKey}`}>
                  <div className="py-2.5 rounded-lg text-center font-bold text-sm uppercase tracking-wider border border-green-500/30 text-green-500 dark:text-green-400 hover:border-green-500/60 hover:bg-green-500/10 transition-all group">
                    <span className="flex items-center justify-center gap-2">
                      View Module <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
                    </span>
                  </div>
                </Link>
              </div>
            )}
            <div className="p-4">
              <pre className="text-xs overflow-x-auto text-green-700 dark:text-green-300/60 rounded-lg p-3 border border-green-500/10" style={{ background: 'var(--bg-surface)' }}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-red-500/30 overflow-hidden"
            style={{ background: 'var(--bg-surface)' }}
          >
            <div className="px-4 py-3 border-b border-red-500/15 flex items-center gap-2">
              <ExclamationCircleIcon className="w-4 h-4 text-red-500" />
              <span className="font-bold text-xs uppercase tracking-wider text-red-500 dark:text-red-400">Failed</span>
            </div>
            <div className="p-4">
              <p className="text-xs text-red-600 dark:text-red-300/70">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!user && !result && !error && (
        <p className="text-xs text-center pt-2" style={{ color: 'var(--text-tertiary)' }}>connect wallet to register modules</p>
      )}
    </div>
  )
}
