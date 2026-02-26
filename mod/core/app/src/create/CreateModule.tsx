"use client";

import { useState, useEffect, useRef } from 'react'
import { userContext } from '@/context/UserContext'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircleIcon, ExclamationCircleIcon, MagnifyingGlassIcon, ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline'
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

export default function CreateModule() {
  const router = useRouter()
  const { user, client } = userContext()
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
        mod: expandGitUrl(url), key: registerToKey.trim(), public: false, token: client.token,
      })
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
    <div className="flex-1 flex flex-col min-h-0" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>

      {/* Selected repo card OR input area */}
      <AnimatePresence mode="wait">
        {selectedRepo ? (
          <motion.div
            key="selected"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="rounded-xl p-4 mb-4"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-1">
                  <span className="text-green-500 dark:text-green-400 font-bold text-base">{selectedRepo.full_name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded text-green-600/60 dark:text-green-400/60 border border-green-500/20 uppercase tracking-wider font-bold">git</span>
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
                className="p-1 rounded transition-colors shrink-0"
                style={{ color: 'var(--text-secondary)' }}
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="mb-4"
          >
            <div className="relative">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="user/repo  or  github.com/user/repo.git  or  Qm..."
                className="w-full px-4 py-3.5 rounded-xl text-sm focus:outline-none transition-all"
                style={{
                  background: 'var(--bg-surface)',
                  border: `1px solid ${url ? (valid ? 'rgba(34,197,94,0.4)' : '#ef4444') : 'var(--border-color)'}`,
                  color: 'var(--text-primary)',
                }}
              />
              {url && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                    valid ? 'text-green-500 dark:text-green-400 border border-green-500/20' : 'text-red-500 dark:text-red-400 border border-red-500/20'
                  }`}>
                    {inputType}
                  </span>
                  <button onClick={() => setUrl('')} className="transition-colors" style={{ color: 'var(--text-secondary)' }}>
                    <XMarkIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Register button */}
      <button
        onClick={handleSubmit}
        disabled={!valid || isSubmitting || !user || !registerToKey.trim()}
        className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-[0.15em] transition-all disabled:opacity-15 disabled:cursor-not-allowed active:scale-[0.99] mb-5"
        style={{
          background: valid ? 'rgba(34,197,94,0.1)' : 'var(--bg-surface)',
          border: `1px solid ${valid ? 'rgba(34,197,94,0.35)' : 'var(--border-color)'}`,
          color: valid ? '#16a34a' : 'var(--text-secondary)',
        }}
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <ArrowPathIcon className="w-4 h-4 animate-spin" />
            Registering...
          </span>
        ) : (
          'Register Module'
        )}
      </button>

      {/* Result / Error */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-green-500/30 overflow-hidden mb-5"
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
            className="rounded-xl border border-red-500/30 overflow-hidden mb-5"
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

      {/* Divider */}
      {!selectedRepo && (
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px" style={{ background: 'var(--border-color)' }} />
          <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>or search</span>
          <div className="flex-1 h-px" style={{ background: 'var(--border-color)' }} />
        </div>
      )}

      {/* GitHub Search */}
      {!selectedRepo && (
        <div className="flex-1 space-y-3">
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
            {isSearching && (
              <ArrowPathIcon className="w-3.5 h-3.5 absolute right-3.5 top-1/2 -translate-y-1/2 text-green-500/60 animate-spin" />
            )}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="search github repositories..."
              className="w-full pl-10 pr-10 py-2.5 rounded-lg text-sm focus:outline-none transition-all"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {searchError && (
            <p className="text-red-500/70 text-xs px-1">{searchError}</p>
          )}

          {/* Quick suggestions */}
          {!searchQuery.trim() && searchResults.length === 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {['machine learning', 'solidity', 'react', 'rust cli', 'python api'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSearchQuery(s)}
                  className="text-[11px] px-2.5 py-1 rounded-full hover:text-green-500 dark:hover:text-green-400 transition-all"
                  style={{ border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Results */}
          {searchResults.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {searchResults.map((repo) => (
                <button
                  key={repo.full_name}
                  onClick={() => selectRepo(repo)}
                  className="text-left p-3 rounded-lg transition-all group hover:border-green-500/30"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-[13px] font-bold group-hover:text-green-500 dark:group-hover:text-green-300 transition-colors truncate" style={{ color: 'var(--text-primary)' }}>
                      {repo.full_name}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <StarSolid className="w-3 h-3 text-amber-500/50" />
                      <span className="text-[11px] text-amber-500/50">{formatStars(repo.stars)}</span>
                    </div>
                  </div>
                  {repo.description && (
                    <p className="text-[11px] line-clamp-2 leading-relaxed mb-1.5" style={{ color: 'var(--text-secondary)' }}>{repo.description}</p>
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
            <p className="text-xs text-center py-6" style={{ color: 'var(--text-secondary)' }}>no repositories found</p>
          )}

          {!user && !result && !error && (
            <p className="text-xs text-center pt-6" style={{ color: 'var(--text-secondary)' }}>connect wallet to register modules</p>
          )}
        </div>
      )}
    </div>
  )
}
