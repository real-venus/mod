"use client"

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { userContext } from '@/context'
import { text2color, shorten } from '@/utils'

interface AppStatus {
  port: number
  owner: string
  path: string
  running: boolean
  url: string
}

const FONT = "var(--font-digital), monospace"

export function ModsTab({ show }: { show: boolean }) {
  const { client, user } = userContext()
  const [apps, setApps] = useState<Record<string, AppStatus>>({})
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [newAppName, setNewAppName] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  const fetchApps = useCallback(async () => {
    if (!client) return
    try {
      const result = await client.call('app_status')
      if (result && typeof result === 'object' && !result.error) {
        setApps(result)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [client])

  useEffect(() => {
    if (!show) return
    fetchApps()
    const interval = setInterval(fetchApps, 5000)
    return () => clearInterval(interval)
  }, [fetchApps, show])

  const isOwner = (app: AppStatus) => {
    return user?.key && app.owner && user.key.toLowerCase() === app.owner.toLowerCase()
  }

  const handleAction = async (action: string, name: string, endpoint: string) => {
    if (!client) return
    setActionLoading(name)
    setMessage(null)
    try {
      const result = await client.call(endpoint, { name })
      if (result?.error) {
        setMessage({ text: result.error, type: 'error' })
      } else {
        setMessage({ text: `${name} ${action}`, type: 'success' })
        await fetchApps()
      }
    } catch (e: any) {
      setMessage({ text: e?.message || `Failed to ${action}`, type: 'error' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleAdd = async () => {
    if (!client || !newAppName.trim()) return
    setActionLoading('__add')
    setMessage(null)
    try {
      const result = await client.call('new_app', { name: newAppName.trim() })
      if (result?.error) {
        setMessage({ text: result.error, type: 'error' })
      } else {
        setMessage({ text: `${newAppName} created on port ${result.port}`, type: 'success' })
        setNewAppName('')
        setShowAddForm(false)
        await fetchApps()
      }
    } catch (e: any) {
      setMessage({ text: e?.message || 'Failed to create', type: 'error' })
    } finally {
      setActionLoading(null)
    }
  }

  const entries = Object.entries(apps)
  const myApps = entries.filter(([, app]) => isOwner(app))
  const otherApps = entries.filter(([, app]) => !isOwner(app))

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          className="mt-3 pt-3 overflow-hidden"
          style={{ borderTop: '1px solid var(--border-color)' }}
        >
          <div className="space-y-1.5">
            {/* Header */}
            <div className="flex items-center justify-between px-1 mb-3">
              <span className="text-sm uppercase tracking-widest font-bold" style={{
                fontFamily: FONT,
                color: 'var(--text-primary)',
                textShadow: 'var(--effect-text-shadow, 0) 0px 10px var(--text-primary)',
                letterSpacing: '0.2em'
              }}>
                MODULE APPS
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="p-1 transition-all"
                  title="Add module app"
                >
                  <svg className={`w-3.5 h-3.5 ${showAddForm ? 'text-teal-400' : ''}`} style={!showAddForm ? { color: 'var(--text-tertiary)' } : {}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <button
                  onClick={fetchApps}
                  disabled={loading}
                  className="p-1 transition-all disabled:opacity-50"
                  title="Refresh"
                >
                  <ArrowPathIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} style={{ color: 'var(--text-tertiary)' }} />
                </button>
              </div>
            </div>

            {/* Add Form */}
            <AnimatePresence>
              {showAddForm && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="flex gap-1.5 mb-2">
                    <input
                      type="text"
                      value={newAppName}
                      onChange={(e) => setNewAppName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                      placeholder="Module name..."
                      className="flex-1 px-3 py-2 text-xs font-mono placeholder-neutral-600 focus:outline-none focus:border-teal-500/50 transition-colors"
                      style={{ borderRadius: '0px', fontFamily: FONT, backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                    />
                    <button
                      onClick={handleAdd}
                      disabled={actionLoading === '__add' || !newAppName.trim()}
                      className="px-3 py-2 bg-teal-500/15 border border-teal-500/30 text-teal-400 text-xs font-bold hover:bg-teal-500/25 transition-all disabled:opacity-50"
                      style={{ borderRadius: '0px', fontFamily: FONT }}
                    >
                      {actionLoading === '__add' ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : 'ADD'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Status Message */}
            <AnimatePresence>
              {message && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div
                    className="text-[10px] px-2 py-1.5 font-mono mb-2"
                    style={{
                      borderRadius: '0px',
                      border: `1px solid ${message.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                      color: message.type === 'error' ? '#ef4444' : '#10b981',
                      background: message.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                      fontFamily: FONT,
                    }}
                  >
                    {message.text}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {loading ? (
              <div className="flex items-center justify-center py-6 gap-2">
                <ArrowPathIcon className="w-4 h-4 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
                <span className="text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: FONT }}>Loading apps...</span>
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-6 text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: FONT }}>
                No module apps running
              </div>
            ) : (
              <>
                {/* My Apps */}
                {myApps.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-widest px-1" style={{ color: 'var(--text-tertiary)', fontFamily: FONT }}>
                      YOUR APPS
                    </span>
                    {myApps.map(([name, app]) => (
                      <AppRow
                        key={name}
                        name={name}
                        app={app}
                        owned
                        isLoading={actionLoading === name}
                        onStart={() => handleAction('started', name, 'serve_app')}
                        onStop={() => handleAction('stopped', name, 'kill_app')}
                        onRemove={() => handleAction('removed', name, 'remove_app')}
                      />
                    ))}
                  </div>
                )}

                {/* Other Apps */}
                {otherApps.length > 0 && (
                  <div className="space-y-1 mt-2">
                    <span className="text-[10px] uppercase tracking-widest px-1" style={{ color: 'var(--text-tertiary)', fontFamily: FONT }}>
                      OTHER APPS
                    </span>
                    {otherApps.map(([name, app]) => (
                      <AppRow
                        key={name}
                        name={name}
                        app={app}
                        owned={false}
                        isLoading={actionLoading === name}
                        onStart={() => {}}
                        onStop={() => {}}
                        onRemove={() => {}}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function AppRow({
  name, app, owned, isLoading, onStart, onStop, onRemove,
}: {
  name: string
  app: AppStatus
  owned: boolean
  isLoading: boolean
  onStart: () => void
  onStop: () => void
  onRemove: () => void
}) {
  const color = text2color(name)

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 border-2 transition-all"
      style={{
        borderColor: 'var(--border-color)',
        background: 'var(--bg-input)',
        fontFamily: FONT,
      }}
    >
      {/* Status dot */}
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{
          background: app.running ? '#10b981' : '#6b7280',
          boxShadow: app.running ? '0 0 6px #10b981' : 'none',
        }}
      />

      {/* Name + port */}
      <div className="flex-1 min-w-0">
        <span className="font-bold uppercase tracking-wider text-xs" style={{ color }}>
          {name}
        </span>
        {app.port > 0 && (
          <span className="ml-1 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
            :{app.port}
          </span>
        )}
      </div>

      {/* Status */}
      <span
        className="text-[10px] font-bold uppercase tracking-wider shrink-0"
        style={{ color: app.running ? '#10b981' : '#6b7280' }}
      >
        {app.running ? 'ON' : 'OFF'}
      </span>

      {/* Actions */}
      {owned && (
        <div className="flex items-center gap-1 shrink-0">
          {app.running ? (
            <button
              onClick={onStop}
              disabled={isLoading}
              className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-all border"
              style={{
                borderColor: '#ef4444',
                color: '#ef4444',
                background: 'transparent',
                fontFamily: FONT,
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              {isLoading ? '...' : 'STOP'}
            </button>
          ) : (
            <button
              onClick={onStart}
              disabled={isLoading}
              className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-all border"
              style={{
                borderColor: '#10b981',
                color: '#10b981',
                background: 'transparent',
                fontFamily: FONT,
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              {isLoading ? '...' : 'START'}
            </button>
          )}
          <button
            onClick={() => {
              if (confirm(`Remove ${name}?`)) onRemove()
            }}
            disabled={isLoading}
            className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-all border"
            style={{
              borderColor: '#6b7280',
              color: '#6b7280',
              background: 'transparent',
              fontFamily: FONT,
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            RM
          </button>
        </div>
      )}
    </div>
  )
}
