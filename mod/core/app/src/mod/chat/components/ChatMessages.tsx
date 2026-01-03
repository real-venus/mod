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
        const contentLines = message.content.split('\n').length
        const isLongContent = contentLines > 3 || message.content.length > 200
        
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
              className={`relative max-w-[80%] rounded-2xl p-5 shadow-2xl backdrop-blur-md ${
                message.role === 'user'
                  ? 'bg-gradient-to-br from-orange-500/20 to-orange-600/10 border-2 border-orange-500/50 text-orange-50'
                  : 'bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-2 border-purple-500/50 text-purple-50'
              }`}
              style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace', minHeight: isLongContent ? 'auto' : 'fit-content' }}
            >
              <div className="flex justify-between items-center mb-2">
                <div className="text-sm font-semibold opacity-90">
                  {message.role === 'user' ? '→ You' : `← ${message.module || 'Assistant'} > ${message.function || ''}`}
                </div>
                {hasParams && (
                  <button
                    onClick={() => toggleMessage(index)}
                    className="text-xs text-gray-300 hover:text-white transition-colors ml-2"
                  >
                    {isExpanded ? '▲' : '▼'}
                  </button>
                )}
              </div>
              
              <div className="whitespace-pre-wrap leading-relaxed" style={{ wordBreak: 'break-word' }}>{message.content}</div>
              
              {hasParams && isExpanded && (
                <div className="text-xs opacity-70 mt-2 pt-2 border-t border-white/10">
                  <div className="font-semibold mb-1">Parameters:</div>
                  <pre className="text-xs bg-black/30 p-2 rounded overflow-x-auto">{JSON.stringify(message.params, null, 2)}</pre>
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
