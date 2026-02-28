"use client";

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChatMessages } from './components/ChatMessages'
import { useChatState } from './hooks/useChatState'
import { useModules } from './hooks/useModules'
import { useFetchedSchemas } from './hooks/useFetchedSchemas'
import type { Message, Transaction } from './types'

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
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState<string>('')

  // Load sessions from localStorage on mount
  useEffect(() => {
    const loaded = loadSessions()
    setSessions(loaded)
    if (loaded.length > 0 && !currentSessionId) {
      setCurrentSessionId(loaded[0].id)
      chatState.setMessages(loaded[0].messages)
    } else if (loaded.length === 0) {
      // Create default session
      createNewSession()
    }
  }, [])

  // Save sessions whenever they change
  useEffect(() => {
    if (sessions.length > 0) {
      saveSessions(sessions)
    }
  }, [sessions])

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

  // Auto-select "forward" function when module is selected
  useEffect(() => {
    if (fetchedCombinedSchema && Object.keys(fetchedCombinedSchema).length > 0) {
      const functions = Object.keys(fetchedCombinedSchema)
      // Check if "forward" exists, otherwise use first function
      if (functions.includes('forward')) {
        chatState.setSelectedFunction('forward')
      } else if (functions.length > 0 && !chatState.selectedFunction) {
        chatState.setSelectedFunction(functions[0])
      }
    }
  }, [fetchedCombinedSchema])

  const createNewSession = useCallback(() => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    setSessions(prev => [newSession, ...prev])
    setCurrentSessionId(newSession.id)
    chatState.setMessages([])
    chatState.setInput('')
  }, [chatState])

  const deleteSession = useCallback((id: string) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id)
      if (currentSessionId === id && filtered.length > 0) {
        setCurrentSessionId(filtered[0].id)
        chatState.setMessages(filtered[0].messages)
      } else if (filtered.length === 0) {
        createNewSession()
      }
      return filtered
    })
  }, [currentSessionId, chatState, createNewSession])

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
    if (chatState.isLoading || !chatState.input.trim() || !chatState.client) {
      return
    }

    const userMessage: Message = {
      role: 'user',
      content: chatState.input.trim(),
      timestamp: Date.now(),
      module: chatState.selectedModules[0]?.name,
      function: chatState.selectedFunction,
      params: chatState.params
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
          params: {
            ...chatState.params,
            input: userMessage.content
          },
          wait: chatState.wait,
          token: chatState.client.token
        })

        const assistantMessage: Message = {
          role: 'assistant',
          content: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          timestamp: Date.now(),
          module: module.name,
          function: chatState.selectedFunction
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
  }, [chatState, currentSessionId])

  const currentSession = sessions.find(s => s.id === currentSessionId)

  return (
    <div className="flex h-full w-full bg-gradient-to-br from-black via-neutral-950 to-black text-white">
      {/* Sidebar */}
      <div
        className={`flex-shrink-0 border-r border-neutral-800/50 backdrop-blur-xl bg-black/40 transition-all duration-300 ${
          sidebarOpen ? 'w-80' : 'w-0'
        } overflow-hidden flex flex-col shadow-2xl`}
      >
        {/* Sidebar Header */}
        <div className="p-5 border-b border-neutral-800/50 flex-shrink-0 bg-gradient-to-b from-neutral-900/50 to-transparent">
          <button
            onClick={createNewSession}
            className="w-full px-5 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-black font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-900/50 hover:shadow-green-800/60 hover:scale-[1.02] active:scale-[0.98]"
            style={{ fontFamily: 'IBM Plex Mono, monospace' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span className="tracking-wide">NEW CHAT</span>
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-green-900/50 scrollbar-track-transparent hover:scrollbar-thumb-green-800/70">
          <div className="p-3 space-y-2">
            {sessions.map(session => (
              <div
                key={session.id}
                className={`group relative px-4 py-3.5 cursor-pointer rounded-xl transition-all duration-200 ${
                  currentSessionId === session.id
                    ? 'bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-500/30 shadow-lg shadow-green-900/20'
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
                        className="w-full text-sm font-semibold bg-neutral-800 text-green-300 px-2 py-1 rounded border border-green-500/50 focus:outline-none focus:border-green-500"
                      />
                    ) : (
                      <div
                        className={`text-sm font-semibold truncate mb-1.5 ${
                          currentSessionId === session.id ? 'text-green-300' : 'text-neutral-200'
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
                    <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-mono">
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        {session.messages.length}
                      </span>
                      <span className="text-neutral-700">·</span>
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
                      className="text-neutral-500 hover:text-green-400 transition-all p-1.5 hover:bg-green-950/30 rounded-lg"
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
                      className="text-neutral-500 hover:text-red-400 transition-all p-1.5 hover:bg-red-950/30 rounded-lg"
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
        <div className="p-4 border-t border-neutral-800/50 flex-shrink-0 bg-gradient-to-t from-neutral-900/50 to-transparent">
          <div className="flex items-center justify-between text-xs text-neutral-600 font-mono">
            <span>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
            <span className="text-green-600/60">●</span>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-black to-neutral-950">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-neutral-800/50 backdrop-blur-xl bg-black/40 px-6 py-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2.5 hover:bg-neutral-800/50 rounded-xl transition-all text-neutral-400 hover:text-white hover:scale-105 active:scale-95"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-white to-neutral-300 bg-clip-text text-transparent" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                  {currentSession?.title || 'Chat'}
                </h1>
                {chatState.selectedModules.length > 0 && chatState.selectedFunction && (
                  <p className="text-xs text-neutral-500 font-mono mt-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                    {chatState.selectedModules[0].name} / {chatState.selectedFunction}
                  </p>
                )}
              </div>
            </div>

            {/* Module/Function Selector - Compact */}
            <div className="flex items-center gap-3">
              {chatState.allModules.length > 0 && (
                <select
                  value={chatState.selectedModules[0]?.key || ''}
                  onChange={(e) => {
                    const module = chatState.allModules.find(m => m.key === e.target.value)
                    if (module) chatState.setSelectedModules([module])
                  }}
                  className="px-4 py-2 bg-neutral-900/80 border border-neutral-700/50 rounded-xl text-sm text-neutral-300 font-mono focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all hover:bg-neutral-800/80 backdrop-blur-sm shadow-lg"
                >
                  <option value="">Select Module</option>
                  {chatState.allModules.map(m => (
                    <option key={m.key} value={m.key}>{m.name}</option>
                  ))}
                </select>
              )}

              {chatState.selectedModules.length > 0 && fetchedCombinedSchema && Object.keys(fetchedCombinedSchema).length > 0 && (
                <select
                  value={chatState.selectedFunction}
                  onChange={(e) => chatState.setSelectedFunction(e.target.value)}
                  className="px-4 py-2 bg-neutral-900/80 border border-neutral-700/50 rounded-xl text-sm text-neutral-300 font-mono focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all hover:bg-neutral-800/80 backdrop-blur-sm shadow-lg"
                >
                  <option value="">Select Function</option>
                  {Object.keys(fetchedCombinedSchema).map(fn => (
                    <option key={fn} value={fn}>{fn}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Module Details - Hash, Owner, Version */}
          {chatState.selectedModules.length > 0 && (
            <div className="flex items-center gap-4 px-4 py-3 bg-gradient-to-r from-neutral-900/60 to-neutral-900/40 rounded-xl border border-neutral-800/50 backdrop-blur-sm shadow-inner">
              {chatState.selectedModules[0].cid && (
                <div className="flex items-center gap-2.5 group">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold font-mono">CID</span>
                  <code className="text-xs text-green-400 font-mono bg-black/50 px-3 py-1 rounded-lg border border-green-900/30 shadow-sm">
                    {chatState.selectedModules[0].cid.slice(0, 8)}...{chatState.selectedModules[0].cid.slice(-6)}
                  </code>
                  <button
                    onClick={() => {
                      if (chatState.selectedModules[0].cid) {
                        navigator.clipboard.writeText(chatState.selectedModules[0].cid)
                      }
                    }}
                    className="text-neutral-500 hover:text-green-400 transition-all p-1 hover:bg-green-950/30 rounded-lg"
                    title="Copy full CID"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              )}
              {chatState.selectedModules[0].owner && (
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold font-mono">Owner</span>
                  <code className="text-xs text-blue-400 font-mono bg-black/50 px-3 py-1 rounded-lg border border-blue-900/30 shadow-sm">
                    {chatState.selectedModules[0].owner.slice(0, 6)}...{chatState.selectedModules[0].owner.slice(-4)}
                  </code>
                </div>
              )}
              {chatState.selectedModules[0].version && (
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold font-mono">Version</span>
                  <code className="text-xs text-purple-400 font-mono bg-black/50 px-3 py-1 rounded-lg border border-purple-900/30 shadow-sm">
                    {chatState.selectedModules[0].version}
                  </code>
                </div>
              )}
              {chatState.selectedModules[0].updated && (
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold font-mono">Updated</span>
                  <code className="text-xs text-yellow-400 font-mono bg-black/50 px-3 py-1 rounded-lg border border-yellow-900/30 shadow-sm">
                    {new Date(chatState.selectedModules[0].updated * 1000).toLocaleDateString()}
                  </code>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          <ChatMessages messages={chatState.messages} isLoading={chatState.isLoading} />
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 border-t border-neutral-800/50 backdrop-blur-xl bg-black/40 p-6 shadow-2xl">
          <div className="max-w-4xl mx-auto">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl opacity-0 group-focus-within:opacity-20 blur transition-opacity duration-300"></div>
              <textarea
                value={chatState.input}
                onChange={(e) => chatState.setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
                placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
                rows={3}
                disabled={chatState.isLoading}
                className="relative w-full bg-neutral-900/80 border border-neutral-700/50 rounded-2xl px-5 py-4 pr-28 text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 resize-none font-mono text-sm backdrop-blur-sm shadow-lg transition-all"
                style={{ fontFamily: 'IBM Plex Mono, monospace' }}
              />

              <div className="absolute right-3 bottom-3 flex items-center gap-2">
                {chatState.isLoading ? (
                  <button
                    onClick={handleCancel}
                    className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl transition-all font-mono text-xs font-bold border border-red-500/30 shadow-lg shadow-red-900/50 flex items-center gap-2 hover:scale-105 active:scale-95"
                  >
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    STOP
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={!chatState.input.trim()}
                    className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-neutral-800 disabled:to-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed text-black font-bold rounded-xl transition-all font-mono text-xs shadow-lg shadow-green-900/50 disabled:shadow-none flex items-center gap-2 hover:scale-105 active:scale-95 disabled:hover:scale-100"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    SEND
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-neutral-600 font-mono">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-neutral-700 rounded-full"></span>
                {chatState.input.length} characters
              </span>
              <span className="text-neutral-700">
                Enter to send · Shift+Enter for new line
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
