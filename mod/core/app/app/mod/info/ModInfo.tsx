"use client"

import { useState, useEffect, useCallback } from 'react'
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
  const { client, user } = userContext()
  const color = moduleColor || text2color(mod.name || mod.key)
  const myMod = !!(user?.key && mod.key === user.key)
  const apiUrl = getModApiUrl(mod)
  const appUrl = getModAppUrl(mod)

  const [apiHealthy, setApiHealthy] = useState(false)
  const [appHealthy, setAppHealthy] = useState(false)
  const [serving, setServing] = useState(false)
  const [serveMsg, setServeMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

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

  const handleStart = async () => {
    if (!client || !mod) return
    setServing(true)
    setServeMsg(null)
    try {
      const result = await client.call('serve_app', { name: mod.name })
      if (result?.error) setServeMsg({ text: result.error, type: 'error' })
      else { setServeMsg({ text: `${mod.name} started`, type: 'success' }); setTimeout(checkHealth, 2000) }
    } catch (e: any) { setServeMsg({ text: e?.message || 'Failed', type: 'error' }) }
    finally { setServing(false) }
  }

  const handleStop = async () => {
    if (!client || !mod) return
    setServing(true)
    setServeMsg(null)
    try {
      const result = await client.call('kill_app', { name: mod.name })
      if (result?.error) setServeMsg({ text: result.error, type: 'error' })
      else {
        setServeMsg({ text: `${mod.name} stopped`, type: 'success' })
        setApiHealthy(false)
        setAppHealthy(false)
        setTimeout(checkHealth, 2000)
      }
    } catch (e: any) { setServeMsg({ text: e?.message || 'Failed', type: 'error' }) }
    finally { setServing(false) }
  }

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
    <div style={{ fontFamily: FONT }} className="max-w-4xl pb-8">

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div
          className="w-12 h-12 flex items-center justify-center border-2 text-lg font-bold uppercase"
          style={{ borderColor: color, color, background: colorWithOpacity(color, 0.08) }}
        >
          {(mod.name || '?')[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
              {mod.name}
            </span>
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: isRunning ? '#10b981' : '#6b7280', boxShadow: isRunning ? '0 0 8px #10b981' : 'none' }}
            />
            <span className="text-[10px] font-bold uppercase" style={{ color: isRunning ? '#10b981' : 'var(--text-tertiary)' }}>
              {isRunning ? 'RUNNING' : 'OFFLINE'}
            </span>

            {/* Start / Stop — owner only */}
            {myMod && (
              isRunning ? (
                <button
                  onClick={handleStop}
                  disabled={serving}
                  className="ml-2 px-4 py-1 text-xs font-bold uppercase tracking-wider transition-all"
                  style={{ border: '1px solid #ef4444', color: '#ef4444', background: 'transparent', fontFamily: FONT, opacity: serving ? 0.5 : 1 }}
                  onMouseEnter={e => { if (!serving) { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#000' } }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ef4444' }}
                >
                  {serving ? '...' : 'STOP'}
                </button>
              ) : (
                <button
                  onClick={handleStart}
                  disabled={serving}
                  className="ml-2 px-4 py-1 text-xs font-bold uppercase tracking-wider transition-all"
                  style={{ border: '1px solid #10b981', color: '#10b981', background: 'transparent', fontFamily: FONT, opacity: serving ? 0.5 : 1 }}
                  onMouseEnter={e => { if (!serving) { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.color = '#000' } }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#10b981' }}
                >
                  {serving ? '...' : 'START'}
                </button>
              )
            )}
          </div>
          {serveMsg && (
            <div className="text-[10px] font-bold uppercase mt-1" style={{ color: serveMsg.type === 'error' ? '#ef4444' : '#10b981' }}>
              {serveMsg.text}
            </div>
          )}
          {mod.desc && (
            <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{mod.desc}</div>
          )}
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <InfoCard label="OWNER" borderColor={color}>
          <div className="flex items-center gap-2">
            <code className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>{mod.key}</code>
            <CopyButton text={mod.key} />
          </div>
          {myMod && <span className="text-[10px] font-bold uppercase mt-1 block" style={{ color }}>YOU</span>}
        </InfoCard>

        <InfoCard label="CID">
          {mod.cid ? (
            <div className="flex items-center gap-2">
              <code className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>{mod.cid}</code>
              <CopyButton text={mod.cid} />
            </div>
          ) : (
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>-</span>
          )}
        </InfoCard>

        <InfoCard label="CREATED">
          <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
            {mod.created ? new Date(mod.created * 1000).toLocaleString() : '-'}
          </span>
        </InfoCard>

        <InfoCard label="UPDATED">
          <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
            {mod.updated ? new Date(mod.updated * 1000).toLocaleString() : '-'}
          </span>
        </InfoCard>

        {(mod.network || mod.chain_id) && (
          <InfoCard label="NETWORK">
            <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
              {mod.network || ''}{mod.chain_id ? ` (${mod.chain_id})` : ''}
            </span>
          </InfoCard>
        )}

        <InfoCard label="ACCESS">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold uppercase px-2 py-0.5"
              style={{ border: `1px solid ${mod.public !== false ? '#10b981' : '#f59e0b'}`, color: mod.public !== false ? '#10b981' : '#f59e0b' }}
            >
              {mod.public !== false ? 'PUBLIC' : 'PRIVATE'}
            </span>
            {mod.take !== undefined && mod.take > 0 && (
              <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>TAKE: {mod.take}%</span>
            )}
          </div>
        </InfoCard>

        {mod.id !== undefined && (
          <InfoCard label="MODULE ID">
            <span className="text-xs font-bold" style={{ color }}>{mod.id}</span>
          </InfoCard>
        )}

        {/* Server URLs */}
        {(apiUrl || appUrl) && (
          <InfoCard label="URLS">
            {apiUrl && <div className="text-[10px] mb-0.5" style={{ color: 'var(--text-primary)' }}>API: {apiUrl}</div>}
            {appUrl && <div className="text-[10px]" style={{ color: 'var(--text-primary)' }}>APP: {appUrl}</div>}
          </InfoCard>
        )}
      </div>

      {/* Functions */}
      {fnNames.length > 0 && (
        <div className="mb-6 border-2" style={{ borderColor: 'var(--border-strong)', background: 'var(--bg-secondary)' }}>
          <div className="px-4 py-2.5 border-b-2" style={{ borderColor: 'var(--border-strong)' }}>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              FUNCTIONS ({fnNames.length})
            </span>
          </div>
          <div className="p-3 flex flex-wrap gap-1.5">
            {fnNames.map(fn => {
              const fnSchema = (mod.schema as Record<string, any>)?.[fn]
              const inputCount = fnSchema?.input
                ? Array.isArray(fnSchema.input) ? fnSchema.input.length
                  : Object.keys(fnSchema.input).filter((k: string) => k !== 'self' && k !== 'cls' && k !== 'kwargs').length
                : 0
              return (
                <div
                  key={fn}
                  className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider border flex items-center gap-1.5"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)', background: 'var(--bg-primary)' }}
                >
                  {fn}
                  {inputCount > 0 && <span className="text-[9px]" style={{ color: 'var(--text-tertiary)' }}>({inputCount})</span>}
                  {fnSchema?.auth && <span className="text-[9px]" style={{ color: '#f59e0b' }}>AUTH</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Config JSON */}
      <ConfigSection configJson={configJson} />
    </div>
  )
}

function InfoCard({ label, children, borderColor }: { label: string; children: React.ReactNode; borderColor?: string }) {
  return (
    <div className="border-2 px-4 py-3" style={{ borderColor: borderColor || 'var(--border-color)', background: 'var(--bg-secondary)' }}>
      <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
      {children}
    </div>
  )
}

function ConfigSection({ configJson }: { configJson: string }) {
  const [collapsed, setCollapsed] = useState(true)
  return (
    <div className="border-2" style={{ borderColor: 'var(--border-strong)', background: 'var(--bg-secondary)' }}>
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer"
        style={{ borderBottom: collapsed ? 'none' : '2px solid var(--border-strong)' }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          CONFIG {collapsed ? '(+)' : '(-)'}
        </span>
        <CopyButton text={configJson} />
      </div>
      {!collapsed && (
        <pre
          className="px-4 py-3 text-xs overflow-auto"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-code, monospace)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '400px' }}
        >
          {configJson}
        </pre>
      )}
    </div>
  )
}
