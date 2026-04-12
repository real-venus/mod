"use client";

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChatMessages } from './components/ChatMessages'
import { ChatSidebar } from './components/ChatSidebar'
import { ChatHeader } from './components/ChatHeader'
import { useChatState } from './hooks/useChatState'
import { useModules } from './hooks/useModules'
import { useFetchedSchemas } from './hooks/useFetchedSchemas'
import type { Message, FunctionSchema } from './types'

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
  try { return JSON.parse(stored) } catch { return [] }
}

function saveSessions(sessions: ChatSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

/**
 * Chat Interface - Modular architecture
 * Components: ChatSidebar, ChatHeader, ChatMessages, ChatInput (inline)
 * Hooks: useChatState, useModules, useFetchedSchemas
 */
export default function ChatInterface() {
  const chatState = useChatState()

  // Session state
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)

  // Input state
  const [inputMode, setInputMode] = useState<'chat' | 'params'>('chat')
  const [selectedParam, setSelectedParam] = useState<string>('')
  const [pastedImages, setPastedImages] = useState<string[]>([])

  // ── Session Management ──

  useEffect(() => {
    const loaded = loadSessions()
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

  useEffect(() => {
    if (sessions.length > 0) saveSessions(sessions)
  }, [sessions])

  useEffect(() => {
    const timer = setTimeout(() => {
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

  useEffect(() => {
    if (currentSessionId) {
      setSessions(prev => prev.map(s =>
        s.id === currentSessionId
          ? { ...s, messages: chatState.messages, updatedAt: Date.now() }
          : s
      ))
    }
  }, [chatState.messages, currentSessionId])

  // ── Module & Schema Loading ──

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

  const combinedSchema = fetchedCombinedSchema as Record<string, FunctionSchema>

  // ── Auto-select function on start ──
  // Sets to 'forward' if available, otherwise first function
  useEffect(() => {
    if (combinedSchema && Object.keys(combinedSchema).length > 0 && !chatState.selectedFunction) {
      if ('forward' in combinedSchema) {
        chatState.setSelectedFunction('forward')
      } else {
        chatState.setSelectedFunction(Object.keys(combinedSchema)[0])
      }
    }
  }, [combinedSchema, chatState.selectedFunction])

  // Auto-select first parameter when function changes
  useEffect(() => {
    if (chatState.selectedFunction && combinedSchema && combinedSchema[chatState.selectedFunction]) {
      const input = combinedSchema[chatState.selectedFunction].input
      const params = Object.keys(input || {}).filter(k => k !== 'self' && k !== 'cls' && k !== 'kwargs')
      if (params.length > 0 && !selectedParam) {
        setSelectedParam(params[0])
      }
    }
  }, [chatState.selectedFunction, combinedSchema, selectedParam])

  // ── Session Actions ──

  const createNewSession = useCallback(() => {
    setSessions(prev => {
      const currentSession = prev.find(s => s.id === currentSessionId)
      if (currentSession && currentSession.messages.length === 0) {
        return prev.filter(s => s.messages.length > 0 || s.id === currentSessionId)
      }
      const filtered = prev.filter(s => s.messages.length > 0)
      const newSession: ChatSession = {
        id: Date.now().toString(),
        title: 'New Chat',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
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
        setCurrentSessionId(null)
        chatState.setMessages([])
      }
      return filtered
    })
  }, [currentSessionId, chatState])

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

  // ── Image Paste Handling ──

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault()
        const blob = item.getAsFile()
        if (blob) {
          const reader = new FileReader()
          reader.onload = (event) => {
            const result = event.target?.result
            if (typeof result === 'string') {
              setPastedImages(prev => [...prev, result])
            }
          }
          reader.readAsDataURL(blob)
        }
      }
    }
  }, [])

  const removePastedImage = useCallback((index: number) => {
    setPastedImages(prev => prev.filter((_, i) => i !== index))
  }, [])

  // ── Submit & Cancel ──

  const handleCancel = useCallback(() => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
      chatState.setIsLoading(false)
    }
  }, [abortController, chatState])

  const handleSubmit = useCallback(async () => {
    if (chatState.isLoading || !chatState.client) return
    if (inputMode === 'chat' && !chatState.input.trim() && pastedImages.length === 0) return

    const finalParams = inputMode === 'chat'
      ? { ...chatState.params, [selectedParam]: chatState.input.trim() }
      : { ...chatState.params }

    // Include pasted images in the message if any
    const userMessage: Message = {
      role: 'user',
      content: inputMode === 'chat' ? chatState.input.trim() : JSON.stringify(finalParams, null, 2),
      timestamp: Date.now(),
      params: finalParams,
      images: pastedImages.length > 0 ? pastedImages : undefined
    }

    chatState.setMessages(prev => [...prev, userMessage])
    chatState.setInput('')
    setPastedImages([])
    if (inputMode === 'params') {
      chatState.setParams({})
    }
    chatState.setIsLoading(true)

    const controller = new AbortController()
    setAbortController(controller)

    const streamingMessageId = Date.now()
    const streamingMessage: Message = {
      role: 'assistant',
      content: '',
      timestamp: streamingMessageId,
      module: chatState.selectedModules[0]?.name,
      function: chatState.selectedFunction,
      isLoading: true
    }
    chatState.setMessages(prev => [...prev, streamingMessage])

    try {
      if (chatState.selectedModules.length > 0 && chatState.selectedFunction) {
        const module = chatState.selectedModules[0]
        const fn = `${module.name}/${chatState.selectedFunction}`
        await regularCall(fn, finalParams, streamingMessageId, userMessage, module)
      } else {
        chatState.setMessages(prev =>
          prev.map(msg =>
            msg.timestamp === streamingMessageId
              ? { ...msg, content: 'Please select a module and function to process your request.', isLoading: false }
              : msg
          )
        )
      }
    } catch (error) {
      console.error('Error calling function:', error)
      chatState.setMessages(prev =>
        prev.map(msg =>
          msg.timestamp === streamingMessageId
            ? { ...msg, content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, isLoading: false }
            : msg
        )
      )
    } finally {
      setAbortController(null)
      chatState.setIsLoading(false)
    }
  }, [chatState, currentSessionId, inputMode, selectedParam, pastedImages])

  // Helper: call function and display result
  async function regularCall(fn: string, finalParams: Record<string, any>, streamingMessageId: number, userMessage: Message, module: any) {
    const result = await chatState.client!.call(fn, finalParams)

    let responseCid: string | undefined
    let inputCid: string | undefined
    let contentToDisplay: string

    // Handle async generator (SSE stream) - consume and join
    if (result && typeof result[Symbol.asyncIterator] === 'function') {
      let streamed = ''
      for await (const chunk of result) {
        streamed += chunk
        chatState.setMessages(prev =>
          prev.map(msg =>
            msg.timestamp === streamingMessageId
              ? { ...msg, content: streamed, isLoading: true }
              : msg
          )
        )
      }
      contentToDisplay = streamed
    } else if (Array.isArray(result) && result.every((item: any) => typeof item === 'string')) {
      // Stream chunks returned as array - join into readable text
      contentToDisplay = result.join('')
    } else if (typeof result === 'object' && result !== null) {
      responseCid = result.cid
      inputCid = result.inputCid || result.input_cid
      contentToDisplay = JSON.stringify(result, null, 2)
    } else {
      contentToDisplay = typeof result === 'string' ? result : JSON.stringify(result, null, 2)
    }

    // If the response is just the user's input echoed back, show a completion indicator instead
    if (contentToDisplay.trim() === userMessage.content.trim()) {
      contentToDisplay = `Done.`
    }

    chatState.setMessages(prev =>
      prev.map(msg =>
        msg.timestamp === streamingMessageId
          ? { ...msg, content: contentToDisplay, isLoading: false, cid: responseCid, inputCid: inputCid }
          : msg
      )
    )

    updateSessionTitle(userMessage, module)
  }

  // Helper: update session title on first message
  function updateSessionTitle(userMessage: Message, module: any) {
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
  }

  // ── Input area helpers ──

  const fnSchema = combinedSchema?.[chatState.selectedFunction]
  const inputFields = fnSchema?.input || {}
  const paramCount = Object.keys(inputFields).length

  // ── Render ──

  return (
    <div className="flex h-full w-full font-digital" style={{
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-digital), "Press Start 2P", "IBM Plex Mono", monospace',
    }}>
      {/* Sidebar */}
      <ChatSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        sidebarOpen={sidebarOpen}
        onNewChat={createNewSession}
        onSwitchSession={switchSession}
        onDeleteSession={deleteSession}
        onRenameSession={renameSession}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 relative z-[2]" style={{ backgroundColor: 'var(--bg-primary)' }}>
        {/* Header */}
        <ChatHeader
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          allModules={chatState.allModules}
          selectedModules={chatState.selectedModules}
          selectedFunction={chatState.selectedFunction}
          onSelectModule={(m) => chatState.setSelectedModules([m])}
          onClearModule={() => chatState.setSelectedModules([])}
        />

        {/* Messages */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <ChatMessages messages={chatState.messages} isLoading={chatState.isLoading} />
          </div>
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 border-t-4 relative overflow-hidden" style={{
          borderColor: 'var(--border-strong)',
          backgroundColor: 'var(--bg-secondary)',
        }}>
          <div className="max-w-4xl mx-auto">
            {/* Function Controls Bar */}
            {chatState.selectedModules.length > 0 && combinedSchema && Object.keys(combinedSchema).length > 0 && (
              <div className="px-6 pt-5 pb-3 flex items-center gap-4 border-b-2" style={{ borderColor: 'var(--border-color)' }}>
                <select
                  value={chatState.selectedFunction}
                  onChange={(e) => chatState.setSelectedFunction(e.target.value)}
                  className="flex-1 max-w-md px-5 py-3 border-2 text-lg font-digital focus:outline-none transition-all uppercase rounded-lg"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: 'var(--border-input)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="">Select Function</option>
                  {Object.keys(combinedSchema).map(fn => (
                    <option key={fn} value={fn}>{fn}</option>
                  ))}
                </select>

                {chatState.selectedFunction && fnSchema && (
                  <>
                    <div className="flex items-center gap-2">
                      {(['chat', 'params'] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => setInputMode(mode)}
                          className="px-5 py-3 text-lg font-digital font-bold transition-all border-2 uppercase rounded-lg hover:scale-105"
                          style={{
                            backgroundColor: inputMode === mode ? 'var(--accent-primary)' : 'var(--bg-input)',
                            color: inputMode === mode ? 'var(--bg-primary)' : 'var(--text-secondary)',
                            borderColor: inputMode === mode ? 'var(--accent-primary)' : 'var(--border-color)',
                          }}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>

                    {inputMode === 'chat' && (
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-lg font-digital uppercase font-bold" style={{ color: 'var(--text-tertiary)' }}>Param:</span>
                        <select
                          value={selectedParam}
                          onChange={(e) => setSelectedParam(e.target.value)}
                          className="px-4 py-2 text-lg font-digital border-2 rounded-lg"
                          style={{
                            backgroundColor: 'var(--bg-input)',
                            borderColor: 'var(--border-input)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          {paramCount === 0 ? (
                            <option value="">(_empty)</option>
                          ) : (
                            Object.entries(inputFields).map(([name, param]: [string, any]) => (
                              <option key={name} value={name}>
                                {name} ({param.type || 'any'})
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                    )}

                    <div className="text-lg font-digital font-bold" style={{ color: 'var(--text-tertiary)' }}>
                      {paramCount} params
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Input */}
            <div className="p-6">
              {inputMode === 'chat' ? (
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <textarea
                      value={chatState.input}
                      onChange={(e) => chatState.setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSubmit()
                        }
                      }}
                      onPaste={handlePaste}
                      placeholder={`> ${selectedParam || 'message'}_`}
                      rows={4}
                      disabled={chatState.isLoading}
                      className="relative w-full border-4 px-6 py-5 focus:outline-none resize-none text-2xl transition-all font-digital leading-relaxed"
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        borderColor: 'var(--border-strong)',
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-digital), "JetBrains Mono", monospace',
                        letterSpacing: '0.02em',
                        minHeight: '140px',
                      }}
                    />
                    {pastedImages.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-3">
                        {pastedImages.map((img, idx) => (
                          <div key={idx} className="relative group">
                            <img
                              src={img}
                              alt={`Pasted ${idx + 1}`}
                              className="max-w-xs max-h-32 rounded-lg border-2 object-cover"
                              style={{ borderColor: 'var(--border-strong)' }}
                            />
                            <button
                              onClick={() => removePastedImage(idx)}
                              className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{
                                backgroundColor: 'var(--accent-error, #ff4444)',
                                color: '#ffffff',
                              }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <SubmitButton isLoading={chatState.isLoading} disabled={!chatState.input.trim() && pastedImages.length === 0} onSubmit={handleSubmit} onCancel={handleCancel} />
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                    {chatState.selectedFunction && fnSchema &&
                      Object.entries(inputFields).map(([paramName, paramSchema]: [string, any]) => (
                        <div key={paramName} className="space-y-2">
                          <label className="flex items-center gap-3 text-lg font-digital" style={{ color: 'var(--text-secondary)' }}>
                            <span className="font-bold uppercase">{paramName}</span>
                            <span style={{ color: 'var(--text-tertiary)' }}>({paramSchema.type || 'any'})</span>
                          </label>
                          <input
                            type="text"
                            value={chatState.params[paramName] !== undefined ? chatState.params[paramName] : (paramSchema.value || '')}
                            onChange={(e) => chatState.setParams({ ...chatState.params, [paramName]: e.target.value })}
                            placeholder={`${paramName}...`}
                            className="w-full px-5 py-3 text-lg font-digital border-2 focus:outline-none transition-all rounded-lg"
                            style={{
                              backgroundColor: 'var(--bg-input)',
                              borderColor: 'var(--border-input)',
                              color: 'var(--text-primary)',
                            }}
                          />
                        </div>
                      ))
                    }
                  </div>
                  <div className="flex justify-end">
                    <SubmitButton isLoading={chatState.isLoading} disabled={false} onSubmit={handleSubmit} onCancel={handleCancel} />
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

// ── Submit/Stop Button ──

function SubmitButton({ isLoading, disabled, onSubmit, onCancel }: {
  isLoading: boolean
  disabled: boolean
  onSubmit: () => void
  onCancel: () => void
}) {
  if (isLoading) {
    return (
      <button
        onClick={onCancel}
        className="px-8 py-5 transition-all text-xl font-bold border-4 flex items-center gap-4 flex-shrink-0 font-digital uppercase tracking-widest active:translate-x-[2px] active:translate-y-[2px] rounded-xl"
        style={{
          backgroundColor: 'var(--accent-error, #ff4444)',
          color: '#ffffff',
          borderColor: 'var(--accent-error, #ff4444)',
          boxShadow: '6px 6px 0px 0px var(--border-strong)',
        }}
      >
        <span className="w-3 h-3 bg-white rounded-full animate-pulse"></span>
        STOP
      </button>
    )
  }

  return (
    <button
      onClick={onSubmit}
      disabled={disabled}
      className="px-8 py-5 transition-all text-xl font-bold border-4 flex items-center gap-4 flex-shrink-0 font-digital uppercase tracking-widest active:translate-x-[2px] active:translate-y-[2px] rounded-xl hover:scale-105"
      style={{
        backgroundColor: disabled ? 'var(--bg-input)' : 'var(--accent-primary)',
        color: disabled ? 'var(--text-tertiary)' : 'var(--bg-primary)',
        borderColor: disabled ? 'var(--border-color)' : 'var(--accent-primary)',
        boxShadow: disabled ? 'none' : '6px 6px 0px 0px var(--border-strong)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span className="text-2xl">&#9654;</span>
      SEND
    </button>
  )
}
