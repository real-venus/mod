"use client";

import { useEffect, useRef } from 'react'
import { CopyButton } from '@/ui/CopyButton'
import type { Message } from '../types'

interface ChatMessagesProps {
  messages: Message[]
  isLoading: boolean
}

export function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-green-600/20 to-emerald-600/20 border border-green-500/30">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-neutral-300 mb-2" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
            Start a conversation
          </h3>
          <p className="text-sm text-neutral-500 font-mono">
            Select a module and function, then type your message below to get started.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-4 p-6 scrollbar-thin scrollbar-thumb-green-900/30 scrollbar-track-transparent hover:scrollbar-thumb-green-800/50">
      {messages.map((msg, idx) => (
        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
          <div className={`max-w-[85%] ${
            msg.role === 'user'
              ? 'bg-gradient-to-br from-green-600/20 to-emerald-600/20 border border-green-500/30'
              : 'bg-neutral-900/60 border border-neutral-700/50'
          } rounded-2xl p-5 shadow-xl backdrop-blur-sm`}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                  msg.role === 'user'
                    ? 'bg-green-600/30 border border-green-500/50'
                    : 'bg-neutral-800/50 border border-neutral-700/50'
                }`}>
                  {msg.role === 'user' ? (
                    <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                  )}
                </div>
                <div className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider">
                  {msg.role} · {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              </div>
              <CopyButton content={msg.content} />
            </div>
            <div className={`whitespace-pre-wrap break-words text-sm font-mono leading-relaxed ${
              msg.role === 'user' ? 'text-neutral-200' : 'text-neutral-300'
            }`}>
              {msg.content}
            </div>
            {msg.module && msg.function && (
              <div className="mt-3 pt-3 border-t border-neutral-700/30 text-[10px] text-neutral-600 font-mono flex items-center gap-2">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                {msg.module} / {msg.function}
              </div>
            )}
          </div>
        </div>
      ))}
      {isLoading && (
        <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-neutral-900/60 border border-neutral-700/50 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-600 border-t-transparent" />
                <div className="absolute inset-0 animate-ping rounded-full h-4 w-4 border border-green-600/30" />
              </div>
              <span className="text-sm font-mono text-neutral-400">Generating response...</span>
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  )
}
