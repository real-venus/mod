'use client'

import { motion } from 'framer-motion'
import { Message } from '../types'
import { useState } from 'react'

interface ChatMessagesProps {
  messages: Message[]
  messagesEndRef: React.RefObject<HTMLDivElement>
  compact?: boolean
}

export function ChatMessages({ messages, messagesEndRef, compact = false }: ChatMessagesProps) {
  const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set())

  const toggleMessage = (index: number) => {
    const newExpanded = new Set(expandedMessages)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedMessages(newExpanded)
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {messages.length === 0 && (
          <div className="text-gray-500 text-xs text-center py-4">No messages yet</div>
        )}
        {messages.map((message, index) => (
          <div key={index} className="text-xs">
            <div className="font-bold" style={{ color: message.role === 'user' ? '#22c55e' : '#a78bfa' }}>
              {message.role === 'user' ? '→ You' : '← Assistant'}
            </div>
            <div className="text-gray-300 mt-1 whitespace-pre-wrap">{message.content}</div>
            {message.params && (
              <div className="text-xs opacity-60 mt-1">
                <pre className="text-xs bg-black/30 p-1 rounded">{JSON.stringify(message.params, null, 2)}</pre>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-gray-500">
            <p className="text-lg mb-2">Select module and function to start</p>
            <p className="text-sm">Choose your module and function from the configuration on the right</p>
          </div>
        </div>
      )}

      {messages.map((message, index) => {
        const isExpanded = expandedMessages.has(index)
        const hasParams = message.params && Object.keys(message.params).length > 0
        
        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`relative max-w-[80%] rounded-3xl p-5 shadow-2xl ${
                message.role === 'user'
                  ? 'bg-gradient-to-br from-green-500/30 to-green-600/20 border-2 border-green-500/40 text-green-50'
                  : 'bg-gradient-to-br from-gray-800/60 to-gray-900/40 border-2 border-gray-700/50 text-gray-100'
              }`}
              style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
            >
              <div className="flex justify-between items-center mb-2">
                <div className="text-sm font-semibold opacity-80">
                  {message.role === 'user' ? 'You' : `${message.module || 'Module'} > ${message.function || 'Function'}`}
                </div>
                {hasParams && (
                  <button
                    onClick={() => toggleMessage(index)}
                    className="text-xs text-gray-400 hover:text-white transition-colors ml-2"
                  >
                    {isExpanded ? '▲' : '▼'}
                  </button>
                )}
              </div>
              
              <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
              
              {hasParams && isExpanded && (
                <div className="text-xs opacity-60 mt-2 pt-2 border-t border-white/10">
                  <div className="font-semibold mb-1">Parameters:</div>
                  <pre className="text-xs bg-black/30 p-2 rounded">{JSON.stringify(message.params, null, 2)}</pre>
                </div>
              )}
              
              <div className="text-xs opacity-60 mt-3">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </motion.div>
        )
      })}
      <div ref={messagesEndRef} />
    </div>
  )
}
