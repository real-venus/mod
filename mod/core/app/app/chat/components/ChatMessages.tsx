"use client";

import { useEffect, useRef } from 'react'
import { CopyButton } from '@/ui/CopyButton'
import { JsonRenderer } from './JsonRenderer'
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
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="text-center max-w-2xl">
          <div
            className="mb-10 inline-flex items-center justify-center w-36 h-36 border-4 rounded-2xl"
            style={{
              borderColor: 'var(--border-strong)',
              backgroundColor: 'var(--bg-surface)',
            }}
          >
            <span className="text-6xl">{">"}_</span>
          </div>
          <h3
            className="text-3xl font-bold mb-6 uppercase tracking-widest"
            style={{ color: 'var(--text-primary)' }}
          >
            Ready to Chat
          </h3>
          <p
            className="text-xl leading-relaxed mb-4"
            style={{ color: 'var(--text-secondary)' }}
          >
            Type your message below and press SEND to begin.
          </p>
          <p
            className="text-lg leading-relaxed mb-8"
            style={{ color: 'var(--text-tertiary)' }}
          >
            You can also paste images directly into the text area!
          </p>
          <div
            className="mt-8 inline-flex items-center gap-3 px-8 py-4 border-2 text-lg uppercase rounded-lg"
            style={{
              borderColor: 'var(--border-color)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-tertiary)',
            }}
          >
            <span className="text-2xl">⌨️</span> ENTER = SEND
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="flex-1 overflow-y-auto px-8 py-8 space-y-6 scrollbar-thin scrollbar-track-transparent">
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user'

          return (
            <div
              key={i}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-1 duration-200`}
            >
              <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                {/* Sender label */}
                <div
                  className={`text-lg uppercase tracking-widest mb-3 px-1 font-bold ${
                    isUser ? 'text-right' : 'text-left'
                  }`}
                  style={{ color: isUser ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                >
                  {isUser ? '> YOU' : '< MOD'}
                </div>

                {/* Message bubble */}
                <div
                  className="relative px-7 py-6 border-3 group rounded-xl"
                  style={{
                    backgroundColor: isUser ? 'var(--bg-secondary)' : 'var(--bg-surface)',
                    borderColor: isUser ? 'var(--accent-primary)' : 'var(--border-strong)',
                    color: 'var(--text-primary)',
                    boxShadow: isUser
                      ? '0 0 20px color-mix(in srgb, var(--accent-primary) 25%, transparent)'
                      : 'none',
                  }}
                >
                  {/* Copy button */}
                  {!msg.isLoading && isUser && (
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <CopyButton text={msg.content} size="sm" />
                    </div>
                  )}

                  {/* Content */}
                  {msg.isLoading && !msg.content ? (
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-block text-2xl animate-pulse"
                        style={{ color: 'var(--accent-primary)' }}
                      >
                        ...
                      </span>
                    </div>
                  ) : isUser ? (
                    <div className="space-y-4">
                      {/* Display pasted images */}
                      {msg.images && msg.images.length > 0 && (
                        <div className="flex flex-wrap gap-3 mb-4">
                          {msg.images.map((img, idx) => (
                            <img
                              key={idx}
                              src={img}
                              alt={`Image ${idx + 1}`}
                              className="max-w-md max-h-64 rounded-lg border-2 object-cover"
                              style={{ borderColor: 'var(--border-strong)' }}
                            />
                          ))}
                        </div>
                      )}
                      {/* Display text content */}
                      {msg.content && (
                        <pre
                          className="text-xl leading-relaxed whitespace-pre-wrap break-words"
                          style={{
                            fontFamily: 'var(--font-digital), "JetBrains Mono", monospace',
                            maxWidth: '100%',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            color: 'var(--text-primary)',
                          }}
                        >
                          {msg.content}
                        </pre>
                      )}
                    </div>
                  ) : (
                    <div>
                      <JsonRenderer content={msg.content} />
                      {msg.isLoading && (
                        <span
                          className="inline-block ml-1 text-lg"
                          style={{
                            color: 'var(--accent-primary)',
                            animation: 'blink 1s step-end infinite',
                          }}
                        >
                          _
                        </span>
                      )}
                    </div>
                  )}

                  {/* Function info badge - only on assistant messages */}
                  {!isUser && msg.module && msg.function && (
                    <div
                      className="mt-4 pt-4 border-t flex items-center gap-3"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <span
                        className="text-base uppercase tracking-wider px-3 py-1.5 border-2 font-bold"
                        style={{
                          borderColor: 'var(--border-color)',
                          color: 'var(--text-secondary)',
                          backgroundColor: 'var(--bg-primary)',
                        }}
                      >
                        {msg.module}/{msg.function}
                      </span>
                      {msg.cid && (
                        <span
                          className="text-xs truncate max-w-[150px]"
                          style={{ color: 'var(--text-tertiary)' }}
                          title={msg.cid}
                        >
                          {msg.cid.slice(0, 12)}...
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Timestamp */}
                <div
                  className={`text-lg mt-3 px-1 ${isUser ? 'text-right' : 'text-left'}`}
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          )
        })}

        {/* Loading indicator */}
        {isLoading && messages.length > 0 && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex justify-start animate-in fade-in duration-200">
            <div
              className="px-6 py-5 border-2"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-strong)',
              }}
            >
              <div className="flex items-center gap-2.5">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="inline-block w-3 h-3"
                    style={{
                      backgroundColor: 'var(--accent-primary)',
                      animation: `pixelBounce 0.6s ${i * 0.15}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        @keyframes pixelBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  )
}
