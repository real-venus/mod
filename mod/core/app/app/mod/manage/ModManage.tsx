"use client"

import { useState, useEffect, useCallback } from 'react'
import { userContext } from '@/context'
import { ModuleType } from '@/types'
import { text2color, shorten } from '@/utils'

interface AppStatus {
  port: number
  owner: string
  path: string
  running: boolean
  url: string
}

interface LogsData {
  [key: string]: string
}

interface ModManageProps {
  mod?: ModuleType
  moduleColor?: string
}

const FONT = "var(--font-digital), monospace"

export default function ModManage({ mod, moduleColor }: ModManageProps) {
  const { client, user } = userContext()
  const [apps, setApps] = useState<Record<string, AppStatus>>({})
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

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
    fetchApps()
    const interval = setInterval(fetchApps, 5000)
    return () => clearInterval(interval)
  }, [fetchApps])

  const isOwner = (app: AppStatus) => {
    return user?.key && app.owner && user.key.toLowerCase() === app.owner.toLowerCase()
  }

  const handleStart = async (name: string) => {
    if (!client) return
    setActionLoading(name)
    setMessage(null)
    try {
      const result = await client.call('serve_app', { name })
      if (result?.error) {
        setMessage({ text: result.error, type: 'error' })
      } else {
        setMessage({ text: `${name} started`, type: 'success' })
        await fetchApps()
      }
    } catch (e: any) {
      setMessage({ text: e?.message || 'Failed to start', type: 'error' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleStop = async (name: string) => {
    if (!client) return
    setActionLoading(name)
    setMessage(null)
    try {
      const result = await client.call('kill_app', { name })
      if (result?.error) {
        setMessage({ text: result.error, type: 'error' })
      } else {
        setMessage({ text: `${name} stopped`, type: 'success' })
        await fetchApps()
      }
    } catch (e: any) {
      setMessage({ text: e?.message || 'Failed to stop', type: 'error' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleRemove = async (name: string) => {
    if (!client) return
    setActionLoading(name)
    setMessage(null)
    try {
      const result = await client.call('remove_app', { name })
      if (result?.error) {
        setMessage({ text: result.error, type: 'error' })
      } else {
        setMessage({ text: `${name} removed`, type: 'success' })
        await fetchApps()
      }
    } catch (e: any) {
      setMessage({ text: e?.message || 'Failed to remove', type: 'error' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleAdd = async () => {
    if (!client) return
    const name = prompt('Module app name:')
    if (!name) return
    setActionLoading('__add')
    setMessage(null)
    try {
      const result = await client.call('new_app', { name })
      if (result?.error) {
        setMessage({ text: result.error, type: 'error' })
      } else {
        setMessage({ text: `${name} created and serving on port ${result.port}`, type: 'success' })
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="animate-pulse text-lg font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)', fontFamily: FONT }}>
          LOADING APPS...
        </span>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-4" style={{ fontFamily: FONT }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
          Module Apps
        </h2>
        <button
          onClick={handleAdd}
          disabled={actionLoading === '__add'}
          className="px-4 py-2 font-bold uppercase tracking-wider text-sm transition-all"
          style={{
            border: '2px solid var(--accent-primary)',
            color: 'var(--accent-primary)',
            background: 'transparent',
            fontFamily: FONT,
            opacity: actionLoading === '__add' ? 0.5 : 1,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--bg-primary)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--accent-primary)' }}
        >
          {actionLoading === '__add' ? 'CREATING...' : '+ ADD APP'}
        </button>
      </div>

      {/* Status message */}
      {message && (
        <div
          className="mb-4 px-4 py-2 border-2"
          style={{
            borderColor: message.type === 'error' ? '#ef4444' : '#10b981',
            color: message.type === 'error' ? '#ef4444' : '#10b981',
            background: message.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
          }}
        >
          {message.text}
        </div>
      )}

      {/* My apps */}
      {myApps.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>
            Your Apps
          </h3>
          <div className="space-y-2">
            {myApps.map(([name, app]) => (
              <AppRow
                key={name}
                name={name}
                app={app}
                owned
                actionLoading={actionLoading}
                onStart={handleStart}
                onStop={handleStop}
                onRemove={handleRemove}
                client={client}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other apps */}
      {otherApps.length > 0 && (
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>
            Other Apps
          </h3>
          <div className="space-y-2">
            {otherApps.map(([name, app]) => (
              <AppRow
                key={name}
                name={name}
                app={app}
                owned={false}
                actionLoading={actionLoading}
                onStart={handleStart}
                onStop={handleStop}
                onRemove={handleRemove}
                client={client}
              />
            ))}
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <div className="text-center py-16">
          <p className="text-lg font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
            No module apps installed
          </p>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Click + ADD APP to create one
          </p>
        </div>
      )}
    </div>
  )
}

function AppRow({
  name, app, owned, actionLoading, onStart, onStop, onRemove, client,
}: {
  name: string
  app: AppStatus
  owned: boolean
  actionLoading: string | null
  onStart: (name: string) => void
  onStop: (name: string) => void
  onRemove: (name: string) => void
  client: any
}) {
  const color = text2color(name)
  const isLoading = actionLoading === name
  const [showLogs, setShowLogs] = useState(false)
  const [logs, setLogs] = useState<LogsData | null>(null)
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    if (!client) return
    setLogsLoading(true)
    setLogsError(null)
    try {
      const result = await client.call('app_logs', { name, lines: 200 })
      if (result?.error) {
        setLogsError(result.error)
        setLogs(null)
      } else {
        setLogs(result)
      }
    } catch (e: any) {
      setLogsError(e?.message || 'Failed to fetch logs')
    } finally {
      setLogsLoading(false)
    }
  }, [client, name])

  useEffect(() => {
    if (!showLogs) return
    fetchLogs()
    const interval = setInterval(fetchLogs, 5000)
    return () => clearInterval(interval)
  }, [showLogs, fetchLogs])

  return (
    <div
      className="border-2 transition-all"
      style={{
        borderColor: 'var(--border-strong)',
        background: 'var(--bg-secondary)',
        fontFamily: "var(--font-digital), monospace",
      }}
    >
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Status dot */}
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{
            background: app.running ? '#10b981' : '#6b7280',
            boxShadow: app.running ? '0 0 8px #10b981' : 'none',
          }}
        />

        {/* Name */}
        <div className="flex-1 min-w-0">
          <span className="font-bold uppercase tracking-wider" style={{ color }}>
            {name}
          </span>
          {app.port > 0 && (
            <span className="ml-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              :{app.port}
            </span>
          )}
          {app.owner && (
            <span className="ml-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {shorten(app.owner)}
            </span>
          )}
        </div>

        {/* Status label */}
        <span
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: app.running ? '#10b981' : '#6b7280' }}
        >
          {app.running ? 'RUNNING' : 'STOPPED'}
        </span>

        {/* Logs toggle */}
        <ActionButton
          label={showLogs ? 'HIDE LOGS' : 'LOGS'}
          color="var(--accent-primary, #00aaff)"
          loading={false}
          onClick={() => setShowLogs(!showLogs)}
        />

        {/* Actions (owner only) */}
        {owned && (
          <div className="flex items-center gap-2">
            {app.running ? (
              <ActionButton
                label="STOP"
                color="#ef4444"
                loading={isLoading}
                onClick={() => onStop(name)}
              />
            ) : (
              <ActionButton
                label="START"
                color="#10b981"
                loading={isLoading}
                onClick={() => onStart(name)}
              />
            )}
            <ActionButton
              label="REMOVE"
              color="#6b7280"
              loading={isLoading}
              onClick={() => {
                if (confirm(`Remove ${name}? This will stop the server and unregister it.`)) {
                  onRemove(name)
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Logs panel */}
      {showLogs && (
        <div
          className="border-t-2 px-4 py-3"
          style={{ borderColor: 'var(--border-strong)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              Logs
            </span>
            <ActionButton
              label="REFRESH"
              color="var(--text-secondary, #888)"
              loading={logsLoading}
              onClick={fetchLogs}
            />
          </div>
          {logsLoading && !logs && (
            <span className="text-xs animate-pulse" style={{ color: 'var(--text-tertiary)' }}>Loading logs...</span>
          )}
          {logsError && (
            <span className="text-xs" style={{ color: '#6b7280' }}>{logsError}</span>
          )}
          {logs && Object.entries(logs).map(([logKey, logContent]) => (
            <div key={logKey} className="mb-3">
              <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: logKey.includes('error') ? '#ef4444' : 'var(--accent-primary, #00aaff)' }}>
                {logKey.replace(/_/g, ' ')}
              </div>
              <pre
                className="text-xs overflow-auto max-h-64 p-2 border"
                style={{
                  color: 'var(--text-primary)',
                  background: 'var(--bg-primary)',
                  borderColor: 'var(--border-color)',
                  fontFamily: 'var(--font-code, monospace)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {logContent}
              </pre>
            </div>
          ))}
          {logs && Object.keys(logs).length === 0 && (
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No logs available</span>
          )}
        </div>
      )}
    </div>
  )
}

function ActionButton({
  label, color, loading, onClick,
}: {
  label: string
  color: string
  loading: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="px-3 py-1 text-xs font-bold uppercase tracking-wider transition-all"
      style={{
        border: `1px solid ${color}`,
        color,
        background: 'transparent',
        fontFamily: "var(--font-digital), monospace",
        opacity: loading ? 0.5 : 1,
        cursor: loading ? 'wait' : 'pointer',
      }}
      onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = color; e.currentTarget.style.color = 'var(--bg-primary)' } }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = color }}
    >
      {loading ? '...' : label}
    </button>
  )
}
