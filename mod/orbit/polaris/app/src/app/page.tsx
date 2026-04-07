'use client'

import { useState, useEffect, useCallback } from 'react'

type GPU = { name: string; display_name: string; memory: string; spot_price: number; price_per_hour?: number; available?: boolean; vram_gb?: number }
type Instance = { id: string; name: string; gpu_type: string; ip?: string; public_ip?: string; status: string; created_at?: string }
type Credits = { balance_usd?: string; balance_micros?: number; [key: string]: any }

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(`/api${path}`, opts)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

function Badge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: '#22c55e', provisioning: '#eab308', pending: '#eab308', terminated: '#ef4444',
  }
  const c = colors[status?.toLowerCase()] || '#888'
  return <span style={{ background: c + '22', color: c, padding: '2px 10px', borderRadius: 12, fontSize: 13, fontWeight: 600 }}>{status}</span>
}

export default function Home() {
  const [gpus, setGpus] = useState<GPU[]>([])
  const [instances, setInstances] = useState<Instance[]>([])
  const [credits, setCredits] = useState<Credits>({})
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: 'mod-gpu', gpu_type: 'H100 SXM5 80GB', use_spot: true, gpu_count: 1 })
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const [g, i, c] = await Promise.all([api('/gpus'), api('/instances'), api('/credits')])
      setGpus(Array.isArray(g) ? g : (g?.gpus || []))
      setInstances(Array.isArray(i) ? i : (i?.instances || []))
      setCredits(c || {})
      setError('')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const create = async () => {
    setCreating(true)
    try {
      await api('/instances', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      await refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  const terminate = async (id: string) => {
    if (!confirm('Terminate this instance? Billing will stop.')) return
    try {
      await api(`/instances/${id}`, { method: 'DELETE' })
      await refresh()
    } catch (e: any) {
      setError(e.message)
    }
  }

  const balance = credits?.balance_usd ?? (credits?.balance_micros ? `$${(credits.balance_micros / 1_000_000).toFixed(2)}` : '—')

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 style={{ margin: 0, fontSize: 28, letterSpacing: -1 }}>Polaris</h1>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ color: '#888', fontSize: 14 }}>Credits: <b style={{ color: '#22c55e' }}>{balance}</b></span>
          <button onClick={refresh} style={btnStyle('#333')}>Refresh</button>
        </div>
      </div>

      {error && <div style={{ background: '#ef444422', border: '1px solid #ef4444', color: '#ef4444', padding: '10px 16px', borderRadius: 8, marginBottom: 20, fontSize: 14 }}>{error}</div>}

      {/* Create Instance */}
      <div style={card}>
        <h2 style={h2}>Launch Instance</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
          <label style={labelStyle}>
            Name
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            GPU
            <select value={form.gpu_type} onChange={e => setForm({ ...form, gpu_type: e.target.value })} style={inputStyle}>
              {gpus.length > 0 ? gpus.map(g => <option key={g.name} value={g.name}>{g.display_name || g.name}{g.spot_price ? ` — $${g.spot_price}/hr` : ''}</option>) :
                ['Tesla V100 16GB', 'A100 SXM4 80GB', 'H100 SXM5 80GB', 'H200 SXM5 141GB'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={form.use_spot} onChange={e => setForm({ ...form, use_spot: e.target.checked })} />
            Spot
          </label>
          <button onClick={create} disabled={creating} style={btnStyle('#6366f1')}>{creating ? 'Launching...' : 'Launch'}</button>
        </div>
      </div>

      {/* Instances */}
      <div style={card}>
        <h2 style={h2}>Instances</h2>
        {loading ? <p style={{ color: '#888' }}>Loading...</p> :
          instances.length === 0 ? <p style={{ color: '#888' }}>No active instances</p> :
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #222' }}>
                {['Name', 'GPU', 'IP', 'Status', ''].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#888', fontSize: 12, fontWeight: 500, textTransform: 'uppercase' as const }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {instances.map(inst => (
                <tr key={inst.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                  <td style={td}>{inst.name}</td>
                  <td style={td}>{inst.gpu_type}</td>
                  <td style={td}><code>{inst.ip || inst.public_ip || 'pending...'}</code></td>
                  <td style={td}><Badge status={inst.status} /></td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    {inst.ip || inst.public_ip ? <button onClick={() => navigator.clipboard.writeText(`ssh root@${inst.ip || inst.public_ip}`)} style={btnStyle('#333')}>Copy SSH</button> : null}
                    <button onClick={() => terminate(inst.id)} style={{ ...btnStyle('#ef4444'), marginLeft: 8 }}>Terminate</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      </div>

      {/* GPUs */}
      <div style={card}>
        <h2 style={h2}>Available GPUs</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {gpus.map(g => (
            <div key={g.name} style={{ background: '#111118', border: '1px solid #222', borderRadius: 8, padding: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{g.display_name || g.name}</div>
              {g.memory && <div style={{ color: '#888', fontSize: 13 }}>{g.memory}</div>}
              {g.spot_price != null && <div style={{ color: '#22c55e', fontSize: 14, marginTop: 6 }}>${g.spot_price}/hr spot</div>}
              {g.available != null && <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>{g.available ? 'Available' : 'Unavailable'}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const card: React.CSSProperties = { background: '#0f0f17', border: '1px solid #1a1a2e', borderRadius: 12, padding: 24, marginBottom: 20 }
const h2: React.CSSProperties = { margin: '0 0 16px', fontSize: 18, fontWeight: 600 }
const td: React.CSSProperties = { padding: '10px 12px', fontSize: 14 }
const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#aaa' }
const inputStyle: React.CSSProperties = { background: '#111', border: '1px solid #333', color: '#eee', padding: '8px 12px', borderRadius: 6, fontSize: 14, minWidth: 180 }
const btnStyle = (bg: string): React.CSSProperties => ({ background: bg, color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 500 })
