"use client";

import { useEffect, useRef } from 'react'
import { CopyButton } from '@/ui/CopyButton'

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
    <div className="flex-1 overflow-y-auto space-y-3 p-3 bg-neutral-900/50">
      {messages.map((msg, idx) => (
        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[80%] p-4 rounded-lg ${
            msg.role === 'user'
              ? 'bg-neutral-800 text-neutral-200'
              : 'bg-neutral-850 border border-neutral-700 text-neutral-300'
          }`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 space-y-1">
                <div className="text-[10px] text-neutral-500 font-mono">
                  {msg.role} · {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
                <div className="whitespace-pre-wrap break-words text-sm font-mono leading-relaxed">
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
          <div className="bg-neutral-850 border border-neutral-700 text-neutral-400 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-3 w-3 border border-neutral-500 border-t-transparent" />
              <span className="text-sm font-mono">...</span>
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  )
}
