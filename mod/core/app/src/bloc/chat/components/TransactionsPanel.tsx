'use client'

import { useState } from 'react'
import { Message } from '../types'

interface TransactionsPanelProps {
  messages: Message[]
}

export function TransactionsPanel({ messages }: TransactionsPanelProps) {
  const [expandedTx, setExpandedTx] = useState<Set<number>>(new Set())

  const toggleTx = (idx: number) => {
    const newExpanded = new Set(expandedTx)
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx)
    } else {
      newExpanded.add(idx)
    }
    setExpandedTx(newExpanded)
  }

  const getColorForIndex = (idx: number) => {
    const colors = [
      { bg: 'from-purple-500/20 to-purple-600/10', border: 'border-purple-500/40', text: 'text-purple-400' },
      { bg: 'from-blue-500/20 to-blue-600/10', border: 'border-blue-500/40', text: 'text-blue-400' },
      { bg: 'from-green-500/20 to-green-600/10', border: 'border-green-500/40', text: 'text-green-400' },
      { bg: 'from-pink-500/20 to-pink-600/10', border: 'border-pink-500/40', text: 'text-pink-400' },
      { bg: 'from-cyan-500/20 to-cyan-600/10', border: 'border-cyan-500/40', text: 'text-cyan-400' },
      { bg: 'from-orange-500/20 to-orange-600/10', border: 'border-orange-500/40', text: 'text-orange-400' },
    ]
    return colors[idx % colors.length]
  }

  return (
    <div className="space-y-3">
      {messages
        .filter(msg => msg.role === 'assistant')
        .reverse()
        .map((msg, idx) => {
          const actualIdx = messages.filter(m => m.role === 'assistant').length - 1 - idx
          const userMsg = messages.slice(0, messages.indexOf(msg)).reverse().find(m => m.role === 'user' && m.module && m.function)
          const isExpanded = expandedTx.has(actualIdx)
          const colors = getColorForIndex(actualIdx)
        
        return (
          <div key={actualIdx} className={`border-2 rounded-2xl overflow-hidden bg-gradient-to-br ${colors.bg} ${colors.border} shadow-xl transition-all hover:shadow-2xl`}>
            <div 
              className="p-4 cursor-pointer hover:bg-black/20 transition-colors"
              onClick={() => toggleTx(actualIdx)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`text-2xl ${colors.text}`}>🔮</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${colors.text}`} style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                        {userMsg?.module || 'mod'}
                      </span>
                      <span className="text-xs text-gray-500">/</span>
                      <span className={`text-sm font-bold ${colors.text}`} style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                        {userMsg?.function || 'fn'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(msg.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-green-400 font-bold">✓</span>
                  <span className={`${colors.text} text-lg`}>{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>
            </div>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-3 border-t border-white/10">
                {userMsg?.params && Object.keys(userMsg.params).length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-bold text-yellow-400">📥 Input</div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigator.clipboard.writeText(JSON.stringify(userMsg.params, null, 2))
                        }}
                        className="text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded bg-black/30"
                      >
                        📋 copy
                      </button>
                    </div>
                    <pre className="text-xs bg-black/50 p-3 rounded-lg border border-gray-700/30 overflow-x-auto">
                      <code className="text-yellow-300">{JSON.stringify(userMsg.params, null, 2)}</code>
                    </pre>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-bold text-blue-400">📤 Response</div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigator.clipboard.writeText(msg.content)
                      }}
                      className="text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded bg-black/30"
                    >
                      📋 copy
                    </button>
                  </div>
                  <pre className="text-xs bg-black/50 p-3 rounded-lg border border-gray-700/30 overflow-x-auto max-h-64">
                    <code className="text-gray-300">{msg.content}</code>
                  </pre>
                </div>

                <div className="text-xs text-gray-500 pt-2 border-t border-white/10">
                  ⏱️ {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              </div>
            )}
          </div>
        )
      })}
      {messages.filter(m => m.role === 'assistant').length === 0 && (
        <div className="text-gray-500 text-sm text-center py-8 border-2 border-dashed border-gray-700/40 rounded-2xl">No transactions yet</div>
      )}
    </div>
  )
}
