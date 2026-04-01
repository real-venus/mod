"use client";

import { useState } from 'react'
import type { ChatSession } from '../ChatInterface'

interface ChatSidebarProps {
  sessions: ChatSession[]
  currentSessionId: string | null
  sidebarOpen: boolean
  onNewChat: () => void
  onSwitchSession: (id: string) => void
  onDeleteSession: (id: string) => void
  onRenameSession: (id: string, title: string) => void
}

export function ChatSidebar({
  sessions,
  currentSessionId,
  sidebarOpen,
  onNewChat,
  onSwitchSession,
  onDeleteSession,
  onRenameSession,
}: ChatSidebarProps) {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  return (
    <div
      className={`flex-shrink-0 border-r-4 transition-all duration-300 relative z-[2] ${
        sidebarOpen ? 'w-72' : 'w-0'
      } overflow-hidden flex flex-col`}
      style={{
        borderColor: 'var(--border-strong)',
        backgroundColor: 'var(--bg-sidebar)',
      }}
    >
      {/* Header */}
      <div className="p-4 border-b-4 flex-shrink-0" style={{ borderColor: 'var(--border-strong)' }}>
        <button
          onClick={onNewChat}
          className="w-full px-4 py-3 font-bold text-sm transition-all flex items-center justify-center gap-2 border-4 uppercase tracking-widest active:translate-x-[2px] active:translate-y-[2px]"
          style={{
            fontFamily: 'var(--font-digital), "Press Start 2P", monospace',
            backgroundColor: 'var(--accent-primary)',
            color: 'var(--bg-primary)',
            borderColor: 'var(--accent-primary)',
            boxShadow: '4px 4px 0px 0px var(--border-strong)',
          }}
        >
          <span className="text-lg">+</span>
          <span>NEW CHAT</span>
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent">
        <div className="p-3 space-y-2">
          {sessions.map(session => (
            <div
              key={session.id}
              className="group relative px-3 py-2.5 cursor-pointer transition-all duration-100 border-2"
              style={{
                borderColor: currentSessionId === session.id ? 'var(--accent-primary)' : 'transparent',
                backgroundColor: currentSessionId === session.id ? 'var(--bg-secondary)' : 'transparent',
                boxShadow: currentSessionId === session.id ? '0 0 12px color-mix(in srgb, var(--accent-primary) 20%, transparent)' : 'none',
              }}
              onMouseEnter={e => {
                if (currentSessionId !== session.id) {
                  e.currentTarget.style.borderColor = 'var(--border-color)'
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface)'
                }
              }}
              onMouseLeave={e => {
                if (currentSessionId !== session.id) {
                  e.currentTarget.style.borderColor = 'transparent'
                  e.currentTarget.style.backgroundColor = 'transparent'
                }
              }}
              onClick={() => onSwitchSession(session.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {editingSessionId === session.id ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onRenameSession(session.id, editingTitle)
                          setEditingSessionId(null)
                        } else if (e.key === 'Escape') {
                          setEditingSessionId(null)
                        }
                      }}
                      onBlur={() => {
                        onRenameSession(session.id, editingTitle)
                        setEditingSessionId(null)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      className="w-full text-xs font-bold px-2 py-1 border-2 focus:outline-none font-digital"
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--accent-primary)',
                        borderColor: 'var(--accent-primary)',
                      }}
                    />
                  ) : (
                    <div
                      className="text-base font-bold truncate mb-1.5 font-digital"
                      style={{
                        color: currentSessionId === session.id ? 'var(--accent-primary)' : 'var(--text-primary)',
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        setEditingSessionId(session.id)
                        setEditingTitle(session.title)
                      }}
                    >
                      {session.title}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm font-digital" style={{ color: 'var(--text-tertiary)' }}>
                    <span>{session.messages.length} msg</span>
                    <span style={{ color: 'var(--border-color)' }}>|</span>
                    <span>{new Date(session.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingSessionId(session.id)
                      setEditingTitle(session.title)
                    }}
                    className="transition-all p-1.5"
                    style={{ color: 'var(--text-secondary)' }}
                    title="Rename"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteSession(session.id)
                    }}
                    className="transition-all p-1.5"
                    style={{ color: 'var(--accent-error, #ff4444)' }}
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t-4 flex-shrink-0" style={{ borderColor: 'var(--border-strong)' }}>
        <div className="flex items-center justify-between text-sm font-digital" style={{ color: 'var(--text-tertiary)' }}>
          <span>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
          <span style={{ color: 'var(--accent-success, var(--accent-primary))' }}>&#9632;</span>
        </div>
      </div>
    </div>
  )
}
