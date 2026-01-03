'use client'

import { useState } from 'react'
import { Message } from '../types'

interface ChatOutputPanelProps {
  messages: Message[]
  isLoading: boolean
}

export function ChatOutputPanel({ messages, isLoading }: ChatOutputPanelProps) {
  const [expandedTx, setExpandedTx] = useState<number | null>(null)
  const [collapsedParams, setCollapsedParams] = useState<Set<number>>(new Set())
  const [collapsedResponse, setCollapsedResponse] = useState<Set<number>>(new Set())

  const toggleParams = (idx: number) => {
    const newSet = new Set(collapsedParams)
    if (newSet.has(idx)) {
      newSet.delete(idx)
    } else {
      newSet.add(idx)
    }
    setCollapsedParams(newSet)
  }

  const toggleResponse = (idx: number) => {
    const newSet = new Set(collapsedResponse)
    if (newSet.has(idx)) {
      newSet.delete(idx)
    } else {
      newSet.add(idx)
    }
    setCollapsedResponse(newSet)
  }

  const lastMessage = messages[messages.length - 1]
  const isPending = isLoading && lastMessage?.role === 'user'

  return (
    <div className="border-2 border-gray-700/60 rounded-lg overflow-hidden mt-3 mx-3">
      <div className="p-3 bg-gray-900/80">
        <div className="flex justify-between items-center">
          <h3 className="text-purple-400 text-sm font-bold" style={{ fontFamily: 'Press Start 2P, IBM Plex Mono, monospace', textTransform: 'lowercase' }}>
            📤 outputs
          </h3>
          {isLoading && (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent border-green-400" />
          )}
        </div>

        <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">
          {isPending && (
            <div className="border border-yellow-500/40 rounded-lg p-3 bg-black/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-green-400" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                    {lastMessage.module || 'mod'}
                  </span>
                  <span className="text-xs text-gray-500">/</span>
                  <span className="text-xs font-bold text-cyan-400" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                    {lastMessage.function || 'fn'}
                  </span>
                </div>
                <span className="text-xs text-yellow-400 font-bold">⏳ PENDING</span>
              </div>
              
              {lastMessage.params && Object.keys(lastMessage.params).length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs text-yellow-400 font-bold">params:</div>
                    <button
                      onClick={() => navigator.clipboard.writeText(JSON.stringify(lastMessage.params, null, 2))}
                      className="text-xs text-gray-400 hover:text-white transition-colors"
                    >
                      📋 copy
                    </button>
                  </div>
                  <pre className="text-xs bg-black/50 p-2 rounded border border-gray-700/30 overflow-x-auto">
                    <code className="text-yellow-300">{JSON.stringify(lastMessage.params, null, 2)}</code>
                  </pre>
                </div>
              )}

              <div>
                <div className="text-xs text-blue-400 font-bold mb-1">response:</div>
                <div className="text-xs bg-black/50 p-2 rounded border border-gray-700/30">
                  <span className="text-gray-500">Waiting for response...</span>
                </div>
              </div>
            </div>
          )}

          {messages
            .filter(msg => msg.role === 'assistant')
            .reverse()
            .map((msg, idx) => {
              const actualIdx = messages.filter(m => m.role === 'assistant').length - 1 - idx
              const userMsg = messages.find(m => m.role === 'user' && m.timestamp < msg.timestamp && m.module && m.function)
              const isExpanded = expandedTx === actualIdx
              const isParamsCollapsed = collapsedParams.has(actualIdx)
              const isResponseCollapsed = collapsedResponse.has(actualIdx)

              return (
                <div key={actualIdx} className="border border-gray-700/40 rounded-lg bg-black/30 overflow-hidden">
                  <div 
                    className="p-3 cursor-pointer hover:bg-gray-800/30 transition-colors"
                    onClick={() => setExpandedTx(isExpanded ? null : actualIdx)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-green-400" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                          {userMsg?.module || 'mod'}
                        </span>
                        <span className="text-xs text-gray-500">/</span>
                        <span className="text-xs font-bold text-cyan-400" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                          {userMsg?.function || 'fn'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="text-xs text-green-400">✓</span>
                        <span className="text-purple-400">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-2">
                      {userMsg?.params && Object.keys(userMsg.params).length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div className="text-xs text-yellow-400 font-bold">params:</div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleParams(actualIdx)
                                }}
                                className="text-xs text-gray-400 hover:text-white transition-colors"
                              >
                                {isParamsCollapsed ? '▼' : '▲'}
                              </button>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                navigator.clipboard.writeText(JSON.stringify(userMsg.params, null, 2))
                              }}
                              className="text-xs text-gray-400 hover:text-white transition-colors"
                            >
                              📋 copy
                            </button>
                          </div>
                          {!isParamsCollapsed && (
                            <pre className="text-xs bg-black/50 p-2 rounded border border-gray-700/30 overflow-x-auto">
                              <code className="text-yellow-300">{JSON.stringify(userMsg.params, null, 2)}</code>
                            </pre>
                          )}
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="text-xs text-blue-400 font-bold">response:</div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleResponse(actualIdx)
                              }}
                              className="text-xs text-gray-400 hover:text-white transition-colors"
                            >
                              {isResponseCollapsed ? '▼' : '▲'}
                            </button>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              navigator.clipboard.writeText(msg.content)
                            }}
                            className="text-xs text-gray-400 hover:text-white transition-colors"
                          >
                            📋 copy
                          </button>
                        </div>
                        {!isResponseCollapsed && (
                          <pre className="text-xs bg-black/50 p-2 rounded border border-gray-700/30 overflow-x-auto max-h-48">
                            <code className="text-gray-300">{msg.content}</code>
                          </pre>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

          {!isPending && messages.filter(m => m.role === 'assistant').length === 0 && (
            <div className="text-gray-500 text-xs text-center py-4">No transactions yet</div>
          )}
        </div>
      </div>
    </div>
  )
}
