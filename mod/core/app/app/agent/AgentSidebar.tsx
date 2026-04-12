"use client"

import { useState } from 'react'

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  running: '#3b82f6',
  completed: '#10b981',
  failed: '#ef4444',
  cancelled: '#6b7280',
}

const STATUS_ICONS: Record<string, string> = {
  pending: '\u25CB',
  running: '\u25CF',
  completed: '\u2713',
  failed: '\u2715',
  cancelled: '\u25A0',
}

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

function timeSince(ts: number): string {
  const s = Math.floor(Date.now() / 1000 - ts)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'running', label: 'Running' },
  { key: 'completed', label: 'Done' },
  { key: 'failed', label: 'Failed' },
]

interface AgentSidebarProps {
  jobs: Job[]
  selectedJob: string | null
  onSelectJob: (job: Job) => void
  onCancelJob: (id: string) => void
  onDeleteJob: (id: string) => void
  collapsed: boolean
  onToggle: () => void
}

export default function AgentSidebar({
  jobs, selectedJob, onSelectJob, onCancelJob, onDeleteJob, collapsed, onToggle
}: AgentSidebarProps) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const filtered = jobs.filter(j => {
    if (filter !== 'all' && j.status !== filter) return false
    if (search && !j.prompt.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (collapsed) {
    return (
      <div
        className="h-full flex flex-col items-center py-3 cursor-pointer"
        style={{
          width: '40px',
          borderRight: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
        }}
        onClick={onToggle}
      >
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', writingMode: 'vertical-rl', fontWeight: 600, letterSpacing: '0.1em' }}>
          TASKS
        </span>
        {jobs.filter(j => j.status === 'running').length > 0 && (
          <span className="mt-2 w-2 h-2 rounded-full animate-pulse" style={{ background: '#3b82f6' }} />
        )}
      </div>
    )
  }

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{
        width: '340px',
        minWidth: '340px',
        borderRight: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div className="flex items-center gap-2.5">
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
            Tasks
          </span>
          <span
            className="px-2 py-0.5"
            style={{
              fontSize: '11px',
              fontWeight: 500,
              color: 'var(--text-tertiary)',
              background: 'var(--hover-bg)',
              borderRadius: '10px',
            }}
          >
            {jobs.length}
          </span>
        </div>
        <button
          onClick={onToggle}
          className="w-7 h-7 flex items-center justify-center rounded-md transition-colors"
          style={{ color: 'var(--text-tertiary)', background: 'transparent' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex px-3 py-2 gap-1" style={{ borderBottom: '1px solid var(--border-color)' }}>
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className="px-3 py-1.5 transition-all"
            style={{
              fontSize: '12px',
              fontWeight: filter === tab.key ? 600 : 400,
              background: filter === tab.key ? 'var(--hover-bg)' : 'transparent',
              color: filter === tab.key ? 'var(--text-primary)' : 'var(--text-tertiary)',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search tasks..."
          style={{
            width: '100%',
            fontSize: '13px',
            fontFamily: 'inherit',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            padding: '8px 12px',
            outline: 'none',
            borderRadius: '8px',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-color)')}
        />
      </div>

      {/* Job list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center" style={{ background: 'var(--hover-bg)' }}>
              <span style={{ fontSize: '20px', opacity: 0.3 }}>{jobs.length === 0 ? '\u25B7' : '\u2300'}</span>
            </div>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>
              {jobs.length === 0 ? 'No tasks yet' : 'No matching tasks'}
            </p>
            {jobs.length === 0 && (
              <p style={{ color: 'var(--text-tertiary)', fontSize: '11px', marginTop: '4px', opacity: 0.6 }}>
                Submit a task below to get started
              </p>
            )}
          </div>
        ) : (
          filtered.map(job => {
            const isSelected = selectedJob === job.id
            const color = STATUS_COLORS[job.status]
            return (
              <div
                key={job.id}
                onClick={() => onSelectJob(job)}
                className="px-4 py-3 cursor-pointer transition-all"
                style={{
                  borderBottom: '1px solid var(--border-color)',
                  background: isSelected ? `${color}10` : 'transparent',
                  borderLeft: isSelected ? `3px solid ${color}` : '3px solid transparent',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--hover-bg)' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isSelected ? `${color}10` : 'transparent' }}
              >
                {/* Status + Model + Time */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span style={{ color, fontSize: '12px', fontWeight: 600 }}>
                      {STATUS_ICONS[job.status]}
                    </span>
                    <span
                      className="px-2 py-0.5"
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        background: `${color}12`,
                        border: `1px solid ${color}30`,
                        color,
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                      }}
                    >
                      {job.status}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                      {job.model}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                    {timeSince(job.created_at)}
                  </span>
                </div>

                {/* Prompt preview */}
                <p
                  className="truncate"
                  style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: '1.5' }}
                >
                  {job.prompt.length > 100 ? job.prompt.slice(0, 100) + '...' : job.prompt}
                </p>

                {/* Work dir */}
                {job.work_dir && (
                  <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'monospace', marginTop: '4px', opacity: 0.7 }}>
                    {job.work_dir.replace(/.*\/orbit\//, '').replace(/.*\/mod\//, '')}
                  </p>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2 mt-2">
                  {job.status === 'running' && (
                    <button
                      onClick={e => { e.stopPropagation(); onCancelJob(job.id) }}
                      className="px-2 py-1 transition-colors"
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#ef4444',
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '5px',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  )}
                  {['completed', 'failed', 'cancelled'].includes(job.status) && (
                    <button
                      onClick={e => { e.stopPropagation(); onDeleteJob(job.id) }}
                      className="px-2 py-1 transition-colors"
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-tertiary)',
                        background: 'transparent',
                        border: '1px solid var(--border-color)',
                        borderRadius: '5px',
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
