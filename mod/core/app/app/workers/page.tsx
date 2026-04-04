"use client"

import { useState, useEffect, useCallback } from 'react'
import { userContext } from '@/context'
import { shorten } from '@/utils'
import { Zap, X, RefreshCw, Plus, Trash2, Shield } from 'lucide-react'

interface WorkerStatus {
  active_workers: number
  max_workers: number
  active_cids: string[]
}

interface TaskInfo {
  fn: string
  status: string
  cid: string
  time: string
  delta?: number
  key?: string
  params?: any
  result?: any
}

const FONT = "var(--font-digital), monospace"

export default function WorkersPage() {
  const { client, user } = userContext()
  const [workers, setWorkers] = useState<WorkerStatus | null>(null)
  const [tasks, setTasks] = useState<TaskInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [maxWorkers, setMaxWorkers] = useState(10)

  const fetchWorkers = useCallback(async () => {
    if (!client) return
    try {
      const result = await client.call('workers')
      if (result && typeof result === 'object' && !result.error) {
        setWorkers(result as WorkerStatus)
        setMaxWorkers(result.max_workers || 10)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchTasks = useCallback(async () => {
    if (!client) return
    try {
      const result = await client.call('txs', { df: 0, n: 20, page: 0 })
      if (Array.isArray(result)) {
        setTasks(result.filter((t: any) => t.status === 'running' || t.status === 'pending' || t.status === 'success' || t.status === 'error'))
      }
    } catch {
      // ignore
    }
  }, [client])

  useEffect(() => {
    fetchWorkers()
    fetchTasks()
    const interval = setInterval(() => { fetchWorkers(); fetchTasks() }, 3000)
    return () => clearInterval(interval)
  }, [fetchWorkers, fetchTasks])

  const handleKillWorker = async (cid: string) => {
    if (!client) return
    setActionLoading(cid)
    try {
      await client.call('kill_worker', { cid })
      setMessage({ text: `Worker ${cid.slice(0, 12)}... killed`, type: 'success' })
      await fetchWorkers()
    } catch (e: any) {
      setMessage({ text: e?.message || 'Failed to kill worker', type: 'error' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleKillAll = async () => {
    if (!client) return
    setActionLoading('__all')
    try {
      await client.call('kill_all_workers')
      setMessage({ text: 'All workers killed', type: 'success' })
      await fetchWorkers()
    } catch (e: any) {
      setMessage({ text: e?.message || 'Failed', type: 'error' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleKillTask = async (cid: string) => {
    if (!client) return
    setActionLoading(cid)
    try {
      await client.call('kill_task', { cid })
      setMessage({ text: `Task killed`, type: 'success' })
      await fetchWorkers()
      await fetchTasks()
    } catch (e: any) {
      setMessage({ text: e?.message || 'Failed', type: 'error' })
    } finally {
      setActionLoading(null)
    }
  }

  const activeCount = workers?.active_workers ?? 0
  const maxCount = workers?.max_workers ?? 0
  const activeCids = workers?.active_cids ?? []
  const runningTasks = tasks.filter(t => t.status === 'running' || t.status === 'pending')
  const recentTasks = tasks.filter(t => t.status === 'success' || t.status === 'error').slice(0, 10)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ fontFamily: FONT, background: 'var(--bg-primary)' }}>
        <span className="animate-pulse text-lg font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          Loading workers...
        </span>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ fontFamily: FONT, background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <div className="max-w-5xl mx-auto px-6 pt-6 pb-16">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6" style={{ color: 'var(--accent-primary)' }} />
            <h1 className="text-xl font-bold uppercase tracking-wider">Sandbox Workers</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchWorkers}
              className="p-2 transition-all rounded"
              style={{ color: 'var(--text-tertiary)', border: '1px solid var(--border-color)' }}
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {activeCount > 0 && (
              <button
                onClick={() => { if (confirm('Kill all active workers?')) handleKillAll() }}
                disabled={actionLoading === '__all'}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all"
                style={{
                  border: '1px solid #ef4444',
                  color: '#ef4444',
                  background: actionLoading === '__all' ? 'rgba(239,68,68,0.1)' : 'transparent',
                  opacity: actionLoading === '__all' ? 0.5 : 1,
                }}
              >
                {actionLoading === '__all' ? 'KILLING...' : 'KILL ALL'}
              </button>
            )}
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className="mb-4 px-4 py-2 flex items-center justify-between"
            style={{
              border: `1px solid ${message.type === 'error' ? '#ef4444' : '#10b981'}`,
              color: message.type === 'error' ? '#ef4444' : '#10b981',
              background: message.type === 'error' ? 'rgba(239,68,68,0.05)' : 'rgba(16,185,129,0.05)',
            }}
          >
            <span className="text-sm">{message.text}</span>
            <button onClick={() => setMessage(null)} style={{ color: 'var(--text-tertiary)' }}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard label="Active Workers" value={activeCount} max={maxCount} color={activeCount > 0 ? '#f59e0b' : 'var(--text-tertiary)'} />
          <StatCard label="Running Tasks" value={runningTasks.length} color={runningTasks.length > 0 ? '#3b82f6' : 'var(--text-tertiary)'} />
          <StatCard label="Max Workers" value={maxCount} color="var(--text-secondary)" />
        </div>

        {/* Active Workers */}
        <div className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>
            Active Workers
          </h2>

          {activeCids.length === 0 && (
            <div className="py-8 text-center" style={{ border: '1px dashed var(--border-color)', background: 'var(--bg-secondary)' }}>
              <Zap className="w-5 h-5 mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
              <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>No active workers</span>
            </div>
          )}

          <div className="space-y-1">
            {activeCids.map(cid => (
              <div
                key={cid}
                className="flex items-center gap-3 px-4 py-3"
                style={{ border: '1px solid var(--border-strong)', background: 'var(--bg-secondary)' }}
              >
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#f59e0b', boxShadow: '0 0 8px #f59e0b' }} />
                <code className="flex-1 text-xs truncate" style={{ color: 'var(--text-primary)' }}>{cid}</code>
                <span className="text-xs font-bold uppercase tracking-wider shrink-0" style={{ color: '#f59e0b' }}>RUNNING</span>
                <button
                  onClick={() => handleKillWorker(cid)}
                  disabled={actionLoading === cid}
                  className="px-3 py-1 text-xs font-bold uppercase tracking-wider transition-all shrink-0"
                  style={{
                    border: '1px solid #ef4444',
                    color: '#ef4444',
                    background: 'transparent',
                    opacity: actionLoading === cid ? 0.5 : 1,
                  }}
                >
                  {actionLoading === cid ? '...' : 'KILL'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Running Tasks */}
        {runningTasks.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>
              Running Tasks
            </h2>
            <div className="space-y-1">
              {runningTasks.map((task, i) => (
                <div
                  key={task.cid || i}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse" style={{ background: '#3b82f6' }} />
                  <span className="text-xs font-bold shrink-0" style={{ color: '#3b82f6' }}>{task.status.toUpperCase()}</span>
                  <span className="text-xs font-mono flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{task.fn}</span>
                  {task.key && (
                    <span className="text-[10px] shrink-0" style={{ color: 'var(--text-tertiary)' }}>{shorten(task.key, 4, 4)}</span>
                  )}
                  {task.cid && (
                    <button
                      onClick={() => handleKillTask(task.cid)}
                      disabled={actionLoading === task.cid}
                      className="px-3 py-1 text-xs font-bold uppercase tracking-wider transition-all shrink-0"
                      style={{
                        border: '1px solid #ef4444',
                        color: '#ef4444',
                        background: 'transparent',
                        opacity: actionLoading === task.cid ? 0.5 : 1,
                      }}
                    >
                      KILL
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Tasks */}
        {recentTasks.length > 0 && (
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>
              Recent Tasks
            </h2>
            <div className="space-y-1">
              {recentTasks.map((task, i) => {
                const isSuccess = task.status === 'success'
                return (
                  <div
                    key={task.cid || i}
                    className="flex items-center gap-3 px-4 py-2.5"
                    style={{ border: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: isSuccess ? '#10b981' : '#ef4444' }}
                    />
                    <span className="text-[10px] font-bold uppercase shrink-0" style={{ color: isSuccess ? '#10b981' : '#ef4444' }}>
                      {task.status}
                    </span>
                    <span className="text-xs font-mono flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{task.fn}</span>
                    {task.delta !== undefined && (
                      <span className="text-[10px] shrink-0" style={{ color: 'var(--text-tertiary)' }}>{task.delta.toFixed(1)}s</span>
                    )}
                    {task.time && (
                      <span className="text-[10px] shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                        {typeof task.time === 'string' ? task.time : new Date(task.time * 1000).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, max, color }: { label: string; value: number; max?: number; color: string }) {
  return (
    <div className="px-4 py-4" style={{ border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
      <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
        {label}
      </div>
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
        {max !== undefined && <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>/{max}</span>}
      </div>
    </div>
  )
}
