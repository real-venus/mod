"use client"

import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { WalletHeader } from '@/wallet/WalletHeader'
import { useSearchContext } from '@/context/SearchContext'
import { userContext } from '@/context'

const COMMANDS = ['/search', '/ask', '/run'] as const

function isCid(s: string): boolean {
  const trimmed = s.trim()
  return /^Qm[1-9A-HJ-NP-Za-km-z]{44,}$/.test(trimmed) || /^bafy[a-z2-7]{50,}$/i.test(trimmed)
}

function parseRunArgs(input: string): { fn: string; params: Record<string, any> } {
  const parts = input.trim().split(/\s+/)
  const fn = parts[0] || ''
  const params: Record<string, any> = {}
  const positional: string[] = []

  for (let i = 1; i < parts.length; i++) {
    const arg = parts[i]
    const eqPos = arg.indexOf('=')
    if (eqPos > 0) {
      const key = arg.slice(0, eqPos)
      const val = arg.slice(eqPos + 1)
      params[key] = parseValue(val)
    } else {
      positional.push(arg)
    }
  }
  if (positional.length > 0) {
    params.args = positional.length === 1 ? parseValue(positional[0]) : positional.map(parseValue)
  }
  return { fn, params }
}

function parseValue(s: string): any {
  if (s === 'null' || s === 'none' || s === 'None') return null
  if (s === 'true' || s === 'True') return true
  if (s === 'false' || s === 'False') return false
  const n = Number(s)
  if (!isNaN(n) && s !== '') return n
  try {
    if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
      return JSON.parse(s)
    }
  } catch {}
  return s
}

export function TopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { handleSearch, searchFilters } = useSearchContext()
  const { client } = userContext()
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputValue, setInputValue] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [commandIndex, setCommandIndex] = useState(0)
  const [runResult, setRunResult] = useState<any>(null)
  const [runLoading, setRunLoading] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const activeCommand = COMMANDS[commandIndex]

  useEffect(() => {
    setInputValue(searchFilters.searchTerm || '')
  }, [searchFilters.searchTerm])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    if (activeCommand !== '/run') {
      handleSearch(value)
      if (pathname !== '/mod/explore') {
        router.push('/mod/explore')
      }
    }
  }

  const handleEnter = async () => {
    const trimmed = inputValue.trim()
    if (!trimmed) return

    // CID detection - navigate to CID viewer
    if (isCid(trimmed)) {
      router.push(`/cid/${trimmed}`)
      return
    }

    // /run mode - execute mod function
    if (activeCommand === '/run') {
      if (!client) return
      const { fn, params } = parseRunArgs(trimmed)
      if (!fn) return
      setRunLoading(true)
      setRunError(null)
      setRunResult(null)
      try {
        const result = await client.call(fn, params)
        setRunResult(result)
      } catch (err: any) {
        setRunError(err.message || 'Run failed')
      } finally {
        setRunLoading(false)
      }
      return
    }

    // Default search
    handleSearch(trimmed)
    if (pathname !== '/mod/explore') {
      router.push('/mod/explore')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleEnter()
    }
    if (e.key === 'Escape') {
      setInputValue('')
      handleSearch('')
      setRunResult(null)
      setRunError(null)
      inputRef.current?.blur()
    }
    if ((e.key === 'Backspace' || e.key === 'Delete') && inputValue === '') {
      e.preventDefault()
      setRunResult(null)
      setRunError(null)
      setCommandIndex((prev) => (prev + 1) % COMMANDS.length)
    }
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[70] flex items-center"
      style={{
        height: '64px',
        background: 'var(--bg-header)',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      {/* Search bar */}
      <div className="flex items-center flex-1 pl-3 pr-3">
        <div
          className="flex items-center flex-1 transition-all"
          style={{
            maxWidth: '560px',
            height: '48px',
            backgroundColor: searchFocused ? 'var(--bg-input)' : 'transparent',
            border: searchFocused ? '1px solid var(--accent-primary)' : '1px solid transparent',
            borderRadius: '6px',
            transition: 'all 0.15s ease',
          }}
        >
          {/* Search icon */}
          <div
            className="flex items-center justify-center flex-shrink-0 pl-3 pr-1 cursor-pointer select-none"
            onClick={() => inputRef.current?.focus()}
            style={{ height: '100%' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={searchFocused ? 'var(--accent-primary)' : 'var(--text-tertiary)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.15s ease' }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
          </div>

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder={activeCommand === '/run' ? 'mod/fn key=value ...' : 'modules, functions, cid...'}
            className="flex-1 bg-transparent focus:outline-none min-w-0"
            style={{
              height: '100%',
              fontSize: '20px',
              fontFamily: 'var(--font-pixel), monospace',
              color: 'var(--text-primary)',
              caretColor: 'var(--accent-primary)',
              padding: '0 8px 0 0',
            }}
          />

          {/* Mode indicator - only show when not default search */}
          {activeCommand !== '/search' && (
            <span
              className="flex-shrink-0 mr-2 px-1.5 py-0.5"
              style={{
                fontSize: '12px',
                fontFamily: 'var(--font-pixel), monospace',
                backgroundColor: 'var(--accent-primary)15',
                border: '1px solid var(--accent-primary)',
                borderRadius: '3px',
                color: 'var(--accent-primary)',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
              }}
            >
              {activeCommand}
            </span>
          )}

          {/* CID detected hint */}
          {inputValue && isCid(inputValue.trim()) && (
            <span
              className="flex-shrink-0 mr-2 px-1.5 py-0.5"
              style={{
                fontSize: '12px',
                fontFamily: 'var(--font-pixel), monospace',
                backgroundColor: 'var(--accent-primary)15',
                border: '1px solid var(--accent-primary)',
                borderRadius: '3px',
                color: 'var(--accent-primary)',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
              }}
            >
              CID ↵
            </span>
          )}

          {/* Keyboard shortcut hint */}
          {!searchFocused && !inputValue && (
            <kbd
              className="flex-shrink-0 mr-2 px-1.5 py-0.5"
              style={{
                fontSize: '15px',
                fontFamily: 'var(--font-pixel), monospace',
                backgroundColor: 'var(--hover-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '3px',
                color: 'var(--text-tertiary)',
                lineHeight: 1.2,
              }}
            >
              ⌘K
            </kbd>
          )}
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center pr-3 gap-1">
        <WalletHeader />
      </div>

      {/* Run result dropdown */}
      {activeCommand === '/run' && (runResult !== null || runError || runLoading) && (
        <div
          className="fixed left-3 z-[80]"
          style={{
            top: '68px',
            maxWidth: '560px',
            width: '100%',
          }}
        >
          <div
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              maxHeight: '400px',
              overflow: 'auto',
            }}
          >
            {runLoading && (
              <div className="p-4" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-pixel), monospace', fontSize: '14px' }}>
                running...
              </div>
            )}
            {runError && (
              <div className="p-4" style={{ color: '#ff4444', fontFamily: 'var(--font-pixel), monospace', fontSize: '14px' }}>
                {runError}
              </div>
            )}
            {runResult !== null && !runLoading && (
              <pre
                className="p-4 whitespace-pre-wrap break-all"
                style={{
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-pixel), monospace',
                  fontSize: '13px',
                  margin: 0,
                }}
              >
                {typeof runResult === 'string' ? runResult : JSON.stringify(runResult, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
