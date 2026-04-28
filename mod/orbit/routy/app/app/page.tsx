'use client'

import { useEffect, useState, useCallback } from 'react'

const API = process.env.NEXT_PUBLIC_ROUTY_API || 'http://localhost:3001'

interface Website {
  name: string
  target_url: string
  description: string | null
  created_at: number
}

interface Stats {
  cpu_usage_percent: number
  apps: number
  apis: number
  total: number
}

export default function Home() {
  const [apps, setApps] = useState<Website[]>([])
  const [apis, setApis] = useState<Website[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [ws, st] = await Promise.all([
        fetch(`${API}/_api/websites`).then(r => r.json()),
        fetch(`${API}/_api/stats`).then(r => r.json()),
      ])
      setApps(ws.apps || [])
      setApis(ws.apis || [])
      setStats(st)
      setError(null)
    } catch (e: any) {
      setError('Cannot reach routy on :3001')
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [refresh])

  const sync = async () => {
    setSyncing(true)
    try {
      const res = await fetch(`${API}/_api/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      // sync is done server-side in Python, just trigger refresh
      await new Promise(r => setTimeout(r, 500))
      await refresh()
    } catch {
      setError('Sync failed')
    }
    setSyncing(false)
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>routy</h1>
          <p style={{ color: '#666', marginTop: 4 }}>local gateway &middot; {stats ? `${stats.apps} apps + ${stats.apis} apis` : '...'}</p>
        </div>
        <button
          onClick={sync}
          disabled={syncing}
          style={{
            background: '#1a1a2e', border: '1px solid #2a2a3e', color: '#60a5fa',
            padding: '8px 20px', borderRadius: 6, cursor: 'pointer', fontSize: 14,
            opacity: syncing ? 0.5 : 1,
          }}
        >
          {syncing ? 'syncing...' : 'sync'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#1a1010', border: '1px solid #3a1010', borderRadius: 8, padding: 16, marginBottom: 24, color: '#f87171' }}>
          {error}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
          {[
            { label: 'apps', value: stats.apps, color: '#4ade80' },
            { label: 'apis', value: stats.apis, color: '#60a5fa' },
            { label: 'total', value: stats.total, color: '#fff' },
            { label: 'cpu', value: `${stats.cpu_usage_percent.toFixed(0)}%`, color: stats.cpu_usage_percent > 80 ? '#f87171' : '#fbbf24' },
          ].map(s => (
            <div key={s.label} style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 8, padding: '16px 20px' }}>
              <div style={{ fontSize: 28, fontWeight: 600, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Apps */}
      <Section title="Apps" subtitle="/{name}/*" items={apps} linkPrefix="/" />

      {/* APIs */}
      <Section title="APIs" subtitle="/api/{name}/*" items={apis} linkPrefix="/api/" />
    </div>
  )
}

function Section({ title, subtitle, items, linkPrefix }: {
  title: string, subtitle: string, items: Website[], linkPrefix: string
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: '#ccc' }}>{title}</h2>
        <span style={{ fontSize: 13, color: '#444' }}>{subtitle}</span>
      </div>
      <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 8, overflow: 'hidden' }}>
        {items.length === 0 ? (
          <div style={{ padding: 20, color: '#444', textAlign: 'center' }}>none registered</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e1e1e' }}>
                <th style={{ textAlign: 'left', padding: '10px 16px', color: '#555', fontWeight: 500, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>name</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', color: '#555', fontWeight: 500, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>target</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', color: '#555', fontWeight: 500, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>route</th>
              </tr>
            </thead>
            <tbody>
              {items.map(w => (
                <tr key={w.name} style={{ borderBottom: '1px solid #1a1a1a' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 500 }}>{w.name}</td>
                  <td style={{ padding: '10px 16px', color: '#666', fontFamily: 'monospace', fontSize: 13 }}>{w.target_url}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <a href={`${linkPrefix}${w.name}/`} target="_blank" rel="noreferrer"
                      style={{ color: '#60a5fa', fontFamily: 'monospace', fontSize: 13 }}>
                      {linkPrefix}{w.name}/
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
