"use client";

import { useEffect, useRef, useState } from 'react'
import { CopyButton } from '@/ui/CopyButton'
import { useTheme } from '@/context/ThemeContext'
import { MagnifyingGlassIcon, XMarkIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import type { Message } from '../types'

interface ChatMessagesProps {
  messages: Message[]
  isLoading: boolean
}

export function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { effectiveTheme } = useTheme()
  const isLight = effectiveTheme === 'light'
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set())
  const [activeTab, setActiveTab] = useState<{[key: number]: 'input' | 'output'}>({})
  const [viewMode, setViewMode] = useState<'current' | 'history'>('current')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')

  // Group messages into transactions (user + assistant pairs)
  const allTransactions: Array<{user: Message, assistant?: Message, idx: number}> = []
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'user') {
      const assistant = messages[i + 1]?.role === 'assistant' ? messages[i + 1] : undefined
      allTransactions.push({ user: messages[i], assistant, idx: i })
      if (assistant) i++ // Skip the assistant message
    }
  }

  // Apply search filter
  let filteredTransactions = [...allTransactions]
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase()
    filteredTransactions = filteredTransactions.filter(({user, assistant}) =>
      (user.module && user.module.toLowerCase().includes(q)) ||
      (user.function && user.function.toLowerCase().includes(q)) ||
      (assistant?.content && assistant.content.toLowerCase().includes(q)) ||
      (user.params && JSON.stringify(user.params).toLowerCase().includes(q))
    )
  }

  // Sort
  filteredTransactions.sort((a, b) => {
    const timeA = new Date(a.user.timestamp).getTime()
    const timeB = new Date(b.user.timestamp).getTime()
    return sortOrder === 'newest' ? timeB - timeA : timeA - timeB
  })

  // Filter by view mode
  let displayTransactions = filteredTransactions
  if (viewMode === 'current') {
    // Current mode: only show the MOST RECENT transaction
    displayTransactions = filteredTransactions.slice(0, 1)
  } else {
    // History mode: show all completed transactions
    displayTransactions = filteredTransactions.filter(({assistant}) => assistant !== undefined)
  }

  // Auto-expand in current mode - ALL HOOKS MUST BE AT THE TOP
  useEffect(() => {
    if (viewMode === 'current' && displayTransactions.length > 0) {
      setExpandedIndices(new Set([0]))
    } else if (displayTransactions.length > 0) {
      setExpandedIndices(new Set([0]))
    } else {
      setExpandedIndices(new Set())
    }
  }, [viewMode, displayTransactions.length])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const getStatusStyles = (msg: Message) => {
    if (msg.role === 'user' || msg.isLoading) {
      return {
        dot: 'bg-amber-500',
        text: isLight ? 'text-amber-600' : 'text-amber-400',
        bg: isLight ? 'bg-amber-50/50' : 'bg-amber-500/5',
        border: isLight ? 'border-amber-300/50' : 'border-amber-500/20',
        glow: isLight ? 'shadow-amber-100' : 'shadow-[0_0_20px_rgba(245,158,11,0.15)]',
        label: 'RUNNING',
        progressBar: true
      }
    }

    return {
      dot: 'bg-emerald-500',
      text: isLight ? 'text-emerald-600' : 'text-emerald-400',
      bg: isLight ? 'bg-emerald-50/50' : 'bg-emerald-500/5',
      border: isLight ? 'border-emerald-300/50' : 'border-emerald-500/30',
      glow: isLight ? 'shadow-emerald-100' : 'shadow-[0_0_20px_rgba(16,185,129,0.2)]',
      label: 'COMPLETE',
      progressBar: false
    }
  }

  const handleToggleExpand = (idx: number) => {
    // In current mode, don't allow toggling - always expanded
    if (viewMode === 'current') return

    setExpandedIndices(prev => {
      const newSet = new Set(prev)
      if (newSet.has(idx)) {
        newSet.delete(idx)
      } else {
        newSet.add(idx)
      }
      return newSet
    })
  }

  const successCount = allTransactions.filter(({assistant}) => assistant !== undefined).length
  const pendingCount = allTransactions.filter(({assistant}) => assistant === undefined).length
  const hasFilters = searchQuery

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="text-center max-w-lg">
          <div className={`mb-6 inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br border-2 shadow-xl ${
            isLight
              ? 'from-green-100 to-emerald-100 border-green-400 shadow-green-200/50'
              : 'from-green-600/10 to-emerald-600/10 border-green-500/40 shadow-green-900/30'
          }`}>
            <svg className={`w-10 h-10 ${isLight ? 'text-green-600' : 'text-green-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className={`text-xl font-bold mb-3 ${
            isLight ? 'text-gray-800' : 'text-neutral-200'
          }`} style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
            Waiting for Input
          </h3>
          <p className={`text-sm font-mono leading-relaxed ${
            isLight ? 'text-gray-600' : 'text-neutral-400'
          }`}>
            Enter your message above and hit SEND to execute.<br/>
            Results will appear here.
          </p>
          <div className={`mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${
            isLight
              ? 'bg-gray-50 border-gray-300 text-gray-600'
              : 'bg-neutral-800/50 border-neutral-700/50 text-neutral-400'
          }`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-mono">Type above and press Enter or click SEND</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full ${isLight ? 'bg-gray-50' : 'bg-neutral-950'} font-mono`}>
      {/* Compact Single-Line Header */}
      <div className={`flex-shrink-0 px-4 py-3 border-b ${
        isLight ? 'border-gray-300 bg-gradient-to-b from-gray-100/80 to-transparent' : 'border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-transparent'
      }`}>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle - CURRENT / HISTORY */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('current')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                viewMode === 'current'
                  ? isLight
                    ? 'bg-emerald-500/20 text-emerald-700 border border-emerald-500/50'
                    : 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : isLight
                    ? 'bg-gray-200 text-gray-600 hover:text-gray-800 border border-gray-300'
                    : 'bg-neutral-900 text-neutral-500 hover:text-neutral-400 border border-neutral-800'
              }`}
            >
              <span>📄</span>
              <span>CURRENT</span>
            </button>

            <button
              onClick={() => setViewMode('history')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                viewMode === 'history'
                  ? isLight
                    ? 'bg-purple-500/20 text-purple-700 border border-purple-500/50'
                    : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : isLight
                    ? 'bg-gray-200 text-gray-600 hover:text-gray-800 border border-gray-300'
                    : 'bg-neutral-900 text-neutral-500 hover:text-neutral-400 border border-neutral-800'
              }`}
            >
              <span className="text-sm font-mono">{successCount}</span>
              <span>HISTORY</span>
            </button>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <MagnifyingGlassIcon className={`w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 ${
              isLight ? 'text-gray-500' : 'text-neutral-500'
            }`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className={`w-full rounded-lg border pl-8 pr-3 py-1.5 text-sm placeholder-neutral-600 focus:outline-none transition-all ${
                isLight
                  ? 'bg-white border-gray-300 text-gray-900 focus:border-emerald-500/50'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-300 focus:border-cyan-500/50'
              }`}
            />
          </div>

          {hasFilters && (
            <button
              onClick={() => setSearchQuery('')}
              className={`p-1.5 rounded-lg transition-all ${
                isLight
                  ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20'
                  : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
              }`}
              title="Clear filters"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}

          {/* Stats */}
          <div className="flex gap-2.5 ml-auto text-sm font-semibold">
            <span className={`flex items-center gap-1 ${isLight ? 'text-emerald-600' : 'text-green-400'}`}>
              <span className="text-base">{successCount}</span>
              <span className="text-xs">✓</span>
            </span>
            <span className={`flex items-center gap-1 ${isLight ? 'text-amber-600' : 'text-yellow-400'}`}>
              <span className="text-base">{pendingCount}</span>
              <span className="text-xs">◉</span>
            </span>
          </div>

          {/* Controls */}
          <div className={`flex items-center gap-1.5 ml-2 border-l pl-2 ${
            isLight ? 'border-gray-400' : 'border-neutral-700'
          }`}>
            <button
              onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
              className={`p-1.5 rounded-lg transition-all ${
                isLight
                  ? 'bg-gray-200 text-gray-600 hover:bg-gray-300 hover:text-emerald-600'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-cyan-400'
              }`}
              title={sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}
            >
              {sortOrder === 'newest' ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronUpIcon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Chat Messages list */}
      <div className={`flex-1 overflow-y-auto space-y-2 p-4 scrollbar-thin scrollbar-track-transparent ${
        isLight
          ? 'scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400'
          : 'scrollbar-thumb-green-900/30 hover:scrollbar-thumb-green-800/50'
      }`}>
        {/* Empty states */}
        {displayTransactions.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <span className="text-4xl">📭</span>
            <span className={`text-base font-medium ${isLight ? 'text-gray-600' : 'text-neutral-400'}`}>
              {hasFilters ? 'No matching messages' : viewMode === 'current' ? 'No current message' : 'No message history yet'}
            </span>
            {hasFilters && (
              <button
                onClick={() => setSearchQuery('')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all mt-2 ${
                  isLight
                    ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

      {displayTransactions.map(({user, assistant, idx}, displayIdx) => {
        const status = getStatusStyles(assistant || user)
        const isExpanded = expandedIndices.has(displayIdx)
        const currentTab = activeTab[displayIdx] || 'output'

        return (
          <div
            key={idx}
            className="animate-in fade-in slide-in-from-bottom-2 duration-300 w-full"
            onClick={() => handleToggleExpand(displayIdx)}
          >
            <div className={`group border-2 rounded-xl backdrop-blur-sm transition-all relative overflow-hidden w-full shadow-lg hover:shadow-xl ${viewMode === 'current' ? '' : 'cursor-pointer'} ${status.border} ${status.glow} ${
              isLight ? 'bg-white/90' : 'bg-neutral-900/80'
            }`}>
              {/* Progress bar for running transactions */}
              {status.progressBar && (
                <>
                  <div className={`absolute top-0 left-0 right-0 h-0.5 overflow-hidden ${
                    isLight ? 'bg-amber-100' : 'bg-amber-900/20'
                  }`}>
                    <div
                      className={`h-full ${
                        isLight
                          ? 'bg-gradient-to-r from-transparent via-amber-400 to-transparent'
                          : 'bg-gradient-to-r from-transparent via-amber-500 to-transparent'
                      }`}
                      style={{
                        width: '40%',
                        animation: 'slideProgress 2s ease-in-out infinite'
                      }}
                    />
                  </div>
                  <style>
                    {`
                      @keyframes slideProgress {
                        0% { transform: translateX(-100%); }
                        100% { transform: translateX(350%); }
                      }
                    `}
                  </style>
                </>
              )}

              {/* Header - Compact */}
              <div
                className={`flex items-center justify-between px-4 py-2.5 border-b ${viewMode === 'current' ? '' : 'cursor-pointer'} transition-colors ${
                  isLight ? 'border-gray-200 hover:bg-gray-50/50' : 'border-neutral-800/50 hover:bg-neutral-800/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  {/* Status Indicator - Smaller */}
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${status.dot} ${status.progressBar ? 'animate-pulse' : ''}`} />
                    <span className={`text-[10px] font-bold font-mono ${status.text}`}>
                      {status.label}
                    </span>
                  </div>

                  {/* Function Name - Smaller */}
                  <div className={`text-xs font-bold font-mono ${
                    isLight ? 'text-gray-800' : 'text-neutral-200'
                  }`}>
                    {user.module}/{user.function}
                  </div>

                  {/* Time - Smaller */}
                  <div className={`text-[10px] font-mono ${
                    isLight ? 'text-gray-500' : 'text-neutral-600'
                  }`}>
                    {new Date(user.timestamp).toLocaleTimeString()}
                  </div>
                </div>

                {/* Expand Icon - Smaller */}
                <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''} ${
                  isLight ? 'text-gray-500' : 'text-neutral-500'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-3 w-full">
                  {/* Tabs - Compact inline style */}
                  <div className={`inline-flex gap-1 mb-3 p-1 rounded-lg border ${
                    isLight
                      ? 'bg-gray-50 border-gray-200'
                      : 'bg-neutral-900/50 border-neutral-700/50'
                  }`}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveTab({...activeTab, [displayIdx]: 'output'})
                      }}
                      className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${
                        currentTab === 'output'
                          ? isLight
                            ? 'bg-cyan-500 text-white shadow-sm'
                            : 'bg-cyan-500 text-black shadow-sm shadow-cyan-500/20'
                          : isLight
                            ? 'text-gray-600 hover:text-gray-900'
                            : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      Result
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveTab({...activeTab, [displayIdx]: 'input'})
                      }}
                      className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${
                        currentTab === 'input'
                          ? isLight
                            ? 'bg-cyan-500 text-white shadow-sm'
                            : 'bg-cyan-500 text-black shadow-sm shadow-cyan-500/20'
                          : isLight
                            ? 'text-gray-600 hover:text-gray-900'
                            : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      Params
                    </button>
                  </div>

                  {/* Content - Clean style */}
                  <div className={`border rounded-xl p-4 max-h-[32rem] overflow-auto scrollbar-thin w-full relative ${
                    isLight
                      ? 'border-gray-200 bg-gray-50/50 scrollbar-thumb-gray-300'
                      : 'border-neutral-700/50 bg-neutral-900/50 scrollbar-thumb-neutral-700'
                  }`} style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                    {currentTab === 'output' && assistant ? (
                      <div className="space-y-2">
                        {/* Copy button in top right corner */}
                        <div className="absolute top-3 right-3">
                          <CopyButton text={assistant.content} size="sm" />
                        </div>

                        {/* Parse and display result */}
                        {(() => {
                          try {
                            const result = JSON.parse(assistant.content)
                            const jsonString = JSON.stringify(result, null, 2)

                            return (
                              <pre className={`text-sm leading-relaxed whitespace-pre-wrap font-mono ${
                                isLight ? 'text-green-700' : 'text-green-400'
                              }`} style={{ paddingRight: '2rem' }}>
                                {jsonString}
                              </pre>
                            )
                          } catch (e) {
                            // Not JSON, display as plain text
                            return (
                              <pre className={`text-sm leading-relaxed whitespace-pre-wrap font-mono ${
                                isLight ? 'text-green-700' : 'text-green-400'
                              }`} style={{ paddingRight: '2rem' }}>
                                {assistant.content}
                              </pre>
                            )
                          }
                        })()}
                      </div>
                    ) : currentTab === 'input' ? (
                      <div className="relative">
                        {/* Copy button in top right corner */}
                        <div className="absolute top-0 right-0">
                          <CopyButton text={JSON.stringify(user.params || {}, null, 2)} size="sm" />
                        </div>
                        <pre className={`text-sm leading-relaxed whitespace-pre-wrap font-mono ${
                          isLight ? 'text-gray-800' : 'text-neutral-300'
                        }`} style={{ paddingRight: '2rem' }}>
                          {JSON.stringify(user.params || {}, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <div className={`flex items-center gap-2 ${
                        isLight ? 'text-amber-600' : 'text-amber-400'
                      }`}>
                        <div className="relative">
                          <div className={`animate-spin rounded-full h-3 w-3 border-2 border-t-transparent ${
                            isLight ? 'border-amber-600' : 'border-amber-500'
                          }`} />
                        </div>
                        <span className="text-[10px] font-mono font-bold">Waiting...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}

        {/* Loading indicator for new request - Compact */}
        {isLoading && allTransactions.length === 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className={`group border rounded-lg backdrop-blur-sm relative overflow-hidden ${
              isLight
                ? 'bg-white/80 border-amber-300/50'
                : 'bg-neutral-900/60 border-amber-500/20'
            }`}>
              <div className={`absolute top-0 left-0 right-0 h-0.5 overflow-hidden ${
                isLight ? 'bg-amber-100' : 'bg-amber-900/20'
              }`}>
                <div className={`h-full ${
                  isLight
                    ? 'bg-gradient-to-r from-transparent via-amber-400 to-transparent'
                    : 'bg-gradient-to-r from-transparent via-amber-500 to-transparent'
                }`} style={{ width: '40%', animation: 'slideProgress 2s ease-in-out infinite' }} />
              </div>
              <div className="px-3 py-2 flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse`} />
                <span className={`text-[10px] font-bold font-mono ${
                  isLight ? 'text-amber-600' : 'text-amber-400'
                }`}>RUNNING</span>
                <span className={`text-xs font-mono ${
                  isLight ? 'text-gray-600' : 'text-neutral-400'
                }`}>Processing...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}
