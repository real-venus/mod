"use client";

import { useState, useEffect, useRef } from 'react'
import { userContext } from '@/context/UserContext'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircleIcon, ExclamationCircleIcon, MagnifyingGlassIcon, ArrowPathIcon, XMarkIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
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
  const [input, setInput] = useState('')
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [registerToKey, setRegisterToKey] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const [searchResults, setSearchResults] = useState<GitHubRepo[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const searchTimeout = useRef<NodeJS.Timeout | null>(null)
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null)
  const [waitForCompletion, setWaitForCompletion] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

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

    const trimmedInput = input.trim()

    // Reset if empty — but don't clear url/name if a repo is selected
    if (!trimmedInput || trimmedInput.length < 2) {
      setSearchResults([])
      setSearchError(null)
      if (!selectedRepo) {
        setUrl('')
      }
      return
    }

    // Check if the query is a GitHub URL — check this FIRST before isGitUrl
    const githubUrlMatch = trimmedInput.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+\/[^\/]+)/i)
    if (githubUrlMatch) {
      const fullName = githubUrlMatch[1].replace(/\.git$/, '')
      setSearchResults([])
      fetchSpecificRepo(fullName)
      return
    }

    // Check if it's a direct URL or identifier format (user/repo, Qm..., bafy...)
    if (isCid(trimmedInput)) {
      setUrl(trimmedInput)
      setSearchResults([])
      return
    }

    // Check user/repo format — but only if it clearly looks like one (has exactly one slash)
    if (/^[\w-]+\/[\w.-]+(\.git)?$/.test(trimmedInput)) {
      fetchSpecificRepo(trimmedInput.replace(/\.git$/, ''))
      setSearchResults([])
      return
    }

    // Otherwise treat as search query
    searchTimeout.current = setTimeout(() => {
      searchGitHub(trimmedInput)
    }, 400)
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current)
    }
  }, [input, selectedRepo])

  const fetchSpecificRepo = async (fullName: string) => {
    setIsSearching(true)
    setSearchError(null)
    try {
      const res = await fetch(
        `https://api.github.com/repos/${fullName}`,
        { headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'mod-buidl' } }
      )
      if (!res.ok) throw new Error(`GitHub API ${res.status}`)
      const item = await res.json()
      const repo: GitHubRepo = {
        name: item.name, full_name: item.full_name, description: item.description,
        url: item.html_url, stars: item.stargazers_count, forks: item.forks_count,
        language: item.language, updated_at: item.updated_at, topics: item.topics || [],
      }
      // Automatically select this repo
      selectRepo(repo)
    } catch (err: any) {
      setSearchError(err?.message || 'Repo not found')
    } finally {
      setIsSearching(false)
    }
  }

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
    setInput('')
    setSearchResults([])
  }

  const clearSelection = () => {
    setUrl('')
    setName('')
    setSelectedRepo(null)
    setInput('')
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
  const showSearchResults = searchResults.length > 0 && !selectedRepo && !url

  return (
    <div className="flex flex-col gap-6" style={{ fontFamily: 'var(--font-digital), monospace' }}>

      {/* Unified Input */}
      <div className="space-y-4">
        <label className="text-base uppercase tracking-wider font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>
          ▸ MODULE URL
        </label>

        {!selectedRepo && (
          <div className="relative">
            <MagnifyingGlassIcon className="w-6 h-6 absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
            {isSearching && (
              <ArrowPathIcon className="w-6 h-6 absolute right-4 top-1/2 -translate-y-1/2 text-green-500/60 animate-spin" />
            )}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="SEARCH REPOS, PASTE URL, OR ENTER USER/REPO..."
              className="w-full pl-14 pr-14 py-4 text-base font-bold focus:outline-none transition-all placeholder:text-[var(--text-tertiary)] uppercase border-4"
              style={{
                background: 'var(--bg-secondary)',
                borderColor: url ? (valid ? 'rgba(34,197,94,0.6)' : '#ef4444') : 'var(--border-strong)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-digital)',
              }}
            />
            {url && !selectedRepo && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
                <span className={`text-sm font-bold px-3 py-1 border-4 uppercase tracking-wider ${
                  valid ? 'text-green-500 border-green-500/30' : 'text-red-500 border-red-500/30'
                }`} style={{ fontFamily: 'var(--font-digital)' }}>
                  {inputType}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Help Section - Collapsible */}
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="w-full flex items-center justify-between p-4 border-4 transition-all hover:bg-[var(--bg-tertiary)]"
          style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-strong)' }}
        >
          <div className="flex items-center gap-3">
            <div className="text-blue-500 text-xl font-bold">?</div>
            <span className="font-bold text-sm uppercase" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>
              {showHelp ? 'HIDE HELP' : 'NEED HELP?'}
            </span>
          </div>
          {showHelp ? (
            <ChevronUpIcon className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
          ) : (
            <ChevronDownIcon className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
          )}
        </button>

        <AnimatePresence>
          {showHelp && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-5 border-4 space-y-3" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-strong)' }}>
                <span className="font-bold block text-sm uppercase" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>▸ SUPPORTED FORMATS:</span>
                <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital)' }}>
                  <div className="font-bold uppercase"><span className="text-green-500">▸</span> GITHUB: <code className="text-xs px-2 py-1 border-4 ml-2" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>user/repo</code></div>
                  <div className="font-bold uppercase"><span className="text-green-500">▸</span> FULL URL: <code className="text-xs px-2 py-1 border-4 ml-2" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>github.com/user/repo.git</code></div>
                  <div className="font-bold uppercase"><span className="text-green-500">▸</span> IPFS: <code className="text-xs px-2 py-1 border-4 ml-2" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>Qm...</code> or <code className="text-xs px-2 py-1 border-4 ml-1" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>bafy...</code></div>
                  <div className="font-bold uppercase pt-2"><span className="text-blue-500">▸</span> OR SEARCH BY KEYWORDS: <span className="text-blue-400">react hooks, solidity, python api</span></div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {searchError && (
          <p className="text-red-500/70 text-xs font-medium pl-2">{searchError}</p>
        )}
      </div>

      {/* Quick suggestions - only show when nothing entered yet */}
      {!input.trim() && !selectedRepo && !url && (
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-wider font-bold" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-digital)' }}>▸ POPULAR SEARCHES</p>
          <div className="flex items-center gap-3 flex-wrap">
            {['machine learning', 'solidity', 'react', 'rust cli', 'python api'].map((s) => (
              <button
                key={s}
                onClick={() => setInput(s)}
                className="text-sm px-4 py-2 border-4 transition-all font-bold uppercase hover:bg-[var(--bg-tertiary)]"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', fontFamily: 'var(--font-digital)' }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Results */}
      {showSearchResults && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {searchResults.map((repo) => (
            <button
              key={repo.full_name}
              onClick={() => selectRepo(repo)}
              className="text-left p-4 border-4 transition-all group hover:border-green-500/50"
              style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-strong)' }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-base font-bold group-hover:text-green-500 transition-colors truncate uppercase" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>
                  {repo.full_name}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <StarSolid className="w-4 h-4 text-amber-500/60" />
                  <span className="text-sm font-bold text-amber-500/70" style={{ fontFamily: 'var(--font-digital)' }}>{formatStars(repo.stars)}</span>
                </div>
              </div>
              {repo.description && (
                <p className="text-sm line-clamp-2 leading-relaxed mb-3" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital)' }}>{repo.description}</p>
              )}
              <div className="flex items-center gap-4">
                {repo.language && (
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3" style={{ backgroundColor: langColors[repo.language] || '#555' }} />
                    <span className="text-sm font-bold uppercase" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital)' }}>{repo.language}</span>
                  </div>
                )}
                <span className="text-sm font-bold uppercase" style={{ color: 'var(--text-secondary)', opacity: 0.7, fontFamily: 'var(--font-digital)' }}>{timeAgo(repo.updated_at)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {input.trim().length >= 2 && !isSearching && !showSearchResults && !url && !searchError && (
        <div className="text-center py-12 border-4" style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-secondary)' }}>
          <div className="w-16 h-16 mx-auto mb-4 border-4 flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-strong)' }}>
            <MagnifyingGlassIcon className="w-8 h-8" style={{ color: 'var(--text-primary)' }} />
          </div>
          <p className="text-lg font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-digital)' }}>▸ NO REPOSITORIES FOUND</p>
        </div>
      )}

      {/* Selected repo or valid URL - show configuration */}
      {(selectedRepo || (url && valid)) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {selectedRepo && (
            <div className="p-5 border-4" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-strong)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-green-500 font-bold text-lg uppercase" style={{ fontFamily: 'var(--font-digital)' }}>{selectedRepo.full_name}</span>
                    <span className="text-xs px-3 py-1 text-green-600 border-4 border-green-500/30 uppercase tracking-wider font-bold" style={{ fontFamily: 'var(--font-digital)' }}>GIT</span>
                  </div>
                  {selectedRepo.description && (
                    <p className="text-sm leading-relaxed mb-3 line-clamp-2" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital)' }}>{selectedRepo.description}</p>
                  )}
                  <div className="flex items-center gap-4">
                    {selectedRepo.language && (
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3" style={{ backgroundColor: langColors[selectedRepo.language] || '#737373' }} />
                        <span className="text-sm font-bold uppercase" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital)' }}>{selectedRepo.language}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <StarSolid className="w-4 h-4 text-amber-500/60" />
                      <span className="text-sm font-bold text-amber-500/70" style={{ fontFamily: 'var(--font-digital)' }}>{formatStars(selectedRepo.stars)}</span>
                    </div>
                    <span className="text-sm font-bold uppercase" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital)' }}>{timeAgo(selectedRepo.updated_at)}</span>
                  </div>
                </div>
                <button
                  onClick={clearSelection}
                  className="p-2 border-4 transition-all hover:bg-red-500/10"
                  style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-strong)' }}
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Module Name Input */}
          <div className="space-y-3">
            <label className="text-base uppercase tracking-wider font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>
              ▸ MODULE NAME
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="MODULE-NAME"
              className="w-full px-4 py-4 text-base font-bold focus:outline-none transition-all placeholder:text-[var(--text-tertiary)] uppercase border-4"
              style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-digital)',
              }}
            />
            <p className="text-sm font-bold uppercase" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-digital)' }}>
              AUTO-DETECTED FROM {selectedRepo ? 'REPOSITORY' : 'URL'}
            </p>
          </div>

          {/* Wait toggle */}
          <div className="flex items-center justify-between p-5 border-4" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-strong)' }}>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <span className="text-base font-bold uppercase" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-digital)' }}>WAIT FOR COMPLETION</span>
                <span className="text-sm px-3 py-1 border-4 font-bold uppercase" style={{
                  background: waitForCompletion ? 'rgba(59,130,246,0.15)' : 'rgba(34,197,94,0.15)',
                  color: waitForCompletion ? 'rgb(59,130,246)' : 'rgb(34,197,94)',
                  borderColor: waitForCompletion ? 'rgba(59,130,246,0.3)' : 'rgba(34,197,94,0.3)',
                  fontFamily: 'var(--font-digital)',
                }}>
                  {waitForCompletion ? 'SYNC' : 'ASYNC'}
                </span>
              </div>
              <p className="text-sm mt-2 font-bold uppercase" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-digital)' }}>
                {waitForCompletion ? 'WAIT FOR MODULE TO BUILD' : 'REGISTER IN BACKGROUND'}
              </p>
            </div>
            <button
              onClick={() => setWaitForCompletion(!waitForCompletion)}
              className="relative w-16 h-10 border-4 transition-all"
              style={{
                background: waitForCompletion ? 'rgba(59,130,246,0.3)' : 'rgba(34,197,94,0.3)',
                borderColor: waitForCompletion ? 'rgb(59,130,246)' : 'rgb(34,197,94)',
              }}
            >
              <div
                className="absolute top-1 w-6 h-6 border-4 transition-all"
                style={{
                  background: waitForCompletion ? 'rgb(59,130,246)' : 'rgb(34,197,94)',
                  borderColor: waitForCompletion ? 'rgb(59,130,246)' : 'rgb(34,197,94)',
                  left: waitForCompletion ? 'calc(100% - 32px)' : '4px',
                }}
              />
            </button>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!valid || isSubmitting || !user || !registerToKey.trim()}
            className="w-full py-4 font-bold text-base uppercase tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed border-4"
            style={{
              background: 'var(--bg-primary)',
              borderColor: 'var(--border-strong)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-digital)',
            }}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-3">
                <ArrowPathIcon className="w-6 h-6 animate-spin" />
                {waitForCompletion ? '▸ BUILDING...' : '▸ REGISTERING...'}
              </span>
            ) : (
              '▸ REGISTER MODULE'
            )}
          </button>
        </motion.div>
      )}

      {/* Result / Error - Show at bottom */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="border-4 overflow-hidden"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-strong)' }}
          >
            <div className="px-5 py-4 border-b-4 flex items-center gap-3" style={{ borderColor: 'var(--border-strong)' }}>
              <CheckCircleIcon className="w-6 h-6 text-green-500" />
              <span className="font-bold text-base uppercase tracking-wider text-green-500" style={{ fontFamily: 'var(--font-digital)' }}>▸ MODULE REGISTERED</span>
            </div>
            {result.name && registerToKey && (
              <div className="px-5 pt-4">
                <Link href={`/mod/${result.name}/${registerToKey}`}>
                  <div className="py-3 text-center font-bold text-base uppercase tracking-wider border-4 text-green-500 hover:bg-green-500/10 transition-all group" style={{ borderColor: 'var(--border-strong)', fontFamily: 'var(--font-digital)' }}>
                    <span className="flex items-center justify-center gap-2">
                      VIEW MODULE <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
                    </span>
                  </div>
                </Link>
              </div>
            )}
            <div className="p-5">
              <pre className="text-sm overflow-x-auto text-green-700 dark:text-green-300/60 p-4 border-4" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', fontFamily: 'var(--font-digital)' }}>
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
            className="border-4 overflow-hidden"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-strong)' }}
          >
            <div className="px-5 py-4 border-b-4 flex items-center gap-3" style={{ borderColor: 'var(--border-strong)' }}>
              <ExclamationCircleIcon className="w-6 h-6 text-red-500" />
              <span className="font-bold text-base uppercase tracking-wider text-red-500" style={{ fontFamily: 'var(--font-digital)' }}>▸ FAILED</span>
            </div>
            <div className="p-5">
              <p className="text-base font-bold text-red-600 dark:text-red-300/70 uppercase" style={{ fontFamily: 'var(--font-digital)' }}>{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!user && !result && !error && (
        <p className="text-sm text-center font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-digital)' }}>▸ CONNECT WALLET TO REGISTER MODULES</p>
      )}
    </div>
  )
}
