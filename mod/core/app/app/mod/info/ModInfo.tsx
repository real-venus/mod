"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { ModuleType } from '@/types'
import { userContext } from '@/context'
import { text2color, colorWithOpacity, getModApiUrl, getModAppUrl } from '@/utils'
import { CopyButton } from '@/ui/CopyButton'

interface ModInfoProps {
  mod: ModuleType
  moduleColor?: string
}

const FONT = "var(--font-digital), monospace"

export default function ModInfo({ mod, moduleColor }: ModInfoProps) {
  const { client } = userContext()
  const color = moduleColor || text2color(mod.name || mod.key)
  const apiUrl = getModApiUrl(mod)
  const appUrl = getModAppUrl(mod)

  const [apiHealthy, setApiHealthy] = useState(false)
  const [appHealthy, setAppHealthy] = useState(false)
  const [showPreview, setShowPreview] = useState(true)
  const [configOpen, setConfigOpen] = useState(false)
  const [showLogs, setShowLogs] = useState<'api' | 'app' | null>(null)
  const [logs, setLogs] = useState<{ api: string | null; app: string | null }>({ api: null, app: null })
  const logsRef = useRef<HTMLPreElement>(null)

  const checkHealth = useCallback(async () => {
    if (apiUrl) {
      try { const r = await fetch(apiUrl + '/health', { signal: AbortSignal.timeout(3000) }); setApiHealthy(r.ok) }
      catch { setApiHealthy(false) }
    } else { setApiHealthy(false) }
    if (appUrl) {
      try { const r = await fetch(appUrl, { signal: AbortSignal.timeout(3000) }); setAppHealthy(r.ok) }
      catch { setAppHealthy(false) }
    } else { setAppHealthy(false) }
  }, [apiUrl, appUrl])

  useEffect(() => {
    checkHealth()
    const iv = setInterval(checkHealth, 5000)
    return () => clearInterval(iv)
  }, [checkHealth])

  const fetchLogs = useCallback(async (type: 'api' | 'app') => {
    if (!client || !mod) return
    try {
      const result = await client.call('app_logs', { name: mod.name, lines: 200 })
      if (result && !result.error) {
        if (type === 'api') {
          setLogs(prev => ({ ...prev, api: typeof result === 'string' ? result : (result.stdout || result.api || JSON.stringify(result, null, 2)) }))
        } else {
          setLogs(prev => ({ ...prev, app: typeof result === 'string' ? result : (result.app || result.stdout || JSON.stringify(result, null, 2)) }))
        }
      }
    } catch { /* ignore */ }
  }, [client, mod])

  useEffect(() => {
    if (!showLogs) return
    fetchLogs(showLogs)
    const iv = setInterval(() => fetchLogs(showLogs), 4000)
    return () => clearInterval(iv)
  }, [showLogs, fetchLogs])

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight
  }, [logs])

  const isRunning = apiHealthy || appHealthy
  const fnNames = mod.schema && typeof mod.schema === 'object' ? Object.keys(mod.schema) : []

  const config: Record<string, any> = {}
  if (mod.name) config.name = mod.name
  if (mod.key) config.key = mod.key
  if (mod.id !== undefined) config.id = mod.id
  if (mod.desc) config.desc = mod.desc
  if (mod.url) config.url = mod.url
  if (mod.url_app) config.url_app = mod.url_app
  if (mod.network) config.network = mod.network
  if (mod.chain_id) config.chain_id = mod.chain_id
  if (mod.cid) config.cid = mod.cid
  if (mod.created) config.created = mod.created
  if (mod.updated) config.updated = mod.updated
  if (mod.public !== undefined) config.public = mod.public
  if (mod.allowed_users && mod.allowed_users.length > 0) config.allowed_users = mod.allowed_users
  if (mod.take !== undefined) config.take = mod.take
  if (mod.collateral !== undefined) config.collateral = mod.collateral
  if (mod.local !== undefined) config.local = mod.local
  if (mod.path) config.path = mod.path
  const configJson = JSON.stringify(config, null, 2)

  return (
    <div style={{ fontFamily: FONT }} className="max-w-5xl pb-8">

      {mod.desc && (
        <div className="text-[11px] mb-3" style={{ color: 'var(--text-tertiary)' }}>{mod.desc}</div>
      )}

      {/* ── App Preview ── */}
      {appUrl && appHealthy && (
        <div className="mb-4" style={{ borderRadius: '5px', overflow: 'hidden', border: `1px solid ${colorWithOpacity(color, 0.2)}` }}>
          <div
            className="flex items-center justify-between px-3 py-1"
            style={{ background: colorWithOpacity(color, 0.05), borderBottom: `1px solid ${colorWithOpacity(color, 0.1)}` }}
          >
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#ef4444', opacity: 0.6 }} />
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#f59e0b', opacity: 0.6 }} />
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10b981', opacity: 0.6 }} />
              </div>
              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>PREVIEW</span>
            </div>
            <div className="flex items-center gap-2">
              <a href={appUrl} target="_blank" rel="noopener noreferrer" className="text-[9px] font-bold uppercase tracking-wider hover:opacity-100" style={{ color, opacity: 0.6, textDecoration: 'none' }}>OPEN</a>
              <button onClick={() => setShowPreview(!showPreview)} className="text-[9px] font-bold uppercase tracking-wider hover:opacity-100" style={{ color: 'var(--text-tertiary)', opacity: 0.6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT }}>{showPreview ? 'HIDE' : 'SHOW'}</button>
            </div>
          </div>
          {showPreview && (
            <iframe src={appUrl} title={`${mod.name} preview`} style={{ width: '100%', height: '320px', border: 'none', background: 'var(--bg-primary)', display: 'block' }} sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
          )}
        </div>
      )}

      {/* ── Logs ── */}
      {isRunning && (
        <div className="mb-4">
          <div className="flex items-center gap-1 mb-2">
            <button
              onClick={() => setShowLogs(showLogs === 'api' ? null : 'api')}
              className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider transition-all duration-150"
              style={{
                border: `1px solid ${showLogs === 'api' ? '#3b82f6' : 'var(--border-color)'}`,
                color: showLogs === 'api' ? '#3b82f6' : 'var(--text-tertiary)',
                background: showLogs === 'api' ? 'rgba(59,130,246,0.08)' : 'transparent',
                borderRadius: '3px',
              }}
            >
              API LOGS
            </button>
            <button
              onClick={() => setShowLogs(showLogs === 'app' ? null : 'app')}
              className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider transition-all duration-150"
              style={{
                border: `1px solid ${showLogs === 'app' ? '#a78bfa' : 'var(--border-color)'}`,
                color: showLogs === 'app' ? '#a78bfa' : 'var(--text-tertiary)',
                background: showLogs === 'app' ? 'rgba(167,139,250,0.08)' : 'transparent',
                borderRadius: '3px',
              }}
            >
              APP LOGS
            </button>
            {showLogs && (
              <button
                onClick={() => fetchLogs(showLogs)}
                className="ml-1 px-2 py-1 text-[9px] font-bold uppercase tracking-wider"
                style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT }}
              >
                REFRESH
              </button>
            )}
          </div>
          {showLogs && (
            <div style={{ borderRadius: '5px', overflow: 'hidden', border: `1px solid ${showLogs === 'api' ? 'rgba(59,130,246,0.25)' : 'rgba(167,139,250,0.25)'}` }}>
              <div className="flex items-center justify-between px-3 py-1" style={{ background: showLogs === 'api' ? 'rgba(59,130,246,0.06)' : 'rgba(167,139,250,0.06)', borderBottom: '1px solid var(--border-color)' }}>
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: showLogs === 'api' ? '#3b82f6' : '#a78bfa' }}>{showLogs} LOGS</span>
                <button onClick={() => setShowLogs(null)} className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT }}>CLOSE</button>
              </div>
              <pre
                ref={logsRef}
                className="px-3 py-2 text-[11px] overflow-auto"
                style={{
                  color: '#d4d4d4', fontFamily: 'var(--font-code, monospace)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: '1.5',
                  maxHeight: '280px', background: '#0a0a0a', margin: 0,
                }}
              >
                {logs[showLogs] || '(no logs yet)'}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ── Functions ── */}
      {fnNames.length > 0 && (
        <div className="mb-4" style={{ borderRadius: '5px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
          <div className="px-3 py-1.5" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>FUNCTIONS</span>
            <span className="text-[9px] ml-1" style={{ color: 'var(--text-tertiary)', opacity: 0.5 }}>{fnNames.length}</span>
          </div>
          <div className="px-3 py-2 flex flex-wrap gap-1" style={{ background: 'var(--bg-secondary)' }}>
            {fnNames.map(fn => {
              const fnSchema = (mod.schema as unknown as Record<string, any>)?.[fn]
              const inputCount = fnSchema?.input
                ? Array.isArray(fnSchema.input) ? fnSchema.input.length
                  : Object.keys(fnSchema.input).filter((k: string) => k !== 'self' && k !== 'cls' && k !== 'kwargs').length
                : 0
              return (
                <div
                  key={fn}
                  className="px-1.5 py-px text-[9px] font-bold uppercase tracking-wider flex items-center gap-1"
                  style={{ border: '1px solid var(--border-color)', color: 'var(--text-primary)', background: 'var(--bg-primary)', borderRadius: '2px' }}
                >
                  {fn}
                  {inputCount > 0 && <span className="text-[8px]" style={{ color: 'var(--text-tertiary)' }}>({inputCount})</span>}
                  {fnSchema?.auth && <span className="text-[7px]" style={{ color: '#f59e0b' }}>AUTH</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Config ── */}
      <div style={{ borderRadius: '5px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
        <div
          className="flex items-center justify-between px-3 py-1.5 cursor-pointer"
          style={{ background: 'var(--bg-secondary)' }}
          onClick={() => setConfigOpen(!configOpen)}
        >
          <div className="flex items-center gap-1.5">
            <svg className="w-2.5 h-2.5 transition-transform duration-200" style={{ color: 'var(--text-tertiary)', transform: configOpen ? 'rotate(90deg)' : 'rotate(0deg)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>CONFIG</span>
          </div>
          <CopyButton text={configJson} />
        </div>
        {configOpen && (
          <pre className="px-3 py-2 text-[10px] overflow-auto" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-code, monospace)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '400px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)', margin: 0 }}>
            {configJson}
          </pre>
        )}
      </div>
    </div>
  )
}

/* ── Helpers ── */

function StatusDot({ running, size = 8 }: { running: boolean; size?: number }) {
  return (
    <span
      className="rounded-full inline-block flex-shrink-0"
      style={{ width: size, height: size, background: running ? '#10b981' : 'var(--text-tertiary)', boxShadow: running ? '0 0 6px rgba(16,185,129,0.6)' : 'none', opacity: running ? 1 : 0.4, transition: 'all 0.3s ease' }}
    />
  )
}

