"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { userContext } from '@/context'
import AgentSidebar from './AgentSidebar'
import AgentChat from './AgentChat'

export const dynamic = 'force-dynamic'

const API_URL = process.env.NEXT_PUBLIC_CLAUDE_JOBS_URL || 'http://localhost:8820'

// ── Types ──────────────────────────────────────────────────

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

interface Personality {
  id: string
  name: string
  icon: string
  prompt: string
}

// ── Personalities ──────────────────────────────────────────

const PERSONALITIES: Personality[] = [
  { id: 'default', name: 'Default', icon: '>_', prompt: '' },
  { id: 'architect', name: 'Architect', icon: '\u25B3', prompt: 'You are a senior software architect. Design systems, plan implementations, and reason about tradeoffs. Think in systems. Favor simplicity. Plan before building.' },
  { id: 'reviewer', name: 'Reviewer', icon: '\u25C9', prompt: 'You are an expert code reviewer. Find bugs, suggest improvements, ensure code quality. Be thorough. Be constructive. Prioritize correctness > security > performance > style.' },
  { id: 'debugger', name: 'Debugger', icon: '\u2B21', prompt: 'You are an expert debugger. Find root causes, not symptoms. Reproduce first, trace the data, question assumptions, fix the root cause.' },
  { id: 'builder', name: 'Builder', icon: '\u25C6', prompt: 'You are a rapid builder. Ship features fast with production quality. Read first, understand patterns, then build. Test your changes.' },
  { id: 'refactorer', name: 'Refactorer', icon: '\u27F3', prompt: 'You are a refactoring specialist. Improve code structure without changing behavior. Test first, make incremental improvements, follow existing patterns.' },
]

const MODELS = [
  { value: 'opus', label: 'Opus', color: '#a78bfa' },
  { value: 'sonnet', label: 'Sonnet', color: '#60a5fa' },
  { value: 'haiku', label: 'Haiku', color: '#34d399' },
]

// ── Main Component ─────────────────────────────────────────

export default function AgentPage() {
  const { client } = userContext()

  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [streamOutput, setStreamOutput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)

  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('agent_model') || 'sonnet'
    return 'sonnet'
  })
  const [personality, setPersonality] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('agent_personality') || 'default'
    return 'default'
  })
  const [workDir, setWorkDir] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [modules, setModules] = useState<string[]>([])
  const [showModules, setShowModules] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const moduleDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => { localStorage.setItem('agent_model', model) }, [model])
  useEffect(() => { localStorage.setItem('agent_personality', personality) }, [personality])

  // ── API Layer ────────────────────────────────────────────

  const agentFetch = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const token = client?.token || ''
    return fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'token': token,
        'Content-Type': 'application/json',
      },
    })
  }, [client?.token])

  const fetchJobs = useCallback(async () => {
    try {
      const res = await agentFetch('/jobs')
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setJobs(data.jobs || [])
      setError(null)
    } catch {
      setError('Agent API offline \u2014 start with: cd mod/orbit/claude && cargo run')
    } finally {
      setLoading(false)
    }
  }, [agentFetch])

  useEffect(() => {
    fetchJobs()
    const iv = setInterval(fetchJobs, 4000)
    return () => clearInterval(iv)
  }, [fetchJobs])

  useEffect(() => {
    agentFetch('/modules')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.modules) setModules(data.modules.map((m: any) => typeof m === 'string' ? m : m.name))
      })
      .catch(() => {})
  }, [agentFetch])

  // ── Streaming ────────────────────────────────────────────

  const startStream = useCallback((jobId: string) => {
    if (esRef.current) esRef.current.close()

    const existing = jobs.find(j => j.id === jobId)
    setStreamOutput(existing?.output || '')

    const es = new EventSource(`${API_URL}/jobs/${jobId}/stream`)
    esRef.current = es

    es.onmessage = (event) => {
      if (event.data === '[DONE]' || event.data === '[CANCELLED]') {
        es.close()
        fetchJobs()
        return
      }
      setStreamOutput(prev => prev + event.data)
    }

    es.addEventListener('complete', (event: any) => {
      setStreamOutput(event.data)
      es.close()
    })

    es.onerror = () => {
      es.close()
      fetchJobs()
    }
  }, [jobs, fetchJobs])

  useEffect(() => {
    return () => { if (esRef.current) esRef.current.close() }
  }, [])

  // ── Job Actions ──────────────────────────────────────────

  const submitJob = async () => {
    if (!prompt.trim()) return
    setSubmitting(true)
    try {
      const body: any = { prompt: prompt.trim(), model }

      const activePersonality = PERSONALITIES.find(p => p.id === personality)
      if (activePersonality?.prompt) {
        body.system_prompt = activePersonality.prompt
      }
      if (personality !== 'default') body.agent_type = personality
      if (workDir.trim()) body.work_dir = workDir.trim()

      const res = await agentFetch('/jobs', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      if (!res.ok) throw new Error('Submit failed')
      const job = await res.json()
      setPrompt('')
      setSelectedJob(job.id)
      fetchJobs()
      startStream(job.id)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const cancelJob = async (id: string) => {
    if (esRef.current) { esRef.current.close(); esRef.current = null }
    await agentFetch(`/jobs/${id}/cancel`, { method: 'POST' })
    fetchJobs()
  }

  const deleteJob = async (id: string) => {
    await agentFetch(`/jobs/${id}`, { method: 'DELETE' })
    if (selectedJob === id) { setSelectedJob(null); setStreamOutput('') }
    fetchJobs()
  }

  const viewJob = (job: Job) => {
    setSelectedJob(job.id)
    if (job.status === 'running') {
      startStream(job.id)
    } else {
      setStreamOutput(job.output)
      if (esRef.current) { esRef.current.close(); esRef.current = null }
    }
  }

  // ── Module selector ──────────────────────────────────────

  const selectModule = (name: string) => {
    setWorkDir(`~/mod/mod/orbit/${name}`)
    setShowModules(false)
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moduleDropdownRef.current && !moduleDropdownRef.current.contains(e.target as Node)) {
        setShowModules(false)
      }
    }
    if (showModules) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showModules])

  // ── Derived ──────────────────────────────────────────────

  const selectedJobData = jobs.find(j => j.id === selectedJob) || null
  const activePersonality = PERSONALITIES.find(p => p.id === personality) || PERSONALITIES[0]
  const activeModel = MODELS.find(m => m.value === model) || MODELS[0]
  const runningCount = jobs.filter(j => j.status === 'running').length

  return (
    <div className="h-full w-full flex flex-col overflow-hidden" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top bar */}
      <div
        className="px-5 py-3 flex items-center justify-between shrink-0"
        style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
      >
        <div className="flex items-center gap-3">
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
            Agent
          </span>
          {runningCount > 0 && (
            <span
              className="px-2.5 py-1 flex items-center gap-1.5"
              style={{
                fontSize: '11px',
                fontWeight: 600,
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                color: '#60a5fa',
                borderRadius: '6px',
              }}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#60a5fa' }} />
              {runningCount} running
            </span>
          )}
        </div>

        {error && (
          <span style={{ fontSize: '11px', color: '#ef4444', maxWidth: '500px' }} className="truncate">
            {error}
          </span>
        )}
      </div>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        <AgentSidebar
          jobs={jobs}
          selectedJob={selectedJob}
          onSelectJob={viewJob}
          onCancelJob={cancelJob}
          onDeleteJob={deleteJob}
          collapsed={!sidebarOpen}
          onToggle={() => setSidebarOpen(prev => !prev)}
        />

        {/* Main area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <AgentChat
            job={selectedJobData}
            streamOutput={streamOutput}
            onCancel={cancelJob}
          />

          {/* Input area */}
          <div
            className="shrink-0"
            style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
          >
            {/* Controls bar */}
            <div className="px-4 py-2.5 flex items-center gap-3 flex-wrap" style={{ borderBottom: '1px solid var(--border-color)' }}>
              {/* Model selector */}
              <div className="flex gap-1.5">
                {MODELS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setModel(m.value)}
                    className="px-3 py-1.5 transition-all"
                    style={{
                      fontSize: '12px',
                      fontWeight: model === m.value ? 600 : 400,
                      background: model === m.value ? `${m.color}18` : 'transparent',
                      border: model === m.value ? `1px solid ${m.color}40` : '1px solid var(--border-color)',
                      color: model === m.value ? m.color : 'var(--text-tertiary)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }} />

              {/* Personality selector */}
              <div className="flex gap-1.5 flex-wrap">
                {PERSONALITIES.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPersonality(p.id)}
                    className="px-3 py-1.5 transition-all flex items-center gap-1.5"
                    style={{
                      fontSize: '12px',
                      fontWeight: personality === p.id ? 600 : 400,
                      background: personality === p.id ? 'var(--hover-bg)' : 'transparent',
                      border: personality === p.id ? '1px solid var(--border-color)' : '1px solid transparent',
                      color: personality === p.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                    title={p.prompt || 'Default agent'}
                  >
                    <span style={{ fontSize: '13px', opacity: 0.8 }}>{p.icon}</span>
                    {p.name}
                  </button>
                ))}
              </div>

              <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }} />

              {/* Module / work dir selector */}
              <div className="relative flex items-center gap-1.5" ref={moduleDropdownRef}>
                <button
                  onClick={() => setShowModules(!showModules)}
                  className="px-3 py-1.5 transition-all flex items-center gap-1.5"
                  style={{
                    fontSize: '12px',
                    fontWeight: workDir ? 600 : 400,
                    background: workDir ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                    border: workDir ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color)',
                    color: workDir ? '#10b981' : 'var(--text-tertiary)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    maxWidth: '200px',
                  }}
                >
                  {workDir ? workDir.replace(/.*\/orbit\//, '').replace(/~\/mod\/mod\/orbit\//, '') : 'Module'}
                </button>
                {workDir && (
                  <button
                    onClick={() => setWorkDir('')}
                    className="w-6 h-6 flex items-center justify-center rounded-md transition-colors"
                    style={{ color: 'var(--text-tertiary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    &#215;
                  </button>
                )}

                {showModules && (
                  <div
                    className="absolute bottom-full left-0 mb-2 z-50 overflow-y-auto"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                      boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
                      maxHeight: '320px',
                      minWidth: '220px',
                    }}
                  >
                    <div className="p-2.5" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <input
                        value={workDir}
                        onChange={e => setWorkDir(e.target.value)}
                        placeholder="Custom path..."
                        style={{
                          width: '100%',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          padding: '8px 10px',
                          outline: 'none',
                          borderRadius: '6px',
                        }}
                        onKeyDown={e => { if (e.key === 'Enter') setShowModules(false) }}
                      />
                    </div>
                    {modules.map(m => (
                      <div
                        key={m}
                        onClick={() => selectModule(m)}
                        className="px-4 py-2.5 cursor-pointer transition-colors"
                        style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-primary)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {m}
                      </div>
                    ))}
                    {modules.length === 0 && (
                      <div className="px-4 py-3" style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                        No modules loaded
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Prompt input */}
            <div className="p-4 flex gap-3">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder={`${activePersonality.icon}  Enter task for ${activePersonality.name.toLowerCase()} agent...`}
                rows={3}
                disabled={submitting}
                className="flex-1 resize-none"
                style={{
                  fontSize: '14px',
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  padding: '12px 16px',
                  outline: 'none',
                  lineHeight: '1.6',
                  borderRadius: '10px',
                  transition: 'border-color 0.15s',
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.metaKey) {
                    e.preventDefault()
                    submitJob()
                  }
                }}
                onFocus={e => (e.currentTarget.style.borderColor = activeModel.color)}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-color)')}
              />
              <button
                onClick={submitJob}
                disabled={submitting || !prompt.trim()}
                className="px-6 self-end transition-all shrink-0 flex items-center gap-2"
                style={{
                  height: '44px',
                  fontSize: '13px',
                  fontWeight: 600,
                  background: submitting || !prompt.trim() ? 'var(--hover-bg)' : activeModel.color,
                  border: 'none',
                  color: submitting || !prompt.trim() ? 'var(--text-tertiary)' : '#000',
                  cursor: submitting || !prompt.trim() ? 'not-allowed' : 'pointer',
                  borderRadius: '10px',
                  boxShadow: submitting || !prompt.trim() ? 'none' : `0 0 20px ${activeModel.color}25`,
                }}
              >
                {submitting ? 'Sending...' : '\u25B6 Run'}
              </button>
            </div>

            {/* Keyboard hint */}
            <div className="px-5 pb-2.5 flex items-center justify-between">
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', opacity: 0.6 }}>
                &#8984;+Enter to submit
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', opacity: 0.6 }}>
                {activePersonality.id !== 'default' && (
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                    {activePersonality.icon} {activePersonality.name}
                  </span>
                )}
                {' '}{activeModel.label} · {API_URL.replace('http://', '')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
