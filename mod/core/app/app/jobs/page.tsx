"use client";

import { useState, useEffect, useRef, useCallback } from 'react';

export const dynamic = 'force-dynamic';

const PIXEL_FONT = "var(--font-pixel), 'Press Start 2P', monospace";
const API_URL = process.env.NEXT_PUBLIC_CLAUDE_JOBS_URL || 'http://localhost:8820';

interface Job {
  id: string;
  prompt: string;
  model: string;
  work_dir: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  output: string;
  error: string | null;
  pid: number | null;
  created_at: number;
  updated_at: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  running: '#3b82f6',
  completed: '#10b981',
  failed: '#ef4444',
  cancelled: '#6b7280',
};

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

function timeSince(ts: number): string {
  const seconds = Math.floor(Date.now() / 1000 - ts);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('sonnet');
  const [workDir, setWorkDir] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [streamOutput, setStreamOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const outputRef = useRef<HTMLPreElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/jobs`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setJobs(data.jobs || []);
      setError(null);
    } catch (e: any) {
      setError(`Server offline — start with: cd mod/orbit/claude/server && cargo run`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [streamOutput]);

  const submitJob = async () => {
    if (!prompt.trim()) return;
    setSubmitting(true);
    try {
      const body: any = { prompt: prompt.trim(), model };
      if (workDir.trim()) body.work_dir = workDir.trim();

      const res = await fetch(`${API_URL}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Submit failed');
      const job = await res.json();
      setPrompt('');
      setSelectedJob(job.id);
      fetchJobs();
      startStream(job.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const startStream = (jobId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setStreamOutput('');

    const es = new EventSource(`${API_URL}/jobs/${jobId}/stream`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      if (event.data === '[DONE]') {
        es.close();
        fetchJobs();
        return;
      }
      setStreamOutput(prev => prev + event.data);
    };

    es.addEventListener('complete', (event: any) => {
      setStreamOutput(event.data);
      es.close();
    });

    es.onerror = () => {
      es.close();
      fetchJobs();
    };
  };

  const cancelJob = async (id: string) => {
    await fetch(`${API_URL}/jobs/${id}/cancel`, { method: 'POST' });
    fetchJobs();
  };

  const deleteJob = async (id: string) => {
    await fetch(`${API_URL}/jobs/${id}`, { method: 'DELETE' });
    if (selectedJob === id) {
      setSelectedJob(null);
      setStreamOutput('');
    }
    fetchJobs();
  };

  const viewJob = (job: Job) => {
    setSelectedJob(job.id);
    if (job.status === 'running') {
      startStream(job.id);
    } else {
      setStreamOutput(job.output);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    }
  };

  const selectedJobData = jobs.find(j => j.id === selectedJob);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden" style={{ fontFamily: PIXEL_FONT }}>
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-primary)]">
        <h1 className="text-lg" style={{ color: 'var(--accent-primary)', fontSize: '14px' }}>
          CLAUDE JOBS
        </h1>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)', fontSize: '8px' }}>
          Background AI tasks powered by Claude Max
        </p>
      </div>

      {error && (
        <div className="mx-4 mt-2 p-2 text-xs" style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #ef4444',
          color: '#ef4444',
          fontSize: '8px',
        }}>
          {error}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Submit + Job List */}
        <div className="w-[400px] border-r border-[var(--border-primary)] flex flex-col overflow-hidden">
          {/* Submit Form */}
          <div className="p-3 border-b border-[var(--border-primary)]">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Enter task prompt..."
              className="w-full h-20 p-2 text-xs resize-none"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                color: 'var(--text-primary)',
                fontSize: '10px',
                fontFamily: 'monospace',
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && e.metaKey) submitJob();
              }}
            />
            <div className="flex gap-2 mt-2 items-center">
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                className="px-2 py-1 text-xs"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '8px',
                  fontFamily: PIXEL_FONT,
                }}
              >
                <option value="sonnet">SONNET</option>
                <option value="opus">OPUS</option>
                <option value="haiku">HAIKU</option>
              </select>
              <input
                value={workDir}
                onChange={e => setWorkDir(e.target.value)}
                placeholder="work dir (optional)"
                className="flex-1 px-2 py-1 text-xs"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '8px',
                  fontFamily: 'monospace',
                }}
              />
              <button
                onClick={submitJob}
                disabled={submitting || !prompt.trim()}
                className="px-3 py-1 text-xs"
                style={{
                  background: submitting ? '#333' : '#10b981',
                  border: '2px solid #10b981',
                  color: submitting ? '#666' : '#000',
                  fontSize: '8px',
                  fontFamily: PIXEL_FONT,
                  cursor: submitting ? 'wait' : 'pointer',
                }}
              >
                {submitting ? 'SENDING...' : 'SUBMIT'}
              </button>
            </div>
          </div>

          {/* Job List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-xs" style={{ color: 'var(--text-secondary)', fontSize: '8px' }}>
                Loading...
              </div>
            ) : jobs.length === 0 ? (
              <div className="p-4 text-center text-xs" style={{ color: 'var(--text-secondary)', fontSize: '8px' }}>
                No jobs yet. Submit a task above.
              </div>
            ) : (
              jobs.map(job => (
                <div
                  key={job.id}
                  onClick={() => viewJob(job)}
                  className="p-3 border-b border-[var(--border-primary)] cursor-pointer transition-colors"
                  style={{
                    background: selectedJob === job.id ? 'var(--bg-tertiary)' : 'transparent',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = selectedJob === job.id ? 'var(--bg-tertiary)' : 'transparent')}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="px-2 py-0.5 text-xs uppercase"
                      style={{
                        background: `${STATUS_COLORS[job.status]}20`,
                        border: `1px solid ${STATUS_COLORS[job.status]}`,
                        color: STATUS_COLORS[job.status],
                        fontSize: '7px',
                        fontFamily: PIXEL_FONT,
                      }}
                    >
                      {job.status === 'running' ? `${job.status} ●` : job.status}
                    </span>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '7px' }}>
                      {job.model.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs truncate" style={{ color: 'var(--text-primary)', fontSize: '9px' }}>
                    {job.prompt.length > 80 ? job.prompt.slice(0, 80) + '...' : job.prompt}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '7px' }}>
                      {timeSince(job.created_at)}
                    </span>
                    <div className="flex gap-1">
                      {job.status === 'running' && (
                        <button
                          onClick={e => { e.stopPropagation(); cancelJob(job.id); }}
                          className="px-1 text-xs"
                          style={{ color: '#ef4444', fontSize: '7px', fontFamily: PIXEL_FONT }}
                        >
                          CANCEL
                        </button>
                      )}
                      {(job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') && (
                        <button
                          onClick={e => { e.stopPropagation(); deleteJob(job.id); }}
                          className="px-1 text-xs"
                          style={{ color: '#6b7280', fontSize: '7px', fontFamily: PIXEL_FONT }}
                        >
                          DELETE
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel: Job Output */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedJobData ? (
            <>
              <div className="p-3 border-b border-[var(--border-primary)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5"
                      style={{
                        background: `${STATUS_COLORS[selectedJobData.status]}20`,
                        border: `1px solid ${STATUS_COLORS[selectedJobData.status]}`,
                        color: STATUS_COLORS[selectedJobData.status],
                        fontSize: '8px',
                        fontFamily: PIXEL_FONT,
                      }}
                    >
                      {selectedJobData.status.toUpperCase()}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '8px' }}>
                      {selectedJobData.model.toUpperCase()}
                    </span>
                  </div>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '7px', fontFamily: 'monospace' }}>
                    {selectedJobData.id.slice(0, 8)}
                  </span>
                </div>
                <p className="mt-1" style={{ color: 'var(--text-primary)', fontSize: '9px' }}>
                  {selectedJobData.prompt}
                </p>
                {selectedJobData.work_dir && (
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '7px', fontFamily: 'monospace' }} className="mt-1">
                    DIR: {selectedJobData.work_dir}
                  </p>
                )}
                <p style={{ color: 'var(--text-tertiary)', fontSize: '7px' }} className="mt-1">
                  Created: {formatTime(selectedJobData.created_at)}
                </p>
              </div>
              <pre
                ref={outputRef}
                className="flex-1 overflow-y-auto p-3 m-0 whitespace-pre-wrap"
                style={{
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  lineHeight: '1.5',
                }}
              >
                {streamOutput || selectedJobData.output || (
                  selectedJobData.status === 'pending'
                    ? 'Waiting to start...'
                    : selectedJobData.status === 'running'
                      ? 'Connecting to stream...'
                      : 'No output'
                )}
                {selectedJobData.error && (
                  <span style={{ color: '#ef4444' }}>
                    {'\n\n[ERROR] ' + selectedJobData.error}
                  </span>
                )}
              </pre>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p style={{ color: 'var(--text-tertiary)', fontSize: '9px', fontFamily: PIXEL_FONT }}>
                SELECT A JOB TO VIEW OUTPUT
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
