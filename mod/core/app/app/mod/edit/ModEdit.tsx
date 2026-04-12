"use client";

import { useState, useEffect, useCallback, useRef } from 'react'
import { userContext } from '@/context'
import { ModuleType } from '@/types'
import { text2color, colorWithOpacity } from '@/utils'
import { Send, Loader2, GitBranch, CheckCircle, Clock, Play, XCircle, Terminal, StopCircle } from 'lucide-react'

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

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  running:   { color: '#3b82f6', label: 'RUNNING' },
  pending:   { color: '#fbbf24', label: 'PENDING' },
  completed: { color: '#22c55e', label: 'COMPLETED' },
  failed:    { color: '#ef4444', label: 'FAILED' },
  cancelled: { color: '#64748b', label: 'CANCELLED' },
}

function StatusIcon({ status, size = 12 }: { status: string; size?: number }) {
  const color = STATUS_CONFIG[status]?.color || '#fbbf24'
  switch (status) {
    case 'running':   return <Play size={size} style={{ color }} />
    case 'completed': return <CheckCircle size={size} style={{ color }} />
    case 'failed':    return <XCircle size={size} style={{ color }} />
    case 'cancelled': return <StopCircle size={size} style={{ color }} />
    default:          return <Clock size={size} style={{ color }} />
  }
}

interface ModEditProps {
  mod: ModuleType
  moduleColor?: string
  isSuggestion?: boolean
}

export default function ModEdit({ mod, moduleColor, isSuggestion }: ModEditProps) {
  const { client, user } = userContext()
  const modColor = moduleColor || text2color(mod.name || mod.key)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsError, setJobsError] = useState(false)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [activeJobOutput, setActiveJobOutput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const outputEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Authenticated fetch to Claude Jobs API using core app token
  const jobsFetch = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const token = client?.token || ''
    return fetch(`${JOBS_API}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'token': token,
        'Content-Type': 'application/json',
      },
    })
  }, [client?.token])

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => { scrollToBottom() }, [messages])

  // Fetch all jobs for this module
  const fetchJobs = useCallback(async () => {
    try {
      const res = await jobsFetch('/jobs')
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      const allJobs = data.jobs || []
      const modJobs = allJobs.filter((j: Job) => {
        if (!j.work_dir) return false
        const wd = j.work_dir.toLowerCase()
        return wd.includes(`/${mod.name}/`) || wd.endsWith(`/${mod.name}`)
      })
      setJobs(modJobs)
      setJobsError(false)

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
    } catch {
      setJobsError(true)
    }
  }, [activeJobId, mod.name, jobsFetch])

  useEffect(() => {
    fetchJobs()
    const interval = setInterval(fetchJobs, 3000)
    return () => clearInterval(interval)
  }, [fetchJobs])

  // Auto-scroll output
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeJobOutput])

  const handleSend = async () => {
    if (!message.trim() || !client) return
    const query = message.trim()
    setMessage('')
    inputRef.current?.focus()

    setMessages(prev => [...prev, {
      role: 'user',
      content: query,
      timestamp: Date.now() / 1000,
    }])

    setLoading(true)
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
          content: `Job submitted`,
          timestamp: Date.now() / 1000,
          jobId: result.id,
          status: 'running',
        }])
      } else if (result?.cid) {
        setMessages(prev => [...prev, {
          role: 'agent',
          content: `Done`,
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
      setLoading(false)
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

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 70px)', fontFamily: 'var(--font-digital), monospace' }}>
      {/* Main split: Chat + Output on left, Tasks on right */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat + Live Output */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ borderRight: '1px solid var(--border-color)' }}>
          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ scrollbarWidth: 'thin' }}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3" style={{ opacity: 0.4 }}>
                <Terminal size={32} style={{ color: modColor }} />
                <p className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                  {isSuggestion ? `Suggest changes to ${mod.name}` : `Dev Agent for ${mod.name}`}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {isSuggestion
                    ? 'Describe your suggestion — it will be submitted as a proposal to the owner'
                    : 'Describe changes and Claude will edit the module code'}
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[85%] px-3 py-2 rounded-lg"
                  style={{
                    background: msg.role === 'user'
                      ? colorWithOpacity(modColor, 0.12)
                      : msg.role === 'system'
                      ? 'rgba(251, 191, 36, 0.08)'
                      : 'var(--bg-surface)',
                    border: msg.role === 'user'
                      ? `1px solid ${colorWithOpacity(modColor, 0.25)}`
                      : msg.role === 'system'
                      ? '1px solid rgba(251, 191, 36, 0.2)'
                      : '1px solid var(--border-color)',
                  }}
                >
                  {msg.status && (
                    <div className="flex items-center gap-1.5 mb-1">
                      {msg.status === 'running' && <Loader2 size={10} className="animate-spin" style={{ color: '#3b82f6' }} />}
                      {msg.status === 'completed' && <CheckCircle size={10} style={{ color: '#22c55e' }} />}
                      {msg.status === 'failed' && <XCircle size={10} style={{ color: '#ef4444' }} />}
                      {msg.status === 'pending' && <Clock size={10} style={{ color: '#fbbf24' }} />}
                      <span className="text-[9px] font-bold uppercase tracking-wider" style={{
                        color: msg.status === 'running' ? '#3b82f6'
                          : msg.status === 'completed' ? '#22c55e'
                          : msg.status === 'failed' ? '#ef4444'
                          : '#fbbf24'
                      }}>
                        {msg.status}
                      </span>
                      {msg.jobId && (
                        <span className="text-[9px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                          {msg.jobId.slice(0, 8)}
                        </span>
                      )}
                    </div>
                  )}

                  <p className="text-[13px] whitespace-pre-wrap break-words" style={{
                    color: msg.role === 'user' ? 'var(--text-primary)'
                      : msg.role === 'system' ? '#fbbf24'
                      : 'var(--text-secondary)',
                  }}>
                    {msg.content}
                  </p>

                  {msg.cid && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <GitBranch size={10} style={{ color: modColor }} />
                      <span className="text-[10px] font-mono" style={{ color: modColor }}>
                        {msg.cid}
                      </span>
                    </div>
                  )}

                  <span className="text-[9px] mt-1 block" style={{ color: 'var(--text-tertiary)', opacity: 0.5 }}>
                    {timeSince(msg.timestamp)}
                  </span>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Live output panel */}
          {activeJobId && activeJobOutput && (
            <div
              className="overflow-y-auto border-t"
              style={{
                maxHeight: '200px',
                borderColor: 'var(--border-color)',
                background: 'var(--bg-primary)',
              }}
            >
              <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
                <div className="flex items-center gap-2">
                  <Terminal size={12} style={{ color: isJobRunning ? '#3b82f6' : '#22c55e' }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{
                    color: isJobRunning ? '#3b82f6' : '#22c55e'
                  }}>
                    {isJobRunning ? 'LIVE OUTPUT' : 'OUTPUT'}
                  </span>
                </div>
                {isJobRunning && (
                  <button
                    onClick={() => handleCancel(activeJobId)}
                    className="text-[9px] font-bold uppercase px-2 py-0.5 rounded transition-all"
                    style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                  >
                    CANCEL
                  </button>
                )}
              </div>
              <pre
                className="p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-words"
                style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-digital), monospace' }}
              >
                {activeJobOutput.slice(-5000)}
                <span ref={outputEndRef} />
              </pre>
            </div>
          )}

          {/* Input bar */}
          <div className="shrink-0 p-3 border-t" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-surface)' }}>
            <div className="flex gap-2 items-center">
              <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder={isSuggestion ? `suggest changes to ${mod.name}...` : `edit ${mod.name}...`}
                disabled={loading}
                className="flex-1 px-3 py-2.5 rounded-lg border outline-none text-[13px]"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderColor: loading ? colorWithOpacity(modColor, 0.2) : 'var(--border-color)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-digital), monospace',
                }}
                autoFocus
              />
              <button
                onClick={handleSend}
                disabled={!message.trim() || loading}
                className="px-4 py-2.5 rounded-lg font-bold transition-all disabled:opacity-30"
                style={{
                  backgroundColor: colorWithOpacity(modColor, 0.12),
                  border: `1px solid ${colorWithOpacity(modColor, 0.3)}`,
                  color: modColor,
                }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Task list — Claude.ai style */}
        <div
          className="w-72 shrink-0 flex flex-col overflow-hidden"
          style={{ background: 'var(--bg-surface)' }}
        >
          {/* Tasks header */}
          <div className="px-3 py-2.5 border-b shrink-0" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={12} style={{ color: 'var(--text-primary)' }} />
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                  TASKS
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{
                  backgroundColor: colorWithOpacity(modColor, 0.12),
                  color: modColor,
                }}>
                  {recentJobs.length}
                </span>
              </div>
              {runningCount > 0 && (
                <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: '#3b82f6' }}>
                  <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#3b82f6' }} />
                  {runningCount}
                </span>
              )}
            </div>
          </div>

          {/* Task cards */}
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {jobsError ? (
              <p className="text-[11px] p-3" style={{ color: 'var(--text-tertiary)' }}>Jobs server offline</p>
            ) : recentJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2" style={{ opacity: 0.3 }}>
                <Clock size={24} style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>No tasks yet</p>
              </div>
            ) : (
              recentJobs.map((job) => {
                const isActive = job.id === activeJobId
                const sc = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending
                return (
                  <button
                    key={job.id}
                    onClick={() => {
                      setActiveJobId(job.id)
                      setActiveJobOutput(job.output || '')
                    }}
                    className="w-full text-left transition-all group"
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      borderLeft: `3px solid ${isActive ? sc.color : 'transparent'}`,
                      background: isActive ? colorWithOpacity(sc.color, 0.06) : 'transparent',
                    }}
                  >
                    <div className="px-3 py-2.5">
                      {/* Status + time */}
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon status={job.status} size={11} />
                          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: sc.color }}>
                            {sc.label}
                          </span>
                        </div>
                        <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                          {timeSince(job.created_at)}
                        </span>
                      </div>

                      {/* Prompt */}
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

                      {/* Cancel for running */}
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
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
