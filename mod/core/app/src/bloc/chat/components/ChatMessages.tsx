'use client'

import { motion } from 'framer-motion'
import { Message } from '../types'

interface ChatMessagesProps {
  messages: Message[]
  messagesEndRef: React.RefObject<HTMLDivElement>
}

export function ChatMessages({ messages, messagesEndRef }: ChatMessagesProps) {
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

      {messages.map((message, index) => (
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
            <div className="text-sm font-semibold mb-2 opacity-80">
              {message.role === 'user' ? 'You' : `${message.module || 'Module'} > ${message.function || 'Function'}`}
            </div>
            <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
            {message.params && (
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
      ))}
      <div ref={messagesEndRef} />
    </div>
  )
}
