'use client'

import { useEffect, useRef } from 'react'
import { CopyButton } from '@/mod/ui/CopyButton'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface ChatMessagesProps {
  messages: Message[]
  isLoading: boolean
}

export function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  return (
    <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-black/60 border-2 border-orange-500/40 rounded-lg">
      {messages.map((msg, idx) => (
        <div
          key={idx}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] p-6 ${
              msg.role === 'user'
                ? 'bg-orange-500/20 border-2 border-orange-500/40 text-orange-300 rounded-3xl'
                : 'bg-cyan-500/20 border-2 border-cyan-500/40 text-cyan-300 rounded-3xl'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                <div className="text-sm opacity-60" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                  {msg.role === 'user' ? 'you' : 'assistant'} • {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
                <div
                  className="whitespace-pre-wrap break-words text-base"
                  style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '1.1rem', lineHeight: '1.6' }}
                >
                  {msg.content}
                </div>
              </div>
              <CopyButton content={msg.content} />
            </div>
          </div>
        </div>
      ))}
      {isLoading && (
        <div className="flex justify-start">
          <div className="bg-cyan-500/20 border-2 border-cyan-500/40 text-cyan-300 rounded-3xl p-6">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-cyan-400 border-t-transparent" />
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '1.1rem' }}>thinking...</span>
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  )
}
