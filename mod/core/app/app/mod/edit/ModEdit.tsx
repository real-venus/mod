"use client";

import { useState, useEffect, useCallback } from 'react'
import { userContext } from '@/context'
import { ModuleType } from '@/types'
import { Send, Loader2, MessageSquare, GitBranch, AlertCircle, CheckCircle, Clock, Play, XCircle } from 'lucide-react'
import ModVersions from '@/mod/versions/ModVersions'

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

function timeSince(ts: number): string {
  const seconds = Math.floor(Date.now() / 1000 - ts)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

interface ModEditProps {
  mod: ModuleType
}

const ui = {
  bg: '#0b0b0b',
  panel: '#121212',
  panelAlt: '#151515',
  border: '#2a2a2a',
  text: '#e7e7e7',
  textDim: '#a8a8a8',
  purple: '#a855f7',
  yellow: '#fbbf24',
}

export default function ModEdit({ mod }: ModEditProps) {
  const { client } = userContext()
  const [message, setMessage] = useState('')
  const [response, setResponse] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [pendingTx, setPendingTx] = useState<{ message: string, cid?: string } | null>(null)
  const [pendingVersion, setPendingVersion] = useState<{ cid: string, comment: string | null, updated: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsError, setJobsError] = useState(false)

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch(`${JOBS_API}/jobs`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      const active = (data.jobs || []).filter((j: Job) =>
        j.status === 'pending' || j.status === 'running'
      )
      setJobs(active)
      setJobsError(false)
    } catch {
      setJobsError(true)
    }
  }, [])

  useEffect(() => {
    fetchJobs()
    const interval = setInterval(fetchJobs, 5000)
    return () => clearInterval(interval)
  }, [fetchJobs])

  const handleSend = async () => {
    if (!message.trim() || !client) return
    const query = message
    setMessage('')
    setLoading(true)
    setError(null)
    setPendingTx({ message: 'Submitting job to claude/forward...' })

    try {
      const result = await client.call('claude/forward', {
        query,
        mod: mod.name,
        key: mod.key,
        background: true,
      }, true, {}, 60000)

      setResponse(result)

      if (result && result.id) {
        setPendingTx({ message: `Job submitted: ${result.id}`, cid: result.id })
      } else if (result && result.cid) {
        setPendingVersion({
          cid: result.cid,
          comment: query,
          updated: new Date().toISOString().replace('T', ' ').slice(0, 19)
        })
        setPendingTx({ message: 'Done', cid: result.cid })
      } else {
        setPendingTx(null)
      }
    } catch (err: any) {
      console.error('Edit failed:', err)
      setError(err?.message || 'Failed to process edit request')
      setPendingTx(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[600px]" style={{ backgroundColor: ui.bg }}>
      {/* Input at top */}
      <div className="p-4 border-b" style={{ backgroundColor: ui.panel, borderColor: ui.border }}>
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-5 h-5" style={{ color: ui.purple }} />
          <h3 className="text-xl font-bold" style={{ color: ui.text }}>Edit Module</h3>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Describe the changes you want to make..."
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-lg border outline-none"
            style={{
              backgroundColor: ui.panelAlt,
              borderColor: ui.border,
              color: ui.text
            }}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || loading}
            className="px-6 py-3 rounded-lg font-bold transition-all disabled:opacity-50"
            style={{
              backgroundColor: ui.purple + '40',
              borderColor: ui.purple,
              color: ui.purple,
              border: '2px solid'
            }}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Vertical split: Versions on left, Chat response on right */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left side: Versions + Pending Jobs */}
        <div className="w-1/2 border-r overflow-y-auto" style={{ borderColor: ui.border, backgroundColor: ui.bg }}>
          <div className="p-4">
            <ModVersions mod={mod} />
          </div>

          {/* Pending Jobs */}
          <div className="p-4 border-t" style={{ borderColor: ui.border }}>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4" style={{ color: ui.yellow }} />
              <span className="text-sm font-bold tracking-wider" style={{ color: ui.yellow }}>
                PENDING JOBS
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: ui.yellow + '20', color: ui.yellow }}>
                {jobs.length}
              </span>
            </div>

            {jobsError ? (
              <p className="text-xs" style={{ color: ui.textDim }}>Jobs server offline</p>
            ) : jobs.length === 0 ? (
              <p className="text-xs" style={{ color: ui.textDim }}>No pending jobs</p>
            ) : (
              <div className="space-y-2">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="p-3 rounded-lg border"
                    style={{
                      backgroundColor: ui.panelAlt,
                      borderColor: job.status === 'running' ? '#3b82f6' + '60' : ui.yellow + '40',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {job.status === 'running' ? (
                          <Play className="w-3 h-3" style={{ color: '#3b82f6' }} />
                        ) : (
                          <Clock className="w-3 h-3" style={{ color: ui.yellow }} />
                        )}
                        <span
                          className="text-xs font-bold uppercase tracking-wider"
                          style={{ color: job.status === 'running' ? '#3b82f6' : ui.yellow }}
                        >
                          {job.status}
                        </span>
                      </div>
                      <span className="text-xs" style={{ color: ui.textDim }}>
                        {timeSince(job.created_at)}
                      </span>
                    </div>
                    <p className="text-xs truncate" style={{ color: ui.text }}>
                      {job.prompt.length > 80 ? job.prompt.slice(0, 80) + '...' : job.prompt}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono" style={{ color: ui.textDim }}>
                        {job.id.slice(0, 8)}...
                      </span>
                      <span className="text-xs uppercase" style={{ color: ui.purple }}>
                        {job.model.replace('anthropic/', '').replace('claude-', '')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right side: Chat response */}
        <div className="w-1/2 overflow-y-auto p-4 space-y-4" style={{ backgroundColor: ui.bg }}>
          {response && Object.keys(response).length > 0 && (
            <div className="p-4 rounded-lg border-2 bg-gradient-to-br from-blue-500/10 border-blue-500/40">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4" style={{ color: '#3b82f6' }} />
                <span className="font-bold text-sm" style={{ color: '#3b82f6' }}>RESPONSE</span>
              </div>
              <pre className="text-sm font-mono overflow-x-auto" style={{ color: ui.textDim }}>
                {JSON.stringify(response, null, 2)}
              </pre>
            </div>
          )}

          {(pendingTx || error) && (
            <div
              className={`p-4 rounded-lg border-2 ${
                error ? 'bg-gradient-to-br from-red-500/10 border-red-500/40'
                : loading
                ? 'bg-gradient-to-br from-yellow-500/10 border-yellow-500/40'
                : 'bg-gradient-to-br from-green-500/10 border-green-500/40'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {error ? (
                  <>
                    <AlertCircle className="w-4 h-4" style={{ color: '#ef4444' }} />
                    <span className="font-bold text-sm" style={{ color: '#ef4444' }}>ERROR</span>
                  </>
                ) : loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: ui.yellow }} />
                    <span className="font-bold text-sm" style={{ color: ui.yellow }}>PENDING</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" style={{ color: '#22c55e' }} />
                    <span className="font-bold text-sm" style={{ color: '#22c55e' }}>SUCCESS</span>
                  </>
                )}
              </div>
              <p className="text-sm" style={{ color: ui.textDim }}>
                {error || pendingTx?.message || 'Processing...'}
              </p>
            </div>
          )}

          {pendingVersion && (
            <div className="p-4 rounded-lg border-2" style={{ backgroundColor: ui.panel, borderColor: ui.purple }}>
              <div className="flex items-center gap-2 mb-2">
                <GitBranch className="w-4 h-4" style={{ color: ui.purple }} />
                <span className="font-bold text-sm" style={{ color: ui.purple }}>PENDING VERSION</span>
              </div>
              <div className="space-y-1 text-xs" style={{ color: ui.textDim }}>
                <div>CID: {pendingVersion.cid}</div>
                <div>Comment: {pendingVersion.comment || 'No comment'}</div>
                <div>Updated: {pendingVersion.updated}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
