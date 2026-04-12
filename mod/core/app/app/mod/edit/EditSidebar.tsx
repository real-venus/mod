"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useLayoutContext } from '@/context/LayoutContext'
import { userContext } from '@/context'
import { ModuleType } from '@/types'
import { text2color, colorWithOpacity } from '@/utils'
import { X, Send, Loader2, GitBranch, CheckCircle, Clock, Play, XCircle, Terminal, StopCircle, Wrench } from 'lucide-react'

const JOBS_API = process.env.NEXT_PUBLIC_CLAUDE_JOBS_URL || 'http://localhost:8820'

interface Job {
  id: string
  prompt: string
  model: string
  work_dir: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  output: string
  error: string | null
  pid: number | null
  created_at: number
  updated_at: number
}

interface ChatMessage {
  role: 'user' | 'agent' | 'system'
  content: string
  timestamp: number
  jobId?: string
  status?: 'pending' | 'running' | 'completed' | 'failed'
  cid?: string
}

function timeSince(ts: number): string {
  const seconds = Math.floor(Date.now() / 1000 - ts)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function getModuleFromPath(pathname: string): string | null {
  const modMatch = pathname.match(/^\/mod\/([^/]+)/)
  if (modMatch) return modMatch[1]
  const knownRoutes = ['mod', 'mods', 'user', 'cid', 'chat', 'docs', 'quests', 'create', 'safe', 'bridge', 'contracts', 'treasury', 'jobs', 'traders', 'network', 'home', 'transactions', 'buidl', 'apps', 'chain', 'balancer', 'workers']
  const twoSegMatch = pathname.match(/^\/([^/]+)\/([^/]+)$/)
  if (twoSegMatch && !knownRoutes.includes(twoSegMatch[1])) return twoSegMatch[1]
  const singleMatch = pathname.match(/^\/([^/]+)$/)
  if (singleMatch && !knownRoutes.includes(singleMatch[1])) return singleMatch[1]
  return null
}

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: 'running' | 'completed' | 'failed' | 'pending' | 'cancelled' }> = {
  running:   { color: '#3b82f6', label: 'RUNNING',   icon: 'running' },
  pending:   { color: '#fbbf24', label: 'PENDING',   icon: 'pending' },
  completed: { color: '#22c55e', label: 'COMPLETED', icon: 'completed' },
  failed:    { color: '#ef4444', label: 'FAILED',    icon: 'failed' },
  cancelled: { color: '#64748b', label: 'CANCELLED', icon: 'cancelled' },
}

function StatusIcon({ status, size = 12 }: { status: string; size?: number }) {
  const cfg = STATUS_CONFIG[status]
  if (!cfg) return null
  const color = cfg.color
  switch (cfg.icon) {
    case 'running':   return <Play size={size} style={{ color }} />
    case 'completed': return <CheckCircle size={size} style={{ color }} />
    case 'failed':    return <XCircle size={size} style={{ color }} />
    case 'cancelled': return <StopCircle size={size} style={{ color }} />
    case 'pending':   return <Clock size={size} style={{ color }} />
    default:          return <Clock size={size} style={{ color }} />
  }
}

export const EDIT_SIDEBAR_WIDTH = 420

export function EditSidebar() {
  const { isEditSidebarOpen, setEditSidebarOpen } = useLayoutContext()
  const { client, user } = userContext()
  const pathname = usePathname()
  const activeModule = getModuleFromPath(pathname)

  const [mod, setMod] = useState<ModuleType | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)
  const [jobs, setJobs] = useState<Job[]>([])
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [activeJobOutput, setActiveJobOutput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const outputEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const moduleColor = mod ? text2color(mod.name || mod.key) : activeModule ? text2color(activeModule) : '#a78bfa'

  // Fetch module info when sidebar opens or module changes
  useEffect(() => {
    if (!isEditSidebarOpen || !activeModule || !client) {
      setMod(null)
      return
    }
    setLoading(true)
    client.call('mod', { mod: activeModule, expand: true, schema: true })
      .then((data: any) => {
        if (data && !data.error) setMod(data as ModuleType)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isEditSidebarOpen, activeModule, client])

  // Focus input when sidebar opens
  useEffect(() => {
    if (isEditSidebarOpen) {
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [isEditSidebarOpen])

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Scroll output to bottom
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeJobOutput])

  // Authenticated fetch
  const jobsFetch = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const token = client?.token || ''
    return fetch(`${JOBS_API}${endpoint}`, {
      ...options,
      headers: { ...options.headers, 'token': token, 'Content-Type': 'application/json' },
    })
  }, [client?.token])

  // Poll jobs
  const fetchJobs = useCallback(async () => {
    if (!mod?.name) return
    try {
      const res = await jobsFetch('/jobs')
      if (!res.ok) return
      const data = await res.json()
      const allJobs = data.jobs || []
      const modJobs = allJobs.filter((j: Job) => {
        if (!j.work_dir) return false
        const wd = j.work_dir.toLowerCase()
        return wd.includes(`/${mod.name}/`) || wd.endsWith(`/${mod.name}`)
      })
      setJobs(modJobs)

      if (activeJobId) {
        const active = allJobs.find((j: Job) => j.id === activeJobId)
        if (active) {
          setActiveJobOutput(active.output || '')
          if (active.status === 'completed' || active.status === 'failed') {
            setMessages(prev => prev.map(m =>
              m.jobId === activeJobId ? { ...m, status: active.status } : m
            ))
          }
        }
      }
    } catch {}
  }, [activeJobId, mod?.name, jobsFetch])

  useEffect(() => {
    if (!isEditSidebarOpen || !mod) return
    fetchJobs()
    const interval = setInterval(fetchJobs, 3000)
    return () => clearInterval(interval)
  }, [fetchJobs, isEditSidebarOpen, mod])

  const handleSend = async () => {
    if (!message.trim() || !client || !mod) return
    const query = message.trim()
    setMessage('')
    inputRef.current?.focus()

    setMessages(prev => [...prev, {
      role: 'user',
      content: query,
      timestamp: Date.now() / 1000,
    }])

    setSending(true)
    try {
      const result = await client.call('claude/forward', {
        query,
        mod: mod.name,
        key: user?.key || mod.key,
        background: true,
      }, true, {}, 60000)

      if (result?.id) {
        setActiveJobId(result.id)
        setActiveJobOutput('')
        setMessages(prev => [...prev, {
          role: 'agent',
          content: 'Job submitted',
          timestamp: Date.now() / 1000,
          jobId: result.id,
          status: 'running',
        }])
      } else if (result?.cid) {
        setMessages(prev => [...prev, {
          role: 'agent',
          content: 'Done',
          timestamp: Date.now() / 1000,
          cid: result.cid,
          status: 'completed',
        }])
      } else {
        setMessages(prev => [...prev, {
          role: 'agent',
          content: JSON.stringify(result, null, 2),
          timestamp: Date.now() / 1000,
          status: 'completed',
        }])
      }
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'agent',
        content: err?.message || 'Failed to submit edit',
        timestamp: Date.now() / 1000,
        status: 'failed',
      }])
    } finally {
      setSending(false)
    }
  }

  const handleCancel = async (jobId: string) => {
    try {
      await jobsFetch(`/jobs/${jobId}/cancel`, { method: 'POST' })
      fetchJobs()
    } catch {}
  }

  const activeJob = jobs.find(j => j.id === activeJobId)
  const isJobRunning = activeJob?.status === 'running' || activeJob?.status === 'pending'
  const recentJobs = jobs.slice(0, 20)
  const runningCount = jobs.filter(j => j.status === 'running').length

  if (!isEditSidebarOpen || !activeModule) return null

  return (
    <div
      className="fixed right-0 z-[65] flex flex-col"
      style={{
        top: '48px',
        bottom: 0,
        width: `${EDIT_SIDEBAR_WIDTH}px`,
        background: 'var(--bg-primary)',
        borderLeft: '1px solid var(--border-color)',
        fontFamily: 'var(--font-digital), monospace',
        animation: 'slideInRight 0.2s ease-out',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Wrench size={14} style={{ color: moduleColor }} />
          <span
            className="text-xs font-bold uppercase tracking-wider truncate"
            style={{ color: moduleColor, textShadow: `0 0 8px ${colorWithOpacity(moduleColor, 0.4)}` }}
          >
            {activeModule}
          </span>
          {mod && (
            <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              [{mod.schema ? Object.keys(mod.schema).length : 0}]
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setEditSidebarOpen(false)}
            className="flex items-center justify-center transition-all rounded"
            style={{ width: '24px', height: '24px', color: 'var(--text-tertiary)' }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin" style={{ color: moduleColor }} />
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5" style={{ scrollbarWidth: 'thin' }}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3" style={{ opacity: 0.4 }}>
                <Terminal size={28} style={{ color: moduleColor }} />
                <p className="text-[11px] font-bold uppercase tracking-wider text-center" style={{ color: 'var(--text-tertiary)' }}>
                  Edit {activeModule}
                </p>
                <p className="text-[10px] text-center px-4" style={{ color: 'var(--text-tertiary)' }}>
                  Describe changes and Claude will edit the module code
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[90%] px-2.5 py-1.5 rounded-lg"
                  style={{
                    background: msg.role === 'user'
                      ? colorWithOpacity(moduleColor, 0.12)
                      : msg.role === 'system'
                      ? 'rgba(251, 191, 36, 0.08)'
                      : 'var(--bg-surface)',
                    border: msg.role === 'user'
                      ? `1px solid ${colorWithOpacity(moduleColor, 0.25)}`
                      : msg.role === 'system'
                      ? '1px solid rgba(251, 191, 36, 0.2)'
                      : '1px solid var(--border-color)',
                  }}
                >
                  {msg.status && (
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {msg.status === 'running' && <Loader2 size={9} className="animate-spin" style={{ color: '#3b82f6' }} />}
                      {msg.status === 'completed' && <CheckCircle size={9} style={{ color: '#22c55e' }} />}
                      {msg.status === 'failed' && <XCircle size={9} style={{ color: '#ef4444' }} />}
                      {msg.status === 'pending' && <Clock size={9} style={{ color: '#fbbf24' }} />}
                      <span className="text-[8px] font-bold uppercase tracking-wider" style={{
                        color: msg.status === 'running' ? '#3b82f6'
                          : msg.status === 'completed' ? '#22c55e'
                          : msg.status === 'failed' ? '#ef4444'
                          : '#fbbf24'
                      }}>
                        {msg.status}
                      </span>
                      {msg.jobId && (
                        <span className="text-[8px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                          {msg.jobId.slice(0, 8)}
                        </span>
                      )}
                    </div>
                  )}

                  <p className="text-[12px] whitespace-pre-wrap break-words" style={{
                    color: msg.role === 'user' ? 'var(--text-primary)'
                      : msg.role === 'system' ? '#fbbf24'
                      : 'var(--text-secondary)',
                  }}>
                    {msg.content}
                  </p>

                  {msg.cid && (
                    <div className="flex items-center gap-1 mt-1">
                      <GitBranch size={9} style={{ color: moduleColor }} />
                      <span className="text-[9px] font-mono" style={{ color: moduleColor }}>
                        {msg.cid}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Live output panel */}
          {activeJobId && activeJobOutput && (
            <div
              className="overflow-y-auto border-t shrink-0"
              style={{
                maxHeight: '150px',
                borderColor: 'var(--border-color)',
                background: 'var(--bg-primary)',
              }}
            >
              <div className="flex items-center justify-between px-2.5 py-1" style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
                <div className="flex items-center gap-1.5">
                  <Terminal size={10} style={{ color: isJobRunning ? '#3b82f6' : '#22c55e' }} />
                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{
                    color: isJobRunning ? '#3b82f6' : '#22c55e'
                  }}>
                    {isJobRunning ? 'LIVE' : 'OUTPUT'}
                  </span>
                </div>
                {isJobRunning && (
                  <button
                    onClick={() => handleCancel(activeJobId)}
                    className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded transition-all"
                    style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                  >
                    CANCEL
                  </button>
                )}
              </div>
              <pre
                className="px-2.5 py-2 text-[10px] leading-relaxed whitespace-pre-wrap break-words"
                style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital), monospace' }}
              >
                {activeJobOutput.slice(-3000)}
                <span ref={outputEndRef} />
              </pre>
            </div>
          )}

          {/* Tasks panel — always visible, Claude.ai style */}
          {recentJobs.length > 0 && (
            <div
              className="overflow-y-auto border-t shrink-0"
              style={{
                maxHeight: '300px',
                borderColor: 'var(--border-color)',
                background: 'var(--bg-surface)',
                scrollbarWidth: 'thin',
              }}
            >
              {/* Tasks header */}
              <div className="px-3 py-2 border-b sticky top-0 z-10" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-surface)' }}>
                <div className="flex items-center gap-2">
                  <Clock size={12} style={{ color: 'var(--text-primary)' }} />
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                    TASKS
                  </span>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: colorWithOpacity(moduleColor, 0.12),
                      color: moduleColor,
                    }}
                  >
                    {recentJobs.length}
                  </span>
                  {runningCount > 0 && (
                    <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: '#3b82f6' }}>
                      <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#3b82f6' }} />
                      {runningCount} active
                    </span>
                  )}
                </div>
              </div>

              {/* Task cards */}
              {recentJobs.map((job) => {
                const isActive = job.id === activeJobId
                const sc = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending
                return (
                  <button
                    key={job.id}
                    onClick={() => { setActiveJobId(job.id); setActiveJobOutput(job.output || '') }}
                    className="w-full text-left transition-all group"
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      borderLeft: `3px solid ${isActive ? sc.color : 'transparent'}`,
                      background: isActive ? colorWithOpacity(sc.color, 0.06) : 'transparent',
                    }}
                  >
                    <div className="px-3 py-2.5">
                      {/* Status row */}
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon status={job.status} size={11} />
                          <span
                            className="text-[10px] font-bold uppercase tracking-wide"
                            style={{ color: sc.color }}
                          >
                            {sc.label}
                          </span>
                        </div>
                        <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                          {timeSince(job.created_at)}
                        </span>
                      </div>

                      {/* Prompt text */}
                      <p
                        className="text-[11px] leading-relaxed"
                        style={{
                          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {job.prompt}
                      </p>

                      {/* Cancel button for running jobs */}
                      {(job.status === 'running' || job.status === 'pending') && (
                        <div className="mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span
                            onClick={(e) => { e.stopPropagation(); handleCancel(job.id) }}
                            className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded cursor-pointer transition-all"
                            style={{
                              color: '#ef4444',
                              border: '1px solid rgba(239,68,68,0.25)',
                              background: 'rgba(239,68,68,0.06)',
                            }}
                          >
                            CANCEL
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Input bar */}
          <div className="shrink-0 px-2.5 py-2 border-t" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-surface)' }}>
            <div className="flex gap-1.5 items-center">
              <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder={`edit ${activeModule}...`}
                disabled={sending || !mod}
                className="flex-1 px-2.5 py-2 rounded-lg border outline-none text-[12px]"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderColor: sending ? colorWithOpacity(moduleColor, 0.2) : 'var(--border-color)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-digital), monospace',
                }}
              />
              <button
                onClick={handleSend}
                disabled={!message.trim() || sending || !mod}
                className="px-3 py-2 rounded-lg font-bold transition-all disabled:opacity-30"
                style={{
                  backgroundColor: colorWithOpacity(moduleColor, 0.12),
                  border: `1px solid ${colorWithOpacity(moduleColor, 0.3)}`,
                  color: moduleColor,
                }}
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
