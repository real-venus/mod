"use client";

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChatMessages } from './components/ChatMessages'
import { useChatState } from './hooks/useChatState'
import { useModules } from './hooks/useModules'
import { useFetchedSchemas } from './hooks/useFetchedSchemas'
import { useTheme } from '@/context/ThemeContext'
import type { Message, Transaction, FunctionSchema } from './types'

// Chat session interface
export interface ChatSession {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  module?: string
  function?: string
  moduleCid?: string
  moduleOwner?: string
  moduleVersion?: string
}

// Local storage management
const STORAGE_KEY = 'chat_sessions'

function loadSessions(): ChatSession[] {
  if (typeof window === 'undefined') return []
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return []
  try {
    return JSON.parse(stored)
  } catch {
    return []
  }
}

function saveSessions(sessions: ChatSession[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

/**
 * Professional Chat Interface with session management
 */
export default function ChatInterface() {
  const chatState = useChatState()
  const { effectiveTheme } = useTheme()
  const isLight = effectiveTheme === 'light'
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState<string>('')
  const [showModuleSelector, setShowModuleSelector] = useState(false)
  const [moduleSearchQuery, setModuleSearchQuery] = useState('')
  const [inputMode, setInputMode] = useState<'chat' | 'params'>('chat')
  const [selectedParam, setSelectedParam] = useState<string>('')
  const [filterOwner, setFilterOwner] = useState<string>('')
  const [filterVersion, setFilterVersion] = useState<string>('')
  const [groupBy, setGroupBy] = useState<'none' | 'owner' | 'version'>('none')
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [showCodeViewer, setShowCodeViewer] = useState(false)

  // Load sessions from localStorage on mount
  useEffect(() => {
    const loaded = loadSessions()

    // Filter out sessions with no messages that are older than 1 hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000)
    const filtered = loaded.filter(s =>
      s.messages.length > 0 || s.updatedAt > oneHourAgo
    )

    setSessions(filtered)
    if (filtered.length > 0 && !currentSessionId) {
      setCurrentSessionId(filtered[0].id)
      chatState.setMessages(filtered[0].messages)
    }
  }, [])

  // Save sessions whenever they change and cleanup empty ones
  useEffect(() => {
    if (sessions.length > 0) {
      saveSessions(sessions)
    }
  }, [sessions])

  // Cleanup empty sessions when switching sessions
  useEffect(() => {
    const timer = setTimeout(() => {
      // Inline cleanup logic to avoid dependency issues
      setSessions(prev => {
        const oneHourAgo = Date.now() - (60 * 60 * 1000)
        return prev.filter(s =>
          s.messages.length > 0 ||
          s.id === currentSessionId ||
          s.updatedAt > oneHourAgo
        )
      })
    }, 1000)

    return () => clearTimeout(timer)
  }, [currentSessionId])

  // Sync current session messages
  useEffect(() => {
    if (currentSessionId) {
      setSessions(prev => prev.map(s =>
        s.id === currentSessionId
          ? { ...s, messages: chatState.messages, updatedAt: Date.now() }
          : s
      ))
    }
  }, [chatState.messages, currentSessionId])

  // Load modules
  useModules({
    client: chatState.client,
    selectedModules: chatState.selectedModules,
    setAllModules: chatState.setAllModules,
    setSelectedModules: chatState.setSelectedModules,
    setParams: chatState.setParams,
    setDefaultParams: chatState.setDefaultParams,
    selectedFunction: chatState.selectedFunction
  })

  const { combinedSchema: fetchedCombinedSchema } = useFetchedSchemas({
    selectedModules: chatState.selectedModules,
    client: chatState.client
  })

  // Type as Record since it's normalized by the hook
  const combinedSchema = fetchedCombinedSchema as Record<string, FunctionSchema>

  // Auto-select "forward" function if available
  useEffect(() => {
    if (combinedSchema && Object.keys(combinedSchema).length > 0 && !chatState.selectedFunction) {
      // Check if "forward" exists in the schema
      if ('forward' in combinedSchema) {
        chatState.setSelectedFunction('forward')
      } else {
        // Fallback to first function if "forward" doesn't exist
        chatState.setSelectedFunction(Object.keys(combinedSchema)[0])
      }
    }
  }, [combinedSchema, chatState.selectedFunction])

  // Auto-select first parameter when function changes (maintain arg position order)
  useEffect(() => {
    if (chatState.selectedFunction && combinedSchema && combinedSchema[chatState.selectedFunction]) {
      const input = combinedSchema[chatState.selectedFunction].input

      // Input is already normalized to map format by useFetchedSchemas
      const params = Object.keys(input || {}).filter(k => k !== 'self' && k !== 'cls' && k !== 'kwargs')

      if (params.length > 0 && !selectedParam) {
        // Select first parameter (maintains argument position order from schema)
        setSelectedParam(params[0])
      }
    }
  }, [chatState.selectedFunction, combinedSchema, selectedParam])

  const createNewSession = useCallback(() => {
    // First, clean up any empty sessions that aren't current
    setSessions(prev => {
      const currentSession = prev.find(s => s.id === currentSessionId)

      // If current session is empty, just keep it and remove all other empty ones
      if (currentSession && currentSession.messages.length === 0) {
        return prev.filter(s => s.messages.length > 0 || s.id === currentSessionId)
      }

      // Otherwise, remove all empty sessions and create a new one
      const filtered = prev.filter(s => s.messages.length > 0)
      const newSession: ChatSession = {
        id: Date.now().toString(),
        title: 'New Chat',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      // Set this as current
      setTimeout(() => {
        setCurrentSessionId(newSession.id)
        chatState.setMessages([])
        chatState.setInput('')
      }, 0)

      return [newSession, ...filtered]
    })
  }, [chatState, currentSessionId])

  const deleteSession = useCallback((id: string) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id)
      if (currentSessionId === id && filtered.length > 0) {
        setCurrentSessionId(filtered[0].id)
        chatState.setMessages(filtered[0].messages)
      } else if (filtered.length === 0) {
        // Don't auto-create, just clear state
        setCurrentSessionId(null)
        chatState.setMessages([])
      }
      return filtered
    })
  }, [currentSessionId, chatState])

  // Clean up empty sessions (except the current one if it's the only one)
  const cleanupEmptySessions = useCallback(() => {
    setSessions(prev => {
      // Keep sessions that have messages, or the current session if it's the only empty one
      const nonEmpty = prev.filter(s => s.messages.length > 0)
      const empty = prev.filter(s => s.messages.length === 0)

      // If we have non-empty sessions, remove all empty ones except current
      if (nonEmpty.length > 0) {
        const keepEmpty = empty.filter(s => s.id === currentSessionId)
        return [...nonEmpty, ...keepEmpty]
      }

      // If all are empty, keep only the most recent one
      if (empty.length > 1) {
        const mostRecent = empty.reduce((latest, session) =>
          session.updatedAt > latest.updatedAt ? session : latest
        )
        return [mostRecent]
      }

      return prev
    })
  }, [currentSessionId])

  const switchSession = useCallback((id: string) => {
    const session = sessions.find(s => s.id === id)
    if (session) {
      setCurrentSessionId(id)
      chatState.setMessages(session.messages)
      chatState.setInput('')
    }
  }, [sessions, chatState])

  const renameSession = useCallback((id: string, newTitle: string) => {
    setSessions(prev => prev.map(s =>
      s.id === id ? { ...s, title: newTitle } : s
    ))
  }, [])

  const handleCancel = useCallback(() => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
      chatState.setIsLoading(false)
    }
  }, [abortController, chatState])

  const handleSubmit = useCallback(async () => {
    if (chatState.isLoading || !chatState.client) {
      return
    }

    // In chat mode, check if input is not empty
    // In params mode, allow submission with params
    if (inputMode === 'chat' && !chatState.input.trim()) {
      return
    }

    // Build params based on mode
    const finalParams = inputMode === 'chat'
      ? { ...chatState.params, [selectedParam]: chatState.input.trim() }
      : { ...chatState.params }

    const userMessage: Message = {
      role: 'user',
      content: inputMode === 'chat' ? chatState.input.trim() : JSON.stringify(finalParams, null, 2),
      timestamp: Date.now(),
      module: chatState.selectedModules[0]?.name,
      function: chatState.selectedFunction,
      params: finalParams
    }

    chatState.setMessages(prev => [...prev, userMessage])
    chatState.setInput('')
    chatState.setIsLoading(true)

    const controller = new AbortController()
    setAbortController(controller)

    try {
      if (chatState.selectedModules.length > 0 && chatState.selectedFunction) {
        const module = chatState.selectedModules[0]
        const fn = `${module.name}/${chatState.selectedFunction}`

        const result = await chatState.client.call('call', {
          fn,
          params: finalParams,
          wait: true,
          token: chatState.client.token
        })

        // Extract CID from result if it exists
        let responseCid: string | undefined
        let inputCid: string | undefined
        let contentToDisplay: string

        if (typeof result === 'object' && result !== null) {
          responseCid = result.cid
          inputCid = result.inputCid || result.input_cid
          // Display the full result as JSON
          contentToDisplay = JSON.stringify(result, null, 2)
        } else {
          contentToDisplay = typeof result === 'string' ? result : JSON.stringify(result, null, 2)
        }

        const assistantMessage: Message = {
          role: 'assistant',
          content: contentToDisplay,
          timestamp: Date.now(),
          module: module.name,
          function: chatState.selectedFunction,
          cid: responseCid,
          inputCid: inputCid
        }

        chatState.setMessages(prev => [...prev, assistantMessage])

        // Update session title and module info if it's the first message
        if (currentSessionId) {
          setSessions(prev => prev.map(s =>
            s.id === currentSessionId && s.title === 'New Chat'
              ? {
                  ...s,
                  title: userMessage.content.slice(0, 50) + (userMessage.content.length > 50 ? '...' : ''),
                  moduleCid: module.cid,
                  moduleOwner: module.owner,
                  moduleVersion: module.version
                }
              : s
          ))
        }
      } else {
        // No module/function selected - just echo or error
        const errorMessage: Message = {
          role: 'assistant',
          content: 'Please select a module and function to process your request.',
          timestamp: Date.now()
        }
        chatState.setMessages(prev => [...prev, errorMessage])
      }
    } catch (error) {
      console.error('Error calling function:', error)
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      }
      chatState.setMessages(prev => [...prev, errorMessage])
    } finally {
      setAbortController(null)
      chatState.setIsLoading(false)
    }
  }, [chatState, currentSessionId, inputMode, selectedParam])

  const currentSession = sessions.find(s => s.id === currentSessionId)

  return (
    <div className={`flex h-full w-full transition-colors ${
      isLight
        ? 'bg-gradient-to-br from-gray-50 via-white to-gray-100 text-gray-900'
        : 'bg-gradient-to-br from-black via-neutral-950 to-black text-white'
    }`}>
      {/* Sidebar */}
      <div
        className={`flex-shrink-0 border-r backdrop-blur-xl transition-all duration-300 ${
          sidebarOpen ? 'w-80' : 'w-0'
        } overflow-hidden flex flex-col shadow-2xl ${
          isLight
            ? 'border-gray-200 bg-white/80'
            : 'border-neutral-800/50 bg-black/40'
        }`}
      >
        {/* Sidebar Header */}
        <div className={`p-5 border-b flex-shrink-0 ${
          isLight
            ? 'border-gray-200 bg-gradient-to-b from-gray-50 to-transparent'
            : 'border-neutral-800/50 bg-gradient-to-b from-neutral-900/50 to-transparent'
        }`}>
          <button
            onClick={createNewSession}
            className={`w-full px-5 py-3 bg-gradient-to-r font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02] active:scale-[0.98] ${
              isLight
                ? 'from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-green-200 hover:shadow-green-300'
                : 'from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-black shadow-green-900/50 hover:shadow-green-800/60'
            }`}
            style={{ fontFamily: 'IBM Plex Mono, monospace' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span className="tracking-wide">NEW CHAT</span>
          </button>
        </div>

        {/* Sessions List */}
        <div className={`flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent ${
          isLight
            ? 'scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400'
            : 'scrollbar-thumb-green-900/50 hover:scrollbar-thumb-green-800/70'
        }`}>
          <div className="p-3 space-y-2">
            {sessions.map(session => (
              <div
                key={session.id}
                className={`group relative px-4 py-3.5 cursor-pointer rounded-xl transition-all duration-200 ${
                  currentSessionId === session.id
                    ? isLight
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 shadow-lg shadow-green-100'
                      : 'bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-500/30 shadow-lg shadow-green-900/20'
                    : isLight
                      ? 'bg-gray-50 hover:bg-gray-100 border border-transparent hover:border-gray-200'
                      : 'bg-neutral-900/30 hover:bg-neutral-800/50 border border-transparent hover:border-neutral-700/50'
                }`}
                onClick={() => switchSession(session.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {editingSessionId === session.id ? (
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            renameSession(session.id, editingTitle)
                            setEditingSessionId(null)
                          } else if (e.key === 'Escape') {
                            setEditingSessionId(null)
                          }
                        }}
                        onBlur={() => {
                          renameSession(session.id, editingTitle)
                          setEditingSessionId(null)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        className={`w-full text-sm font-semibold px-2 py-1 rounded border focus:outline-none ${
                          isLight
                            ? 'bg-white text-green-700 border-green-400 focus:border-green-600'
                            : 'bg-neutral-800 text-green-300 border-green-500/50 focus:border-green-500'
                        }`}
                      />
                    ) : (
                      <div
                        className={`text-sm font-semibold truncate mb-1.5 ${
                          currentSessionId === session.id
                            ? isLight ? 'text-green-700' : 'text-green-300'
                            : isLight ? 'text-gray-800' : 'text-neutral-200'
                        }`}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          setEditingSessionId(session.id)
                          setEditingTitle(session.title)
                        }}
                      >
                        {session.title}
                      </div>
                    )}
                    <div className={`flex items-center gap-2 text-[11px] font-mono ${
                      isLight ? 'text-gray-500' : 'text-neutral-500'
                    }`}>
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        {session.messages.length}
                      </span>
                      <span className={isLight ? 'text-gray-300' : 'text-neutral-700'}>·</span>
                      <span>{new Date(session.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingSessionId(session.id)
                        setEditingTitle(session.title)
                      }}
                      className={`transition-all p-1.5 rounded-lg ${
                        isLight
                          ? 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                          : 'text-neutral-500 hover:text-green-400 hover:bg-green-950/30'
                      }`}
                      title="Rename"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteSession(session.id)
                      }}
                      className={`transition-all p-1.5 rounded-lg ${
                        isLight
                          ? 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                          : 'text-neutral-500 hover:text-red-400 hover:bg-red-950/30'
                      }`}
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className={`p-4 border-t flex-shrink-0 ${
          isLight
            ? 'border-gray-200 bg-gradient-to-t from-gray-50 to-transparent'
            : 'border-neutral-800/50 bg-gradient-to-t from-neutral-900/50 to-transparent'
        }`}>
          <div className={`flex items-center justify-between text-xs font-mono ${
            isLight ? 'text-gray-500' : 'text-neutral-600'
          }`}>
            <span>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
            <span className={isLight ? 'text-green-500' : 'text-green-600/60'}>●</span>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${
        isLight
          ? 'bg-gradient-to-b from-white to-gray-50'
          : 'bg-gradient-to-b from-black to-neutral-950'
      }`}>
        {/* Header - Single Line with Module Info */}
        <div className={`flex-shrink-0 border-b backdrop-blur-xl px-6 py-3 shadow-xl relative z-50 ${
          isLight
            ? 'border-gray-200 bg-white/60'
            : 'border-neutral-800/50 bg-black/40'
        }`}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`p-2 rounded-xl transition-all hover:scale-105 active:scale-95 flex-shrink-0 ${
                isLight
                  ? 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                  : 'hover:bg-neutral-800/50 text-neutral-400 hover:text-white'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Module Search - Compact */}
            {chatState.allModules.length > 0 && (
              <div className="relative flex-1 max-w-xs z-[100]">
                <div className="relative">
                  <input
                    type="text"
                    value={moduleSearchQuery}
                    onChange={(e) => setModuleSearchQuery(e.target.value)}
                    onFocus={() => setShowModuleSelector(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const filtered = chatState.allModules.filter(m => {
                          if (moduleSearchQuery.trim()) {
                            const query = moduleSearchQuery.toLowerCase()
                            const matches = m.name.toLowerCase().includes(query) ||
                              m.cid?.toLowerCase().includes(query) ||
                              m.owner?.toLowerCase().includes(query)
                            if (!matches) return false
                          }
                          if (filterOwner && m.owner !== filterOwner) return false
                          if (filterVersion && m.version !== filterVersion) return false
                          return true
                        })
                        if (filtered.length > 0) {
                          chatState.setSelectedModules([filtered[0]])
                          setShowModuleSelector(false)
                          setModuleSearchQuery(filtered[0].name)
                        }
                      }
                    }}
                    placeholder={chatState.selectedModules[0] ? chatState.selectedModules[0].name : "Search modules..."}
                    className={`w-full px-3 py-1.5 pl-9 border rounded-lg text-xs font-mono focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all backdrop-blur-sm shadow-lg ${
                      isLight
                        ? 'bg-white border-gray-200 text-gray-800 placeholder-gray-400 hover:bg-gray-50'
                        : 'bg-neutral-900/80 border-neutral-700/50 text-neutral-300 placeholder-neutral-600 hover:bg-neutral-800/80'
                    }`}
                  />
                  <svg className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${
                    isLight ? 'text-gray-400' : 'text-neutral-500'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {chatState.selectedModules[0] && (
                    <button
                      onClick={() => {
                        chatState.setSelectedModules([])
                        setModuleSearchQuery('')
                      }}
                      className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200/50 transition-colors ${
                        isLight ? 'text-gray-500 hover:text-gray-700' : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                      title="Clear selection"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {showModuleSelector && (
                  <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => {
                      setShowModuleSelector(false)
                      if (!chatState.selectedModules[0]) setModuleSearchQuery('')
                    }} />
                    <div className={`absolute top-full left-0 mt-2 w-full max-w-2xl rounded-xl border shadow-2xl z-[9999] ${
                        isLight
                          ? 'bg-white border-gray-200'
                          : 'bg-neutral-900 border-neutral-700'
                      }`}>
                      {/* Filters Header */}
                      <div className={`px-4 py-3 border-b ${
                        isLight ? 'border-gray-200 bg-gray-50' : 'border-neutral-800 bg-neutral-900/50'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs font-bold uppercase tracking-wider ${
                            isLight ? 'text-gray-600' : 'text-neutral-500'
                          }`}>Filter by:</span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {/* Owner Filter */}
                          {Array.from(new Set(chatState.allModules.map(m => m.owner).filter(Boolean))).map(owner => (
                            <button
                              key={owner}
                              onClick={() => setFilterOwner(filterOwner === owner ? '' : owner!)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                                filterOwner === owner
                                  ? isLight
                                    ? 'bg-blue-500 text-white border-2 border-blue-600'
                                    : 'bg-blue-600 text-white border-2 border-blue-500'
                                  : isLight
                                    ? 'bg-white text-gray-700 border border-gray-300 hover:border-blue-400'
                                    : 'bg-neutral-800/50 text-neutral-300 border border-neutral-700 hover:border-blue-500'
                              }`}
                            >
                              👤 {owner!.slice(0, 6)}...{owner!.slice(-4)}
                            </button>
                          ))}
                          {/* Version Filter */}
                          {Array.from(new Set(chatState.allModules.map(m => m.version).filter(Boolean))).map(version => (
                            <button
                              key={version}
                              onClick={() => setFilterVersion(filterVersion === version ? '' : version!)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                                filterVersion === version
                                  ? isLight
                                    ? 'bg-purple-500 text-white border-2 border-purple-600'
                                    : 'bg-purple-600 text-white border-2 border-purple-500'
                                  : isLight
                                    ? 'bg-white text-gray-700 border border-gray-300 hover:border-purple-400'
                                    : 'bg-neutral-800/50 text-neutral-300 border border-neutral-700 hover:border-purple-500'
                              }`}
                            >
                              📦 v{version}
                            </button>
                          ))}
                          {/* Clear Filters */}
                          {(filterOwner || filterVersion) && (
                            <button
                              onClick={() => {
                                setFilterOwner('')
                                setFilterVersion('')
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                                isLight
                                  ? 'bg-red-100 text-red-700 border border-red-300 hover:bg-red-200'
                                  : 'bg-red-900/30 text-red-400 border border-red-800 hover:bg-red-900/50'
                              }`}
                            >
                              ✕ Clear
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Modules List */}
                      <div className={`max-h-[400px] overflow-y-auto scrollbar-thin ${
                        isLight
                          ? 'scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400'
                          : 'scrollbar-thumb-green-900/50 hover:scrollbar-thumb-green-800/70'
                      }`}>
                        {chatState.allModules
                          .filter(m => {
                            // Text search filter
                            if (moduleSearchQuery.trim()) {
                              const query = moduleSearchQuery.toLowerCase()
                              const matches = m.name.toLowerCase().includes(query) ||
                                m.cid?.toLowerCase().includes(query) ||
                                m.owner?.toLowerCase().includes(query)
                              if (!matches) return false
                            }
                            // Owner filter
                            if (filterOwner && m.owner !== filterOwner) return false
                            // Version filter
                            if (filterVersion && m.version !== filterVersion) return false
                            return true
                          })
                          .map(m => (
                            <button
                              key={m.key}
                              onClick={() => {
                                chatState.setSelectedModules([m])
                                setShowModuleSelector(false)
                                setModuleSearchQuery(m.name)
                              }}
                              className={`w-full text-left px-4 py-3 transition-all border-b last:border-b-0 ${
                                chatState.selectedModules[0]?.key === m.key
                                  ? isLight
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-green-900/20 border-green-800/30'
                                  : isLight
                                    ? 'hover:bg-gray-50 border-gray-100'
                                    : 'hover:bg-neutral-800/50 border-neutral-800/30'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-4 mb-2">
                                <span className={`font-bold text-sm ${
                                  isLight ? 'text-gray-900' : 'text-white'
                                }`}>{m.name}</span>
                                {m.version && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    isLight
                                      ? 'bg-purple-100 text-purple-700'
                                      : 'bg-purple-900/30 text-purple-400'
                                  }`}>v{m.version}</span>
                                )}
                              </div>
                              <div className="space-y-1">
                                {m.owner && (
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-bold uppercase ${
                                      isLight ? 'text-gray-500' : 'text-neutral-500'
                                    }`}>CID:</span>
                                    <code className={`text-xs font-mono ${
                                      isLight ? 'text-blue-700' : 'text-blue-400'
                                    }`}>{m.owner.slice(0, 8)}...{m.owner.slice(-6)}</code>
                                  </div>
                                )}
                              </div>
                            </button>
                          ))}
                        {chatState.allModules.filter(m => {
                          // Text search filter
                          if (moduleSearchQuery.trim()) {
                            const query = moduleSearchQuery.toLowerCase()
                            const matches = m.name.toLowerCase().includes(query) ||
                              m.cid?.toLowerCase().includes(query) ||
                              m.owner?.toLowerCase().includes(query)
                            if (!matches) return false
                          }
                          // Owner filter
                          if (filterOwner && m.owner !== filterOwner) return false
                          // Version filter
                          if (filterVersion && m.version !== filterVersion) return false
                          return true
                        }).length === 0 && (
                          <div className={`px-4 py-8 text-center ${
                            isLight ? 'text-gray-500' : 'text-neutral-500'
                          }`}>
                            <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <p className="text-sm font-mono mb-2">No modules found</p>
                            {(moduleSearchQuery || filterOwner || filterVersion) && (
                              <p className="text-xs">
                                {moduleSearchQuery && `Search: "${moduleSearchQuery}"`}
                                {filterOwner && ` • Owner: ${filterOwner.slice(0, 8)}...`}
                                {filterVersion && ` • Version: ${filterVersion}`}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    </>
                  )}
              </div>
            )}

            {/* Module Details - Inline CID, Owner, Updated */}
            {chatState.selectedModules.length > 0 && (
              <>
                {chatState.selectedModules[0].cid && (
                  <div className="flex items-center gap-1">
                    <span className={`text-[9px] uppercase tracking-wider font-bold font-mono ${
                      isLight ? 'text-gray-500' : 'text-neutral-600'
                    }`}>CID</span>
                    <code className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      isLight
                        ? 'text-green-700 bg-green-50'
                        : 'text-green-400 bg-green-900/20'
                    }`}>
                      {chatState.selectedModules[0].cid.slice(0, 8)}...{chatState.selectedModules[0].cid.slice(-4)}
                    </code>
                  </div>
                )}
                {chatState.selectedModules[0].owner && (
                  <div className="flex items-center gap-1">
                    <span className={`text-[9px] uppercase tracking-wider font-bold font-mono ${
                      isLight ? 'text-gray-500' : 'text-neutral-600'
                    }`}>OWNER</span>
                    <code className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      isLight
                        ? 'text-blue-700 bg-blue-50'
                        : 'text-blue-400 bg-blue-900/20'
                    }`}>
                      {chatState.selectedModules[0].owner.slice(0, 6)}...{chatState.selectedModules[0].owner.slice(-4)}
                    </code>
                  </div>
                )}
                {chatState.selectedModules[0].updated && (
                  <div className="flex items-center gap-1">
                    <span className={`text-[9px] uppercase tracking-wider font-bold font-mono ${
                      isLight ? 'text-gray-500' : 'text-neutral-600'
                    }`}>UPDATED</span>
                    <code className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      isLight
                        ? 'text-gray-700 bg-gray-100'
                        : 'text-gray-400 bg-neutral-800'
                    }`}>
                      {new Date(chatState.selectedModules[0].updated * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </code>
                  </div>
                )}
              </>
            )}

            {/* Session title on the right */}
            <div className="ml-auto flex-shrink-0">
              {chatState.selectedModules.length > 0 && chatState.selectedFunction && (
                <p className={`text-xs font-mono flex items-center justify-end gap-1.5 ${
                  isLight ? 'text-gray-600' : 'text-neutral-500'
                }`}>
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  {chatState.selectedModules[0].name} / {chatState.selectedFunction}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Messages Area - Chat App Style */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <ChatMessages messages={chatState.messages} isLoading={chatState.isLoading} />
          </div>
        </div>

        {/* Input Area - AT BOTTOM */}
        <div className={`flex-shrink-0 border-t backdrop-blur-xl shadow-2xl relative overflow-hidden ${
          isLight
            ? 'border-gray-200 bg-gradient-to-b from-white to-gray-50/80'
            : 'border-neutral-800/50 bg-gradient-to-b from-neutral-900/50 to-black/40'
        }`}>
          {/* Subtle top glow effect */}
          <div className={`absolute top-0 left-0 right-0 h-px ${
            isLight
              ? 'bg-gradient-to-r from-transparent via-green-400/30 to-transparent'
              : 'bg-gradient-to-r from-transparent via-green-500/40 to-transparent'
          }`}></div>
          <div className="max-w-4xl mx-auto">
            {/* Combined Function Selector + Mode Selector - Single Line */}
            {chatState.selectedModules.length > 0 && combinedSchema && Object.keys(combinedSchema).length > 0 && (
              <div className={`px-6 pt-4 pb-2 flex items-center gap-3 ${
                chatState.selectedFunction ? (isLight ? 'border-b border-gray-200' : 'border-b border-neutral-800/50') : ''
              }`}>
                {/* Function Selector */}
                <select
                  value={chatState.selectedFunction}
                  onChange={(e) => chatState.setSelectedFunction(e.target.value)}
                  className={`flex-1 max-w-md px-4 py-2 border rounded-xl text-sm font-mono focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all backdrop-blur-sm shadow-lg ${
                    isLight
                      ? 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
                      : 'bg-neutral-900/80 border-neutral-700/50 text-neutral-300 hover:bg-neutral-800/80'
                  }`}
                >
                  <option value="">Select Function</option>
                  {Object.keys(combinedSchema).map(fn => (
                    <option key={fn} value={fn}>{fn}</option>
                  ))}
                </select>

                {/* Mode Controls - Only show when function is selected */}
                {chatState.selectedFunction && combinedSchema[chatState.selectedFunction] && (
                  <>
                {/* Mode Toggle - Compact */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setInputMode('chat')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold transition-all ${
                      inputMode === 'chat'
                        ? isLight
                          ? 'bg-green-500 text-white'
                          : 'bg-green-600 text-black'
                        : isLight
                          ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                          : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                    }`}
                  >
                    💬 CHAT
                  </button>
                  <button
                    onClick={() => setInputMode('params')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold transition-all ${
                      inputMode === 'params'
                        ? isLight
                          ? 'bg-green-500 text-white'
                          : 'bg-green-600 text-black'
                        : isLight
                          ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                          : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                    }`}
                  >
                    ⚙️ PARAMS
                  </button>
                </div>

                {/* Chat Mode - Parameter Selector */}
                {inputMode === 'chat' && (
                  <div className="flex items-center gap-2 flex-1">
                    <span className={`text-[10px] font-mono uppercase ${
                      isLight ? 'text-gray-500' : 'text-neutral-600'
                    }`}>Param:</span>
                    <select
                      value={selectedParam}
                      onChange={(e) => setSelectedParam(e.target.value)}
                      className={`px-2 py-1 rounded-md text-xs font-mono border ${
                        isLight
                          ? 'bg-white border-gray-300 text-gray-800'
                          : 'bg-neutral-800 border-neutral-700 text-neutral-200'
                      }`}
                    >
                      {Object.keys(combinedSchema[chatState.selectedFunction]?.input || {}).length === 0 ? (
                        <option value="">(_empty)</option>
                      ) : (
                        Object.entries(combinedSchema[chatState.selectedFunction]?.input || {}).map(([paramName, param]) => (
                          <option key={paramName} value={paramName}>
                            {paramName} ({param.type || 'any'})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}

                {/* Code Viewer Toggle */}
                <button
                  onClick={() => setShowCodeViewer(!showCodeViewer)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold transition-all flex items-center gap-1 ${
                    showCodeViewer
                      ? isLight
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-purple-900/30 text-purple-400'
                      : isLight
                        ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                >
                  💻 CODE
                </button>

                {/* Advanced Settings Toggle */}
                <button
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  className={`ml-auto px-2.5 py-1 rounded-md text-[10px] font-mono font-bold transition-all flex items-center gap-1 ${
                    showAdvancedSettings
                      ? isLight
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-blue-900/30 text-blue-400'
                      : isLight
                        ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                >
                  ⚙️ ADVANCED
                  <svg className={`w-3 h-3 transition-transform ${showAdvancedSettings ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                    <div className={`text-[10px] font-mono ${
                      isLight ? 'text-gray-500' : 'text-neutral-600'
                    }`}>
                      {Object.keys(combinedSchema[chatState.selectedFunction]?.input || {}).length} params
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Advanced Settings Panel */}
            {showAdvancedSettings && chatState.selectedFunction && combinedSchema && combinedSchema[chatState.selectedFunction] && (
              <div className={`px-6 py-3 border-b ${
                isLight ? 'border-gray-200 bg-gray-50' : 'border-neutral-800/50 bg-neutral-900/30'
              }`}>
                <div className={`text-[10px] font-mono uppercase tracking-wider mb-2 ${
                  isLight ? 'text-gray-600' : 'text-neutral-500'
                }`}>
                  All Parameters:
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {Object.entries(combinedSchema[chatState.selectedFunction]?.input || {}).map(([paramName, paramSchema]: [string, any]) => {
                    const currentValue = inputMode === 'chat' && paramName === selectedParam
                      ? chatState.input
                      : (chatState.params[paramName] !== undefined ? chatState.params[paramName] : (paramSchema.value || ''))

                    return (
                      <div
                        key={paramName}
                        onClick={() => {
                          if (inputMode === 'chat') {
                            setSelectedParam(paramName)
                          }
                        }}
                        className={`px-2 py-1.5 rounded-md border cursor-pointer transition-all ${
                          inputMode === 'chat' && paramName === selectedParam
                            ? isLight
                              ? 'bg-green-100 border-green-400'
                              : 'bg-green-900/30 border-green-500/50'
                            : isLight
                              ? 'bg-white border-gray-300 hover:border-green-400'
                              : 'bg-neutral-800/50 border-neutral-700 hover:border-green-500/50'
                        }`}
                      >
                        <div className={`text-[10px] font-mono font-bold mb-0.5 ${
                          inputMode === 'chat' && paramName === selectedParam
                            ? isLight ? 'text-green-700' : 'text-green-400'
                            : isLight ? 'text-gray-700' : 'text-neutral-300'
                        }`}>
                          {paramName}
                          <span className={`ml-1 text-[9px] font-normal ${
                            isLight ? 'text-gray-500' : 'text-neutral-600'
                          }`}>({paramSchema.type || 'any'})</span>
                        </div>
                        <div className={`text-[10px] font-mono truncate ${
                          currentValue
                            ? isLight ? 'text-gray-800' : 'text-neutral-300'
                            : isLight ? 'text-gray-400 italic' : 'text-neutral-600 italic'
                        }`}>
                          {currentValue || '—'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Code Viewer Panel */}
            {showCodeViewer && chatState.selectedFunction && combinedSchema && combinedSchema[chatState.selectedFunction] && (
              <div className={`px-6 py-3 border-b ${
                isLight ? 'border-gray-200 bg-gray-50' : 'border-neutral-800/50 bg-neutral-900/30'
              }`}>
                <div className={`text-[10px] font-mono uppercase tracking-wider mb-2 ${
                  isLight ? 'text-gray-600' : 'text-neutral-500'
                }`}>
                  Function Code:
                </div>
                <div className={`rounded-lg border overflow-hidden ${
                  isLight ? 'border-purple-200 bg-purple-50/30' : 'border-purple-900/50 bg-purple-950/20'
                }`}>
                  <pre className={`p-4 overflow-x-auto scrollbar-thin text-xs font-mono max-h-96 ${
                    isLight ? 'text-purple-800' : 'text-purple-300'
                  }`}>
                    <code>{combinedSchema[chatState.selectedFunction]?.content || '// No code available'}</code>
                  </pre>
                </div>
              </div>
            )}

            {/* Main Input Area - Enhanced */}
            <div className="p-6">
              {inputMode === 'chat' ? (
                // Chat Mode - Single Input with Glow Effect
                <div className="relative group">
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      {/* Glow effect on focus */}
                      <div className={`absolute inset-0 rounded-2xl transition-opacity duration-300 ${
                        isLight
                          ? 'bg-gradient-to-r from-green-400/20 via-emerald-400/20 to-green-400/20 blur-xl opacity-0 group-hover:opacity-100'
                          : 'bg-gradient-to-r from-green-500/30 via-emerald-500/30 to-green-500/30 blur-xl opacity-0 group-hover:opacity-100'
                      }`}></div>
                      <textarea
                        value={chatState.input}
                        onChange={(e) => chatState.setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSubmit()
                          }
                        }}
                        placeholder={`Enter ${selectedParam}...`}
                        rows={3}
                        disabled={chatState.isLoading}
                        className={`relative w-full border-2 rounded-2xl px-5 py-4 focus:outline-none resize-none font-mono text-base transition-all shadow-lg ${
                          isLight
                            ? 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 hover:border-green-400 hover:shadow-xl'
                            : 'bg-neutral-900/90 border-neutral-700/50 text-neutral-100 placeholder-neutral-500 focus:border-green-500/70 focus:ring-4 focus:ring-green-500/20 hover:border-green-500/50 hover:shadow-2xl hover:shadow-green-500/10'
                        }`}
                        style={{ fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.01em' }}
                      />
                    </div>
                    {chatState.isLoading ? (
                      <button
                        onClick={handleCancel}
                        className={`px-6 py-4 bg-gradient-to-br rounded-2xl transition-all font-mono text-sm font-bold border-2 flex items-center gap-3 hover:scale-105 active:scale-95 flex-shrink-0 shadow-lg ${
                          isLight
                            ? 'from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-red-400 shadow-red-500/20'
                            : 'from-red-600/90 to-red-700/90 hover:from-red-500 hover:to-red-600 text-white border-red-500/40 shadow-red-900/30'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 bg-white rounded-full animate-pulse"></span>
                        <span className="tracking-widest">STOP</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleSubmit}
                        disabled={!chatState.input.trim()}
                        className={`px-6 py-4 bg-gradient-to-br rounded-2xl transition-all font-mono text-sm font-bold border-2 flex items-center gap-3 hover:scale-105 active:scale-95 disabled:hover:scale-100 flex-shrink-0 shadow-lg ${
                          isLight
                            ? 'from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-200 disabled:to-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white disabled:opacity-50 shadow-green-500/20'
                            : 'from-green-600/90 to-emerald-600/90 hover:from-green-500 hover:to-emerald-500 disabled:from-neutral-800 disabled:to-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed text-black disabled:opacity-50 shadow-green-900/30'
                        }`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        <span className="tracking-widest">SEND</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                // Params Mode - All Fields Editable (Compact Grid)
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    {chatState.selectedFunction && combinedSchema && combinedSchema[chatState.selectedFunction] &&
                      Object.entries(combinedSchema[chatState.selectedFunction]?.input || {}).map(([paramName, paramSchema]: [string, any]) => (
                        <div key={paramName} className="space-y-1">
                          <label className={`flex items-center gap-2 text-[10px] font-mono ${
                            isLight ? 'text-gray-600' : 'text-neutral-400'
                          }`}>
                            <span className="font-bold">{paramName}</span>
                            <span className={`text-[9px] ${isLight ? 'text-gray-500' : 'text-neutral-600'}`}>
                              ({paramSchema.type || 'any'})
                            </span>
                          </label>
                          <input
                            type="text"
                            value={chatState.params[paramName] !== undefined ? chatState.params[paramName] : (paramSchema.value || '')}
                            onChange={(e) => chatState.setParams({ ...chatState.params, [paramName]: e.target.value })}
                            placeholder={`${paramName}...`}
                            className={`w-full px-3 py-2 text-xs font-mono rounded-lg border focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 transition-all ${
                              isLight
                                ? 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                                : 'bg-neutral-900/80 border-neutral-700/50 text-neutral-200 placeholder-neutral-600'
                            }`}
                          />
                        </div>
                      ))
                    }
                  </div>

                  {/* Send Button for Params Mode */}
                  <div className="flex justify-end">
                    {chatState.isLoading ? (
                      <button
                        onClick={handleCancel}
                        className={`px-4 py-2.5 bg-gradient-to-r rounded-xl transition-all font-mono text-xs font-bold border flex items-center gap-2 hover:scale-105 active:scale-95 ${
                          isLight
                            ? 'from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-red-400'
                            : 'from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white border-red-500/30'
                        }`}
                      >
                        <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                        STOP
                      </button>
                    ) : (
                      <button
                        onClick={handleSubmit}
                        className={`px-4 py-2.5 bg-gradient-to-r rounded-xl transition-all font-mono text-xs font-bold flex items-center gap-2 hover:scale-105 active:scale-95 ${
                          isLight
                            ? 'from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
                            : 'from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-black'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        SEND
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
