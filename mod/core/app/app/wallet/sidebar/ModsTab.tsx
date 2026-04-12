"use client"

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { userContext } from '@/context'
import { text2color, shorten } from '@/utils'
import { useRouter } from 'next/navigation'

interface AppStatus {
  port: number
  owner: string
  path: string
  running: boolean
  url: string
}

interface ModEntry {
  name: string
  key: string
  url?: string | { api?: string; app?: string }
  fns?: string[]
}

const FONT = "var(--font-digital), monospace"

export function ModsTab({ show }: { show: boolean }) {
  const { client, user } = userContext()
  const router = useRouter()
  const [apps, setApps] = useState<Record<string, AppStatus>>({})
  const [ownedMods, setOwnedMods] = useState<ModEntry[]>([])
  const [apiServers, setApiServers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [newAppName, setNewAppName] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [filter, setFilter] = useState<'mine' | 'all'>('mine')

  const fetchApps = useCallback(async () => {
    if (!client) return
    try {
      const [statusResult, namespaceResult] = await Promise.all([
        client.call('app_status'),
        client.call('namespace'),
      ])
      if (statusResult && typeof statusResult === 'object' && !statusResult.error) {
        setApps(statusResult)
      }
      if (namespaceResult && typeof namespaceResult === 'object' && !namespaceResult.error) {
        setApiServers(namespaceResult)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchOwnedMods = useCallback(async () => {
    if (!client || !user?.key) return
    try {
      const result = await client.call('mods', { key: user.key })
      if (result && Array.isArray(result)) {
        setOwnedMods(result)
      }
    } catch {
      // ignore
    }
  }, [client, user?.key])

  useEffect(() => {
    if (!show) return
    fetchApps()
    fetchOwnedMods()
    const interval = setInterval(fetchApps, 5000)
    return () => clearInterval(interval)
  }, [fetchApps, fetchOwnedMods, show])

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

  // Build unified list: installed apps + owned mods that aren't in apps
  const appEntries = Object.entries(apps)
  const myApps = appEntries.filter(([, app]) => isOwner(app))
  const otherApps = appEntries.filter(([, app]) => !isOwner(app))

  // Owned mods not already in the app list
  const appNames = new Set(appEntries.map(([name]) => name))
  const ownedNotInstalled = ownedMods.filter(m => !appNames.has(m.name))

  // API servers that aren't 'api' (the main portal API)
  const apiServerEntries = Object.entries(apiServers).filter(([name]) => name !== 'api')

  // Check if a mod is being served as an API server
  const getApiServer = (name: string) => apiServers[name] || null

  const filtered = filter === 'mine'
    ? { apps: myApps, others: [], mods: ownedNotInstalled }
    : { apps: appEntries, others: [], mods: [] }

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
                MODULES
              </span>
              <div className="flex items-center gap-1">
                {/* Filter toggle */}
                <button
                  onClick={() => setFilter(f => f === 'mine' ? 'all' : 'mine')}
                  className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-all border"
                  style={{
                    fontFamily: FONT,
                    borderColor: filter === 'mine' ? 'rgba(16,185,129,0.4)' : 'var(--border-color)',
                    color: filter === 'mine' ? '#10b981' : 'var(--text-tertiary)',
                    background: filter === 'mine' ? 'rgba(16,185,129,0.08)' : 'transparent',
                  }}
                >
                  {filter === 'mine' ? 'MINE' : 'ALL'}
                </button>
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
                  onClick={() => { fetchApps(); fetchOwnedMods() }}
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
                <span className="text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: FONT }}>Loading...</span>
              </div>
            ) : filtered.apps.length === 0 && filtered.mods.length === 0 && apiServerEntries.length === 0 ? (
              <div className="text-center py-6 text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: FONT }}>
                {filter === 'mine' ? 'No modules owned' : 'No module apps found'}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Installed Apps */}
                {filtered.apps.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-widest px-1" style={{ color: 'var(--text-tertiary)', fontFamily: FONT }}>
                      {filter === 'mine' ? 'YOUR APPS' : 'ALL APPS'}
                    </span>
                    {filtered.apps.map(([name, app]) => (
                      <AppRow
                        key={name}
                        name={name}
                        app={app}
                        owned={isOwner(app)}
                        apiServer={getApiServer(name)}
                        isLoading={actionLoading === name}
                        onStart={() => handleAction('started', name, 'serve_app')}
                        onStop={() => handleAction('stopped', name, 'kill_app')}
                        onRemove={() => handleAction('removed', name, 'remove_app')}
                        onNavigate={() => router.push(`/${name}`)}
                      />
                    ))}
                  </div>
                )}

                {/* Owned Mods (not installed as apps) */}
                {filter === 'mine' && filtered.mods.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-widest px-1" style={{ color: 'var(--text-tertiary)', fontFamily: FONT }}>
                      YOUR MODULES
                    </span>
                    {filtered.mods.map((mod) => (
                      <ModRow
                        key={mod.name}
                        mod={mod}
                        apiServer={getApiServer(mod.name)}
                        onNavigate={() => router.push(`/${mod.name}`)}
                      />
                    ))}
                  </div>
                )}

                {/* Active API Servers (not already shown above) */}
                {apiServerEntries.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-widest px-1" style={{ color: 'var(--text-tertiary)', fontFamily: FONT }}>
                      API SERVERS
                    </span>
                    {apiServerEntries.map(([name, addr]) => {
                      // Skip if already shown in apps
                      if (appNames.has(name)) return null
                      return (
                        <div
                          key={name}
                          className="flex items-center gap-3 px-3 py-2 border transition-all cursor-pointer hover:border-emerald-500/30"
                          style={{ borderColor: 'var(--border-color)', background: 'var(--bg-input)', fontFamily: FONT }}
                          onClick={() => router.push(`/${name}`)}
                        >
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
                          <span className="font-bold uppercase tracking-wider text-xs flex-1" style={{ color: text2color(name) }}>{name}</span>
                          <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{addr}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function AppRow({
  name, app, owned, apiServer, isLoading, onStart, onStop, onRemove, onNavigate,
}: {
  name: string
  app: AppStatus
  owned: boolean
  apiServer: string | null
  isLoading: boolean
  onStart: () => void
  onStop: () => void
  onRemove: () => void
  onNavigate: () => void
}) {
  const color = text2color(name)

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 border-2 transition-all cursor-pointer hover:border-emerald-500/20"
      style={{
        borderColor: 'var(--border-color)',
        background: 'var(--bg-input)',
        fontFamily: FONT,
      }}
      onClick={onNavigate}
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
        {apiServer && (
          <span className="ml-1 text-[10px]" style={{ color: 'rgba(59,130,246,0.7)' }}>
            api
          </span>
        )}
      </div>

      {/* Owner (when showing all) */}
      {!owned && app.owner && (
        <span className="text-[9px] shrink-0" style={{ color: 'var(--text-tertiary)' }}>
          {shorten(app.owner)}
        </span>
      )}

      {/* Status */}
      <span
        className="text-[10px] font-bold uppercase tracking-wider shrink-0"
        style={{ color: app.running ? '#10b981' : '#6b7280' }}
      >
        {app.running ? 'ON' : 'OFF'}
      </span>

      {/* Actions */}
      {owned && (
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
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

function ModRow({
  mod, apiServer, onNavigate,
}: {
  mod: ModEntry
  apiServer: string | null
  onNavigate: () => void
}) {
  const color = text2color(mod.name)
  const isServed = !!apiServer

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 border transition-all cursor-pointer hover:border-emerald-500/20"
      style={{
        borderColor: 'var(--border-color)',
        background: 'var(--bg-input)',
        fontFamily: FONT,
      }}
      onClick={onNavigate}
    >
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{
          background: isServed ? '#3b82f6' : '#6b7280',
          boxShadow: isServed ? '0 0 6px #3b82f6' : 'none',
          opacity: isServed ? 1 : 0.4,
        }}
      />
      <span className="font-bold uppercase tracking-wider text-xs flex-1" style={{ color }}>
        {mod.name}
      </span>
      {isServed && (
        <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
          {apiServer}
        </span>
      )}
      {mod.fns && (
        <span className="text-[9px]" style={{ color: 'var(--text-tertiary)' }}>
          {mod.fns.length} fns
        </span>
      )}
    </div>
  )
}
