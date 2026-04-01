"use client";

import { useState } from 'react'
import type { Module } from '../types'

interface ChatHeaderProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
  allModules: Module[]
  selectedModules: Module[]
  selectedFunction: string
  onSelectModule: (module: Module) => void
  onClearModule: () => void
}

export function ChatHeader({
  sidebarOpen,
  onToggleSidebar,
  allModules,
  selectedModules,
  selectedFunction,
  onSelectModule,
  onClearModule,
}: ChatHeaderProps) {
  const [showModuleSelector, setShowModuleSelector] = useState(false)
  const [moduleSearchQuery, setModuleSearchQuery] = useState('')
  const [filterOwner, setFilterOwner] = useState('')
  const [filterVersion, setFilterVersion] = useState('')

  const filteredModules = allModules.filter(m => {
    if (moduleSearchQuery.trim()) {
      const query = moduleSearchQuery.toLowerCase()
      const matches = m.name.toLowerCase().includes(query) ||
        m.cid?.toLowerCase().includes(query) ||
        m.owner?.toLowerCase().includes(query)
      if (!matches) return false
    }
    if (filterOwner && m.owner !== filterOwner) return false
    if (filterVersion && m.version !== filterVersion) return false
    return true
  })

  const handleEnterKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredModules.length > 0) {
        onSelectModule(filteredModules[0])
        setShowModuleSelector(false)
        setModuleSearchQuery(filteredModules[0].name)
      }
    }
  }

  return (
    <div
      className="flex-shrink-0 border-b-4 px-6 py-3 relative z-50"
      style={{
        borderColor: 'var(--border-strong)',
        backgroundColor: 'var(--bg-header)',
      }}
    >
      <div className="flex items-center gap-3">
        {/* Sidebar toggle */}
        <button
          onClick={onToggleSidebar}
          className="p-2 transition-all flex-shrink-0"
          style={{ color: 'var(--text-secondary)' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Module Search */}
        {allModules.length > 0 && (
          <div className="relative flex-1 max-w-xs z-[100]">
            <div className="relative">
              <input
                type="text"
                value={moduleSearchQuery}
                onChange={(e) => setModuleSearchQuery(e.target.value)}
                onFocus={() => setShowModuleSelector(true)}
                onKeyDown={handleEnterKey}
                placeholder={selectedModules[0] ? selectedModules[0].name : "Search modules..."}
                className="w-full px-3 py-1.5 pl-9 border-2 text-sm font-digital focus:outline-none transition-all uppercase"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderColor: 'var(--border-input)',
                  color: 'var(--text-primary)',
                }}
              />
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {selectedModules[0] && (
                <button
                  onClick={() => {
                    onClearModule()
                    setModuleSearchQuery('')
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                  title="Clear selection"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {showModuleSelector && (
              <>
                <div className="fixed inset-0 z-[9998]" onClick={() => {
                  setShowModuleSelector(false)
                  if (!selectedModules[0]) setModuleSearchQuery('')
                }} />
                <div className="absolute top-full left-0 mt-2 w-full max-w-2xl border-4 shadow-2xl z-[9999]" style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-strong)',
                }}>
                  <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
                    {filteredModules.map(m => (
                      <button
                        key={m.key}
                        onClick={() => {
                          onSelectModule(m)
                          setShowModuleSelector(false)
                          setModuleSearchQuery(m.name)
                        }}
                        className="w-full text-left px-4 py-3 transition-all border-b-2 last:border-b-0"
                        style={{
                          borderColor: 'var(--border-color)',
                          backgroundColor: selectedModules[0]?.key === m.key ? 'var(--bg-surface)' : 'transparent',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-bold text-sm font-digital uppercase">{m.name}</span>
                          {m.version && (
                            <span className="text-xs px-2 py-0.5 border-2 font-digital" style={{
                              borderColor: 'var(--border-color)',
                              color: 'var(--text-secondary)',
                            }}>v{m.version}</span>
                          )}
                        </div>
                      </button>
                    ))}
                    {filteredModules.length === 0 && (
                      <div className="px-4 py-8 text-center font-digital text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        No modules found
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Active function badge */}
        <div className="ml-auto flex-shrink-0">
          {selectedModules.length > 0 && selectedFunction && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 border-2"
              style={{
                borderColor: 'var(--accent-primary)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--accent-primary)',
              }}
            >
              <span className="w-2 h-2 animate-pulse" style={{ backgroundColor: 'var(--accent-primary)' }}></span>
              <span className="text-xl font-bold tracking-wider font-digital uppercase">
                {selectedModules[0].name}/{selectedFunction}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
