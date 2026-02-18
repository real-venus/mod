"use client";

import { useState, useEffect, useRef } from 'react'
import { userContext } from '@/context/UserContext'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircleIcon, ExclamationCircleIcon, MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<GitHubRepo[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [showSearch, setShowSearch] = useState(true)
  const searchTimeout = useRef<NodeJS.Timeout | null>(null)

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
            query,
            sort: 'stars',
            order: 'desc',
            per_page: 12,
          })
          if (Array.isArray(results) && results.length > 0 && !results[0]?.error) {
            setSearchResults(results)
            setIsSearching(false)
            return
          }
        } catch {
          // Module not available, fall through to direct API
        }
      }
      const res = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=12`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'mod-create',
          },
        }
      )
      if (!res.ok) throw new Error(`GitHub API ${res.status}`)
      const data = await res.json()
      const repos: GitHubRepo[] = (data.items || []).map((item: any) => ({
        name: item.name,
        full_name: item.full_name,
        description: item.description,
        url: item.html_url,
        stars: item.stargazers_count,
        forks: item.forks_count,
        language: item.language,
        updated_at: item.updated_at,
        topics: item.topics || [],
      }))
      setSearchResults(repos)
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
    setShowSearch(false)
  }

  const isGitUrl = (input: string) => {
    if (input.includes('github.com') || input.includes('gitlab.com')) return true
    const shorthandPattern = /^[\w-]+\/[\w-]+(\.git)?$/
    return shorthandPattern.test(input.trim())
  }

  const isCid = (input: string) => {
    return input.startsWith('Qm') || input.startsWith('bafy') || input.startsWith('ipfs://')
  }

  const expandGitUrl = (input: string): string => {
    if (input.includes('github.com') || input.includes('gitlab.com') || input.startsWith('http')) return input
    const shorthandPattern = /^([\w-]+\/[\w-]+)(\.git)?$/
    const match = input.trim().match(shorthandPattern)
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
    } catch {
      return ''
    }
  }

  const isValidInput = () => url.trim() && (isGitUrl(url) || isCid(url))

  const getInputType = () => {
    if (!url.trim()) return ''
    if (isGitUrl(url)) return 'GIT'
    if (isCid(url)) return 'IPFS'
    return 'Invalid'
  }

  const handleSubmit = async () => {
    if (!isValidInput() || !user?.key) return
    setIsSubmitting(true)
    setError(null)
    setResult(null)
    try {
      if (!client?.token) throw new Error('Authentication required. Please connect your wallet.')
      const expandedUrl = expandGitUrl(url)
      const response = await client.call('api/reg', {
        mod: expandedUrl,
        key: user.key,
        public: false,
        token: client.token,
      })
      setResult(response)
      setUrl('')
      setName('')
    } catch (err: any) {
      setError(err?.message || 'Failed to register module')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatStars = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return n.toString()
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const days = Math.floor(diff / 86400000)
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

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-visible">
      {/* Search Section */}
      <div className="space-y-2">
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-widest transition-colors group"
          style={{ color: showSearch ? '#4ade80' : 'rgba(255,255,255,0.3)' }}
        >
          <MagnifyingGlassIcon className="w-3.5 h-3.5" />
          SEARCH GITHUB
          <span className="text-white/15 group-hover:text-white/30 transition-colors ml-1">
            {showSearch ? '[-]' : '[+]'}
          </span>
        </button>

        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="space-y-2">
                <div className="relative">
                  <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/20 z-10" />
                  {isSearching && (
                    <ArrowPathIcon className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-green-400 animate-spin z-10" />
                  )}
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g. 'machine learning pytorch'"
                    className="w-full border text-white text-[16px] focus:outline-none bg-white/[0.03] placeholder-white/15 transition-all font-mono"
                    style={{
                      paddingLeft: '2.25rem',
                      paddingRight: '2.25rem',
                      height: '48px',
                      borderColor: searchQuery ? 'rgba(74, 222, 128, 0.3)' : 'rgba(255,255,255,0.06)',
                    }}
                  />
                </div>

                {searchError && (
                  <p className="text-red-400/70 text-[12px] font-mono px-1">{searchError}</p>
                )}

                {searchResults.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[300px] overflow-y-auto scrollbar-thin">
                    {searchResults.map((repo) => (
                      <button
                        key={repo.full_name}
                        onClick={() => selectRepo(repo)}
                        className="text-left px-3 py-2.5 border border-white/[0.05] bg-white/[0.02] hover:border-green-500/30 hover:bg-green-500/[0.04] transition-all group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[12px] font-bold text-white/60 group-hover:text-green-400 transition-colors truncate font-mono leading-tight">
                            {repo.full_name}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <StarSolid className="w-2.5 h-2.5 text-amber-500/60" />
                            <span className="text-[10px] text-amber-500/60 font-mono font-bold">{formatStars(repo.stars)}</span>
                          </div>
                        </div>
                        {repo.description && (
                          <p className="text-[11px] text-white/25 mt-1 line-clamp-2 leading-relaxed">
                            {repo.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2.5 mt-1.5">
                          {repo.language && (
                            <div className="flex items-center gap-1">
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: langColors[repo.language] || '#737373' }}
                              />
                              <span className="text-[10px] text-white/30">{repo.language}</span>
                            </div>
                          )}
                          <span className="text-[10px] text-white/15">{timeAgo(repo.updated_at)}</span>
                          {repo.topics.length > 0 && (
                            <div className="flex items-center gap-1 overflow-hidden">
                              {repo.topics.slice(0, 2).map((t) => (
                                <span key={t} className="text-[9px] px-1 py-px bg-green-500/8 text-green-400/40 border border-green-500/15 font-bold truncate">
                                  {t}
                                </span>
                              ))}
                              {repo.topics.length > 2 && (
                                <span className="text-[9px] text-white/20">+{repo.topics.length - 2}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {searchQuery.trim().length >= 2 && !isSearching && searchResults.length === 0 && !searchError && (
                  <p className="text-white/20 text-[11px] font-mono font-bold text-center py-6 uppercase tracking-wider">No repositories found</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/[0.04]" />

      {/* Register Form */}
      <div className="space-y-2">
        <span className="text-[13px] font-extrabold uppercase tracking-widest text-white/25">
          SOURCE
        </span>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={url}
              onChange={(e) => { setUrl(e.target.value); if (!showSearch) setShowSearch(false) }}
              onFocus={() => setFocusedField('url')}
              onBlur={() => setFocusedField(null)}
              placeholder="user/repo  or  github.com/user/repo.git  or  Qm..."
              className="w-full border text-green-400 text-[16px] focus:outline-none bg-white/[0.03] placeholder-white/12 transition-all font-mono"
              style={{
                paddingLeft: '1rem',
                paddingRight: url ? '5rem' : '1rem',
                height: '48px',
                borderColor: focusedField === 'url'
                  ? (isValidInput() ? 'rgba(74, 222, 128, 0.5)' : 'rgba(255,255,255,0.15)')
                  : url ? 'rgba(74, 222, 128, 0.2)' : 'rgba(255,255,255,0.06)',
                boxShadow: focusedField === 'url' && isValidInput() ? '0 0 12px rgba(74, 222, 128, 0.08)' : 'none',
              }}
            />
            {url && (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <span className={`text-[11px] font-extrabold uppercase tracking-wider px-2 py-1 border ${
                  isValidInput()
                    ? 'bg-green-500/10 text-green-400/80 border-green-500/25'
                    : 'bg-red-500/10 text-red-400/80 border-red-500/25'
                }`}>
                  {isValidInput() ? getInputType() : 'INVALID'}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!isValidInput() || isSubmitting || !user}
            className="px-8 font-extrabold text-[14px] uppercase tracking-widest transition-all disabled:opacity-20 disabled:cursor-not-allowed border hover:shadow-[0_0_15px_rgba(74,222,128,0.15)] active:scale-[0.98] relative overflow-hidden group whitespace-nowrap"
            style={{
              height: '48px',
              borderColor: 'rgba(74, 222, 128, 0.4)',
              color: '#4ade80',
              background: 'rgba(74, 222, 128, 0.08)',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            {isSubmitting ? (
              <span className="flex items-center gap-2 relative z-10">
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                REGISTERING...
              </span>
            ) : (
              <span className="relative z-10">REGISTER</span>
            )}
          </button>
        </div>
      </div>

      {/* Output Section */}
      <div className="flex-1 overflow-y-auto mt-2">
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="border bg-white/[0.02] overflow-hidden"
            style={{
              borderColor: 'rgba(74, 222, 128, 0.3)',
              boxShadow: '0 0 20px rgba(74, 222, 128, 0.06)',
            }}
          >
            <div className="px-4 py-3 border-b border-green-500/20 bg-green-500/[0.04] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4 text-green-400" />
                <span className="font-extrabold text-[11px] uppercase tracking-wider text-green-400">
                  Module Registered
                </span>
              </div>
              {result.name && user?.key && (
                <Link href={`/mod/${result.name}/${user.key}`}>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-green-400/60 hover:text-green-400 transition-colors cursor-pointer">
                    VIEW MODULE -&gt;
                  </span>
                </Link>
              )}
            </div>

            <div className="p-4">
              <pre className="text-[12px] overflow-x-auto text-green-300/60 leading-relaxed font-mono bg-black/40 p-3 border border-green-500/10">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="border bg-white/[0.02] overflow-hidden"
            style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}
          >
            <div className="px-4 py-3 border-b border-red-500/20 bg-red-500/[0.04] flex items-center gap-2">
              <ExclamationCircleIcon className="w-4 h-4 text-red-400" />
              <span className="font-extrabold text-[11px] uppercase tracking-wider text-red-400">
                Registration Failed
              </span>
            </div>
            <div className="p-4">
              <p className="text-[12px] text-red-400/70 font-mono">{error}</p>
            </div>
          </motion.div>
        )}

        {!user && !result && !error && (
          <div className="flex flex-col items-center justify-center py-12 border border-white/[0.06] bg-white/[0.01]">
            <span className="text-white/15 text-[12px] mb-1.5 font-extrabold uppercase tracking-wider">[AUTH REQUIRED]</span>
            <p className="text-white/25 font-mono text-[12px] font-bold">
              Connect wallet to register modules
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
